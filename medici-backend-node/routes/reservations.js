const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

// Get reservation cancellations
router.get('/ReservationCancel', async (req, res) => {
  try {
    const { force } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT * FROM MED_ReservationCancel
        WHERE IsActive = 1
        ORDER BY dateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching reservation cancellations:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get reservation details
router.get('/GetDetails', async (req, res) => {
  try {
    const { soldId } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .input('soldId', soldId)
      .query(`
        SELECT * FROM MED_Reservation
        WHERE SoldId = @soldId
      `);

    res.json(result.recordset[0] || null);
  } catch (err) {
    console.error('Error fetching reservation details:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get reservation modifications
router.get('/ReservationModify', async (req, res) => {
  try {
    const { force } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT * FROM MED_ReservationModify
        WHERE IsActive = 1
        ORDER BY dateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching reservation modifications:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get reservation log
router.get('/Log', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT * FROM MED_ReservationLog
        ORDER BY dateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching reservation log:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
