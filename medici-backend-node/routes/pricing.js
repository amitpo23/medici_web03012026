/**
 * Smart Pricing API Routes
 * 
 * Endpoints for dynamic pricing:
 * - Calculate optimal prices
 * - Compare pricing strategies
 * - Get pricing recommendations
 * - Track pricing performance
 */

const express = require('express');
const router = express.Router();
const { getSmartPricingService, STRATEGIES } = require('../services/smart-pricing-service');
const { getPool } = require('../config/database');
const logger = require('../config/logger');

/**
 * POST /pricing/calculate
 * Calculate optimal price for opportunity
 */
router.post('/calculate', async (req, res) => {
  try {
    const {
      hotelId,
      checkIn,
      checkOut,
      buyPrice,
      currentSellPrice,
      roomCategory,
      boardType,
      strategy = 'balanced'
    } = req.body;

    if (!hotelId || !checkIn || !checkOut || !buyPrice) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: hotelId, checkIn, checkOut, buyPrice'
      });
    }

    const pricingService = getSmartPricingService();

    const result = await pricingService.calculateOptimalPrice({
      hotelId,
      checkIn,
      checkOut,
      buyPrice,
      currentSellPrice,
      roomCategory,
      boardType
    }, strategy);

    res.json(result);

  } catch (error) {
    logger.error('[Pricing API] Calculate error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /pricing/compare-strategies
 * Compare all pricing strategies for an opportunity
 */
router.post('/compare-strategies', async (req, res) => {
  try {
    const {
      hotelId,
      checkIn,
      checkOut,
      buyPrice,
      roomCategory,
      boardType
    } = req.body;

    if (!hotelId || !checkIn || !checkOut || !buyPrice) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const pricingService = getSmartPricingService();

    // Calculate for all strategies
    const strategies = Object.values(STRATEGIES);
    const results = await Promise.all(
      strategies.map(strategy =>
        pricingService.calculateOptimalPrice({
          hotelId,
          checkIn,
          checkOut,
          buyPrice,
          roomCategory,
          boardType
        }, strategy)
      )
    );

    // Format comparison
    const comparison = strategies.map((strategy, index) => ({
      strategy,
      price: results[index].recommendedSellPrice,
      profit: results[index].profit,
      margin: results[index].profitMargin,
      confidence: results[index].confidence,
      risk: results[index].risk,
      expectedConversion: results[index].market?.demand?.conversionRate || 0.5
    }));

    // Calculate expected value for each strategy
    comparison.forEach(item => {
      item.expectedValue = item.price * item.expectedConversion;
      item.expectedProfit = item.profit * item.expectedConversion;
    });

    // Sort by expected profit
    comparison.sort((a, b) => b.expectedProfit - a.expectedProfit);

    res.json({
      success: true,
      buyPrice: parseFloat(buyPrice),
      strategies: comparison,
      recommended: comparison[0].strategy,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Pricing API] Strategy comparison error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /pricing/batch-calculate
 * Calculate prices for multiple opportunities
 */
router.post('/batch-calculate', async (req, res) => {
  try {
    const { opportunities, strategy = 'balanced' } = req.body;

    if (!Array.isArray(opportunities) || opportunities.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'opportunities array required'
      });
    }

    const pricingService = getSmartPricingService();
    const results = await pricingService.batchCalculatePrices(opportunities, strategy);

    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalProfit: results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.profit, 0),
      avgConfidence: results
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.confidence, 0) / results.filter(r => r.success).length || 0
    };

    res.json({
      success: true,
      summary,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Pricing API] Batch calculate error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /pricing/recommendation/:opportunityId
 * Get pricing strategy recommendation for existing opportunity
 */
router.get('/recommendation/:opportunityId', async (req, res) => {
  try {
    const { opportunityId } = req.params;

    const pool = await getPool();

    // Get opportunity details
    const result = await pool.request()
      .input('opportunityId', opportunityId)
      .query(`
        SELECT
          o.OpportunityId,
          o.DestinationsId as HotelId,
          o.DateForm as CheckIn,
          o.DateTo as CheckOut,
          o.Price as BuyPrice,
          o.PushPrice as CurrentSellPrice,
          o.CategoryId as RoomCategoryId,
          o.BoardId,
          h.Name as HotelName
        FROM [MED_Opportunities] o
        LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
        WHERE o.OpportunityId = @opportunityId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opportunity not found'
      });
    }

    const opportunity = result.recordset[0];

    const pricingService = getSmartPricingService();
    const recommendation = await pricingService.getStrategyRecommendation({
      hotelId: opportunity.HotelId,
      checkIn: opportunity.CheckIn,
      checkOut: opportunity.CheckOut,
      buyPrice: opportunity.BuyPrice,
      currentSellPrice: opportunity.CurrentSellPrice,
      roomCategory: opportunity.RoomCategoryId,
      boardType: opportunity.BoardId
    });

    res.json({
      ...recommendation,
      opportunity: {
        id: opportunity.OpportunityId,
        hotel: opportunity.HotelName,
        dates: `${opportunity.CheckIn} to ${opportunity.CheckOut}`,
        currentBuy: opportunity.BuyPrice,
        currentSell: opportunity.CurrentSellPrice
      }
    });

  } catch (error) {
    logger.error('[Pricing API] Recommendation error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /pricing/update/:opportunityId
 * Update opportunity price using smart pricing
 */
router.put('/update/:opportunityId', async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { strategy = 'balanced', applyPrice = false } = req.body;

    const pool = await getPool();

    // Get opportunity
    const oppResult = await pool.request()
      .input('opportunityId', opportunityId)
      .query(`
        SELECT
          OpportunityId,
          DestinationsId as HotelId,
          DateForm as CheckIn,
          DateTo as CheckOut,
          Price as BuyPrice,
          PushPrice as CurrentSellPrice,
          CategoryId as RoomCategoryId,
          BoardId
        FROM [MED_Opportunities]
        WHERE OpportunityId = @opportunityId
      `);

    if (oppResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Opportunity not found'
      });
    }

    const opportunity = oppResult.recordset[0];

    // Calculate new price
    const pricingService = getSmartPricingService();
    const pricing = await pricingService.calculateOptimalPrice({
      hotelId: opportunity.HotelId,
      checkIn: opportunity.CheckIn,
      checkOut: opportunity.CheckOut,
      buyPrice: opportunity.BuyPrice,
      currentSellPrice: opportunity.CurrentSellPrice,
      roomCategory: opportunity.RoomCategoryId,
      boardType: opportunity.BoardId
    }, strategy);

    if (!pricing.success) {
      return res.status(400).json(pricing);
    }

    // Update if requested
    if (applyPrice) {
      await pool.request()
        .input('opportunityId', opportunityId)
        .input('newSellPrice', pricing.recommendedSellPrice)
        .query(`
          UPDATE [MED_Opportunities]
          SET PushPrice = @newSellPrice,
              Lastupdate = GETDATE()
          WHERE OpportunityId = @opportunityId
        `);

      // Log price change
      await pool.request()
        .input('opportunityId', opportunityId)
        .input('action', 'PRICE_UPDATED')
        .input('details', JSON.stringify({
          oldPrice: opportunity.CurrentSellPrice,
          newPrice: pricing.recommendedSellPrice,
          strategy,
          confidence: pricing.confidence,
          reason: 'Smart pricing recommendation applied'
        }))
        .query(`
          INSERT INTO MED_OpportunityLogs (OpportunityId, Action, Details, CreatedAt)
          VALUES (@opportunityId, @action, @details, GETDATE())
        `);

      logger.info('[Pricing API] Price updated', {
        opportunityId,
        oldPrice: opportunity.CurrentSellPrice,
        newPrice: pricing.recommendedSellPrice
      });
    }

    res.json({
      success: true,
      opportunityId: parseInt(opportunityId),
      pricing,
      applied: applyPrice,
      message: applyPrice ? 'Price updated successfully' : 'Price calculated (not applied)'
    });

  } catch (error) {
    logger.error('[Pricing API] Update error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /pricing/performance
 * Get pricing performance metrics
 */
router.get('/performance', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const pool = await getPool();

    // Get opportunities with smart pricing (check logs)
    const result = await pool.request()
      .input('days', days)
      .query(`
        -- Analyze pricing performance
        WITH PricedOpportunities AS (
          SELECT DISTINCT o.OpportunityId
          FROM [MED_Opportunities] o
          INNER JOIN MED_OpportunityLogs l ON o.OpportunityId = l.OpportunityId
          WHERE l.Action IN ('PRICE_UPDATED', 'AI_CREATED')
          AND l.CreatedAt >= DATEADD(DAY, -@days, GETDATE())
          AND o.AIGenerated = 1
        )
        SELECT
          COUNT(*) as TotalOpportunities,
          SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as Sold,
          AVG(PushPrice - Price) as AvgProfit,
          AVG((PushPrice - Price) / PushPrice) as AvgMargin,
          SUM(CASE WHEN IsSale = 1 THEN (PushPrice - Price) ELSE 0 END) as TotalProfit,
          AVG(AIConfidence) as AvgConfidence,
          AVG(AIPriorityScore) as AvgPriorityScore
        FROM [MED_Opportunities] o
        WHERE o.OpportunityId IN (SELECT OpportunityId FROM PricedOpportunities)
      `);

    const perf = result.recordset[0];

    // Get conversion by risk level
    const riskResult = await pool.request()
      .input('days', days)
      .query(`
        WITH PricedOpportunities AS (
          SELECT DISTINCT o.OpportunityId
          FROM [MED_Opportunities] o
          INNER JOIN MED_OpportunityLogs l ON o.OpportunityId = l.OpportunityId
          WHERE l.Action IN ('PRICE_UPDATED', 'AI_CREATED')
          AND l.CreatedAt >= DATEADD(DAY, -@days, GETDATE())
          AND o.AIGenerated = 1
        )
        SELECT
          AIRiskLevel as RiskLevel,
          COUNT(*) as Count,
          SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as Sold,
          AVG(AIConfidence) as AvgConfidence,
          AVG((PushPrice - Price) / PushPrice) as AvgMargin
        FROM [MED_Opportunities]
        WHERE OpportunityId IN (SELECT OpportunityId FROM PricedOpportunities)
        AND AIRiskLevel IS NOT NULL
        GROUP BY AIRiskLevel
      `);

    res.json({
      success: true,
      period: `Last ${days} days`,
      overall: {
        total: perf.TotalOpportunities || 0,
        sold: perf.Sold || 0,
        conversionRate: perf.TotalOpportunities > 0 ?
          (perf.Sold / perf.TotalOpportunities * 100).toFixed(2) + '%' : '0%',
        avgProfit: Math.round((perf.AvgProfit || 0) * 100) / 100,
        avgMargin: Math.round((perf.AvgMargin || 0) * 100) + '%',
        totalProfit: Math.round((perf.TotalProfit || 0) * 100) / 100,
        avgConfidence: Math.round((perf.AvgConfidence || 0) * 100) / 100,
        avgPriority: Math.round((perf.AvgPriorityScore || 0) * 100) / 100
      },
      byRiskLevel: riskResult.recordset.map(r => ({
        riskLevel: r.RiskLevel,
        count: r.Count,
        sold: r.Sold,
        conversionRate: r.Count > 0 ? (r.Sold / r.Count * 100).toFixed(2) + '%' : '0%',
        avgConfidence: Math.round((r.AvgConfidence || 0) * 100) / 100,
        avgMargin: Math.round((r.AvgMargin || 0) * 100) + '%'
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Pricing API] Performance error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /pricing/strategies
 * Get available pricing strategies and their characteristics
 */
router.get('/strategies', (req, res) => {
  res.json({
    success: true,
    strategies: {
      aggressive: {
        name: 'Aggressive',
        description: 'Maximum profit, higher risk',
        targetMargin: '40-50%',
        expectedConversion: '35%',
        bestFor: 'High-demand periods, unique properties'
      },
      balanced: {
        name: 'Balanced',
        description: 'Optimal profit/conversion balance',
        targetMargin: '25-30%',
        expectedConversion: '55%',
        bestFor: 'Most situations, reliable performance'
      },
      conservative: {
        name: 'Conservative',
        description: 'Lower margin, higher conversion',
        targetMargin: '15-20%',
        expectedConversion: '70%',
        bestFor: 'Low-demand periods, competitive markets'
      },
      competitive: {
        name: 'Competitive',
        description: 'Match or undercut competitors',
        targetMargin: 'Variable (competitor-based)',
        expectedConversion: '60%',
        bestFor: 'Competitive markets, price-sensitive customers'
      },
      premium: {
        name: 'Premium',
        description: 'High-end positioning',
        targetMargin: '35-40%',
        expectedConversion: '40%',
        bestFor: 'Luxury properties, unique experiences'
      }
    }
  });
});

module.exports = router;
