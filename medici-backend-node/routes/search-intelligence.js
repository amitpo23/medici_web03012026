/**
 * Search Intelligence API
 * Provides analytics and insights based on AI_Search_HotelData table (8.3M search records)
 * Shows customer search intent, demand patterns, and pricing intelligence
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const logger = require('../config/logger');

/**
 * GET /search-intelligence/overview
 * Overall search statistics and recent activity
 */
router.get('/overview', async (req, res) => {
  try {
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT
        COUNT(*) as TotalSearches,
        COUNT(DISTINCT HotelId) as UniqueHotels,
        COUNT(DISTINCT CityName) as UniqueCities,
        MIN(UpdatedAt) as FirstSearchDate,
        MAX(UpdatedAt) as LastSearchDate,
        (SELECT COUNT(*) FROM AI_Search_HotelData 
         WHERE UpdatedAt >= DATEADD(day, -7, GETDATE())) as Last7Days,
        (SELECT COUNT(*) FROM AI_Search_HotelData 
         WHERE UpdatedAt >= DATEADD(day, -30, GETDATE())) as Last30Days,
        (SELECT COUNT(*) FROM AI_Search_HotelData 
         WHERE MONTH(UpdatedAt) = MONTH(GETDATE()) 
         AND YEAR(UpdatedAt) = YEAR(GETDATE())) as ThisMonth,
        (SELECT AVG(PriceAmount) FROM AI_Search_HotelData 
         WHERE PriceAmount > 0) as AvgSearchPrice
      FROM AI_Search_HotelData
    `);

    res.json({
      success: true,
      data: result.recordset[0],
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Search Intelligence overview error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /search-intelligence/cities
 * Top cities by search volume with geographic distribution
 */
router.get('/cities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT TOP ${limit}
        CityName,
        CountryCode,
        COUNT(*) as SearchCount,
        CAST(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM AI_Search_HotelData) as DECIMAL(5,2)) as Percentage,
        AVG(PriceAmount) as AvgPrice,
        MIN(PriceAmount) as MinPrice,
        MAX(PriceAmount) as MaxPrice,
        COUNT(DISTINCT HotelId) as UniqueHotels,
        MAX(UpdatedAt) as LastSearched
      FROM AI_Search_HotelData
      WHERE CityName IS NOT NULL
      GROUP BY CityName, CountryCode
      ORDER BY SearchCount DESC
    `);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Search Intelligence cities error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /search-intelligence/hotels
 * Top hotels by search volume - identifies high-demand properties
 */
router.get('/hotels', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const city = req.query.city;
    
    const pool = await getPool();
    
    let query = `
      SELECT TOP ${limit}
        HotelId,
        HotelName,
        CityName,
        CountryCode,
        COUNT(*) as SearchCount,
        CAST(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM AI_Search_HotelData) as DECIMAL(5,2)) as Percentage,
        AVG(PriceAmount) as AvgPrice,
        MIN(PriceAmount) as MinPrice,
        MAX(PriceAmount) as MaxPrice,
        AVG(CAST(Stars as FLOAT)) as AvgStars,
        MAX(UpdatedAt) as LastSearched
      FROM AI_Search_HotelData
      WHERE HotelName IS NOT NULL
    `;
    
    if (city) {
      query += ` AND CityName = '${city.replace(/'/g, "''")}'`;
    }
    
    query += `
      GROUP BY HotelId, HotelName, CityName, CountryCode
      ORDER BY SearchCount DESC
    `;
    
    const result = await pool.request().query(query);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length,
      filters: { city: city || null },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Search Intelligence hotels error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /search-intelligence/trends
 * Time-series search volume trends (daily/monthly)
 */
router.get('/trends', async (req, res) => {
  try {
    const granularity = req.query.granularity || 'monthly'; // daily, monthly, yearly
    const pool = await getPool();
    
    let dateFormat, groupBy;
    if (granularity === 'daily') {
      dateFormat = 'YYYY-MM-DD';
      groupBy = 'CAST(UpdatedAt AS DATE)';
    } else if (granularity === 'monthly') {
      dateFormat = 'YYYY-MM';
      groupBy = "FORMAT(UpdatedAt, 'yyyy-MM')";
    } else {
      dateFormat = 'YYYY';
      groupBy = 'YEAR(UpdatedAt)';
    }
    
    const result = await pool.request().query(`
      SELECT
        ${groupBy} as Period,
        COUNT(*) as SearchCount,
        COUNT(DISTINCT HotelId) as UniqueHotels,
        COUNT(DISTINCT CityName) as UniqueCities,
        AVG(PriceAmount) as AvgPrice
      FROM AI_Search_HotelData
      WHERE UpdatedAt >= DATEADD(month, -12, GETDATE())
      GROUP BY ${groupBy}
      ORDER BY Period ASC
    `);

    res.json({
      success: true,
      data: result.recordset,
      granularity,
      count: result.recordset.length,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Search Intelligence trends error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /search-intelligence/prices
 * Price distribution and intelligence across searches
 */
router.get('/prices', async (req, res) => {
  try {
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT
        PriceAmountCurrency as Currency,
        COUNT(*) as SearchCount,
        AVG(PriceAmount) as AvgPrice,
        MIN(PriceAmount) as MinPrice,
        MAX(PriceAmount) as MaxPrice,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY PriceAmount) OVER (PARTITION BY PriceAmountCurrency) as Q1,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY PriceAmount) OVER (PARTITION BY PriceAmountCurrency) as Median,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY PriceAmount) OVER (PARTITION BY PriceAmountCurrency) as Q3
      FROM AI_Search_HotelData
      WHERE PriceAmount > 0 AND PriceAmountCurrency IS NOT NULL
      GROUP BY PriceAmountCurrency
      ORDER BY SearchCount DESC
    `);

    res.json({
      success: true,
      data: result.recordset,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Search Intelligence prices error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /search-intelligence/seasonality
 * Booking window analysis: how far in advance are people searching?
 */
router.get('/seasonality', async (req, res) => {
  try {
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT
        DATEDIFF(day, UpdatedAt, StayFrom) as DaysBeforeStay,
        COUNT(*) as SearchCount,
        AVG(PriceAmount) as AvgPrice
      FROM AI_Search_HotelData
      WHERE StayFrom IS NOT NULL 
        AND UpdatedAt IS NOT NULL
        AND DATEDIFF(day, UpdatedAt, StayFrom) >= 0
        AND DATEDIFF(day, UpdatedAt, StayFrom) <= 365
      GROUP BY DATEDIFF(day, UpdatedAt, StayFrom)
      HAVING COUNT(*) > 100
      ORDER BY DaysBeforeStay ASC
    `);

    // Calculate month-of-year seasonality
    const seasonalResult = await pool.request().query(`
      SELECT
        MONTH(StayFrom) as Month,
        DATENAME(month, StayFrom) as MonthName,
        COUNT(*) as SearchCount,
        AVG(PriceAmount) as AvgPrice
      FROM AI_Search_HotelData
      WHERE StayFrom IS NOT NULL
      GROUP BY MONTH(StayFrom), DATENAME(month, StayFrom)
      ORDER BY Month ASC
    `);

    res.json({
      success: true,
      data: {
        bookingWindow: result.recordset,
        monthlySeasonality: seasonalResult.recordset
      },
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Search Intelligence seasonality error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /search-intelligence/demand-forecast
 * Predict future search demand based on historical patterns
 */
router.get('/demand-forecast', async (req, res) => {
  try {
    const city = req.query.city;
    const hotelId = req.query.hotelId;
    
    const pool = await getPool();
    
    // Get last 6 months trend
    let query = `
      SELECT
        FORMAT(UpdatedAt, 'yyyy-MM') as Month,
        COUNT(*) as SearchCount,
        AVG(PriceAmount) as AvgPrice
      FROM AI_Search_HotelData
      WHERE UpdatedAt >= DATEADD(month, -6, GETDATE())
    `;
    
    if (city) {
      query += ` AND CityName = '${city.replace(/'/g, "''")}'`;
    }
    if (hotelId) {
      query += ` AND HotelId = ${parseInt(hotelId)}`;
    }
    
    query += `
      GROUP BY FORMAT(UpdatedAt, 'yyyy-MM')
      ORDER BY Month ASC
    `;
    
    const result = await pool.request().query(query);
    
    // Simple linear trend calculation
    const data = result.recordset;
    if (data.length >= 3) {
      const counts = data.map(d => d.SearchCount);
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const lastMonth = counts[counts.length - 1];
      const prevMonth = counts[counts.length - 2];
      const trend = lastMonth - prevMonth;
      const trendPercent = ((trend / prevMonth) * 100).toFixed(1);
      
      res.json({
        success: true,
        data: {
          historical: data,
          forecast: {
            nextMonthPrediction: Math.round(lastMonth + trend),
            trend: trend > 0 ? 'increasing' : 'decreasing',
            trendPercent: `${trendPercent}%`,
            avgMonthlySearches: Math.round(avg)
          }
        },
        filters: { city: city || null, hotelId: hotelId || null },
        timestamp: new Date()
      });
    } else {
      res.json({
        success: true,
        data: { historical: data },
        message: 'Not enough data for forecast (minimum 3 months required)',
        timestamp: new Date()
      });
    }

  } catch (error) {
    logger.error('Search Intelligence demand forecast error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /search-intelligence/real-time
 * Recent searches in last 24 hours
 */
router.get('/real-time', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT TOP ${limit}
        HotelId,
        HotelName,
        CityName,
        CountryCode,
        StayFrom,
        StayTo,
        PriceAmount,
        PriceAmountCurrency,
        RoomType,
        Board,
        Stars,
        UpdatedAt
      FROM AI_Search_HotelData
      WHERE UpdatedAt >= DATEADD(hour, -24, GETDATE())
      ORDER BY UpdatedAt DESC
    `);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length,
      timeWindow: '24 hours',
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Search Intelligence real-time error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /search-intelligence/comparison
 * Compare search volume vs actual bookings for a hotel/city
 */
router.get('/comparison', async (req, res) => {
  try {
    const city = req.query.city;
    const hotelId = req.query.hotelId;
    
    if (!city && !hotelId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide either city or hotelId parameter'
      });
    }
    
    const pool = await getPool();
    
    // Search volume
    let searchQuery = `
      SELECT COUNT(*) as SearchCount
      FROM AI_Search_HotelData
      WHERE UpdatedAt >= DATEADD(month, -3, GETDATE())
    `;
    
    if (city) searchQuery += ` AND CityName = '${city.replace(/'/g, "''")}'`;
    if (hotelId) searchQuery += ` AND HotelId = ${parseInt(hotelId)}`;
    
    // Booking volume
    let bookingQuery = `
      SELECT COUNT(*) as BookingCount
      FROM MED_Book b
      LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
      WHERE b.DateInsert >= DATEADD(month, -3, GETDATE())
        AND b.IsActive = 1
    `;
    
    if (city) bookingQuery += ` AND h.cityName = '${city.replace(/'/g, "''")}'`;
    if (hotelId) bookingQuery += ` AND b.HotelId = ${parseInt(hotelId)}`;
    
    const [searchResult, bookingResult] = await Promise.all([
      pool.request().query(searchQuery),
      pool.request().query(bookingQuery)
    ]);
    
    const searchCount = searchResult.recordset[0].SearchCount;
    const bookingCount = bookingResult.recordset[0].BookingCount;
    const conversionRate = searchCount > 0 ? ((bookingCount / searchCount) * 100).toFixed(2) : 0;
    
    res.json({
      success: true,
      data: {
        searchCount,
        bookingCount,
        conversionRate: `${conversionRate}%`,
        searchToBookingRatio: searchCount > 0 ? (searchCount / bookingCount).toFixed(1) : 'N/A'
      },
      filters: { city: city || null, hotelId: hotelId || null },
      timeWindow: 'Last 3 months',
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Search Intelligence comparison error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
