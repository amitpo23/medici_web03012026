/**
 * Opportunity Finder API Routes
 *
 * Combines BACKWARD historical analysis with FORWARD live search
 * to identify profitable trading opportunities.
 */

const express = require('express');
const router = express.Router();
const opportunityFinder = require('../services/opportunity-finder-service');
const logger = require('../config/logger');

/**
 * POST /opportunity-finder/find
 * Find opportunities in a specific city
 *
 * Body: {
 *   city: "Paris",
 *   dateFrom: "2026-03-01",
 *   dateTo: "2026-03-03",
 *   minMargin: 10,
 *   maxRisk: 60,
 *   stars: 4,
 *   limit: 20
 * }
 */
router.post('/find', async (req, res) => {
  try {
    const {
      city,
      dateFrom,
      dateTo,
      minMargin = 10,
      maxRisk = 60,
      stars = null,
      limit = 20
    } = req.body;

    if (!city || !dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        error: 'city, dateFrom, and dateTo are required'
      });
    }

    logger.info(`[OpportunityFinder] Searching for opportunities in ${city} (${dateFrom} - ${dateTo})`);

    const result = await opportunityFinder.findOpportunities({
      city,
      dateFrom,
      dateTo,
      minMargin,
      maxRisk,
      stars,
      limit
    });

    res.json(result);

  } catch (error) {
    logger.error('[OpportunityFinder] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find opportunities',
      details: error.message
    });
  }
});

/**
 * POST /opportunity-finder/scan
 * Scan multiple cities for opportunities
 *
 * Body: {
 *   cities: ["Paris", "London", "Rome"],
 *   dateFrom: "2026-03-01",
 *   dateTo: "2026-03-03",
 *   minMargin: 10,
 *   maxRisk: 60,
 *   limitPerCity: 10
 * }
 */
router.post('/scan', async (req, res) => {
  try {
    const {
      cities,
      dateFrom,
      dateTo,
      minMargin = 10,
      maxRisk = 60,
      limitPerCity = 10
    } = req.body;

    if (!cities || !Array.isArray(cities) || cities.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'cities array is required'
      });
    }

    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        error: 'dateFrom and dateTo are required'
      });
    }

    logger.info(`[OpportunityFinder] Scanning ${cities.length} cities for opportunities`);

    const result = await opportunityFinder.scanAllCities({
      cities,
      dateFrom,
      dateTo,
      minMargin,
      maxRisk,
      limitPerCity
    });

    res.json(result);

  } catch (error) {
    logger.error('[OpportunityFinder] Scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan cities',
      details: error.message
    });
  }
});

/**
 * GET /opportunity-finder/top-cities
 * Get top performing cities to scan
 */
router.get('/top-cities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const cities = await opportunityFinder.getTopCitiesToScan(limit);

    res.json({
      success: true,
      count: cities.length,
      cities
    });

  } catch (error) {
    logger.error('[OpportunityFinder] Top cities error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get top cities',
      details: error.message
    });
  }
});

/**
 * POST /opportunity-finder/auto-scan
 * Automatically scan top cities for opportunities
 *
 * Body: {
 *   dateFrom: "2026-03-01",
 *   dateTo: "2026-03-03",
 *   minMargin: 10,
 *   maxRisk: 60,
 *   topCities: 5,
 *   limitPerCity: 10
 * }
 */
router.post('/auto-scan', async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      minMargin = 10,
      maxRisk = 60,
      topCities = 5,
      limitPerCity = 10
    } = req.body;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({
        success: false,
        error: 'dateFrom and dateTo are required'
      });
    }

    // Get top performing cities
    const cityData = await opportunityFinder.getTopCitiesToScan(topCities);
    const cities = cityData.map(c => c.city);

    logger.info(`[OpportunityFinder] Auto-scanning top ${cities.length} cities: ${cities.join(', ')}`);

    // Scan those cities
    const result = await opportunityFinder.scanAllCities({
      cities,
      dateFrom,
      dateTo,
      minMargin,
      maxRisk,
      limitPerCity
    });

    res.json({
      ...result,
      cityPerformance: cityData
    });

  } catch (error) {
    logger.error('[OpportunityFinder] Auto-scan error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-scan',
      details: error.message
    });
  }
});

/**
 * POST /opportunity-finder/analyze-hotel
 * Deep analysis of a specific hotel
 *
 * Body: {
 *   hotelId: 12345,
 *   dateFrom: "2026-03-01",
 *   dateTo: "2026-03-03"
 * }
 */
router.post('/analyze-hotel', async (req, res) => {
  try {
    const { hotelId, dateFrom, dateTo } = req.body;

    if (!hotelId) {
      return res.status(400).json({
        success: false,
        error: 'hotelId is required'
      });
    }

    // Use dates or default to next 30 days
    const today = new Date();
    const defaultDateFrom = dateFrom || today.toISOString().split('T')[0];
    const defaultDateTo = dateTo || new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get hotel info
    const { getPool } = require('../config/database');
    const sql = require('mssql');
    const pool = await getPool();

    const hotelInfo = await pool.request()
      .input('hotelId', sql.Int, hotelId)
      .query(`
        SELECT HotelId, Name, City, Stars, InnstantId
        FROM Med_Hotels
        WHERE HotelId = @hotelId
      `);

    if (!hotelInfo.recordset || hotelInfo.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Hotel not found'
      });
    }

    const hotel = hotelInfo.recordset[0];

    // Get live price
    const livePrice = await opportunityFinder.getLivePrice(hotelId, defaultDateFrom, defaultDateTo);

    // Get ML analysis
    const mlService = require('../services/ml-prediction-service');
    const [successPrediction, riskAssessment, hotelAnalysis] = await Promise.all([
      mlService.calculateSuccessProbability(hotelId, hotel.City, livePrice?.price || 100, 30),
      mlService.assessRisk(hotelId, hotel.City, livePrice?.price || 100, 30, 15),
      mlService.getHotelAnalysis(hotelId)
    ]);

    // Analyze opportunity if we have live price
    let opportunityAnalysis = null;
    if (livePrice) {
      opportunityAnalysis = await opportunityFinder.analyzeOpportunity(
        pool,
        hotel,
        livePrice,
        defaultDateFrom,
        defaultDateTo
      );
    }

    res.json({
      success: true,
      hotel: {
        id: hotel.HotelId,
        name: hotel.Name,
        city: hotel.City,
        stars: hotel.Stars
      },
      dateRange: { from: defaultDateFrom, to: defaultDateTo },
      livePrice: livePrice || { available: false },
      opportunity: opportunityAnalysis,
      mlPrediction: {
        successProbability: successPrediction.successProbability,
        riskLevel: riskAssessment.riskLevel,
        riskScore: riskAssessment.riskScore
      },
      historicalAnalysis: hotelAnalysis
    });

  } catch (error) {
    logger.error('[OpportunityFinder] Analyze hotel error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze hotel',
      details: error.message
    });
  }
});

module.exports = router;
