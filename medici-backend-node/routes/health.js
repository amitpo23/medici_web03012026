/**
 * Health & Metrics Routes
 */

const express = require('express');
const router = express.Router();
const healthMonitor = require('../services/health-monitor');
const logger = require('../config/logger');
const { getMode, setMode, MODES } = require('../middleware/operational-mode');
const { getPool } = require('../config/database');

// Safe imports - optional features
let getCacheService, MultiSupplierAggregator, cache, multiSupplier;
try {
  getCacheService = require('../services/cache-service').getCacheService;
  MultiSupplierAggregator = require('../services/multi-supplier-aggregator');
  cache = getCacheService();
  multiSupplier = new MultiSupplierAggregator();
  logger.info('✅ Advanced health monitoring features loaded');
} catch (err) {
  logger.warn('⚠️  Advanced monitoring not available', { error: err.message });
}

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Health'
 */
router.get('/', async (req, res) => {
  try {
    const health = await healthMonitor.getHealth();
    res.json(health);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /health/deep:
 *   get:
 *     summary: Deep health check with all dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health status
 */
router.get('/deep', async (req, res) => {
  try {
    const health = await healthMonitor.getDeepHealth();
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Deep health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Get system metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System metrics and statistics
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = healthMonitor.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Metrics fetch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /health/metrics/reset:
 *   post:
 *     summary: Reset metrics counters
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 */
router.post('/metrics/reset', (req, res) => {
  try {
    healthMonitor.resetMetrics();
    res.json({ message: 'Metrics reset successfully' });
  } catch (error) {
    logger.error('Metrics reset failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current operational mode
 */
router.get('/mode', (req, res) => {
  res.json({
    mode: getMode(),
    validModes: Object.keys(MODES),
    description: {
      READ_ONLY: 'Only GET requests allowed. No writes or purchases.',
      WRITE_ENABLED: 'GET + POST/PUT/PATCH allowed. No purchase operations.',
      PURCHASE_ENABLED: 'All operations allowed including booking/purchase.'
    }
  });
});

/**
 * Get supplier status and availability (if multi-supplier enabled)
 */
router.get('/suppliers', (req, res) => {
  try {
    if (!multiSupplier) {
      return res.json({
        success: true,
        message: 'Multi-supplier feature not enabled',
        suppliers: { innstant: { available: true, configured: true } }
      });
    }
    
    const supplierStats = multiSupplier.getSupplierStats();
    res.json({
      success: true,
      suppliers: supplierStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Supplier stats fetch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get cache statistics (if cache enabled)
 */
router.get('/cache', async (req, res) => {
  try {
    if (!cache || !cache.getStats) {
      return res.json({
        success: true,
        message: 'Cache feature not enabled',
        cache: { enabled: false }
      });
    }
    
    const cacheStats = await cache.getStats();
    res.json({
      success: true,
      cache: cacheStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cache stats fetch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clear cache (admin only - if cache enabled)
 */
router.post('/cache/clear', async (req, res) => {
  try {
    if (!cache || !cache.clear) {
      return res.status(404).json({ 
        success: false,
        error: 'Cache feature not enabled' 
      });
    }
    
    const apiKey = req.headers['x-api-key'];
    const internalKey = process.env.INTERNAL_API_KEY;
    if (!apiKey || !internalKey || apiKey !== internalKey) {
      return res.status(401).json({ error: 'API key required to clear cache' });
    }

    await cache.clear();
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    logger.error('Cache clear failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Set operational mode (admin only - requires auth header)
 */
router.post('/mode', (req, res) => {
  try {
    const { mode } = req.body;

    // Require API key or auth for mode changes
    const apiKey = req.headers['x-api-key'];
    const internalKey = process.env.INTERNAL_API_KEY;
    if (!apiKey || !internalKey || apiKey !== internalKey) {
      return res.status(401).json({ error: 'API key required to change operational mode' });
    }

    const newMode = setMode(mode);
    res.json({
      success: true,
      mode: newMode,
      message: `Operational mode set to ${newMode}`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /health/workers
 * Get worker status and statistics
 */
router.get('/workers', async (req, res) => {
  try {
    const pool = await getPool();
    
    // Get recent worker activity from logs
    const recentActivity = await pool.request().query(`
      SELECT TOP 10
        'buyroom' as WorkerType,
        Action,
        Details,
        CreatedAt
      FROM MED_ReservationLogs
      WHERE Action IN ('ROOM_PURCHASED', 'PURCHASE_FAILED')
      ORDER BY CreatedAt DESC
    `);
    
    const cancellationActivity = await pool.request().query(`
      SELECT TOP 10
        'cancellation' as WorkerType,
        Action,
        Details,
        CreatedAt
      FROM MED_OpportunityLogs
      WHERE Action = 'AUTO_CANCELLED'
      ORDER BY CreatedAt DESC
    `);
    
    // Get push statistics
    const pushStats = await pool.request().query(`
      SELECT 
        PushType,
        COUNT(*) as Total,
        SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) as Successful,
        SUM(CASE WHEN Success = 0 THEN 1 ELSE 0 END) as Failed,
        AVG(ProcessingTimeMs) as AvgProcessingTime,
        MAX(PushDate) as LastPush
      FROM MED_PushLog
      WHERE PushDate >= DATEADD(HOUR, -1, GETDATE())
      GROUP BY PushType
    `);
    
    // Get queue status
    const queueStatus = await pool.request().query(`
      SELECT 
        COUNT(*) as PendingCount,
        COUNT(CASE WHEN Error IS NOT NULL THEN 1 END) as FailedCount,
        MIN(DateInsert) as OldestItem,
        MAX(DateInsert) as NewestItem
      FROM Med_HotelsToPush
      WHERE IsActive = 1 AND DatePush IS NULL
    `);
    
    res.json({
      success: true,
      workers: {
        buyroom: {
          recentActivity: recentActivity.recordset.map(r => ({
            action: r.Action,
            timestamp: r.CreatedAt,
            details: r.Details ? JSON.parse(r.Details) : null
          }))
        },
        cancellation: {
          recentActivity: cancellationActivity.recordset.map(r => ({
            action: r.Action,
            timestamp: r.CreatedAt,
            details: r.Details ? JSON.parse(r.Details) : null
          }))
        },
        priceUpdate: {
          pushStats: pushStats.recordset,
          queueStatus: queueStatus.recordset[0]
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('[Health] Worker status error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /health/workers/summary
 * Get worker performance summary (24 hours)
 */
router.get('/workers/summary', async (req, res) => {
  try {
    const pool = await getPool();
    
    // Buyroom worker stats (24h)
    const buyroomStats = await pool.request().query(`
      SELECT 
        COUNT(*) as TotalAttempts,
        SUM(CASE WHEN Action = 'ROOM_PURCHASED' THEN 1 ELSE 0 END) as Successful,
        SUM(CASE WHEN Action = 'PURCHASE_FAILED' THEN 1 ELSE 0 END) as Failed
      FROM MED_ReservationLogs
      WHERE CreatedAt >= DATEADD(HOUR, -24, GETDATE())
      AND Action IN ('ROOM_PURCHASED', 'PURCHASE_FAILED')
    `);
    
    // Cancellation worker stats (24h)
    const cancelStats = await pool.request().query(`
      SELECT 
        COUNT(*) as TotalCancellations
      FROM MED_OpportunityLogs
      WHERE CreatedAt >= DATEADD(HOUR, -24, GETDATE())
      AND Action = 'AUTO_CANCELLED'
    `);
    
    // Price update stats (24h)
    const priceStats = await pool.request().query(`
      SELECT 
        COUNT(*) as TotalPushes,
        SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) as Successful,
        SUM(CASE WHEN Success = 0 THEN 1 ELSE 0 END) as Failed,
        AVG(ProcessingTimeMs) as AvgProcessingTime
      FROM MED_PushLog
      WHERE PushDate >= DATEADD(HOUR, -24, GETDATE())
    `);
    
    // Queue backlog
    const queueBacklog = await pool.request().query(`
      SELECT COUNT(*) as PendingCount
      FROM Med_HotelsToPush
      WHERE IsActive = 1 AND DatePush IS NULL
    `);
    
    const buyroom = buyroomStats.recordset[0];
    const cancel = cancelStats.recordset[0];
    const price = priceStats.recordset[0];
    const queue = queueBacklog.recordset[0];
    
    res.json({
      success: true,
      period: 'Last 24 hours',
      summary: {
        buyroom: {
          totalAttempts: buyroom.TotalAttempts,
          successful: buyroom.Successful,
          failed: buyroom.Failed,
          successRate: buyroom.TotalAttempts > 0 
            ? `${((buyroom.Successful / buyroom.TotalAttempts) * 100).toFixed(1)}%`
            : 'N/A'
        },
        cancellation: {
          totalCancellations: cancel.TotalCancellations
        },
        priceUpdate: {
          totalPushes: price.TotalPushes,
          successful: price.Successful,
          failed: price.Failed,
          successRate: price.TotalPushes > 0 
            ? `${((price.Successful / price.TotalPushes) * 100).toFixed(1)}%`
            : 'N/A',
          avgProcessingTime: price.AvgProcessingTime 
            ? `${Math.round(price.AvgProcessingTime)}ms`
            : 'N/A'
        },
        queue: {
          pendingItems: queue.PendingCount,
          status: queue.PendingCount === 0 ? 'empty' :
                  queue.PendingCount > 50 ? 'critical' :
                  queue.PendingCount > 20 ? 'warning' : 'normal'
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('[Health] Worker summary error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
