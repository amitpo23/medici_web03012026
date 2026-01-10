const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

// Search for available rooms
router.post('/Search', async (req, res) => {
  try {
    const {
      hotelId,
      dateFrom,
      dateTo,
      boardId,
      categoryId,
      adults,
      children
    } = req.body;

    const pool = await getPool();
    
    // Call stored procedure for search
    const result = await pool.request()
      .input('hotelId', hotelId)
      .input('dateFrom', dateFrom)
      .input('dateTo', dateTo)
      .input('boardId', boardId)
      .input('categoryId', categoryId)
      .input('adults', adults)
      .input('children', children)
      .execute('MED_SearchAvailableRooms');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error searching rooms:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
