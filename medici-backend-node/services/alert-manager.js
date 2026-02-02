/**
 * Alert Manager Service
 * Manages system alerts, notifications, and alert lifecycle
 */

const { getPool } = require('../config/database');
const logger = require('../config/logger');
const slackService = require('./slack-service');
const emailService = require('./email-service');
const EventEmitter = require('events');

class AlertManager extends EventEmitter {
  constructor() {
    super();
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.maxHistorySize = 1000;
    
    // Alert configuration
    this.config = {
      error_rate_threshold: 5, // %
      slow_api_threshold: 2000, // ms
      cancellation_spike_threshold: 10, // failures per hour
      revenue_drop_threshold: 30, // % drop
      db_error_threshold: 3, // consecutive errors
      cpu_threshold: 80, // %
      memory_threshold: 85 // %
    };

    // Start monitoring
    this.startMonitoring();
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring() {
    // Check every 60 seconds
    setInterval(() => {
      this.checkSystemHealth().catch(err => {
        logger.error('Alert check failed', { error: err.message });
      });
    }, 60000);

    // Initial check
    this.checkSystemHealth();
  }

  /**
   * Check system health and generate alerts
   */
  async checkSystemHealth() {
    try {
      await Promise.all([
        this.checkErrorRate(),
        this.checkAPIPerformance(),
        this.checkCancellations(),
        this.checkRevenue(),
        this.checkDatabase()
      ]);
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
    }
  }

  /**
   * Check error rate
   */
  async checkErrorRate() {
    try {
      const pool = await getPool();
      
      const result = await pool.request().query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN Message LIKE '%error%' OR Message LIKE '%Error%' THEN 1 ELSE 0 END) as errors
        FROM MED_Log
        WHERE Date >= DATEADD(HOUR, -1, GETDATE())
      `);

      const { total, errors } = result.recordset[0];
      const errorRate = total > 0 ? (errors / total * 100) : 0;

      if (errorRate > this.config.error_rate_threshold) {
        this.createAlert({
          type: 'error_rate',
          severity: errorRate > 10 ? 'critical' : 'warning',
          title: 'שיעור שגיאות גבוה',
          message: `שיעור שגיאות: ${errorRate.toFixed(2)}% (${errors}/${total} בשעה האחרונה)`,
          category: 'system',
          metadata: { errorRate, errors, total }
        });
      } else {
        this.resolveAlert('error_rate');
      }
    } catch (error) {
      logger.error('Error rate check failed', { error: error.message });
    }
  }

  /**
   * Check API performance
   */
  async checkAPIPerformance() {
    try {
      const pool = await getPool();
      
      const result = await pool.request().query(`
        SELECT TOP 100 Message
        FROM MED_Log
        WHERE Date >= DATEADD(MINUTE, -5, GETDATE())
        AND Message LIKE '%HTTP Request%'
      `);

      let totalTime = 0;
      let count = 0;
      let slowCount = 0;

      result.recordset.forEach(row => {
        try {
          const match = row.Message.match(/\{.*\}/);
          if (match) {
            const log = JSON.parse(match[0]);
            const responseTime = parseInt(log.responseTime?.replace('ms', '') || 0);
            
            if (responseTime > 0) {
              totalTime += responseTime;
              count++;
              
              if (responseTime > this.config.slow_api_threshold) {
                slowCount++;
              }
            }
          }
        } catch (e) {
          // Skip unparseable logs
        }
      });

      if (count > 0) {
        const avgResponseTime = totalTime / count;
        
        if (avgResponseTime > this.config.slow_api_threshold) {
          this.createAlert({
            type: 'slow_api',
            severity: avgResponseTime > 3000 ? 'critical' : 'warning',
            title: 'API איטי',
            message: `זמן תגובה ממוצע: ${Math.round(avgResponseTime)}ms (${slowCount} בקשות איטיות ב-5 דקות האחרונות)`,
            category: 'api',
            metadata: { avgResponseTime, slowCount, count }
          });
        } else {
          this.resolveAlert('slow_api');
        }
      }
    } catch (error) {
      logger.error('API performance check failed', { error: error.message });
    }
  }

  /**
   * Check cancellation failures
   */
  async checkCancellations() {
    try {
      const pool = await getPool();
      
      const result = await pool.request().query(`
        SELECT COUNT(*) as failures
        FROM MED_CancelBookError
        WHERE DateInsert >= DATEADD(HOUR, -1, GETDATE())
      `);

      const failures = result.recordset[0].failures;

      if (failures > this.config.cancellation_spike_threshold) {
        this.createAlert({
          type: 'cancellation_spike',
          severity: failures > 20 ? 'critical' : 'warning',
          title: 'עלייה בכשלי ביטולים',
          message: `${failures} כשלי ביטול בשעה האחרונה`,
          category: 'cancellations',
          metadata: { failures }
        });
      } else {
        this.resolveAlert('cancellation_spike');
      }
    } catch (error) {
      logger.error('Cancellation check failed', { error: error.message });
    }
  }

  /**
   * Check revenue drops
   */
  async checkRevenue() {
    try {
      const pool = await getPool();
      
      const result = await pool.request().query(`
        WITH CurrentHour AS (
          SELECT ISNULL(SUM(PushPrice), 0) as revenue
          FROM [MED_ֹOֹֹpportunities]
          WHERE IsSale = 1 
          AND DateCreate >= DATEADD(HOUR, -1, GETDATE())
        ),
        PreviousHour AS (
          SELECT ISNULL(SUM(PushPrice), 0) as revenue
          FROM [MED_ֹOֹֹpportunities]
          WHERE IsSale = 1 
          AND DateCreate >= DATEADD(HOUR, -2, GETDATE())
          AND DateCreate < DATEADD(HOUR, -1, GETDATE())
        )
        SELECT 
          c.revenue as current_revenue,
          p.revenue as previous_revenue,
          CASE 
            WHEN p.revenue > 0 
            THEN ((c.revenue - p.revenue) / p.revenue * 100)
            ELSE 0 
          END as change_percent
        FROM CurrentHour c, PreviousHour p
      `);

      const { current_revenue, previous_revenue, change_percent } = result.recordset[0];

      // Only alert if previous hour had significant revenue
      if (previous_revenue > 1000 && change_percent < -this.config.revenue_drop_threshold) {
        this.createAlert({
          type: 'revenue_drop',
          severity: change_percent < -50 ? 'critical' : 'warning',
          title: 'ירידה בהכנסות',
          message: `ירידה של ${Math.abs(change_percent).toFixed(1)}% בהכנסות (₪${current_revenue.toLocaleString()} לעומת ₪${previous_revenue.toLocaleString()})`,
          category: 'revenue',
          metadata: { current_revenue, previous_revenue, change_percent }
        });
      } else {
        this.resolveAlert('revenue_drop');
      }
    } catch (error) {
      logger.error('Revenue check failed', { error: error.message });
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    try {
      const pool = await getPool();
      const startTime = Date.now();
      
      await pool.request().query('SELECT 1');
      
      const responseTime = Date.now() - startTime;

      if (responseTime > 1000) {
        this.createAlert({
          type: 'db_slow',
          severity: responseTime > 2000 ? 'critical' : 'warning',
          title: 'מסד נתונים איטי',
          message: `זמן תגובה של DB: ${responseTime}ms`,
          category: 'database',
          metadata: { responseTime }
        });
      } else {
        this.resolveAlert('db_slow');
      }
    } catch (error) {
      logger.error('Database check failed', { error: error.message });
      
      this.createAlert({
        type: 'db_error',
        severity: 'critical',
        title: 'שגיאת חיבור למסד נתונים',
        message: `לא ניתן להתחבר למסד הנתונים: ${error.message}`,
        category: 'database',
        metadata: { error: error.message }
      });
    }
  }

  /**
   * Create or update an alert
   */
  createAlert(alertData) {
    const { type, severity, title, message, category, metadata } = alertData;
    
    const existingAlert = this.activeAlerts.get(type);
    
    // If alert already exists and severity hasn't changed, don't re-notify
    if (existingAlert && existingAlert.severity === severity) {
      existingAlert.count++;
      existingAlert.lastSeen = new Date();
      return existingAlert;
    }

    const alert = {
      id: `${type}_${Date.now()}`,
      type,
      severity,
      title,
      message,
      category,
      metadata,
      count: existingAlert ? existingAlert.count + 1 : 1,
      createdAt: existingAlert ? existingAlert.createdAt : new Date(),
      lastSeen: new Date(),
      status: 'active',
      acknowledged: false
    };

    this.activeAlerts.set(type, alert);
    this.addToHistory(alert);

    // Emit event
    this.emit('alert', alert);

    // Send notifications
    this.sendNotifications(alert);

    logger.warn('Alert created', { alert });

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(type) {
    const alert = this.activeAlerts.get(type);
    
    if (alert && alert.status === 'active') {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      
      this.activeAlerts.delete(type);
      this.addToHistory(alert);

      logger.info('Alert resolved', { type, alert });

      // Emit event
      this.emit('alert_resolved', alert);

      return alert;
    }

    return null;
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId) {
    for (const [type, alert] of this.activeAlerts.entries()) {
      if (alert.id === alertId) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();
        
        logger.info('Alert acknowledged', { alertId, type });
        
        return alert;
      }
    }
    
    return null;
  }

  /**
   * Send notifications for alert
   */
  async sendNotifications(alert) {
    try {
      // Always send to Slack for critical alerts
      if (alert.severity === 'critical') {
        await slackService.sendAlert({
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          category: alert.category,
          metadata: alert.metadata
        });
      }

      // Send email for critical database/revenue alerts
      if (alert.severity === 'critical' && 
          (alert.category === 'database' || alert.category === 'revenue')) {
        try {
          await emailService.sendAlertEmail({
            to: process.env.ALERT_EMAIL || 'admin@medicihotels.com',
            subject: `🚨 ${alert.title}`,
            body: alert.message,
            alert
          });
        } catch (emailError) {
          logger.error('Failed to send alert email', { error: emailError.message });
        }
      }
    } catch (error) {
      logger.error('Failed to send notifications', { error: error.message });
    }
  }

  /**
   * Add alert to history
   */
  addToHistory(alert) {
    this.alertHistory.unshift({ ...alert });
    
    // Keep only last N alerts
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values())
      .sort((a, b) => {
        // Critical first
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        // Then by last seen
        return b.lastSeen - a.lastSeen;
      });
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 100) {
    return this.alertHistory.slice(0, limit);
  }

  /**
   * Get alert statistics
   */
  getStatistics() {
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    
    const recentAlerts = this.alertHistory.filter(a => 
      new Date(a.createdAt) > last24h
    );

    const stats = {
      active_alerts: this.activeAlerts.size,
      total_24h: recentAlerts.length,
      critical_24h: recentAlerts.filter(a => a.severity === 'critical').length,
      warning_24h: recentAlerts.filter(a => a.severity === 'warning').length,
      by_category: {},
      most_frequent: []
    };

    // Count by category
    recentAlerts.forEach(alert => {
      stats.by_category[alert.category] = (stats.by_category[alert.category] || 0) + 1;
    });

    // Find most frequent alert types
    const typeCounts = {};
    recentAlerts.forEach(alert => {
      typeCounts[alert.type] = (typeCounts[alert.type] || 0) + 1;
    });

    stats.most_frequent = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    return stats;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Alert config updated', { config: this.config });
  }

  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

// Singleton instance
const alertManager = new AlertManager();

module.exports = alertManager;
