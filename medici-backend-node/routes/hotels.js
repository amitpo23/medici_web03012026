const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

// Get all hotels
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT 
          HotelId,
          name,
          city,
          country,
          stars,
          isActive,
          dateInsert
        FROM Med_Hotels
        WHERE isActive = 1
        ORDER BY name
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching hotels:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
