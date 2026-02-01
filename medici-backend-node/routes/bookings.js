const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const logger = require('../config/logger');
const InnstantClient = require('../services/innstant-client');

const innstantClient = new InnstantClient();

// Get all bookings (with pagination)
router.get('/Bookings', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 200));
    const offset = (page - 1) * limit;

    const pool = await getPool();
    const result = await pool.request()
      .input('offset', offset)
      .input('limit', limit)
      .query(`
        SELECT
          b.id, b.PreBookId, b.contentBookingID,
          h.name as HotelName,
          b.startDate, b.endDate,
          b.price, b.lastPrice,
          b.IsSold, b.IsActive, b.Status,
          b.DateInsert,
          b.providers, b.supplierReference
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        ORDER BY b.DateInsert DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching bookings', { error: err.message });
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
          c.Id, c.PreBookId, c.contentBookingID as contentCancelBookingID,
          b.contentBookingID,
          h.name as HotelName,
          b.startDate, b.endDate,
          b.price,
          c.DateInsert
        FROM MED_CancelBook c
        LEFT JOIN MED_Book b ON c.contentBookingID = b.contentBookingID
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        ORDER BY c.DateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching canceled bookings', { error: err.message });
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
    logger.error('Error fetching cancel details', { error: err.message });
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
      .query('UPDATE MED_Book SET IsActive = 0 WHERE id = @bookId');

    res.json({ success: true, message: 'Cancel status updated' });
  } catch (err) {
    logger.error('Error setting cancel status', { error: err.message });
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
    logger.error('Error cancelling booking', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Update price
router.post('/UpdatePrice', async (req, res) => {
  try {
    const { id, newPrice } = req.body;

    if (!id || newPrice == null || newPrice < 0) {
      return res.status(400).json({ error: 'Valid id and non-negative newPrice are required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('bookId', id)
      .input('price', newPrice)
      .query('UPDATE MED_Book SET lastPrice = @price WHERE id = @bookId');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    res.json({ success: true, message: 'Price updated' });
  } catch (err) {
    logger.error('Error updating price', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get room archive data (historical bookings with filters)
router.get('/Archive', async (req, res) => {
  try {
    const {
      stayFrom, stayTo, hotelName, minPrice, maxPrice,
      city, roomBoard, roomCategory,
      page = 1, limit = 50
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * pageSize;

    const pool = await getPool();
    const request = pool.request()
      .input('offset', offset)
      .input('limit', pageSize);

    let where = 'WHERE (b.IsActive = 0 OR b.IsSold = 1 OR b.startDate < GETDATE())';

    if (stayFrom) {
      where += ' AND b.startDate >= @stayFrom';
      request.input('stayFrom', stayFrom);
    }
    if (stayTo) {
      where += ' AND b.endDate <= @stayTo';
      request.input('stayTo', stayTo);
    }
    if (hotelName) {
      where += ' AND h.name LIKE @hotelName';
      request.input('hotelName', `%${hotelName}%`);
    }
    if (minPrice) {
      where += ' AND b.price >= @minPrice';
      request.input('minPrice', parseFloat(minPrice));
    }
    if (maxPrice) {
      where += ' AND b.price <= @maxPrice';
      request.input('maxPrice', parseFloat(maxPrice));
    }
    const result = await request.query(`
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
      ${where}
      ORDER BY b.DateInsert DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const countResult = { recordset: [{ total: result.recordset.length }] };

    res.json({
      data: result.recordset,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: countResult.recordset[0]?.total || result.recordset.length
      }
    });
  } catch (err) {
    logger.error('Error fetching room archive', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Pre-book a room via Innstant
router.post('/PreBook', async (req, res) => {
  try {
    const { token, room, hotelId, checkIn, checkOut, adults, children } = req.body;

    if (!token || !room || !hotelId || !checkIn || !checkOut) {
      return res.status(400).json({
        error: 'Required fields: token, room (with roomId/rateId), hotelId, checkIn, checkOut'
      });
    }

    const result = await innstantClient.preBook({
      token, room, hotelId, checkIn, checkOut,
      adults: adults || 2,
      children: children || []
    });

    if (!result.success) {
      return res.status(502).json({ error: 'PreBook failed', details: result.error });
    }

    // Store pre-book in database
    const pool = await getPool();
    await pool.request()
      .input('hotelId', hotelId)
      .input('dateFrom', checkIn)
      .input('dateTo', checkOut)
      .input('price', result.price)
      .input('token', result.token)
      .input('cancellationType', result.cancellationType || null)
      .input('cancellationTo', result.cancellationDeadline || null)
      .execute('MED_InsertPreBook');

    res.json({
      success: true,
      preBookId: result.preBookId,
      price: result.price,
      currency: result.currency,
      cancellationType: result.cancellationType,
      cancellationDeadline: result.cancellationDeadline,
      token: result.token
    });
  } catch (err) {
    logger.error('Error pre-booking', { error: err.message });
    res.status(500).json({ error: 'PreBook error' });
  }
});

// Confirm booking via Innstant
router.post('/Confirm', async (req, res) => {
  try {
    const { preBookToken, guest, paymentInfo, opportunityId } = req.body;

    if (!preBookToken || !guest || !guest.firstName || !guest.lastName) {
      return res.status(400).json({
        error: 'Required fields: preBookToken, guest (firstName, lastName)'
      });
    }

    const result = await innstantClient.book({ preBookToken, guest, paymentInfo });

    if (!result.success) {
      // Log booking error
      const pool = await getPool();
      await pool.request()
        .input('error', result.error)
        .input('opportunityId', opportunityId || null)
        .execute('MED_InsertBookError').catch(() => {});

      return res.status(502).json({ error: 'Booking failed', details: result.error });
    }

    // Insert confirmed booking into database
    const pool = await getPool();
    await pool.request()
      .input('bookingId', result.bookingId)
      .input('confirmationNumber', result.confirmationNumber)
      .input('supplierReference', result.supplierReference)
      .input('opportunityId', opportunityId || null)
      .execute('MED_InsertBook');

    res.json({
      success: true,
      bookingId: result.bookingId,
      confirmationNumber: result.confirmationNumber,
      supplierReference: result.supplierReference,
      status: result.status
    });
  } catch (err) {
    logger.error('Error confirming booking', { error: err.message });
    res.status(500).json({ error: 'Booking error' });
  }
});

// Manual booking (without Innstant)
router.post('/ManualBook', async (req, res) => {
  try {
    const { opportunityId, code, hotelId, startDate, endDate, price, guestName } = req.body;

    if (!code || !hotelId || !startDate || !endDate) {
      return res.status(400).json({
        error: 'Required fields: code, hotelId, startDate, endDate'
      });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('opportunityId', opportunityId || null)
      .input('code', code)
      .input('hotelId', hotelId)
      .input('startDate', startDate)
      .input('endDate', endDate)
      .input('price', price || 0)
      .input('guestName', guestName || null)
      .query(`
        INSERT INTO MED_Book (
          contentBookingID, HotelId, startDate, endDate,
          price, IsActive, IsSold, DateInsert, OpportunityId, providers
        )
        VALUES (
          @code, @hotelId, @startDate, @endDate,
          @price, 1, 0, GETDATE(), @opportunityId, 'Manual'
        );
        SELECT SCOPE_IDENTITY() as BookId;
      `);

    const bookId = result.recordset[0]?.BookId;

    res.json({
      success: true,
      bookId,
      message: 'Manual booking created'
    });
  } catch (err) {
    logger.error('Error creating manual booking', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Cancel booking with direct JSON (via Innstant)
router.delete('/CancelDirect', async (req, res) => {
  try {
    const { bookingId, contentBookingID } = req.query;

    if (!bookingId && !contentBookingID) {
      return res.status(400).json({ error: 'Provide bookingId or contentBookingID' });
    }

    const pool = await getPool();

    // Get the booking details
    const booking = await pool.request()
      .input('bookingId', bookingId || null)
      .input('contentBookingID', contentBookingID || null)
      .query(`
        SELECT id, contentBookingID, HotelId, price
        FROM MED_Book
        WHERE (@bookingId IS NOT NULL AND id = @bookingId)
           OR (@contentBookingID IS NOT NULL AND contentBookingID = @contentBookingID)
      `);

    if (booking.recordset.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const book = booking.recordset[0];

    // Try to cancel via Innstant if contentBookingID exists
    if (book.contentBookingID) {
      const cancelResult = await innstantClient.cancelBooking(book.contentBookingID);
      if (!cancelResult.success) {
        logger.error('Innstant cancel failed', { error: cancelResult.error, bookId: book.id });
      }
    }

    // Update booking status in database
    await pool.request()
      .input('bookId', book.id)
      .query('UPDATE MED_Book SET IsActive = 0 WHERE id = @bookId');

    // Log cancellation
    await pool.request()
      .input('bookId', book.id)
      .execute('MED_InsertCancelBook').catch(() => {});

    res.json({
      success: true,
      message: 'Booking cancelled',
      bookId: book.id
    });
  } catch (err) {
    logger.error('Error cancelling booking directly', { error: err.message });
    res.status(500).json({ error: 'Cancellation error' });
  }
});

module.exports = router;
