/**
 * Multi-Supplier Aggregator
 * Combines results from Innstant and GoGlobal APIs
 * Provides best price comparison and fallback capabilities
 */

const InnstantClient = require('./innstant-client');
const GoGlobalClient = require('./goglobal-client');
const logger = require('../config/logger');

class MultiSupplierAggregator {
  constructor() {
    this.innstantClient = new InnstantClient();
    this.goGlobalClient = new GoGlobalClient();
  }

  /**
   * Search across all available suppliers
   * @param {Object} params - Search parameters
   * @param {boolean} options.preferredSupplier - 'innstant' | 'goglobal' | 'all'
   * @param {boolean} options.bestPriceOnly - Return only best price results
   * @param {number} options.timeout - Max wait time in ms
   */
  async searchAllSuppliers(params, options = {}) {
    const {
      preferredSupplier = 'all',
      bestPriceOnly = false,
      timeout = 25000
    } = options;

    logger.info('[MultiSupplier] Starting search', { 
      params: { ...params, adults: params.adults || 2 },
      preferredSupplier 
    });

    const results = {
      success: false,
      suppliers: {},
      combined: [],
      bestPrice: null,
      searchId: `multi_${Date.now()}`
    };

    try {
      // Determine which suppliers to query
      const suppliers = [];
      
      if (preferredSupplier === 'all' || preferredSupplier === 'innstant') {
        suppliers.push({
          name: 'innstant',
          client: this.innstantClient,
          priority: 1
        });
      }
      
      if (preferredSupplier === 'all' || preferredSupplier === 'goglobal') {
        if (this.goGlobalClient.isConfigured()) {
          suppliers.push({
            name: 'goglobal',
            client: this.goGlobalClient,
            priority: 2
          });
        } else {
          logger.warn('[MultiSupplier] GoGlobal not configured');
        }
      }

      if (suppliers.length === 0) {
        return {
          success: false,
          error: 'No suppliers configured',
          suppliers: {}
        };
      }

      // Execute searches in parallel with timeout
      const searchPromises = suppliers.map(supplier => 
        this.searchWithTimeout(supplier.client, params, timeout)
          .then(result => ({
            supplier: supplier.name,
            priority: supplier.priority,
            ...result
          }))
          .catch(error => ({
            supplier: supplier.name,
            success: false,
            error: error.message
          }))
      );

      const searchResults = await Promise.all(searchPromises);

      // Process results
      let hasSuccessfulSearch = false;
      
      for (const result of searchResults) {
        results.suppliers[result.supplier] = {
          success: result.success,
          hotels: result.hotels || [],
          error: result.error,
          responseTime: result.responseTime
        };

        if (result.success && result.hotels && result.hotels.length > 0) {
          hasSuccessfulSearch = true;
          
          // Add supplier tag to each hotel
          const taggedHotels = result.hotels.map(hotel => ({
            ...hotel,
            supplier: result.supplier,
            supplierPriority: result.priority
          }));
          
          results.combined.push(...taggedHotels);
        }
      }

      results.success = hasSuccessfulSearch;

      // Sort and deduplicate results
      if (results.combined.length > 0) {
        results.combined = this.deduplicateAndSort(results.combined, bestPriceOnly);
        results.bestPrice = this.findBestPrice(results.combined);
      }

      logger.info('[MultiSupplier] Search complete', {
        totalResults: results.combined.length,
        suppliers: Object.keys(results.suppliers),
        hasResults: hasSuccessfulSearch
      });

      return results;

    } catch (error) {
      logger.error('[MultiSupplier] Search error:', { error: error.message });
      return {
        success: false,
        error: error.message,
        suppliers: results.suppliers
      };
    }
  }

  /**
   * Search with timeout wrapper
   * @private
   */
  async searchWithTimeout(client, params, timeout) {
    const startTime = Date.now();
    
    return Promise.race([
      client.searchHotels(params),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), timeout)
      )
    ]).then(result => ({
      ...result,
      responseTime: Date.now() - startTime
    }));
  }

  /**
   * Deduplicate hotels by ID and sort by price
   * @private
   */
  deduplicateAndSort(hotels, bestPriceOnly) {
    const hotelMap = new Map();

    for (const hotel of hotels) {
      const key = `${hotel.hotelId}_${hotel.hotelName}`;
      
      if (!hotelMap.has(key)) {
        hotelMap.set(key, hotel);
      } else if (bestPriceOnly) {
        // Keep the hotel with better price
        const existing = hotelMap.get(key);
        const existingMinPrice = this.getMinRoomPrice(existing.rooms);
        const currentMinPrice = this.getMinRoomPrice(hotel.rooms);
        
        if (currentMinPrice < existingMinPrice) {
          hotelMap.set(key, hotel);
        }
      } else {
        // Merge rooms from both suppliers
        const existing = hotelMap.get(key);
        existing.rooms = [...existing.rooms, ...(hotel.rooms || [])];
        existing.suppliers = existing.suppliers || [existing.supplier];
        if (!existing.suppliers.includes(hotel.supplier)) {
          existing.suppliers.push(hotel.supplier);
        }
      }
    }

    // Convert to array and sort by price
    const deduplicated = Array.from(hotelMap.values());
    
    return deduplicated.sort((a, b) => {
      const priceA = this.getMinRoomPrice(a.rooms);
      const priceB = this.getMinRoomPrice(b.rooms);
      return priceA - priceB;
    });
  }

  /**
   * Get minimum room price from rooms array
   * @private
   */
  getMinRoomPrice(rooms) {
    if (!rooms || rooms.length === 0) return Infinity;
    return Math.min(...rooms.map(r => r.price || Infinity));
  }

  /**
   * Find best price across all results
   * @private
   */
  findBestPrice(hotels) {
    if (!hotels || hotels.length === 0) return null;

    let bestPrice = {
      price: Infinity,
      hotel: null,
      room: null,
      supplier: null
    };

    for (const hotel of hotels) {
      for (const room of (hotel.rooms || [])) {
        if (room.price < bestPrice.price) {
          bestPrice = {
            price: room.price,
            hotel: hotel.hotelName,
            hotelId: hotel.hotelId,
            room: room.roomName,
            roomId: room.roomId,
            supplier: hotel.supplier
          };
        }
      }
    }

    return bestPrice.price === Infinity ? null : bestPrice;
  }

  /**
   * Route PreBook to correct supplier
   */
  async preBook(supplier, params) {
    try {
      logger.info(`[MultiSupplier] PreBook via ${supplier}`);
      
      if (supplier === 'innstant') {
        return await this.innstantClient.preBook(params);
      } else if (supplier === 'goglobal') {
        return await this.goGlobalClient.preBook(params);
      } else {
        return {
          success: false,
          error: `Unknown supplier: ${supplier}`
        };
      }
    } catch (error) {
      logger.error('[MultiSupplier] PreBook error:', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Route Confirm Booking to correct supplier
   */
  async confirmBooking(supplier, params) {
    try {
      logger.info(`[MultiSupplier] Confirm booking via ${supplier}`);
      
      if (supplier === 'innstant') {
        return await this.innstantClient.confirmBooking(params);
      } else if (supplier === 'goglobal') {
        return await this.goGlobalClient.confirmBooking(params);
      } else {
        return {
          success: false,
          error: `Unknown supplier: ${supplier}`
        };
      }
    } catch (error) {
      logger.error('[MultiSupplier] Confirm booking error:', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Route Cancel Booking to correct supplier
   */
  async cancelBooking(supplier, params) {
    try {
      logger.info(`[MultiSupplier] Cancel booking via ${supplier}`);
      
      if (supplier === 'innstant') {
        return await this.innstantClient.cancelBooking(params);
      } else if (supplier === 'goglobal') {
        return await this.goGlobalClient.cancelBooking(params);
      } else {
        return {
          success: false,
          error: `Unknown supplier: ${supplier}`
        };
      }
    } catch (error) {
      logger.error('[MultiSupplier] Cancel booking error:', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get supplier statistics
   */
  getSupplierStats() {
    return {
      innstant: {
        configured: !!(process.env.INNSTANT_ACCESS_TOKEN),
        available: true
      },
      goglobal: {
        configured: this.goGlobalClient.isConfigured(),
        available: this.goGlobalClient.isConfigured()
      }
    };
  }
}

module.exports = MultiSupplierAggregator;
