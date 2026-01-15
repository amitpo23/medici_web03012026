/**
 * AI Database Chat Routes - Natural Language Database Queries
 */

const express = require('express');
const router = express.Router();
const AIDBChatService = require('../services/ai-db-chat');
const { getPool } = require('../config/database');

const aiChat = new AIDBChatService();

/**
 * POST /ai-chat/ask - Ask a question in natural language
 */
router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ 
        error: 'Question is required',
        example: { question: 'כמה הזמנות יש לי?' }
      });
    }

    const response = await aiChat.askQuestion(question);
    res.json(response);

  } catch (err) {
    console.error('Error in AI chat:', err);
    res.status(500).json({ error: 'Failed to process question' });
  }
});

/**
 * GET /ai-chat/suggestions - Get suggested questions
 */
router.get('/suggestions', (req, res) => {
  const suggestions = aiChat.getSuggestedQuestions();
  res.json({ suggestions });
});

/**
 * GET /ai-chat/schema - Get database schema
 */
router.get('/schema', async (req, res) => {
  try {
    const schema = await aiChat.getDatabaseSchema();
    res.json({ 
      tables: schema,
      count: schema.length
    });
  } catch (err) {
    console.error('Error getting schema:', err);
    res.status(500).json({ error: 'Failed to get schema' });
  }
});

/**
 * POST /ai-chat/custom-query - Execute custom SQL query (admin only)
 */
router.post('/custom-query', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'SQL query is required' });
    }

    // Security: Only allow SELECT queries
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      return res.status(403).json({ 
        error: 'Only SELECT queries are allowed',
        reason: 'For security, only read operations are permitted'
      });
    }

    const pool = await getPool();
    const result = await pool.request().query(query);

    res.json({
      success: true,
      query: query,
      results: result.recordset,
      rowCount: result.recordset.length
    });

  } catch (err) {
    console.error('Error executing custom query:', err);
    res.status(500).json({ 
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
        (SELECT COUNT(*) FROM MED_Book WHERE Status = 'confirmed' AND IsActive = 1) as TotalBookings,
        (SELECT COUNT(*) FROM Med_Reservation) as TotalReservations,
        (SELECT COUNT(*) FROM Med_Hotels WHERE isActive = 1) as ActiveHotels,
        (SELECT SUM(price) FROM MED_Book WHERE Status = 'confirmed' AND IsActive = 1) as TotalRevenue,
        (SELECT SUM(price - ISNULL(lastPrice, price)) FROM MED_Book WHERE Status = 'confirmed' AND IsActive = 1) as TotalProfit
    `);

    res.json({
      success: true,
      stats: stats.recordset[0],
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Error getting quick stats:', err);
    res.status(500).json({ error: 'Failed to get statistics' });
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

    // Analyze based on table
    switch (table) {
      case 'reservations':
        const reservationAnalysis = await pool.request()
          .input('days', parseInt(period))
          .query(`
            SELECT 
              COUNT(*) as Total,
              SUM(TotalPrice) as Revenue,
              AVG(TotalPrice) as AvgValue,
              MIN(TotalPrice) as MinPrice,
              MAX(TotalPrice) as MaxPrice,
              COUNT(DISTINCT HotelId) as UniqueHotels
            FROM Med_Reservations
            WHERE CheckIn >= DATEADD(DAY, -@days, GETDATE())
            AND Status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
          `);
        
        analysis = {
          table: 'reservations',
          period: `${period} days`,
          data: reservationAnalysis.recordset[0],
          insights: [
            `Found ${reservationAnalysis.recordset[0].Total} reservations`,
            `Average booking value: €${reservationAnalysis.recordset[0].AvgValue?.toFixed(2)}`,
            `Spread across ${reservationAnalysis.recordset[0].UniqueHotels} hotels`
          ]
        };
        break;

      case 'opportunities':
        const oppAnalysis = await pool.request()
          .input('days', parseInt(period))
          .query(`
            SELECT 
              Status,
              COUNT(*) as Count,
              AVG(PushPrice - BuyPrice) as AvgMargin
            FROM MED_Opportunities
            WHERE DateInsert >= DATEADD(DAY, -@days, GETDATE())
            GROUP BY Status
          `);
        
        analysis = {
          table: 'opportunities',
          period: `${period} days`,
          data: oppAnalysis.recordset,
          insights: oppAnalysis.recordset.map(o => 
            `${o.Status}: ${o.Count} opportunities (Avg margin: €${o.AvgMargin?.toFixed(2)})`
          )
        };
        break;

      default:
        return res.status(400).json({ 
          error: 'Invalid table',
          supported: ['reservations', 'opportunities']
        });
    }

    res.json({
      success: true,
      analysis
    });

  } catch (err) {
    console.error('Error analyzing data:', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

module.exports = router;
