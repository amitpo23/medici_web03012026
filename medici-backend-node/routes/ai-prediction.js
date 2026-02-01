/**
 * AI Prediction API Routes
 * Exposes the prediction engine through REST endpoints
 */
const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
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
        logger.error('Error getting AI status', { error: error.message });
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
        logger.error('Error fetching cities', { error: error.message });
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
        logger.error('Error fetching hotels', { error: error.message });
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
        
        logger.info('AI Analysis requested', { hotelId, city, userInstructions });
        
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
        logger.error('Error running AI analysis', { error: error.message });
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
        logger.error('Error fetching opportunities', { error: error.message });
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
        logger.error('Error fetching opportunities', { error: error.message });
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch opportunities',
            message: error.message 
        });
    }
});

/**
 * POST /ai/opportunities/filter
 * Advanced opportunity filtering with profit-based criteria
 * Body: { 
 *   hotelId, city, userInstructions,
 *   filters: { 
 *     minProfit, minMarginPercent, minROI, profitRange,
 *     daysToCheckIn, season, weekendOnly, freeCancellationOnly,
 *     isPushed, isSold 
 *   }
 * }
 */
router.post('/opportunities/filter', async (req, res) => {
    try {
        const { hotelId, city, userInstructions, filters, limit } = req.body;
        
        logger.info('Advanced opportunity filter requested', {
            hotelId,
            city,
            filters,
            instructions: userInstructions
        });

        // Parse user instructions for profit keywords
        if (userInstructions) {
            const lowerInstructions = userInstructions.toLowerCase();
            
            // Hebrew: "רווח מעל 100 דולר" or "רווח גבוה מ-100"
            // English: "profit over 100" or "profit above $100"
            const profitMatch = lowerInstructions.match(/(?:profit|רווח).*?(?:over|above|מעל|גבוה מ-)?\$?\s*(\d+)/i);
            if (profitMatch && !filters?.minProfit) {
                filters = filters || {};
                filters.minProfit = parseFloat(profitMatch[1]);
                logger.info('Extracted minProfit from instructions', { minProfit: filters.minProfit });
            }

            // Margin: "margin over 15%" or "מרווח מעל 15%"
            const marginMatch = lowerInstructions.match(/(?:margin|מרווח).*?(?:over|above|מעל|גבוה מ-)?\s*(\d+)%?/i);
            if (marginMatch && !filters?.minMarginPercent) {
                filters = filters || {};
                filters.minMarginPercent = parseFloat(marginMatch[1]);
                logger.info('Extracted minMarginPercent from instructions', { minMarginPercent: filters.minMarginPercent });
            }

            // ROI: "roi above 20%" or "תשואה מעל 20%"
            const roiMatch = lowerInstructions.match(/(?:roi|תשואה).*?(?:over|above|מעל|גבוה מ-)?\s*(\d+)%?/i);
            if (roiMatch && !filters?.minROI) {
                filters = filters || {};
                filters.minROI = parseFloat(roiMatch[1]);
                logger.info('Extracted minROI from instructions', { minROI: filters.minROI });
            }

            // Season: "summer only" or "קיץ בלבד"
            if (/summer|קיץ/i.test(lowerInstructions)) filters = { ...filters, season: 'summer' };
            if (/winter|חורף/i.test(lowerInstructions)) filters = { ...filters, season: 'winter' };
            if (/weekend|סופ"ש|סופש/i.test(lowerInstructions)) filters = { ...filters, weekendOnly: true };
            if (/free.?cancel|ביטול חינם/i.test(lowerInstructions)) filters = { ...filters, freeCancellationOnly: true };
        }
        
        const engine = getPredictionEngine();
        const result = await engine.getOpportunities({
            hotelId,
            city,
            userInstructions,
            filters,
            limit: limit || 100
        });
        
        // Add filter summary to response
        result.appliedFilters = filters;
        
        res.json(result);
    } catch (error) {
        logger.error('Error filtering opportunities', { error: error.message });
        res.status(500).json({ 
            success: false,
            error: 'Failed to filter opportunities',
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
        logger.error('Error fetching market analysis', { error: error.message });
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
        logger.error('Error fetching forecast', { error: error.message });
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

/**
 * GET /ai/sanity-check
 * Quick validation that the prediction engine is functional
 * Tests: agent initialization, DB connectivity, data availability
 */
router.get('/sanity-check', async (req, res) => {
    const checks = [];
    const startTime = Date.now();

    try {
        // Check 1: Engine initialization
        const engine = getPredictionEngine();
        const agentStatus = engine.getAgentStatus();
        checks.push({
            name: 'engine_init',
            pass: agentStatus.length === 5,
            detail: `${agentStatus.length}/5 agents initialized`
        });

        // Check 2: Database connectivity
        try {
            const bookingData = await engine.fetchBookingData({ limit: 1 });
            checks.push({
                name: 'db_connectivity',
                pass: true,
                detail: `Fetched ${bookingData.length} sample records`
            });
        } catch (dbErr) {
            checks.push({
                name: 'db_connectivity',
                pass: false,
                detail: dbErr.message
            });
        }

        // Check 3: Data availability (check there's booking data)
        try {
            const data = await engine.fetchBookingData({});
            const hasData = data.length > 0;
            checks.push({
                name: 'data_availability',
                pass: hasData,
                detail: `${data.length} booking records available`
            });
        } catch (dataErr) {
            checks.push({
                name: 'data_availability',
                pass: false,
                detail: dataErr.message
            });
        }

        // Check 4: Cities endpoint
        try {
            const cities = await engine.fetchCities();
            checks.push({
                name: 'cities_data',
                pass: cities.length > 0,
                detail: `${cities.length} cities available`
            });
        } catch (cityErr) {
            checks.push({
                name: 'cities_data',
                pass: false,
                detail: cityErr.message
            });
        }

        // Check 5: Hotels endpoint
        try {
            const hotels = await engine.fetchHotels();
            checks.push({
                name: 'hotels_data',
                pass: hotels.length > 0,
                detail: `${hotels.length} hotels available`
            });
        } catch (hotelErr) {
            checks.push({
                name: 'hotels_data',
                pass: false,
                detail: hotelErr.message
            });
        }

        const allPassed = checks.every(c => c.pass);
        const elapsed = Date.now() - startTime;

        res.status(allPassed ? 200 : 503).json({
            success: allPassed,
            status: allPassed ? 'HEALTHY' : 'DEGRADED',
            checks,
            elapsed: `${elapsed}ms`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Sanity check failed', { error: error.message });
        res.status(503).json({
            success: false,
            status: 'FAILED',
            error: error.message,
            checks,
            elapsed: `${Date.now() - startTime}ms`
        });
    }
});

module.exports = router;
