/**
 * Competitor Tracking & Response System
 * 
 * Real-time competitor monitoring with intelligent response strategies
 */

const { getPool } = require('../config/database');
const logger = require('../config/logger');
const SlackService = require('./slack-service');

class CompetitorTrackingService {
  constructor() {
    this.trackingRules = new Map();
    this.responseStrategies = this.initializeStrategies();
    this.alertThresholds = {
      priceDropPercent: 0.10,      // Alert on 10%+ price drop
      marketShareChange: 0.05,     // Alert on 5%+ market share change
      newCompetitorDays: 7,        // Alert on new competitors in last 7 days
      aggressivePricingThreshold: 0.85  // Alert if competitor prices <85% of ours
    };
  }

  /**
   * Track competitor pricing changes
   */
  async trackCompetitorChanges(hotelId, daysBack = 7) {
    try {
      logger.info('[Competitor Tracking] Analyzing changes', { hotelId, daysBack });

      const pool = await getPool();

      // Get competitor price history
      const history = await pool.request()
        .input('hotelId', hotelId)
        .input('daysBack', daysBack)
        .query(`
          SELECT
            cp.CompetitorId,
            c.CompetitorName,
            cp.Price,
            cp.ScrapedDate,
            cp.Availability,
            LAG(cp.Price) OVER (PARTITION BY cp.CompetitorId ORDER BY cp.ScrapedDate) as PreviousPrice,
            LAG(cp.ScrapedDate) OVER (PARTITION BY cp.CompetitorId ORDER BY cp.ScrapedDate) as PreviousDate
          FROM MED_CompetitorPrices cp
          LEFT JOIN MED_Competitors c ON cp.CompetitorId = c.CompetitorId
          WHERE cp.HotelId = @hotelId
          AND cp.ScrapedDate >= DATEADD(DAY, -@daysBack, GETDATE())
          ORDER BY cp.ScrapedDate DESC
        `);

      // Analyze changes
      const changes = [];
      const priceMovements = [];
      const alerts = [];

      for (const record of history.recordset) {
        if (record.PreviousPrice && record.Price !== record.PreviousPrice) {
          const change = {
            competitorId: record.CompetitorId,
            competitorName: record.CompetitorName,
            oldPrice: record.PreviousPrice,
            newPrice: record.Price,
            changeAmount: record.Price - record.PreviousPrice,
            changePercent: ((record.Price - record.PreviousPrice) / record.PreviousPrice) * 100,
            changeDate: record.ScrapedDate,
            availability: record.Availability
          };

          changes.push(change);
          priceMovements.push(change.changePercent);

          // Check for alert conditions
          if (Math.abs(change.changePercent) >= this.alertThresholds.priceDropPercent * 100) {
            alerts.push({
              type: 'SIGNIFICANT_PRICE_CHANGE',
              severity: Math.abs(change.changePercent) > 20 ? 'HIGH' : 'MEDIUM',
              competitor: change.competitorName,
              message: `${change.competitorName} ${change.changePercent > 0 ? 'increased' : 'decreased'} price by ${Math.abs(change.changePercent).toFixed(1)}%`,
              data: change
            });
          }
        }
      }

      // Calculate market statistics
      const stats = {
        totalChanges: changes.length,
        avgChangePercent: priceMovements.length > 0 ? 
          priceMovements.reduce((a, b) => a + b, 0) / priceMovements.length : 0,
        priceIncreases: changes.filter(c => c.changePercent > 0).length,
        priceDecreases: changes.filter(c => c.changePercent < 0).length,
        significantChanges: changes.filter(c => Math.abs(c.changePercent) > 10).length
      };

      return {
        success: true,
        hotelId,
        period: `${daysBack} days`,
        changes,
        stats,
        alerts,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[Competitor Tracking] Error tracking changes', {
        error: error.message,
        hotelId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze competitor pricing position
   */
  async analyzeCompetitivePosition(hotelId, ourPrice) {
    try {
      const pool = await getPool();

      // Get current competitor prices
      const competitors = await pool.request()
        .input('hotelId', hotelId)
        .query(`
          SELECT TOP 10
            cp.CompetitorId,
            c.CompetitorName,
            cp.Price,
            cp.Availability,
            cp.ScrapedDate,
            c.MarketShare
          FROM MED_CompetitorPrices cp
          LEFT JOIN MED_Competitors c ON cp.CompetitorId = c.CompetitorId
          WHERE cp.HotelId = @hotelId
          AND cp.ScrapedDate >= DATEADD(DAY, -2, GETDATE())
          ORDER BY cp.Price ASC
        `);

      if (!competitors.recordset || competitors.recordset.length === 0) {
        return {
          success: true,
          position: 'UNKNOWN',
          message: 'No competitor data available'
        };
      }

      const prices = competitors.recordset.map(c => c.Price);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      // Determine our position
      let position;
      let recommendation;
      let urgency;

      if (ourPrice <= minPrice) {
        position = 'LOWEST';
        recommendation = 'INCREASE';
        urgency = 'LOW';
      } else if (ourPrice >= maxPrice) {
        position = 'HIGHEST';
        recommendation = 'DECREASE';
        urgency = 'HIGH';
      } else if (ourPrice < avgPrice * 0.95) {
        position = 'BELOW_AVERAGE';
        recommendation = 'INCREASE';
        urgency = 'LOW';
      } else if (ourPrice > avgPrice * 1.05) {
        position = 'ABOVE_AVERAGE';
        recommendation = 'DECREASE';
        urgency = 'MEDIUM';
      } else {
        position = 'COMPETITIVE';
        recommendation = 'MAINTAIN';
        urgency = 'NONE';
      }

      // Calculate optimal competitive price
      const suggestedPrice = this.calculateCompetitivePrice(ourPrice, prices, position);

      return {
        success: true,
        hotelId,
        ourPrice,
        position,
        recommendation,
        urgency,
        suggestedPrice,
        market: {
          avgPrice,
          minPrice,
          maxPrice,
          competitorCount: competitors.recordset.length,
          priceRange: maxPrice - minPrice,
          ourPriceVsAvg: ((ourPrice - avgPrice) / avgPrice * 100).toFixed(1) + '%'
        },
        competitors: competitors.recordset.map(c => ({
          name: c.CompetitorName,
          price: c.Price,
          availability: c.Availability,
          marketShare: c.MarketShare,
          priceDiff: c.Price - ourPrice
        }))
      };

    } catch (error) {
      logger.error('[Competitor Tracking] Position analysis error', {
        error: error.message,
        hotelId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Recommend response strategy to competitor actions
   */
  async recommendResponseStrategy(hotelId, competitorChange) {
    try {
      const { competitorId, oldPrice, newPrice, changePercent } = competitorChange;

      // Get our current pricing
      const pool = await getPool();
      const ourOpportunities = await pool.request()
        .input('hotelId', hotelId)
        .query(`
          SELECT TOP 1
            SuggestedSellPrice,
            AIConfidence,
            AIRiskLevel
          FROM [MED_ֹOֹֹpportunities]
          WHERE HotelId = @hotelId
          AND IsActive = 1
          AND IsSale = 0
          ORDER BY DateCreate DESC
        `);

      if (!ourOpportunities.recordset || ourOpportunities.recordset.length === 0) {
        return {
          success: false,
          message: 'No active opportunities found'
        };
      }

      const ourPrice = ourOpportunities.recordset[0].SuggestedSellPrice;

      // Determine strategy based on change type and magnitude
      let strategy;

      if (changePercent < -15) {
        // Aggressive price drop
        strategy = this.responseStrategies.AGGRESSIVE_MATCH;
      } else if (changePercent < -5) {
        // Moderate price drop
        strategy = this.responseStrategies.SELECTIVE_MATCH;
      } else if (changePercent > 10) {
        // Price increase
        strategy = this.responseStrategies.OPPORTUNISTIC_INCREASE;
      } else {
        // Small change
        strategy = this.responseStrategies.MONITOR_ONLY;
      }

      // Calculate recommended action
      const action = strategy.calculate(ourPrice, newPrice, changePercent);

      return {
        success: true,
        hotelId,
        competitorId,
        competitorChange: {
          oldPrice,
          newPrice,
          changePercent
        },
        ourCurrentPrice: ourPrice,
        strategy: strategy.name,
        action: action,
        rationale: strategy.rationale,
        urgency: strategy.urgency
      };

    } catch (error) {
      logger.error('[Competitor Tracking] Strategy recommendation error', {
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Detect new competitors
   */
  async detectNewCompetitors(hotelId, daysBack = 7) {
    try {
      const pool = await getPool();

      const newCompetitors = await pool.request()
        .input('hotelId', hotelId)
        .input('daysBack', daysBack)
        .query(`
          SELECT
            c.CompetitorId,
            c.CompetitorName,
            MIN(cp.ScrapedDate) as FirstSeen,
            AVG(cp.Price) as AvgPrice,
            COUNT(*) as PricePoints
          FROM MED_CompetitorPrices cp
          JOIN MED_Competitors c ON cp.CompetitorId = c.CompetitorId
          WHERE cp.HotelId = @hotelId
          AND cp.ScrapedDate >= DATEADD(DAY, -@daysBack, GETDATE())
          GROUP BY c.CompetitorId, c.CompetitorName
          HAVING MIN(cp.ScrapedDate) >= DATEADD(DAY, -@daysBack, GETDATE())
        `);

      const competitors = newCompetitors.recordset;

      if (competitors.length > 0) {
        // Send alert
        await this.sendNewCompetitorAlert(hotelId, competitors);
      }

      return {
        success: true,
        hotelId,
        period: `${daysBack} days`,
        newCompetitors: competitors,
        count: competitors.length
      };

    } catch (error) {
      logger.error('[Competitor Tracking] New competitor detection error', {
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate market share trends
   */
  async calculateMarketShareTrends(hotelId, weeks = 4) {
    try {
      const pool = await getPool();

      const trends = await pool.request()
        .input('hotelId', hotelId)
        .input('weeks', weeks)
        .query(`
          SELECT
            c.CompetitorName,
            DATEPART(WEEK, sp.SearchDate) as Week,
            COUNT(*) as Searches,
            SUM(CAST(sp.ConvertedToBooking as INT)) as Conversions,
            CAST(SUM(CAST(sp.ConvertedToBooking as INT)) as FLOAT) / COUNT(*) as ConversionRate
          FROM MED_SearchPatterns sp
          LEFT JOIN MED_Competitors c ON sp.CompetitorId = c.CompetitorId
          WHERE sp.HotelId = @hotelId
          AND sp.SearchDate >= DATEADD(WEEK, -@weeks, GETDATE())
          GROUP BY c.CompetitorName, DATEPART(WEEK, sp.SearchDate)
          ORDER BY Week DESC, Conversions DESC
        `);

      // Calculate market share changes
      const weeklyData = {};
      
      for (const record of trends.recordset) {
        if (!weeklyData[record.Week]) {
          weeklyData[record.Week] = [];
        }
        weeklyData[record.Week].push(record);
      }

      return {
        success: true,
        hotelId,
        period: `${weeks} weeks`,
        weeklyData,
        trends: trends.recordset
      };

    } catch (error) {
      logger.error('[Competitor Tracking] Market share trends error', {
        error: error.message
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Initialize response strategies
   */
  initializeStrategies() {
    return {
      AGGRESSIVE_MATCH: {
        name: 'Aggressive Match',
        rationale: 'Competitor made significant price drop - match to maintain market share',
        urgency: 'HIGH',
        calculate: (ourPrice, theirPrice, changePercent) => ({
          newPrice: theirPrice * 0.98, // Beat by 2%
          adjustment: (theirPrice * 0.98) - ourPrice,
          adjustmentPercent: (((theirPrice * 0.98) - ourPrice) / ourPrice) * 100,
          action: 'MATCH_AND_BEAT'
        })
      },

      SELECTIVE_MATCH: {
        name: 'Selective Match',
        rationale: 'Moderate competitor price drop - partially match based on our position',
        urgency: 'MEDIUM',
        calculate: (ourPrice, theirPrice, changePercent) => {
          const targetPrice = theirPrice * 1.02; // Match within 2%
          const maxDrop = ourPrice * 0.10; // Max 10% drop
          const newPrice = Math.max(targetPrice, ourPrice - maxDrop);
          
          return {
            newPrice,
            adjustment: newPrice - ourPrice,
            adjustmentPercent: ((newPrice - ourPrice) / ourPrice) * 100,
            action: 'PARTIAL_MATCH'
          };
        }
      },

      OPPORTUNISTIC_INCREASE: {
        name: 'Opportunistic Increase',
        rationale: 'Competitor increased price - opportunity to increase ours',
        urgency: 'LOW',
        calculate: (ourPrice, theirPrice, changePercent) => {
          const increasePercent = Math.min(changePercent * 0.5, 8); // Max 8% increase
          const newPrice = ourPrice * (1 + increasePercent / 100);
          
          return {
            newPrice,
            adjustment: newPrice - ourPrice,
            adjustmentPercent: increasePercent,
            action: 'MODERATE_INCREASE'
          };
        }
      },

      MONITOR_ONLY: {
        name: 'Monitor Only',
        rationale: 'Small change - continue monitoring without immediate action',
        urgency: 'NONE',
        calculate: (ourPrice, theirPrice, changePercent) => ({
          newPrice: ourPrice,
          adjustment: 0,
          adjustmentPercent: 0,
          action: 'NO_CHANGE'
        })
      }
    };
  }

  /**
   * Calculate competitive price
   */
  calculateCompetitivePrice(ourPrice, competitorPrices, position) {
    const avgPrice = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
    const minPrice = Math.min(...competitorPrices);

    switch (position) {
      case 'HIGHEST':
        // Drop to competitive level
        return Math.round(avgPrice * 1.02 * 100) / 100; // 2% above average

      case 'ABOVE_AVERAGE':
        // Drop slightly
        return Math.round(avgPrice * 1.05 * 100) / 100; // 5% above average

      case 'LOWEST':
        // Can increase
        return Math.round(minPrice * 1.05 * 100) / 100; // 5% above minimum

      case 'BELOW_AVERAGE':
        // Increase to average
        return Math.round(avgPrice * 0.98 * 100) / 100; // 2% below average

      case 'COMPETITIVE':
      default:
        // Maintain
        return ourPrice;
    }
  }

  /**
   * Send new competitor alert
   */
  async sendNewCompetitorAlert(hotelId, competitors) {
    const message = `🆕 **New Competitors Detected**\n\n` +
      `Hotel ID: ${hotelId}\n` +
      `Count: ${competitors.length}\n\n` +
      competitors.map(c => 
        `• ${c.CompetitorName}\n  First seen: ${c.FirstSeen}\n  Avg price: €${c.AvgPrice.toFixed(2)}`
      ).join('\n');

    await SlackService.sendMessage(message);
  }

  /**
   * Send price change alert
   */
  async sendPriceChangeAlert(hotelId, alerts) {
    if (alerts.length === 0) return;

    const message = `⚠️ **Significant Competitor Price Changes**\n\n` +
      `Hotel ID: ${hotelId}\n` +
      `Changes: ${alerts.length}\n\n` +
      alerts.map(a => 
        `• ${a.competitor}: ${a.message}\n  Severity: ${a.severity}`
      ).join('\n');

    await SlackService.sendMessage(message);
  }
}

// Singleton instance
let instance = null;

function getCompetitorTrackingService() {
  if (!instance) {
    instance = new CompetitorTrackingService();
  }
  return instance;
}

module.exports = {
  getCompetitorTrackingService,
  CompetitorTrackingService
};
