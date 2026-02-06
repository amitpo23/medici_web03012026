/**
 * Document Generation Routes
 * Generates PDFs for booking confirmations, invoices, and reports
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../db');
const pdfGenerator = require('../services/pdf-generator');
const { asyncHandler } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

/**
 * GET /Documents/BookingConfirmation/:id
 * Generate and download booking confirmation PDF
 */
router.get('/BookingConfirmation/:id', asyncHandler(async (req, res) => {
  const bookingId = parseInt(req.params.id);

  if (!bookingId || isNaN(bookingId)) {
    throw new NotFoundError('Booking');
  }

  const pool = await getPool();

  // Fetch booking details with hotel info
  const result = await pool.request()
    .input('BookId', bookingId)
    .query(`
      SELECT
        b.BookID,
        b.HotelId,
        b.startDate as checkIn,
        b.endDate as checkOut,
        b.BuyPrice,
        b.PushPrice as totalPrice,
        b.BoardId,
        b.CategoryId,
        b.Available,
        b.IsPush,
        b.CancellationType,
        b.CancellationTo,
        b.DateInsert as bookingDate,
        h.HotelName,
        h.Address as hotelAddress,
        h.City as hotelCity,
        h.Country as hotelCountry,
        h.Phone as hotelPhone,
        h.Email as hotelEmail,
        bd.BoardName as mealPlan,
        rc.CategoryName as roomCategory,
        rc.CategoryDescription as roomType
      FROM MED_Book b
      LEFT JOIN Med_Hotels h ON b.HotelId = h.id
      LEFT JOIN MED_Board bd ON b.BoardId = bd.BoardId
      LEFT JOIN MED_RoomCategory rc ON b.CategoryId = rc.CategoryId
      WHERE b.BookID = @BookId
    `);

  if (result.recordset.length === 0) {
    throw new NotFoundError('Booking');
  }

  const booking = result.recordset[0];

  // Generate reference number
  const reference = `MED-${booking.BookID.toString().padStart(6, '0')}`;

  // Generate PDF
  const pdfBuffer = await pdfGenerator.generateBookingConfirmation({
    reference,
    bookingDate: booking.bookingDate,
    status: 'Confirmed',
    hotelName: booking.HotelName,
    hotelAddress: booking.hotelAddress,
    hotelCity: booking.hotelCity,
    hotelCountry: booking.hotelCountry,
    hotelPhone: booking.hotelPhone,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    totalPrice: booking.totalPrice || booking.BuyPrice,
    currency: 'EUR',
    mealPlan: booking.mealPlan || 'Room Only',
    roomType: booking.roomType || 'Standard Room',
    roomCategory: booking.roomCategory,
    cancellationType: booking.CancellationType,
    adults: 2, // Default - could be stored in DB
    guestName: 'Guest', // Would come from reservation if linked
    guestEmail: ''
  });

  // Set response headers for PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="booking-${reference}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);

  res.send(pdfBuffer);
}));

/**
 * GET /Documents/ReservationConfirmation/:id
 * Generate confirmation for Zenith reservation
 */
router.get('/ReservationConfirmation/:id', asyncHandler(async (req, res) => {
  const reservationId = parseInt(req.params.id);

  if (!reservationId || isNaN(reservationId)) {
    throw new NotFoundError('Reservation');
  }

  const pool = await getPool();

  const result = await pool.request()
    .input('ReservationId', reservationId)
    .query(`
      SELECT
        r.Id,
        r.uniqueID,
        r.HotelCode,
        r.HotelName,
        r.DateFrom as checkIn,
        r.DateTo as checkOut,
        r.AmountAfterTax as totalPrice,
        r.CurrencyCode as currency,
        r.GuestName as guestName,
        r.RatePlanCode,
        r.RoomTypeCode as roomType,
        r.AdultCount as adults,
        r.ChildrenCount as children,
        r.Comments as specialRequests,
        r.DateInsert as bookingDate,
        r.IsApproved
      FROM Med_Reservation r
      WHERE r.Id = @ReservationId
    `);

  if (result.recordset.length === 0) {
    throw new NotFoundError('Reservation');
  }

  const reservation = result.recordset[0];

  const pdfBuffer = await pdfGenerator.generateBookingConfirmation({
    reference: reservation.uniqueID,
    bookingDate: reservation.bookingDate,
    status: reservation.IsApproved ? 'Confirmed' : 'Pending',
    hotelName: reservation.HotelName,
    hotelCode: reservation.HotelCode,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    totalPrice: reservation.totalPrice,
    currency: reservation.currency || 'EUR',
    roomType: reservation.roomType,
    adults: reservation.adults,
    children: reservation.children,
    guestName: reservation.guestName,
    specialRequests: reservation.specialRequests
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reservation-${reservation.uniqueID}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);

  res.send(pdfBuffer);
}));

/**
 * POST /Documents/BatchConfirmations
 * Generate multiple confirmations as a ZIP file (for future implementation)
 */
router.post('/BatchConfirmations', asyncHandler(async (req, res) => {
  res.json({
    success: false,
    message: 'Batch PDF generation coming soon'
  });
}));

module.exports = router;
