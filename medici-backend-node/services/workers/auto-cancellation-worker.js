/**
 * Auto-Cancellation Worker (MediciAutoCancellation equivalent)
 * Monitors unsold bookings approaching free-cancellation deadline and cancels them automatically.
 * On failure: sends Slack alert requesting manual cancellation.
 */

const logger = require('../../config/logger');
const { sql, getPool } = require('../../config/database');
const InnstantClient = require('../innstant-client');
const GoGlobalClient = require('../goglobal-client');
const zenithPushService = require('../zenith-push-service');
const slackService = require('../slack-service');

class AutoCancellationWorker {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processing = false;
    this.innstantClient = new InnstantClient();
    this.goGlobalClient = new GoGlobalClient();
    this.cancelCountThisHour = 0;
    this.hourResetTime = Date.now();
    this.stats = {
      runs: 0,
      cancelled: 0,
      failures: 0,
      lastRun: null,
      lastSuccess: null,
      lastError: null
    };
    this.config = {
      intervalMinutes: parseInt(process.env.AUTOCANCEL_WORKER_INTERVAL || '5', 10),
      enabled: process.env.AUTOCANCEL_WORKER_ENABLED === 'true',
      maxCancelsPerHour: parseInt(process.env.AUTOCANCEL_MAX_PER_HOUR || '10', 10)
    };
  }

  start(intervalMinutes) {
    if (this.isRunning) {
      logger.warn('[AutoCancel] Already running');
      return;
    }
    const interval = intervalMinutes || this.config.intervalMinutes;
    this.isRunning = true;
    logger.info('[AutoCancel] Started', { interval: `${interval} minutes`, config: this.config });
    this.process();
    this.intervalId = setInterval(() => this.process(), interval * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[AutoCancel] Stopped');
  }

  async process() {
    if (this.processing) {
      logger.warn('[AutoCancel] Previous run still in progress, skipping');
      return;
    }
    this.processing = true;
    this.stats.runs++;
    this.stats.lastRun = new Date();
    const startTime = Date.now();

    try {
      // Reset hourly counter if needed
      if (Date.now() - this.hourResetTime >= 3600000) {
        this.cancelCountThisHour = 0;
        this.hourResetTime = Date.now();
      }

      const pool = await getPool();

      // Find unsold bookings near cancellation deadline
      const result = await pool.request().query(`
        SELECT
          b.id AS BookId, b.PreBookId, b.contentBookingID, b.HotelId,
          b.startDate, b.endDate, b.price, b.providers,
          b.CancellationTo, b.OpportunityId, b.supplierReference,
          h.Name AS HotelName, h.ZenithHotelCode,
          pb.CategoryId,
          rc.ZenithRoomCode
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        LEFT JOIN MED_PreBook pb ON b.PreBookId = pb.PreBookId
        LEFT JOIN MED_RoomCategory rc ON pb.CategoryId = rc.CategoryId
        WHERE b.IsActive = 1
          AND b.IsSold = 0
          AND b.CancellationTo IS NOT NULL
          AND b.CancellationTo <= DATEADD(day, 1, GETDATE())
        ORDER BY b.CancellationTo ASC
      `);

      const bookings = result.recordset;
      if (bookings.length === 0) {
        logger.info('[AutoCancel] No bookings to cancel');
        this.stats.lastSuccess = new Date();
        return;
      }

      logger.info(`[AutoCancel] Found ${bookings.length} bookings to cancel`);

      for (const booking of bookings) {
        // Rate limit check
        if (this.cancelCountThisHour >= this.config.maxCancelsPerHour) {
          logger.warn('[AutoCancel] Hourly rate limit reached', {
            limit: this.config.maxCancelsPerHour,
            count: this.cancelCountThisHour
          });
          break;
        }

        await this.cancelBooking(pool, booking);
      }

      this.stats.lastSuccess = new Date();
    } catch (error) {
      this.stats.lastError = { message: error.message, time: new Date() };
      logger.error('[AutoCancel] Process error', { error: error.message, stack: error.stack });
    } finally {
      this.processing = false;
      logger.info('[AutoCancel] Cycle complete', { duration: `${Date.now() - startTime}ms` });
    }
  }

  async cancelBooking(pool, booking) {
    try {
      logger.info('[AutoCancel] Cancelling booking', {
        bookId: booking.BookId,
        hotel: booking.HotelName,
        provider: booking.providers,
        deadline: booking.CancellationTo
      });

      let cancelResult = { success: false };

      // Cancel with supplier based on provider
      if (booking.providers === 'Innstant' && booking.contentBookingID) {
        cancelResult = await this.innstantClient.cancelBooking(booking.contentBookingID);
      } else if (booking.providers === 'GoGlobal' && booking.contentBookingID) {
        cancelResult = await this.goGlobalClient.cancelBooking({ bookingId: booking.contentBookingID });
      } else {
        // Manual or unknown provider - just deactivate locally
        cancelResult = { success: true, cancellationId: 'LOCAL' };
      }

      if (cancelResult.success) {
        // Insert cancellation record
        await pool.request()
          .input('preBookId', sql.Int, booking.PreBookId)
          .input('cancelId', sql.NVarChar, cancelResult.cancellationId || 'AUTO')
          .input('reason', sql.NVarChar, 'Auto-cancellation: unsold before free-cancellation deadline')
          .query(`
            INSERT INTO MED_CancelBook (PreBookId, contentCancelBookingID, DateInsert, Reason)
            VALUES (@preBookId, @cancelId, GETDATE(), @reason)
          `);

        // Deactivate booking
        await pool.request()
          .input('bookId', sql.Int, booking.BookId)
          .query(`
            UPDATE MED_Book SET IsActive = 0, Status = 'Cancelled' WHERE id = @bookId
          `);

        // Close Zenith availability
        if (booking.ZenithHotelCode && booking.ZenithRoomCode) {
          try {
            await zenithPushService.pushAvailability({
              hotelCode: booking.ZenithHotelCode,
              invTypeCode: booking.ZenithRoomCode,
              startDate: booking.startDate,
              endDate: booking.endDate,
              available: 0
            });
          } catch (zenithErr) {
            logger.error('[AutoCancel] Zenith push failed (non-blocking)', { error: zenithErr.message });
          }
        }

        this.stats.cancelled++;
        this.cancelCountThisHour++;
        logger.info('[AutoCancel] Successfully cancelled', { bookId: booking.BookId, hotel: booking.HotelName });

        try {
          await slackService.sendMessage(
            `*Auto-Cancellation Success*\nBookId: ${booking.BookId}\nHotel: ${booking.HotelName}\nProvider: ${booking.providers}\nPrice: ${booking.price}\nDeadline: ${booking.CancellationTo}`
          );
        } catch (slackErr) { /* non-blocking */ }

      } else {
        throw new Error(cancelResult.error || 'Supplier cancellation failed');
      }

    } catch (error) {
      this.stats.failures++;
      logger.error('[AutoCancel] Failed to cancel booking', {
        bookId: booking.BookId,
        hotel: booking.HotelName,
        error: error.message
      });

      // Send manual cancellation alert
      try {
        await slackService.sendMessage(
          `*MANUAL CANCELLATION REQUIRED*\nBookId: ${booking.BookId}\nHotel: ${booking.HotelName}\nBooking Ref: ${booking.contentBookingID}\nProvider: ${booking.providers}\nDeadline: ${booking.CancellationTo}\nError: ${error.message}`
        );
      } catch (slackErr) {
        logger.error('[AutoCancel] Slack alert also failed', { error: slackErr.message });
      }
    }
  }

  getStatus() {
    return {
      name: 'auto-cancellation',
      description: 'MediciAutoCancellation - Cancels unsold bookings before deadline',
      isRunning: this.isRunning,
      processing: this.processing,
      config: this.config,
      stats: { ...this.stats, cancelCountThisHour: this.cancelCountThisHour }
    };
  }
}

module.exports = new AutoCancellationWorker();
