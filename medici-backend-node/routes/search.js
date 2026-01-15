const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const InnstantClient = require('../services/innstant-client');

const innstantClient = new InnstantClient();

// Search for available rooms (with Innstant integration)
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
      .query('SELECT InnstantHotelId FROM Med_Hotels WHERE id = @hotelId');
    
    const innstantHotelId = hotelMapping.recordset[0]?.InnstantHotelId;

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
        console.error('Innstant API error, falling back to DB:', innstantError.message);
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
    console.error('Error searching rooms:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
