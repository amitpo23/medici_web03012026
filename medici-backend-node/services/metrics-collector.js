/**
 * Metrics Collector Service
 * Collects real-time system metrics for monitoring dashboard
 */

const { getPool } = require('../config/database');
const logger = require('../config/logger');
const os = require('os');

class MetricsCollector {
  constructor() {
    this.metrics = {
      bookings: {},
      api: {},
      revenue: {},
      errors: {},
      system: {}
    };
    
    // Start collecting metrics every 10 seconds
    this.startCollection();
  }

  /**
   * Start automatic metrics collection
   */
  startCollection() {
    setInterval(() => {
      this.collectAllMetrics().catch(err => {
        logger.error('Metrics collection failed', { error: err.message });
      });
    }, 10000); // Every 10 seconds

    // Initial collection
    this.collectAllMetrics();
  }

  /**
   * Collect all metrics
   */
  async collectAllMetrics() {
    await Promise.all([
      this.collectBookingMetrics(),
      this.collectAPIMetrics(),
      this.collectRevenueMetrics(),
      this.collectErrorMetrics(),
      this.collectSystemMetrics()
    ]);
  }

  /**
   * Collect booking metrics
   */
  async collectBookingMetrics() {
    try {
      const pool = await getPool();
      
      // Total bookings today
      const todayResult = await pool.request().query(`
        SELECT COUNT(*) as total
        FROM [MED_ֹOֹֹpportunities]
        WHERE IsSale = 1 
        AND CAST(DateCreate AS DATE) = CAST(GETDATE() AS DATE)
      `);

      // Last hour bookings
      const hourResult = await pool.request().query(`
        SELECT COUNT(*) as total
        FROM [MED_ֹOֹֹpportunities]
        WHERE IsSale = 1 
        AND DateCreate >= DATEADD(HOUR, -1, GETDATE())
      `);

      // Active opportunities (not sold, not expired)
      const activeResult = await pool.request().query(`
        SELECT COUNT(*) as total
        FROM [MED_ֹOֹֹpportunities]
        WHERE IsActive = 1 
        AND IsSale = 0
        AND DateForm > GETDATE()
      `);

      // Conversion rate (simplified - bookings vs opportunities)
      const conversionResult = await pool.request().query(`
        WITH TotalOpp AS (
          SELECT COUNT(*) as total
          FROM [MED_ֹOֹֹpportunities]
          WHERE DateCreate >= DATEADD(DAY, -1, GETDATE())
        ),
        BookingCount AS (
          SELECT COUNT(*) as bookings
          FROM [MED_ֹOֹֹpportunities]
          WHERE IsSale = 1 
          AND DateCreate >= DATEADD(DAY, -1, GETDATE())
        )
        SELECT 
          CASE 
            WHEN total > 0 
            THEN CAST(bookings * 100.0 / total AS DECIMAL(5,2))
            ELSE 0 
          END as conversion_rate
        FROM TotalOpp, BookingCount
      `);

      this.metrics.bookings = {
        total_today: todayResult.recordset[0].total,
        last_hour: hourResult.recordset[0].total,
        active_opportunities: activeResult.recordset[0].total,
        conversion_rate: `${conversionResult.recordset[0].conversion_rate || 0}%`,
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to collect booking metrics', { error: error.message });
    }
  }

  /**
   * Collect API metrics from logs
   */
  async collectAPIMetrics() {
    try {
      const pool = await getPool();
      
      // Get recent API stats from MED_Log if available
      const result = await pool.request().query(`
        SELECT TOP 1000 Message
        FROM MED_Log
        WHERE Date >= DATEADD(HOUR, -1, GETDATE())
        AND Message LIKE '%HTTP Request%'
        ORDER BY Date DESC
      `);

      let totalRequests = 0;
      let errorCount = 0;
      let totalResponseTime = 0;
      let slowRequests = [];
      const statusCodes = {};

      result.recordset.forEach(row => {
        try {
          // Try to parse as JSON
          const match = row.Message.match(/\{.*\}/);
          if (match) {
            const log = JSON.parse(match[0]);
            totalRequests++;
            
            if (log.status >= 400) errorCount++;
            
            const responseTime = parseInt(log.responseTime?.replace('ms', '') || 0);
            totalResponseTime += responseTime;
            
            if (responseTime > 2000) {
              slowRequests.push({
                url: log.url,
                responseTime: log.responseTime,
                status: log.status
              });
            }

            statusCodes[log.status] = (statusCodes[log.status] || 0) + 1;
          }
        } catch (e) {
          // Skip unparseable logs
        }
      });

      this.metrics.api = {
        total_requests: totalRequests,
        error_count: errorCount,
        error_rate: totalRequests > 0 ? 
          `${((errorCount / totalRequests) * 100).toFixed(2)}%` : '0%',
        avg_response_time: totalRequests > 0 ? 
          `${Math.round(totalResponseTime / totalRequests)}ms` : '0ms',
        slow_requests: slowRequests.slice(0, 5),
        status_codes: statusCodes,
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to collect API metrics', { error: error.message });
      // Fallback to default values
      this.metrics.api = {
        total_requests: 0,
        error_count: 0,
        error_rate: '0%',
        avg_response_time: '0ms',
        slow_requests: [],
        status_codes: {},
        last_updated: new Date().toISOString()
      };
    }
  }

  /**
   * Collect revenue metrics
   */
  async collectRevenueMetrics() {
    try {
      const pool = await getPool();
      
      // Today's revenue and profit
      const todayResult = await pool.request().query(`
        SELECT 
          ISNULL(SUM(PushPrice), 0) as revenue,
          ISNULL(SUM(Price), 0) as cost,
          ISNULL(SUM(PushPrice - Price), 0) as profit,
          COUNT(*) as bookings
        FROM [MED_ֹOֹֹpportunities]
        WHERE IsSale = 1 
        AND CAST(DateCreate AS DATE) = CAST(GETDATE() AS DATE)
      `);

      // This hour's revenue
      const hourResult = await pool.request().query(`
        SELECT 
          ISNULL(SUM(PushPrice), 0) as revenue
        FROM [MED_ֹOֹֹpportunities]
        WHERE IsSale = 1 
        AND DateCreate >= DATEADD(HOUR, -1, GETDATE())
      `);

      const today = todayResult.recordset[0];
      const avgMargin = today.revenue > 0 ? 
        ((today.profit / today.revenue) * 100).toFixed(2) : 0;

      this.metrics.revenue = {
        today: `₪${today.revenue.toLocaleString()}`,
        today_raw: today.revenue,
        this_hour: `₪${hourResult.recordset[0].revenue.toLocaleString()}`,
        profit: `₪${today.profit.toLocaleString()}`,
        profit_raw: today.profit,
        avg_margin: `${avgMargin}%`,
        bookings_count: today.bookings,
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to collect revenue metrics', { error: error.message });
    }
  }

  /**
   * Collect error metrics
   */
  async collectErrorMetrics() {
    try {
      const pool = await getPool();
      
      // Recent errors from MED_Log
      const errorsResult = await pool.request().query(`
        SELECT TOP 5
          Date,
          Message
        FROM MED_Log
        WHERE Date >= DATEADD(HOUR, -1, GETDATE())
        AND (Message LIKE '%error%' OR Message LIKE '%Error%' OR Message LIKE '%ERROR%')
        ORDER BY Date DESC
      `);

      // Cancellation failures (last hour)
      const cancellationResult = await pool.request().query(`
        SELECT COUNT(*) as total
        FROM MED_CancelBookError
        WHERE DateInsert >= DATEADD(HOUR, -1, GETDATE())
      `);

      // Top error types
      const topErrorsResult = await pool.request().query(`
        SELECT TOP 5
          SUBSTRING(Error, 1, 100) as error_type,
          COUNT(*) as count
        FROM MED_CancelBookError
        WHERE DateInsert >= DATEADD(HOUR, -1, GETDATE())
        GROUP BY SUBSTRING(Error, 1, 100)
        ORDER BY COUNT(*) DESC
      `);

      this.metrics.errors = {
        last_5_errors: errorsResult.recordset.map(e => ({
          timestamp: e.Date,
          message: e.Message
        })),
        cancellation_failures_last_hour: cancellationResult.recordset[0].total,
        top_errors: topErrorsResult.recordset,
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to collect error metrics', { error: error.message });
    }
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics() {
    try {
      const pool = await getPool();
      
      // CPU usage
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;
      
      cpus.forEach(cpu => {
        for (let type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });
      
      const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);
      
      // Memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memoryUsage = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
      
      // DB connection test
      let dbStatus = 'healthy';
      let dbResponseTime = 0;
      try {
        const start = Date.now();
        await pool.request().query('SELECT 1');
        dbResponseTime = Date.now() - start;
      } catch (err) {
        dbStatus = 'error';
      }

      this.metrics.system = {
        cpu_usage: `${cpuUsage}%`,
        memory_usage: `${memoryUsage}%`,
        free_memory: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
        total_memory: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
        uptime: `${Math.floor(os.uptime() / 3600)} hours`,
        db_status: dbStatus,
        db_response_time: `${dbResponseTime}ms`,
        node_version: process.version,
        platform: os.platform(),
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to collect system metrics', { error: error.message });
    }
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get specific metric category
   */
  getMetricCategory(category) {
    return this.metrics[category] || null;
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const api = this.metrics.api;
    const system = this.metrics.system;
    
    let status = 'healthy';
    const issues = [];

    // Check error rate
    const errorRate = parseFloat(api.error_rate?.replace('%', '') || 0);
    if (errorRate > 10) {
      status = 'critical';
      issues.push(`High error rate: ${api.error_rate}`);
    } else if (errorRate > 5) {
      status = 'warning';
      issues.push(`Elevated error rate: ${api.error_rate}`);
    }

    // Check response time
    const avgResponseTime = parseInt(api.avg_response_time?.replace('ms', '') || 0);
    if (avgResponseTime > 2000) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Slow API response: ${api.avg_response_time}`);
    }

    // Check CPU
    const cpuUsage = parseFloat(system.cpu_usage?.replace('%', '') || 0);
    if (cpuUsage > 90) {
      status = 'critical';
      issues.push(`High CPU usage: ${system.cpu_usage}`);
    } else if (cpuUsage > 70) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Elevated CPU usage: ${system.cpu_usage}`);
    }

    // Check memory
    const memUsage = parseFloat(system.memory_usage?.replace('%', '') || 0);
    if (memUsage > 90) {
      status = 'critical';
      issues.push(`High memory usage: ${system.memory_usage}`);
    } else if (memUsage > 80) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Elevated memory usage: ${system.memory_usage}`);
    }

    // Check DB
    if (system.db_status === 'error') {
      status = 'critical';
      issues.push('Database connection error');
    }

    return {
      status,
      issues,
      timestamp: new Date().toISOString()
    };
  }
}

// Singleton instance
const metricsCollector = new MetricsCollector();

module.exports = metricsCollector;
