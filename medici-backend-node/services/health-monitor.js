/**
 * Health Monitor Service - Deep health checks and metrics
 */

const { getPool } = require('../config/database');
const logger = require('../config/logger');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class HealthMonitor {
  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0
    };
  }

  /**
   * Basic health check
   */
  async getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  /**
   * Deep health check - checks all dependencies
   */
  async getDeepHealth() {
    const checks = {};
    let overallStatus = 'healthy';

    // Database check
    checks.database = await this.checkDatabase();
    if (checks.database.status !== 'healthy') overallStatus = 'degraded';

    // File system check
    checks.filesystem = await this.checkFileSystem();
    if (checks.filesystem.status !== 'healthy') overallStatus = 'degraded';

    // Memory check
    checks.memory = this.checkMemory();
    if (checks.memory.status !== 'healthy') overallStatus = 'degraded';

    // External services (optional - don't fail if down)
    checks.external = await this.checkExternalServices();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks
    };
  }

  /**
   * Check database connection
   */
  async checkDatabase() {
    const startTime = Date.now();
    try {
      const pool = await getPool();
      const result = await pool.request().query('SELECT 1 AS test');
      const duration = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime: duration,
        message: 'Database connected'
      };
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: error.message
      };
    }
  }

  /**
   * Check file system (logs directory)
   */
  async checkFileSystem() {
    try {
      const logsDir = path.join(__dirname, '../logs');
      await fs.access(logsDir);
      const stats = await fs.stat(logsDir);

      return {
        status: 'healthy',
        message: 'Logs directory accessible',
        writable: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: 'Cannot access logs directory',
        error: error.message
      };
    }
  }

  /**
   * Check memory usage
   */
  checkMemory() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercentage = (usedMem / totalMem) * 100;

    const status = memPercentage > 90 ? 'unhealthy' : 
                   memPercentage > 75 ? 'degraded' : 'healthy';

    return {
      status,
      heap: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        limit: Math.round(memUsage.rss / 1024 / 1024)
      },
      system: {
        total: Math.round(totalMem / 1024 / 1024),
        free: Math.round(freeMem / 1024 / 1024),
        usedPercentage: Math.round(memPercentage)
      }
    };
  }

  /**
   * Check external services (non-blocking)
   */
  async checkExternalServices() {
    const services = {};

    // We don't fail health check if external services are down
    // These are checked but marked as "optional"

    services.innstant = await this.checkInnstant();
    services.zenith = await this.checkZenith();

    return services;
  }

  /**
   * Probe Innstant API reachability
   */
  async checkInnstant() {
    const url = process.env.INNSTANT_SEARCH_URL;
    if (!url) {
      return { status: 'unconfigured', message: 'INNSTANT_SEARCH_URL not set' };
    }
    const startTime = Date.now();
    try {
      await axios.get(url, { timeout: 5000 });
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Innstant API reachable'
      };
    } catch (error) {
      // A non-2xx response still means the service is reachable
      if (error.response) {
        return {
          status: 'healthy',
          responseTime: Date.now() - startTime,
          message: `Innstant API reachable (HTTP ${error.response.status})`
        };
      }
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: error.message
      };
    }
  }

  /**
   * Probe Zenith API reachability
   */
  async checkZenith() {
    const url = process.env.ZENITH_SERVICE_URL;
    if (!url) {
      return { status: 'unconfigured', message: 'ZENITH_SERVICE_URL not set' };
    }
    const startTime = Date.now();
    try {
      await axios.get(url, { timeout: 5000 });
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Zenith API reachable'
      };
    } catch (error) {
      if (error.response) {
        return {
          status: 'healthy',
          responseTime: Date.now() - startTime,
          message: `Zenith API reachable (HTTP ${error.response.status})`
        };
      }
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: error.message
      };
    }
  }

  /**
   * Get system metrics
   */
  getMetrics() {
    const avgResponseTime = this.metrics.requestCount > 0 
      ? Math.round(this.metrics.totalResponseTime / this.metrics.requestCount)
      : 0;

    const errorRate = this.metrics.requestCount > 0
      ? ((this.metrics.errorCount / this.metrics.requestCount) * 100).toFixed(2)
      : 0;

    return {
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      requests: {
        total: this.metrics.requestCount,
        errors: this.metrics.errorCount,
        errorRate: `${errorRate}%`
      },
      performance: {
        avgResponseTime: `${avgResponseTime}ms`
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        cpus: os.cpus().length,
        loadAverage: os.loadavg()
      }
    };
  }

  /**
   * Track request
   */
  trackRequest(responseTime, isError = false) {
    this.metrics.requestCount++;
    this.metrics.totalResponseTime += responseTime;
    if (isError) {
      this.metrics.errorCount++;
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0
    };
    logger.info('Metrics reset');
  }
}

module.exports = new HealthMonitor();
