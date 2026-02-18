/**
 * AI Prediction API Routes
 * Exposes the prediction engine through REST endpoints
 */
const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { getPool, sql } = require('../config/database');
const { getPredictionEngine } = require('../services/prediction-engine');

/**
 * Map raw opportunity data to AIOpportunity format expected by frontend
 */
function mapOpportunityToFrontend(opp) {
    const lowPrice = parseFloat(opp.lowPrice) || parseFloat(opp.buyPrice) || 0;
    const highPrice = parseFloat(opp.highPrice) || parseFloat(opp.estimatedSellPrice) || 0;
    const potentialProfit = parseFloat(opp.potentialProfit) || (highPrice - lowPrice);
    const margin = highPrice > 0 ? ((highPrice - lowPrice) / highPrice) * 100 : 0;

    // Normalize finalScore to 0-100 confidence
    const rawScore = parseFloat(opp.finalScore) || parseFloat(opp.score) || parseFloat(opp.confidence) || 0;
    const confidence = rawScore > 0 && rawScore <= 100 ? Math.round(rawScore) : Math.min(100, Math.max(0, Math.round(
        rawScore > 1000 ? 95 :
        rawScore > 500 ? 85 :
        rawScore > 200 ? 75 :
        rawScore > 100 ? 65 :
        rawScore > 50 ? 55 :
        rawScore > 0 ? 45 : 30
    )));

    // Determine type
    let type = opp.type || 'BUY';
    if (type === 'ARBITRAGE' || type === 'arbitrage') type = 'BUY';
    else if (type === 'SELL' || opp.category === 'sell') type = 'SELL';
    else if (type === 'HOLD' || opp.category === 'hold') type = 'HOLD';
    else if (type !== 'BUY' && type !== 'SELL' && type !== 'HOLD') type = 'BUY';

    // Determine risk level
    const riskLevel = opp.riskLevel || (margin > 30 ? 'LOW' : margin > 15 ? 'MEDIUM' : 'HIGH');

    // Build action text
    const action = opp.action || (type === 'BUY'
        ? `קנה ${opp.hotelName || ''} ב-$${Math.round(lowPrice)} ומכור ב-$${Math.round(highPrice)}`
        : type === 'SELL'
        ? `מכור ${opp.hotelName || ''} ב-$${Math.round(highPrice)}`
        : `המתן - ${opp.reason || ''}`);

    return {
        ...opp,
        type,
        priority: (opp.priority || 'MEDIUM').toUpperCase(),
        action,
        reason: opp.reason || '',
        confidence,
        riskLevel,
        buyPrice: lowPrice,
        estimatedSellPrice: highPrice,
        expectedProfit: Math.round(potentialProfit),
        currentPrice: lowPrice,
        targetPrice: highPrice,
        checkIn: opp.date || opp.checkIn || opp.startDate || null,
        checkOut: opp.checkOut || opp.endDate || null,
        hotelName: opp.hotelName || '',
        hotelId: opp.hotelId || null,
        cityName: opp.cityName || opp.city || opp.CityName || null,
        margin: Math.round(margin * 10) / 10,
        buyFrom: opp.buyFrom || '',
        sellTo: opp.sellTo || ''
    };
}

function mapOpportunitiesResult(result) {
    if (result.opportunities && Array.isArray(result.opportunities)) {
        result.opportunities = result.opportunities.map(mapOpportunityToFrontend);
    }
    return result;
}

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

        res.json(mapOpportunitiesResult(result));
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

        res.json(mapOpportunitiesResult(result));
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
        const mapped = mapOpportunitiesResult(result);
        mapped.appliedFilters = filters;

        res.json(mapped);
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

/**
 * POST /ai/search-city-forward
 * Search city for opportunities - checks DB historical data + compares prices
 * Body: { cityCode, checkInFrom, checkInTo, nights, minProfit }
 */
router.post('/search-city-forward', async (req, res) => {
    try {
        const {
            cityCode,
            checkInFrom,
            checkInTo,
            nights = 3,
            minProfit = 10
        } = req.body;

        if (!cityCode) {
            return res.status(400).json({ success: false, error: 'cityCode is required' });
        }

        logger.info('City forward search requested', { cityCode, checkInFrom, checkInTo, nights, minProfit });

        const pool = await getPool();

        // 1. Get existing opportunities from DB for this city
        // Note: MED_Opportunities uses DestinationsId to reference Med_Hotels.HotelId
        const dbResult = await pool.request()
            .input('city', sql.NVarChar, `%${cityCode}%`)
            .input('dateFrom', sql.NVarChar, checkInFrom)
            .input('dateTo', sql.NVarChar, checkInTo)
            .input('minProfit', sql.Float, parseInt(minProfit, 10) || 10)
            .query(`
                SELECT TOP 100
                    o.OpportunityId, o.DestinationsId AS HotelId, h.name AS HotelName,
                    o.DateForm AS CheckIn, o.DateTo AS CheckOut,
                    o.Price AS BuyPrice, o.PushPrice AS SellPrice,
                    (o.PushPrice - o.Price) AS Profit,
                    CASE WHEN o.PushPrice > 0
                        THEN ROUND(((o.PushPrice - o.Price) / o.PushPrice) * 100, 1)
                        ELSE 0
                    END AS Margin,
                    d.Name AS CityName
                FROM [MED_Opportunities] o
                LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
                LEFT JOIN DestinationsHotels dh ON h.HotelId = dh.HotelId
                LEFT JOIN Destinations d ON dh.DestinationId = d.Id AND d.Type = 'city'
                WHERE d.Name LIKE @city
                    AND o.IsActive = 1
                    AND o.DateForm >= @dateFrom
                    AND o.DateForm <= @dateTo
                    AND (o.PushPrice - o.Price) >= @minProfit
                ORDER BY (o.PushPrice - o.Price) DESC
            `);

        // 2. Get recent search results for price comparison
        // MED_SearchHotels uses DateForm/DateTo (not CheckIn/CheckOut), RequestTime (not DateInsert)
        const searchResult = await pool.request()
            .input('city2', sql.NVarChar, `%${cityCode}%`)
            .input('dateFrom2', sql.NVarChar, checkInFrom)
            .input('dateTo2', sql.NVarChar, checkInTo)
            .query(`
                SELECT TOP 100
                    sh.HotelId, h.name AS HotelName,
                    sh.DateForm AS CheckIn, sh.DateTo AS CheckOut,
                    sh.Price AS BuyPrice,
                    d.Name AS CityName
                FROM MED_SearchHotels sh
                JOIN Med_Hotels h ON sh.HotelId = h.HotelId
                LEFT JOIN DestinationsHotels dh ON h.HotelId = dh.HotelId
                LEFT JOIN Destinations d ON dh.DestinationId = d.Id AND d.Type = 'city'
                WHERE d.Name LIKE @city2
                    AND sh.DateForm >= @dateFrom2
                    AND sh.DateForm <= @dateTo2
                    AND sh.Price > 0
                ORDER BY sh.RequestTime DESC
            `);

        // Map DB opportunities to frontend format
        const dbOpportunities = dbResult.recordset.map(row => mapOpportunityToFrontend({
            hotelId: row.HotelId,
            hotelName: row.HotelName,
            cityName: row.CityName,
            lowPrice: row.BuyPrice,
            highPrice: row.SellPrice,
            buyPrice: row.BuyPrice,
            estimatedSellPrice: row.SellPrice,
            potentialProfit: row.Profit,
            checkIn: row.CheckIn,
            checkOut: row.CheckOut,
            type: 'BUY',
            priority: row.Profit > 100 ? 'HIGH' : row.Profit > 50 ? 'MEDIUM' : 'LOW',
            reason: `הזדמנות קיימת ב-DB - רווח $${Math.round(row.Profit)}`,
            confidence: 80,
            source: 'DB'
        }));

        // Map search results - estimate sell price as buyPrice * 1.2 (20% markup)
        const searchOpportunities = searchResult.recordset
            .map(row => {
                const estimatedSellPrice = Math.round(row.BuyPrice * 1.2);
                const profit = estimatedSellPrice - row.BuyPrice;
                if (profit < minProfit) return null;
                return mapOpportunityToFrontend({
                    hotelId: row.HotelId,
                    hotelName: row.HotelName,
                    cityName: row.CityName,
                    lowPrice: row.BuyPrice,
                    highPrice: estimatedSellPrice,
                    buyPrice: row.BuyPrice,
                    estimatedSellPrice,
                    potentialProfit: profit,
                    checkIn: row.CheckIn,
                    checkOut: row.CheckOut,
                    type: 'BUY',
                    priority: profit > 100 ? 'HIGH' : profit > 50 ? 'MEDIUM' : 'LOW',
                    reason: `מחיר ספק $${Math.round(row.BuyPrice)} - מרווח משוער ${Math.round((profit / estimatedSellPrice) * 100)}%`,
                    confidence: 60,
                    source: 'SEARCH'
                });
            })
            .filter(Boolean);

        // Combine, deduplicate by hotelId+checkIn
        const seen = new Set();
        const combined = [];
        for (const opp of [...dbOpportunities, ...searchOpportunities]) {
            const key = `${opp.hotelId}-${opp.checkIn}`;
            if (!seen.has(key)) {
                seen.add(key);
                combined.push(opp);
            }
        }

        // Sort by profit descending
        combined.sort((a, b) => (b.expectedProfit || 0) - (a.expectedProfit || 0));

        res.json({
            success: true,
            opportunities: combined,
            fromDb: dbOpportunities.length,
            fromSearch: searchOpportunities.length,
            total: combined.length
        });
    } catch (error) {
        logger.error('Error in city forward search', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to search city',
            message: error.message
        });
    }
});

module.exports = router;
