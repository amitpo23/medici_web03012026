/**
 * Alerts Agent - Intelligent Monitoring System
 * Scans logs for anomalies, schema violations, and issues
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');
const { getPool } = require('../config/database');
const emailService = require('./email-service');
const slackService = require('./slack-service');
const socketService = require('./socket-service');

class AlertsAgent {
  constructor() {
    this.alertRules = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'More than 10 errors in 5 minutes',
        severity: 'critical',
        condition: (logs) => this.checkErrorRate(logs, 10, 5),
        action: 'email,slack'
      },
      {
        id: 'db_connection_failure',
        name: 'Database Connection Failure',
        description: 'Failed to connect to database',
        severity: 'critical',
        condition: (logs) => this.checkPattern(logs, /database.*connection.*fail/i),
        action: 'email,slack'
      },
      {
        id: 'missing_booking_data',
        name: 'Missing Booking Data',
        description: 'Booking without hotel name or price',
        severity: 'high',
        condition: (logs) => this.checkMissingBookingData(logs),
        action: 'email'
      },
      {
        id: 'schema_violation',
        name: 'Schema Violation',
        description: 'Invalid data structure detected',
        severity: 'high',
        condition: (logs) => this.checkSchemaViolation(logs),
        action: 'email,slack'
      },
      {
        id: 'scraper_failure',
        name: 'Scraper Failure',
        description: 'Competitor scraper failed multiple times',
        severity: 'medium',
        condition: (logs) => this.checkScraperFailures(logs, 3),
        action: 'email'
      },
      {
        id: 'slow_response',
        name: 'Slow API Response',
        description: 'Response time over 5 seconds',
        severity: 'medium',
        condition: (logs) => this.checkSlowRequests(logs, 5000),
        action: 'email'
      },
      {
        id: 'zenith_push_failure',
        name: 'Zenith Push Failure',
        description: 'Failed to push to Zenith',
        severity: 'high',
        condition: (logs) => this.checkPattern(logs, /zenith.*push.*fail/i),
        action: 'email,slack'
      },
      {
        id: 'unauthorized_access',
        name: 'Unauthorized Access Attempt',
        description: '401/403 errors detected',
        severity: 'high',
        condition: (logs) => this.checkUnauthorizedAccess(logs),
        action: 'email,slack'
      }
    ];
    
    this.alertHistory = [];
    this.isRunning = false;
  }

  /**
   * Start alerts agent
   */
  start(intervalMinutes = 5) {
    if (this.isRunning) {
      logger.warn('Alerts agent already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚨 Alerts Agent Started', { interval: `${intervalMinutes} minutes` });

    // Run immediately
    this.scan();

    // Schedule periodic scans
    this.intervalId = setInterval(() => {
      this.scan();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop alerts agent
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.isRunning = false;
      logger.info('🚨 Alerts Agent Stopped');
    }
  }

  /**
   * Scan logs for alerts
   */
  async scan() {
    try {
      logger.info('🔍 Alerts Agent: Starting scan');
      
      const logsDir = path.join(__dirname, '../logs');
      const files = await fs.readdir(logsDir);
      const logFiles = files.filter(f => f.endsWith('.log') && !f.includes('audit'));
      
      // Read recent logs (last 10 minutes)
      const recentLogs = [];
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      
      for (const file of logFiles) {
        const content = await fs.readFile(path.join(logsDir, file), 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          try {
            const logEntry = JSON.parse(line);
            const logTime = new Date(logEntry.timestamp);
            
            if (logTime >= tenMinutesAgo) {
              recentLogs.push(logEntry);
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
      
      logger.info('📊 Alerts Agent: Processing logs', { count: recentLogs.length });
      
      // Check all alert rules
      const triggeredAlerts = [];
      
      for (const rule of this.alertRules) {
        try {
          if (rule.condition(recentLogs)) {
            // Check if alert was already triggered recently (avoid spam)
            const recentAlert = this.alertHistory.find(
              a => a.ruleId === rule.id && 
              (now - new Date(a.timestamp)) < 30 * 60 * 1000 // 30 minutes
            );
            
            if (!recentAlert) {
              triggeredAlerts.push(rule);
              
              // Record alert
              const alert = {
                id: `alert-${Date.now()}-${rule.id}`,
                ruleId: rule.id,
                ruleName: rule.name,
                description: rule.description,
                severity: rule.severity,
                timestamp: new Date(),
                logsCount: recentLogs.length
              };
              
              this.alertHistory.push(alert);
              
              // Execute actions
              await this.executeAlertActions(rule, alert, recentLogs);
            }
          }
        } catch (error) {
          logger.error('Alert rule check failed', { 
            ruleId: rule.id, 
            error: error.message 
          });
        }
      }
      
      logger.info('✅ Alerts Agent: Scan complete', { 
        triggeredAlerts: triggeredAlerts.length 
      });
      
    } catch (error) {
      logger.error('Alerts Agent scan failed', { error: error.message });
    }
  }

  /**
   * Execute alert actions
   */
  async executeAlertActions(rule, alert, logs) {
    logger.warn('🚨 ALERT TRIGGERED', {
      alert: rule.name,
      severity: rule.severity
    });

    const actions = rule.action.split(',');

    // Send real-time Socket.IO notification
    socketService.emit('alert-triggered', {
      alertId: alert.id,
      rule: rule.name,
      severity: rule.severity,
      message: rule.description,
      ruleId: rule.id
    });

    // Send email
    if (actions.includes('email')) {
      await this.sendEmailAlert(rule, alert, logs);
    }

    // Send Slack notification
    if (actions.includes('slack')) {
      await this.sendSlackAlert(rule, alert, logs);
    }

    // Save to database
    await this.saveAlertToDatabase(alert);
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(rule, alert, logs) {
    try {
      const recentErrors = logs.filter(l => l.level === 'error').slice(-5);
      
      const emailBody = `
        <h2>🚨 Alert: ${rule.name}</h2>
        <p><strong>Severity:</strong> ${rule.severity.toUpperCase()}</p>
        <p><strong>Description:</strong> ${rule.description}</p>
        <p><strong>Time:</strong> ${alert.timestamp.toLocaleString()}</p>
        <p><strong>Logs analyzed:</strong> ${logs.length}</p>
        
        <h3>Recent Errors:</h3>
        <ul>
          ${recentErrors.map(e => `<li>${e.message} - ${e.timestamp}</li>`).join('')}
        </ul>
        
        <p>Check logs at: <a href="http://localhost:8080/logs">http://localhost:8080/logs</a></p>
      `;
      
      await emailService.send({
        to: process.env.ALERT_EMAIL || 'admin@medicihotels.com',
        subject: `🚨 ${rule.severity.toUpperCase()}: ${rule.name}`,
        html: emailBody
      });
      
      logger.info('Email alert sent', { ruleId: rule.id });
    } catch (error) {
      logger.error('Failed to send email alert', { error: error.message });
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(rule, alert, logs) {
    try {
      const emoji = rule.severity === 'critical' ? '🔴' : 
                    rule.severity === 'high' ? '🟠' : '🟡';
      
      const message = `${emoji} *${rule.name}*\n` +
                     `Severity: ${rule.severity.toUpperCase()}\n` +
                     `${rule.description}\n` +
                     `Time: ${alert.timestamp.toLocaleString()}\n` +
                     `Logs: ${logs.length}`;
      
      await slackService.sendAlert(message);
      
      logger.info('Slack alert sent', { ruleId: rule.id });
    } catch (error) {
      logger.error('Failed to send Slack alert', { error: error.message });
    }
  }

  /**
   * Save alert (in-memory, SystemAlerts table not available)
   */
  async saveAlertToDatabase(alert) {
    // Store in memory history (SystemAlerts table does not exist)
    logger.info('Alert saved to history', { alertId: alert.id });
  }

  // ============ Alert Condition Checkers ============

  /**
   * Check error rate
   */
  checkErrorRate(logs, threshold, minutes) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - minutes * 60 * 1000);
    
    const recentErrors = logs.filter(log => {
      const logTime = new Date(log.timestamp);
      return log.level === 'error' && logTime >= cutoff;
    });
    
    return recentErrors.length > threshold;
  }

  /**
   * Check for pattern in logs
   */
  checkPattern(logs, pattern) {
    return logs.some(log => {
      const logStr = JSON.stringify(log).toLowerCase();
      return pattern.test(logStr);
    });
  }

  /**
   * Check for missing booking data
   */
  checkMissingBookingData(logs) {
    return logs.some(log => {
      if (log.message && log.message.includes('booking')) {
        const logStr = JSON.stringify(log);
        return logStr.includes('null') || 
               logStr.includes('undefined') ||
               logStr.includes('missing');
      }
      return false;
    });
  }

  /**
   * Check for schema violations
   */
  checkSchemaViolation(logs) {
    const violations = [
      /invalid.*schema/i,
      /validation.*fail/i,
      /constraint.*violation/i,
      /foreign.*key/i,
      /unique.*constraint/i
    ];
    
    return logs.some(log => {
      const logStr = JSON.stringify(log);
      return violations.some(pattern => pattern.test(logStr));
    });
  }

  /**
   * Check scraper failures
   */
  checkScraperFailures(logs, threshold) {
    const scraperFailures = logs.filter(log => 
      log.message && 
      log.message.toLowerCase().includes('scraper') &&
      log.level === 'error'
    );
    
    return scraperFailures.length >= threshold;
  }

  /**
   * Check slow requests
   */
  checkSlowRequests(logs, thresholdMs) {
    return logs.some(log => {
      if (log.duration) {
        const duration = parseInt(log.duration.replace('ms', ''));
        return duration > thresholdMs;
      }
      return false;
    });
  }

  /**
   * Check unauthorized access
   */
  checkUnauthorizedAccess(logs) {
    return logs.some(log => {
      return (log.statusCode === 401 || log.statusCode === 403) &&
             log.level === 'warn';
    });
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit = 50) {
    return this.alertHistory
      .slice(-limit)
      .reverse();
  }

  /**
   * Get alert rules
   */
  getAlertRules() {
    return this.alertRules;
  }

  /**
   * Manual scan for specific date range
   */
  async scanDateRange(startDate, endDate) {
    logger.info('Manual scan requested', { startDate, endDate });
    
    const logsDir = path.join(__dirname, '../logs');
    const files = await fs.readdir(logsDir);
    const logFiles = files.filter(f => f.endsWith('.log'));
    
    const matchingLogs = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (const file of logFiles) {
      const content = await fs.readFile(path.join(logsDir, file), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);
          const logTime = new Date(logEntry.timestamp);
          
          if (logTime >= start && logTime <= end) {
            matchingLogs.push(logEntry);
          }
        } catch {}
      }
    }
    
    // Check rules against historical logs
    const alerts = [];
    for (const rule of this.alertRules) {
      if (rule.condition(matchingLogs)) {
        alerts.push({
          rule: rule.name,
          severity: rule.severity,
          description: rule.description
        });
      }
    }
    
    return {
      dateRange: { start: startDate, end: endDate },
      logsAnalyzed: matchingLogs.length,
      alertsFound: alerts.length,
      alerts
    };
  }
}

// Create singleton instance
const alertsAgent = new AlertsAgent();

module.exports = alertsAgent;
