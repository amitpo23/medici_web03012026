/**
 * Real-Time Monitoring API Routes
 * Provides real-time metrics for monitoring dashboard
 */

const express = require('express');
const router = express.Router();
const metricsCollector = require('../services/metrics-collector');
const logger = require('../config/logger');
const { getPool } = require('../config/database');

/**
 * GET /monitoring/metrics
 * Get all current metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = metricsCollector.getMetrics();
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Failed to get metrics', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
});

/**
 * GET /monitoring/metrics/:category
 * Get specific metric category (bookings, api, revenue, errors, system)
 */
router.get('/metrics/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const validCategories = ['bookings', 'api', 'revenue', 'errors', 'system'];
    
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid category. Valid categories: ${validCategories.join(', ')}`
      });
    }

    const metrics = metricsCollector.getMetricCategory(category);
    res.json({
      success: true,
      category,
      metrics
    });
  } catch (error) {
    logger.error('Failed to get category metrics', { 
      category: req.params.category,
      error: error.message 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
});

/**
 * GET /monitoring/health
 * Get system health status
 */
router.get('/health', async (req, res) => {
  try {
    const health = metricsCollector.getHealthStatus();
    const statusCode = health.status === 'critical' ? 503 : 
                       health.status === 'warning' ? 200 : 200;
    
    res.status(statusCode).json({
      success: true,
      health
    });
  } catch (error) {
    logger.error('Failed to get health status', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health status'
    });
  }
});

/**
 * GET /monitoring/activity
 * Get recent activity (last 50 events)
 */
router.get('/activity', async (req, res) => {
  try {
    const pool = await getPool();
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    
    const result = await pool.request().query(`
      SELECT TOP ${limit}
        'booking' as type,
        BookingNumber as reference,
        SaleDate as timestamp,
        Price as amount,
        CityName as details
      FROM [MED_ֹOֹֹpportunities]
      WHERE IsSale = 1
      
      UNION ALL
      
      SELECT TOP ${limit}
        'cancellation' as type,
        BookingNumber as reference,
        DateInsert as timestamp,
        0 as amount,
        SUBSTRING(Error, 1, 100) as details
      FROM MED_CancelBookError
      
      ORDER BY timestamp DESC
    `);

    const activity = result.recordset.map(row => ({
      type: row.type,
      reference: row.reference,
      timestamp: row.timestamp,
      amount: row.type === 'booking' ? `₪${row.amount}` : null,
      details: row.details,
      status: row.type === 'booking' ? 'success' : 'error'
    }));

    res.json({
      success: true,
      activity,
      total: activity.length
    });
  } catch (error) {
    logger.error('Failed to get activity', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve activity'
    });
  }
});

/**
 * GET /monitoring/trends
 * Get hourly trends for last 24 hours
 */
router.get('/trends', async (req, res) => {
  try {
    const pool = await getPool();
    
    // Hourly bookings and revenue for last 24 hours
    const result = await pool.request().query(`
      WITH Hours AS (
        SELECT 
          DATEADD(HOUR, -n, GETDATE()) as hour_start
        FROM (
          SELECT TOP 24 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 as n
          FROM sys.objects
        ) numbers
      )
      SELECT 
        DATEPART(HOUR, h.hour_start) as hour,
        ISNULL(COUNT(o.ID), 0) as bookings,
        ISNULL(SUM(o.Price), 0) as revenue,
        ISNULL(SUM(o.Price - o.PurchasePrice), 0) as profit
      FROM Hours h
      LEFT JOIN [MED_ֹOֹֹpportunities] o ON 
        o.IsSale = 1 AND
        o.SaleDate >= h.hour_start AND
        o.SaleDate < DATEADD(HOUR, 1, h.hour_start)
      GROUP BY DATEPART(HOUR, h.hour_start), h.hour_start
      ORDER BY h.hour_start DESC
    `);

    const trends = result.recordset.reverse().map(row => ({
      hour: `${row.hour}:00`,
      bookings: row.bookings,
      revenue: row.revenue,
      profit: row.profit
    }));

    res.json({
      success: true,
      trends,
      period: 'last_24_hours'
    });
  } catch (error) {
    logger.error('Failed to get trends', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve trends'
    });
  }
});

/**
 * GET /monitoring/alerts
 * Get active alerts and warnings
 */
router.get('/alerts', async (req, res) => {
  try {
    const health = metricsCollector.getHealthStatus();
    const metrics = metricsCollector.getMetrics();
    
    const alerts = [];
    
    // Generate alerts based on health status
    if (health.status === 'critical' || health.status === 'warning') {
      health.issues.forEach((issue, index) => {
        alerts.push({
          id: `alert_${Date.now()}_${index}`,
          severity: health.status,
          message: issue,
          timestamp: new Date().toISOString(),
          category: 'system'
        });
      });
    }

    // Check for high cancellation rate
    if (metrics.errors?.cancellation_failures_last_hour > 10) {
      alerts.push({
        id: `alert_cancellations_${Date.now()}`,
        severity: 'warning',
        message: `High cancellation failure rate: ${metrics.errors.cancellation_failures_last_hour} failures in last hour`,
        timestamp: new Date().toISOString(),
        category: 'cancellations'
      });
    }

    // Check for slow API
    const avgResponseTime = parseInt(metrics.api?.avg_response_time?.replace('ms', '') || 0);
    if (avgResponseTime > 1500) {
      alerts.push({
        id: `alert_api_slow_${Date.now()}`,
        severity: avgResponseTime > 2000 ? 'critical' : 'warning',
        message: `API response time is slow: ${metrics.api.avg_response_time}`,
        timestamp: new Date().toISOString(),
        category: 'api'
      });
    }

    res.json({
      success: true,
      alerts,
      total: alerts.length,
      has_critical: alerts.some(a => a.severity === 'critical')
    });
  } catch (error) {
    logger.error('Failed to get alerts', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts'
    });
  }
});

module.exports = router;
