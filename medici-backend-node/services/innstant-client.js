/**
 * Innstant API Client
 * Connects to Innstant API for hotel search, pre-booking, and booking
 */

const axios = require('axios');
const logger = require('../config/logger');

class InnstantClient {
  constructor() {
    this.searchUrl = process.env.INNSTANT_SEARCH_URL || 'https://connect.mishor5.innstant-servers.com';
    this.bookUrl = process.env.INNSTANT_BOOK_URL || 'https://book.mishor5.innstant-servers.com';
    this.accessToken = process.env.INNSTANT_ACCESS_TOKEN;
    this.applicationKey = process.env.INNSTANT_APPLICATION_KEY;
  }

  /**
   * Get default headers for Innstant API
   */
  getHeaders() {
    return {
      'aether-access-token': this.accessToken,
      'aether-application-key': this.applicationKey,
      'content-type': 'application/json'
    };
  }

  /**
   * Search for available hotels
   * @param {Object} params - Search parameters
   * @param {string} params.dateFrom - Check-in date (YYYY-MM-DD)
   * @param {string} params.dateTo - Check-out date (YYYY-MM-DD)
   * @param {number} params.hotelId - Innstant hotel ID
   * @param {number} params.adults - Number of adults
   * @param {number[]} params.children - Array of children ages
   */
  async searchHotels(params) {
    try {
      const { dateFrom, dateTo, hotelId, adults = 2, children = [] } = params;

      const searchRequest = {
        checkIn: dateFrom,
        checkOut: dateTo,
        hotelIds: [hotelId],
        rooms: [{
          adults: adults,
          children: children.map(age => ({ age }))
        }],
        nationality: 'IL',
        currency: 'EUR'
      };

      logger.info(`[Innstant] Searching hotel ${hotelId} for ${dateFrom} - ${dateTo}`);

      const response = await axios.post(
        `${this.searchUrl}/api/v1/hotels/search`,
        searchRequest,
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        data: response.data,
        hotels: response.data.hotels || []
      };
    } catch (error) {
      logger.error('[Innstant] Search error:', { error: error.message });
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Pre-book a room (hold availability and get price)
   * @param {Object} params - PreBook parameters
   * @param {string} params.token - Search result token
   * @param {Object} params.room - Room details from search
   */
  async preBook(params) {
    try {
      const { token, room, hotelId, checkIn, checkOut, adults, children = [] } = params;

      const preBookRequest = {
        token: token,
        hotelId: hotelId,
        roomId: room.roomId,
        rateId: room.rateId,
        checkIn: checkIn,
        checkOut: checkOut,
        rooms: [{
          adults: adults,
          children: children.map(age => ({ age }))
        }]
      };

      logger.info(`[Innstant] PreBooking hotel ${hotelId}`);

      const response = await axios.post(
        `${this.bookUrl}/api/v1/booking/prebook`,
        preBookRequest,
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        preBookId: response.data.preBookId,
        price: response.data.price,
        currency: response.data.currency,
        cancellationType: response.data.cancellationPolicy?.type,
        cancellationDeadline: response.data.cancellationPolicy?.deadline,
        token: response.data.token,
        data: response.data
      };
    } catch (error) {
      logger.error('[Innstant] PreBook error:', { error: error.message });
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Confirm booking
   * @param {Object} params - Booking parameters
   * @param {string} params.preBookToken - Token from pre-book
   * @param {Object} params.guest - Guest information
   */
  async book(params) {
    try {
      const { preBookToken, guest, paymentInfo } = params;

      const bookRequest = {
        token: preBookToken,
        guests: [{
          title: guest.title || 'Mr',
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email || 'booking@medicihotels.com',
          phone: guest.phone || '+972000000000'
        }],
        specialRequests: guest.specialRequests || '',
        paymentInfo: paymentInfo || null
      };

      logger.info(`[Innstant] Confirming booking for ${guest.firstName} ${guest.lastName}`);

      const response = await axios.post(
        `${this.bookUrl}/api/v1/booking/confirm`,
        bookRequest,
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        bookingId: response.data.bookingId,
        confirmationNumber: response.data.confirmationNumber,
        supplierReference: response.data.supplierReference,
        status: response.data.status,
        data: response.data
      };
    } catch (error) {
      logger.error('[Innstant] Booking error:', { error: error.message });
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Cancel a booking
   * @param {string} bookingId - The booking ID to cancel
   */
  async cancelBooking(bookingId) {
    try {
      logger.info(`[Innstant] Cancelling booking ${bookingId}`);

      const response = await axios.post(
        `${this.bookUrl}/api/v1/booking/cancel`,
        { bookingId: bookingId },
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        cancellationId: response.data.cancellationId,
        status: response.data.status,
        data: response.data
      };
    } catch (error) {
      logger.error('[Innstant] Cancel error:', { error: error.message });
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Get booking details
   * @param {string} bookingId - The booking ID
   */
  async getBookingDetails(bookingId) {
    try {
      const response = await axios.get(
        `${this.bookUrl}/api/v1/booking/${bookingId}`,
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('[Innstant] Get booking error:', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = InnstantClient;
