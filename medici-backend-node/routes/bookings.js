const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const logger = require('../config/logger');
const InnstantClient = require('../services/innstant-client');
const socketService = require('../services/socket-service');
const { validate, schemas } = require('../middleware/validate');

const innstantClient = new InnstantClient();

// Get all bookings (with pagination)
router.get('/Bookings', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
    const offset = (page - 1) * limit;

    const pool = await getPool();
    const result = await pool.request()
      .input('offset', offset)
      .input('limit', limit)
      .query(`
        SELECT
          b.id,
          b.PreBookId as preBookId,
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
          b.DateLastPrice as dateLastPrice,
          b.IsActive as isActive,
          b.IsSold as isSold,
          b.CancellationTo as cancellationTo,
          b.providers as provider,
          b.supplierReference
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        LEFT JOIN MED_PreBook pb ON b.PreBookId = pb.PreBookId
        LEFT JOIN MED_Board bd ON pb.BoardId = bd.BoardId
        LEFT JOIN MED_RoomCategory rc ON pb.CategoryId = rc.CategoryId
        LEFT JOIN [MED_Opportunities] o ON b.OpportunityId = o.OpportunityId
        WHERE b.IsActive = 1
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
router.post('/UpdatePrice', validate({ body: schemas.updatePrice }), async (req, res) => {
  try {
    const { id, newPrice } = req.body;

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

// Note: Old /Confirm endpoint removed - was shadowing the GPT implementation below (line ~411)
// The newer implementation uses preBookId (matching frontend contract) and includes
// Zenith push queuing + Slack notifications

/**
 * POST /Book/PreBook
 * GPT Implementation: Create pre-booking (hold room with supplier)
 * - Calls Innstant preBook API
 * - Saves to MED_PreBook table
 * - Returns prebookId + token for later confirmation
 */
router.post('/PreBook', validate({ body: schemas.preBook }), async (req, res) => {
  try {
    const {
      opportunityId,    // Optional: link to existing opportunity
      hotelId,
      dateFrom,
      dateTo,
      roomCode,
      boardId,
      categoryId,
      adults = 2,
      paxChildren = [],
      searchToken,      // Token from search results
      roomId,           // Room ID from search results
      rateId            // Rate ID from search results
    } = req.body;

    // Validation
    if (!hotelId || !dateFrom || !dateTo) {
      return res.status(400).json({ 
        error: 'hotelId, dateFrom, and dateTo are required' 
      });
    }

    const pool = await getPool();

    // Get hotel mapping
    const hotelMapping = await pool.request()
      .input('hotelId', hotelId)
      .query('SELECT InnstantId, Name FROM Med_Hotels WHERE HotelId = @hotelId');
    
    const innstantHotelId = hotelMapping.recordset[0]?.InnstantId;
    const hotelName = hotelMapping.recordset[0]?.Name;

    if (!innstantHotelId) {
      return res.status(404).json({ 
        error: `Hotel ID ${hotelId} not found or has no Innstant mapping` 
      });
    }

    // Call Innstant PreBook API
    let preBookResult;
    if (process.env.INNSTANT_ACCESS_TOKEN) {
      preBookResult = await innstantClient.preBook({
        token: searchToken,
        hotelId: innstantHotelId,
        checkIn: dateFrom,
        checkOut: dateTo,
        adults,
        children: paxChildren,
        room: { roomId, rateId }
      });

      if (!preBookResult.success) {
        return res.status(400).json({ 
          error: 'PreBook failed with supplier', 
          details: preBookResult.error 
        });
      }
    } else {
      return res.status(503).json({ 
        error: 'Innstant API not configured' 
      });
    }

    // Insert into MED_PreBook table
    const insertResult = await pool.request()
      .input('OpportunityId', opportunityId || null)
      .input('HotelId', hotelId)
      .input('DateFrom', dateFrom)
      .input('DateTo', dateTo)
      .input('CategoryId', categoryId || null)
      .input('BoardId', boardId || null)
      .input('Price', preBookResult.price)
      .input('Token', preBookResult.token)
      .input('CancellationType', preBookResult.cancellationType || 'Unknown')
      .input('CancellationTo', preBookResult.cancellationDeadline || null)
      .input('ProviderId', 1) // 1 = Innstant
      .input('source', adults)
      .query(`
        INSERT INTO MED_PreBook 
        (OpportunityId, HotelId, DateForm, DateTo, CategoryId, BoardId, Price, 
         Token, CancellationType, CancellationTo, ProviderId, source)
        OUTPUT INSERTED.PreBookId
        VALUES 
        (@OpportunityId, @HotelId, @DateFrom, @DateTo, @CategoryId, @BoardId, @Price,
         @Token, @CancellationType, @CancellationTo, @ProviderId, @source)
      `);

    const preBookId = insertResult.recordset[0].PreBookId;

    logger.info(`[PreBook] Created PreBookId ${preBookId} for hotel ${hotelName}`);

    res.json({
      success: true,
      preBookId: preBookId,
      price: preBookResult.price,
      currency: preBookResult.currency,
      token: preBookResult.token,
      cancellationType: preBookResult.cancellationType,
      cancellationDeadline: preBookResult.cancellationDeadline,
      hotelName: hotelName,
      checkIn: dateFrom,
      checkOut: dateTo
    });

  } catch (err) {
    logger.error('Error in PreBook', { error: err.message, stack: err.stack });
    res.status(500).json({ 
      error: 'PreBook failed', 
      message: err.message 
    });
  }
});

/**
 * POST /Book/Confirm
 * GPT Implementation: Confirm booking with supplier
 * - Uses token from PreBook
 * - Creates MED_Book record
 * - Queues for Zenith push
 * - Sends Slack notification
 */
router.post('/Confirm', validate({ body: schemas.confirmBooking }), async (req, res) => {
  try {
    const {
      preBookId,
      guestName,
      guestEmail,
      guestPhone,
      specialRequests
    } = req.body;

    // Validation
    if (!preBookId) {
      return res.status(400).json({ 
        error: 'preBookId is required' 
      });
    }

    const pool = await getPool();

    // Get PreBook details
    const preBookResult = await pool.request()
      .input('preBookId', preBookId)
      .query(`
        SELECT pb.*, h.Name as HotelName, h.InnstantId
        FROM MED_PreBook pb
        LEFT JOIN Med_Hotels h ON pb.HotelId = h.HotelId
        WHERE pb.PreBookId = @preBookId
      `);

    const preBook = preBookResult.recordset[0];
    if (!preBook) {
      return res.status(404).json({ 
        error: `PreBook ID ${preBookId} not found` 
      });
    }

    // Parse guest name
    const [firstName, ...lastNameParts] = (guestName || 'Guest User').split(' ');
    const lastName = lastNameParts.join(' ') || 'User';

    // Call Innstant Book API
    let bookResult;
    if (process.env.INNSTANT_ACCESS_TOKEN) {
      bookResult = await innstantClient.book({
        preBookToken: preBook.Token,
        guest: {
          firstName,
          lastName,
          email: guestEmail || 'booking@medicihotels.com',
          phone: guestPhone || '+972000000000',
          specialRequests: specialRequests || ''
        }
      });

      if (!bookResult.success) {
        return res.status(400).json({ 
          error: 'Booking confirmation failed with supplier', 
          details: bookResult.error 
        });
      }
    } else {
      return res.status(503).json({ 
        error: 'Innstant API not configured' 
      });
    }

    // Insert into MED_Book table
    const insertResult = await pool.request()
      .input('PreBookId', preBookId)
      .input('contentBookingID', bookResult.bookingId)
      .input('HotelId', preBook.HotelId)
      .input('startDate', preBook.DateForm)
      .input('endDate', preBook.DateTo)
      .input('price', preBook.Price)
      .input('lastPrice', preBook.Price)
      .input('IsSold', 0)
      .input('IsActive', 1)
      .input('Status', 'Confirmed')
      .input('providers', 'Innstant')
      .input('supplierReference', bookResult.supplierReference)
      .input('confirmationNumber', bookResult.confirmationNumber)
      .query(`
        INSERT INTO MED_Book 
        (PreBookId, contentBookingID, HotelId, startDate, endDate, price, lastPrice,
         IsSold, IsActive, Status, providers, supplierReference, DateInsert)
        OUTPUT INSERTED.id
        VALUES 
        (@PreBookId, @contentBookingID, @HotelId, @startDate, @endDate, @price, @lastPrice,
         @IsSold, @IsActive, @Status, @providers, @supplierReference, GETDATE())
      `);

    const bookId = insertResult.recordset[0].id;

    // Queue for Zenith push
    try {
      await pool.request()
        .input('bookId', bookId)
        .query(`
          INSERT INTO Med_HotelsToPush (BookId, IsPushed, DateInsert)
          VALUES (@bookId, 0, GETDATE())
        `);
      logger.info(`[Book] Queued bookId ${bookId} for Zenith push`);
    } catch (pushError) {
      logger.warn('Error queuing for Zenith push', { error: pushError.message });
    }

    // Send Slack notification
    try {
      const slackService = require('../services/slack-service');
      await slackService.sendBookingNotification({
        bookId,
        hotelName: preBook.HotelName,
        checkIn: preBook.DateForm,
        checkOut: preBook.DateTo,
        price: preBook.Price,
        guestName,
        confirmationNumber: bookResult.confirmationNumber
      });
    } catch (slackError) {
      logger.warn('Error sending Slack notification', { error: slackError.message });
    }

    logger.info(`[Book] Created bookId ${bookId} - confirmation ${bookResult.confirmationNumber}`);

    // Emit Socket.IO event for real-time notification
    socketService.emit('new-booking', {
      bookingId: bookId,
      hotelName: preBook.HotelName,
      price: preBook.Price,
      checkIn: preBook.DateForm,
      checkOut: preBook.DateTo,
      confirmationNumber: bookResult.confirmationNumber
    });

    res.json({
      success: true,
      bookId: bookId,
      confirmationNumber: bookResult.confirmationNumber,
      supplierReference: bookResult.supplierReference,
      status: 'Confirmed',
      hotelName: preBook.HotelName,
      checkIn: preBook.DateForm,
      checkOut: preBook.DateTo,
      price: preBook.Price
    });

  } catch (err) {
    logger.error('Error confirming booking', { error: err.message, stack: err.stack });
    res.status(500).json({
      error: 'Booking confirmation failed',
      message: err.message
    });
  }
});

/**
 * POST /Book/ManualBook
 * GPT Implementation: Manual booking entry (no API calls)
 * - For bookings made directly with suppliers
 * - Creates PreBook + Book records
 * - No supplier API calls
 */
router.post('/ManualBook', async (req, res) => {
  try {
    const {
      opportunityId,
      hotelId,
      dateFrom,
      dateTo,
      price,
      confirmationCode,
      supplierReference,
      provider = 'Manual',
      guestName,
      boardId,
      categoryId
    } = req.body;

    // Validation
    if (!hotelId || !dateFrom || !dateTo || !price) {
      return res.status(400).json({ 
        error: 'hotelId, dateFrom, dateTo, and price are required' 
      });
    }

    const pool = await getPool();

    // Validate opportunity if provided
    if (opportunityId) {
      const oppResult = await pool.request()
        .input('oppId', opportunityId)
        .query('SELECT Id, IsActive FROM MED_Opportunities WHERE Id = @oppId');
      
      if (oppResult.recordset.length === 0) {
        return res.status(404).json({ 
          error: `Opportunity ID ${opportunityId} not found` 
        });
      }
    }

    // Create PreBook record (manual source)
    const preBookResult = await pool.request()
      .input('OpportunityId', opportunityId || null)
      .input('HotelId', hotelId)
      .input('DateFrom', dateFrom)
      .input('DateTo', dateTo)
      .input('CategoryId', categoryId || null)
      .input('BoardId', boardId || null)
      .input('Price', price)
      .input('Token', 'MANUAL_' + Date.now())
      .input('CancellationType', 'Unknown')
      .input('ProviderId', 99) // 99 = Manual entry
      .input('source', 0)
      .query(`
        INSERT INTO MED_PreBook 
        (OpportunityId, HotelId, DateForm, DateTo, CategoryId, BoardId, Price, 
         Token, CancellationType, ProviderId, source)
        OUTPUT INSERTED.PreBookId
        VALUES 
        (@OpportunityId, @HotelId, @DateFrom, @DateTo, @CategoryId, @BoardId, @Price,
         @Token, @CancellationType, @ProviderId, @source)
      `);

    const preBookId = preBookResult.recordset[0].PreBookId;

    // Create Book record
    const bookResult = await pool.request()
      .input('PreBookId', preBookId)
      .input('contentBookingID', confirmationCode || 'MANUAL_' + Date.now())
      .input('HotelId', hotelId)
      .input('startDate', dateFrom)
      .input('endDate', dateTo)
      .input('price', price)
      .input('lastPrice', price)
      .input('IsSold', 0)
      .input('IsActive', 1)
      .input('Status', 'Confirmed')
      .input('providers', provider)
      .input('supplierReference', supplierReference || 'N/A')
      .query(`
        INSERT INTO MED_Book 
        (PreBookId, contentBookingID, HotelId, startDate, endDate, price, lastPrice,
         IsSold, IsActive, Status, providers, supplierReference, DateInsert)
        OUTPUT INSERTED.id
        VALUES 
        (@PreBookId, @contentBookingID, @HotelId, @startDate, @endDate, @price, @lastPrice,
         @IsSold, @IsActive, @Status, @providers, @supplierReference, GETDATE())
      `);

    const bookId = bookResult.recordset[0].id;

    // Mark opportunity as purchased if provided
    if (opportunityId) {
      await pool.request()
        .input('oppId', opportunityId)
        .input('bookId', bookId)
        .query(`
          UPDATE MED_Opportunities 
          SET IsPurchased = 1, BookId = @bookId, DateUpdate = GETDATE()
          WHERE Id = @oppId
        `);
    }

    logger.info(`[ManualBook] Created manual booking ${bookId}`);

    res.json({
      success: true,
      bookId: bookId,
      preBookId: preBookId,
      confirmationCode: confirmationCode,
      message: 'Manual booking created successfully'
    });

  } catch (err) {
    logger.error('Error creating manual booking', { error: err.message, stack: err.stack });
    res.status(500).json({ 
      error: 'Manual booking failed', 
      message: err.message 
    });
  }
});

/**
 * DELETE /Book/CancelDirect
 * GPT Implementation: Cancel booking with optional supplier cancellation
 * - Calls supplier cancel API if requested
 * - Creates MED_CancelBook record
 * - Updates MED_Book (IsActive=0)
 * - Sends Slack notification
 */
router.delete('/CancelDirect', validate({ body: schemas.cancelBooking }), async (req, res) => {
  try {
    const {
      bookId,
      reason = 'User requested cancellation',
      cancelWithSupplier = true
    } = req.body;

    // Validation
    if (!bookId) {
      return res.status(400).json({ 
        error: 'bookId is required' 
      });
    }

    const pool = await getPool();

    // Get booking details
    const bookResult = await pool.request()
      .input('bookId', bookId)
      .query(`
        SELECT b.*, h.Name as HotelName, h.InnstantId
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.id = @bookId
      `);

    const book = bookResult.recordset[0];
    if (!book) {
      return res.status(404).json({ 
        error: `Book ID ${bookId} not found` 
      });
    }

    if (!book.IsActive) {
      return res.status(400).json({ 
        error: 'Booking is already cancelled' 
      });
    }

    let cancellationResult = null;
    let refundAmount = 0;
    let cancellationFee = 0;

    // Cancel with supplier if requested and it's an Innstant booking
    if (cancelWithSupplier && book.providers === 'Innstant' && book.contentBookingID) {
      if (process.env.INNSTANT_ACCESS_TOKEN) {
        cancellationResult = await innstantClient.cancelBooking(book.contentBookingID);
        
        if (cancellationResult.success) {
          logger.info(`[Cancel] Successfully cancelled with supplier: ${book.contentBookingID}`);
          // Parse refund/fee from cancellation result if available
          refundAmount = cancellationResult.data?.refundAmount || 0;
          cancellationFee = cancellationResult.data?.cancellationFee || 0;
        } else {
          logger.warn(`[Cancel] Supplier cancellation failed: ${cancellationResult.error}`);
        }
      }
    }

    // Insert into MED_CancelBook table
    await pool.request()
      .input('PreBookId', book.PreBookId)
      .input('contentCancelBookingID', cancellationResult?.cancellationId || 'CANCEL_' + Date.now())
      .input('Reason', reason)
      .input('RefundAmount', refundAmount)
      .input('CancellationFee', cancellationFee)
      .query(`
        INSERT INTO MED_CancelBook 
        (PreBookId, contentCancelBookingID, DateInsert, Reason)
        VALUES 
        (@PreBookId, @contentCancelBookingID, GETDATE(), @Reason)
      `);

    // Update MED_Book (set inactive)
    await pool.request()
      .input('bookId', bookId)
      .query('UPDATE MED_Book SET IsActive = 0, Status = \'Cancelled\' WHERE id = @bookId');

    // Remove from Zenith push queue if not yet pushed
    await pool.request()
      .input('bookId', bookId)
      .query('DELETE FROM Med_HotelsToPush WHERE BookId = @bookId AND IsPushed = 0');

    // Send Slack notification
    try {
      const slackService = require('../services/slack-service');
      await slackService.sendCancellationNotification({
        bookId,
        hotelName: book.HotelName,
        checkIn: book.startDate,
        checkOut: book.endDate,
        reason,
        cancelledWithSupplier: cancelWithSupplier && cancellationResult?.success
      });
    } catch (slackError) {
      logger.warn('Error sending Slack notification', { error: slackError.message });
    }

    logger.info(`[Cancel] Cancelled bookId ${bookId}`);

    // Emit Socket.IO event for real-time notification
    socketService.emit('booking-cancelled', {
      bookingId: bookId,
      hotelName: book.HotelName,
      reason,
      cancelledWithSupplier: cancelWithSupplier && cancellationResult?.success
    });

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      bookId: bookId,
      cancelledWithSupplier: cancelWithSupplier && cancellationResult?.success,
      refundAmount,
      cancellationFee
    });

  } catch (err) {
    logger.error('Error cancelling booking', { error: err.message, stack: err.stack });
    res.status(500).json({
      error: 'Cancellation failed',
      message: err.message
    });
  }
});

module.exports = router;
