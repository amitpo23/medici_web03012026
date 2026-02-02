const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const zenithPushService = require('../services/zenith-push-service');
const logger = require('../config/logger');

// Get all opportunities (paginated)
router.get('/Opportunities', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;

    const pool = await getPool();
    const result = await pool.request()
      .input('offset', offset)
      .input('limit', limit)
      .query(`
        SELECT *
        FROM [MED_ֹOֹֹpportunities]
        ORDER BY DateCreate DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching opportunities', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * POST /InsertOpp - Insert opportunity with automatic pricing
 * GPT Best Practices:
 * - BuyPrice = sourcePrice + $10
 * - PushPrice = sourcePrice + $50
 * - If buyPrice/pushPrice not provided, calculate from sourcePrice
 * - Validate dates are not outside search range
 */
router.post('/InsertOpp', async (req, res) => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      hotelId, startDateStr, endDateStr,
      boardlId, categorylId,
      sourcePrice,      // New: source price from supplier
      buyPrice,         // Optional: auto-calculated if not provided
      pushPrice,        // Optional: auto-calculated if not provided
      maxRooms,
      searchDateFrom,   // Optional: validate dates are within search range
      searchDateTo
    } = req.body;

    // Input validation
    if (!hotelId || !startDateStr || !endDateStr || !boardlId || !categorylId) {
      return res.status(400).json({ 
        error: 'Missing required fields: hotelId, startDateStr, endDateStr, boardlId, categorylId' 
      });
    }

    // GPT Best Practice: Validate dates are within search range
    if (searchDateFrom && searchDateTo) {
      const from = new Date(startDateStr);
      const to = new Date(endDateStr);
      const searchFrom = new Date(searchDateFrom);
      const searchTo = new Date(searchDateTo);
      
      if (from < searchFrom || to > searchTo) {
        return res.status(400).json({ 
          error: `Dates must be within search range (${searchDateFrom} to ${searchDateTo})` 
        });
      }
    }

    // GPT Best Practice: Automatic pricing calculation
    let calculatedBuyPrice = buyPrice;
    let calculatedPushPrice = pushPrice;

    if (sourcePrice != null) {
      // If sourcePrice provided, calculate buy/push prices using GPT rules
      calculatedBuyPrice = calculatedBuyPrice ?? (sourcePrice + 10);  // BuyPrice = source + $10
      calculatedPushPrice = calculatedPushPrice ?? (sourcePrice + 50); // PushPrice = source + $50
      
      logger.info('[InsertOpp] Auto-calculated prices', { 
        sourcePrice, 
        buyPrice: calculatedBuyPrice, 
        pushPrice: calculatedPushPrice,
        profit: calculatedPushPrice - calculatedBuyPrice
      });
    } else if (buyPrice == null || pushPrice == null) {
      return res.status(400).json({ 
        error: 'Either sourcePrice OR (buyPrice AND pushPrice) must be provided' 
      });
    }

    // Validate final prices
    if (calculatedBuyPrice < 0 || calculatedPushPrice < 0) {
      return res.status(400).json({ error: 'Invalid price values (must be positive)' });
    }
    if (calculatedPushPrice <= calculatedBuyPrice) {
      return res.status(400).json({ 
        error: 'PushPrice must be greater than BuyPrice for profit' 
      });
    }

    await transaction.begin();

    // Call stored procedure to insert opportunity
    const result = await transaction.request()
      .input('hotelId', hotelId)
      .input('dateFrom', startDateStr)
      .input('dateTo', endDateStr)
      .input('boardId', boardlId)
      .input('categoryId', categorylId)
      .input('price', calculatedBuyPrice)
      .input('pushPrice', calculatedPushPrice)
      .input('maxRooms', maxRooms)
      .execute('MED_InsertOpportunity');

    const opportunityId = result.recordset[0]?.OpportunityId;

    await transaction.commit();

    // Zenith push runs after commit (non-transactional, best-effort)
    if (opportunityId && process.env.ZENITH_SERVICE_URL) {
      try {
        const mappingResult = await pool.request()
          .input('hotelId', hotelId)
          .input('categoryId', categorylId)
          .query(`
            SELECT
              h.Innstant_ZenithId as ZenithHotelCode,
              rc.PMS_Code as ZenithRoomCode
            FROM Med_Hotels h
            CROSS JOIN MED_RoomCategory rc
            WHERE h.HotelId = @hotelId AND rc.CategoryId = @categoryId
          `);

        const mapping = mappingResult.recordset[0];
        if (mapping && mapping.ZenithHotelCode && mapping.ZenithRoomCode) {
          await zenithPushService.pushAvailability({
            hotelCode: mapping.ZenithHotelCode,
            invTypeCode: mapping.ZenithRoomCode,
            startDate: startDateStr,
            endDate: endDateStr,
            available: maxRooms
          });

          await zenithPushService.pushRates({
            hotelCode: mapping.ZenithHotelCode,
            invTypeCode: mapping.ZenithRoomCode,
            startDate: startDateStr,
            endDate: endDateStr,
            amount: pushPrice,
            currency: 'EUR'
          });

          logger.info('Pushed opportunity to Zenith', { opportunityId });
        }
      } catch (zenithError) {
        logger.error('Zenith push error', { error: zenithError.message, opportunityId });
      }
    }

    res.json({
      success: true,
      opportunityId: opportunityId
    });

  } catch (err) {
    try {
      await transaction.rollback();
    } catch {
      // Rollback may fail if transaction wasn't started
    }
    logger.error('Error inserting opportunity', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Simple in-memory cache for reference data
const cache = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCached(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key, data) {
  cache[key] = { data, timestamp: Date.now() };
}

// Get hotels (cached for 1 hour)
router.get('/Hotels', async (req, res) => {
  try {
    const cached = getCached('hotels');
    if (cached) {
      return res.json(cached);
    }

    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM Med_Hotels WHERE isActive = 1');

    setCache('hotels', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching hotels', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get boards (cached for 1 hour)
router.get('/Boards', async (req, res) => {
  try {
    const cached = getCached('boards');
    if (cached) {
      return res.json(cached);
    }

    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM MED_Board');

    setCache('boards', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching boards', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get categories (cached for 1 hour)
router.get('/Categories', async (req, res) => {
  try {
    const cached = getCached('categories');
    if (cached) {
      return res.json(cached);
    }

    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM MED_RoomCategory');

    setCache('categories', result.recordset);
    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching categories', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get reservation full name
router.get('/ReservationFullName', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT r.Id as id,
          ISNULL(c.FirstName, '') + ' ' + ISNULL(c.LastName, '') as FullName
        FROM Med_Reservation r
        LEFT JOIN Med_CustomersReservation c ON r.Id = c.ReservationId
        WHERE r.IsCanceled = 0
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching reservation names', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get categories and boards for hotel
router.get('/CatAndBoards', async (req, res) => {
  try {
    const pool = await getPool();

    const categories = await pool.request()
      .query('SELECT * FROM MED_RoomCategory');

    const boards = await pool.request()
      .query('SELECT * FROM MED_Board');

    res.json({
      categories: categories.recordset,
      boards: boards.recordset
    });
  } catch (err) {
    logger.error('Error fetching categories and boards', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Cancel opportunity
router.get('/CancelOpp', async (req, res) => {
  try {
    const { oppId } = req.query;
    const pool = await getPool();
    
    await pool.request()
      .input('oppId', oppId)
      .execute('CancelOPT');

    res.json({ success: true, message: 'Opportunity cancelled' });
  } catch (err) {
    logger.error('Error cancelling opportunity', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Get opportunity log
router.get('/Log', async (req, res) => {
  try {
    const { id } = req.query;
    const pool = await getPool();
    
    const result = await pool.request()
      .input('oppId', id)
      .query('SELECT * FROM MED_OpportunitiesLog WHERE OpportunityId = @oppId ORDER BY DateTimeUTC DESC');

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching opportunity log', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Search opportunities by backOfficeId
router.get('/ByBackOfficeId', async (req, res) => {
  try {
    const { backOfficeId } = req.query;

    if (!backOfficeId) {
      return res.status(400).json({ error: 'backOfficeId is required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('backOfficeId', backOfficeId)
      .query(`
        SELECT o.*, h.name as HotelName,
          b.BoardCode as BoardName, rc.Name as CategoryName
        FROM [MED_ֹOֹֹpportunities] o
        LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
        LEFT JOIN MED_Board b ON o.BoardId = b.BoardId
        LEFT JOIN MED_RoomCategory rc ON o.CategoryId = rc.CategoryId
        WHERE o.OpportunityId = @backOfficeId
        ORDER BY o.DateCreate DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    logger.error('Error fetching opportunities by backOfficeId', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

// Search opportunities by hotel with filters
router.post('/HotelSearch', async (req, res) => {
  try {
    const {
      hotelId, hotelName,
      dateFrom, dateTo,
      minPrice, maxPrice,
      status, boardId, categoryId,
      page = 1, limit = 50
    } = req.body;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * pageSize;

    const pool = await getPool();
    const request = pool.request()
      .input('offset', offset)
      .input('limit', pageSize);

    let where = 'WHERE 1=1';

    if (hotelId) {
      where += ' AND o.DestinationsId = @hotelId';
      request.input('hotelId', hotelId);
    }
    if (hotelName) {
      where += ' AND h.name LIKE @hotelName';
      request.input('hotelName', `%${hotelName}%`);
    }
    if (dateFrom) {
      where += ' AND o.DateForm >= @dateFrom';
      request.input('dateFrom', dateFrom);
    }
    if (dateTo) {
      where += ' AND o.DateTo <= @dateTo';
      request.input('dateTo', dateTo);
    }
    if (minPrice) {
      where += ' AND o.Price >= @minPrice';
      request.input('minPrice', parseFloat(minPrice));
    }
    if (maxPrice) {
      where += ' AND o.Price <= @maxPrice';
      request.input('maxPrice', parseFloat(maxPrice));
    }
    if (status) {
      where += ' AND o.IsActive = @isActive';
      request.input('isActive', status === 'active' ? 1 : 0);
    }
    if (boardId) {
      where += ' AND o.BoardId = @boardId';
      request.input('boardId', parseInt(boardId, 10));
    }
    if (categoryId) {
      where += ' AND o.CategoryId = @categoryId';
      request.input('categoryId', parseInt(categoryId, 10));
    }

    const result = await request.query(`
      SELECT
        o.*, h.name as HotelName,
        b.BoardCode as BoardName, rc.Name as CategoryName
      FROM [MED_ֹOֹֹpportunities] o
      LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
      LEFT JOIN MED_Board b ON o.BoardId = b.BoardId
      LEFT JOIN MED_RoomCategory rc ON o.CategoryId = rc.CategoryId
      ${where}
      ORDER BY o.DateCreate DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    res.json({
      data: result.recordset,
      pagination: { page: pageNum, limit: pageSize }
    });
  } catch (err) {
    logger.error('Error searching opportunities', { error: err.message });
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
