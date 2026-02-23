/**
 * Worker Manager - Central registry for all background workers
 * Manages lifecycle (start/stop) and status reporting for 6 production-parity workers
 */

const logger = require('../../config/logger');

class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    this.register('buy-rooms', require('./buy-rooms-worker'));
    this.register('auto-cancellation', require('./auto-cancellation-worker'));
    this.register('snapshot-verification', require('./snapshot-verification-worker'));
    this.register('batch-audit', require('./batch-audit-worker'));
    this.register('auto-fix', require('./auto-fix-worker'));
    this.register('cancellation-tracker', require('./cancellation-tracker-worker'));

    this.initialized = true;
    logger.info('[WorkerManager] Initialized', {
      workers: Array.from(this.workers.keys())
    });
  }

  register(name, workerInstance) {
    this.workers.set(name, workerInstance);
  }

  startAll() {
    const autoStart = process.env.WORKERS_AUTO_START === 'true';
    if (!autoStart) {
      logger.info('[WorkerManager] WORKERS_AUTO_START is not true, skipping auto-start. Use API to start workers manually.');
      return;
    }
    for (const [name, worker] of this.workers) {
      if (worker.config && worker.config.enabled) {
        try {
          worker.start();
          logger.info(`[WorkerManager] Auto-started: ${name}`);
        } catch (err) {
          logger.error(`[WorkerManager] Failed to auto-start ${name}`, { error: err.message });
        }
      } else {
        logger.info(`[WorkerManager] Skipped disabled worker: ${name}`);
      }
    }
  }

  startWorker(name) {
    const worker = this.workers.get(name);
    if (!worker) {
      throw new Error(`Worker not found: ${name}. Available: ${Array.from(this.workers.keys()).join(', ')}`);
    }
    worker.start();
    logger.info(`[WorkerManager] Started: ${name}`);
  }

  stopWorker(name) {
    const worker = this.workers.get(name);
    if (!worker) {
      throw new Error(`Worker not found: ${name}. Available: ${Array.from(this.workers.keys()).join(', ')}`);
    }
    worker.stop();
    logger.info(`[WorkerManager] Stopped: ${name}`);
  }

  stopAll() {
    for (const [name, worker] of this.workers) {
      try {
        worker.stop();
      } catch (err) {
        logger.error(`[WorkerManager] Error stopping ${name}`, { error: err.message });
      }
    }
    logger.info('[WorkerManager] All workers stopped');
  }

  getStatus() {
    const statuses = {};
    for (const [name, worker] of this.workers) {
      statuses[name] = worker.getStatus ? worker.getStatus() : { isRunning: worker.isRunning || false };
    }
    return {
      initialized: this.initialized,
      autoStart: process.env.WORKERS_AUTO_START === 'true',
      workerCount: this.workers.size,
      workers: statuses
    };
  }

  getWorkerNames() {
    return Array.from(this.workers.keys());
  }
}

module.exports = new WorkerManager();
