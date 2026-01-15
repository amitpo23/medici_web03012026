/**
 * Enhanced Dashboard API - Advanced KPIs and Metrics
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

/**
 * Get comprehensive dashboard statistics
 */
router.get('/Stats', async (req, res) => {
  try {
    const { period = '30' } = req.query; // Days
    const pool = await getPool();
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Total statistics
    const totalStats = await pool.request()
      .input('startDate', startDate)
      .query(`
        SELECT 
          COUNT(DISTINCT r.Id) as TotalBookings,
          SUM(r.TotalPrice) as TotalRevenue,
          SUM(ISNULL(r.SupplierPrice, 0)) as TotalCost,
          SUM(r.TotalPrice - ISNULL(r.SupplierPrice, 0)) as TotalProfit,
          AVG((r.TotalPrice - ISNULL(r.SupplierPrice, 0)) / NULLIF(r.TotalPrice, 0) * 100) as AvgMargin,
          AVG(r.TotalPrice) as AvgBookingValue
        FROM Med_Reservations r
        WHERE r.CheckIn >= @startDate
        AND r.Status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      `);

    // Opportunities statistics
    const oppStats = await pool.request()
      .input('startDate', startDate)
      .query(`
        SELECT 
          COUNT(*) as TotalOpportunities,
          SUM(CASE WHEN Status = 'ACTIVE' THEN 1 ELSE 0 END) as ActiveOpps,
          SUM(CASE WHEN Status = 'SOLD' THEN 1 ELSE 0 END) as SoldOpps,
          SUM(CASE WHEN Status = 'CANCELLED' THEN 1 ELSE 0 END) as CancelledOpps,
          AVG(PushPrice - BuyPrice) as AvgProfitPerOpp
        FROM MED_Opportunities
        WHERE DateInsert >= @startDate
      `);

    // Conversion rate
    const conversionRate = oppStats.recordset[0].TotalOpportunities > 0
      ? (oppStats.recordset[0].SoldOpps / oppStats.recordset[0].TotalOpportunities * 100).toFixed(2)
      : 0;

    // Daily trend
    const dailyTrend = await pool.request()
      .input('startDate', startDate)
      .query(`
        SELECT TOP 7
          CONVERT(DATE, CheckIn) as Date,
          COUNT(*) as Bookings,
          SUM(TotalPrice) as Revenue
        FROM Med_Reservations
        WHERE CheckIn >= @startDate
        AND Status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
        GROUP BY CONVERT(DATE, CheckIn)
        ORDER BY Date DESC
      `);

    res.json({
      overview: {
        ...totalStats.recordset[0],
        ConversionRate: conversionRate
      },
      opportunities: oppStats.recordset[0],
      dailyTrend: dailyTrend.recordset.reverse()
    });

  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get real-time alerts
 */
router.get('/Alerts', async (req, res) => {
  try {
    const pool = await getPool();
    const alerts = [];

    // Check for expiring opportunities
    const expiringOpps = await pool.request().query(`
      SELECT COUNT(*) as Count
      FROM MED_Opportunities
      WHERE Status = 'ACTIVE'
      AND DateFrom <= DATEADD(DAY, 2, GETDATE())
      AND DateFrom >= GETDATE()
    `);

    if (expiringOpps.recordset[0].Count > 0) {
      alerts.push({
        type: 'warning',
        title: 'Expiring Opportunities',
        message: `${expiringOpps.recordset[0].Count} opportunities expire within 48 hours`,
        priority: 'high'
      });
    }

    // Check for pending purchases
    const pendingPurchases = await pool.request().query(`
      SELECT COUNT(*) as Count
      FROM Med_Reservations
      WHERE Status = 'CONFIRMED'
      AND SupplierBookingId IS NULL
      AND CheckIn >= GETDATE()
    `);

    if (pendingPurchases.recordset[0].Count > 0) {
      alerts.push({
        type: 'info',
        title: 'Pending Purchases',
        message: `${pendingPurchases.recordset[0].Count} reservations need supplier booking`,
        priority: 'medium'
      });
    }

    // Check for low margin bookings
    const lowMargin = await pool.request().query(`
      SELECT COUNT(*) as Count
      FROM Med_Reservations
      WHERE Status = 'CONFIRMED'
      AND (TotalPrice - ISNULL(SupplierPrice, 0)) / NULLIF(TotalPrice, 0) < 0.10
      AND CheckIn >= GETDATE()
    `);

    if (lowMargin.recordset[0].Count > 0) {
      alerts.push({
        type: 'warning',
        title: 'Low Margin Bookings',
        message: `${lowMargin.recordset[0].Count} bookings have margin below 10%`,
        priority: 'medium'
      });
    }

    res.json(alerts);

  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get performance metrics by hotel
 */
router.get('/HotelPerformance', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const pool = await getPool();

    const result = await pool.request()
      .input('limit', parseInt(limit))
      .query(`
        SELECT TOP (@limit)
          h.HotelName,
          h.id as HotelId,
          COUNT(r.Id) as TotalBookings,
          SUM(r.TotalPrice) as Revenue,
          SUM(r.TotalPrice - ISNULL(r.SupplierPrice, 0)) as Profit,
          AVG((r.TotalPrice - ISNULL(r.SupplierPrice, 0)) / NULLIF(r.TotalPrice, 0) * 100) as MarginPercent,
          AVG(DATEDIFF(DAY, r.CreatedAt, r.CheckIn)) as AvgBookingWindow
        FROM Med_Reservations r
        INNER JOIN Med_Hotels h ON r.HotelId = h.id
        WHERE r.CheckIn >= DATEADD(DAY, -30, GETDATE())
        AND r.Status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
        GROUP BY h.HotelName, h.id
        ORDER BY Profit DESC
      `);

    res.json(result.recordset);

  } catch (err) {
    console.error('Error fetching hotel performance:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get revenue forecast based on confirmed bookings
 */
router.get('/Forecast', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const pool = await getPool();

    const result = await pool.request()
      .input('days', parseInt(days))
      .query(`
        SELECT 
          CONVERT(DATE, CheckIn) as Date,
          COUNT(*) as BookingCount,
          SUM(TotalPrice) as ExpectedRevenue,
          SUM(TotalPrice - ISNULL(SupplierPrice, 0)) as ExpectedProfit
        FROM Med_Reservations
        WHERE CheckIn BETWEEN GETDATE() AND DATEADD(DAY, @days, GETDATE())
        AND Status IN ('CONFIRMED', 'CHECKED_IN')
        GROUP BY CONVERT(DATE, CheckIn)
        ORDER BY Date
      `);

    const summary = await pool.request()
      .input('days', parseInt(days))
      .query(`
        SELECT 
          SUM(TotalPrice) as TotalExpectedRevenue,
          SUM(TotalPrice - ISNULL(SupplierPrice, 0)) as TotalExpectedProfit,
          COUNT(*) as TotalBookings
        FROM Med_Reservations
        WHERE CheckIn BETWEEN GETDATE() AND DATEADD(DAY, @days, GETDATE())
        AND Status IN ('CONFIRMED', 'CHECKED_IN')
      `);

    res.json({
      summary: summary.recordset[0],
      daily: result.recordset
    });

  } catch (err) {
    console.error('Error fetching forecast:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get worker status and activity
 */
router.get('/WorkerStatus', async (req, res) => {
  try {
    const pool = await getPool();

    // Get last activity logs
    const buyRoomActivity = await pool.request().query(`
      SELECT TOP 1 CreatedAt, Details
      FROM MED_ReservationLogs
      WHERE Action = 'ROOM_PURCHASED'
      ORDER BY CreatedAt DESC
    `);

    const cancelActivity = await pool.request().query(`
      SELECT TOP 1 CreatedAt, Details
      FROM MED_OpportunityLogs
      WHERE Action = 'AUTO_CANCELLED'
      ORDER BY CreatedAt DESC
    `);

    const priceUpdateActivity = await pool.request().query(`
      SELECT TOP 1 LastPriceSync
      FROM Med_Hotels
      WHERE LastPriceSync IS NOT NULL
      ORDER BY LastPriceSync DESC
    `);

    res.json({
      buyroom: {
        enabled: process.env.BUYROOM_WORKER_ENABLED === 'true',
        lastActivity: buyRoomActivity.recordset[0]?.CreatedAt || null,
        status: buyRoomActivity.recordset[0] ? 'active' : 'idle'
      },
      cancellation: {
        enabled: process.env.AUTO_CANCEL_WORKER_ENABLED === 'true',
        lastActivity: cancelActivity.recordset[0]?.CreatedAt || null,
        status: cancelActivity.recordset[0] ? 'active' : 'idle'
      },
      priceUpdate: {
        enabled: process.env.PRICE_UPDATE_WORKER_ENABLED === 'true',
        lastActivity: priceUpdateActivity.recordset[0]?.LastPriceSync || null,
        status: priceUpdateActivity.recordset[0] ? 'active' : 'idle'
      }
    });

  } catch (err) {
    console.error('Error fetching worker status:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
