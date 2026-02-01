const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const logger = require('../config/logger');

// Get reservation cancellations
router.get('/ReservationCancel', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT * FROM Med_ReservationCancel
        ORDER BY DateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching reservation cancellations', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get reservation details
router.get('/GetDetails', async (req, res) => {
  try {
    const { id } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .input('id', id)
      .query(`
        SELECT * FROM Med_Reservation
        WHERE Id = @id
      `);

    res.json(result.recordset[0] || null);
  } catch (err) {
    logger.error('Error fetching reservation details', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get reservation modifications
router.get('/ReservationModify', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT * FROM Med_ReservationModify
        ORDER BY DateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching reservation modifications', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get reservation log
router.get('/Log', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT * FROM Med_ReservationNotificationLog
        ORDER BY DateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching reservation log', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
