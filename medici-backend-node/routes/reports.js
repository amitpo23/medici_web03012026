/**
 * Reports Routes - Profit/Loss, Margin Tracking, Business Analytics
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

/**
 * Get profit/loss summary
 * Returns revenue, costs, margins for specified period
 */
router.get('/ProfitLoss', async (req, res) => {
  try {
    const { startDate, endDate, hotelId } = req.query;
    const pool = await getPool();

    let query = `
      SELECT 
        COUNT(DISTINCT r.Id) as TotalReservations,
        SUM(r.TotalPrice) as TotalRevenue,
        SUM(r.SupplierPrice) as TotalCost,
        SUM(r.TotalPrice - ISNULL(r.SupplierPrice, 0)) as GrossProfit,
        AVG((r.TotalPrice - ISNULL(r.SupplierPrice, 0)) / NULLIF(r.TotalPrice, 0) * 100) as AvgMarginPercent,
        MIN(r.CheckIn) as FirstCheckIn,
        MAX(r.CheckOut) as LastCheckOut
      FROM Med_Reservations r
      WHERE r.Status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
    `;

    const request = pool.request();

    if (startDate) {
      query += ' AND r.CheckIn >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND r.CheckOut <= @endDate';
      request.input('endDate', endDate);
    }

    if (hotelId) {
      query += ' AND r.HotelId = @hotelId';
      request.input('hotelId', hotelId);
    }

    const result = await request.query(query);
    res.json(result.recordset[0]);

  } catch (err) {
    console.error('Error fetching profit/loss:', err);
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
        h.HotelName,
        h.id as HotelId,
        COUNT(r.Id) as BookingCount,
        SUM(r.TotalPrice) as Revenue,
        SUM(ISNULL(r.SupplierPrice, 0)) as Cost,
        SUM(r.TotalPrice - ISNULL(r.SupplierPrice, 0)) as Profit,
        AVG((r.TotalPrice - ISNULL(r.SupplierPrice, 0)) / NULLIF(r.TotalPrice, 0) * 100) as MarginPercent
      FROM Med_Reservations r
      INNER JOIN Med_Hotels h ON r.HotelId = h.id
      WHERE r.Status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
    `;

    const request = pool.request();

    if (startDate) {
      query += ' AND r.CheckIn >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND r.CheckOut <= @endDate';
      request.input('endDate', endDate);
    }

    query += `
      GROUP BY h.HotelName, h.id
      ORDER BY Profit DESC
    `;

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (err) {
    console.error('Error fetching margin by hotel:', err);
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
        CONVERT(DATE, r.CheckIn) as ReservationDate,
        COUNT(r.Id) as BookingCount,
        SUM(r.TotalPrice) as Revenue,
        SUM(ISNULL(r.SupplierPrice, 0)) as Cost,
        SUM(r.TotalPrice - ISNULL(r.SupplierPrice, 0)) as Profit,
        AVG((r.TotalPrice - ISNULL(r.SupplierPrice, 0)) / NULLIF(r.TotalPrice, 0) * 100) as MarginPercent
      FROM Med_Reservations r
      WHERE r.Status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
    `;

    const request = pool.request();

    if (startDate) {
      query += ' AND r.CheckIn >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND r.CheckOut <= @endDate';
      request.input('endDate', endDate);
    }

    if (hotelId) {
      query += ' AND r.HotelId = @hotelId';
      request.input('hotelId', hotelId);
    }

    query += `
      GROUP BY CONVERT(DATE, r.CheckIn)
      ORDER BY ReservationDate DESC
    `;

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (err) {
    console.error('Error fetching margin by date:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get opportunities performance
 */
router.get('/OpportunitiesPerformance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const pool = await getPool();

    let query = `
      SELECT 
        o.Status,
        COUNT(o.Id) as Count,
        SUM(o.MaxRooms) as TotalRooms,
        AVG(DATEDIFF(DAY, o.DateInsert, ISNULL(o.SoldAt, GETDATE()))) as AvgDaysToSell,
        SUM(CASE WHEN r.Id IS NOT NULL THEN 1 ELSE 0 END) as SoldCount,
        SUM(CASE WHEN r.Id IS NOT NULL THEN (r.TotalPrice - o.BuyPrice) ELSE 0 END) as TotalProfit
      FROM MED_Opportunities o
      LEFT JOIN Med_Reservations r ON o.Id = r.OpportunityId
      WHERE 1=1
    `;

    const request = pool.request();

    if (startDate) {
      query += ' AND o.DateFrom >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND o.DateTo <= @endDate';
      request.input('endDate', endDate);
    }

    query += `
      GROUP BY o.Status
      ORDER BY Count DESC
    `;

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (err) {
    console.error('Error fetching opportunities performance:', err);
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
        h.HotelName,
        h.id as HotelId,
        COUNT(r.Id) as BookingCount,
        SUM(r.TotalPrice) as Revenue,
        SUM(r.TotalPrice - ISNULL(r.SupplierPrice, 0)) as Profit,
        AVG((r.TotalPrice - ISNULL(r.SupplierPrice, 0)) / NULLIF(r.TotalPrice, 0) * 100) as MarginPercent
      FROM Med_Reservations r
      INNER JOIN Med_Hotels h ON r.HotelId = h.id
      WHERE r.Status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
    `;

    const request = pool.request().input('limit', parseInt(limit));

    if (startDate) {
      query += ' AND r.CheckIn >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND r.CheckOut <= @endDate';
      request.input('endDate', endDate);
    }

    query += `
      GROUP BY h.HotelName, h.id
      ORDER BY Profit DESC
    `;

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (err) {
    console.error('Error fetching top hotels:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * Get loss report (failed opportunities, cancellations)
 */
router.get('/LossReport', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const pool = await getPool();

    let query = `
      SELECT 
        'CANCELLED_OPPORTUNITY' as LossType,
        COUNT(o.Id) as Count,
        SUM(o.BuyPrice) as EstimatedLoss,
        AVG(DATEDIFF(DAY, o.DateInsert, o.CancelledAt)) as AvgDaysBeforeCancel
      FROM MED_Opportunities o
      WHERE o.Status = 'CANCELLED'
    `;

    const request = pool.request();

    if (startDate) {
      query += ' AND o.DateFrom >= @startDate';
      request.input('startDate', startDate);
    }

    if (endDate) {
      query += ' AND o.DateTo <= @endDate';
      request.input('endDate', endDate);
    }

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (err) {
    console.error('Error fetching loss report:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
