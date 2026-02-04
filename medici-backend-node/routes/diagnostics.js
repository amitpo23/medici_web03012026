/**
 * Diagnostics API Routes
 * System diagnostics, worker health, and inventory analysis
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const logger = require('../config/logger');

/**
 * GET /api/diagnostics/cancellation-errors
 * Get cancellation error analysis summary
 */
router.get('/cancellation-errors', async (req, res) => {
  try {
    const pool = await getPool();

    // Total cancellation attempts
    const successResult = await pool.request().query(`
      SELECT COUNT(*) as Total FROM MED_CancelBook
    `);
    const failResult = await pool.request().query(`
      SELECT COUNT(*) as Total FROM MED_CancelBookError
    `);

    const successful = successResult.recordset[0].Total;
    const failed = failResult.recordset[0].Total;
    const total = successful + failed;
    const successRate = total > 0 ? parseFloat(((successful / total) * 100).toFixed(2)) : 0;
    const failureRate = total > 0 ? parseFloat(((failed / total) * 100).toFixed(2)) : 0;

    // Top errors
    const topErrorsResult = await pool.request().query(`
      SELECT TOP 10
        SUBSTRING(Error, 1, 200) as ErrorMessage,
        COUNT(*) as ErrorCount,
        CAST(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM MED_CancelBookError), 0) AS DECIMAL(5,2)) as Percentage,
        MIN(DateInsert) as FirstOccurrence,
        MAX(DateInsert) as LastOccurrence
      FROM MED_CancelBookError
      GROUP BY SUBSTRING(Error, 1, 200)
      ORDER BY COUNT(*) DESC
    `);

    // Recommendations based on error patterns
    const recommendations = [];
    const topErrors = topErrorsResult.recordset;

    if (failureRate > 20) {
      recommendations.push({
        priority: 'high',
        issue: 'High cancellation failure rate',
        recommendation: 'Review supplier API connectivity and timeout settings'
      });
    }
    if (topErrors.some(e => e.ErrorMessage && e.ErrorMessage.includes('timeout'))) {
      recommendations.push({
        priority: 'high',
        issue: 'Timeout errors detected',
        recommendation: 'Increase API timeout or implement retry logic'
      });
    }
    if (topErrors.some(e => e.ErrorMessage && e.ErrorMessage.includes('not found'))) {
      recommendations.push({
        priority: 'medium',
        issue: 'Booking not found errors',
        recommendation: 'Verify booking IDs before cancellation attempts'
      });
    }
    if (failed > 0 && recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        issue: 'Some cancellation failures exist',
        recommendation: 'Monitor error trends and investigate recurring patterns'
      });
    }

    res.json({
      summary: {
        totalCancellationAttempts: total,
        successfulCancellations: successful,
        failedCancellations: failed,
        successRate,
        failureRate,
        totalErrors: topErrors.reduce((sum, e) => sum + (e.ErrorCount || 0), 0)
      },
      topErrors,
      recommendations
    });

  } catch (error) {
    logger.error('Diagnostics: cancellation errors failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/diagnostics/cancellation-errors/details
 * Get detailed cancellation errors with filters
 */
router.get('/cancellation-errors/details', async (req, res) => {
  try {
    const pool = await getPool();
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const errorMessage = req.query.errorMessage;

    let query = `
      SELECT TOP ${limit}
        Id, DateInsert, PreBookId, contentBookingID, Error
      FROM MED_CancelBookError
    `;

    if (errorMessage) {
      query += ` WHERE Error LIKE '%' + @errorMessage + '%'`;
    }

    query += ` ORDER BY DateInsert DESC`;

    const request = pool.request();
    if (errorMessage) {
      request.input('errorMessage', errorMessage);
    }

    const result = await request.query(query);

    res.json({
      success: true,
      count: result.recordset.length,
      errors: result.recordset
    });

  } catch (error) {
    logger.error('Diagnostics: cancellation error details failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/diagnostics/worker-health
 * Get worker health status
 */
router.get('/worker-health', async (req, res) => {
  try {
    const pool = await getPool();

    // BuyRoom worker - check recent activity
    let buyRoomResult = { recordset: [] };
    try {
      buyRoomResult = await pool.request().query(`
        SELECT TOP 1 CreatedAt, Action
        FROM MED_ReservationLogs
        WHERE Action IN ('ROOM_PURCHASED', 'PURCHASE_FAILED')
        ORDER BY CreatedAt DESC
      `);
    } catch (e) {
      logger.warn('Diagnostics: MED_ReservationLogs table not found, skipping BuyRoom worker check');
    }

    // Check pending reservations needing purchase
    let pendingResult = { recordset: [{ PendingCount: 0 }] };
    try {
      pendingResult = await pool.request().query(`
        SELECT COUNT(*) as PendingCount
        FROM Med_Reservation
        WHERE IsCanceled = 0 AND BookingId IS NULL
      `);
    } catch (e) {
      logger.warn('Diagnostics: Med_Reservation query failed', { error: e.message });
    }

    // Price update worker
    let priceUpdateResult = { recordset: [] };
    try {
      priceUpdateResult = await pool.request().query(`
        SELECT TOP 1 PushDate, Success
        FROM MED_PushLog
        ORDER BY PushDate DESC
      `);
    } catch (e) {
      logger.warn('Diagnostics: MED_PushLog query failed', { error: e.message });
    }

    // Auto-cancel worker
    let autoCancelResult = { recordset: [] };
    try {
      autoCancelResult = await pool.request().query(`
        SELECT TOP 1 CreatedAt as LastActivity
        FROM MED_OpportunityLogs
        WHERE Action = 'AUTO_CANCELLED'
        ORDER BY CreatedAt DESC
      `);
    } catch (e) {
      logger.warn('Diagnostics: MED_OpportunityLogs query failed', { error: e.message });
    }

    const now = new Date();

    // BuyRoom worker health
    const buyRoomLastActivity = buyRoomResult.recordset[0]?.CreatedAt || null;
    const buyRoomAge = buyRoomLastActivity ? (now - new Date(buyRoomLastActivity)) / 60000 : null;

    // Price update worker health
    const priceUpdateLast = priceUpdateResult.recordset[0]?.PushDate || null;
    const priceUpdateAge = priceUpdateLast ? (now - new Date(priceUpdateLast)) / 60000 : null;

    // Auto-cancel worker health
    const autoCancelLast = autoCancelResult.recordset[0]?.LastActivity || null;
    const autoCancelAge = autoCancelLast ? (now - new Date(autoCancelLast)) / 60000 : null;

    const getWorkerStatus = (ageMinutes, thresholdWarning, thresholdCritical) => {
      if (ageMinutes === null) return 'warning';
      if (ageMinutes > thresholdCritical) return 'critical';
      if (ageMinutes > thresholdWarning) return 'warning';
      return 'healthy';
    };

    const buyRoomStatus = getWorkerStatus(buyRoomAge, 30, 120);
    const priceUpdateStatus = getWorkerStatus(priceUpdateAge, 60, 180);
    const autoCancelStatus = getWorkerStatus(autoCancelAge, 120, 360);

    const statuses = [buyRoomStatus, priceUpdateStatus, autoCancelStatus];
    const overallHealth = statuses.includes('critical') ? 'critical' :
                          statuses.includes('warning') ? 'warning' : 'healthy';

    res.json({
      overallHealth,
      workers: {
        buyRoomWorker: {
          status: buyRoomStatus,
          lastActivity: buyRoomLastActivity,
          pendingReservations: pendingResult.recordset[0].PendingCount,
          healthMessage: buyRoomStatus === 'healthy' ? 'Worker is active' :
                         buyRoomStatus === 'warning' ? 'No recent activity' :
                         'Worker may be stopped'
        },
        priceUpdateWorker: {
          status: priceUpdateStatus,
          lastActivity: priceUpdateLast,
          lastUpdateTime: priceUpdateLast,
          healthMessage: priceUpdateStatus === 'healthy' ? 'Worker is active' :
                         priceUpdateStatus === 'warning' ? 'No recent pushes' :
                         'Worker may be stopped'
        },
        autoCancelWorker: {
          status: autoCancelStatus,
          lastActivity: autoCancelLast,
          healthMessage: autoCancelStatus === 'healthy' ? 'Worker is active' :
                         autoCancelStatus === 'warning' ? 'No recent cancellations' :
                         'Worker may be stopped'
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Diagnostics: worker health failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/diagnostics/database-health
 * Get database health status
 */
router.get('/database-health', async (req, res) => {
  try {
    const pool = await getPool();
    const startTime = Date.now();

    await pool.request().query('SELECT 1');

    const responseTime = Date.now() - startTime;
    const status = responseTime > 2000 ? 'critical' :
                   responseTime > 1000 ? 'degraded' : 'healthy';

    res.json({
      status,
      connectionTest: true,
      responseTime,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Diagnostics: database health failed', { error: error.message });
    res.json({
      status: 'critical',
      connectionTest: false,
      responseTime: -1,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/diagnostics/inventory-analysis
 * Get inventory analysis with alerts
 */
router.get('/inventory-analysis', async (req, res) => {
  try {
    const pool = await getPool();

    // Overall inventory stats
    const overallResult = await pool.request().query(`
      SELECT
        COUNT(*) as TotalActiveInventory,
        SUM(CASE WHEN IsSold = 0 THEN 1 ELSE 0 END) as UnsoldRooms,
        SUM(CASE WHEN IsSold = 1 THEN 1 ELSE 0 END) as SoldRooms,
        SUM(CASE WHEN startDate <= DATEADD(DAY, 3, GETDATE()) AND IsSold = 0 THEN 1 ELSE 0 END) as NearingDeadline,
        SUM(CASE WHEN IsSold = 0 THEN ISNULL(price, 0) ELSE 0 END) as TotalValueAtRisk,
        SUM(CASE WHEN IsSold = 1 THEN ISNULL(lastPrice - price, 0) ELSE 0 END) as PotentialProfit
      FROM MED_Book
      WHERE IsActive = 1
      AND price > 0
    `);

    // By hotel breakdown
    const byHotelResult = await pool.request().query(`
      SELECT TOP 20
        h.name as HotelName,
        COUNT(*) as ActiveRooms,
        SUM(ISNULL(b.price, 0)) as TotalValue,
        SUM(ISNULL(b.lastPrice - b.price, 0)) as PotentialProfit
      FROM MED_Book b
      LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
      WHERE b.IsActive = 1
      AND b.price > 0
      GROUP BY h.name
      ORDER BY COUNT(*) DESC
    `);

    const overall = overallResult.recordset[0];

    // Generate alerts
    const alerts = [];
    if (overall.NearingDeadline > 0) {
      alerts.push({
        severity: 'critical',
        message: `${overall.NearingDeadline} rooms nearing check-in deadline (within 3 days)`,
        affectedRooms: overall.NearingDeadline,
        actionRequired: 'Review and price-adjust rooms nearing deadline'
      });
    }
    if (overall.TotalValueAtRisk > 10000) {
      alerts.push({
        severity: 'warning',
        message: `Total value at risk: $${overall.TotalValueAtRisk.toLocaleString()} in unsold rooms`,
        affectedRooms: overall.UnsoldRooms,
        actionRequired: 'Consider price reductions for unsold inventory'
      });
    }
    if (overall.UnsoldRooms > 50) {
      alerts.push({
        severity: 'info',
        message: `${overall.UnsoldRooms} unsold rooms in active inventory`,
        affectedRooms: overall.UnsoldRooms,
        actionRequired: 'Monitor sell-through rate'
      });
    }

    res.json({
      overall: {
        TotalActiveInventory: overall.TotalActiveInventory || 0,
        UnsoldRooms: overall.UnsoldRooms || 0,
        SoldRooms: overall.SoldRooms || 0,
        NearingDeadline: overall.NearingDeadline || 0,
        TotalValueAtRisk: overall.TotalValueAtRisk || 0,
        PotentialProfit: overall.PotentialProfit || 0
      },
      byHotel: byHotelResult.recordset,
      alerts
    });

  } catch (error) {
    logger.error('Diagnostics: inventory analysis failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
