/**
 * GoGlobal API Client
 * Secondary hotel supplier for multi-source search
 * Provides fallback and price comparison capabilities
 */

const axios = require('axios');
const logger = require('../config/logger');

class GoGlobalClient {
  constructor() {
    this.apiUrl = process.env.GOGLOBAL_API_URL || 'https://api.goglobal.com';
    this.apiKey = process.env.GOGLOBAL_API_KEY;
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Check if GoGlobal is configured and available
   */
  isConfigured() {
    return !!(this.apiUrl && this.apiKey);
  }

  /**
   * Get default headers for GoGlobal API
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Search for available hotels
   * @param {Object} params - Search parameters
   * @param {string} params.dateFrom - Check-in date (YYYY-MM-DD)
   * @param {string} params.dateTo - Check-out date (YYYY-MM-DD)
   * @param {number} params.hotelId - GoGlobal hotel ID
   * @param {string} params.hotelName - Hotel name (alternative to hotelId)
   * @param {string} params.city - City name
   * @param {number} params.adults - Number of adults
   * @param {number[]} params.children - Array of children ages
   * @param {string} params.currency - Currency code (default: EUR)
   */
  async searchHotels(params) {
    try {
      if (!this.isConfigured()) {
        logger.warn('[GoGlobal] Not configured - skipping');
        return {
          success: false,
          error: 'GoGlobal API not configured',
          configured: false
        };
      }

      const { 
        dateFrom, 
        dateTo, 
        hotelId, 
        hotelName,
        city,
        adults = 2, 
        children = [],
        currency = 'EUR'
      } = params;

      // Build search request based on GoGlobal API format
      const searchRequest = {
        checkIn: dateFrom,
        checkOut: dateTo,
        currency: currency,
        rooms: [{
          adults: adults,
          children: children.map(age => ({ age }))
        }]
      };

      // Add hotel filter (ID, name, or city)
      if (hotelId) {
        searchRequest.hotelIds = [hotelId];
      } else if (hotelName) {
        searchRequest.hotelName = hotelName;
      } else if (city) {
        searchRequest.city = city;
      }

      logger.info(`[GoGlobal] Searching: ${hotelName || city || hotelId} for ${dateFrom} - ${dateTo}`);

      const response = await axios.post(
        `${this.apiUrl}/api/v1/search`,
        searchRequest,
        { 
          headers: this.getHeaders(),
          timeout: this.timeout
        }
      );

      // Normalize response to match Innstant format
      const normalized = this.normalizeSearchResponse(response.data);

      return {
        success: true,
        supplier: 'GoGlobal',
        data: normalized,
        hotels: normalized.hotels || [],
        rawResponse: response.data
      };
    } catch (error) {
      logger.error('[GoGlobal] Search error:', { 
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      return {
        success: false,
        supplier: 'GoGlobal',
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Pre-book a room (hold availability and get price)
   * @param {Object} params - PreBook parameters
   */
  async preBook(params) {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'GoGlobal API not configured'
        };
      }

      const { 
        searchToken,
        hotelId, 
        roomId, 
        rateId,
        checkIn, 
        checkOut, 
        adults, 
        children = [] 
      } = params;

      const preBookRequest = {
        token: searchToken,
        hotelId: hotelId,
        roomId: roomId,
        rateId: rateId,
        checkIn: checkIn,
        checkOut: checkOut,
        rooms: [{
          adults: adults,
          children: children.map(age => ({ age }))
        }]
      };

      logger.info(`[GoGlobal] PreBooking hotel ${hotelId}, room ${roomId}`);

      const response = await axios.post(
        `${this.apiUrl}/api/v1/prebook`,
        preBookRequest,
        { 
          headers: this.getHeaders(),
          timeout: this.timeout
        }
      );

      return {
        success: true,
        supplier: 'GoGlobal',
        data: response.data,
        preBookId: response.data.preBookId || response.data.id,
        price: response.data.price,
        cancellationPolicy: response.data.cancellationPolicy
      };
    } catch (error) {
      logger.error('[GoGlobal] PreBook error:', { error: error.message });
      return {
        success: false,
        supplier: 'GoGlobal',
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Confirm booking
   * @param {Object} params - Booking parameters
   */
  async confirmBooking(params) {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'GoGlobal API not configured'
        };
      }

      const { 
        preBookId, 
        guestName, 
        guestEmail,
        guestPhone 
      } = params;

      const bookingRequest = {
        preBookId: preBookId,
        guest: {
          name: guestName,
          email: guestEmail,
          phone: guestPhone
        }
      };

      logger.info(`[GoGlobal] Confirming booking for preBookId: ${preBookId}`);

      const response = await axios.post(
        `${this.apiUrl}/api/v1/book`,
        bookingRequest,
        { 
          headers: this.getHeaders(),
          timeout: this.timeout
        }
      );

      return {
        success: true,
        supplier: 'GoGlobal',
        bookingId: response.data.bookingId || response.data.confirmationNumber,
        confirmationNumber: response.data.confirmationNumber,
        data: response.data
      };
    } catch (error) {
      logger.error('[GoGlobal] Confirm booking error:', { error: error.message });
      return {
        success: false,
        supplier: 'GoGlobal',
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Cancel booking
   * @param {Object} params - Cancellation parameters
   */
  async cancelBooking(params) {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'GoGlobal API not configured'
        };
      }

      const { bookingId, reason } = params;

      logger.info(`[GoGlobal] Cancelling booking: ${bookingId}`);

      const response = await axios.delete(
        `${this.apiUrl}/api/v1/bookings/${bookingId}`,
        {
          headers: this.getHeaders(),
          timeout: this.timeout,
          data: { reason: reason || 'Customer request' }
        }
      );

      return {
        success: true,
        supplier: 'GoGlobal',
        cancelled: true,
        data: response.data
      };
    } catch (error) {
      logger.error('[GoGlobal] Cancel booking error:', { error: error.message });
      return {
        success: false,
        supplier: 'GoGlobal',
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Normalize GoGlobal response to match internal format
   * @private
   */
  normalizeSearchResponse(data) {
    try {
      // Transform GoGlobal format to match Innstant/internal format
      const normalized = {
        token: data.searchId || data.token,
        hotels: []
      };

      if (data.hotels && Array.isArray(data.hotels)) {
        normalized.hotels = data.hotels.map(hotel => ({
          hotelId: hotel.id,
          hotelName: hotel.name,
          city: hotel.city,
          stars: hotel.stars || hotel.rating,
          supplier: 'GoGlobal',
          rooms: (hotel.rooms || []).map(room => ({
            roomId: room.id,
            roomName: room.name,
            boardType: room.boardType || room.mealPlan,
            price: room.price,
            currency: room.currency || 'EUR',
            rateId: room.rateId,
            available: room.available !== false,
            cancellationPolicy: room.cancellationPolicy
          }))
        }));
      }

      return normalized;
    } catch (error) {
      logger.error('[GoGlobal] Error normalizing response:', error);
      return { hotels: [] };
    }
  }

  /**
   * Get booking details
   * @param {string} bookingId - GoGlobal booking ID
   */
  async getBookingDetails(bookingId) {
    try {
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'GoGlobal API not configured'
        };
      }

      const response = await axios.get(
        `${this.apiUrl}/api/v1/bookings/${bookingId}`,
        { 
          headers: this.getHeaders(),
          timeout: this.timeout
        }
      );

      return {
        success: true,
        supplier: 'GoGlobal',
        data: response.data
      };
    } catch (error) {
      logger.error('[GoGlobal] Get booking details error:', { error: error.message });
      return {
        success: false,
        supplier: 'GoGlobal',
        error: error.message
      };
    }
  }
}

module.exports = GoGlobalClient;
