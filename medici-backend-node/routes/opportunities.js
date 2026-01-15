const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const ZenithPushService = require('../services/zenith-push-service');

const zenithPushService = new ZenithPushService();

// Get all opportunities
router.get('/Opportunities', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM MED_Opportunities ORDER BY DateInsert DESC');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching opportunities:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Insert opportunity (with Zenith Push integration)
router.post('/InsertOpp', async (req, res) => {
  try {
    const {
      hotelId, startDateStr, endDateStr,
      boardlId, categorylId,
      buyPrice, pushPrice, maxRooms
    } = req.body;

    const pool = await getPool();
    
    // Call stored procedure to insert opportunity
    const result = await pool.request()
      .input('hotelId', hotelId)
      .input('dateFrom', startDateStr)
      .input('dateTo', endDateStr)
      .input('boardId', boardlId)
      .input('categoryId', categorylId)
      .input('price', buyPrice)
      .input('pushPrice', pushPrice)
      .input('maxRooms', maxRooms)
      .execute('MED_InsertOpportunity');

    const opportunityId = result.recordset[0]?.OpportunityId;

    // If Zenith Push is enabled, push availability to Zenith
    if (opportunityId && process.env.ZENITH_SERVICE_URL) {
      try {
        // Get hotel and category details for Zenith mapping
        const mappingResult = await pool.request()
          .input('hotelId', hotelId)
          .input('categoryId', categorylId)
          .query(`
            SELECT 
              h.ZenithHotelCode,
              rc.ZenithRoomCode
            FROM Med_Hotels h
            CROSS JOIN MED_RoomCategory rc
            WHERE h.id = @hotelId AND rc.id = @categoryId
          `);

        const mapping = mappingResult.recordset[0];
        if (mapping && mapping.ZenithHotelCode && mapping.ZenithRoomCode) {
          // Push availability to Zenith
          await zenithPushService.pushAvailability({
            hotelCode: mapping.ZenithHotelCode,
            invTypeCode: mapping.ZenithRoomCode,
            startDate: startDateStr,
            endDate: endDateStr,
            available: maxRooms
          });

          // Push rates to Zenith
          await zenithPushService.pushRates({
            hotelCode: mapping.ZenithHotelCode,
            invTypeCode: mapping.ZenithRoomCode,
            startDate: startDateStr,
            endDate: endDateStr,
            amount: pushPrice,
            currency: 'EUR'
          });

          console.log(`✅ Pushed opportunity ${opportunityId} to Zenith`);
        }
      } catch (zenithError) {
        console.error('Zenith push error:', zenithError.message);
        // Continue even if Zenith push fails
      }
    }

    res.json({
      success: true,
      opportunityId: opportunityId
    });

  } catch (err) {
    console.error('Error inserting opportunity:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get hotels
router.get('/Hotels', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM Med_Hotels WHERE isActive = 1');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching hotels:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get boards
router.get('/Boards', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM MED_Board');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching boards:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get categories
router.get('/Categories', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM MED_RoomCategory');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get reservation full name
router.get('/ReservationFullName', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT id, FullName FROM MED_Reservations WHERE IsActive = 1');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching reservation names:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get categories and boards for hotel
router.get('/CatAndBoards', async (req, res) => {
  try {
    const { hotelId } = req.query;
    const pool = await getPool();
    
    const categories = await pool.request()
      .input('hotelId', hotelId)
      .query('SELECT * FROM MED_RoomCategory WHERE HotelId = @hotelId OR HotelId IS NULL');
    
    const boards = await pool.request()
      .input('hotelId', hotelId)
      .query('SELECT * FROM MED_Board WHERE HotelId = @hotelId OR HotelId IS NULL');

    res.json({
      categories: categories.recordset,
      boards: boards.recordset
    });
  } catch (err) {
    console.error('Error fetching categories and boards:', err);
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
      .execute('MED_CancelOpportunity');

    res.json({ success: true, message: 'Opportunity cancelled' });
  } catch (err) {
    console.error('Error cancelling opportunity:', err);
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
      .query('SELECT * FROM MED_OpportunityLog WHERE OpportunityId = @oppId ORDER BY dateInsert DESC');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching opportunity log:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
