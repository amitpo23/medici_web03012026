/**
 * ML-Based Price Prediction Service
 * 
 * Machine learning powered price prediction using:
 * - Historical pricing patterns
 * - Demand elasticity
 * - Seasonal trends
 * - Competitor behavior
 * - Market conditions
 */

const { getPool } = require('../config/database');
const logger = require('../config/logger');

class MLPricingService {
  constructor() {
    this.modelCache = new Map();
    this.predictionCache = new Map();
    this.cacheTTL = 3600000; // 1 hour
  }

  /**
   * Predict optimal price using ML model
   */
  async predictOptimalPrice(params) {
    const {
      hotelId,
      checkIn,
      checkOut,
      buyPrice,
      roomType = 'STANDARD',
      leadTimeDays,
      currentDemand = 'MEDIUM'
    } = params;

    try {
      logger.info('[ML Pricing] Predicting price', { hotelId, checkIn });

      // Get features for ML model
      const features = await this.extractFeatures({
        hotelId,
        checkIn,
        checkOut,
        buyPrice,
        roomType,
        leadTimeDays,
        currentDemand
      });

      // Run prediction models
      const [baseModel, elasticityModel, competitorModel, seasonalModel] = await Promise.all([
        this.predictBasePrice(features),
        this.predictElasticityAdjustment(features),
        this.predictCompetitorResponse(features),
        this.predictSeasonalFactor(features)
      ]);

      // Ensemble prediction
      const prediction = this.ensemblePrediction({
        base: baseModel,
        elasticity: elasticityModel,
        competitor: competitorModel,
        seasonal: seasonalModel,
        features
      });

      // Calculate confidence and bounds
      const confidence = this.calculatePredictionConfidence(prediction, features);
      const bounds = this.calculatePriceBounds(prediction, confidence);

      return {
        success: true,
        prediction: {
          optimalPrice: prediction.price,
          confidence: confidence,
          priceRange: {
            min: bounds.min,
            max: bounds.max,
            recommended: prediction.price
          },
          expectedConversion: prediction.conversionRate,
          expectedProfit: prediction.price - buyPrice,
          expectedRevenue: prediction.price * prediction.conversionRate,
          riskLevel: this.assessRisk(confidence, prediction),
          models: {
            base: baseModel.price,
            elasticity: elasticityModel.adjustment,
            competitor: competitorModel.adjustment,
            seasonal: seasonalModel.factor
          },
          features: {
            leadTime: features.leadTime,
            demand: features.demand,
            competition: features.competition,
            seasonality: features.seasonality,
            historicalPerformance: features.historicalPerformance
          }
        }
      };

    } catch (error) {
      logger.error('[ML Pricing] Prediction error', {
        error: error.message,
        hotelId
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract features for ML models
   */
  async extractFeatures(params) {
    const pool = await getPool();
    const checkInDate = new Date(params.checkIn);

    // Calculate derived features
    const leadTime = params.leadTimeDays || Math.floor(
      (checkInDate - new Date()) / (1000 * 60 * 60 * 24)
    );
    const dayOfWeek = checkInDate.getDay();
    const month = checkInDate.getMonth() + 1;
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const isHighSeason = [6, 7, 8, 12].includes(month); // Summer + December

    // Get historical data
    const [historical, competitors, demand, seasonal] = await Promise.all([
      // Historical pricing performance
      pool.request()
        .input('hotelId', params.hotelId)
        .query(`
          SELECT
            AVG(SuggestedSellPrice) as AvgPrice,
            AVG(CASE WHEN IsSale = 1 THEN 1.0 ELSE 0.0 END) as ConversionRate,
            AVG(SuggestedSellPrice - SuggestedBuyPrice) as AvgProfit,
            COUNT(*) as SampleSize
          FROM [MED_ֹOֹֹpportunities]
          WHERE HotelId = @hotelId
          AND DateCreate >= DATEADD(MONTH, -6, GETDATE())
        `),

      // Competitor pricing
      pool.request()
        .input('hotelId', params.hotelId)
        .query(`
          SELECT
            AVG(Price) as AvgCompetitorPrice,
            MIN(Price) as MinCompetitorPrice,
            MAX(Price) as MaxCompetitorPrice,
            COUNT(DISTINCT CompetitorId) as CompetitorCount
          FROM MED_CompetitorPrices
          WHERE HotelId = @hotelId
          AND ScrapedDate >= DATEADD(DAY, -7, GETDATE())
        `),

      // Demand indicators
      pool.request()
        .input('hotelId', params.hotelId)
        .query(`
          SELECT
            COUNT(*) as SearchVolume,
            AVG(CAST(ConvertedToBooking as FLOAT)) as ConversionRate
          FROM MED_SearchPatterns
          WHERE HotelId = @hotelId
          AND SearchDate >= DATEADD(DAY, -30, GETDATE())
        `),

      // Seasonal patterns
      pool.request()
        .input('hotelId', params.hotelId)
        .input('month', month)
        .query(`
          SELECT
            AVG(OccupancyRate) as AvgOccupancy,
            AVG(ADR) as AvgDailyRate
          FROM MED_HotelOccupancy
          WHERE HotelId = @hotelId
          AND MONTH(Date) = @month
          AND Date >= DATEADD(YEAR, -2, GETDATE())
        `)
    ]);

    const hist = historical.recordset[0] || {};
    const comp = competitors.recordset[0] || {};
    const dem = demand.recordset[0] || {};
    const seas = seasonal.recordset[0] || {};

    return {
      // Price features
      buyPrice: params.buyPrice,
      historicalAvgPrice: hist.AvgPrice || params.buyPrice * 1.25,
      competitorAvgPrice: comp.AvgCompetitorPrice || params.buyPrice * 1.30,
      competitorMinPrice: comp.MinCompetitorPrice || params.buyPrice * 1.15,
      competitorMaxPrice: comp.MaxCompetitorPrice || params.buyPrice * 1.50,

      // Time features
      leadTime: leadTime,
      dayOfWeek: dayOfWeek,
      month: month,
      isWeekend: isWeekend ? 1 : 0,
      isHighSeason: isHighSeason ? 1 : 0,

      // Demand features
      demand: this.normalizeDemand(params.currentDemand),
      searchVolume: dem.SearchVolume || 0,
      demandConversionRate: dem.ConversionRate || 0.5,

      // Competition features
      competition: comp.CompetitorCount || 0,
      competitivePressure: this.calculateCompetitivePressure(params.buyPrice, comp),

      // Seasonality features
      seasonality: seas.AvgOccupancy || 0.7,
      seasonalADR: seas.AvgDailyRate || params.buyPrice * 1.25,

      // Historical performance
      historicalPerformance: {
        avgProfit: hist.AvgProfit || 0,
        conversionRate: hist.ConversionRate || 0.5,
        sampleSize: hist.SampleSize || 0
      },

      // Room features
      roomType: this.encodeRoomType(params.roomType)
    };
  }

  /**
   * Base price prediction model
   */
  async predictBasePrice(features) {
    // Weighted linear regression model
    const weights = {
      buyPrice: 1.0,
      historicalAvgPrice: 0.3,
      competitorAvgPrice: 0.2,
      leadTime: -0.002,
      demand: 0.15,
      seasonality: 0.1,
      isWeekend: 0.05,
      isHighSeason: 0.08
    };

    let basePrice = features.buyPrice;

    // Historical influence
    basePrice += (features.historicalAvgPrice - features.buyPrice) * weights.historicalAvgPrice;

    // Competitor influence
    basePrice += (features.competitorAvgPrice - features.buyPrice) * weights.competitorAvgPrice;

    // Lead time influence (price drops as check-in approaches for unsold)
    const leadTimeAdjustment = features.leadTime * weights.leadTime * features.buyPrice;
    basePrice += leadTimeAdjustment;

    // Demand influence
    const demandAdjustment = (features.demand - 0.5) * weights.demand * features.buyPrice;
    basePrice += demandAdjustment;

    // Seasonality influence
    const seasonalityAdjustment = (features.seasonality - 0.7) * weights.seasonality * features.buyPrice;
    basePrice += seasonalityAdjustment;

    // Weekend premium
    if (features.isWeekend) {
      basePrice += features.buyPrice * weights.isWeekend;
    }

    // High season premium
    if (features.isHighSeason) {
      basePrice += features.buyPrice * weights.isHighSeason;
    }

    return {
      price: Math.max(basePrice, features.buyPrice * 1.10), // Min 10% margin
      confidence: this.calculateModelConfidence(features.historicalPerformance.sampleSize),
      factors: {
        historical: weights.historicalAvgPrice,
        competitor: weights.competitorAvgPrice,
        leadTime: leadTimeAdjustment,
        demand: demandAdjustment,
        seasonality: seasonalityAdjustment
      }
    };
  }

  /**
   * Price elasticity prediction model
   */
  async predictElasticityAdjustment(features) {
    // Estimate price elasticity of demand
    const elasticity = this.estimateElasticity(features);

    // Calculate optimal price adjustment based on elasticity
    let adjustment = 0;

    if (elasticity > -1.0) {
      // Inelastic demand - can increase price
      adjustment = features.buyPrice * 0.15; // Up to 15% increase
    } else if (elasticity < -2.0) {
      // Elastic demand - should decrease price
      adjustment = features.buyPrice * -0.05; // Up to 5% decrease
    } else {
      // Unitary elastic - moderate adjustment
      adjustment = features.buyPrice * 0.05;
    }

    // Adjust based on lead time
    if (features.leadTime < 7) {
      // Last minute - more elastic
      adjustment *= 0.7;
    } else if (features.leadTime > 60) {
      // Early booking - less elastic
      adjustment *= 1.2;
    }

    return {
      adjustment: adjustment,
      elasticity: elasticity,
      confidence: 0.7
    };
  }

  /**
   * Competitor response prediction model
   */
  async predictCompetitorResponse(features) {
    let adjustment = 0;

    // If we have competitor data
    if (features.competition > 0) {
      const ourPrice = features.buyPrice * 1.25; // Assumed initial price
      const competitorAvg = features.competitorAvgPrice;

      if (ourPrice > competitorAvg * 1.1) {
        // We're too expensive - need to lower
        adjustment = (competitorAvg * 1.05 - ourPrice) * 0.5;
      } else if (ourPrice < competitorAvg * 0.9) {
        // We're underpricing - can increase
        adjustment = (competitorAvg * 0.95 - ourPrice) * 0.3;
      }

      // Factor in competitive pressure
      adjustment *= (1 - features.competitivePressure * 0.3);
    }

    return {
      adjustment: adjustment,
      confidence: features.competition > 0 ? 0.8 : 0.3
    };
  }

  /**
   * Seasonal factor prediction model
   */
  async predictSeasonalFactor(features) {
    let factor = 1.0;

    // High season boost
    if (features.isHighSeason) {
      factor *= 1.15;
    }

    // Weekend boost
    if (features.isWeekend) {
      factor *= 1.08;
    }

    // Occupancy-based adjustment
    if (features.seasonality > 0.8) {
      factor *= 1.10; // High demand
    } else if (features.seasonality < 0.5) {
      factor *= 0.95; // Low demand
    }

    // Month-specific patterns
    const monthFactors = {
      1: 0.90,  // January - low
      2: 0.92,  // February - low
      3: 0.95,  // March - rising
      4: 1.05,  // April - good
      5: 1.08,  // May - good
      6: 1.15,  // June - high
      7: 1.20,  // July - peak
      8: 1.18,  // August - peak
      9: 1.05,  // September - good
      10: 1.00, // October - moderate
      11: 0.95, // November - low
      12: 1.12  // December - holidays
    };

    factor *= monthFactors[features.month] || 1.0;

    return {
      factor: factor,
      confidence: 0.85
    };
  }

  /**
   * Ensemble prediction combining all models
   */
  ensemblePrediction(models) {
    const { base, elasticity, competitor, seasonal, features } = models;

    // Start with base model
    let price = base.price;

    // Apply elasticity adjustment
    price += elasticity.adjustment;

    // Apply competitor adjustment
    price += competitor.adjustment;

    // Apply seasonal factor
    price *= seasonal.factor;

    // Ensure minimum margin
    const minPrice = features.buyPrice * 1.10; // 10% minimum
    const maxPrice = features.buyPrice * 2.0;  // 100% maximum
    price = Math.max(minPrice, Math.min(maxPrice, price));

    // Estimate conversion rate based on price positioning
    const conversionRate = this.estimateConversionRate(price, features);

    return {
      price: Math.round(price * 100) / 100, // Round to 2 decimals
      conversionRate: conversionRate,
      modelWeights: {
        base: 0.50,
        elasticity: 0.20,
        competitor: 0.20,
        seasonal: 0.10
      }
    };
  }

  /**
   * Calculate prediction confidence
   */
  calculatePredictionConfidence(prediction, features) {
    let confidence = 0.5; // Base confidence

    // More historical data = higher confidence
    if (features.historicalPerformance.sampleSize > 50) {
      confidence += 0.2;
    } else if (features.historicalPerformance.sampleSize > 20) {
      confidence += 0.1;
    }

    // Competitor data increases confidence
    if (features.competition > 3) {
      confidence += 0.15;
    } else if (features.competition > 0) {
      confidence += 0.08;
    }

    // Recent demand data
    if (features.searchVolume > 100) {
      confidence += 0.1;
    }

    // Seasonal data
    if (features.seasonality > 0) {
      confidence += 0.05;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Calculate price bounds
   */
  calculatePriceBounds(prediction, confidence) {
    const price = prediction.price;
    const variance = (1 - confidence) * 0.15; // Max 15% variance

    return {
      min: Math.round(price * (1 - variance) * 100) / 100,
      max: Math.round(price * (1 + variance) * 100) / 100
    };
  }

  /**
   * Assess pricing risk
   */
  assessRisk(confidence, prediction) {
    if (confidence >= 0.8 && prediction.conversionRate >= 0.6) {
      return 'LOW';
    } else if (confidence >= 0.6 && prediction.conversionRate >= 0.4) {
      return 'MEDIUM';
    } else {
      return 'HIGH';
    }
  }

  /**
   * Estimate price elasticity of demand
   */
  estimateElasticity(features) {
    // Factors affecting elasticity
    let elasticity = -1.2; // Base elasticity

    // Lead time affects elasticity
    if (features.leadTime < 7) {
      elasticity = -2.5; // Very elastic (last minute)
    } else if (features.leadTime > 60) {
      elasticity = -0.8; // Less elastic (early booking)
    }

    // Competition affects elasticity
    if (features.competition > 5) {
      elasticity -= 0.5; // More elastic with more competition
    }

    // Demand affects elasticity
    if (features.demand > 0.8) {
      elasticity += 0.3; // Less elastic with high demand
    }

    return elasticity;
  }

  /**
   * Estimate conversion rate
   */
  estimateConversionRate(price, features) {
    // Base conversion rate
    let conversionRate = 0.5;

    // Price competitiveness
    if (features.competitorAvgPrice > 0) {
      const priceRatio = price / features.competitorAvgPrice;
      if (priceRatio < 0.95) {
        conversionRate += 0.15; // Cheaper than competitors
      } else if (priceRatio > 1.10) {
        conversionRate -= 0.15; // More expensive
      }
    }

    // Demand influence
    conversionRate += (features.demand - 0.5) * 0.3;

    // Lead time influence
    if (features.leadTime < 7) {
      conversionRate += 0.1; // Urgency
    }

    // Historical performance
    if (features.historicalPerformance.conversionRate > 0) {
      conversionRate = conversionRate * 0.6 + features.historicalPerformance.conversionRate * 0.4;
    }

    return Math.max(0.1, Math.min(0.95, conversionRate));
  }

  // Helper functions
  normalizeDemand(demand) {
    const map = { LOW: 0.3, MEDIUM: 0.5, HIGH: 0.8, VERY_HIGH: 0.95 };
    return map[demand] || 0.5;
  }

  calculateCompetitivePressure(buyPrice, comp) {
    if (!comp.CompetitorCount || comp.CompetitorCount === 0) return 0;
    
    const avgCompPrice = comp.AvgCompetitorPrice || buyPrice * 1.3;
    const priceGap = (avgCompPrice - buyPrice) / buyPrice;
    const competitorFactor = Math.min(comp.CompetitorCount / 10, 1);
    
    return (1 - priceGap) * competitorFactor;
  }

  encodeRoomType(roomType) {
    const map = { STANDARD: 1, DELUXE: 2, SUITE: 3, EXECUTIVE: 4 };
    return map[roomType] || 1;
  }

  calculateModelConfidence(sampleSize) {
    if (sampleSize >= 100) return 0.9;
    if (sampleSize >= 50) return 0.8;
    if (sampleSize >= 20) return 0.7;
    if (sampleSize >= 10) return 0.6;
    return 0.5;
  }

  /**
   * Batch predict prices for multiple opportunities
   */
  async batchPredict(opportunities) {
    logger.info('[ML Pricing] Batch prediction', { count: opportunities.length });

    const predictions = await Promise.all(
      opportunities.map(opp => this.predictOptimalPrice(opp))
    );

    return {
      success: true,
      total: predictions.length,
      successful: predictions.filter(p => p.success).length,
      failed: predictions.filter(p => !p.success).length,
      predictions: predictions.map((p, i) => ({
        ...opportunities[i],
        prediction: p.prediction
      }))
    };
  }

  /**
   * Clear prediction cache
   */
  clearCache() {
    this.predictionCache.clear();
    logger.info('[ML Pricing] Cache cleared');
  }
}

// Singleton instance
let instance = null;

function getMLPricingService() {
  if (!instance) {
    instance = new MLPricingService();
  }
  return instance;
}

module.exports = {
  getMLPricingService,
  MLPricingService
};
