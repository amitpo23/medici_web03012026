/**
 * Alerts API Routes
 * View, manage, and trigger alerts
 */

const express = require('express');
const router = express.Router();
const alertsAgent = require('../services/alerts-agent');
const logger = require('../config/logger');
const { getPool } = require('../config/database');

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
 * GET /alerts/history - Get alert history
 */
router.get('/history', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    // Get from database
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', parseInt(limit))
      .query(`
        SELECT TOP (@limit)
          AlertId, RuleId, RuleName, Description, Severity, 
          Timestamp, LogsCount, Status, ResolvedAt
        FROM SystemAlerts
        ORDER BY Timestamp DESC
      `);
    
    res.json({
      success: true,
      count: result.recordset.length,
      alerts: result.recordset
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
 * POST /alerts/:alertId/resolve - Resolve an alert
 */
router.post('/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;
    
    const pool = await getPool();
    
    await pool.request()
      .input('alertId', alertId)
      .input('notes', notes || '')
      .input('resolvedAt', new Date())
      .query(`
        UPDATE SystemAlerts
        SET Status = 'resolved', 
            ResolvedAt = @resolvedAt,
            Notes = @notes
        WHERE AlertId = @alertId
      `);
    
    logger.info('Alert resolved', { alertId, notes });
    
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
 * GET /alerts/stats - Get alert statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as TotalAlerts,
        SUM(CASE WHEN Status = 'active' THEN 1 ELSE 0 END) as ActiveAlerts,
        SUM(CASE WHEN Status = 'resolved' THEN 1 ELSE 0 END) as ResolvedAlerts,
        SUM(CASE WHEN Severity = 'critical' THEN 1 ELSE 0 END) as CriticalAlerts,
        SUM(CASE WHEN Severity = 'high' THEN 1 ELSE 0 END) as HighAlerts,
        SUM(CASE WHEN Severity = 'medium' THEN 1 ELSE 0 END) as MediumAlerts
      FROM SystemAlerts
      WHERE Timestamp >= DATEADD(DAY, -7, GETDATE())
    `);
    
    res.json({
      success: true,
      stats: result.recordset[0],
      period: 'Last 7 days'
    });
    
  } catch (error) {
    logger.error('Failed to get alert stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
