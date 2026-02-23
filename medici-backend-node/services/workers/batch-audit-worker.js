/**
 * Batch Audit Worker (WebHotelRevise equivalent)
 * Runs daily audit of all active bookings vs Zenith push records.
 * Identifies: unpushed bookings, count mismatches, price mismatches.
 * Stores problems in-memory for auto-fix-worker to consume.
 */

const logger = require('../../config/logger');
const { sql, getPool } = require('../../config/database');
const slackService = require('../slack-service');

class BatchAuditWorker {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processing = false;
    this.lastAuditProblems = [];
    this.stats = {
      runs: 0,
      totalAudited: 0,
      problemsFound: 0,
      lastRun: null,
      lastSuccess: null,
      lastError: null
    };
    this.config = {
      intervalMinutes: parseInt(process.env.BATCHAUDIT_WORKER_INTERVAL || '1440', 10), // 24 hours
      enabled: process.env.BATCHAUDIT_WORKER_ENABLED === 'true'
    };
  }

  start(intervalMinutes) {
    if (this.isRunning) {
      logger.warn('[BatchAudit] Already running');
      return;
    }
    const interval = intervalMinutes || this.config.intervalMinutes;
    this.isRunning = true;
    logger.info('[BatchAudit] Started', { interval: `${interval} minutes` });
    this.process();
    this.intervalId = setInterval(() => this.process(), interval * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[BatchAudit] Stopped');
  }

  async process() {
    if (this.processing) return;
    this.processing = true;
    this.stats.runs++;
    this.stats.lastRun = new Date();
    const startTime = Date.now();

    try {
      const pool = await getPool();
      const problems = [];

      // Get all active bookings grouped by hotel/category/board
      const activeBookings = await pool.request().query(`
        SELECT
          b.id AS BookId, b.PreBookId, b.contentBookingID,
          b.HotelId, b.startDate, b.endDate, b.price,
          b.providers, b.IsSold, b.CancellationTo,
          h.Name AS HotelName, h.ZenithHotelCode,
          pb.CategoryId, pb.BoardId,
          rc.CategoryName, rc.ZenithRoomCode,
          bd.BoardName
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        LEFT JOIN MED_PreBook pb ON b.PreBookId = pb.PreBookId
        LEFT JOIN MED_RoomCategory rc ON pb.CategoryId = rc.CategoryId
        LEFT JOIN MED_Board bd ON pb.BoardId = bd.BoardId
        WHERE b.IsActive = 1
        ORDER BY b.HotelId, pb.CategoryId, pb.BoardId
      `);

      const bookings = activeBookings.recordset;
      if (bookings.length === 0) {
        logger.info('[BatchAudit] No active bookings to audit');
        this.stats.lastSuccess = new Date();
        return;
      }

      logger.info(`[BatchAudit] Auditing ${bookings.length} active bookings`);
      this.stats.totalAudited += bookings.length;

      // Check each booking for push verification
      for (const booking of bookings) {
        if (!booking.ZenithHotelCode) {
          problems.push({
            type: 'missing_zenith_code',
            bookId: booking.BookId,
            hotelId: booking.HotelId,
            hotelName: booking.HotelName,
            message: 'Hotel has no ZenithHotelCode - cannot push to cockpit'
          });
          continue;
        }

        // Check if booking was pushed to Zenith
        const pushResult = await pool.request()
          .input('bookId', sql.Int, booking.BookId)
          .query(`
            SELECT TOP 1
              pl.Id, pl.Success, pl.PushType,
              pl.CreatedAt, pl.ErrorMessage,
              pl.ZenithRequest
            FROM MED_PushLog pl
            WHERE pl.BookId = @bookId
              AND pl.Success = 1
            ORDER BY pl.CreatedAt DESC
          `);

        if (pushResult.recordset.length === 0) {
          problems.push({
            type: 'missing_on_cockpit',
            bookId: booking.BookId,
            hotelId: booking.HotelId,
            hotelName: booking.HotelName,
            zenithHotelCode: booking.ZenithHotelCode,
            zenithRoomCode: booking.ZenithRoomCode,
            startDate: booking.startDate,
            endDate: booking.endDate,
            price: booking.price,
            message: 'Active booking never successfully pushed to Zenith'
          });
          continue;
        }

        // Verify pushed price matches current booking price
        const pushLog = pushResult.recordset[0];
        if (pushLog.ZenithRequest) {
          const priceMatch = pushLog.ZenithRequest.match(/AmountAfterTax="([\d.]+)"/);
          if (priceMatch) {
            const pushedPrice = parseFloat(priceMatch[1]);
            const bookingPrice = parseFloat(booking.price);

            // Compare with tolerance (truncated to 1 decimal)
            const pushedTruncated = Math.floor(pushedPrice * 10) / 10;
            const bookingTruncated = Math.floor(bookingPrice * 10) / 10;

            if (pushedTruncated !== bookingTruncated) {
              problems.push({
                type: 'price_mismatch',
                bookId: booking.BookId,
                hotelId: booking.HotelId,
                hotelName: booking.HotelName,
                zenithHotelCode: booking.ZenithHotelCode,
                zenithRoomCode: booking.ZenithRoomCode,
                startDate: booking.startDate,
                endDate: booking.endDate,
                expectedPrice: bookingTruncated,
                actualPrice: pushedTruncated,
                message: `Price mismatch: DB=${bookingTruncated}, Pushed=${pushedTruncated}`
              });
            }
          }
        }
      }

      // Group bookings by hotel+category+board and check counts
      const grouped = {};
      for (const booking of bookings) {
        const key = `${booking.HotelId}_${booking.CategoryId || 'NA'}_${booking.BoardId || 'NA'}`;
        if (!grouped[key]) {
          grouped[key] = {
            hotelId: booking.HotelId,
            hotelName: booking.HotelName,
            categoryName: booking.CategoryName,
            boardName: booking.BoardName,
            zenithHotelCode: booking.ZenithHotelCode,
            bookings: []
          };
        }
        grouped[key].bookings.push(booking);
      }

      // Check for hotels with multiple active bookings for same room type
      for (const [key, group] of Object.entries(grouped)) {
        if (group.bookings.length > 1) {
          // Check for overlapping dates
          const sorted = group.bookings.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
          for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];
            if (new Date(current.endDate) > new Date(next.startDate)) {
              problems.push({
                type: 'overlapping_bookings',
                bookIds: [current.BookId, next.BookId],
                hotelId: group.hotelId,
                hotelName: group.hotelName,
                category: group.categoryName,
                board: group.boardName,
                message: `Overlapping dates: Book ${current.BookId} ends ${current.endDate}, Book ${next.BookId} starts ${next.startDate}`
              });
            }
          }
        }
      }

      // Store problems for auto-fix worker
      this.lastAuditProblems = problems;
      this.stats.problemsFound = problems.length;

      if (problems.length > 0) {
        logger.warn('[BatchAudit] Problems found', {
          total: problems.length,
          byType: {
            missing_zenith_code: problems.filter(p => p.type === 'missing_zenith_code').length,
            missing_on_cockpit: problems.filter(p => p.type === 'missing_on_cockpit').length,
            price_mismatch: problems.filter(p => p.type === 'price_mismatch').length,
            overlapping_bookings: problems.filter(p => p.type === 'overlapping_bookings').length
          }
        });

        // Slack summary
        try {
          const typeCounts = {};
          for (const p of problems) {
            typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
          }
          const typeLines = Object.entries(typeCounts)
            .map(([type, count]) => `  - ${type}: ${count}`)
            .join('\n');

          const topProblems = problems.slice(0, 5)
            .map(p => `  - ${p.hotelName || 'Unknown'}: ${p.message}`)
            .join('\n');

          await slackService.sendMessage(
            `*Batch Audit Report*\nBookings Audited: ${bookings.length}\nProblems Found: ${problems.length}\n\n*By Type:*\n${typeLines}\n\n*Top Issues:*\n${topProblems}`
          );
        } catch (slackErr) { /* non-blocking */ }
      } else {
        logger.info('[BatchAudit] Audit complete - no problems found');
      }

      this.stats.lastSuccess = new Date();
    } catch (error) {
      this.stats.lastError = { message: error.message, time: new Date() };
      logger.error('[BatchAudit] Process error', { error: error.message, stack: error.stack });
    } finally {
      this.processing = false;
      logger.info('[BatchAudit] Cycle complete', { duration: `${Date.now() - startTime}ms` });
    }
  }

  getProblems() {
    return this.lastAuditProblems;
  }

  getStatus() {
    return {
      name: 'batch-audit',
      description: 'WebHotelRevise - Daily audit of bookings vs Zenith push records',
      isRunning: this.isRunning,
      processing: this.processing,
      config: this.config,
      stats: this.stats,
      problemCount: this.lastAuditProblems.length
    };
  }
}

module.exports = new BatchAuditWorker();
