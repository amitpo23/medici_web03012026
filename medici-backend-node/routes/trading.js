// ========================================
// Trading Operations Routes
// NEW - Complete buy/sell workflow
// ========================================

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const dbConfig = require('../config/database');
const logger = require('../config/logger');
const InnstantClient = require('../services/innstant-client');

// ========================================
// Search & Buy Operations
// ========================================

/**
 * POST /api/trading/search-with-analysis
 * Enhanced search with AI analysis and buy recommendations
 */
router.post('/search-with-analysis', async (req, res) => {
  const { hotelId, checkIn, checkOut, adults, children = [] } = req.body;
  
  try {
    // Search Innstant
    const innstantClient = new InnstantClient();
    const searchResults = await innstantClient.searchHotels({
      hotelIds: [hotelId],
      dateFrom: checkIn,
      dateTo: checkOut,
      adults,
      children
    });

    // Get historical performance for this hotel
    const pool = await sql.connect(dbConfig);
    const hotelStats = await pool.request()
      .input('hotelId', sql.Int, hotelId)
      .query(`
        SELECT 
          COUNT(*) as TotalBookings,
          AVG(pushPrice - price) as AvgProfit,
          AVG((pushPrice - price) / price * 100) as AvgMarginPercent,
          SUM(CASE WHEN IsSold = 1 THEN 1 ELSE 0 END) as SoldCount,
          SUM(CASE WHEN IsSold = 0 THEN 1 ELSE 0 END) as UnsoldCount
        FROM MED_Book
        WHERE HotelId = @hotelId
      `);

    // Get search demand for this hotel
    const demandStats = await pool.request()
      .input('hotelId', sql.Int, hotelId)
      .query(`
        SELECT COUNT(*) as SearchCount
        FROM AI_Search_HotelData
        WHERE HotelId = @hotelId
          AND SearchDate >= DATEADD(month, -3, GETDATE())
      `);

    // Analyze and add recommendations
    const enrichedResults = {
      searchResults: searchResults.hotels[0]?.rooms || [],
      hotelAnalytics: {
        totalBookings: hotelStats.recordset[0]?.TotalBookings || 0,
        avgProfit: hotelStats.recordset[0]?.AvgProfit || 0,
        avgMarginPercent: hotelStats.recordset[0]?.AvgMarginPercent || 0,
        conversionRate: hotelStats.recordset[0]?.TotalBookings > 0
          ? ((hotelStats.recordset[0].SoldCount / hotelStats.recordset[0].TotalBookings) * 100).toFixed(2)
          : 0,
        searchDemand: demandStats.recordset[0]?.SearchCount || 0
      },
      recommendations: []
    };

    // Add buy recommendations for each room
    enrichedResults.searchResults.forEach(room => {
      const suggestedSellPrice = room.price * 1.30; // 30% markup
      const expectedProfit = suggestedSellPrice - room.price;
      const confidence = calculateBuyConfidence(
        hotelStats.recordset[0],
        demandStats.recordset[0],
        room
      );

      room.aiAnalysis = {
        suggestedBuyPrice: room.price,
        suggestedSellPrice: suggestedSellPrice.toFixed(2),
        expectedProfit: expectedProfit.toFixed(2),
        expectedMargin: ((expectedProfit / suggestedSellPrice) * 100).toFixed(2),
        buyConfidence: confidence,
        recommendation: confidence >= 70 ? 'STRONG BUY' : confidence >= 50 ? 'BUY' : 'CONSIDER',
        reasoning: generateReasoning(confidence, hotelStats.recordset[0], room)
      };
    });

    res.json(enrichedResults);
    logger.info(`Search with analysis completed for hotel ${hotelId}`);
  } catch (error) {
    logger.error('Error in search with analysis:', error);
    res.status(500).json({ error: 'Failed to search and analyze', details: error.message });
  }
});

/**
 * POST /api/trading/quick-buy
 * Fast-track buy operation (PreBook + Book in one call)
 */
router.post('/quick-buy', async (req, res) => {
  const { 
    searchToken, 
    roomId, 
    rateId, 
    hotelId, 
    checkIn, 
    checkOut,
    adults,
    guest,
    expectedPrice,
    suggestedSellPrice,
    opportunityId
  } = req.body;

  try {
    const innstantClient = new InnstantClient();
    
    // Step 1: PreBook
    const preBookResult = await innstantClient.preBook({
      token: searchToken,
      hotelId,
      roomId,
      rateId,
      checkIn,
      checkOut,
      rooms: [{ adults, children: [] }]
    });

    // Verify price hasn't changed significantly
    if (Math.abs(preBookResult.price - expectedPrice) > expectedPrice * 0.05) {
      return res.status(400).json({
        error: 'Price changed',
        message: 'Price has changed by more than 5%. Please search again.',
        oldPrice: expectedPrice,
        newPrice: preBookResult.price
      });
    }

    // Step 2: Insert PreBook to database
    const pool = await sql.connect(dbConfig);
    const preBookInsert = await pool.request()
      .input('OpportunityId', sql.Int, opportunityId || null)
      .input('HotelId', sql.Int, hotelId)
      .input('DateForm', sql.Date, checkIn)
      .input('DateTo', sql.Date, checkOut)
      .input('Price', sql.Float, preBookResult.price)
      .input('Token', sql.NVarChar(sql.MAX), preBookResult.token)
      .input('CancellationType', sql.NVarChar(150), preBookResult.cancellationPolicy?.type || 'Unknown')
      .input('CancellationTo', sql.DateTime, preBookResult.cancellationPolicy?.deadline || null)
      .input('source', sql.Int, 1) // Innstant
      .query(`
        INSERT INTO MED_PreBook (OpportunityId, HotelId, DateForm, DateTo, Price, Token, CancellationType, CancellationTo, source)
        OUTPUT INSERTED.PreBookId
        VALUES (@OpportunityId, @HotelId, @DateForm, @DateTo, @Price, @Token, @CancellationType, @CancellationTo, @source)
      `);

    const preBookId = preBookInsert.recordset[0].PreBookId;

    // Step 3: Confirm Booking
    const bookResult = await innstantClient.book({
      preBookToken: preBookResult.token,
      guest: {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone
      }
    });

    // Step 4: Insert into MED_Book
    const bookInsert = await pool.request()
      .input('PreBookId', sql.Int, preBookId)
      .input('OpportunityId', sql.Int, opportunityId || null)
      .input('contentBookingID', sql.NVarChar(50), bookResult.bookingId)
      .input('supplierReference', sql.NVarChar(50), bookResult.supplierReference)
      .input('price', sql.Float, bookResult.totalPrice)
      .input('pushPrice', sql.Float, suggestedSellPrice)
      .input('startDate', sql.Date, checkIn)
      .input('endDate', sql.Date, checkOut)
      .input('HotelId', sql.Int, hotelId)
      .input('IsActive', sql.Bit, 1)
      .input('IsSold', sql.Bit, 0)
      .input('source', sql.Int, 1)
      .input('CancellationType', sql.NVarChar(150), bookResult.cancellationPolicy?.type || 'Unknown')
      .input('CancellationTo', sql.DateTime, bookResult.cancellationPolicy?.deadline || null)
      .query(`
        INSERT INTO MED_Book (
          PreBookId, OpportunityId, contentBookingID, supplierReference, 
          price, pushPrice, startDate, endDate, HotelId, 
          IsActive, IsSold, source, CancellationType, CancellationTo, dateInsert
        )
        OUTPUT INSERTED.id
        VALUES (
          @PreBookId, @OpportunityId, @contentBookingID, @supplierReference,
          @price, @pushPrice, @startDate, @endDate, @HotelId,
          @IsActive, @IsSold, @source, @CancellationType, @CancellationTo, GETDATE()
        )
      `);

    const bookingId = bookInsert.recordset[0].id;

    // Calculate profit
    const actualProfit = suggestedSellPrice - bookResult.totalPrice;
    const margin = ((actualProfit / suggestedSellPrice) * 100).toFixed(2);

    res.json({
      success: true,
      booking: {
        bookingId,
        preBookId,
        supplierBookingId: bookResult.bookingId,
        confirmationNumber: bookResult.confirmationNumber,
        supplierReference: bookResult.supplierReference,
        buyPrice: bookResult.totalPrice,
        sellPrice: suggestedSellPrice,
        expectedProfit: actualProfit,
        marginPercent: margin,
        cancellationPolicy: bookResult.cancellationPolicy,
        status: 'CONFIRMED'
      },
      message: `Room purchased successfully! Expected profit: €${actualProfit.toFixed(2)} (${margin}%)`
    });

    logger.info(`Quick buy successful: BookingId ${bookingId}, Profit €${actualProfit}`);
  } catch (error) {
    logger.error('Error in quick buy:', error);
    res.status(500).json({ 
      error: 'Failed to complete purchase', 
      details: error.message,
      phase: error.phase || 'unknown'
    });
  }
});

/**
 * GET /api/trading/active-inventory
 * Get all active unsold inventory with enriched data
 */
router.get('/active-inventory', async (req, res) => {
  const { daysToCheckIn, minProfit, hotelId, sortBy = 'startDate' } = req.query;
  
  try {
    const pool = await sql.connect(dbConfig);
    
    let query = `
      SELECT 
        b.id,
        b.contentBookingID,
        b.supplierReference,
        b.price as buyPrice,
        b.pushPrice as sellPrice,
        b.lastPrice as currentMarketPrice,
        (b.pushPrice - b.price) as potentialProfit,
        ((b.pushPrice - b.price) / b.pushPrice * 100) as marginPercent,
        b.startDate as checkIn,
        b.endDate as checkOut,
        DATEDIFF(day, GETDATE(), b.startDate) as daysUntilCheckIn,
        b.CancellationType,
        b.CancellationTo as cancellationDeadline,
        DATEDIFF(hour, GETDATE(), b.CancellationTo) as hoursUntilCancelDeadline,
        h.HotelId,
        h.Name as hotelName,
        h.countryId,
        b.dateInsert as purchaseDate,
        DATEDIFF(day, b.dateInsert, GETDATE()) as daysInInventory
      FROM MED_Book b
      JOIN Med_Hotels h ON b.HotelId = h.HotelId
      WHERE b.IsActive = 1 
        AND b.IsSold = 0
        AND b.startDate >= GETDATE()
    `;

    const params = [];
    
    if (daysToCheckIn) {
      query += ` AND DATEDIFF(day, GETDATE(), b.startDate) <= @daysToCheckIn`;
      params.push({ name: 'daysToCheckIn', type: sql.Int, value: parseInt(daysToCheckIn) });
    }
    
    if (minProfit) {
      query += ` AND (b.pushPrice - b.price) >= @minProfit`;
      params.push({ name: 'minProfit', type: sql.Float, value: parseFloat(minProfit) });
    }
    
    if (hotelId) {
      query += ` AND b.HotelId = @hotelId`;
      params.push({ name: 'hotelId', type: sql.Int, value: parseInt(hotelId) });
    }

    // Add sorting
    const validSortColumns = {
      'startDate': 'b.startDate',
      'profit': '(b.pushPrice - b.price)',
      'margin': '((b.pushPrice - b.price) / b.pushPrice * 100)',
      'daysUntilCheckIn': 'DATEDIFF(day, GETDATE(), b.startDate)',
      'hotelName': 'h.Name'
    };
    
    const sortColumn = validSortColumns[sortBy] || 'b.startDate';
    query += ` ORDER BY ${sortColumn} ASC`;

    const request = pool.request();
    params.forEach(param => {
      request.input(param.name, param.type, param.value);
    });

    const result = await request.query(query);

    // Enrich with urgency flags
    const enrichedInventory = result.recordset.map(item => ({
      ...item,
      urgency: calculateUrgency(item),
      riskLevel: calculateRiskLevel(item),
      suggestedActions: generateSuggestedActions(item)
    }));

    res.json({
      totalItems: enrichedInventory.length,
      inventory: enrichedInventory,
      summary: {
        totalPotentialProfit: enrichedInventory.reduce((sum, item) => sum + item.potentialProfit, 0),
        avgMargin: enrichedInventory.reduce((sum, item) => sum + item.marginPercent, 0) / enrichedInventory.length || 0,
        urgentItems: enrichedInventory.filter(i => i.urgency === 'high').length,
        highRiskItems: enrichedInventory.filter(i => i.riskLevel === 'high').length
      }
    });
  } catch (error) {
    logger.error('Error getting active inventory:', error);
    res.status(500).json({ error: 'Failed to get inventory', details: error.message });
  }
});

/**
 * POST /api/trading/update-sell-price
 * Update the sell price (pushPrice) for an inventory item
 */
router.post('/update-sell-price', async (req, res) => {
  const { bookingId, newSellPrice, reason } = req.body;
  
  try {
    const pool = await sql.connect(dbConfig);
    
    // Get current booking details
    const booking = await pool.request()
      .input('bookingId', sql.Int, bookingId)
      .query(`
        SELECT b.*, h.Innstant_ZenithId, h.RatePlanCode, h.InvTypeCode
        FROM MED_Book b
        JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.id = @bookingId
      `);

    if (booking.recordset.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const currentBooking = booking.recordset[0];
    const oldPrice = currentBooking.pushPrice;
    const priceChange = newSellPrice - oldPrice;
    const priceChangePercent = ((priceChange / oldPrice) * 100).toFixed(2);

    // Update pushPrice in database
    await pool.request()
      .input('bookingId', sql.Int, bookingId)
      .input('newSellPrice', sql.Float, newSellPrice)
      .query(`
        UPDATE MED_Book
        SET pushPrice = @newSellPrice,
            Lastupdate = GETDATE()
        WHERE id = @bookingId
      `);

    // Log the price change
    await pool.request()
      .input('bookingId', sql.Int, bookingId)
      .input('oldPrice', sql.Float, oldPrice)
      .input('newPrice', sql.Float, newSellPrice)
      .input('reason', sql.NVarChar(500), reason || 'Manual update')
      .query(`
        INSERT INTO MED_PriceChangeLog (BookingId, OldPrice, NewPrice, ChangeReason, ChangedAt)
        VALUES (@bookingId, @oldPrice, @newPrice, @reason, GETDATE())
      `);

    // Queue for Zenith push
    await pool.request()
      .input('bookingId', sql.Int, bookingId)
      .query(`
        INSERT INTO Med_HotelsToPush (BookId, DateInsert, IsActive)
        VALUES (@bookingId, GETDATE(), 1)
      `);

    res.json({
      success: true,
      message: `Price updated from €${oldPrice} to €${newSellPrice} (${priceChangePercent > 0 ? '+' : ''}${priceChangePercent}%)`,
      booking: {
        bookingId,
        oldPrice,
        newPrice: newSellPrice,
        priceChange,
        priceChangePercent,
        newProfit: newSellPrice - currentBooking.price,
        newMargin: (((newSellPrice - currentBooking.price) / newSellPrice) * 100).toFixed(2)
      },
      zenithPushQueued: true
    });

    logger.info(`Price updated for booking ${bookingId}: €${oldPrice} → €${newSellPrice}`);
  } catch (error) {
    logger.error('Error updating sell price:', error);
    res.status(500).json({ error: 'Failed to update price', details: error.message });
  }
});

/**
 * POST /api/trading/check-current-price
 * Check current market price for an existing booking
 */
router.post('/check-current-price', async (req, res) => {
  const { bookingId } = req.body;
  
  try {
    const pool = await sql.connect(dbConfig);
    
    // Get booking details
    const booking = await pool.request()
      .input('bookingId', sql.Int, bookingId)
      .query(`
        SELECT b.*, h.InnstantId
        FROM MED_Book b
        JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.id = @bookingId
      `);

    if (booking.recordset.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const currentBooking = booking.recordset[0];

    // Search current price
    const innstantClient = new InnstantClient();
    const searchResults = await innstantClient.searchHotels({
      hotelIds: [currentBooking.InnstantId],
      dateFrom: currentBooking.startDate,
      dateTo: currentBooking.endDate,
      adults: 2,
      children: []
    });

    const currentPrice = searchResults.hotels[0]?.rooms[0]?.price || null;

    if (currentPrice) {
      // Update lastPrice in database
      await pool.request()
        .input('bookingId', sql.Int, bookingId)
        .input('lastPrice', sql.Float, currentPrice)
        .query(`
          UPDATE MED_Book
          SET lastPrice = @lastPrice,
              Lastupdate = GETDATE()
          WHERE id = @bookingId
        `);

      const priceDrop = currentBooking.price - currentPrice;
      const priceDropPercent = ((priceDrop / currentBooking.price) * 100).toFixed(2);

      res.json({
        success: true,
        booking: {
          bookingId,
          originalPrice: currentBooking.price,
          currentMarketPrice: currentPrice,
          priceDrop,
          priceDropPercent,
          sellPrice: currentBooking.pushPrice,
          originalProfit: currentBooking.pushPrice - currentBooking.price,
          potentialProfit: currentBooking.pushPrice - currentPrice
        },
        recommendation: priceDrop > 0 
          ? `Price dropped by €${priceDrop.toFixed(2)} (${priceDropPercent}%). Consider if opportunity cost warrants action.`
          : `Price increased or stable. Good purchase.`,
        lastChecked: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        message: 'Room not available at current dates',
        booking: {
          bookingId,
          originalPrice: currentBooking.price,
          sellPrice: currentBooking.pushPrice
        }
      });
    }
  } catch (error) {
    logger.error('Error checking current price:', error);
    res.status(500).json({ error: 'Failed to check price', details: error.message });
  }
});

// ========================================
// Helper Functions
// ========================================

function calculateBuyConfidence(hotelStats, demandStats, room) {
  let confidence = 50; // Base confidence
  
  // Historical performance
  if (hotelStats && hotelStats.TotalBookings > 5) {
    if (hotelStats.AvgMarginPercent > 25) confidence += 20;
    else if (hotelStats.AvgMarginPercent > 15) confidence += 10;
    
    const conversionRate = (hotelStats.SoldCount / hotelStats.TotalBookings) * 100;
    if (conversionRate > 70) confidence += 15;
    else if (conversionRate > 50) confidence += 10;
  }
  
  // Search demand
  if (demandStats && demandStats.SearchCount > 1000) confidence += 15;
  else if (demandStats && demandStats.SearchCount > 500) confidence += 10;
  
  // Cancellation policy
  if (room.cancellationPolicy?.type === 'FREE') confidence += 10;
  
  // Margin
  const suggestedMargin = ((room.price * 0.30) / (room.price * 1.30)) * 100;
  if (suggestedMargin > 25) confidence += 10;
  
  return Math.min(confidence, 100);
}

function generateReasoning(confidence, hotelStats, room) {
  const reasons = [];
  
  if (confidence >= 70) {
    reasons.push('High confidence based on strong historical performance');
  }
  
  if (hotelStats && hotelStats.AvgMarginPercent > 20) {
    reasons.push(`Average margin ${hotelStats.AvgMarginPercent.toFixed(1)}% for this hotel`);
  }
  
  if (room.cancellationPolicy?.type === 'FREE') {
    reasons.push('Free cancellation reduces risk');
  }
  
  return reasons.join('. ') + '.';
}

function calculateUrgency(item) {
  if (item.hoursUntilCancelDeadline && item.hoursUntilCancelDeadline <= 48) {
    return 'high';
  }
  if (item.daysUntilCheckIn <= 7) {
    return 'medium';
  }
  return 'low';
}

function calculateRiskLevel(item) {
  let riskScore = 0;
  
  if (item.CancellationType !== 'FREE') riskScore += 30;
  if (item.daysInInventory > 14) riskScore += 20;
  if (item.marginPercent < 15) riskScore += 25;
  if (item.daysUntilCheckIn <= 7) riskScore += 25;
  
  if (riskScore >= 50) return 'high';
  if (riskScore >= 30) return 'medium';
  return 'low';
}

function generateSuggestedActions(item) {
  const actions = [];
  
  if (item.hoursUntilCancelDeadline && item.hoursUntilCancelDeadline <= 48) {
    actions.push('Consider cancellation if unlikely to sell');
  }
  
  if (item.daysUntilCheckIn <= 7 && item.marginPercent > 20) {
    actions.push('Reduce price by 10-15% for quick sale');
  }
  
  if (item.daysInInventory > 14) {
    actions.push('Check current market price');
  }
  
  return actions;
}

module.exports = router;
