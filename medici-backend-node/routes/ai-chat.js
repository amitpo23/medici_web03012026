/**
 * AI Database Chat Routes - Natural Language Database Queries
 */

const express = require('express');
const router = express.Router();
const AIDBChatService = require('../services/ai-db-chat');
const { getPool } = require('../config/database');
const logger = require('../config/logger');

const aiChat = new AIDBChatService();

/**
 * POST /ai-chat/ask - Ask a question in natural language
 */
router.post('/ask', async (req, res) => {
  try {
    const { question, conversationHistory } = req.body;

    if (!question) {
      return res.status(400).json({
        error: 'Question is required',
        example: { question: 'How many bookings do I have?' }
      });
    }

    const response = await aiChat.askQuestion(question, conversationHistory || []);
    res.json(response);

  } catch (err) {
    logger.error('Error in AI chat', { error: err.message });
    res.status(500).json({ error: 'Failed to process question' });
  }
});

/**
 * GET /ai-chat/suggestions - Get suggested questions
 */
router.get('/suggestions', (req, res) => {
  const suggestions = aiChat.getSuggestedQuestions();
  res.json({ success: true, suggestions });
});

/**
 * GET /ai-chat/schema - Get database schema
 */
router.get('/schema', async (req, res) => {
  try {
    const schema = await aiChat.getDatabaseSchema();
    res.json({
      success: true,
      schema,
      tables: schema,
      count: schema.length
    });
  } catch (err) {
    logger.error('Error getting schema', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to get schema' });
  }
});

/**
 * POST /ai-chat/custom-query - Execute custom SQL query (read-only)
 */
router.post('/custom-query', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'SQL query is required' });
    }

    if (query.length > 2000) {
      return res.status(400).json({ error: 'Query too long. Maximum 2000 characters.' });
    }

    // Normalize and strip comments before checking
    const stripped = query
      .replace(/--[^\n]*/g, '')   // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove block comments
      .trim();

    const normalizedQuery = stripped.toUpperCase();

    // Only allow SELECT or WITH (for CTEs)
    if (!normalizedQuery.startsWith('SELECT') && !normalizedQuery.startsWith('WITH')) {
      return res.status(403).json({
        error: 'Only SELECT queries are allowed',
        reason: 'For security, only read operations are permitted'
      });
    }

    // Block dangerous keywords in the stripped query
    const forbiddenPatterns = [
      /\bINSERT\b/i, /\bUPDATE\b/i, /\bDELETE\b/i, /\bDROP\b/i,
      /\bALTER\b/i, /\bCREATE\b/i, /\bTRUNCATE\b/i, /\bEXEC\b/i,
      /\bEXECUTE\b/i, /\bSHUTDOWN\b/i, /\bGRANT\b/i, /\bREVOKE\b/i,
      /\bxp_/i, /\bsp_/i, /\bOPENROWSET\b/i, /\bOPENDATASOURCE\b/i,
      /\bBULK\b/i, /\bINTO\b/i, /\bMERGE\b/i
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(stripped)) {
        return res.status(403).json({
          error: 'Query contains forbidden SQL keywords',
          reason: 'For security, only simple SELECT queries are permitted'
        });
      }
    }

    const pool = await getPool();
    const result = await pool.request().query(query);

    res.json({
      success: true,
      query,
      results: result.recordset,
      rowCount: result.recordset.length
    });

  } catch (err) {
    logger.error('Error executing custom query', { error: err.message });
    res.status(500).json({
      success: false,
      error: 'Query execution failed',
      message: err.message
    });
  }
});

/**
 * GET /ai-chat/quick-stats - Quick database statistics
 */
router.get('/quick-stats', async (req, res) => {
  try {
    const pool = await getPool();

    const stats = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM MED_Book WHERE IsActive = 1) as TotalBookings,
        (SELECT COUNT(*) FROM [MED_Opportunities] WHERE IsActive = 1) as ActiveOpportunities,
        (SELECT COUNT(*) FROM Med_Hotels WHERE isActive = 1) as ActiveHotels,
        (SELECT SUM(ISNULL(lastPrice, price)) FROM MED_Book WHERE IsActive = 1 AND price > 0) as TotalRevenue,
        (SELECT SUM(ISNULL(lastPrice, 0) - price) FROM MED_Book WHERE IsActive = 1 AND price > 0 AND lastPrice IS NOT NULL) as TotalProfit
    `);

    res.json({
      success: true,
      stats: stats.recordset[0],
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    logger.error('Error getting quick stats', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
  }
});

/**
 * POST /ai-chat/analyze - Analyze data with AI insights
 */
router.post('/analyze', async (req, res) => {
  try {
    const { table, period = '30' } = req.body;
    const pool = await getPool();

    let analysis = {};

    switch (table) {
      case 'reservations': {
        const reservationAnalysis = await pool.request()
          .input('days', parseInt(period, 10))
          .query(`
            SELECT
              COUNT(*) as Total,
              SUM(AmountAfterTax) as Revenue,
              AVG(AmountAfterTax) as AvgValue,
              MIN(AmountAfterTax) as MinPrice,
              MAX(AmountAfterTax) as MaxPrice,
              COUNT(DISTINCT HotelCode) as UniqueHotels
            FROM Med_Reservation
            WHERE datefrom >= DATEADD(DAY, -@days, GETDATE())
            AND IsCanceled = 0
          `);

        analysis = {
          table: 'reservations',
          period: `${period} days`,
          data: reservationAnalysis.recordset[0],
          insights: [
            `Found ${reservationAnalysis.recordset[0].Total} reservations`,
            `Average booking value: EUR ${reservationAnalysis.recordset[0].AvgValue?.toFixed(2)}`,
            `Spread across ${reservationAnalysis.recordset[0].UniqueHotels} hotels`
          ]
        };
        break;
      }

      case 'opportunities': {
        const oppAnalysis = await pool.request()
          .input('days', parseInt(period, 10))
          .query(`
            SELECT
              CASE WHEN IsActive = 1 THEN 'ACTIVE' ELSE 'INACTIVE' END as Status,
              COUNT(*) as Count,
              AVG(PushPrice - Price) as AvgMargin
            FROM [MED_Opportunities]
            WHERE DateCreate >= DATEADD(DAY, -@days, GETDATE())
            GROUP BY CASE WHEN IsActive = 1 THEN 'ACTIVE' ELSE 'INACTIVE' END
          `);

        analysis = {
          table: 'opportunities',
          period: `${period} days`,
          data: oppAnalysis.recordset,
          insights: oppAnalysis.recordset.map(o =>
            `${o.Status}: ${o.Count} opportunities (Avg margin: EUR ${o.AvgMargin?.toFixed(2)})`
          )
        };
        break;
      }

      default:
        return res.status(400).json({
          error: 'Invalid table',
          supported: ['reservations', 'opportunities']
        });
    }

    res.json({ success: true, analysis });

  } catch (err) {
    logger.error('Error analyzing data', { error: err.message });
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

module.exports = router;
