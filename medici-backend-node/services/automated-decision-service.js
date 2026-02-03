/**
 * Automated Decision Workflow Service
 * 
 * Rule-based automation for common business scenarios
 */

const { getPool } = require('../config/database');
const { getAIDiscoveryService } = require('./ai-opportunity-discovery');
const { getSmartPricingService } = require('./smart-pricing-service');
const logger = require('../config/logger');
const SlackService = require('./slack-service');

// Decision rules
const DECISION_RULES = {
  // Auto-approve high-confidence opportunities
  AUTO_APPROVE_HIGH_CONFIDENCE: {
    id: 'auto_approve_high_confidence',
    name: 'Auto-approve High Confidence Opportunities',
    condition: (opp) => opp.AIConfidence >= 0.90 && opp.AIRiskLevel === 'LOW' && opp.profitMargin >= 0.20,
    action: 'APPROVE',
    enabled: true
  },

  // Auto-reject low-margin opportunities
  AUTO_REJECT_LOW_MARGIN: {
    id: 'auto_reject_low_margin',
    name: 'Auto-reject Low Margin Opportunities',
    condition: (opp) => opp.profitMargin < 0.10 && opp.AIConfidence < 0.70,
    action: 'REJECT',
    reason: 'Insufficient margin and confidence',
    enabled: true
  },

  // Escalate medium confidence for review
  ESCALATE_MEDIUM_CONFIDENCE: {
    id: 'escalate_medium_confidence',
    name: 'Escalate Medium Confidence for Review',
    condition: (opp) => opp.AIConfidence >= 0.70 && opp.AIConfidence < 0.85 && opp.profitMargin >= 0.15,
    action: 'ESCALATE',
    escalateTo: 'senior_trader',
    enabled: true
  },

  // Auto-optimize stale prices
  AUTO_OPTIMIZE_STALE: {
    id: 'auto_optimize_stale',
    name: 'Auto-optimize Stale Prices',
    condition: (opp) => {
      const daysSinceUpdate = (Date.now() - new Date(opp.Lastupdate).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 7 && opp.IsActive && !opp.IsSale;
    },
    action: 'OPTIMIZE_PRICE',
    enabled: true
  },

  // Alert on high-value opportunities
  ALERT_HIGH_VALUE: {
    id: 'alert_high_value',
    name: 'Alert on High Value Opportunities',
    condition: (opp) => {
      const profit = opp.SuggestedSellPrice - opp.SuggestedBuyPrice;
      return profit > 200 && opp.AIConfidence >= 0.80;
    },
    action: 'ALERT',
    channel: 'high-value-opportunities',
    enabled: true
  },

  // Auto-activate ready opportunities
  AUTO_ACTIVATE_READY: {
    id: 'auto_activate_ready',
    name: 'Auto-activate Ready Opportunities',
    condition: (opp) => !opp.IsActive && opp.AIConfidence >= 0.85 && opp.AIRiskLevel !== 'HIGH',
    action: 'ACTIVATE',
    enabled: true
  }
};

class AutomatedDecisionService {
  constructor() {
    this.discoveryService = getAIDiscoveryService();
    this.pricingService = getSmartPricingService();
    this.decisionHistory = [];
  }

  /**
   * Process opportunity through decision rules
   */
  async processOpportunity(opportunityId) {
    try {
      logger.info('[Decision Workflow] Processing opportunity', { opportunityId });

      // Get opportunity details
      const opportunity = await this.getOpportunity(opportunityId);
      if (!opportunity) {
        return { success: false, error: 'Opportunity not found' };
      }

      // Apply decision rules
      const decisions = [];
      for (const rule of Object.values(DECISION_RULES)) {
        if (!rule.enabled) continue;

        if (rule.condition(opportunity)) {
          const decision = await this.executeRule(rule, opportunity);
          decisions.push(decision);

          // Log decision
          await this.logDecision(opportunityId, rule, decision);
        }
      }

      return {
        success: true,
        opportunityId,
        decisionsApplied: decisions.length,
        decisions
      };

    } catch (error) {
      logger.error('[Decision Workflow] Process error', {
        error: error.message,
        opportunityId
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute decision rule
   */
  async executeRule(rule, opportunity) {
    logger.info('[Decision Workflow] Executing rule', {
      rule: rule.id,
      opportunityId: opportunity.OpportunityId
    });

    const decision = {
      ruleId: rule.id,
      ruleName: rule.name,
      action: rule.action,
      timestamp: new Date().toISOString()
    };

    try {
      switch (rule.action) {
        case 'APPROVE':
          await this.approveOpportunity(opportunity);
          decision.result = 'APPROVED';
          break;

        case 'REJECT':
          await this.rejectOpportunity(opportunity, rule.reason);
          decision.result = 'REJECTED';
          decision.reason = rule.reason;
          break;

        case 'ESCALATE':
          await this.escalateOpportunity(opportunity, rule.escalateTo);
          decision.result = 'ESCALATED';
          decision.escalatedTo = rule.escalateTo;
          break;

        case 'OPTIMIZE_PRICE':
          const optimization = await this.optimizePrice(opportunity);
          decision.result = 'OPTIMIZED';
          decision.optimization = optimization;
          break;

        case 'ALERT':
          await this.sendAlert(opportunity, rule.channel);
          decision.result = 'ALERTED';
          decision.channel = rule.channel;
          break;

        case 'ACTIVATE':
          await this.activateOpportunity(opportunity);
          decision.result = 'ACTIVATED';
          break;

        default:
          decision.result = 'UNKNOWN_ACTION';
      }

      decision.success = true;

    } catch (error) {
      logger.error('[Decision Workflow] Rule execution error', {
        error: error.message,
        rule: rule.id
      });
      decision.success = false;
      decision.error = error.message;
    }

    return decision;
  }

  /**
   * Approve opportunity
   */
  async approveOpportunity(opportunity) {
    const pool = await getPool();
    await pool.request()
      .input('opportunityId', opportunity.OpportunityId)
      .query(`
        UPDATE [MED_ֹOֹֹpportunities]
        SET IsActive = 1, Lastupdate = GETDATE()
        WHERE OpportunityId = @opportunityId
      `);

    await this.logAction(opportunity.OpportunityId, 'AUTO_APPROVED', 'Approved by decision workflow');
  }

  /**
   * Reject opportunity
   */
  async rejectOpportunity(opportunity, reason) {
    const pool = await getPool();
    await pool.request()
      .input('opportunityId', opportunity.OpportunityId)
      .query(`
        UPDATE [MED_ֹOֹֹpportunities]
        SET IsActive = 0, Lastupdate = GETDATE()
        WHERE OpportunityId = @opportunityId
      `);

    await this.logAction(opportunity.OpportunityId, 'AUTO_REJECTED', reason);
  }

  /**
   * Escalate opportunity for manual review
   */
  async escalateOpportunity(opportunity, escalateTo) {
    // Create alert
    const pool = await getPool();
    await pool.request()
      .input('alertType', 'ESCALATION')
      .input('severity', 'MEDIUM')
      .input('message', `Opportunity ${opportunity.OpportunityId} requires review`)
      .input('relatedEntity', 'OPPORTUNITY')
      .input('relatedId', opportunity.OpportunityId)
      .query(`
        INSERT INTO MED_Alerts (AlertType, Severity, Message, RelatedEntity, RelatedId, IsActive)
        VALUES (@alertType, @severity, @message, @relatedEntity, @relatedId, 1)
      `);

    // Notify via Slack
    await SlackService.sendMessage(
      `🔔 *Escalation Required*\n\n` +
      `Opportunity: ${opportunity.OpportunityId}\n` +
      `Hotel: ${opportunity.HotelName}\n` +
      `Profit: €${(opportunity.SuggestedSellPrice - opportunity.SuggestedBuyPrice).toFixed(2)}\n` +
      `Confidence: ${(opportunity.AIConfidence * 100).toFixed(0)}%\n` +
      `Assigned to: ${escalateTo}`
    );

    await this.logAction(opportunity.OpportunityId, 'ESCALATED', `Escalated to ${escalateTo}`);
  }

  /**
   * Optimize opportunity price
   */
  async optimizePrice(opportunity) {
    const pricing = await this.pricingService.calculateOptimalPrice({
      hotelId: opportunity.HotelId,
      checkIn: opportunity.StartDate,
      checkOut: opportunity.EndDate,
      buyPrice: opportunity.SuggestedBuyPrice
    }, 'balanced');

    if (pricing.success && pricing.confidence >= 0.75) {
      // Update price
      const pool = await getPool();
      await pool.request()
        .input('opportunityId', opportunity.OpportunityId)
        .input('newPrice', pricing.recommendedSellPrice)
        .query(`
          UPDATE [MED_ֹOֹֹpportunities]
          SET SuggestedSellPrice = @newPrice, Lastupdate = GETDATE()
          WHERE OpportunityId = @opportunityId
        `);

      await this.logAction(
        opportunity.OpportunityId,
        'PRICE_AUTO_OPTIMIZED',
        `Updated from €${opportunity.SuggestedSellPrice} to €${pricing.recommendedSellPrice}`
      );

      return {
        oldPrice: opportunity.SuggestedSellPrice,
        newPrice: pricing.recommendedSellPrice,
        change: pricing.recommendedSellPrice - opportunity.SuggestedSellPrice,
        confidence: pricing.confidence
      };
    }

    return null;
  }

  /**
   * Send alert notification
   */
  async sendAlert(opportunity, channel) {
    const profit = opportunity.SuggestedSellPrice - opportunity.SuggestedBuyPrice;
    
    await SlackService.sendMessage(
      `🎯 *High Value Opportunity*\n\n` +
      `ID: ${opportunity.OpportunityId}\n` +
      `Hotel: ${opportunity.HotelName}\n` +
      `Dates: ${opportunity.StartDate} - ${opportunity.EndDate}\n` +
      `Buy: €${opportunity.SuggestedBuyPrice}\n` +
      `Sell: €${opportunity.SuggestedSellPrice}\n` +
      `Profit: €${profit.toFixed(2)} (${((profit / opportunity.SuggestedBuyPrice) * 100).toFixed(1)}%)\n` +
      `Confidence: ${(opportunity.AIConfidence * 100).toFixed(0)}%\n` +
      `Risk: ${opportunity.AIRiskLevel}`
    );

    await this.logAction(opportunity.OpportunityId, 'ALERT_SENT', `Alert sent to ${channel}`);
  }

  /**
   * Activate opportunity
   */
  async activateOpportunity(opportunity) {
    const pool = await getPool();
    await pool.request()
      .input('opportunityId', opportunity.OpportunityId)
      .query(`
        UPDATE [MED_ֹOֹֹpportunities]
        SET IsActive = 1, Lastupdate = GETDATE()
        WHERE OpportunityId = @opportunityId
      `);

    await this.logAction(opportunity.OpportunityId, 'AUTO_ACTIVATED', 'Activated by decision workflow');
  }

  /**
   * Batch process opportunities
   */
  async batchProcess(opportunities) {
    logger.info('[Decision Workflow] Batch processing', {
      count: opportunities.length
    });

    const results = [];
    for (const opportunity of opportunities) {
      const result = await this.processOpportunity(opportunity.OpportunityId);
      results.push(result);
    }

    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalDecisions: results.reduce((sum, r) => sum + (r.decisionsApplied || 0), 0)
    };

    logger.info('[Decision Workflow] Batch complete', summary);
    return { results, summary };
  }

  /**
   * Get opportunity details
   */
  async getOpportunity(opportunityId) {
    const pool = await getPool();
    const result = await pool.request()
      .input('opportunityId', opportunityId)
      .query(`
        SELECT
          o.*,
          h.HotelName,
          (o.SuggestedSellPrice - o.SuggestedBuyPrice) / o.SuggestedBuyPrice as profitMargin
        FROM [MED_ֹOֹֹpportunities] o
        LEFT JOIN MED_Hotels h ON o.HotelId = h.HotelId
        WHERE o.OpportunityId = @opportunityId
      `);

    return result.recordset[0] || null;
  }

  /**
   * Log decision action
   */
  async logDecision(opportunityId, rule, decision) {
    this.decisionHistory.push({
      opportunityId,
      rule: rule.id,
      decision,
      timestamp: new Date().toISOString()
    });

    // Keep last 1000 decisions
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory.shift();
    }
  }

  /**
   * Log action to database
   */
  async logAction(opportunityId, action, details) {
    const pool = await getPool();
    await pool.request()
      .input('opportunityId', opportunityId)
      .input('action', action)
      .input('details', details)
      .query(`
        INSERT INTO MED_OpportunityLogs (OpportunityId, Action, Details, CreatedAt)
        VALUES (@opportunityId, @action, @details, GETDATE())
      `);
  }

  /**
   * Get decision history
   */
  getDecisionHistory(limit = 100) {
    return this.decisionHistory.slice(-limit);
  }

  /**
   * Get enabled rules
   */
  getEnabledRules() {
    return Object.values(DECISION_RULES).filter(r => r.enabled);
  }

  /**
   * Enable/disable rule
   */
  setRuleEnabled(ruleId, enabled) {
    const rule = Object.values(DECISION_RULES).find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      logger.info('[Decision Workflow] Rule updated', { ruleId, enabled });
      return true;
    }
    return false;
  }
}

// Singleton instance
let instance = null;

function getAutomatedDecisionService() {
  if (!instance) {
    instance = new AutomatedDecisionService();
  }
  return instance;
}

module.exports = {
  getAutomatedDecisionService,
  AutomatedDecisionService,
  DECISION_RULES
};
