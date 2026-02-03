/**
 * Revenue Maximization Engine
 * 
 * Advanced algorithms for revenue optimization:
 * - Dynamic pricing adjustments
 * - Inventory optimization
 * - Yield management
 * - Price discrimination
 */

const { getPool } = require('../config/database');
const { getMLPricingService } = require('./ml-pricing-service');
const { getPriceElasticityService } = require('./price-elasticity-service');
const { getCompetitorTrackingService } = require('./competitor-tracking-service');
const logger = require('../config/logger');

class RevenueMaximizationService {
  constructor() {
    this.mlPricing = getMLPricingService();
    this.elasticity = getPriceElasticityService();
    this.competitorTracking = getCompetitorTrackingService();
    this.optimizationCache = new Map();
  }

  /**
   * Calculate revenue-maximizing price
   */
  async maximizeRevenue(params) {
    const {
      hotelId,
      checkIn,
      checkOut,
      buyPrice,
      availableInventory = 1,
      currentDemand = 'MEDIUM',
      competitorPrices = []
    } = params;

    try {
      logger.info('[Revenue Max] Calculating optimal price', { hotelId, checkIn });

      // Get multiple pricing perspectives
      const [mlPrediction, elasticityAnalysis, competitorPosition] = await Promise.all([
        // ML model prediction
        this.mlPricing.predictOptimalPrice({
          hotelId,
          checkIn,
          checkOut,
          buyPrice,
          currentDemand
        }),

        // Elasticity-based recommendation
        this.elasticity.recommendElasticityBasedPrice(hotelId, buyPrice * 1.25, 'revenue'),

        // Competitor positioning
        this.competitorTracking.analyzeCompetitivePosition(hotelId, buyPrice * 1.25)
      ]);

      // Calculate expected revenue for each approach
      const scenarios = this.generateRevenueScenarios({
        buyPrice,
        mlPrediction,
        elasticityAnalysis,
        competitorPosition,
        availableInventory,
        currentDemand
      });

      // Select best scenario
      const bestScenario = scenarios.reduce((best, current) =>
        current.expectedRevenue > best.expectedRevenue ? current : best
      );

      // Apply additional optimizations
      const optimizedPrice = this.applyAdvancedOptimizations({
        basePrice: bestScenario.price,
        buyPrice,
        hotelId,
        checkIn,
        scenarios,
        currentDemand
      });

      return {
        success: true,
        hotelId,
        optimization: {
          recommendedPrice: optimizedPrice.price,
          expectedRevenue: optimizedPrice.expectedRevenue,
          expectedProfit: optimizedPrice.expectedProfit,
          expectedConversionRate: optimizedPrice.conversionRate,
          confidence: optimizedPrice.confidence,
          riskLevel: optimizedPrice.riskLevel
        },
        scenarios: scenarios.map(s => ({
          strategy: s.strategy,
          price: s.price,
          expectedRevenue: s.expectedRevenue,
          expectedProfit: s.expectedProfit,
          conversionRate: s.conversionRate
        })),
        selectedStrategy: bestScenario.strategy,
        models: {
          ml: mlPrediction.success ? mlPrediction.prediction : null,
          elasticity: elasticityAnalysis.success ? elasticityAnalysis : null,
          competitor: competitorPosition.success ? competitorPosition : null
        }
      };

    } catch (error) {
      logger.error('[Revenue Max] Optimization error', {
        error: error.message,
        hotelId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Optimize portfolio of opportunities
   */
  async optimizePortfolio(opportunities, constraints = {}) {
    const {
      maxTotalInvestment = Infinity,
      minMargin = 0.15,
      maxRisk = 'MEDIUM',
      targetRevenue = null
    } = constraints;

    try {
      logger.info('[Revenue Max] Portfolio optimization', {
        opportunityCount: opportunities.length
      });

      // Calculate revenue potential for each opportunity
      const scored = await Promise.all(
        opportunities.map(async opp => {
          const revMax = await this.maximizeRevenue({
            hotelId: opp.hotelId,
            checkIn: opp.checkIn,
            checkOut: opp.checkOut,
            buyPrice: opp.buyPrice,
            currentDemand: opp.demand || 'MEDIUM'
          });

          if (!revMax.success) return null;

          return {
            ...opp,
            optimization: revMax.optimization,
            score: this.calculatePortfolioScore(revMax.optimization, constraints)
          };
        })
      );

      // Filter and sort by score
      const viable = scored
        .filter(o => o !== null)
        .filter(o => o.optimization.expectedProfit / o.buyPrice >= minMargin)
        .filter(o => this.getRiskLevel(o.optimization.riskLevel) <= this.getRiskLevel(maxRisk))
        .sort((a, b) => b.score - a.score);

      // Select optimal portfolio within budget
      const selected = [];
      let totalInvestment = 0;
      let totalRevenue = 0;
      let totalProfit = 0;

      for (const opp of viable) {
        if (totalInvestment + opp.buyPrice <= maxTotalInvestment) {
          selected.push(opp);
          totalInvestment += opp.buyPrice;
          totalRevenue += opp.optimization.expectedRevenue;
          totalProfit += opp.optimization.expectedProfit;

          if (targetRevenue && totalRevenue >= targetRevenue) break;
        }
      }

      // Calculate portfolio metrics
      const portfolio = {
        opportunities: selected,
        totalOpportunities: selected.length,
        totalInvestment,
        totalRevenue,
        totalProfit,
        avgROI: totalProfit / totalInvestment,
        avgMargin: totalProfit / totalRevenue,
        portfolioRisk: this.calculatePortfolioRisk(selected)
      };

      return {
        success: true,
        portfolio,
        rejected: viable.length - selected.length,
        analysis: {
          evaluated: opportunities.length,
          viable: viable.length,
          selected: selected.length,
          utilizationRate: totalInvestment / maxTotalInvestment
        }
      };

    } catch (error) {
      logger.error('[Revenue Max] Portfolio optimization error', {
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Dynamic yield management
   */
  async implementYieldManagement(hotelId, timeHorizon = 90) {
    try {
      logger.info('[Revenue Max] Yield management', { hotelId, timeHorizon });

      const pool = await getPool();

      // Get booking curve data
      const bookingCurve = await this.getBookingCurve(pool, hotelId, timeHorizon);

      // Get current inventory
      const inventory = await this.getCurrentInventory(pool, hotelId);

      // Calculate optimal pricing strategy over time
      const yieldStrategy = this.calculateYieldStrategy(bookingCurve, inventory);

      return {
        success: true,
        hotelId,
        timeHorizon: `${timeHorizon} days`,
        yieldStrategy,
        currentInventory: inventory,
        bookingCurve,
        recommendations: this.generateYieldRecommendations(yieldStrategy, inventory)
      };

    } catch (error) {
      logger.error('[Revenue Max] Yield management error', {
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate revenue scenarios
   */
  generateRevenueScenarios(data) {
    const scenarios = [];
    const { buyPrice, mlPrediction, elasticityAnalysis, competitorPosition, currentDemand } = data;

    // Scenario 1: ML-based pricing
    if (mlPrediction.success) {
      scenarios.push({
        strategy: 'ML_OPTIMIZED',
        price: mlPrediction.prediction.optimalPrice,
        conversionRate: mlPrediction.prediction.expectedConversion,
        expectedRevenue: mlPrediction.prediction.expectedRevenue,
        expectedProfit: mlPrediction.prediction.expectedProfit,
        confidence: mlPrediction.prediction.confidence
      });
    }

    // Scenario 2: Elasticity-based pricing
    if (elasticityAnalysis.success) {
      scenarios.push({
        strategy: 'ELASTICITY_OPTIMIZED',
        price: elasticityAnalysis.recommendedPrice,
        conversionRate: elasticityAnalysis.impact?.expectedRevenue / elasticityAnalysis.recommendedPrice || 0.5,
        expectedRevenue: elasticityAnalysis.impact?.expectedRevenue || 0,
        expectedProfit: (elasticityAnalysis.recommendedPrice - buyPrice) * 0.5,
        confidence: elasticityAnalysis.confidence
      });
    }

    // Scenario 3: Competitor-matched pricing
    if (competitorPosition.success && competitorPosition.suggestedPrice) {
      const competitorPrice = competitorPosition.suggestedPrice;
      const competitorConversion = this.estimateConversionForPrice(competitorPrice, buyPrice, 0.6);
      
      scenarios.push({
        strategy: 'COMPETITOR_MATCHED',
        price: competitorPrice,
        conversionRate: competitorConversion,
        expectedRevenue: competitorPrice * competitorConversion,
        expectedProfit: (competitorPrice - buyPrice) * competitorConversion,
        confidence: 0.75
      });
    }

    // Scenario 4: Aggressive pricing (high volume)
    const aggressivePrice = buyPrice * 1.15;
    const aggressiveConversion = this.estimateConversionForPrice(aggressivePrice, buyPrice, 0.75);
    scenarios.push({
      strategy: 'AGGRESSIVE_VOLUME',
      price: aggressivePrice,
      conversionRate: aggressiveConversion,
      expectedRevenue: aggressivePrice * aggressiveConversion,
      expectedProfit: (aggressivePrice - buyPrice) * aggressiveConversion,
      confidence: 0.70
    });

    // Scenario 5: Premium pricing (high margin)
    const premiumPrice = buyPrice * 1.45;
    const premiumConversion = this.estimateConversionForPrice(premiumPrice, buyPrice, 0.35);
    scenarios.push({
      strategy: 'PREMIUM_MARGIN',
      price: premiumPrice,
      conversionRate: premiumConversion,
      expectedRevenue: premiumPrice * premiumConversion,
      expectedProfit: (premiumPrice - buyPrice) * premiumConversion,
      confidence: 0.65
    });

    return scenarios;
  }

  /**
   * Apply advanced optimizations
   */
  applyAdvancedOptimizations(data) {
    let { basePrice, buyPrice, scenarios, currentDemand } = data;

    // Time-based adjustments
    const timeMultiplier = this.getTimeBasedMultiplier(data.checkIn);
    basePrice *= timeMultiplier;

    // Demand-based adjustments
    const demandMultiplier = this.getDemandMultiplier(currentDemand);
    basePrice *= demandMultiplier;

    // Calculate final metrics
    const conversionRate = this.estimateConversionForPrice(basePrice, buyPrice, 0.5);
    const expectedRevenue = basePrice * conversionRate;
    const expectedProfit = (basePrice - buyPrice) * conversionRate;

    // Determine confidence and risk
    const avgConfidence = scenarios.reduce((sum, s) => sum + (s.confidence || 0.5), 0) / scenarios.length;
    const confidence = Math.min(0.95, avgConfidence * 1.1);

    return {
      price: Math.round(basePrice * 100) / 100,
      conversionRate,
      expectedRevenue: Math.round(expectedRevenue * 100) / 100,
      expectedProfit: Math.round(expectedProfit * 100) / 100,
      confidence,
      riskLevel: this.assessOptimizationRisk(confidence, conversionRate)
    };
  }

  /**
   * Calculate portfolio score
   */
  calculatePortfolioScore(optimization, constraints) {
    let score = 0;

    // Revenue contribution (40%)
    score += (optimization.expectedRevenue / 1000) * 0.4;

    // Profit margin (30%)
    const margin = optimization.expectedProfit / optimization.expectedRevenue;
    score += (margin * 100) * 0.3;

    // Confidence (20%)
    score += (optimization.confidence * 100) * 0.2;

    // Risk penalty (10%)
    const riskPenalty = this.getRiskLevel(optimization.riskLevel) * 10;
    score -= riskPenalty * 0.1;

    return Math.max(0, score);
  }

  /**
   * Calculate portfolio risk
   */
  calculatePortfolioRisk(opportunities) {
    const riskLevels = opportunities.map(o => this.getRiskLevel(o.optimization.riskLevel));
    const avgRisk = riskLevels.reduce((a, b) => a + b, 0) / riskLevels.length;
    
    if (avgRisk <= 1) return 'LOW';
    if (avgRisk <= 2) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Get booking curve
   */
  async getBookingCurve(pool, hotelId, days) {
    const result = await pool.request()
      .input('hotelId', hotelId)
      .input('days', days)
      .query(`
        SELECT
          DATEDIFF(DAY, DateCreate, StartDate) as DaysOut,
          COUNT(*) as Bookings,
          AVG(SuggestedSellPrice) as AvgPrice
        FROM [MED_ֹOֹֹpportunities]
        WHERE HotelId = @hotelId
        AND IsSale = 1
        AND DateCreate >= DATEADD(DAY, -180, GETDATE())
        AND DATEDIFF(DAY, DateCreate, StartDate) <= @days
        GROUP BY DATEDIFF(DAY, DateCreate, StartDate)
        ORDER BY DaysOut
      `);

    return result.recordset;
  }

  /**
   * Get current inventory
   */
  async getCurrentInventory(pool, hotelId) {
    const result = await pool.request()
      .input('hotelId', hotelId)
      .query(`
        SELECT
          COUNT(*) as TotalActive,
          SUM(CASE WHEN IsSale = 0 THEN 1 ELSE 0 END) as Available,
          SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as Sold
        FROM [MED_ֹOֹֹpportunities]
        WHERE HotelId = @hotelId
        AND IsActive = 1
        AND StartDate >= GETDATE()
      `);

    return result.recordset[0];
  }

  /**
   * Calculate yield strategy
   */
  calculateYieldStrategy(bookingCurve, inventory) {
    const strategy = [];

    // Analyze booking patterns
    const earlyBookings = bookingCurve.filter(b => b.DaysOut > 60);
    const midBookings = bookingCurve.filter(b => b.DaysOut > 30 && b.DaysOut <= 60);
    const lateBookings = bookingCurve.filter(b => b.DaysOut <= 30);

    // Calculate optimal pricing for each period
    strategy.push({
      period: 'EARLY_BOOKING',
      daysOut: '>60',
      strategy: 'HIGH_PRICE',
      priceMultiplier: 1.2,
      rationale: 'Capture early bookers willing to pay premium'
    });

    strategy.push({
      period: 'MID_RANGE',
      daysOut: '30-60',
      strategy: 'BALANCED',
      priceMultiplier: 1.1,
      rationale: 'Balance revenue and conversion'
    });

    strategy.push({
      period: 'LAST_MINUTE',
      daysOut: '<30',
      strategy: inventory.Available > inventory.Sold ? 'DISCOUNT' : 'MAINTAIN',
      priceMultiplier: inventory.Available > inventory.Sold ? 0.95 : 1.0,
      rationale: inventory.Available > inventory.Sold ? 
        'Clear inventory with discounts' : 
        'Maintain prices due to limited availability'
    });

    return strategy;
  }

  /**
   * Generate yield recommendations
   */
  generateYieldRecommendations(yieldStrategy, inventory) {
    const recommendations = [];

    const availabilityRate = inventory.Available / inventory.TotalActive;

    if (availabilityRate > 0.7) {
      recommendations.push({
        priority: 'HIGH',
        action: 'INCREASE_MARKETING',
        message: 'High inventory available - increase marketing spend',
        expectedImpact: 'Increase booking velocity'
      });
    }

    if (availabilityRate < 0.2) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'INCREASE_PRICES',
        message: 'Low inventory - opportunity to increase prices',
        expectedImpact: 'Maximize revenue per unit'
      });
    }

    return recommendations;
  }

  // Helper functions
  estimateConversionForPrice(price, buyPrice, baseConversion) {
    const margin = (price - buyPrice) / buyPrice;
    const elasticity = -1.2;
    const conversionAdjustment = margin * elasticity * 0.3;
    return Math.max(0.1, Math.min(0.95, baseConversion + conversionAdjustment));
  }

  getTimeBasedMultiplier(checkIn) {
    const daysUntil = Math.floor((new Date(checkIn) - new Date()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 7) return 0.95;  // Last minute discount
    if (daysUntil > 60) return 1.05; // Early booking premium
    return 1.0;
  }

  getDemandMultiplier(demand) {
    const map = {
      LOW: 0.92,
      MEDIUM: 1.0,
      HIGH: 1.12,
      VERY_HIGH: 1.25
    };
    return map[demand] || 1.0;
  }

  getRiskLevel(riskString) {
    const map = { LOW: 1, MEDIUM: 2, HIGH: 3 };
    return map[riskString] || 2;
  }

  assessOptimizationRisk(confidence, conversionRate) {
    if (confidence >= 0.8 && conversionRate >= 0.6) return 'LOW';
    if (confidence >= 0.6 && conversionRate >= 0.4) return 'MEDIUM';
    return 'HIGH';
  }
}

// Singleton instance
let instance = null;

function getRevenueMaximizationService() {
  if (!instance) {
    instance = new RevenueMaximizationService();
  }
  return instance;
}

module.exports = {
  getRevenueMaximizationService,
  RevenueMaximizationService
};
