/**
 * Smart Pricing Service
 * 
 * Dynamic pricing engine that calculates optimal buy and sell prices
 * based on historical data, competitor prices, demand patterns, and AI predictions.
 * 
 * Features:
 * - Historical price analysis
 * - Competitor price tracking
 * - Demand-based pricing
 * - Margin optimization
 * - Multiple pricing strategies
 * - Risk-adjusted pricing
 */

const { getPool } = require('../config/database');
const logger = require('../config/logger');

// Pricing strategies
const STRATEGIES = {
  AGGRESSIVE: 'aggressive',    // Max profit, higher risk
  BALANCED: 'balanced',        // Optimal profit/conversion balance
  CONSERVATIVE: 'conservative', // Lower margin, higher conversion
  COMPETITIVE: 'competitive',   // Match or undercut competitors
  PREMIUM: 'premium'           // High-end positioning
};

// Default configuration
const DEFAULT_CONFIG = {
  minProfitMargin: 0.15,      // 15% minimum margin
  targetProfitMargin: 0.25,   // 25% target margin
  maxProfitMargin: 0.50,      // 50% maximum margin
  competitorBuffer: 0.05,     // 5% below competitor avg
  demandMultiplier: {
    low: 0.90,                // 10% discount in low demand
    medium: 1.00,             // Normal pricing
    high: 1.15,               // 15% premium in high demand
    veryHigh: 1.30            // 30% premium in very high demand
  },
  leadTimeAdjustment: {
    lastMinute: 0.85,         // 15% discount (< 3 days)
    short: 0.95,              // 5% discount (3-7 days)
    medium: 1.00,             // Normal (7-30 days)
    long: 1.10                // 10% premium (> 30 days)
  },
  seasonalAdjustment: {
    offSeason: 0.90,          // 10% discount
    shoulder: 1.00,           // Normal
    peak: 1.20,               // 20% premium
    superPeak: 1.40           // 40% premium
  }
};

class SmartPricingService {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Calculate optimal price for an opportunity
   * 
   * @param {Object} opportunity - Opportunity details
   * @param {string} strategy - Pricing strategy
   * @param {Object} options - Additional options
   * @returns {Object} Pricing recommendation
   */
  async calculateOptimalPrice(opportunity, strategy = STRATEGIES.BALANCED, options = {}) {
    try {
      const {
        hotelId,
        checkIn,
        checkOut,
        buyPrice,
        currentSellPrice,
        roomCategory,
        boardType
      } = opportunity;

      // Validate inputs
      if (!hotelId || !checkIn || !checkOut || !buyPrice) {
        throw new Error('Missing required fields: hotelId, checkIn, checkOut, buyPrice');
      }

      logger.info('[Smart Pricing] Calculating optimal price', { 
        hotelId, 
        checkIn, 
        strategy 
      });

      // Gather pricing intelligence
      const [
        historicalData,
        competitorData,
        demandData,
        seasonalData
      ] = await Promise.all([
        this.getHistoricalPricing(hotelId, checkIn, checkOut),
        this.getCompetitorPricing(hotelId, checkIn, checkOut),
        this.getDemandAnalysis(hotelId, checkIn, checkOut),
        this.getSeasonalFactors(hotelId, checkIn)
      ]);

      // Calculate base sell price using strategy
      const basePrice = this.calculateBasePrice(
        buyPrice,
        strategy,
        historicalData,
        competitorData
      );

      // Apply dynamic adjustments
      const adjustedPrice = this.applyDynamicAdjustments(
        basePrice,
        {
          demand: demandData,
          seasonal: seasonalData,
          leadTime: this.calculateLeadTime(checkIn),
          competitor: competitorData
        },
        strategy
      );

      // Calculate confidence and risk
      const confidence = this.calculatePriceConfidence(
        adjustedPrice,
        buyPrice,
        historicalData,
        competitorData,
        demandData
      );

      const risk = this.assessPricingRisk(
        adjustedPrice,
        buyPrice,
        competitorData,
        demandData
      );

      // Generate final recommendation
      const recommendation = {
        success: true,
        buyPrice: parseFloat(buyPrice),
        recommendedSellPrice: Math.round(adjustedPrice * 100) / 100,
        currentSellPrice: currentSellPrice ? parseFloat(currentSellPrice) : null,
        profit: adjustedPrice - buyPrice,
        profitMargin: ((adjustedPrice - buyPrice) / adjustedPrice),
        
        // Confidence & Risk
        confidence: Math.round(confidence * 100) / 100,
        risk: risk.level,
        riskFactors: risk.factors,
        
        // Strategy details
        strategy,
        
        // Market intelligence
        market: {
          historical: {
            avgSellPrice: historicalData.avgPrice,
            avgMargin: historicalData.avgMargin,
            sampleSize: historicalData.count
          },
          competitors: {
            min: competitorData.minPrice,
            max: competitorData.maxPrice,
            avg: competitorData.avgPrice,
            count: competitorData.count,
            position: this.calculateMarketPosition(adjustedPrice, competitorData)
          },
          demand: {
            level: demandData.level,
            score: demandData.score,
            trend: demandData.trend,
            searchVolume: demandData.searchCount
          },
          seasonal: {
            factor: seasonalData.factor,
            season: seasonalData.season
          }
        },
        
        // Adjustments applied
        adjustments: {
          base: basePrice,
          demand: basePrice * (demandData.multiplier - 1),
          seasonal: basePrice * (seasonalData.factor - 1),
          leadTime: basePrice * (this.getLeadTimeMultiplier(checkIn) - 1),
          competitor: basePrice * (competitorData.adjustment - 1)
        },
        
        // Alternative scenarios
        scenarios: this.generatePricingScenarios(buyPrice, competitorData, demandData),
        
        timestamp: new Date().toISOString()
      };

      // Cache result
      const cacheKey = `price_${hotelId}_${checkIn}_${checkOut}_${strategy}`;
      this.cache.set(cacheKey, {
        data: recommendation,
        timestamp: Date.now()
      });

      return recommendation;

    } catch (error) {
      logger.error('[Smart Pricing] Price calculation error', { 
        error: error.message,
        opportunity 
      });
      
      // Fallback to simple margin-based pricing
      return this.fallbackPricing(opportunity.buyPrice, strategy);
    }
  }

  /**
   * Get historical pricing data for hotel/dates
   */
  async getHistoricalPricing(hotelId, checkIn, checkOut) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input('hotelId', hotelId)
        .input('checkIn', checkIn)
        .input('checkOut', checkOut)
        .query(`
          -- Get historical pricing for same hotel and similar date range
          SELECT
            COUNT(*) as PriceCount,
            AVG(SellPrice) as AvgSellPrice,
            AVG(BuyPrice) as AvgBuyPrice,
            MIN(SellPrice) as MinSellPrice,
            MAX(SellPrice) as MaxSellPrice,
            AVG((SellPrice - BuyPrice) / SellPrice) as AvgMargin,
            AVG(CASE WHEN MarketPrice IS NOT NULL THEN MarketPrice ELSE SellPrice END) as AvgMarketPrice
          FROM MED_PriceHistory
          WHERE HotelId = @hotelId
          AND DateFrom >= DATEADD(MONTH, -6, @checkIn)  -- Last 6 months
          AND DateFrom <= DATEADD(MONTH, 1, @checkIn)   -- Similar period
          AND IsActive = 1
        `);

      const data = result.recordset[0];
      
      return {
        avgPrice: data.AvgSellPrice || 0,
        minPrice: data.MinSellPrice || 0,
        maxPrice: data.MaxSellPrice || 0,
        avgMargin: data.AvgMargin || 0.25,
        avgMarketPrice: data.AvgMarketPrice || 0,
        count: data.PriceCount || 0
      };

    } catch (error) {
      logger.error('[Smart Pricing] Historical data error', { error: error.message });
      return { avgPrice: 0, minPrice: 0, maxPrice: 0, avgMargin: 0.25, count: 0 };
    }
  }

  /**
   * Get competitor pricing data
   */
  async getCompetitorPricing(hotelId, checkIn, checkOut) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input('hotelId', hotelId)
        .input('checkIn', checkIn)
        .input('checkOut', checkOut)
        .query(`
          -- Get recent competitor prices
          SELECT
            COUNT(*) as CompetitorCount,
            AVG(Price) as AvgPrice,
            MIN(Price) as MinPrice,
            MAX(Price) as MaxPrice,
            AVG(Availability) as AvgAvailability
          FROM MED_CompetitorPrices
          WHERE HotelId = @hotelId
          AND CheckIn >= @checkIn
          AND CheckIn <= DATEADD(DAY, 3, @checkIn)  -- +/- 3 days
          AND CheckOut >= @checkOut
          AND CheckOut <= DATEADD(DAY, 3, @checkOut)
          AND SnapshotDate >= DATEADD(DAY, -7, GETDATE())  -- Last 7 days
          AND IsActive = 1
        `);

      const data = result.recordset[0];
      
      return {
        avgPrice: data.AvgPrice || 0,
        minPrice: data.MinPrice || 0,
        maxPrice: data.MaxPrice || 0,
        count: data.CompetitorCount || 0,
        availability: data.AvgAvailability || 0,
        adjustment: 1.0  // Will be calculated based on strategy
      };

    } catch (error) {
      logger.error('[Smart Pricing] Competitor data error', { error: error.message });
      return { avgPrice: 0, minPrice: 0, maxPrice: 0, count: 0, adjustment: 1.0 };
    }
  }

  /**
   * Analyze demand patterns
   */
  async getDemandAnalysis(hotelId, checkIn, checkOut) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input('hotelId', hotelId)
        .input('checkIn', checkIn)
        .input('checkOut', checkOut)
        .query(`
          -- Analyze search patterns and demand
          SELECT
            COUNT(*) as SearchCount,
            AVG(CASE WHEN DidBook = 1 THEN 1.0 ELSE 0.0 END) as ConversionRate,
            AVG(AvgPrice) as AvgSearchPrice,
            AVG(LeadTime) as AvgLeadTime,
            COUNT(DISTINCT SearchDate) as UniqueDays
          FROM MED_SearchPatterns
          WHERE HotelId = @hotelId
          AND CheckIn >= @checkIn
          AND CheckIn <= DATEADD(DAY, 7, @checkIn)  -- Similar check-in dates
          AND SearchDate >= DATEADD(DAY, -30, GETDATE())  -- Last 30 days
        `);

      const data = result.recordset[0];
      const searchCount = data.SearchCount || 0;
      const conversionRate = data.ConversionRate || 0;
      
      // Calculate demand score (0-100)
      const demandScore = Math.min(100, (searchCount * 2) + (conversionRate * 50));
      
      // Determine demand level
      let level, multiplier;
      if (demandScore >= 80) {
        level = 'veryHigh';
        multiplier = this.config.demandMultiplier.veryHigh;
      } else if (demandScore >= 60) {
        level = 'high';
        multiplier = this.config.demandMultiplier.high;
      } else if (demandScore >= 30) {
        level = 'medium';
        multiplier = this.config.demandMultiplier.medium;
      } else {
        level = 'low';
        multiplier = this.config.demandMultiplier.low;
      }
      
      return {
        level,
        score: demandScore,
        multiplier,
        searchCount,
        conversionRate,
        trend: searchCount > 10 ? 'increasing' : 'stable'
      };

    } catch (error) {
      logger.error('[Smart Pricing] Demand analysis error', { error: error.message });
      return { 
        level: 'medium', 
        score: 50, 
        multiplier: 1.0, 
        searchCount: 0, 
        trend: 'stable' 
      };
    }
  }

  /**
   * Get seasonal pricing factors
   */
  async getSeasonalFactors(hotelId, checkIn) {
    try {
      const pool = await getPool();
      
      // Get historical occupancy/pricing for this time of year
      const result = await pool.request()
        .input('hotelId', hotelId)
        .input('month', new Date(checkIn).getMonth() + 1)
        .input('dayOfMonth', new Date(checkIn).getDate())
        .query(`
          -- Analyze seasonality based on historical data
          SELECT
            AVG(SellPrice) as AvgPrice,
            COUNT(*) as SampleSize,
            AVG(CASE WHEN Source = 'SOLD' THEN 1.0 ELSE 0.0 END) as OccupancyRate
          FROM MED_PriceHistory
          WHERE HotelId = @hotelId
          AND MONTH(DateFrom) = @month
          AND DAY(DateFrom) BETWEEN @dayOfMonth - 7 AND @dayOfMonth + 7
          AND SnapshotDate >= DATEADD(YEAR, -2, GETDATE())  -- Last 2 years
        `);

      const data = result.recordset[0];
      const occupancyRate = data.OccupancyRate || 0.5;
      
      // Determine season based on occupancy
      let season, factor;
      if (occupancyRate >= 0.85) {
        season = 'superPeak';
        factor = this.config.seasonalAdjustment.superPeak;
      } else if (occupancyRate >= 0.70) {
        season = 'peak';
        factor = this.config.seasonalAdjustment.peak;
      } else if (occupancyRate >= 0.50) {
        season = 'shoulder';
        factor = this.config.seasonalAdjustment.shoulder;
      } else {
        season = 'offSeason';
        factor = this.config.seasonalAdjustment.offSeason;
      }
      
      return {
        season,
        factor,
        occupancyRate,
        sampleSize: data.SampleSize || 0
      };

    } catch (error) {
      logger.error('[Smart Pricing] Seasonal factors error', { error: error.message });
      return { season: 'shoulder', factor: 1.0, occupancyRate: 0.5, sampleSize: 0 };
    }
  }

  /**
   * Calculate base sell price using strategy
   */
  calculateBasePrice(buyPrice, strategy, historicalData, competitorData) {
    const price = parseFloat(buyPrice);
    
    switch (strategy) {
      case STRATEGIES.AGGRESSIVE:
        // Max margin while staying below competitor max
        if (competitorData.maxPrice > 0) {
          return Math.min(
            price * (1 + this.config.maxProfitMargin),
            competitorData.maxPrice * 0.98
          );
        }
        return price * (1 + this.config.maxProfitMargin);
        
      case STRATEGIES.BALANCED:
        // Target margin, adjusted by historical average
        const targetMargin = historicalData.avgMargin || this.config.targetProfitMargin;
        return price / (1 - targetMargin);
        
      case STRATEGIES.CONSERVATIVE:
        // Min margin for higher conversion
        return price * (1 + this.config.minProfitMargin);
        
      case STRATEGIES.COMPETITIVE:
        // Match or slightly undercut competitor average
        if (competitorData.avgPrice > 0) {
          return competitorData.avgPrice * (1 - this.config.competitorBuffer);
        }
        return price * (1 + this.config.targetProfitMargin);
        
      case STRATEGIES.PREMIUM:
        // High-end positioning, above competitor average
        if (competitorData.avgPrice > 0) {
          return competitorData.avgPrice * 1.15;
        }
        return price * (1 + 0.35);  // 35% margin
        
      default:
        return price * (1 + this.config.targetProfitMargin);
    }
  }

  /**
   * Apply dynamic adjustments to base price
   */
  applyDynamicAdjustments(basePrice, factors, strategy) {
    let adjustedPrice = basePrice;
    
    // Demand adjustment
    adjustedPrice *= factors.demand.multiplier;
    
    // Seasonal adjustment
    adjustedPrice *= factors.seasonal.factor;
    
    // Lead time adjustment
    const leadTimeMultiplier = this.getLeadTimeMultiplier(factors.leadTime);
    adjustedPrice *= leadTimeMultiplier;
    
    // Competitor adjustment (for competitive strategy)
    if (strategy === STRATEGIES.COMPETITIVE && factors.competitor.avgPrice > 0) {
      const competitorTarget = factors.competitor.avgPrice * (1 - this.config.competitorBuffer);
      adjustedPrice = (adjustedPrice + competitorTarget) / 2;  // Blend with competitor target
    }
    
    return adjustedPrice;
  }

  /**
   * Calculate lead time in days
   */
  calculateLeadTime(checkIn) {
    const checkInDate = new Date(checkIn);
    const today = new Date();
    const diffTime = checkInDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Get lead time multiplier
   */
  getLeadTimeMultiplier(leadTime) {
    if (typeof leadTime === 'number') {
      if (leadTime < 3) return this.config.leadTimeAdjustment.lastMinute;
      if (leadTime <= 7) return this.config.leadTimeAdjustment.short;
      if (leadTime <= 30) return this.config.leadTimeAdjustment.medium;
      return this.config.leadTimeAdjustment.long;
    }
    return 1.0;
  }

  /**
   * Calculate price confidence score (0-1)
   */
  calculatePriceConfidence(price, buyPrice, historicalData, competitorData, demandData) {
    let confidence = 0.5;  // Base 50%
    
    // Historical data confidence (+0 to +0.25)
    if (historicalData.count > 0) {
      const historicalBoost = Math.min(0.25, historicalData.count / 100 * 0.25);
      confidence += historicalBoost;
    }
    
    // Competitor data confidence (+0 to +0.15)
    if (competitorData.count > 0) {
      confidence += Math.min(0.15, competitorData.count / 20 * 0.15);
    }
    
    // Demand data confidence (+0 to +0.10)
    if (demandData.searchCount > 0) {
      confidence += Math.min(0.10, demandData.searchCount / 50 * 0.10);
    }
    
    // Margin reasonableness check (-0.2 to 0)
    const margin = (price - buyPrice) / price;
    if (margin < 0.10 || margin > 0.60) {
      confidence -= 0.20;  // Extreme margins reduce confidence
    }
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Assess pricing risk
   */
  assessPricingRisk(price, buyPrice, competitorData, demandData) {
    const factors = [];
    let riskScore = 0;
    
    const margin = (price - buyPrice) / price;
    
    // Margin risk
    if (margin < 0.15) {
      factors.push('Low margin (<15%)');
      riskScore += 30;
    } else if (margin > 0.50) {
      factors.push('Very high margin (>50%)');
      riskScore += 25;
    }
    
    // Competitor risk
    if (competitorData.avgPrice > 0) {
      const priceDiff = (price - competitorData.avgPrice) / competitorData.avgPrice;
      if (priceDiff > 0.20) {
        factors.push('20%+ above competitor average');
        riskScore += 20;
      } else if (priceDiff < -0.20) {
        factors.push('20%+ below competitor average');
        riskScore += 15;
      }
    } else {
      factors.push('No competitor data available');
      riskScore += 10;
    }
    
    // Demand risk
    if (demandData.level === 'low') {
      factors.push('Low demand detected');
      riskScore += 20;
    } else if (demandData.level === 'veryHigh') {
      factors.push('Very high demand (opportunity)');
      riskScore -= 10;  // Reduce risk
    }
    
    // Data availability risk
    if (competitorData.count === 0) {
      factors.push('No recent competitor prices');
      riskScore += 15;
    }
    
    // Determine risk level
    let level;
    if (riskScore >= 50) {
      level = 'HIGH';
    } else if (riskScore >= 25) {
      level = 'MEDIUM';
    } else {
      level = 'LOW';
    }
    
    return { level, score: riskScore, factors };
  }

  /**
   * Calculate market position vs competitors
   */
  calculateMarketPosition(price, competitorData) {
    if (!competitorData.avgPrice || competitorData.avgPrice === 0) {
      return 'unknown';
    }
    
    const diff = (price - competitorData.avgPrice) / competitorData.avgPrice;
    
    if (diff < -0.15) return 'aggressive';
    if (diff < -0.05) return 'below-market';
    if (diff <= 0.05) return 'at-market';
    if (diff <= 0.15) return 'above-market';
    return 'premium';
  }

  /**
   * Generate alternative pricing scenarios
   */
  generatePricingScenarios(buyPrice, competitorData, demandData) {
    const price = parseFloat(buyPrice);
    
    return {
      conservative: {
        price: Math.round(price * 1.15 * 100) / 100,
        margin: 0.15,
        expectedConversion: 0.70
      },
      balanced: {
        price: Math.round(price * 1.25 * 100) / 100,
        margin: 0.25,
        expectedConversion: 0.55
      },
      aggressive: {
        price: Math.round(price * 1.40 * 100) / 100,
        margin: 0.40,
        expectedConversion: 0.35
      },
      matchCompetitor: competitorData.avgPrice > 0 ? {
        price: Math.round(competitorData.avgPrice * 100) / 100,
        margin: (competitorData.avgPrice - price) / competitorData.avgPrice,
        expectedConversion: 0.60
      } : null
    };
  }

  /**
   * Fallback pricing when data is insufficient
   */
  fallbackPricing(buyPrice, strategy) {
    const price = parseFloat(buyPrice);
    let sellPrice;
    
    switch (strategy) {
      case STRATEGIES.AGGRESSIVE:
        sellPrice = price * 1.40;
        break;
      case STRATEGIES.CONSERVATIVE:
        sellPrice = price * 1.15;
        break;
      default:
        sellPrice = price * 1.25;
    }
    
    return {
      success: true,
      buyPrice: price,
      recommendedSellPrice: Math.round(sellPrice * 100) / 100,
      profit: sellPrice - price,
      profitMargin: (sellPrice - price) / sellPrice,
      confidence: 0.50,
      risk: 'MEDIUM',
      riskFactors: ['Insufficient data for advanced pricing'],
      strategy,
      fallback: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Batch calculate prices for multiple opportunities
   */
  async batchCalculatePrices(opportunities, strategy = STRATEGIES.BALANCED) {
    const results = [];
    
    for (const opp of opportunities) {
      try {
        const pricing = await this.calculateOptimalPrice(opp, strategy);
        results.push({
          opportunityId: opp.opportunityId || opp.id,
          ...pricing
        });
      } catch (error) {
        logger.error('[Smart Pricing] Batch calculation error', { 
          opportunityId: opp.opportunityId || opp.id,
          error: error.message 
        });
        
        results.push({
          opportunityId: opp.opportunityId || opp.id,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Get pricing strategy recommendations
   */
  async getStrategyRecommendation(opportunity) {
    try {
      // Calculate prices for all strategies
      const strategies = Object.values(STRATEGIES);
      const results = await Promise.all(
        strategies.map(strategy => 
          this.calculateOptimalPrice(opportunity, strategy)
        )
      );
      
      // Find best strategy based on expected value
      const evaluations = results.map((result, index) => {
        const expectedRevenue = result.recommendedSellPrice * 
          (result.market?.demand?.conversionRate || 0.5);
        
        return {
          strategy: strategies[index],
          price: result.recommendedSellPrice,
          margin: result.profitMargin,
          confidence: result.confidence,
          risk: result.risk,
          expectedRevenue,
          score: expectedRevenue * result.confidence
        };
      });
      
      // Sort by score
      evaluations.sort((a, b) => b.score - a.score);
      
      return {
        success: true,
        recommended: evaluations[0].strategy,
        evaluations,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[Smart Pricing] Strategy recommendation error', { 
        error: error.message 
      });
      
      return {
        success: false,
        error: error.message,
        recommended: STRATEGIES.BALANCED
      };
    }
  }
}

// Singleton instance
let instance = null;

function getSmartPricingService() {
  if (!instance) {
    instance = new SmartPricingService();
  }
  return instance;
}

module.exports = {
  getSmartPricingService,
  SmartPricingService,
  STRATEGIES,
  DEFAULT_CONFIG
};
