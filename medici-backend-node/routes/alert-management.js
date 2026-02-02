/**
 * Alert Management API Routes
 * Real-time alert management with smart rules
 */

const express = require('express');
const router = express.Router();
const alertManager = require('../services/alert-manager');
const logger = require('../config/logger');

/**
 * GET /alert-management/active
 * Get all active alerts
 */
router.get('/active', async (req, res) => {
  try {
    const alerts = alertManager.getActiveAlerts();
    
    res.json({
      success: true,
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      alerts
    });
  } catch (error) {
    logger.error('Failed to get active alerts', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active alerts'
    });
  }
});

/**
 * GET /alert-management/history
 * Get alert history
 */
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const history = alertManager.getAlertHistory(limit);
    
    res.json({
      success: true,
      total: history.length,
      limit,
      alerts: history
    });
  } catch (error) {
    logger.error('Failed to get alert history', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alert history'
    });
  }
});

/**
 * GET /alert-management/statistics
 * Get alert statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const stats = alertManager.getStatistics();
    
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    logger.error('Failed to get alert statistics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

/**
 * POST /alert-management/acknowledge/:alertId
 * Acknowledge an alert
 */
router.post('/acknowledge/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    const alert = alertManager.acknowledgeAlert(alertId);
    
    if (alert) {
      res.json({
        success: true,
        message: 'Alert acknowledged',
        alert
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }
  } catch (error) {
    logger.error('Failed to acknowledge alert', { 
      alertId: req.params.alertId,
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert'
    });
  }
});

/**
 * POST /alert-management/resolve/:type
 * Manually resolve an alert
 */
router.post('/resolve/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const alert = alertManager.resolveAlert(type);
    
    if (alert) {
      res.json({
        success: true,
        message: 'Alert resolved',
        alert
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Alert not found or already resolved'
      });
    }
  } catch (error) {
    logger.error('Failed to resolve alert', { 
      type: req.params.type,
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

/**
 * GET /alert-management/config
 * Get alert configuration
 */
router.get('/config', async (req, res) => {
  try {
    const config = alertManager.getConfig();
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    logger.error('Failed to get config', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve configuration'
    });
  }
});

/**
 * PUT /alert-management/config
 * Update alert configuration
 */
router.put('/config', async (req, res) => {
  try {
    const newConfig = req.body;
    
    // Validate config
    const validKeys = [
      'error_rate_threshold',
      'slow_api_threshold',
      'cancellation_spike_threshold',
      'revenue_drop_threshold',
      'db_error_threshold',
      'cpu_threshold',
      'memory_threshold'
    ];

    const invalidKeys = Object.keys(newConfig).filter(k => !validKeys.includes(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid config keys: ${invalidKeys.join(', ')}`
      });
    }

    alertManager.updateConfig(newConfig);
    
    res.json({
      success: true,
      message: 'Configuration updated',
      config: alertManager.getConfig()
    });
  } catch (error) {
    logger.error('Failed to update config', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

/**
 * POST /alert-management/test/:type
 * Create a test alert
 */
router.post('/test/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    const testAlerts = {
      error_rate: {
        type: 'error_rate',
        severity: 'warning',
        title: 'בדיקה: שיעור שגיאות גבוה',
        message: 'זוהי התראת בדיקה לשיעור שגיאות גבוה',
        category: 'system',
        metadata: { test: true }
      },
      slow_api: {
        type: 'slow_api',
        severity: 'warning',
        title: 'בדיקה: API איטי',
        message: 'זוהי התראת בדיקה ל-API איטי',
        category: 'api',
        metadata: { test: true }
      },
      cancellation_spike: {
        type: 'cancellation_spike',
        severity: 'critical',
        title: 'בדיקה: עלייה בכשלי ביטולים',
        message: 'זוהי התראת בדיקה לכשלי ביטולים',
        category: 'cancellations',
        metadata: { test: true }
      }
    };

    const alertData = testAlerts[type];
    if (!alertData) {
      return res.status(400).json({
        success: false,
        error: `Invalid test type. Valid types: ${Object.keys(testAlerts).join(', ')}`
      });
    }

    const alert = alertManager.createAlert(alertData);
    
    res.json({
      success: true,
      message: 'Test alert created',
      alert
    });
  } catch (error) {
    logger.error('Failed to create test alert', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to create test alert'
    });
  }
});

/**
 * GET /alert-management/summary
 * Get quick summary of alerts
 */
router.get('/summary', async (req, res) => {
  try {
    const activeAlerts = alertManager.getActiveAlerts();
    const stats = alertManager.getStatistics();
    
    res.json({
      success: true,
      summary: {
        active: {
          total: activeAlerts.length,
          critical: activeAlerts.filter(a => a.severity === 'critical').length,
          warning: activeAlerts.filter(a => a.severity === 'warning').length,
          unacknowledged: activeAlerts.filter(a => !a.acknowledged).length
        },
        last_24h: {
          total: stats.total_24h,
          critical: stats.critical_24h,
          warning: stats.warning_24h
        },
        top_categories: stats.by_category,
        most_frequent: stats.most_frequent
      }
    });
  } catch (error) {
    logger.error('Failed to get alert summary', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve summary'
    });
  }
});

module.exports = router;
