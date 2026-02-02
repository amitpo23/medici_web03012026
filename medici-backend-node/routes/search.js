const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { getPool } = require('../config/database');
const InnstantClient = require('../services/innstant-client');

// Safe imports - optional features that won't crash if missing
let MultiSupplierAggregator, getCacheService, multiSupplier, cache;
try {
  MultiSupplierAggregator = require('../services/multi-supplier-aggregator');
  getCacheService = require('../services/cache-service').getCacheService;
  multiSupplier = new MultiSupplierAggregator();
  cache = getCacheService();
  logger.info('✅ Multi-Supplier and Cache services loaded');
} catch (err) {
  logger.warn('⚠️  Multi-Supplier/Cache services not available, using basic mode', { error: err.message });
  // Create mock objects to prevent crashes
  cache = {
    generateKey: () => null,
    get: async () => null,
    set: async () => {},
    cacheSearch: async () => {}
  };
}

const innstantClient = new InnstantClient();

/**
 * POST /Search/InnstantPrice
 * GPT Best Practices Implementation:
 * - Smart defaults: Adults=2, PaxChildren=[]
 * - Date format: yyyy-mm-dd
 * - HotelName XOR City logic
 * - Returns array of hotel results with pricing
 */
router.post('/InnstantPrice', async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      hotelId,
      hotelName,
      city,
      stars,
      adults = 2,          // GPT Default: 2 adults
      paxChildren = [],    // GPT Default: empty array
      limit = 50
    } = req.body;

    // Validation: HotelName XOR City (not both)
    if (hotelName && city) {
      return res.status(400).json({ 
        error: 'Cannot specify both hotelName and city. Use one or the other.' 
      });
    }

    // Validation: Date format and range
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ 
        error: 'dateFrom and dateTo are required (format: yyyy-mm-dd)' 
      });
    }

    const pool = await getPool();
    let searchResults = [];

    // Case 1: Search by specific hotel ID
    if (hotelId) {
      const hotelMapping = await pool.request()
        .input('hotelId', hotelId)
        .query('SELECT InnstantId, Name FROM Med_Hotels WHERE HotelId = @hotelId');
      
      const innstantHotelId = hotelMapping.recordset[0]?.InnstantId;
      const hotelNameFromDb = hotelMapping.recordset[0]?.Name;

      if (!innstantHotelId) {
        return res.status(404).json({ 
          error: `Hotel ID ${hotelId} not found or has no Innstant mapping` 
        });
      }

      if (process.env.INNSTANT_ACCESS_TOKEN) {
        const innstantResults = await innstantClient.searchHotels({
          hotelId: innstantHotelId,
          dateFrom,
          dateTo,
          adults,
          children: paxChildren
        });

        if (innstantResults.success && innstantResults.hotels.length > 0) {
          searchResults = innstantResults.hotels.map(hotel => ({
            hotelId: hotelId,
            hotelName: hotelNameFromDb,
            innstantId: innstantHotelId,
            checkIn: dateFrom,
            checkOut: dateTo,
            rooms: hotel.rooms || [],
            price: hotel.price,
            currency: hotel.currency || 'EUR',
            source: 'Innstant'
          }));
        }
      }
    }
    
    // Case 2: Search by hotel name
    else if (hotelName) {
      const hotelMapping = await pool.request()
        .input('hotelName', `%${hotelName}%`)
        .query(`
          SELECT TOP ${limit} HotelId, InnstantId, Name 
          FROM Med_Hotels 
          WHERE Name LIKE @hotelName AND InnstantId IS NOT NULL
        `);

      for (const hotel of hotelMapping.recordset) {
        if (process.env.INNSTANT_ACCESS_TOKEN) {
          const innstantResults = await innstantClient.searchHotels({
            hotelId: hotel.InnstantId,
            dateFrom,
            dateTo,
            adults,
            children: paxChildren
          });

          if (innstantResults.success && innstantResults.hotels.length > 0) {
            searchResults.push({
              hotelId: hotel.HotelId,
              hotelName: hotel.Name,
              innstantId: hotel.InnstantId,
              checkIn: dateFrom,
              checkOut: dateTo,
              rooms: innstantResults.hotels[0].rooms || [],
              price: innstantResults.hotels[0].price,
              currency: innstantResults.hotels[0].currency || 'EUR',
              source: 'Innstant'
            });
          }
        }
      }
    }
    
    // Case 3: Search by city and/or stars
    else if (city || stars) {
      let query = `
        SELECT TOP ${limit} HotelId, InnstantId, Name, City, Stars
        FROM Med_Hotels 
        WHERE InnstantId IS NOT NULL
      `;
      const request = pool.request();

      if (city) {
        query += ' AND City = @city';
        request.input('city', city);
      }
      if (stars) {
        query += ' AND Stars = @stars';
        request.input('stars', stars);
      }

      const hotelMapping = await request.query(query);

      for (const hotel of hotelMapping.recordset) {
        if (process.env.INNSTANT_ACCESS_TOKEN) {
          const innstantResults = await innstantClient.searchHotels({
            hotelId: hotel.InnstantId,
            dateFrom,
            dateTo,
            adults,
            children: paxChildren
          });

          if (innstantResults.success && innstantResults.hotels.length > 0) {
            searchResults.push({
              hotelId: hotel.HotelId,
              hotelName: hotel.Name,
              city: hotel.City,
              stars: hotel.Stars,
              innstantId: hotel.InnstantId,
              checkIn: dateFrom,
              checkOut: dateTo,
              rooms: innstantResults.hotels[0].rooms || [],
              price: innstantResults.hotels[0].price,
              currency: innstantResults.hotels[0].currency || 'EUR',
              source: 'Innstant'
            });
          }
        }
      }
    }
    
    // No search criteria provided
    else {
      return res.status(400).json({ 
        error: 'Must provide hotelId, hotelName, or city/stars for search' 
      });
    }

    // Save search results to database for future reference
    for (const result of searchResults) {
      try {
        await pool.request()
          .input('hotelId', result.hotelId)
          .input('dateFrom', dateFrom)
          .input('dateTo', dateTo)
          .input('price', result.price)
          .input('currency', result.currency)
          .input('source', result.source)
          .query(`
            INSERT INTO MED_SearchHotels 
            (HotelId, DateFrom, DateTo, Price, Currency, Source, DateInsert)
            VALUES (@hotelId, @dateFrom, @dateTo, @price, @currency, @source, GETDATE())
          `);
      } catch (dbError) {
        logger.warn('Error saving search result to DB', { error: dbError.message });
      }
    }

    logger.info(`[Search] Found ${searchResults.length} results`);
    
    res.json({
      success: true,
      count: searchResults.length,
      searchParams: { dateFrom, dateTo, adults, paxChildren },
      results: searchResults
    });

  } catch (err) {
    logger.error('Error in Innstant search', { error: err.message, stack: err.stack });
    res.status(500).json({ 
      error: 'Search failed', 
      message: err.message 
    });
  }
});

// Legacy search endpoint (backward compatibility)
router.post('/Search', async (req, res) => {
  try {
    const {
      hotelId,
      dateFrom,
      dateTo,
      boardId,
      categoryId,
      adults,
      children
    } = req.body;

    const pool = await getPool();
    
    // Get hotel mapping from database
    const hotelMapping = await pool.request()
      .input('hotelId', hotelId)
      .query('SELECT InnstantId FROM Med_Hotels WHERE HotelId = @hotelId');
    
    const innstantHotelId = hotelMapping.recordset[0]?.InnstantId;

    // If hotel has Innstant mapping and API is configured, search via Innstant
    if (innstantHotelId && process.env.INNSTANT_ACCESS_TOKEN) {
      try {
        const innstantResults = await innstantClient.searchHotels({
          hotelId: innstantHotelId,
          dateFrom,
          dateTo,
          adults: adults || 2,
          children: children || []
        });

        // Save Innstant results to database for later booking
        if (innstantResults && innstantResults.length > 0) {
          for (const room of innstantResults) {
            await pool.request()
              .input('hotelId', hotelId)
              .input('dateFrom', dateFrom)
              .input('dateTo', dateTo)
              .input('roomCode', room.roomCode)
              .input('price', room.price)
              .input('currency', room.currency)
              .input('supplierReferenceId', room.referenceId)
              .execute('MED_SaveSupplierPrice');
          }
        }

        res.json(innstantResults);
        return;
      } catch (innstantError) {
        logger.error('Innstant API error, falling back to DB', { error: innstantError.message });
      }
    }

    // Fallback: Call stored procedure for search from database
    const result = await pool.request()
      .input('hotelId', hotelId)
      .input('dateFrom', dateFrom)
      .input('dateTo', dateTo)
      .input('boardId', boardId)
      .input('categoryId', categoryId)
      .input('adults', adults)
      .input('children', children)
      .execute('MED_SearchAvailableRooms');

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error searching rooms', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * POST /Search/MultiSupplier
 * Search across multiple suppliers (Innstant + GoGlobal)
 * Optional feature - only works if multi-supplier service is enabled
 */
router.post('/MultiSupplier', async (req, res) => {
  try {
    if (!multiSupplier) {
      return res.status(501).json({ 
        error: 'Multi-supplier feature not enabled',
        message: 'This feature requires additional configuration'
      });
    }

    const {
      dateFrom,
      dateTo,
      hotelId,
      hotelName,
      city,
      stars,
      adults = 2,
      paxChildren = [],
      preferredSupplier = 'all',
      bestPriceOnly = false
    } = req.body;

    // Validation
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ 
        error: 'dateFrom and dateTo are required (format: yyyy-mm-dd)' 
      });
    }

    const pool = await getPool();
    let searchParams = {
      dateFrom,
      dateTo,
      adults,
      children: paxChildren
    };

    // Get hotel mapping from database if hotelId provided
    if (hotelId) {
      const hotelMapping = await pool.request()
        .input('hotelId', hotelId)
        .query('SELECT InnstantId, GoGlobalId, Name FROM Med_Hotels WHERE HotelId = @hotelId');
      
      if (hotelMapping.recordset.length === 0) {
        return res.status(404).json({ 
          error: `Hotel ID ${hotelId} not found` 
        });
      }

      const hotel = hotelMapping.recordset[0];
      searchParams.hotelId = hotel.InnstantId || hotel.GoGlobalId;
      searchParams.hotelName = hotel.Name;
    } else if (hotelName) {
      searchParams.hotelName = hotelName;
    } else if (city) {
      searchParams.city = city;
    } else {
      return res.status(400).json({ 
        error: 'Must provide hotelId, hotelName, or city for search' 
      });
    }

    if (stars) {
      searchParams.stars = stars;
    }

    logger.info('[Search] MultiSupplier search initiated', { 
      params: searchParams, 
      preferredSupplier,
      bestPriceOnly 
    });

    // Execute multi-supplier search
    const results = await multiSupplier.searchAllSuppliers(searchParams, {
      preferredSupplier,
      bestPriceOnly
    });

    // Save search results to database
    if (results.success && results.combined.length > 0) {
      for (const hotel of results.combined) {
        try {
          const minPrice = multiSupplier.getMinRoomPrice(hotel.rooms);
          await pool.request()
            .input('hotelId', hotelId || null)
            .input('hotelName', hotel.hotelName)
            .input('dateFrom', dateFrom)
            .input('dateTo', dateTo)
            .input('price', minPrice)
            .input('currency', hotel.rooms[0]?.currency || 'EUR')
            .input('source', hotel.supplier)
            .query(`
              INSERT INTO MED_SearchHotels 
              (HotelId, HotelName, DateFrom, DateTo, Price, Currency, Source, DateInsert)
              VALUES (@hotelId, @hotelName, @dateFrom, @dateTo, @price, @currency, @source, GETDATE())
            `);
        } catch (dbError) {
          logger.warn('Error saving multi-supplier result', { error: dbError.message });
        }
      }
    }

    res.json({
      success: results.success,
      searchId: results.searchId,
      count: results.combined.length,
      suppliers: results.suppliers,
      bestPrice: results.bestPrice,
      results: results.combined
    });

  } catch (err) {
    logger.error('Error in multi-supplier search', { error: err.message, stack: err.stack });
    res.status(500).json({ 
      error: 'Multi-supplier search failed', 
      message: err.message 
    });
  }
});

/**
 * GET /Search/SupplierStats
 * Get supplier availability and statistics
 * Optional feature - only works if multi-supplier service is enabled
 */
router.get('/SupplierStats', (req, res) => {
  try {
    if (!multiSupplier) {
      return res.json({
        success: true,
        message: 'Multi-supplier feature not enabled',
        suppliers: {
          innstant: { available: true, configured: true }
        }
      });
    }
    
    const stats = multiSupplier.getSupplierStats();
    res.json({
      success: true,
      suppliers: stats
    });
  } catch (err) {
    logger.error('Error getting supplier stats', { error: err.message });
    res.status(500).json({ error: 'Failed to get supplier stats' });
  }
});

module.exports = router;
