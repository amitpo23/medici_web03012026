/**
 * AI Command Routes
 * 
 * Natural language interface for system control
 */

const express = require('express');
const router = express.Router();
const { getAICommandCenter } = require('../services/ai-command-center');
const { verifyToken: authenticateRequest } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * POST /ai-command/execute
 * Execute natural language command
 */
router.post('/execute', authenticateRequest, async (req, res) => {
  try {
    const { command, context = {} } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({
        error: 'Command is required'
      });
    }

    // Add user info to context
    const enrichedContext = {
      ...context,
      userId: req.user?.username || 'anonymous',
      sessionId: req.headers['x-session-id'] || null,
      timestamp: new Date().toISOString()
    };

    const commandCenter = getAICommandCenter();
    const result = await commandCenter.processCommand(command, enrichedContext);

    res.json(result);

  } catch (error) {
    logger.error('[AI Command] Execute error', { 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({
      error: 'Failed to execute command',
      message: error.message
    });
  }
});

/**
 * POST /ai-command/chat
 * Enhanced chat with conversation history
 */
router.post('/chat', authenticateRequest, async (req, res) => {
  try {
    const { message, sessionId, includeHistory = false } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    const commandCenter = getAICommandCenter();
    const userId = req.user?.username || 'anonymous';

    // Process with conversation context
    const result = await commandCenter.processCommand(message, {
      userId,
      sessionId: sessionId || `session-${Date.now()}`,
      params: req.body.params
    });

    // Include history if requested
    if (includeHistory) {
      result.history = commandCenter.getHistory(userId);
    }

    res.json(result);

  } catch (error) {
    logger.error('[AI Command] Chat error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Chat error',
      message: error.message
    });
  }
});

/**
 * GET /ai-command/status
 * Get system status via AI
 */
router.get('/status', authenticateRequest, async (req, res) => {
  try {
    const commandCenter = getAICommandCenter();
    
    const result = await commandCenter.processCommand('מה מצב המערכת?', {
      userId: req.user?.username || 'anonymous'
    });

    res.json(result);

  } catch (error) {
    logger.error('[AI Command] Status error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Failed to get status',
      message: error.message
    });
  }
});

/**
 * GET /ai-command/recommendations
 * Get AI recommendations
 */
router.get('/recommendations', authenticateRequest, async (req, res) => {
  try {
    const commandCenter = getAICommandCenter();
    
    const result = await commandCenter.processCommand('מה ההמלצות שלך?', {
      userId: req.user?.username || 'anonymous'
    });

    res.json(result);

  } catch (error) {
    logger.error('[AI Command] Recommendations error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Failed to get recommendations',
      message: error.message
    });
  }
});

/**
 * POST /ai-command/action
 * Execute specific action
 */
router.post('/action', authenticateRequest, async (req, res) => {
  try {
    const { action, params = {} } = req.body;

    if (!action) {
      return res.status(400).json({
        error: 'Action is required'
      });
    }

    // Convert action to command
    const commandMap = {
      'scan_market': 'סרוק שוק',
      'create_opportunity': 'צור הזדמנות',
      'calculate_price': 'חשב מחיר',
      'optimize_prices': 'אופטימיזציה למחירים',
      'analyze_performance': 'נתח ביצועים',
      'approve_opportunity': 'אשר הזדמנות',
      'reject_opportunity': 'דחה הזדמנות'
    };

    const command = commandMap[action] || action;

    const commandCenter = getAICommandCenter();
    const result = await commandCenter.processCommand(command, {
      userId: req.user?.username || 'anonymous',
      params
    });

    res.json(result);

  } catch (error) {
    logger.error('[AI Command] Action error', { 
      error: error.message,
      action: req.body.action 
    });
    res.status(500).json({
      error: 'Failed to execute action',
      message: error.message
    });
  }
});

/**
 * GET /ai-command/history
 * Get conversation history
 */
router.get('/history', authenticateRequest, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const userId = req.user?.username || 'anonymous';

    const commandCenter = getAICommandCenter();
    const history = commandCenter.getHistory(userId);

    // Return last N messages
    const recentHistory = history.slice(-parseInt(limit));

    res.json({
      userId,
      messages: recentHistory,
      total: history.length
    });

  } catch (error) {
    logger.error('[AI Command] History error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Failed to get history',
      message: error.message
    });
  }
});

/**
 * DELETE /ai-command/history
 * Clear conversation history
 */
router.delete('/history', authenticateRequest, async (req, res) => {
  try {
    const userId = req.user?.username || 'anonymous';

    const commandCenter = getAICommandCenter();
    commandCenter.clearHistory(userId);

    res.json({
      success: true,
      message: 'History cleared'
    });

  } catch (error) {
    logger.error('[AI Command] Clear history error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Failed to clear history',
      message: error.message
    });
  }
});

/**
 * POST /ai-command/voice
 * Process voice command (text from speech-to-text)
 */
router.post('/voice', authenticateRequest, async (req, res) => {
  try {
    const { text, confidence = 1.0, language = 'he' } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Voice text is required'
      });
    }

    // Process voice command
    const commandCenter = getAICommandCenter();
    const result = await commandCenter.processCommand(text, {
      userId: req.user?.username || 'anonymous',
      voice: true,
      voiceConfidence: confidence,
      language
    });

    res.json({
      ...result,
      voiceInput: {
        text,
        confidence,
        language
      }
    });

  } catch (error) {
    logger.error('[AI Command] Voice error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Failed to process voice command',
      message: error.message
    });
  }
});

/**
 * GET /ai-command/capabilities
 * List available capabilities
 */
router.get('/capabilities', async (req, res) => {
  try {
    res.json({
      capabilities: [
        {
          category: 'queries',
          name: 'System Status',
          commands: ['מה מצב המערכת?', 'הצג סטטוס', 'what\'s the system status'],
          description: 'Get real-time system status'
        },
        {
          category: 'actions',
          name: 'Market Scan',
          commands: ['סרוק שוק', 'scan market', 'חפש הזדמנויות'],
          description: 'Scan market for opportunities',
          params: ['hotelId', 'city', 'daysAhead']
        },
        {
          category: 'actions',
          name: 'Create Opportunity',
          commands: ['צור הזדמנות', 'create opportunity'],
          description: 'Create new opportunity',
          params: ['hotelId', 'checkIn', 'checkOut', 'buyPrice']
        },
        {
          category: 'actions',
          name: 'Calculate Price',
          commands: ['חשב מחיר', 'calculate price', 'מה המחיר'],
          description: 'Calculate optimal selling price',
          params: ['hotelId', 'checkIn', 'checkOut', 'buyPrice', 'strategy']
        },
        {
          category: 'actions',
          name: 'Optimize Prices',
          commands: ['אופטימיזציה', 'optimize prices', 'שפר מחירים'],
          description: 'Run price optimization'
        },
        {
          category: 'actions',
          name: 'Approve Opportunity',
          commands: ['אשר הזדמנות', 'approve'],
          description: 'Approve opportunity',
          params: ['opportunityId']
        },
        {
          category: 'analysis',
          name: 'Performance Analysis',
          commands: ['נתח ביצועים', 'analyze performance', 'הצג ביצועים'],
          description: 'Comprehensive system analysis'
        },
        {
          category: 'recommendations',
          name: 'AI Recommendations',
          commands: ['מה ההמלצות?', 'recommend', 'מה כדאי לעשות'],
          description: 'Get AI-powered recommendations'
        }
      ],
      languages: ['Hebrew', 'English'],
      voiceSupported: true
    });

  } catch (error) {
    logger.error('[AI Command] Capabilities error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Failed to get capabilities',
      message: error.message
    });
  }
});

module.exports = router;
