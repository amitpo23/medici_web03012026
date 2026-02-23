/**
 * Auto-Fix Worker (ProcessRevisedFile equivalent)
 * Reads problems discovered by batch-audit-worker and attempts automated fixes.
 * Currently handles: 'missing_on_cockpit' by pushing zero availability to Zenith.
 */

const logger = require('../../config/logger');
const zenithPushService = require('../zenith-push-service');
const slackService = require('../slack-service');

class AutoFixWorker {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processing = false;
    this.batchAuditWorker = null; // Lazy-loaded to avoid circular dependency
    this.stats = {
      runs: 0,
      fixed: 0,
      skipped: 0,
      failures: 0,
      lastRun: null,
      lastSuccess: null,
      lastError: null,
      lastFixLog: []
    };
    this.config = {
      intervalMinutes: parseInt(process.env.AUTOFIX_WORKER_INTERVAL || '360', 10), // 6 hours
      enabled: process.env.AUTOFIX_WORKER_ENABLED === 'true'
    };
  }

  start(intervalMinutes) {
    if (this.isRunning) {
      logger.warn('[AutoFix] Already running');
      return;
    }
    const interval = intervalMinutes || this.config.intervalMinutes;
    this.isRunning = true;
    logger.info('[AutoFix] Started', { interval: `${interval} minutes` });

    // Lazy-load batch-audit-worker to avoid circular dependency
    if (!this.batchAuditWorker) {
      this.batchAuditWorker = require('./batch-audit-worker');
    }

    this.process();
    this.intervalId = setInterval(() => this.process(), interval * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[AutoFix] Stopped');
  }

  async process() {
    if (this.processing) return;
    this.processing = true;
    this.stats.runs++;
    this.stats.lastRun = new Date();
    const startTime = Date.now();
    const fixLog = [];

    try {
      if (!this.batchAuditWorker) {
        this.batchAuditWorker = require('./batch-audit-worker');
      }

      const problems = this.batchAuditWorker.getProblems();

      if (!problems || problems.length === 0) {
        logger.info('[AutoFix] No problems from batch audit to fix');
        this.stats.lastSuccess = new Date();
        return;
      }

      logger.info(`[AutoFix] Processing ${problems.length} problems from batch audit`);

      for (const problem of problems) {
        const result = await this.fixProblem(problem);
        fixLog.push(result);

        if (result.fixed) {
          this.stats.fixed++;
        } else if (result.skipped) {
          this.stats.skipped++;
        } else {
          this.stats.failures++;
        }
      }

      this.stats.lastFixLog = fixLog;

      // Slack summary
      const fixedCount = fixLog.filter(r => r.fixed).length;
      const skippedCount = fixLog.filter(r => r.skipped).length;
      const failedCount = fixLog.filter(r => !r.fixed && !r.skipped).length;

      if (fixedCount > 0 || failedCount > 0) {
        try {
          const fixDetails = fixLog
            .filter(r => r.fixed)
            .slice(0, 5)
            .map(r => `  - ${r.message}`)
            .join('\n');

          const failDetails = fixLog
            .filter(r => !r.fixed && !r.skipped)
            .slice(0, 3)
            .map(r => `  - ${r.message}`)
            .join('\n');

          await slackService.sendMessage(
            `*Auto-Fix Report*\nFixed: ${fixedCount}\nSkipped: ${skippedCount}\nFailed: ${failedCount}\n${fixDetails ? `\n*Fixed:*\n${fixDetails}` : ''}${failDetails ? `\n*Failed:*\n${failDetails}` : ''}`
          );
        } catch (slackErr) { /* non-blocking */ }
      }

      this.stats.lastSuccess = new Date();
    } catch (error) {
      this.stats.lastError = { message: error.message, time: new Date() };
      logger.error('[AutoFix] Process error', { error: error.message, stack: error.stack });
    } finally {
      this.processing = false;
      logger.info('[AutoFix] Cycle complete', { duration: `${Date.now() - startTime}ms` });
    }
  }

  async fixProblem(problem) {
    switch (problem.type) {
      case 'missing_on_cockpit':
        return this.fixMissingOnCockpit(problem);

      case 'price_mismatch':
        // Price mismatches require manual review - just log
        return {
          type: problem.type,
          bookId: problem.bookId,
          skipped: true,
          message: `Price mismatch on Book ${problem.bookId} (${problem.hotelName}) requires manual review. DB=${problem.expectedPrice}, Pushed=${problem.actualPrice}`
        };

      case 'missing_zenith_code':
        // Can't fix without hotel mapping - skip
        return {
          type: problem.type,
          bookId: problem.bookId,
          skipped: true,
          message: `Hotel ${problem.hotelName} (${problem.hotelId}) missing ZenithHotelCode - needs manual mapping`
        };

      case 'overlapping_bookings':
        // Overlapping bookings need manual resolution
        return {
          type: problem.type,
          bookIds: problem.bookIds,
          skipped: true,
          message: `Overlapping bookings ${problem.bookIds.join(', ')} at ${problem.hotelName} - needs manual resolution`
        };

      default:
        return {
          type: problem.type,
          skipped: true,
          message: `Unknown problem type: ${problem.type}`
        };
    }
  }

  async fixMissingOnCockpit(problem) {
    try {
      if (!problem.zenithHotelCode || !problem.zenithRoomCode) {
        return {
          type: problem.type,
          bookId: problem.bookId,
          skipped: true,
          message: `Book ${problem.bookId} (${problem.hotelName}) missing Zenith codes - cannot push`
        };
      }

      // Push zero availability to close the room on Zenith
      // This prevents selling rooms that aren't properly synced
      await zenithPushService.pushAvailability({
        hotelCode: problem.zenithHotelCode,
        invTypeCode: problem.zenithRoomCode,
        startDate: problem.startDate,
        endDate: problem.endDate,
        available: 0
      });

      logger.info('[AutoFix] Pushed zero availability for missing booking', {
        bookId: problem.bookId,
        hotel: problem.hotelName,
        zenithCode: problem.zenithHotelCode
      });

      return {
        type: problem.type,
        bookId: problem.bookId,
        fixed: true,
        message: `Closed availability for Book ${problem.bookId} (${problem.hotelName}) on Zenith`
      };

    } catch (error) {
      logger.error('[AutoFix] Failed to fix missing_on_cockpit', {
        bookId: problem.bookId,
        error: error.message
      });

      return {
        type: problem.type,
        bookId: problem.bookId,
        fixed: false,
        skipped: false,
        message: `Failed to fix Book ${problem.bookId} (${problem.hotelName}): ${error.message}`
      };
    }
  }

  getStatus() {
    return {
      name: 'auto-fix',
      description: 'ProcessRevisedFile - Fixes problems found by batch audit',
      isRunning: this.isRunning,
      processing: this.processing,
      config: this.config,
      stats: this.stats
    };
  }
}

module.exports = new AutoFixWorker();
