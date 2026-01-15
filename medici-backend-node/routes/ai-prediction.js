/**
 * AI Prediction API Routes
 * Exposes the prediction engine through REST endpoints
 */
const express = require('express');
const router = express.Router();
const { getPredictionEngine } = require('../services/prediction-engine');

/**
 * GET /ai/status
 * Get status of all AI agents
 */
router.get('/status', async (req, res) => {
    try {
        const engine = getPredictionEngine();
        const status = engine.getAgentStatus();
        
        res.json({
            success: true,
            engineStatus: 'active',
            agents: status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting AI status:', error);
        res.status(500).json({ error: 'Failed to get AI status' });
    }
});

/**
 * GET /ai/cities
 * Get list of available cities for filtering
 */
router.get('/cities', async (req, res) => {
    try {
        const engine = getPredictionEngine();
        const cities = await engine.fetchCities();
        
        res.json({
            success: true,
            count: cities.length,
            cities
        });
    } catch (error) {
        console.error('Error fetching cities:', error);
        res.status(500).json({ error: 'Failed to fetch cities' });
    }
});

/**
 * GET /ai/hotels
 * Get list of available hotels for filtering
 */
router.get('/hotels', async (req, res) => {
    try {
        const { city } = req.query;
        const engine = getPredictionEngine();
        const hotels = await engine.fetchHotels(city);
        
        res.json({
            success: true,
            count: hotels.length,
            city: city || 'all',
            hotels
        });
    } catch (error) {
        console.error('Error fetching hotels:', error);
        res.status(500).json({ error: 'Failed to fetch hotels' });
    }
});

/**
 * POST /ai/analyze
 * Run full AI analysis
 * Body: { hotelId, city, userInstructions, riskTolerance, futureDays }
 */
router.post('/analyze', async (req, res) => {
    try {
        const { hotelId, city, userInstructions, riskTolerance, futureDays } = req.body;
        
        console.log('🤖 AI Analysis requested:', { hotelId, city, userInstructions });
        
        const engine = getPredictionEngine();
        const result = await engine.runFullAnalysis({
            hotelId,
            city,
            userInstructions,
            riskTolerance,
            futureDays
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error running AI analysis:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to run AI analysis',
            message: error.message 
        });
    }
});

/**
 * GET /ai/opportunities
 * Get buy/sell opportunities
 * Query: hotelId, city, instructions, limit
 */
router.get('/opportunities', async (req, res) => {
    try {
        const { hotelId, city, instructions, limit } = req.query;
        
        const engine = getPredictionEngine();
        const result = await engine.getOpportunities({
            hotelId: hotelId ? parseInt(hotelId) : null,
            city,
            userInstructions: instructions,
            limit: limit ? parseInt(limit) : 50
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching opportunities:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch opportunities',
            message: error.message 
        });
    }
});

/**
 * POST /ai/opportunities
 * Get opportunities with custom instructions
 * Body: { hotelId, city, userInstructions, limit }
 */
router.post('/opportunities', async (req, res) => {
    try {
        const { hotelId, city, userInstructions, limit } = req.body;
        
        const engine = getPredictionEngine();
        const result = await engine.getOpportunities({
            hotelId,
            city,
            userInstructions,
            limit: limit || 50
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching opportunities:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch opportunities',
            message: error.message 
        });
    }
});

/**
 * GET /ai/market/:type
 * Get specific market analysis
 * Type: overview, trends, seasonality
 */
router.get('/market/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { hotelId, city } = req.query;
        
        const engine = getPredictionEngine();
        const result = await engine.getMarketAnalysis({
            hotelId: hotelId ? parseInt(hotelId) : null,
            city
        });
        
        if (!result.success) {
            return res.status(404).json(result);
        }

        // Return specific section based on type
        let response = { success: true };
        
        switch (type) {
            case 'overview':
                response.data = {
                    priceStats: result.analysis.priceStats,
                    trend: result.analysis.trend,
                    marketIndicators: result.analysis.marketIndicators
                };
                break;
            case 'trends':
                response.data = {
                    trend: result.analysis.trend,
                    marketIndicators: result.analysis.marketIndicators,
                    recommendation: result.analysis.recommendation
                };
                break;
            case 'seasonality':
                response.data = {
                    seasonality: result.analysis.seasonality,
                    dayOfWeekPatterns: result.analysis.dayOfWeekPatterns
                };
                break;
            default:
                response = result;
        }
        
        res.json(response);
    } catch (error) {
        console.error('Error fetching market analysis:', error);
        res.status(500).json({ error: 'Failed to fetch market analysis' });
    }
});

/**
 * GET /ai/forecast
 * Get demand forecast
 * Query: hotelId, city, days
 */
router.get('/forecast', async (req, res) => {
    try {
        const { hotelId, city, days } = req.query;
        
        const engine = getPredictionEngine();
        const result = await engine.getDemandForecast({
            hotelId: hotelId ? parseInt(hotelId) : null,
            city,
            futureDays: days ? parseInt(days) : 30
        });
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching forecast:', error);
        res.status(500).json({ error: 'Failed to fetch forecast' });
    }
});

/**
 * POST /ai/clear-cache
 * Clear prediction engine cache
 */
router.post('/clear-cache', (req, res) => {
    try {
        const engine = getPredictionEngine();
        engine.clearCache();
        res.json({ success: true, message: 'Cache cleared' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

module.exports = router;
