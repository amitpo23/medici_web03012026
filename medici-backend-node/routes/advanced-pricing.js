/**
 * Advanced Pricing Routes (Week 5)
 * 
 * ML-powered pricing, competitor tracking, elasticity analysis, and revenue optimization
 */

const express = require('express');
const router = express.Router();
const { getMLPricingService } = require('../services/ml-pricing-service');
const { getCompetitorTrackingService } = require('../services/competitor-tracking-service');
const { getPriceElasticityService } = require('../services/price-elasticity-service');
const { getRevenueMaximizationService } = require('../services/revenue-maximization-service');
const { verifyToken: authenticateRequest } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * POST /pricing/v2/ml-predict
 * ML-based price prediction
 */
router.post('/v2/ml-predict', authenticateRequest, async (req, res) => {
  try {
    const { hotelId, checkIn, checkOut, buyPrice, roomType, leadTimeDays, currentDemand } = req.body;

    if (!hotelId || !checkIn || !checkOut || !buyPrice) {
      return res.status(400).json({
        error: 'Missing required fields: hotelId, checkIn, checkOut, buyPrice'
      });
    }

    const mlPricing = getMLPricingService();
    const result = await mlPricing.predictOptimalPrice({
      hotelId,
      checkIn,
      checkOut,
      buyPrice,
      roomType,
      leadTimeDays,
      currentDemand
    });

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] ML prediction error', { error: error.message });
    res.status(500).json({
      error: 'Failed to predict price',
      message: error.message
    });
  }
});

/**
 * POST /pricing/v2/ml-batch
 * Batch ML predictions
 */
router.post('/v2/ml-batch', authenticateRequest, async (req, res) => {
  try {
    const { opportunities } = req.body;

    if (!Array.isArray(opportunities) || opportunities.length === 0) {
      return res.status(400).json({
        error: 'opportunities must be a non-empty array'
      });
    }

    const mlPricing = getMLPricingService();
    const result = await mlPricing.batchPredict(opportunities);

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] Batch prediction error', { error: error.message });
    res.status(500).json({
      error: 'Failed to batch predict',
      message: error.message
    });
  }
});

/**
 * GET /pricing/v2/elasticity/:hotelId
 * Calculate price elasticity
 */
router.get('/v2/elasticity/:hotelId', authenticateRequest, async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { timeframe, minDataPoints } = req.query;

    const elasticity = getPriceElasticityService();
    const result = await elasticity.calculateElasticity(parseInt(hotelId), {
      timeframe: timeframe ? parseInt(timeframe) : undefined,
      minDataPoints: minDataPoints ? parseInt(minDataPoints) : undefined
    });

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] Elasticity error', { error: error.message });
    res.status(500).json({
      error: 'Failed to calculate elasticity',
      message: error.message
    });
  }
});

/**
 * POST /pricing/v2/elasticity/recommend
 * Elasticity-based price recommendation
 */
router.post('/v2/elasticity/recommend', authenticateRequest, async (req, res) => {
  try {
    const { hotelId, currentPrice, targetMetric } = req.body;

    if (!hotelId || !currentPrice) {
      return res.status(400).json({
        error: 'Missing required fields: hotelId, currentPrice'
      });
    }

    const elasticity = getPriceElasticityService();
    const result = await elasticity.recommendElasticityBasedPrice(
      hotelId,
      currentPrice,
      targetMetric || 'revenue'
    );

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] Elasticity recommendation error', { error: error.message });
    res.status(500).json({
      error: 'Failed to generate recommendation',
      message: error.message
    });
  }
});

/**
 * GET /pricing/v2/elasticity/:hotelId/segments
 * Segment elasticity analysis
 */
router.get('/v2/elasticity/:hotelId/segments', authenticateRequest, async (req, res) => {
  try {
    const { hotelId } = req.params;

    const elasticity = getPriceElasticityService();
    const result = await elasticity.analyzeSegmentElasticity(parseInt(hotelId));

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] Segment elasticity error', { error: error.message });
    res.status(500).json({
      error: 'Failed to analyze segments',
      message: error.message
    });
  }
});

/**
 * GET /pricing/v2/competitor/:hotelId/changes
 * Track competitor pricing changes
 */
router.get('/v2/competitor/:hotelId/changes', authenticateRequest, async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { daysBack } = req.query;

    const competitorTracking = getCompetitorTrackingService();
    const result = await competitorTracking.trackCompetitorChanges(
      parseInt(hotelId),
      daysBack ? parseInt(daysBack) : undefined
    );

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] Competitor changes error', { error: error.message });
    res.status(500).json({
      error: 'Failed to track competitor changes',
      message: error.message
    });
  }
});

/**
 * POST /pricing/v2/competitor/position
 * Analyze competitive position
 */
router.post('/v2/competitor/position', authenticateRequest, async (req, res) => {
  try {
    const { hotelId, ourPrice } = req.body;

    if (!hotelId || !ourPrice) {
      return res.status(400).json({
        error: 'Missing required fields: hotelId, ourPrice'
      });
    }

    const competitorTracking = getCompetitorTrackingService();
    const result = await competitorTracking.analyzeCompetitivePosition(hotelId, ourPrice);

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] Competitive position error', { error: error.message });
    res.status(500).json({
      error: 'Failed to analyze position',
      message: error.message
    });
  }
});

/**
 * POST /pricing/v2/competitor/response-strategy
 * Recommend response to competitor action
 */
router.post('/v2/competitor/response-strategy', authenticateRequest, async (req, res) => {
  try {
    const { hotelId, competitorChange } = req.body;

    if (!hotelId || !competitorChange) {
      return res.status(400).json({
        error: 'Missing required fields: hotelId, competitorChange'
      });
    }

    const competitorTracking = getCompetitorTrackingService();
    const result = await competitorTracking.recommendResponseStrategy(hotelId, competitorChange);

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] Response strategy error', { error: error.message });
    res.status(500).json({
      error: 'Failed to recommend strategy',
      message: error.message
    });
  }
});

/**
 * GET /pricing/v2/competitor/:hotelId/new
 * Detect new competitors
 */
router.get('/v2/competitor/:hotelId/new', authenticateRequest, async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { daysBack } = req.query;

    const competitorTracking = getCompetitorTrackingService();
    const result = await competitorTracking.detectNewCompetitors(
      parseInt(hotelId),
      daysBack ? parseInt(daysBack) : undefined
    );

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] New competitors error', { error: error.message });
    res.status(500).json({
      error: 'Failed to detect new competitors',
      message: error.message
    });
  }
});

/**
 * GET /pricing/v2/competitor/:hotelId/market-share
 * Calculate market share trends
 */
router.get('/v2/competitor/:hotelId/market-share', authenticateRequest, async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { weeks } = req.query;

    const competitorTracking = getCompetitorTrackingService();
    const result = await competitorTracking.calculateMarketShareTrends(
      parseInt(hotelId),
      weeks ? parseInt(weeks) : undefined
    );

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] Market share error', { error: error.message });
    res.status(500).json({
      error: 'Failed to calculate market share',
      message: error.message
    });
  }
});

/**
 * POST /pricing/v2/revenue/maximize
 * Calculate revenue-maximizing price
 */
router.post('/v2/revenue/maximize', authenticateRequest, async (req, res) => {
  try {
    const { hotelId, checkIn, checkOut, buyPrice, availableInventory, currentDemand, competitorPrices } = req.body;

    if (!hotelId || !checkIn || !checkOut || !buyPrice) {
      return res.status(400).json({
        error: 'Missing required fields: hotelId, checkIn, checkOut, buyPrice'
      });
    }

    const revMax = getRevenueMaximizationService();
    const result = await revMax.maximizeRevenue({
      hotelId,
      checkIn,
      checkOut,
      buyPrice,
      availableInventory,
      currentDemand,
      competitorPrices
    });

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] Revenue maximization error', { error: error.message });
    res.status(500).json({
      error: 'Failed to maximize revenue',
      message: error.message
    });
  }
});

/**
 * POST /pricing/v2/revenue/optimize-portfolio
 * Optimize opportunity portfolio
 */
router.post('/v2/revenue/optimize-portfolio', authenticateRequest, async (req, res) => {
  try {
    const { opportunities, constraints } = req.body;

    if (!Array.isArray(opportunities) || opportunities.length === 0) {
      return res.status(400).json({
        error: 'opportunities must be a non-empty array'
      });
    }

    const revMax = getRevenueMaximizationService();
    const result = await revMax.optimizePortfolio(opportunities, constraints || {});

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] Portfolio optimization error', { error: error.message });
    res.status(500).json({
      error: 'Failed to optimize portfolio',
      message: error.message
    });
  }
});

/**
 * GET /pricing/v2/revenue/:hotelId/yield-management
 * Yield management analysis
 */
router.get('/v2/revenue/:hotelId/yield-management', authenticateRequest, async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { timeHorizon } = req.query;

    const revMax = getRevenueMaximizationService();
    const result = await revMax.implementYieldManagement(
      parseInt(hotelId),
      timeHorizon ? parseInt(timeHorizon) : undefined
    );

    res.json(result);

  } catch (error) {
    logger.error('[Pricing v2] Yield management error', { error: error.message });
    res.status(500).json({
      error: 'Failed to implement yield management',
      message: error.message
    });
  }
});

module.exports = router;
