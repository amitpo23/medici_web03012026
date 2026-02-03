/**
 * Price Elasticity Analyzer
 * 
 * Analyzes demand elasticity and optimal pricing points
 */

const { getPool } = require('../config/database');
const logger = require('../config/logger');

class PriceElasticityService {
  constructor() {
    this.elasticityCache = new Map();
    this.cacheTTL = 7200000; // 2 hours
  }

  /**
   * Calculate price elasticity of demand
   */
  async calculateElasticity(hotelId, options = {}) {
    const {
      timeframe = 90, // days
      minDataPoints = 10
    } = options;

    try {
      logger.info('[Price Elasticity] Calculating elasticity', { hotelId, timeframe });

      const pool = await getPool();

      // Get historical price-demand data
      const data = await pool.request()
        .input('hotelId', hotelId)
        .input('timeframe', timeframe)
        .query(`
          SELECT
            SuggestedSellPrice as Price,
            CAST(IsSale as INT) as DidSell,
            DATEDIFF(DAY, DateCreate, CASE WHEN IsSale = 1 THEN Lastupdate ELSE GETDATE() END) as DaysToDecision,
            CASE 
              WHEN DATEPART(WEEKDAY, StartDate) IN (6, 7) THEN 1 
              ELSE 0 
            END as IsWeekend,
            DATEDIFF(DAY, DateCreate, StartDate) as LeadTime
          FROM [MED_ֹOֹֹpportunities]
          WHERE HotelId = @hotelId
          AND DateCreate >= DATEADD(DAY, -@timeframe, GETDATE())
          AND SuggestedSellPrice > 0
        `);

      if (!data.recordset || data.recordset.length < minDataPoints) {
        return {
          success: false,
          error: `Insufficient data points (${data.recordset?.length || 0} < ${minDataPoints})`
        };
      }

      // Group data into price buckets
      const buckets = this.createPriceBuckets(data.recordset);

      // Calculate elasticity for each bucket
      const elasticities = [];
      const bucketKeys = Array.from(buckets.keys()).sort((a, b) => a - b);

      for (let i = 1; i < bucketKeys.length; i++) {
        const lowPrice = bucketKeys[i - 1];
        const highPrice = bucketKeys[i];

        const lowBucket = buckets.get(lowPrice);
        const highBucket = buckets.get(highPrice);

        if (lowBucket.count >= 3 && highBucket.count >= 3) {
          const elasticity = this.computeElasticity(
            lowPrice,
            highPrice,
            lowBucket.conversionRate,
            highBucket.conversionRate
          );

          elasticities.push({
            priceRange: { low: lowPrice, high: highPrice },
            avgPrice: (lowPrice + highPrice) / 2,
            elasticity: elasticity,
            lowBucket: {
              price: lowPrice,
              conversionRate: lowBucket.conversionRate,
              sampleSize: lowBucket.count
            },
            highBucket: {
              price: highPrice,
              conversionRate: highBucket.conversionRate,
              sampleSize: highBucket.count
            }
          });
        }
      }

      // Calculate overall elasticity
      const avgElasticity = elasticities.length > 0
        ? elasticities.reduce((sum, e) => sum + e.elasticity, 0) / elasticities.length
        : -1.2; // Default elasticity

      // Determine demand type
      const demandType = this.classifyDemandType(avgElasticity);

      // Find optimal price point
      const optimalPrice = this.findOptimalPricePoint(buckets, elasticities);

      return {
        success: true,
        hotelId,
        timeframe: `${timeframe} days`,
        dataPoints: data.recordset.length,
        elasticity: {
          average: avgElasticity,
          range: {
            min: Math.min(...elasticities.map(e => e.elasticity)),
            max: Math.max(...elasticities.map(e => e.elasticity))
          },
          demandType,
          interpretation: this.interpretElasticity(avgElasticity)
        },
        priceBuckets: Array.from(buckets.entries()).map(([price, bucket]) => ({
          price,
          conversionRate: bucket.conversionRate,
          sampleSize: bucket.count,
          avgLeadTime: bucket.avgLeadTime
        })),
        optimalPrice,
        detailedElasticities: elasticities
      };

    } catch (error) {
      logger.error('[Price Elasticity] Calculation error', {
        error: error.message,
        hotelId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Recommend price based on elasticity
   */
  async recommendElasticityBasedPrice(hotelId, currentPrice, targetMetric = 'revenue') {
    try {
      const elasticityData = await this.calculateElasticity(hotelId);

      if (!elasticityData.success) {
        return elasticityData;
      }

      const { elasticity, priceBuckets } = elasticityData;

      let recommendedPrice;
      let rationale;

      if (targetMetric === 'revenue') {
        // Maximize revenue (Price × Conversion Rate)
        const revenueOptimal = this.findRevenueOptimalPrice(priceBuckets);
        recommendedPrice = revenueOptimal.price;
        rationale = `Price optimized for maximum revenue: €${revenueOptimal.expectedRevenue.toFixed(2)}`;

      } else if (targetMetric === 'profit') {
        // Maximize profit (assuming cost is fixed)
        const profitOptimal = this.findProfitOptimalPrice(priceBuckets, currentPrice * 0.7); // Assume 70% cost
        recommendedPrice = profitOptimal.price;
        rationale = `Price optimized for maximum profit: €${profitOptimal.expectedProfit.toFixed(2)}`;

      } else if (targetMetric === 'conversion') {
        // Maximize conversion rate
        const conversionOptimal = priceBuckets.reduce((best, current) =>
          current.conversionRate > best.conversionRate ? current : best
        );
        recommendedPrice = conversionOptimal.price;
        rationale = `Price optimized for conversion: ${(conversionOptimal.conversionRate * 100).toFixed(1)}%`;

      } else {
        return {
          success: false,
          error: `Unknown target metric: ${targetMetric}`
        };
      }

      // Calculate expected impact
      const currentBucket = this.findNearestBucket(priceBuckets, currentPrice);
      const recommendedBucket = this.findNearestBucket(priceBuckets, recommendedPrice);

      const impact = {
        priceChange: recommendedPrice - currentPrice,
        priceChangePercent: ((recommendedPrice - currentPrice) / currentPrice) * 100,
        conversionChange: recommendedBucket.conversionRate - currentBucket.conversionRate,
        expectedRevenue: recommendedPrice * recommendedBucket.conversionRate,
        currentRevenue: currentPrice * currentBucket.conversionRate,
        revenueChange: (recommendedPrice * recommendedBucket.conversionRate) - 
                      (currentPrice * currentBucket.conversionRate)
      };

      return {
        success: true,
        hotelId,
        currentPrice,
        recommendedPrice,
        rationale,
        elasticity: elasticity.average,
        demandType: elasticity.demandType,
        impact,
        confidence: this.calculateConfidence(currentBucket.sampleSize, recommendedBucket.sampleSize)
      };

    } catch (error) {
      logger.error('[Price Elasticity] Recommendation error', {
        error: error.message,
        hotelId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze price sensitivity by segment
   */
  async analyzeSegmentElasticity(hotelId) {
    try {
      const pool = await getPool();

      // Analyze by different segments
      const [weekendVsWeekday, earlyVsLate, seasonalAnalysis] = await Promise.all([
        // Weekend vs Weekday
        this.calculateSegmentElasticity(pool, hotelId, 'weekend'),
        
        // Early booking vs Last minute
        this.calculateSegmentElasticity(pool, hotelId, 'leadtime'),
        
        // Seasonal patterns
        this.calculateSegmentElasticity(pool, hotelId, 'seasonal')
      ]);

      return {
        success: true,
        hotelId,
        segments: {
          weekendVsWeekday,
          earlyVsLate,
          seasonal: seasonalAnalysis
        },
        insights: this.generateSegmentInsights(weekendVsWeekday, earlyVsLate, seasonalAnalysis)
      };

    } catch (error) {
      logger.error('[Price Elasticity] Segment analysis error', {
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create price buckets from data
   */
  createPriceBuckets(data, bucketSize = 25) {
    const buckets = new Map();

    for (const record of data) {
      const bucketPrice = Math.floor(record.Price / bucketSize) * bucketSize + (bucketSize / 2);

      if (!buckets.has(bucketPrice)) {
        buckets.set(bucketPrice, {
          count: 0,
          sold: 0,
          conversionRate: 0,
          totalLeadTime: 0,
          avgLeadTime: 0
        });
      }

      const bucket = buckets.get(bucketPrice);
      bucket.count++;
      bucket.sold += record.DidSell;
      bucket.totalLeadTime += record.LeadTime || 0;
    }

    // Calculate averages
    for (const [price, bucket] of buckets) {
      bucket.conversionRate = bucket.sold / bucket.count;
      bucket.avgLeadTime = bucket.totalLeadTime / bucket.count;
    }

    return buckets;
  }

  /**
   * Compute elasticity between two price points
   */
  computeElasticity(price1, price2, quantity1, quantity2) {
    const percentChangeQuantity = (quantity2 - quantity1) / quantity1;
    const percentChangePrice = (price2 - price1) / price1;

    if (percentChangePrice === 0) return 0;

    return percentChangeQuantity / percentChangePrice;
  }

  /**
   * Classify demand type based on elasticity
   */
  classifyDemandType(elasticity) {
    if (elasticity > -0.5) {
      return 'HIGHLY_INELASTIC'; // Price changes have minimal effect
    } else if (elasticity > -1.0) {
      return 'INELASTIC'; // Price increases are viable
    } else if (elasticity > -1.5) {
      return 'UNITARY'; // Proportional response
    } else if (elasticity > -2.5) {
      return 'ELASTIC'; // Price sensitive
    } else {
      return 'HIGHLY_ELASTIC'; // Very price sensitive
    }
  }

  /**
   * Interpret elasticity value
   */
  interpretElasticity(elasticity) {
    if (elasticity > -0.5) {
      return 'Demand is highly inelastic - price increases will not significantly reduce conversions. Consider premium pricing.';
    } else if (elasticity > -1.0) {
      return 'Demand is inelastic - moderate price increases are viable without major conversion loss.';
    } else if (elasticity > -1.5) {
      return 'Demand is unitary elastic - price changes proportionally affect conversions. Balance is key.';
    } else if (elasticity > -2.5) {
      return 'Demand is elastic - price-sensitive market. Competitive pricing recommended.';
    } else {
      return 'Demand is highly elastic - very price-sensitive. Lower prices significantly increase conversions.';
    }
  }

  /**
   * Find optimal price point from buckets
   */
  findOptimalPricePoint(buckets, elasticities) {
    let maxRevenue = 0;
    let optimalPrice = 0;

    for (const [price, bucket] of buckets) {
      const revenue = price * bucket.conversionRate * bucket.count;
      if (revenue > maxRevenue) {
        maxRevenue = revenue;
        optimalPrice = price;
      }
    }

    return {
      price: optimalPrice,
      expectedRevenue: maxRevenue,
      expectedConversionRate: buckets.get(optimalPrice)?.conversionRate || 0
    };
  }

  /**
   * Find revenue optimal price
   */
  findRevenueOptimalPrice(priceBuckets) {
    return priceBuckets.reduce((best, current) => {
      const currentRevenue = current.price * current.conversionRate;
      const bestRevenue = best.price * best.conversionRate;
      return currentRevenue > bestRevenue ? {
        ...current,
        expectedRevenue: currentRevenue
      } : best;
    }, priceBuckets[0]);
  }

  /**
   * Find profit optimal price
   */
  findProfitOptimalPrice(priceBuckets, cost) {
    return priceBuckets.reduce((best, current) => {
      const currentProfit = (current.price - cost) * current.conversionRate;
      const bestProfit = (best.price - cost) * best.conversionRate;
      return currentProfit > bestProfit ? {
        ...current,
        expectedProfit: currentProfit
      } : best;
    }, priceBuckets[0]);
  }

  /**
   * Find nearest price bucket
   */
  findNearestBucket(buckets, targetPrice) {
    return buckets.reduce((nearest, current) => {
      const currentDiff = Math.abs(current.price - targetPrice);
      const nearestDiff = Math.abs(nearest.price - targetPrice);
      return currentDiff < nearestDiff ? current : nearest;
    });
  }

  /**
   * Calculate segment elasticity
   */
  async calculateSegmentElasticity(pool, hotelId, segmentType) {
    let query;

    switch (segmentType) {
      case 'weekend':
        query = `
          SELECT
            CASE WHEN DATEPART(WEEKDAY, StartDate) IN (6, 7) THEN 'Weekend' ELSE 'Weekday' END as Segment,
            AVG(SuggestedSellPrice) as AvgPrice,
            AVG(CAST(IsSale as FLOAT)) as ConversionRate,
            COUNT(*) as SampleSize
          FROM [MED_ֹOֹֹpportunities]
          WHERE HotelId = @hotelId
          AND DateCreate >= DATEADD(DAY, -90, GETDATE())
          GROUP BY CASE WHEN DATEPART(WEEKDAY, StartDate) IN (6, 7) THEN 'Weekend' ELSE 'Weekday' END
        `;
        break;

      case 'leadtime':
        query = `
          SELECT
            CASE 
              WHEN DATEDIFF(DAY, DateCreate, StartDate) < 7 THEN 'Last Minute'
              WHEN DATEDIFF(DAY, DateCreate, StartDate) < 30 THEN 'Short Lead'
              ELSE 'Early Booking'
            END as Segment,
            AVG(SuggestedSellPrice) as AvgPrice,
            AVG(CAST(IsSale as FLOAT)) as ConversionRate,
            COUNT(*) as SampleSize
          FROM [MED_ֹOֹֹpportunities]
          WHERE HotelId = @hotelId
          AND DateCreate >= DATEADD(DAY, -90, GETDATE())
          GROUP BY CASE 
            WHEN DATEDIFF(DAY, DateCreate, StartDate) < 7 THEN 'Last Minute'
            WHEN DATEDIFF(DAY, DateCreate, StartDate) < 30 THEN 'Short Lead'
            ELSE 'Early Booking'
          END
        `;
        break;

      case 'seasonal':
        query = `
          SELECT
            CASE 
              WHEN MONTH(StartDate) IN (6, 7, 8) THEN 'Summer'
              WHEN MONTH(StartDate) IN (12, 1, 2) THEN 'Winter'
              ELSE 'Shoulder'
            END as Segment,
            AVG(SuggestedSellPrice) as AvgPrice,
            AVG(CAST(IsSale as FLOAT)) as ConversionRate,
            COUNT(*) as SampleSize
          FROM [MED_ֹOֹֹpportunities]
          WHERE HotelId = @hotelId
          AND DateCreate >= DATEADD(DAY, -180, GETDATE())
          GROUP BY CASE 
            WHEN MONTH(StartDate) IN (6, 7, 8) THEN 'Summer'
            WHEN MONTH(StartDate) IN (12, 1, 2) THEN 'Winter'
            ELSE 'Shoulder'
          END
        `;
        break;
    }

    const result = await pool.request()
      .input('hotelId', hotelId)
      .query(query);

    return result.recordset;
  }

  /**
   * Generate segment insights
   */
  generateSegmentInsights(weekend, leadtime, seasonal) {
    const insights = [];

    // Weekend insights
    if (weekend.length === 2) {
      const weekendData = weekend.find(s => s.Segment === 'Weekend');
      const weekdayData = weekend.find(s => s.Segment === 'Weekday');
      
      if (weekendData && weekdayData) {
        const priceDiff = ((weekendData.AvgPrice - weekdayData.AvgPrice) / weekdayData.AvgPrice) * 100;
        insights.push({
          category: 'Weekend Premium',
          message: `Weekend prices are ${priceDiff.toFixed(1)}% ${priceDiff > 0 ? 'higher' : 'lower'} than weekdays`,
          recommendation: priceDiff < 5 ? 'Consider increasing weekend prices' : 'Weekend premium is adequate'
        });
      }
    }

    // Lead time insights
    const lastMinute = leadtime.find(s => s.Segment === 'Last Minute');
    const earlyBooking = leadtime.find(s => s.Segment === 'Early Booking');
    
    if (lastMinute && earlyBooking) {
      const conversionDiff = lastMinute.ConversionRate - earlyBooking.ConversionRate;
      insights.push({
        category: 'Lead Time Strategy',
        message: `Last minute bookings convert ${(conversionDiff * 100).toFixed(1)}% ${conversionDiff > 0 ? 'better' : 'worse'}`,
        recommendation: conversionDiff > 0.1 ? 'Maintain last-minute availability' : 'Focus on early booking incentives'
      });
    }

    // Seasonal insights
    const summer = seasonal.find(s => s.Segment === 'Summer');
    const winter = seasonal.find(s => s.Segment === 'Winter');
    
    if (summer && winter) {
      const seasonalDiff = ((summer.AvgPrice - winter.AvgPrice) / winter.AvgPrice) * 100;
      insights.push({
        category: 'Seasonal Pricing',
        message: `Summer prices are ${seasonalDiff.toFixed(1)}% ${seasonalDiff > 0 ? 'higher' : 'lower'} than winter`,
        recommendation: 'Adjust pricing strategy based on seasonal demand patterns'
      });
    }

    return insights;
  }

  /**
   * Calculate confidence level
   */
  calculateConfidence(sampleSize1, sampleSize2) {
    const minSample = Math.min(sampleSize1, sampleSize2);
    
    if (minSample >= 100) return 0.95;
    if (minSample >= 50) return 0.85;
    if (minSample >= 20) return 0.70;
    if (minSample >= 10) return 0.60;
    return 0.50;
  }
}

// Singleton instance
let instance = null;

function getPriceElasticityService() {
  if (!instance) {
    instance = new PriceElasticityService();
  }
  return instance;
}

module.exports = {
  getPriceElasticityService,
  PriceElasticityService
};
