/**
 * Health & Metrics Routes
 */

const express = require('express');
const router = express.Router();
const healthMonitor = require('../services/health-monitor');
const logger = require('../config/logger');

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

module.exports = router;
