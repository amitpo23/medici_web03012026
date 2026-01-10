const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

// Get cancel booking errors
router.get('/CancelBookErrors', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT 
          cbe.*,
          h.name as HotelName
        FROM MED_CancelBookError cbe
        LEFT JOIN Med_Hotels h ON cbe.HotelId = h.HotelId
        WHERE cbe.IsActive = 1
        ORDER BY cbe.dateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching cancel book errors:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get booking errors
router.get('/BookErrors', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT 
          be.*,
          h.name as HotelName
        FROM MED_BookError be
        LEFT JOIN Med_Hotels h ON be.HotelId = h.HotelId
        WHERE be.IsActive = 1
        ORDER BY be.dateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching book errors:', err);
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
    console.error('Error fetching cancel book error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
