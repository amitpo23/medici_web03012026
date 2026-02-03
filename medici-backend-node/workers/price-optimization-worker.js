/**
 * Price Optimization Worker
 * 
 * Continuously monitors and optimizes opportunity prices:
 * - Scans active opportunities
 * - Recalculates optimal prices based on current market
 * - Auto-adjusts prices when market changes significantly
 * - Runs A/B tests on pricing strategies
 * - Tracks performance and learns from outcomes
 * 
 * Runs every 2 hours
 */

const { getPool } = require('../config/database');
const { getSmartPricingService, STRATEGIES } = require('../services/smart-pricing-service');
const logger = require('../config/logger');
const SlackService = require('../services/slack-service');

// Configuration
const CONFIG = {
  SCAN_INTERVAL_HOURS: 2,
  MAX_OPPORTUNITIES_PER_RUN: 50,
  MIN_PRICE_CHANGE_PERCENT: 0.05,  // 5% minimum change to update
  AUTO_UPDATE_CONFIDENCE_THRESHOLD: 0.80,  // 80% confidence to auto-update
  DAYS_BEFORE_CHECKIN_THRESHOLD: 3,  // Only optimize if 3+ days away
  AB_TEST_ENABLED: true,
  AB_TEST_SAMPLE_SIZE: 0.20  // 20% of opportunities for A/B testing
};

class PriceOptimizationWorker {
  constructor() {
    this.pricingService = getSmartPricingService();
    this.stats = {
      scanned: 0,
      optimized: 0,
      autoUpdated: 0,
      abTested: 0,
      totalPriceDiff: 0,
      errors: 0
    };
  }

  /**
   * Main worker execution
   */
  async run() {
    const startTime = Date.now();
    
    logger.info('[Price Optimization] Worker starting', {
      maxOpportunities: CONFIG.MAX_OPPORTUNITIES_PER_RUN,
      minChangePercent: CONFIG.MIN_PRICE_CHANGE_PERCENT
    });

    try {
      const pool = await getPool();

      // Get active opportunities to optimize
      const opportunities = await this.getOpportunitiesToOptimize(pool);
      
      if (opportunities.length === 0) {
        logger.info('[Price Optimization] No opportunities to optimize');
        return;
      }

      logger.info('[Price Optimization] Found opportunities to optimize', {
        count: opportunities.length
      });

      // Process each opportunity
      for (const opp of opportunities) {
        await this.optimizeOpportunity(opp, pool);
        
        // Small delay to avoid overwhelming the system
        await this.sleep(200);
      }

      // Send summary notification
      await this.sendSummaryNotification(startTime);

      logger.info('[Price Optimization] Worker completed', {
        duration: Date.now() - startTime,
        stats: this.stats
      });

    } catch (error) {
      logger.error('[Price Optimization] Worker error', { error: error.message });
      await this.sendErrorNotification(error);
    }
  }

  /**
   * Get opportunities that need price optimization
   */
  async getOpportunitiesToOptimize(pool) {
    try {
      const result = await pool.request()
        .input('maxOpportunities', CONFIG.MAX_OPPORTUNITIES_PER_RUN)
        .input('daysThreshold', CONFIG.DAYS_BEFORE_CHECKIN_THRESHOLD)
        .query(`
          -- Get active opportunities that haven't been optimized recently
          SELECT TOP (@maxOpportunities)
            o.OpportunityId,
            o.DestinationsId as HotelId,
            h.Name as HotelName,
            o.DateForm as CheckIn,
            o.DateTo as CheckOut,
            o.Price as BuyPrice,
            o.PushPrice as CurrentSellPrice,
            o.CategoryId as RoomCategoryId,
            o.BoardId,
            o.AIGenerated,
            o.AIConfidence,
            o.AIPriorityScore,
            DATEDIFF(DAY, GETDATE(), o.DateForm) as DaysUntilCheckIn,
            DATEDIFF(HOUR, o.Lastupdate, GETDATE()) as HoursSinceUpdate
          FROM [MED_ֹOֹֹpportunities] o
          LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
          WHERE o.IsActive = 1
          AND o.IsSale = 0
          AND o.DateForm > DATEADD(DAY, @daysThreshold, GETDATE())  -- At least 3 days away
          AND o.DateForm < DATEADD(DAY, 90, GETDATE())  -- Within next 90 days
          AND o.Price > 0
          AND o.PushPrice > 0
          AND (
            o.Lastupdate < DATEADD(HOUR, -6, GETDATE())  -- Not updated in last 6 hours
            OR o.AIGenerated = 1  -- Prioritize AI-generated
          )
          ORDER BY
            CASE WHEN o.AIGenerated = 1 THEN 0 ELSE 1 END,  -- AI opportunities first
            o.AIPriorityScore DESC,  -- Higher priority first
            o.Lastupdate ASC  -- Oldest updates first
        `);

      return result.recordset;

    } catch (error) {
      logger.error('[Price Optimization] Failed to get opportunities', { 
        error: error.message 
      });
      return [];
    }
  }

  /**
   * Optimize single opportunity
   */
  async optimizeOpportunity(opp, pool) {
    this.stats.scanned++;

    try {
      // Determine strategy
      const strategy = await this.selectStrategy(opp, pool);

      // Calculate optimal price
      const pricing = await this.pricingService.calculateOptimalPrice({
        hotelId: opp.HotelId,
        checkIn: opp.CheckIn,
        checkOut: opp.CheckOut,
        buyPrice: opp.BuyPrice,
        currentSellPrice: opp.CurrentSellPrice,
        roomCategory: opp.RoomCategoryId,
        boardType: opp.BoardId
      }, strategy);

      if (!pricing.success) {
        logger.warn('[Price Optimization] Pricing failed', {
          opportunityId: opp.OpportunityId,
          error: pricing.error
        });
        this.stats.errors++;
        return;
      }

      // Check if price change is significant
      const priceDiff = pricing.recommendedSellPrice - opp.CurrentSellPrice;
      const changePercent = Math.abs(priceDiff / opp.CurrentSellPrice);

      if (changePercent < CONFIG.MIN_PRICE_CHANGE_PERCENT) {
        logger.debug('[Price Optimization] Price change too small', {
          opportunityId: opp.OpportunityId,
          currentPrice: opp.CurrentSellPrice,
          newPrice: pricing.recommendedSellPrice,
          changePercent: (changePercent * 100).toFixed(2) + '%'
        });
        return;
      }

      this.stats.optimized++;
      this.stats.totalPriceDiff += priceDiff;

      // Decide whether to auto-update
      const shouldAutoUpdate = this.shouldAutoUpdate(pricing, opp, changePercent);

      if (shouldAutoUpdate) {
        await this.applyPriceUpdate(opp.OpportunityId, pricing, strategy, pool);
        this.stats.autoUpdated++;
      } else {
        // Log optimization suggestion for manual review
        await this.logOptimizationSuggestion(opp.OpportunityId, pricing, strategy, pool);
      }

      // A/B testing
      if (CONFIG.AB_TEST_ENABLED && Math.random() < CONFIG.AB_TEST_SAMPLE_SIZE) {
        await this.enrollInABTest(opp.OpportunityId, pricing, strategy, pool);
        this.stats.abTested++;
      }

    } catch (error) {
      logger.error('[Price Optimization] Optimization failed', {
        opportunityId: opp.OpportunityId,
        error: error.message
      });
      this.stats.errors++;
    }
  }

  /**
   * Select pricing strategy based on opportunity characteristics
   */
  async selectStrategy(opp, pool) {
    // Check if opportunity is in A/B test
    const abTest = await this.getActiveABTest(opp.OpportunityId, pool);
    if (abTest) {
      return abTest.strategy;
    }

    // Default strategy based on days until check-in and AI confidence
    if (opp.DaysUntilCheckIn <= 7) {
      return STRATEGIES.CONSERVATIVE;  // Last minute - prioritize conversion
    }

    if (opp.AIConfidence >= 0.85) {
      return STRATEGIES.AGGRESSIVE;  // High confidence - maximize profit
    }

    if (opp.DaysUntilCheckIn > 30) {
      return STRATEGIES.BALANCED;  // Long lead time - balanced approach
    }

    return STRATEGIES.BALANCED;  // Default
  }

  /**
   * Determine if price should be auto-updated
   */
  shouldAutoUpdate(pricing, opp, changePercent) {
    // Auto-update criteria:
    // 1. High confidence (>80%)
    // 2. Low risk
    // 3. Price increase <15% OR price decrease with good reason
    // 4. At least 5 days before check-in

    if (pricing.confidence < CONFIG.AUTO_UPDATE_CONFIDENCE_THRESHOLD) {
      return false;
    }

    if (pricing.risk === 'HIGH') {
      return false;
    }

    if (opp.DaysUntilCheckIn < 5) {
      return false;  // Too close - require manual approval
    }

    // Allow price increases up to 15%
    if (pricing.recommendedSellPrice > opp.CurrentSellPrice) {
      return changePercent <= 0.15;
    }

    // Allow price decreases if demand is low or competition is high
    if (pricing.recommendedSellPrice < opp.CurrentSellPrice) {
      const hasGoodReason = 
        pricing.market?.demand?.level === 'low' ||
        pricing.market?.competitors?.position === 'above-market';
      return hasGoodReason;
    }

    return true;
  }

  /**
   * Apply price update to opportunity
   */
  async applyPriceUpdate(opportunityId, pricing, strategy, pool) {
    try {
      // Update opportunity price
      await pool.request()
        .input('opportunityId', opportunityId)
        .input('newPrice', pricing.recommendedSellPrice)
        .query(`
          UPDATE [MED_ֹOֹֹpportunities]
          SET PushPrice = @newPrice,
              Lastupdate = GETDATE()
          WHERE OpportunityId = @opportunityId
        `);

      // Log price change
      await pool.request()
        .input('opportunityId', opportunityId)
        .input('action', 'PRICE_OPTIMIZED')
        .input('details', JSON.stringify({
          oldPrice: pricing.currentSellPrice,
          newPrice: pricing.recommendedSellPrice,
          priceDiff: pricing.recommendedSellPrice - pricing.currentSellPrice,
          strategy,
          confidence: pricing.confidence,
          risk: pricing.risk,
          autoUpdated: true,
          market: pricing.market,
          timestamp: new Date().toISOString()
        }))
        .query(`
          INSERT INTO MED_OpportunityLogs (OpportunityId, Action, Details, CreatedAt)
          VALUES (@opportunityId, @action, @details, GETDATE())
        `);

      logger.info('[Price Optimization] Price updated', {
        opportunityId,
        oldPrice: pricing.currentSellPrice,
        newPrice: pricing.recommendedSellPrice,
        strategy
      });

    } catch (error) {
      logger.error('[Price Optimization] Failed to apply price update', {
        opportunityId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Log optimization suggestion for manual review
   */
  async logOptimizationSuggestion(opportunityId, pricing, strategy, pool) {
    try {
      await pool.request()
        .input('opportunityId', opportunityId)
        .input('action', 'PRICE_SUGGESTION')
        .input('details', JSON.stringify({
          currentPrice: pricing.currentSellPrice,
          suggestedPrice: pricing.recommendedSellPrice,
          priceDiff: pricing.recommendedSellPrice - pricing.currentSellPrice,
          strategy,
          confidence: pricing.confidence,
          risk: pricing.risk,
          market: pricing.market,
          requiresManualReview: true,
          timestamp: new Date().toISOString()
        }))
        .query(`
          INSERT INTO MED_OpportunityLogs (OpportunityId, Action, Details, CreatedAt)
          VALUES (@opportunityId, @action, @details, GETDATE())
        `);

    } catch (error) {
      logger.error('[Price Optimization] Failed to log suggestion', {
        opportunityId,
        error: error.message
      });
    }
  }

  /**
   * Enroll opportunity in A/B test
   */
  async enrollInABTest(opportunityId, pricing, strategy, pool) {
    try {
      // Randomly select variant (control vs test)
      const variant = Math.random() < 0.5 ? 'control' : 'test';
      
      const testPrice = variant === 'test' 
        ? pricing.recommendedSellPrice 
        : pricing.currentSellPrice;

      await pool.request()
        .input('opportunityId', opportunityId)
        .input('variant', variant)
        .input('strategy', strategy)
        .input('testPrice', testPrice)
        .input('controlPrice', pricing.currentSellPrice)
        .query(`
          INSERT INTO MED_ABTests (
            OpportunityId, 
            TestType, 
            Variant, 
            Strategy,
            TestPrice, 
            ControlPrice, 
            StartDate,
            IsActive
          )
          VALUES (
            @opportunityId, 
            'PRICING', 
            @variant, 
            @strategy,
            @testPrice, 
            @controlPrice, 
            GETDATE(),
            1
          )
        `);

      logger.info('[Price Optimization] A/B test enrolled', {
        opportunityId,
        variant,
        strategy
      });

    } catch (error) {
      // A/B tests table might not exist yet - fail gracefully
      logger.warn('[Price Optimization] A/B test enrollment failed', {
        opportunityId,
        error: error.message
      });
    }
  }

  /**
   * Get active A/B test for opportunity
   */
  async getActiveABTest(opportunityId, pool) {
    try {
      const result = await pool.request()
        .input('opportunityId', opportunityId)
        .query(`
          SELECT TOP 1 Strategy, Variant
          FROM MED_ABTests
          WHERE OpportunityId = @opportunityId
          AND IsActive = 1
          AND EndDate IS NULL
          ORDER BY StartDate DESC
        `);

      return result.recordset.length > 0 ? result.recordset[0] : null;

    } catch (error) {
      return null;
    }
  }

  /**
   * Send summary notification
   */
  async sendSummaryNotification(startTime) {
    if (this.stats.optimized === 0) {
      return;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgPriceDiff = this.stats.totalPriceDiff / this.stats.optimized;

    const message = `💰 *Price Optimization Complete*

📊 *Results:*
• Scanned: ${this.stats.scanned} opportunities
• Optimized: ${this.stats.optimized} opportunities
• Auto-Updated: ${this.stats.autoUpdated} prices
• A/B Tests: ${this.stats.abTested} enrolled

💵 *Price Changes:*
• Avg Price Adjustment: €${avgPriceDiff.toFixed(2)}
• Total Impact: €${this.stats.totalPriceDiff.toFixed(2)}

⏱️ *Duration:* ${duration}s
${this.stats.errors > 0 ? `⚠️ *Errors:* ${this.stats.errors}` : ''}`;

    try {
      await SlackService.sendMessage(message, '#medici-pricing');
    } catch (error) {
      logger.warn('[Price Optimization] Failed to send Slack notification', {
        error: error.message
      });
    }
  }

  /**
   * Send error notification
   */
  async sendErrorNotification(error) {
    const message = `🚨 *Price Optimization Worker Failed*

❌ *Error:* ${error.message}

Please check logs for details.`;

    try {
      await SlackService.sendMessage(message, '#medici-alerts');
    } catch (err) {
      logger.warn('[Price Optimization] Failed to send error notification', {
        error: err.message
      });
    }
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  logger.info('[Price Optimization] Worker initializing');

  const worker = new PriceOptimizationWorker();
  
  try {
    await worker.run();
    process.exit(0);
  } catch (error) {
    logger.error('[Price Optimization] Fatal error', { error: error.message });
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { PriceOptimizationWorker };
