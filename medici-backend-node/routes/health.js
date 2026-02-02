/**
 * Health & Metrics Routes
 * Enhanced with supplier monitoring and cache stats
 */

const express = require('express');
const router = express.Router();
const healthMonitor = require('../services/health-monitor');
const logger = require('../config/logger');
const { getMode, setMode, MODES } = require('../middleware/operational-mode');
const { getCacheService } = require('../services/cache-service');
const MultiSupplierAggregator = require('../services/multi-supplier-aggregator');

const cache = getCacheService();
const multiSupplier = new MultiSupplierAggregator();

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
 * Get supplier status and availability
 */
router.get('/suppliers', (req, res) => {
  try {
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
 * Get cache statistics
 */
router.get('/cache', async (req, res) => {
  try {
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
 * Clear cache (admin only)
 */
router.post('/cache/clear', async (req, res) => {
  try {
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

module.exports = router;
