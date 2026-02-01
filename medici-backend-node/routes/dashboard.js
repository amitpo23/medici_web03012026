/**
 * Enhanced Dashboard API - Advanced KPIs and Metrics
 * Uses actual DB schema: MED_Book, Med_Hotels, Med_Reservation
 */

const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { getPool } = require('../config/database');

/**
 * Get comprehensive dashboard statistics
 */
router.get('/Stats', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const pool = await getPool();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Booking statistics from MED_Book
    const bookStats = await pool.request()
      .input('startDate', startDate)
      .query(`
        SELECT
          COUNT(b.id) as TotalBookings,
          SUM(b.price) as TotalCost,
          SUM(ISNULL(b.lastPrice, 0)) as TotalPushPrice,
          SUM(ISNULL(b.lastPrice, 0) - b.price) as TotalExpectedProfit,
          AVG(CASE WHEN b.lastPrice > 0 THEN ((b.lastPrice - b.price) / b.lastPrice * 100) END) as AvgMargin,
          AVG(b.price) as AvgBookingCost,
          SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as SoldCount,
          SUM(CASE WHEN b.IsActive = 1 AND b.IsSold = 0 THEN 1 ELSE 0 END) as ActiveCount,
          SUM(CASE WHEN b.IsActive = 0 AND b.IsSold = 0 THEN 1 ELSE 0 END) as CancelledCount
        FROM MED_Book b
        WHERE b.DateInsert >= @startDate
        AND b.price > 0
      `);

    // Reservation (sales) statistics from Med_Reservation
    const resStats = await pool.request()
      .input('startDate', startDate)
      .query(`
        SELECT
          COUNT(r.Id) as TotalReservations,
          SUM(r.AmountAfterTax) as TotalRevenue,
          SUM(CASE WHEN r.IsCanceled = 1 THEN 1 ELSE 0 END) as CancelledReservations
        FROM Med_Reservation r
        WHERE r.DateInsert >= @startDate
      `);

    // Conversion rate
    const totalBookings = bookStats.recordset[0].TotalBookings || 0;
    const soldCount = bookStats.recordset[0].SoldCount || 0;
    const conversionRate = totalBookings > 0
      ? (soldCount / totalBookings * 100).toFixed(2)
      : 0;

    // Daily trend from MED_Book
    const dailyTrend = await pool.request()
      .input('startDate', startDate)
      .query(`
        SELECT TOP 7
          CONVERT(DATE, b.DateInsert) as Date,
          COUNT(b.id) as Bookings,
          SUM(b.price) as Cost,
          SUM(ISNULL(b.lastPrice, 0)) as PushPrice
        FROM MED_Book b
        WHERE b.DateInsert >= @startDate
        AND b.price > 0
        GROUP BY CONVERT(DATE, b.DateInsert)
        ORDER BY Date DESC
      `);

    res.json({
      overview: {
        ...bookStats.recordset[0],
        ConversionRate: conversionRate
      },
      reservations: resStats.recordset[0],
      dailyTrend: dailyTrend.recordset.reverse()
    });

  } catch (err) {
    logger.error('Error fetching dashboard stats', { error: err.message });
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

    // Check for bookings nearing cancellation deadline
    const expiringBookings = await pool.request().query(`
      SELECT COUNT(*) as Count
      FROM MED_Book
      WHERE IsActive = 1
      AND IsSold = 0
      AND CancellationTo IS NOT NULL
      AND CancellationTo <= DATEADD(DAY, 2, GETDATE())
      AND CancellationTo >= GETDATE()
    `);

    if (expiringBookings.recordset[0].Count > 0) {
      alerts.push({
        type: 'warning',
        title: 'Expiring Bookings',
        message: `${expiringBookings.recordset[0].Count} bookings have cancellation deadline within 48 hours`,
        priority: 'high'
      });
    }

    // Check for unsold active bookings
    const unsoldActive = await pool.request().query(`
      SELECT COUNT(*) as Count
      FROM MED_Book
      WHERE IsActive = 1
      AND IsSold = 0
      AND startDate >= GETDATE()
    `);

    if (unsoldActive.recordset[0].Count > 0) {
      alerts.push({
        type: 'info',
        title: 'Unsold Inventory',
        message: `${unsoldActive.recordset[0].Count} active bookings waiting to be sold`,
        priority: 'medium'
      });
    }

    // Check for low margin bookings
    const lowMargin = await pool.request().query(`
      SELECT COUNT(*) as Count
      FROM MED_Book
      WHERE IsActive = 1
      AND lastPrice IS NOT NULL
      AND lastPrice > 0
      AND ((lastPrice - price) / lastPrice) < 0.10
      AND startDate >= GETDATE()
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
    logger.error('Error fetching alerts', { error: err.message });
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
          h.name as HotelName,
          h.HotelId,
          COUNT(b.id) as TotalBookings,
          SUM(b.price) as TotalCost,
          SUM(ISNULL(b.lastPrice, 0) - b.price) as Profit,
          AVG(CASE WHEN b.lastPrice > 0 THEN ((b.lastPrice - b.price) / b.lastPrice * 100) END) as MarginPercent,
          SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as SoldCount
        FROM MED_Book b
        INNER JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.DateInsert >= DATEADD(DAY, -30, GETDATE())
        AND b.price > 0
        GROUP BY h.name, h.HotelId
        ORDER BY Profit DESC
      `);

    res.json(result.recordset);

  } catch (err) {
    logger.error('Error fetching hotel performance', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get revenue forecast based on active bookings
 */
router.get('/Forecast', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const pool = await getPool();

    const result = await pool.request()
      .input('days', parseInt(days))
      .query(`
        SELECT
          CONVERT(DATE, b.startDate) as Date,
          COUNT(b.id) as BookingCount,
          SUM(ISNULL(b.lastPrice, b.price)) as ExpectedRevenue,
          SUM(ISNULL(b.lastPrice, 0) - b.price) as ExpectedProfit
        FROM MED_Book b
        WHERE b.startDate BETWEEN GETDATE() AND DATEADD(DAY, @days, GETDATE())
        AND b.IsActive = 1
        AND b.price > 0
        GROUP BY CONVERT(DATE, b.startDate)
        ORDER BY Date
      `);

    const summary = await pool.request()
      .input('days', parseInt(days))
      .query(`
        SELECT
          SUM(ISNULL(b.lastPrice, b.price)) as TotalExpectedRevenue,
          SUM(ISNULL(b.lastPrice, 0) - b.price) as TotalExpectedProfit,
          COUNT(b.id) as TotalBookings
        FROM MED_Book b
        WHERE b.startDate BETWEEN GETDATE() AND DATEADD(DAY, @days, GETDATE())
        AND b.IsActive = 1
        AND b.price > 0
      `);

    res.json({
      summary: summary.recordset[0],
      daily: result.recordset
    });

  } catch (err) {
    logger.error('Error fetching forecast', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get worker status and activity
 */
router.get('/WorkerStatus', (req, res) => {
  res.json({
    buyroom: {
      enabled: process.env.BUYROOM_WORKER_ENABLED === 'true',
      status: 'configured'
    },
    cancellation: {
      enabled: process.env.AUTO_CANCEL_WORKER_ENABLED === 'true',
      status: 'configured'
    },
    priceUpdate: {
      enabled: process.env.PRICE_UPDATE_WORKER_ENABLED === 'true',
      status: 'configured'
    }
  });
});

module.exports = router;
