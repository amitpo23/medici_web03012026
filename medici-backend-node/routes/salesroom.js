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
          b.id,
          b.SoldId as soldId,
          b.contentBookingID as contentBookingId,
          b.DateInsert as dateInsert,
          h.name as name,
          ISNULL(b.NameUpdate, '') as reservationFullName,
          b.startDate,
          b.endDate,
          ISNULL(bd.Description, '') as board,
          ISNULL(rc.name, '') as category,
          b.price,
          ISNULL(o.PushPrice, 0) as pushPrice,
          b.lastPrice,
          ISNULL(b.StatusChangeName, 0) as statusChangeName,
          ISNULL(b.NameUpdate, '') as nameUpdate,
          b.CancellationTo as cancellationTo,
          b.providers as provider,
          b.supplierReference
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        LEFT JOIN MED_PreBook pb ON b.PreBookId = pb.PreBookId
        LEFT JOIN MED_Board bd ON pb.BoardId = bd.BoardId
        LEFT JOIN MED_RoomCategory rc ON pb.CategoryId = rc.CategoryId
        LEFT JOIN [MED_Opportunities] o ON b.OpportunityId = o.OpportunityId
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

// Update sale - update name status (0=Not Updated, 1=Sent to Hotel, 2=Name Updated Success)
router.post('/UpdateNameSuccess', async (req, res) => {
  try {
    const { id, result, firstName, lastName } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing required field: id' });
    }

    const statusCode = parseInt(result, 10);
    if (isNaN(statusCode) || statusCode < 0 || statusCode > 2) {
      return res.status(400).json({ success: false, error: 'Invalid result value. Must be 0, 1, or 2' });
    }

    const pool = await getPool();
    const request = pool.request()
      .input('id', id)
      .input('statusCode', statusCode);

    // If status is 2 (Name Updated Success) and name provided, update NameUpdate and mark as sold
    if (statusCode === 2) {
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
      request.input('nameUpdate', fullName || '');
      await request.query(`
        UPDATE MED_Book
        SET IsSold = 1, StatusChangeName = @statusCode, NameUpdate = CASE WHEN @nameUpdate != '' THEN @nameUpdate ELSE NameUpdate END
        WHERE id = @id
      `);
    } else {
      await request.query(`
        UPDATE MED_Book
        SET StatusChangeName = @statusCode
        WHERE id = @id
      `);
    }

    res.json({ success: true, result: statusCode });
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
          b.SoldId as soldId,
          b.contentBookingID as contentBookingId,
          b.DateInsert as dateInsert,
          h.name as hotelName,
          ISNULL(b.NameUpdate, '') as reservationFullName,
          b.startDate,
          b.endDate,
          ISNULL(bd.Description, '') as board,
          ISNULL(rc.name, '') as category,
          b.price as pushPrice,
          ISNULL(o.PushPrice, b.lastPrice) as salePrice,
          ISNULL(b.NumberOfNights, DATEDIFF(DAY, b.startDate, b.endDate)) as numOfNight,
          ISNULL(b.StatusChangeName, 0) as statusChangeName,
          ISNULL(b.NameUpdate, '') as nameUpdate,
          b.CancellationTo as cancellationTo,
          b.providers as provider,
          b.supplierReference,
          CASE WHEN b.IsActive = 0 THEN 1 ELSE 0 END as isCanceled
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        LEFT JOIN MED_PreBook pb ON b.PreBookId = pb.PreBookId
        LEFT JOIN MED_Board bd ON pb.BoardId = bd.BoardId
        LEFT JOIN MED_RoomCategory rc ON pb.CategoryId = rc.CategoryId
        LEFT JOIN [MED_Opportunities] o ON b.OpportunityId = o.OpportunityId
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
