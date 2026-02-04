/**
 * Alerts API Routes
 * View, manage, and trigger alerts
 */

const express = require('express');
const router = express.Router();
const alertsAgent = require('../services/alerts-agent');
const logger = require('../config/logger');

/**
 * GET /alerts/status - Get alerts agent status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    isRunning: alertsAgent.isRunning,
    rules: alertsAgent.getAlertRules().length,
    recentAlerts: alertsAgent.getAlertHistory(5).length
  });
});

/**
 * GET /alerts/rules - Get all alert rules
 */
router.get('/rules', (req, res) => {
  const rules = alertsAgent.getAlertRules();
  
  res.json({
    success: true,
    count: rules.length,
    rules: rules.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      severity: r.severity,
      action: r.action
    }))
  });
});

/**
 * GET /alerts/history - Get alert history (in-memory)
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const history = alertsAgent.getAlertHistory(parseInt(limit));

    res.json({
      success: true,
      count: history.length,
      alerts: history
    });

  } catch (error) {
    logger.error('Failed to get alert history', { error: error.message });
    res.status(500).json({ error: 'Failed to get alert history' });
  }
});

/**
 * POST /alerts/scan - Trigger manual scan
 */
router.post('/scan', async (req, res) => {
  try {
    logger.info('Manual alert scan triggered');
    
    // Run scan in background
    alertsAgent.scan().catch(err => {
      logger.error('Manual scan failed', { error: err.message });
    });
    
    res.json({
      success: true,
      message: 'Alert scan started'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /alerts/scan-range - Scan historical logs
 */
router.post('/scan-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'startDate and endDate required' 
      });
    }
    
    logger.info('Historical scan requested', { startDate, endDate });
    
    const result = await alertsAgent.scanDateRange(startDate, endDate);
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    logger.error('Historical scan failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /alerts/start - Start alerts agent
 */
router.post('/start', (req, res) => {
  try {
    const { intervalMinutes = 5 } = req.body;
    
    alertsAgent.start(intervalMinutes);
    
    res.json({
      success: true,
      message: 'Alerts agent started',
      interval: `${intervalMinutes} minutes`
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /alerts/stop - Stop alerts agent
 */
router.post('/stop', (req, res) => {
  try {
    alertsAgent.stop();
    
    res.json({
      success: true,
      message: 'Alerts agent stopped'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /alerts/:alertId/resolve - Resolve an alert (in-memory)
 */
router.post('/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;

    // Mark in alert history
    const history = alertsAgent.getAlertHistory();
    const alert = history.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
    }

    logger.info('Alert resolved', { alertId });

    res.json({
      success: true,
      message: 'Alert resolved'
    });

  } catch (error) {
    logger.error('Failed to resolve alert', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /alerts/stats - Get alert statistics (in-memory)
 */
router.get('/stats', async (req, res) => {
  try {
    const history = alertsAgent.getAlertHistory();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = history.filter(a => new Date(a.timestamp) >= sevenDaysAgo);

    const stats = {
      TotalAlerts: recent.length,
      ActiveAlerts: recent.filter(a => !a.resolvedAt).length,
      ResolvedAlerts: recent.filter(a => a.resolvedAt).length,
      CriticalAlerts: recent.filter(a => a.severity === 'critical').length,
      HighAlerts: recent.filter(a => a.severity === 'high').length,
      MediumAlerts: recent.filter(a => a.severity === 'medium').length
    };

    res.json({
      success: true,
      stats,
      period: 'Last 7 days'
    });

  } catch (error) {
    logger.error('Failed to get alert stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
