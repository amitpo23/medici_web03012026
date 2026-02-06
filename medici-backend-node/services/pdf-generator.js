/**
 * PDF Generator Service
 * Following pdf skill principles - using PDFKit for Node.js
 *
 * Generates professional booking confirmations and invoices
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFGenerator {
  constructor() {
    this.primaryColor = '#6366f1';
    this.textColor = '#1e293b';
    this.mutedColor = '#64748b';
  }

  /**
   * Generate booking confirmation PDF
   * @param {Object} booking - Booking details
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generateBookingConfirmation(booking) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Booking Confirmation - ${booking.reference}`,
            Author: 'Medici Hotels',
            Subject: 'Booking Confirmation'
          }
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header with logo area
        this.drawHeader(doc, booking);

        // Booking summary box
        this.drawBookingSummary(doc, booking);

        // Hotel details
        this.drawHotelDetails(doc, booking);

        // Guest details
        this.drawGuestDetails(doc, booking);

        // Room & rate details
        this.drawRoomDetails(doc, booking);

        // Price breakdown
        this.drawPriceBreakdown(doc, booking);

        // Terms & conditions
        this.drawTerms(doc, booking);

        // Footer
        this.drawFooter(doc);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  drawHeader(doc, booking) {
    // Company name/logo
    doc.fontSize(28)
       .fillColor(this.primaryColor)
       .font('Helvetica-Bold')
       .text('MEDICI HOTELS', 50, 50);

    doc.fontSize(10)
       .fillColor(this.mutedColor)
       .font('Helvetica')
       .text('Premium Hotel Distribution', 50, 82);

    // Confirmation badge
    doc.roundedRect(400, 45, 145, 45, 5)
       .fill(this.primaryColor);

    doc.fontSize(9)
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .text('CONFIRMED', 410, 55, { width: 125, align: 'center' });

    doc.fontSize(12)
       .text(booking.reference || 'N/A', 410, 70, { width: 125, align: 'center' });

    // Divider line
    doc.moveTo(50, 110)
       .lineTo(545, 110)
       .strokeColor('#e2e8f0')
       .stroke();

    doc.y = 130;
  }

  drawBookingSummary(doc, booking) {
    const y = doc.y;

    doc.fontSize(14)
       .fillColor(this.textColor)
       .font('Helvetica-Bold')
       .text('Booking Summary', 50, y);

    doc.y = y + 25;

    // Summary grid
    const summaryData = [
      ['Booking Reference', booking.reference || 'N/A'],
      ['Booking Date', this.formatDate(booking.bookingDate || new Date())],
      ['Status', booking.status || 'Confirmed'],
      ['Total Amount', this.formatCurrency(booking.totalPrice, booking.currency)]
    ];

    summaryData.forEach(([label, value], index) => {
      const col = index % 2 === 0 ? 50 : 300;
      const row = Math.floor(index / 2) * 25 + doc.y;

      doc.fontSize(9)
         .fillColor(this.mutedColor)
         .font('Helvetica')
         .text(label, col, row);

      doc.fontSize(11)
         .fillColor(this.textColor)
         .font('Helvetica-Bold')
         .text(value, col, row + 12);
    });

    doc.y += 75;
  }

  drawHotelDetails(doc, booking) {
    const y = doc.y;

    // Section header
    doc.roundedRect(50, y, 495, 30, 3)
       .fill('#f1f5f9');

    doc.fontSize(11)
       .fillColor(this.textColor)
       .font('Helvetica-Bold')
       .text('Hotel Information', 60, y + 10);

    doc.y = y + 45;

    // Hotel details
    doc.fontSize(14)
       .fillColor(this.textColor)
       .font('Helvetica-Bold')
       .text(booking.hotelName || 'Hotel Name', 50, doc.y);

    doc.y += 20;

    if (booking.hotelAddress) {
      doc.fontSize(10)
         .fillColor(this.mutedColor)
         .font('Helvetica')
         .text(booking.hotelAddress, 50, doc.y);
      doc.y += 15;
    }

    if (booking.hotelCity) {
      doc.text(`${booking.hotelCity}${booking.hotelCountry ? ', ' + booking.hotelCountry : ''}`, 50, doc.y);
      doc.y += 15;
    }

    if (booking.hotelPhone) {
      doc.text(`Tel: ${booking.hotelPhone}`, 50, doc.y);
      doc.y += 15;
    }

    doc.y += 15;
  }

  drawGuestDetails(doc, booking) {
    const y = doc.y;

    // Section header
    doc.roundedRect(50, y, 495, 30, 3)
       .fill('#f1f5f9');

    doc.fontSize(11)
       .fillColor(this.textColor)
       .font('Helvetica-Bold')
       .text('Guest Details', 60, y + 10);

    doc.y = y + 45;

    const guestData = [
      ['Guest Name', booking.guestName || 'N/A'],
      ['Email', booking.guestEmail || 'N/A'],
      ['Phone', booking.guestPhone || 'N/A'],
      ['Adults / Children', `${booking.adults || 2} Adults${booking.children ? ', ' + booking.children + ' Children' : ''}`]
    ];

    guestData.forEach(([label, value], index) => {
      const col = index % 2 === 0 ? 50 : 300;
      const row = Math.floor(index / 2) * 35 + doc.y;

      doc.fontSize(9)
         .fillColor(this.mutedColor)
         .font('Helvetica')
         .text(label, col, row);

      doc.fontSize(10)
         .fillColor(this.textColor)
         .font('Helvetica')
         .text(value, col, row + 12);
    });

    doc.y += 90;
  }

  drawRoomDetails(doc, booking) {
    const y = doc.y;

    // Section header
    doc.roundedRect(50, y, 495, 30, 3)
       .fill('#f1f5f9');

    doc.fontSize(11)
       .fillColor(this.textColor)
       .font('Helvetica-Bold')
       .text('Stay Details', 60, y + 10);

    doc.y = y + 45;

    // Date boxes
    this.drawDateBox(doc, 50, doc.y, 'Check-in', booking.checkIn);
    this.drawDateBox(doc, 200, doc.y, 'Check-out', booking.checkOut);

    // Nights calculation
    const nights = this.calculateNights(booking.checkIn, booking.checkOut);
    doc.roundedRect(370, doc.y, 175, 50, 5)
       .fill(this.primaryColor);

    doc.fontSize(24)
       .fillColor('#ffffff')
       .font('Helvetica-Bold')
       .text(nights.toString(), 370, doc.y + 8, { width: 175, align: 'center' });

    doc.fontSize(10)
       .text('Night(s)', 370, doc.y + 35, { width: 175, align: 'center' });

    doc.y += 70;

    // Room info
    const roomData = [
      ['Room Type', booking.roomType || 'Standard Room'],
      ['Meal Plan', booking.mealPlan || 'Room Only'],
      ['Room Category', booking.roomCategory || 'N/A'],
      ['Cancellation', booking.cancellationType || 'See Terms']
    ];

    roomData.forEach(([label, value], index) => {
      const col = index % 2 === 0 ? 50 : 300;
      const row = Math.floor(index / 2) * 35 + doc.y;

      doc.fontSize(9)
         .fillColor(this.mutedColor)
         .font('Helvetica')
         .text(label, col, row);

      doc.fontSize(10)
         .fillColor(this.textColor)
         .font('Helvetica')
         .text(value, col, row + 12);
    });

    doc.y += 90;
  }

  drawDateBox(doc, x, y, label, date) {
    doc.roundedRect(x, y, 130, 50, 5)
       .strokeColor('#e2e8f0')
       .stroke();

    doc.fontSize(9)
       .fillColor(this.mutedColor)
       .font('Helvetica')
       .text(label, x + 10, y + 8);

    doc.fontSize(12)
       .fillColor(this.textColor)
       .font('Helvetica-Bold')
       .text(this.formatDate(date), x + 10, y + 25);
  }

  drawPriceBreakdown(doc, booking) {
    const y = doc.y;

    // Section header
    doc.roundedRect(50, y, 495, 30, 3)
       .fill('#f1f5f9');

    doc.fontSize(11)
       .fillColor(this.textColor)
       .font('Helvetica-Bold')
       .text('Price Breakdown', 60, y + 10);

    doc.y = y + 50;

    // Price lines
    const nights = this.calculateNights(booking.checkIn, booking.checkOut);
    const pricePerNight = booking.totalPrice / nights;

    const priceLines = [
      [`Room Rate (${nights} night${nights > 1 ? 's' : ''})`, this.formatCurrency(booking.totalPrice, booking.currency)],
    ];

    if (booking.taxes) {
      priceLines.push(['Taxes & Fees', this.formatCurrency(booking.taxes, booking.currency)]);
    }

    priceLines.forEach(([label, value]) => {
      doc.fontSize(10)
         .fillColor(this.mutedColor)
         .font('Helvetica')
         .text(label, 50, doc.y);

      doc.fillColor(this.textColor)
         .text(value, 400, doc.y, { width: 145, align: 'right' });

      doc.y += 20;
    });

    // Total line
    doc.moveTo(50, doc.y)
       .lineTo(545, doc.y)
       .strokeColor('#e2e8f0')
       .stroke();

    doc.y += 10;

    doc.fontSize(12)
       .fillColor(this.textColor)
       .font('Helvetica-Bold')
       .text('Total Amount', 50, doc.y);

    doc.fontSize(14)
       .fillColor(this.primaryColor)
       .text(this.formatCurrency(booking.totalPrice + (booking.taxes || 0), booking.currency), 400, doc.y - 2, { width: 145, align: 'right' });

    doc.y += 40;
  }

  drawTerms(doc, booking) {
    if (doc.y > 650) {
      doc.addPage();
      doc.y = 50;
    }

    const y = doc.y;

    doc.fontSize(10)
       .fillColor(this.textColor)
       .font('Helvetica-Bold')
       .text('Terms & Conditions', 50, y);

    doc.y = y + 15;

    const terms = [
      'Check-in time: 15:00 | Check-out time: 11:00',
      'Please present this confirmation upon arrival.',
      'Special requests are subject to availability.',
      booking.cancellationPolicy || 'Cancellation policy as per hotel terms.'
    ];

    doc.fontSize(8)
       .fillColor(this.mutedColor)
       .font('Helvetica');

    terms.forEach(term => {
      doc.text(`• ${term}`, 50, doc.y, { width: 495 });
      doc.y += 12;
    });
  }

  drawFooter(doc) {
    const bottomY = doc.page.height - 50;

    doc.moveTo(50, bottomY - 20)
       .lineTo(545, bottomY - 20)
       .strokeColor('#e2e8f0')
       .stroke();

    doc.fontSize(8)
       .fillColor(this.mutedColor)
       .font('Helvetica')
       .text('Medici Hotels - Premium Hotel Distribution', 50, bottomY - 10, { width: 495, align: 'center' });

    doc.text(`Generated on ${this.formatDate(new Date())}`, 50, bottomY, { width: 495, align: 'center' });
  }

  // Helper methods
  formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatCurrency(amount, currency = 'EUR') {
    if (!amount && amount !== 0) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'EUR'
    }).format(amount);
  }

  calculateNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 1;
    const from = new Date(checkIn);
    const to = new Date(checkOut);
    const diff = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }

  /**
   * Generate invoice PDF
   */
  async generateInvoice(booking, invoiceNumber) {
    // Similar structure to booking confirmation
    // Can be extended as needed
    return this.generateBookingConfirmation({
      ...booking,
      reference: invoiceNumber,
      status: 'Invoice'
    });
  }
}

module.exports = new PDFGenerator();
