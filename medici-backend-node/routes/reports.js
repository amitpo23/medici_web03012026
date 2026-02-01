/**
 * Reports Routes - Profit/Loss, Margin Tracking, Business Analytics
 * Uses MED_Book (purchases) + Med_Reservation (sales) for P&L calculations
 */

const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { getPool } = require('../config/database');

/**
 * Get profit/loss summary
 * Joins bookings (cost) with reservations (revenue) via SoldId
 */
router.get('/ProfitLoss', async (req, res) => {
  try {
    const { startDate, endDate, hotelId } = req.query;
    const pool = await getPool();

    let query = `
      SELECT
        COUNT(DISTINCT b.id) as TotalBookings,
        COUNT(DISTINCT CASE WHEN b.IsSold = 1 THEN b.id END) as SoldBookings,
        SUM(b.price) as TotalCost,
        SUM(CASE WHEN b.IsSold = 1 AND r.Id IS NOT NULL THEN r.AmountAfterTax ELSE 0 END) as TotalRevenue,
        SUM(CASE WHEN b.IsSold = 1 AND r.Id IS NOT NULL THEN (r.AmountAfterTax - b.price) ELSE 0 END) as GrossProfit,
        AVG(CASE WHEN b.IsSold = 1 AND r.Id IS NOT NULL AND r.AmountAfterTax > 0
          THEN ((r.AmountAfterTax - b.price) / r.AmountAfterTax * 100) END) as AvgMarginPercent,
        MIN(b.startDate) as FirstCheckIn,
        MAX(b.endDate) as LastCheckOut
      FROM MED_Book b
      LEFT JOIN Med_Reservation r ON b.SoldId = r.Id
      WHERE b.IsActive = 1 OR b.IsSold = 1
    `;

    const request = pool.request();

    if (startDate) {
      query += ' AND b.startDate >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND b.endDate <= @endDate';
      request.input('endDate', endDate);
    }

    if (hotelId) {
      query += ' AND b.HotelId = @hotelId';
      request.input('hotelId', hotelId);
    }

    const result = await request.query(query);
    res.json(result.recordset[0]);

  } catch (err) {
    logger.error('Error fetching profit/loss', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get detailed margin report by hotel
 */
router.get('/MarginByHotel', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const pool = await getPool();

    let query = `
      SELECT
        h.name as HotelName,
        h.HotelId,
        COUNT(b.id) as BookingCount,
        SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as SoldCount,
        SUM(b.price) as TotalCost,
        SUM(ISNULL(b.lastPrice, 0)) as TotalPushPrice,
        SUM(ISNULL(b.lastPrice, 0) - b.price) as ExpectedProfit,
        AVG(CASE WHEN b.lastPrice > 0 THEN ((b.lastPrice - b.price) / b.lastPrice * 100) END) as MarginPercent
      FROM MED_Book b
      INNER JOIN Med_Hotels h ON b.HotelId = h.HotelId
      WHERE b.price > 0
    `;

    const request = pool.request();

    if (startDate) {
      query += ' AND b.startDate >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND b.endDate <= @endDate';
      request.input('endDate', endDate);
    }

    query += `
      GROUP BY h.name, h.HotelId
      ORDER BY ExpectedProfit DESC
    `;

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (err) {
    logger.error('Error fetching margin by hotel', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get margin report by date
 */
router.get('/MarginByDate', async (req, res) => {
  try {
    const { startDate, endDate, hotelId } = req.query;
    const pool = await getPool();

    let query = `
      SELECT
        CONVERT(DATE, b.startDate) as BookingDate,
        COUNT(b.id) as BookingCount,
        SUM(b.price) as TotalCost,
        SUM(ISNULL(b.lastPrice, 0)) as TotalPushPrice,
        SUM(ISNULL(b.lastPrice, 0) - b.price) as ExpectedProfit,
        AVG(CASE WHEN b.lastPrice > 0 THEN ((b.lastPrice - b.price) / b.lastPrice * 100) END) as MarginPercent
      FROM MED_Book b
      WHERE b.price > 0
    `;

    const request = pool.request();

    if (startDate) {
      query += ' AND b.startDate >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND b.endDate <= @endDate';
      request.input('endDate', endDate);
    }

    if (hotelId) {
      query += ' AND b.HotelId = @hotelId';
      request.input('hotelId', hotelId);
    }

    query += `
      GROUP BY CONVERT(DATE, b.startDate)
      ORDER BY BookingDate DESC
    `;

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (err) {
    logger.error('Error fetching margin by date', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get opportunities performance
 * Uses the actual MED_ֹOֹֹpportunities table (has Hebrew diacriticals)
 */
router.get('/OpportunitiesPerformance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const pool = await getPool();

    // Use MED_Book to get opportunity performance since table name has special chars
    let query = `
      SELECT
        CASE
          WHEN b.IsSold = 1 THEN 'SOLD'
          WHEN b.IsActive = 0 THEN 'CANCELLED'
          ELSE 'ACTIVE'
        END as Status,
        COUNT(b.id) as Count,
        SUM(b.price) as TotalCost,
        SUM(ISNULL(b.lastPrice, 0)) as TotalPushPrice,
        SUM(ISNULL(b.lastPrice, 0) - b.price) as TotalProfit
      FROM MED_Book b
      WHERE b.price > 0
    `;

    const request = pool.request();

    if (startDate) {
      query += ' AND b.startDate >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND b.endDate <= @endDate';
      request.input('endDate', endDate);
    }

    query += `
      GROUP BY CASE
        WHEN b.IsSold = 1 THEN 'SOLD'
        WHEN b.IsActive = 0 THEN 'CANCELLED'
        ELSE 'ACTIVE'
      END
      ORDER BY Count DESC
    `;

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (err) {
    logger.error('Error fetching opportunities performance', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get top performing hotels
 */
router.get('/TopHotels', async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;
    const pool = await getPool();

    let query = `
      SELECT TOP (@limit)
        h.name as HotelName,
        h.HotelId,
        COUNT(b.id) as BookingCount,
        SUM(b.price) as TotalCost,
        SUM(ISNULL(b.lastPrice, 0)) as TotalPushPrice,
        SUM(ISNULL(b.lastPrice, 0) - b.price) as Profit,
        AVG(CASE WHEN b.lastPrice > 0 THEN ((b.lastPrice - b.price) / b.lastPrice * 100) END) as MarginPercent
      FROM MED_Book b
      INNER JOIN Med_Hotels h ON b.HotelId = h.HotelId
      WHERE b.price > 0
    `;

    const request = pool.request().input('limit', parseInt(limit));

    if (startDate) {
      query += ' AND b.startDate >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND b.endDate <= @endDate';
      request.input('endDate', endDate);
    }

    query += `
      GROUP BY h.name, h.HotelId
      ORDER BY Profit DESC
    `;

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (err) {
    logger.error('Error fetching top hotels', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get loss report (cancelled bookings)
 */
router.get('/LossReport', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const pool = await getPool();

    let query = `
      SELECT
        'CANCELLED_BOOKING' as LossType,
        COUNT(c.id) as Count,
        SUM(b.price) as EstimatedLoss
      FROM MED_CancelBook c
      LEFT JOIN MED_Book b ON c.contentBookingID = b.contentBookingID
      WHERE 1=1
    `;

    const request = pool.request();

    if (startDate) {
      query += ' AND c.DateInsert >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND c.DateInsert <= @endDate';
      request.input('endDate', endDate);
    }

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (err) {
    logger.error('Error fetching loss report', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
