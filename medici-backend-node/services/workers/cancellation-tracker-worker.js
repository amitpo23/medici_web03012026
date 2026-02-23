/**
 * Cancellation Tracker Worker (WebInnstant equivalent)
 * Tracks cancelled bookings and verifies supplier-side cancellation status.
 * Identifies discrepancies between local DB and supplier records.
 */

const logger = require('../../config/logger');
const { sql, getPool } = require('../../config/database');
const InnstantClient = require('../innstant-client');
const slackService = require('../slack-service');

class CancellationTrackerWorker {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processing = false;
    this.innstantClient = new InnstantClient();
    this.stats = {
      runs: 0,
      checked: 0,
      discrepancies: 0,
      lastRun: null,
      lastSuccess: null,
      lastError: null
    };
    this.config = {
      intervalMinutes: parseInt(process.env.CANCELTRACK_WORKER_INTERVAL || '30', 10),
      enabled: process.env.CANCELTRACK_WORKER_ENABLED === 'true'
    };
  }

  start(intervalMinutes) {
    if (this.isRunning) {
      logger.warn('[CancelTracker] Already running');
      return;
    }
    const interval = intervalMinutes || this.config.intervalMinutes;
    this.isRunning = true;
    logger.info('[CancelTracker] Started', { interval: `${interval} minutes` });
    this.process();
    this.intervalId = setInterval(() => this.process(), interval * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[CancelTracker] Stopped');
  }

  async process() {
    if (this.processing) return;
    this.processing = true;
    this.stats.runs++;
    this.stats.lastRun = new Date();
    const startTime = Date.now();

    try {
      const pool = await getPool();

      // Get recent cancellations (last 7 days)
      const result = await pool.request().query(`
        SELECT
          cb.Id, cb.PreBookId, cb.contentCancelBookingID,
          cb.DateInsert AS CancelDate,
          b.id AS BookId, b.contentBookingID, b.providers,
          b.HotelId, b.IsActive AS BookIsActive,
          b.startDate, b.endDate, b.price,
          h.Name AS HotelName
        FROM MED_CancelBook cb
        LEFT JOIN MED_Book b ON cb.PreBookId = b.PreBookId
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE cb.DateInsert >= DATEADD(DAY, -7, GETDATE())
        ORDER BY cb.DateInsert DESC
      `);

      const cancellations = result.recordset;
      if (cancellations.length === 0) {
        logger.info('[CancelTracker] No recent cancellations to verify');
        this.stats.lastSuccess = new Date();
        return;
      }

      logger.info(`[CancelTracker] Checking ${cancellations.length} recent cancellations`);

      const discrepancies = [];

      for (const cancel of cancellations) {
        this.stats.checked++;

        // Only verify Innstant bookings (GoGlobal verification pattern differs)
        if (cancel.providers !== 'Innstant' || !cancel.contentBookingID) {
          continue;
        }

        try {
          const supplierStatus = await this.innstantClient.getBookingDetails(cancel.contentBookingID);

          if (supplierStatus.success && supplierStatus.data) {
            const status = supplierStatus.data.status || supplierStatus.data.bookingStatus;

            // Check for discrepancy: cancelled in DB but active in supplier
            if (status && !['cancelled', 'canceled', 'CX'].includes(status.toLowerCase())) {
              discrepancies.push({
                bookId: cancel.BookId,
                hotelName: cancel.HotelName,
                bookingRef: cancel.contentBookingID,
                issue: `Cancelled in DB but supplier shows status: ${status}`,
                cancelDate: cancel.CancelDate
              });
            }
          }
        } catch (apiError) {
          // API call failures are expected for old bookings - don't count as discrepancies
          logger.debug('[CancelTracker] API check failed (expected for old bookings)', {
            bookingRef: cancel.contentBookingID,
            error: apiError.message
          });
        }
      }

      // Also check for active bookings that might be cancelled at supplier
      const activeResult = await pool.request().query(`
        SELECT TOP 20
          b.id AS BookId, b.contentBookingID, b.providers,
          b.HotelId, b.price, b.startDate,
          h.Name AS HotelName
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.IsActive = 1
          AND b.providers = 'Innstant'
          AND b.contentBookingID IS NOT NULL
          AND b.startDate >= GETDATE()
        ORDER BY b.startDate ASC
      `);

      for (const booking of activeResult.recordset) {
        try {
          const supplierStatus = await this.innstantClient.getBookingDetails(booking.contentBookingID);

          if (supplierStatus.success && supplierStatus.data) {
            const status = supplierStatus.data.status || supplierStatus.data.bookingStatus;

            if (status && ['cancelled', 'canceled', 'CX'].includes(status.toLowerCase())) {
              discrepancies.push({
                bookId: booking.BookId,
                hotelName: booking.HotelName,
                bookingRef: booking.contentBookingID,
                issue: `Active in DB but supplier shows CANCELLED`,
                startDate: booking.startDate
              });
            }
          }
        } catch (apiError) {
          // Non-blocking
        }
      }

      this.stats.discrepancies += discrepancies.length;

      if (discrepancies.length > 0) {
        logger.warn('[CancelTracker] Discrepancies found', { count: discrepancies.length, details: discrepancies });

        // Log discrepancies to MED_CancelBookError if table exists
        for (const disc of discrepancies) {
          try {
            await pool.request()
              .input('preBookId', sql.Int, 0)
              .input('errorMsg', sql.NVarChar, `[CancelTracker] ${disc.issue} - BookId: ${disc.bookId}, Hotel: ${disc.hotelName}`)
              .query(`
                INSERT INTO MED_CancelBookError (PreBookId, ErrorMessage, DateInsert)
                VALUES (@preBookId, @errorMsg, GETDATE())
              `);
          } catch (dbErr) {
            logger.debug('[CancelTracker] Could not log to MED_CancelBookError', { error: dbErr.message });
          }
        }

        // Slack summary
        try {
          const summary = discrepancies.slice(0, 5).map(d =>
            `  - BookId ${d.bookId} (${d.hotelName}): ${d.issue}`
          ).join('\n');
          await slackService.sendMessage(
            `*Cancellation Tracking Discrepancies*\nChecked: ${cancellations.length}\nDiscrepancies: ${discrepancies.length}\n${summary}`
          );
        } catch (slackErr) { /* non-blocking */ }
      } else {
        logger.info('[CancelTracker] All cancellations verified - no discrepancies');
      }

      this.stats.lastSuccess = new Date();
    } catch (error) {
      this.stats.lastError = { message: error.message, time: new Date() };
      logger.error('[CancelTracker] Process error', { error: error.message });
    } finally {
      this.processing = false;
      logger.info('[CancelTracker] Cycle complete', { duration: `${Date.now() - startTime}ms` });
    }
  }

  getStatus() {
    return {
      name: 'cancellation-tracker',
      description: 'WebInnstant - Tracks and verifies supplier cancellation status',
      isRunning: this.isRunning,
      processing: this.processing,
      config: this.config,
      stats: this.stats
    };
  }
}

module.exports = new CancellationTrackerWorker();
