const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { getPool } = require('../config/database');

// Get active bookings available for sale (unsold, active)
router.get('/Sales', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT
          b.id, b.PreBookId, b.contentBookingID,
          h.name as HotelName,
          b.startDate, b.endDate,
          b.price, b.lastPrice,
          b.IsSold, b.IsActive,
          b.CancellationType, b.CancellationTo,
          b.DateInsert, b.providers, b.supplierReference
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.IsActive = 1 AND b.IsSold = 0
        ORDER BY b.DateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching sales', { error: err.message });
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
        SELECT b.*, h.name as HotelName
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.id = @id
      `);

    res.json(result.recordset[0] || null);
  } catch (err) {
    logger.error('Error fetching sale details', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Update sale - mark as sold with reservation name
router.post('/UpdateNameSuccess', async (req, res) => {
  try {
    const { id, firstName, lastName } = req.body;

    const pool = await getPool();
    await pool.request()
      .input('id', id)
      .input('firstName', firstName || '')
      .input('lastName', lastName || '')
      .query(`
        UPDATE MED_Book
        SET IsSold = 1, ReservationFirstName = @firstName
        WHERE id = @id
      `);

    res.json({ success: true });
  } catch (err) {
    logger.error('Error updating sale', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get sold reservations
router.get('/Reservations', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT
          b.id, b.PreBookId, b.contentBookingID,
          h.name as HotelName,
          b.startDate, b.endDate,
          b.price, b.lastPrice,
          b.IsSold, b.IsActive,
          b.DateInsert, b.providers, b.supplierReference
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.IsSold = 1
        ORDER BY b.DateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching reservations', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
