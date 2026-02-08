/**
 * ML Predictions API Routes
 * Provides AI-powered predictions for hotel room trading
 */

const express = require('express');
const router = express.Router();
const mlService = require('../services/ml-prediction-service');
const logger = require('../config/logger');

/**
 * POST /ml/predict-success
 * Calculate success probability for a potential trade
 */
router.post('/predict-success', async (req, res) => {
  try {
    const { hotelId, city, price, daysBeforeArrival } = req.body;

    if (!hotelId || !city || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: hotelId, city, price'
      });
    }

    const prediction = await mlService.calculateSuccessProbability(
      parseInt(hotelId),
      city,
      parseFloat(price),
      parseInt(daysBeforeArrival) || 30
    );

    res.json({
      success: true,
      prediction
    });

    logger.info(`Success prediction for hotel ${hotelId}: ${prediction.successProbability}%`);
  } catch (error) {
    logger.error('Error in predict-success:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate prediction',
      details: error.message
    });
  }
});

/**
 * POST /ml/assess-risk
 * Assess risk level for a trade opportunity
 */
router.post('/assess-risk', async (req, res) => {
  try {
    const { hotelId, city, price, daysBeforeArrival, targetMargin } = req.body;

    if (!hotelId || !city) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: hotelId, city'
      });
    }

    const riskAssessment = await mlService.assessRisk(
      parseInt(hotelId),
      city,
      parseFloat(price) || 100,
      parseInt(daysBeforeArrival) || 30,
      parseFloat(targetMargin) || 15
    );

    res.json({
      success: true,
      risk: riskAssessment
    });

    logger.info(`Risk assessment for hotel ${hotelId}: ${riskAssessment.riskLevel}`);
  } catch (error) {
    logger.error('Error in assess-risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assess risk',
      details: error.message
    });
  }
});

/**
 * GET /ml/price-trend/:hotelId
 * Get price trend analysis based on days before arrival
 */
router.get('/price-trend/:hotelId', async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { city } = req.query;

    const trendData = await mlService.getPriceTrendByDays(
      parseInt(hotelId),
      city || ''
    );

    res.json({
      success: true,
      hotelId: parseInt(hotelId),
      ...trendData
    });

    logger.info(`Price trend fetched for hotel ${hotelId}`);
  } catch (error) {
    logger.error('Error in price-trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get price trend',
      details: error.message
    });
  }
});

/**
 * GET /ml/city-analysis/:city
 * Get comprehensive analysis for a city
 */
router.get('/city-analysis/:city', async (req, res) => {
  try {
    const { city } = req.params;

    const analysis = await mlService.getCityAnalysis(city);

    res.json({
      success: true,
      analysis
    });

    logger.info(`City analysis fetched for ${city}`);
  } catch (error) {
    logger.error('Error in city-analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get city analysis',
      details: error.message
    });
  }
});

/**
 * GET /ml/hotel-analysis/:hotelId
 * Get comprehensive analysis for a hotel
 */
router.get('/hotel-analysis/:hotelId', async (req, res) => {
  try {
    const { hotelId } = req.params;

    const analysis = await mlService.getHotelAnalysis(parseInt(hotelId));

    res.json({
      success: true,
      analysis
    });

    logger.info(`Hotel analysis fetched for hotel ${hotelId}`);
  } catch (error) {
    logger.error('Error in hotel-analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get hotel analysis',
      details: error.message
    });
  }
});

/**
 * POST /ml/full-analysis
 * Get complete analysis for a trade opportunity
 * Combines success probability, risk assessment, and price trends
 */
router.post('/full-analysis', async (req, res) => {
  try {
    const { hotelId, city, price, daysBeforeArrival, targetMargin } = req.body;

    if (!hotelId || !city) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: hotelId, city'
      });
    }

    // Run all analyses in parallel
    const [successPrediction, riskAssessment, priceTrend, hotelAnalysis, cityAnalysis] = await Promise.all([
      mlService.calculateSuccessProbability(parseInt(hotelId), city, parseFloat(price) || 100, parseInt(daysBeforeArrival) || 30),
      mlService.assessRisk(parseInt(hotelId), city, parseFloat(price) || 100, parseInt(daysBeforeArrival) || 30, parseFloat(targetMargin) || 15),
      mlService.getPriceTrendByDays(parseInt(hotelId), city),
      mlService.getHotelAnalysis(parseInt(hotelId)),
      mlService.getCityAnalysis(city)
    ]);

    // Generate overall recommendation
    const overallScore = (
      successPrediction.successProbability * 0.4 +
      (100 - riskAssessment.riskScore) * 0.3 +
      (hotelAnalysis.successRate || 50) * 0.2 +
      (cityAnalysis.successRate || 50) * 0.1
    );

    let overallRecommendation;
    if (overallScore >= 75) overallRecommendation = 'STRONG BUY';
    else if (overallScore >= 60) overallRecommendation = 'BUY';
    else if (overallScore >= 45) overallRecommendation = 'HOLD';
    else if (overallScore >= 30) overallRecommendation = 'WEAK';
    else overallRecommendation = 'AVOID';

    res.json({
      success: true,
      overallScore: Math.round(overallScore),
      overallRecommendation,
      successPrediction,
      riskAssessment,
      priceTrend,
      hotelAnalysis,
      cityAnalysis,
      timestamp: new Date().toISOString()
    });

    logger.info(`Full analysis for hotel ${hotelId} in ${city}: ${overallRecommendation} (${Math.round(overallScore)})`);
  } catch (error) {
    logger.error('Error in full-analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform full analysis',
      details: error.message
    });
  }
});

module.exports = router;
