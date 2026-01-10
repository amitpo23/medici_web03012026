const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

// Get sales
router.get('/Sales', async (req, res) => {
  try {
    const { force } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT 
          sr.*,
          h.name as HotelName,
          b.name as BoardName,
          rc.name as CategoryName
        FROM MED_SalesRoom sr
        LEFT JOIN Med_Hotels h ON sr.HotelId = h.HotelId
        LEFT JOIN MED_Board b ON sr.BoardId = b.id
        LEFT JOIN MED_RoomCategory rc ON sr.CategoryId = rc.id
        WHERE sr.IsActive = 1 AND sr.IsSold = 0
        ORDER BY sr.dateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching sales:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get sale details
router.get('/GetDetails', async (req, res) => {
  try {
    const { id } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .input('id', id)
      .query(`
        SELECT * FROM MED_SalesRoom
        WHERE id = @id
      `);

    res.json(result.recordset[0] || null);
  } catch (err) {
    console.error('Error fetching sale details:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update sale name success
router.post('/UpdateNameSuccess', async (req, res) => {
  try {
    const { id, firstName, lastName } = req.body;
    
    const pool = await getPool();
    await pool.request()
      .input('id', id)
      .input('firstName', firstName)
      .input('lastName', lastName)
      .query(`
        UPDATE MED_SalesRoom
        SET FirstName = @firstName, LastName = @lastName, IsSold = 1
        WHERE id = @id
      `);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating sale:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get reservations
router.get('/Reservations', async (req, res) => {
  try {
    const { force } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT 
          sr.*,
          h.name as HotelName
        FROM MED_SalesRoom sr
        LEFT JOIN Med_Hotels h ON sr.HotelId = h.HotelId
        WHERE sr.IsActive = 1 AND sr.IsSold = 1
        ORDER BY sr.dateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching reservations:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
