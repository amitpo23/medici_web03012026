const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { getPool } = require('../config/database');

// Get cancel booking errors
router.get('/CancelBookErrors', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT *
        FROM MED_CancelBookError
        ORDER BY DateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching cancel book errors', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get booking errors
router.get('/BookErrors', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT *
        FROM MED_BookError
        ORDER BY DateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching book errors', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get cancel booking error details
router.get('/GetCancelBookError', async (req, res) => {
  try {
    const { preBookId } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .input('preBookId', preBookId)
      .query(`
        SELECT * FROM MED_CancelBookError
        WHERE PreBookId = @preBookId
      `);

    res.json(result.recordset[0] || null);
  } catch (err) {
    logger.error('Error fetching cancel book error', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
