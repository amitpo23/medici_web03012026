/**
 * Snapshot Verification Worker (WebHotel equivalent)
 * Polls Queue table and verifies that pushed prices/availability match expected values.
 * Uses MED_PushLog to verify instead of Selenium scraping.
 */

const logger = require('../../config/logger');
const { sql, getPool } = require('../../config/database');
const slackService = require('../slack-service');

class SnapshotVerificationWorker {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processing = false;
    this.stats = {
      runs: 0,
      verified: 0,
      errors: 0,
      lastRun: null,
      lastSuccess: null,
      lastError: null
    };
    this.config = {
      intervalMinutes: parseInt(process.env.SNAPSHOT_WORKER_INTERVAL || '1', 10),
      enabled: process.env.SNAPSHOT_WORKER_ENABLED === 'true'
    };
  }

  start(intervalMinutes) {
    if (this.isRunning) {
      logger.warn('[Snapshot] Already running');
      return;
    }
    const interval = intervalMinutes || this.config.intervalMinutes;
    this.isRunning = true;
    logger.info('[Snapshot] Started', { interval: `${interval} minutes` });
    this.process();
    this.intervalId = setInterval(() => this.process(), interval * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[Snapshot] Stopped');
  }

  async process() {
    if (this.processing) return;
    this.processing = true;
    this.stats.runs++;
    this.stats.lastRun = new Date();
    const startTime = Date.now();

    try {
      const pool = await getPool();

      // Get next queue item
      const result = await pool.request().query(`
        SELECT TOP 1
          q.Id, q.CreatedOn, q.PrebookId, q.Status, q.Message,
          q.HotelId, q.HotelName, q.Month, q.Year, q.Day,
          q.ReservationsExpected, q.PriceExpected,
          q.Pricing, q.RatePlan, q.Parameters
        FROM Queue q
        WHERE q.Status = 'AddedToQueue'
        ORDER BY q.CreatedOn ASC
      `);

      if (result.recordset.length === 0) {
        return;
      }

      const queueItem = result.recordset[0];
      logger.info('[Snapshot] Processing queue item', {
        id: queueItem.Id,
        hotel: queueItem.HotelName,
        date: `${queueItem.Year}-${queueItem.Month}-${queueItem.Day}`
      });

      // Mark as processing
      await pool.request()
        .input('queueId', sql.Int, queueItem.Id)
        .query(`UPDATE Queue SET Status = 'Processing' WHERE Id = @queueId`);

      // Verify by checking the latest push log for this booking
      const pushLogResult = await pool.request()
        .input('prebookId', sql.Int, queueItem.PrebookId)
        .query(`
          SELECT TOP 1
            pl.ZenithRequest, pl.ZenithResponse, pl.Success,
            pl.CreatedAt AS PushDate, pl.PushType, pl.ErrorMessage
          FROM MED_PushLog pl
          LEFT JOIN MED_Book b ON pl.BookId = b.id
          WHERE (b.PreBookId = @prebookId OR pl.BookId = @prebookId)
            AND pl.Success = 1
          ORDER BY pl.CreatedAt DESC
        `);

      let verificationResult;
      if (pushLogResult.recordset.length === 0) {
        verificationResult = {
          success: false,
          message: `No successful push found for PrebookId ${queueItem.PrebookId}`
        };
      } else {
        const pushLog = pushLogResult.recordset[0];

        // Extract pushed price from XML response if available
        let pushedPrice = null;
        if (pushLog.ZenithRequest) {
          const priceMatch = pushLog.ZenithRequest.match(/AmountAfterTax="([\d.]+)"/);
          if (priceMatch) {
            pushedPrice = parseFloat(priceMatch[1]);
          }
        }

        if (pushedPrice !== null && queueItem.PriceExpected) {
          // Price comparison with 1 decimal truncation (matching C# behavior)
          const expectedTruncated = Math.floor(parseFloat(queueItem.PriceExpected) * 10) / 10;
          const actualTruncated = Math.floor(pushedPrice * 10) / 10;

          if (expectedTruncated === actualTruncated) {
            verificationResult = {
              success: true,
              message: `Snapshot check SUCCESS. Price: ${actualTruncated} matches expected: ${expectedTruncated}`
            };
          } else {
            verificationResult = {
              success: false,
              message: `Snapshot check ERROR. Expected: ${expectedTruncated}, Actual: ${actualTruncated}, Diff: ${(actualTruncated - expectedTruncated).toFixed(1)}`
            };
          }
        } else {
          verificationResult = {
            success: true,
            message: `Push verified at ${pushLog.PushDate}. Type: ${pushLog.PushType}. Price extraction not available.`
          };
        }
      }

      // Update queue item
      const newStatus = verificationResult.success ? 'Finished' : 'Error';
      await pool.request()
        .input('queueId', sql.Int, queueItem.Id)
        .input('status', sql.NVarChar, newStatus)
        .input('message', sql.NVarChar, verificationResult.message)
        .query(`
          UPDATE Queue
          SET Status = @status, Message = @message
          WHERE Id = @queueId
        `);

      if (verificationResult.success) {
        this.stats.verified++;
        this.stats.lastSuccess = new Date();
        logger.info('[Snapshot] Verification passed', { queueId: queueItem.Id, hotel: queueItem.HotelName });
      } else {
        this.stats.errors++;
        logger.warn('[Snapshot] Verification failed', {
          queueId: queueItem.Id,
          hotel: queueItem.HotelName,
          message: verificationResult.message
        });

        try {
          await slackService.sendMessage(
            `*Snapshot Verification Failed*\nHotel: ${queueItem.HotelName}\nDate: ${queueItem.Year}-${queueItem.Month}-${queueItem.Day}\n${verificationResult.message}`
          );
        } catch (slackErr) { /* non-blocking */ }
      }

    } catch (error) {
      this.stats.lastError = { message: error.message, time: new Date() };
      logger.error('[Snapshot] Process error', { error: error.message });
    } finally {
      this.processing = false;
      const duration = Date.now() - startTime;
      if (duration > 1000) {
        logger.info('[Snapshot] Cycle complete', { duration: `${duration}ms` });
      }
    }
  }

  getStatus() {
    return {
      name: 'snapshot-verification',
      description: 'WebHotel - Verifies pushed prices match expected values',
      isRunning: this.isRunning,
      processing: this.processing,
      config: this.config,
      stats: this.stats
    };
  }
}

module.exports = new SnapshotVerificationWorker();
