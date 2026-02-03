/**
 * Worker Coordinator - Central Management for All Background Workers
 * 
 * Purpose: Coordinates all background workers, monitors health, handles errors
 * Features:
 * - Worker lifecycle management (start/stop/restart)
 * - Health monitoring with heartbeats
 * - Error recovery and retry logic
 * - Centralized logging and alerting
 * - Performance metrics tracking
 */

const logger = require('../config/logger');
const sql = require('mssql');
const slackService = require('../services/slack-service');

class WorkerCoordinator {
  constructor() {
    this.workers = new Map();
    this.healthChecks = new Map();
    this.isShuttingDown = false;
    
    // Worker configurations
    this.workerConfigs = {
      'buyroom-worker': {
        name: 'BuyRoom Worker',
        schedule: '*/5 * * * *', // Every 5 minutes
        healthCheckInterval: 60000, // 1 minute
        maxConsecutiveFailures: 3,
        enabled: true
      },
      'auto-cancellation-worker': {
        name: 'Auto-Cancellation Worker',
        schedule: '0 */1 * * *', // Every hour
        healthCheckInterval: 300000, // 5 minutes
        maxConsecutiveFailures: 2,
        enabled: true
      },
      'price-update-worker': {
        name: 'Price Update Worker',
        schedule: '*/10 * * * *', // Every 10 minutes
        healthCheckInterval: 120000, // 2 minutes
        maxConsecutiveFailures: 3,
        enabled: true
      }
    };
    
    this.stats = {
      startTime: new Date(),
      totalRestarts: 0,
      totalErrors: 0,
      lastHealthCheck: null
    };
  }

  /**
   * Initialize the coordinator and all workers
   */
  async initialize() {
    try {
      logger.info('🚀 Worker Coordinator initializing...');
      
      // Register all workers
      await this.registerWorkers();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      logger.info('✅ Worker Coordinator initialized successfully', {
        workerCount: this.workers.size,
        enabledWorkers: Array.from(this.workers.keys())
      });
      
      // Send startup notification
      await slackService.sendMessage(
        `🟢 Worker Coordinator Started\n` +
        `Workers: ${Array.from(this.workers.keys()).join(', ')}\n` +
        `Time: ${new Date().toISOString()}`
      );
      
    } catch (error) {
      logger.error('❌ Failed to initialize Worker Coordinator', { error: error.message });
      throw error;
    }
  }

  /**
   * Register all workers
   */
  async registerWorkers() {
    for (const [workerId, config] of Object.entries(this.workerConfigs)) {
      if (config.enabled) {
        await this.registerWorker(workerId, config);
      }
    }
  }

  /**
   * Register a single worker
   */
  async registerWorker(workerId, config) {
    try {
      logger.info(`Registering worker: ${config.name}`);
      
      this.workers.set(workerId, {
        id: workerId,
        name: config.name,
        status: 'registered',
        config: config,
        stats: {
          runs: 0,
          successes: 0,
          failures: 0,
          consecutiveFailures: 0,
          lastRun: null,
          lastSuccess: null,
          lastFailure: null,
          avgDuration: 0
        },
        process: null
      });
      
      // Initialize health check tracking
      this.healthChecks.set(workerId, {
        lastHeartbeat: new Date(),
        isHealthy: true,
        consecutiveFailures: 0
      });
      
      logger.info(`✅ Worker registered: ${config.name}`);
      
    } catch (error) {
      logger.error(`❌ Failed to register worker: ${config.name}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Start a specific worker
   */
  async startWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    try {
      logger.info(`Starting worker: ${worker.name}`);
      
      // Import and initialize the worker
      const WorkerClass = require(`./${workerId}`);
      const workerInstance = new WorkerClass();
      
      // Start the worker
      await workerInstance.start();
      
      worker.process = workerInstance;
      worker.status = 'running';
      worker.stats.lastRun = new Date();
      
      logger.info(`✅ Worker started: ${worker.name}`);
      
      return true;
      
    } catch (error) {
      logger.error(`❌ Failed to start worker: ${worker.name}`, { error: error.message });
      worker.status = 'error';
      worker.stats.failures++;
      worker.stats.consecutiveFailures++;
      
      await this.handleWorkerError(workerId, error);
      
      return false;
    }
  }

  /**
   * Stop a specific worker
   */
  async stopWorker(workerId) {
    const worker = this.workers.get(workerId);
    if (!worker || !worker.process) {
      return;
    }

    try {
      logger.info(`Stopping worker: ${worker.name}`);
      
      if (worker.process && typeof worker.process.stop === 'function') {
        await worker.process.stop();
      }
      
      worker.status = 'stopped';
      worker.process = null;
      
      logger.info(`✅ Worker stopped: ${worker.name}`);
      
    } catch (error) {
      logger.error(`❌ Failed to stop worker: ${worker.name}`, { error: error.message });
    }
  }

  /**
   * Restart a specific worker
   */
  async restartWorker(workerId, reason = 'manual restart') {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    try {
      logger.info(`Restarting worker: ${worker.name}`, { reason });
      
      await this.stopWorker(workerId);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      await this.startWorker(workerId);
      
      this.stats.totalRestarts++;
      
      logger.info(`✅ Worker restarted: ${worker.name}`);
      
      await slackService.sendMessage(
        `🔄 Worker Restarted\n` +
        `Name: ${worker.name}\n` +
        `Reason: ${reason}\n` +
        `Time: ${new Date().toISOString()}`
      );
      
      return true;
      
    } catch (error) {
      logger.error(`❌ Failed to restart worker: ${worker.name}`, { error: error.message });
      return false;
    }
  }

  /**
   * Start health monitoring for all workers
   */
  startHealthMonitoring() {
    logger.info('Starting health monitoring...');
    
    // Check health every minute
    setInterval(async () => {
      await this.performHealthCheck();
    }, 60000);
  }

  /**
   * Perform health check on all workers
   */
  async performHealthCheck() {
    if (this.isShuttingDown) {
      return;
    }

    try {
      this.stats.lastHealthCheck = new Date();
      const unhealthyWorkers = [];
      
      for (const [workerId, worker] of this.workers.entries()) {
        const health = this.healthChecks.get(workerId);
        const config = worker.config;
        
        // Check if worker is responsive
        const timeSinceLastRun = Date.now() - (worker.stats.lastRun?.getTime() || 0);
        const maxIdleTime = config.healthCheckInterval * 2;
        
        if (timeSinceLastRun > maxIdleTime && worker.status === 'running') {
          health.isHealthy = false;
          health.consecutiveFailures++;
          
          logger.warn(`⚠️ Worker unhealthy: ${worker.name}`, {
            timeSinceLastRun,
            maxIdleTime,
            consecutiveFailures: health.consecutiveFailures
          });
          
          unhealthyWorkers.push(workerId);
          
          // Auto-restart if too many consecutive failures
          if (health.consecutiveFailures >= config.maxConsecutiveFailures) {
            await this.restartWorker(workerId, 'health check failure');
            health.consecutiveFailures = 0;
          }
        } else {
          health.isHealthy = true;
          health.consecutiveFailures = 0;
        }
        
        health.lastHeartbeat = new Date();
      }
      
      // Alert if multiple workers are unhealthy
      if (unhealthyWorkers.length > 1) {
        await slackService.sendMessage(
          `⚠️ Multiple Workers Unhealthy\n` +
          `Workers: ${unhealthyWorkers.map(id => this.workers.get(id).name).join(', ')}\n` +
          `Time: ${new Date().toISOString()}`
        );
      }
      
    } catch (error) {
      logger.error('❌ Health check failed', { error: error.message });
    }
  }

  /**
   * Handle worker errors
   */
  async handleWorkerError(workerId, error) {
    this.stats.totalErrors++;
    
    const worker = this.workers.get(workerId);
    const config = worker.config;
    
    logger.error(`Worker error: ${worker.name}`, {
      error: error.message,
      consecutiveFailures: worker.stats.consecutiveFailures
    });
    
    // Auto-restart if not too many consecutive failures
    if (worker.stats.consecutiveFailures < config.maxConsecutiveFailures) {
      logger.info(`Attempting auto-restart for: ${worker.name}`);
      setTimeout(() => {
        this.restartWorker(workerId, 'error recovery');
      }, 5000);
    } else {
      // Too many failures, alert and disable
      await slackService.sendMessage(
        `🔴 Worker Failed - Manual Intervention Required\n` +
        `Name: ${worker.name}\n` +
        `Consecutive Failures: ${worker.stats.consecutiveFailures}\n` +
        `Error: ${error.message}\n` +
        `Time: ${new Date().toISOString()}`
      );
    }
  }

  /**
   * Record successful worker run
   */
  recordSuccess(workerId, duration) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    worker.stats.successes++;
    worker.stats.consecutiveFailures = 0;
    worker.stats.lastSuccess = new Date();
    worker.stats.lastRun = new Date();
    
    // Update average duration
    const totalRuns = worker.stats.runs;
    worker.stats.avgDuration = 
      (worker.stats.avgDuration * totalRuns + duration) / (totalRuns + 1);
    
    worker.stats.runs++;
    
    const health = this.healthChecks.get(workerId);
    if (health) {
      health.isHealthy = true;
      health.consecutiveFailures = 0;
      health.lastHeartbeat = new Date();
    }
  }

  /**
   * Record failed worker run
   */
  recordFailure(workerId, error) {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    worker.stats.failures++;
    worker.stats.consecutiveFailures++;
    worker.stats.lastFailure = new Date();
    worker.stats.lastRun = new Date();
    worker.stats.runs++;
    
    this.handleWorkerError(workerId, error);
  }

  /**
   * Get worker statistics
   */
  getStats() {
    const workerStats = {};
    
    for (const [workerId, worker] of this.workers.entries()) {
      const health = this.healthChecks.get(workerId);
      
      workerStats[workerId] = {
        name: worker.name,
        status: worker.status,
        isHealthy: health?.isHealthy || false,
        stats: worker.stats,
        uptime: worker.stats.lastRun 
          ? Date.now() - worker.stats.lastRun.getTime()
          : null
      };
    }
    
    return {
      coordinator: this.stats,
      workers: workerStats
    };
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) {
        return;
      }
      
      this.isShuttingDown = true;
      
      logger.info(`🛑 Received ${signal}, gracefully shutting down workers...`);
      
      // Stop all workers
      for (const workerId of this.workers.keys()) {
        await this.stopWorker(workerId);
      }
      
      await slackService.sendMessage(
        `🛑 Worker Coordinator Stopped\n` +
        `Signal: ${signal}\n` +
        `Time: ${new Date().toISOString()}`
      );
      
      logger.info('✅ All workers stopped gracefully');
      process.exit(0);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Export singleton instance
const coordinator = new WorkerCoordinator();
module.exports = coordinator;
