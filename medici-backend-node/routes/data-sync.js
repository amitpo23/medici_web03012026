/**
 * Data Sync Routes - API endpoints for external data synchronization
 *
 * Endpoints:
 * - GET /status - Get sync worker status
 * - POST /trigger - Manually trigger sync
 * - GET /history - Get sync history
 * - PUT /config - Update sync configuration
 */

const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { getPool, sql } = require('../config/database');

// Worker instance (will be set when worker starts)
let dataSyncWorker = null;

/**
 * Set the worker instance (called from server.js)
 */
function setWorkerInstance(worker) {
  dataSyncWorker = worker;
}

/**
 * GET /status - Get sync worker status
 */
router.get('/status', async (req, res) => {
  try {
    if (!dataSyncWorker) {
      return res.json({
        status: 'not_initialized',
        message: 'Data sync worker not started'
      });
    }

    const status = dataSyncWorker.getStatus();
    res.json({
      status: status.isRunning ? 'running' : 'idle',
      ...status
    });
  } catch (error) {
    logger.error('[DataSync] Error getting status:', { error: error.message });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * POST /trigger - Manually trigger immediate sync
 */
router.post('/trigger', async (req, res) => {
  try {
    if (!dataSyncWorker) {
      return res.status(503).json({
        error: 'Data sync worker not initialized'
      });
    }

    logger.info('[DataSync] Manual sync triggered via API');

    // Run sync asynchronously
    dataSyncWorker.triggerSync()
      .then(() => {
        logger.info('[DataSync] Manual sync completed');
      })
      .catch(err => {
        logger.error('[DataSync] Manual sync failed:', { error: err.message });
      });

    res.json({
      success: true,
      message: 'Sync triggered. Check /status for progress.'
    });
  } catch (error) {
    logger.error('[DataSync] Error triggering sync:', { error: error.message });
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

/**
 * GET /history - Get sync history from database
 */
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          Id,
          SnapshotDate,
          TotalBookings,
          TotalRevenue,
          TotalProfit,
          ActiveRooms,
          OccupancyRate
        FROM MED_DashboardSnapshots
        ORDER BY SnapshotDate DESC
      `);

    res.json({
      history: result.recordset,
      count: result.recordset.length
    });
  } catch (error) {
    logger.error('[DataSync] Error getting history:', { error: error.message });
    res.status(500).json({ error: 'Failed to get sync history' });
  }
});

/**
 * GET /rooms-active - Get current active rooms from last sync
 */
router.get('/rooms-active', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT
          ra.HotelId,
          h.name AS HotelName,
          ra.RoomId,
          ra.RoomType,
          ra.Available,
          ra.Price,
          ra.LastUpdate
        FROM MED_RoomAvailability ra
        LEFT JOIN Med_Hotels h ON ra.HotelId = h.HotelId
        WHERE ra.Available > 0
        ORDER BY ra.LastUpdate DESC
      `);

    res.json({
      rooms: result.recordset,
      count: result.recordset.length,
      lastUpdate: result.recordset[0]?.LastUpdate
    });
  } catch (error) {
    logger.error('[DataSync] Error getting active rooms:', { error: error.message });
    res.status(500).json({ error: 'Failed to get active rooms' });
  }
});

/**
 * GET /dashboard-info - Get latest dashboard info from sync
 */
router.get('/dashboard-info', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT TOP 1
          SnapshotDate,
          TotalBookings,
          TotalRevenue,
          TotalProfit,
          ActiveRooms,
          OccupancyRate,
          RawData
        FROM MED_DashboardSnapshots
        ORDER BY SnapshotDate DESC
      `);

    if (result.recordset.length === 0) {
      return res.json({
        message: 'No dashboard data available yet',
        data: null
      });
    }

    const snapshot = result.recordset[0];
    let rawData = null;
    try {
      rawData = JSON.parse(snapshot.RawData);
    } catch {
      // Raw data might not be valid JSON
    }

    res.json({
      snapshotDate: snapshot.SnapshotDate,
      totalBookings: snapshot.TotalBookings,
      totalRevenue: snapshot.TotalRevenue,
      totalProfit: snapshot.TotalProfit,
      activeRooms: snapshot.ActiveRooms,
      occupancyRate: snapshot.OccupancyRate,
      rawData
    });
  } catch (error) {
    logger.error('[DataSync] Error getting dashboard info:', { error: error.message });
    res.status(500).json({ error: 'Failed to get dashboard info' });
  }
});

/**
 * PUT /config - Update sync configuration (enable/disable endpoints)
 */
router.put('/config', async (req, res) => {
  try {
    if (!dataSyncWorker) {
      return res.status(503).json({
        error: 'Data sync worker not initialized'
      });
    }

    const { endpoints } = req.body;

    if (!endpoints || !Array.isArray(endpoints)) {
      return res.status(400).json({
        error: 'Invalid request body. Expected { endpoints: [...] }'
      });
    }

    // Update endpoint enabled status
    for (const config of endpoints) {
      const endpoint = dataSyncWorker.endpoints.find(e => e.name === config.name);
      if (endpoint && typeof config.enabled === 'boolean') {
        endpoint.enabled = config.enabled;
        logger.info(`[DataSync] Endpoint ${config.name} set to enabled=${config.enabled}`);
      }
    }

    res.json({
      success: true,
      endpoints: dataSyncWorker.endpoints.map(e => ({
        name: e.name,
        enabled: e.enabled
      }))
    });
  } catch (error) {
    logger.error('[DataSync] Error updating config:', { error: error.message });
    res.status(500).json({ error: 'Failed to update config' });
  }
});

module.exports = router;
module.exports.setWorkerInstance = setWorkerInstance;
