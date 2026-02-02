/**
 * Cancellations Analysis API
 * Provides insights into cancellation success/failure patterns
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const logger = require('../config/logger');

/**
 * GET /cancellations/stats - Overall cancellation statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const pool = await getPool();
    const { days = 30 } = req.query;

    // Success count
    const successResult = await pool.request().query(`
      SELECT COUNT(*) as Total
      FROM MED_CancelBook
      WHERE DateInsert >= DATEADD(day, -${days}, GETDATE())
    `);

    // Failure count
    const failureResult = await pool.request().query(`
      SELECT COUNT(*) as Total
      FROM MED_CancelBookError
      WHERE DateInsert >= DATEADD(day, -${days}, GETDATE())
    `);

    // Auto-cancellations
    const autoResult = await pool.request().query(`
      SELECT COUNT(*) as Total
      FROM MED_OpportunitiesLog
      WHERE ActionType = 'AUTO_CANCELLED'
      AND DateTimeUTC >= DATEADD(day, -${days}, GETDATE())
    `);

    const success = successResult.recordset[0].Total;
    const failures = failureResult.recordset[0].Total;
    const total = success + failures;
    const successRate = total > 0 ? ((success / total) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      period: `Last ${days} days`,
      stats: {
        totalCancellations: total,
        successfulCancellations: success,
        failedCancellations: failures,
        successRate: `${successRate}%`,
        autoCancellations: autoResult.recordset[0].Total
      }
    });

  } catch (error) {
    logger.error('Cancellations stats error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /cancellations/recent - Recent cancellations (success and failure)
 */
router.get('/recent', async (req, res) => {
  try {
    const pool = await getPool();
    const { limit = 50, status = 'all' } = req.query;

    let results = [];

    if (status === 'all' || status === 'success') {
      const successResult = await pool.request().query(`
        SELECT TOP ${limit}
          cb.Id,
          cb.DateInsert,
          cb.PreBookId as OpportunityId,
          cb.contentBookingID as BookingId,
          cb.CancellationReason,
          'SUCCESS' as Status,
          o.Price as Amount,
          h.name as HotelName
        FROM MED_CancelBook cb
        LEFT JOIN [MED_ֹOֹֹpportunities] o ON cb.PreBookId = o.OpportunityId
        LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
        ORDER BY cb.DateInsert DESC
      `);
      results = results.concat(successResult.recordset);
    }

    if (status === 'all' || status === 'failure') {
      const failureResult = await pool.request().query(`
        SELECT TOP ${limit}
          cbe.Id,
          cbe.DateInsert,
          cbe.PreBookId as OpportunityId,
          cbe.contentBookingID as BookingId,
          SUBSTRING(cbe.Error, 1, 200) as ErrorMessage,
          'FAILURE' as Status,
          o.Price as Amount,
          h.name as HotelName
        FROM MED_CancelBookError cbe
        LEFT JOIN [MED_ֹOֹֹpportunities] o ON cbe.PreBookId = o.OpportunityId
        LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
        ORDER BY cbe.DateInsert DESC
      `);
      results = results.concat(failureResult.recordset);
    }

    // Sort by date
    results.sort((a, b) => new Date(b.DateInsert) - new Date(a.DateInsert));

    res.json({
      success: true,
      count: results.length,
      cancellations: results.slice(0, limit)
    });

  } catch (error) {
    logger.error('Recent cancellations error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /cancellations/errors - Most common cancellation errors
 */
router.get('/errors', async (req, res) => {
  try {
    const pool = await getPool();
    const { days = 30 } = req.query;

    const result = await pool.request().query(`
      SELECT TOP 20
        SUBSTRING(Error, 1, 150) as ErrorType,
        COUNT(*) as Count,
        MAX(DateInsert) as LastOccurrence
      FROM MED_CancelBookError
      WHERE DateInsert >= DATEADD(day, -${days}, GETDATE())
      GROUP BY SUBSTRING(Error, 1, 150)
      ORDER BY Count DESC
    `);

    res.json({
      success: true,
      period: `Last ${days} days`,
      totalUniqueErrors: result.recordset.length,
      errors: result.recordset
    });

  } catch (error) {
    logger.error('Cancellation errors analysis error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /cancellations/auto - Auto-cancellation history
 */
router.get('/auto', async (req, res) => {
  try {
    const pool = await getPool();
    const { limit = 50 } = req.query;

    const result = await pool.request().query(`
      SELECT TOP ${limit}
        ol.OpportunityId,
        ol.DateTimeUTC,
        ol.ActionType,
        ol.RequestJson,
        o.Price as PurchasePrice,
        h.name as HotelName,
        o.DateForm as CheckIn
      FROM MED_OpportunitiesLog ol
      LEFT JOIN [MED_ֹOֹֹpportunities] o ON ol.OpportunityId = o.OpportunityId
      LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
      WHERE ol.ActionType IN ('AUTO_CANCELLED', 'CANCEL_FAILED')
      ORDER BY ol.DateTimeUTC DESC
    `);

    // Parse JSON details
    const processed = result.recordset.map(row => {
      let details = {};
      try {
        details = JSON.parse(row.RequestJson || '{}');
      } catch {}

      return {
        opportunityId: row.OpportunityId,
        date: row.DateTimeUTC,
        actionType: row.ActionType,
        hotelName: row.HotelName,
        checkIn: row.CheckIn,
        purchasePrice: row.PurchasePrice,
        refundAmount: details.refundAmount || 0,
        lostAmount: details.lostAmount || 0,
        cancellationId: details.cancellationId,
        error: details.error
      };
    });

    res.json({
      success: true,
      count: processed.length,
      autoCancellations: processed
    });

  } catch (error) {
    logger.error('Auto-cancellation history error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /cancellations/opportunity/:id - Full cancellation history for specific opportunity
 */
router.get('/opportunity/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const { id } = req.params;

    // Get opportunity details
    const oppResult = await pool.request()
      .input('id', id)
      .query(`
        SELECT o.*, h.name as HotelName, rc.Name as RoomName
        FROM [MED_ֹOֹֹpportunities] o
        LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
        LEFT JOIN MED_RoomCategory rc ON o.CategoryId = rc.CategoryId
        WHERE o.OpportunityId = @id
      `);

    if (oppResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    // Check if cancelled successfully
    const cancelResult = await pool.request()
      .input('id', id)
      .query('SELECT * FROM MED_CancelBook WHERE PreBookId = @id');

    // Check if cancellation failed
    const errorResult = await pool.request()
      .input('id', id)
      .query('SELECT * FROM MED_CancelBookError WHERE PreBookId = @id');

    // Get full log history
    const logResult = await pool.request()
      .input('id', id)
      .query(`
        SELECT * FROM MED_OpportunitiesLog
        WHERE OpportunityId = @id
        ORDER BY DateTimeUTC DESC
      `);

    res.json({
      success: true,
      opportunity: oppResult.recordset[0],
      cancellationSuccess: cancelResult.recordset,
      cancellationErrors: errorResult.recordset,
      fullHistory: logResult.recordset
    });

  } catch (error) {
    logger.error('Opportunity cancellation history error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /cancellations/trends - Cancellation trends over time
 */
router.get('/trends', async (req, res) => {
  try {
    const pool = await getPool();
    const { days = 30 } = req.query;

    // Daily success trend
    const successTrend = await pool.request().query(`
      SELECT 
        CAST(DateInsert AS DATE) as Date,
        COUNT(*) as Count
      FROM MED_CancelBook
      WHERE DateInsert >= DATEADD(day, -${days}, GETDATE())
      GROUP BY CAST(DateInsert AS DATE)
      ORDER BY Date
    `);

    // Daily failure trend
    const failureTrend = await pool.request().query(`
      SELECT 
        CAST(DateInsert AS DATE) as Date,
        COUNT(*) as Count
      FROM MED_CancelBookError
      WHERE DateInsert >= DATEADD(day, -${days}, GETDATE())
      GROUP BY CAST(DateInsert AS DATE)
      ORDER BY Date
    `);

    res.json({
      success: true,
      period: `Last ${days} days`,
      trends: {
        successByDay: successTrend.recordset,
        failureByDay: failureTrend.recordset
      }
    });

  } catch (error) {
    logger.error('Cancellation trends error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
