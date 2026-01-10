const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

// Get all bookings
router.get('/Bookings', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT 
          b.id, b.PreBookId, b.contentBookingID,
          h.name as HotelName,
          b.startDate, b.endDate,
          b.price, b.pushPrice, b.lastPrice,
          b.IsSold, b.IsCanceled,
          b.dateInsert
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.IsActive = 1
        ORDER BY b.dateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get canceled bookings
router.get('/Canceled', async (req, res) => {
  try {
    const { force } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT 
          b.id, b.PreBookId, b.contentBookingID,
          h.name as HotelName,
          b.startDate, b.endDate,
          b.price, b.pushPrice,
          b.dateInsert
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.IsCanceled = 1
        ORDER BY b.dateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching canceled bookings:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get cancel details
router.get('/CancelDetails', async (req, res) => {
  try {
    const { id } = req.query;
    const pool = await getPool();
    const result = await pool.request()
      .input('id', id)
      .query('SELECT * FROM MED_Book WHERE id = @id');

    res.json(result.recordset[0] || null);
  } catch (err) {
    console.error('Error fetching cancel details:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Set cancel status
router.delete('/SetCancelStatus', async (req, res) => {
  try {
    const { id } = req.query;

    const pool = await getPool();
    await pool.request()
      .input('bookId', id)
      .query('UPDATE MED_Book SET IsCanceled = 1 WHERE id = @bookId');

    res.json({ success: true, message: 'Cancel status updated' });
  } catch (err) {
    console.error('Error setting cancel status:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Cancel booking
router.delete('/CancelBooking', async (req, res) => {
  try {
    const { id } = req.query;

    const pool = await getPool();
    await pool.request()
      .input('bookId', id)
      .execute('MED_InsertCancelBook');

    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update price
router.post('/UpdatePrice', async (req, res) => {
  try {
    const { id, newPrice } = req.body;

    const pool = await getPool();
    await pool.request()
      .input('bookId', id)
      .input('price', newPrice)
      .query('UPDATE MED_Book SET lastPrice = @price WHERE id = @bookId');

    res.json({ success: true, message: 'Price updated' });
  } catch (err) {
    console.error('Error updating price:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
