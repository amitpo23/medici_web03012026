/**
 * Automated Decision Workflow Routes
 * 
 * Rule-based automation endpoints
 */

const express = require('express');
const router = express.Router();
const { getAutomatedDecisionService, DECISION_RULES } = require('../services/automated-decision-service');
const authenticateRequest = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * POST /workflows/process/:id
 * Process single opportunity through decision rules
 */
router.post('/process/:id', authenticateRequest, async (req, res) => {
  try {
    const { id } = req.params;

    const service = getAutomatedDecisionService();
    const result = await service.processOpportunity(parseInt(id));

    res.json(result);

  } catch (error) {
    logger.error('[Workflows] Process error', { 
      error: error.message,
      opportunityId: req.params.id 
    });
    res.status(500).json({
      error: 'Failed to process opportunity',
      message: error.message
    });
  }
});

/**
 * POST /workflows/batch-process
 * Batch process opportunities
 */
router.post('/batch-process', authenticateRequest, async (req, res) => {
  try {
    const { opportunityIds } = req.body;

    if (!Array.isArray(opportunityIds)) {
      return res.status(400).json({
        error: 'opportunityIds must be an array'
      });
    }

    const opportunities = opportunityIds.map(id => ({ OpportunityId: id }));

    const service = getAutomatedDecisionService();
    const result = await service.batchProcess(opportunities);

    res.json(result);

  } catch (error) {
    logger.error('[Workflows] Batch process error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Failed to batch process',
      message: error.message
    });
  }
});

/**
 * GET /workflows/rules
 * Get all decision rules
 */
router.get('/rules', authenticateRequest, async (req, res) => {
  try {
    const service = getAutomatedDecisionService();
    const rules = service.getEnabledRules();

    res.json({
      total: rules.length,
      rules: rules.map(r => ({
        id: r.id,
        name: r.name,
        action: r.action,
        enabled: r.enabled
      }))
    });

  } catch (error) {
    logger.error('[Workflows] Rules error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Failed to get rules',
      message: error.message
    });
  }
});

/**
 * PUT /workflows/rules/:ruleId
 * Enable/disable rule
 */
router.put('/rules/:ruleId', authenticateRequest, async (req, res) => {
  try {
    const { ruleId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'enabled must be boolean'
      });
    }

    const service = getAutomatedDecisionService();
    const success = service.setRuleEnabled(ruleId, enabled);

    if (!success) {
      return res.status(404).json({
        error: 'Rule not found'
      });
    }

    res.json({
      success: true,
      ruleId,
      enabled
    });

  } catch (error) {
    logger.error('[Workflows] Update rule error', { 
      error: error.message,
      ruleId: req.params.ruleId 
    });
    res.status(500).json({
      error: 'Failed to update rule',
      message: error.message
    });
  }
});

/**
 * GET /workflows/history
 * Get decision history
 */
router.get('/history', authenticateRequest, async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const service = getAutomatedDecisionService();
    const history = service.getDecisionHistory(parseInt(limit));

    res.json({
      total: history.length,
      history
    });

  } catch (error) {
    logger.error('[Workflows] History error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Failed to get history',
      message: error.message
    });
  }
});

module.exports = router;
