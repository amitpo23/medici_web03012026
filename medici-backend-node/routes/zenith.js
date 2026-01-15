/**
 * Zenith API Routes
 * Handles OTA XML requests from Zenith distribution channel
 * Implements OTA_HotelResNotifRQ and OTA_CancelRQ
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const slackService = require('../services/slack-service');

// XML parser middleware
const parseXML = (req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
};

/**
 * Parse OTA_HotelResNotifRQ XML
 * @param {string} xml - Raw XML string
 */
function parseReservationXML(xml) {
  try {
    // Extract key fields using regex (simple parser for OTA format)
    const getField = (tag) => {
      const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
      return match ? match[1].trim() : null;
    };

    const getAttribute = (tag, attr) => {
      const match = xml.match(new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i'));
      return match ? match[1] : null;
    };

    // Parse ResStatus (Commit, Modify, Cancel)
    const resStatus = getAttribute('OTA_HotelResNotifRQ', 'ResStatus') || 
                      getAttribute('HotelReservation', 'ResStatus') || 
                      'Commit';

    // Parse UniqueID
    const uniqueID = getAttribute('UniqueID', 'ID') || 
                     getField('UniqueID') ||
                     getAttribute('HotelReservation', 'UniqueID');

    // Parse Hotel Code
    const hotelCode = getAttribute('BasicPropertyInfo', 'HotelCode') ||
                      getAttribute('HotelCode', 'Code');

    // Parse Dates
    const dateFrom = getAttribute('TimeSpan', 'Start') ||
                     getAttribute('StayDateRange', 'Start');
    const dateTo = getAttribute('TimeSpan', 'End') ||
                   getAttribute('StayDateRange', 'End');

    // Parse Price
    const amountAfterTax = getAttribute('Total', 'AmountAfterTax') ||
                           getAttribute('AmountAfterTax', 'Amount') ||
                           getField('AmountAfterTax');
    const currencyCode = getAttribute('Total', 'CurrencyCode') ||
                         getAttribute('CurrencyCode', 'Code') || 'EUR';

    // Parse Rate Plan
    const ratePlanCode = getAttribute('RatePlan', 'RatePlanCode') ||
                         getAttribute('RatePlanCode', 'Code');
    const roomTypeCode = getAttribute('RoomType', 'RoomTypeCode') ||
                         getAttribute('RoomTypeCode', 'Code');

    // Parse Guest Count
    const adultCount = parseInt(getAttribute('GuestCount', 'Count')) || 
                       parseInt(getField('AdultCount')) || 2;
    const childrenCount = parseInt(getField('ChildCount')) || 0;

    // Parse Guest Name
    const givenName = getField('GivenName') || '';
    const surname = getField('Surname') || '';
    const guestName = `${givenName} ${surname}`.trim();

    // Parse Comments
    const comments = getField('Comment') || getField('Text') || '';

    return {
      success: true,
      reservation: {
        resStatus,
        uniqueID,
        hotelCode,
        dateFrom,
        dateTo,
        amountAfterTax: parseFloat(amountAfterTax) || 0,
        currencyCode,
        ratePlanCode,
        roomTypeCode,
        adultCount,
        childrenCount,
        guestName,
        comments
      }
    };
  } catch (error) {
    console.error('[Zenith] XML Parse error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate OTA_HotelResNotifRS XML response
 */
function generateReservationResponse(success, uniqueID, message = '') {
  if (success) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<OTA_HotelResNotifRS xmlns="http://www.opentravel.org/OTA/2003/05" 
                      Version="1.0" 
                      TimeStamp="${new Date().toISOString()}">
  <Success/>
  <HotelReservations>
    <HotelReservation ResStatus="Committed">
      <UniqueID Type="14" ID="${uniqueID}"/>
    </HotelReservation>
  </HotelReservations>
</OTA_HotelResNotifRS>`;
  } else {
    return `<?xml version="1.0" encoding="UTF-8"?>
<OTA_HotelResNotifRS xmlns="http://www.opentravel.org/OTA/2003/05" 
                      Version="1.0" 
                      TimeStamp="${new Date().toISOString()}">
  <Errors>
    <Error Type="3" Code="450">${message || 'Processing error'}</Error>
  </Errors>
</OTA_HotelResNotifRS>`;
  }
}

/**
 * Generate OTA_CancelRS XML response
 */
function generateCancelResponse(success, uniqueID, message = '') {
  if (success) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<OTA_CancelRS xmlns="http://www.opentravel.org/OTA/2003/05" 
              Version="1.0" 
              TimeStamp="${new Date().toISOString()}"
              Status="Cancelled">
  <Success/>
  <UniqueID Type="14" ID="${uniqueID}"/>
</OTA_CancelRS>`;
  } else {
    return `<?xml version="1.0" encoding="UTF-8"?>
<OTA_CancelRS xmlns="http://www.opentravel.org/OTA/2003/05" 
              Version="1.0" 
              TimeStamp="${new Date().toISOString()}">
  <Errors>
    <Error Type="3" Code="450">${message || 'Cancellation error'}</Error>
  </Errors>
</OTA_CancelRS>`;
  }
}

/**
 * POST /ZenithApi/OTA_HotelResNotifRQ
 * Receive new reservation from Zenith
 */
router.post('/OTA_HotelResNotifRQ', parseXML, async (req, res) => {
  console.log('[Zenith] Received OTA_HotelResNotifRQ');
  
  try {
    const xml = req.rawBody;
    
    // Log the incoming request
    console.log('[Zenith] Raw XML:', xml.substring(0, 500) + '...');

    // Parse the XML
    const parseResult = parseReservationXML(xml);
    
    if (!parseResult.success) {
      const errorResponse = generateReservationResponse(false, '', parseResult.error);
      res.set('Content-Type', 'application/xml');
      return res.status(400).send(errorResponse);
    }

    const reservation = parseResult.reservation;
    console.log('[Zenith] Parsed reservation:', reservation);

    const pool = await getPool();

    // Handle based on ResStatus
    if (reservation.resStatus === 'Cancel') {
      // Handle cancellation
      await pool.request()
        .input('uniqueID', reservation.uniqueID)
        .execute('MED_InsertReservationCancel');

      // Notify via Slack
      await slackService.notifyCancellation({
        hotelName: reservation.hotelCode,
        guestName: reservation.guestName,
        confirmationId: reservation.uniqueID,
        reason: 'Cancelled by Zenith'
      });

    } else if (reservation.resStatus === 'Modify') {
      // Handle modification
      await pool.request()
        .input('uniqueID', reservation.uniqueID)
        .input('hotelCode', reservation.hotelCode)
        .input('dateFrom', reservation.dateFrom)
        .input('dateTo', reservation.dateTo)
        .input('amountAfterTax', reservation.amountAfterTax)
        .input('currencyCode', reservation.currencyCode)
        .input('ratePlanCode', reservation.ratePlanCode)
        .input('roomTypeCode', reservation.roomTypeCode)
        .input('adultCount', reservation.adultCount)
        .input('childrenCount', reservation.childrenCount)
        .input('comments', reservation.comments)
        .execute('MED_InsertReservationModify');

    } else {
      // Handle new reservation (Commit)
      const result = await pool.request()
        .input('uniqueID', reservation.uniqueID)
        .input('hotelCode', reservation.hotelCode)
        .input('dateFrom', reservation.dateFrom)
        .input('dateTo', reservation.dateTo)
        .input('amountAfterTax', reservation.amountAfterTax)
        .input('currencyCode', reservation.currencyCode)
        .input('ratePlanCode', reservation.ratePlanCode)
        .input('roomTypeCode', reservation.roomTypeCode)
        .input('adultCount', reservation.adultCount)
        .input('childrenCount', reservation.childrenCount)
        .input('guestName', reservation.guestName)
        .input('comments', reservation.comments)
        .input('rawXml', xml)
        .execute('MED_InsertReservation');

      // Try to match with available room
      await pool.request()
        .input('uniqueID', reservation.uniqueID)
        .input('hotelCode', reservation.hotelCode)
        .input('dateFrom', reservation.dateFrom)
        .input('dateTo', reservation.dateTo)
        .input('ratePlanCode', reservation.ratePlanCode)
        .execute('MED_FindAvailableRoom');

      // Notify via Slack
      await slackService.notifyNewReservation({
        hotelName: reservation.hotelCode,
        guestName: reservation.guestName,
        checkIn: reservation.dateFrom,
        checkOut: reservation.dateTo,
        price: reservation.amountAfterTax,
        confirmationId: reservation.uniqueID
      });
    }

    // Log the notification
    await pool.request()
      .input('requestType', 'OTA_HotelResNotifRQ')
      .input('uniqueID', reservation.uniqueID)
      .input('resStatus', reservation.resStatus)
      .input('rawXml', xml)
      .query(`
        INSERT INTO MED_ReservationNotificationLog 
        (RequestType, UniqueID, ResStatus, RawXml, DateInsert, IsSuccess)
        VALUES (@requestType, @uniqueID, @resStatus, @rawXml, GETDATE(), 1)
      `);

    // Send success response
    const response = generateReservationResponse(true, reservation.uniqueID);
    res.set('Content-Type', 'application/xml');
    res.send(response);

  } catch (error) {
    console.error('[Zenith] Error processing reservation:', error);
    
    // Notify error via Slack
    await slackService.sendAlert('Zenith Reservation Error', error.message);
    
    const errorResponse = generateReservationResponse(false, '', error.message);
    res.set('Content-Type', 'application/xml');
    res.status(500).send(errorResponse);
  }
});

/**
 * POST /ZenithApi/OTA_CancelRQ
 * Receive cancellation request from Zenith
 */
router.post('/OTA_CancelRQ', parseXML, async (req, res) => {
  console.log('[Zenith] Received OTA_CancelRQ');
  
  try {
    const xml = req.rawBody;
    
    // Extract UniqueID from cancel request
    const uniqueIDMatch = xml.match(/UniqueID[^>]*ID="([^"]*)"/i);
    const uniqueID = uniqueIDMatch ? uniqueIDMatch[1] : null;

    if (!uniqueID) {
      const errorResponse = generateCancelResponse(false, '', 'Missing UniqueID');
      res.set('Content-Type', 'application/xml');
      return res.status(400).send(errorResponse);
    }

    console.log('[Zenith] Cancelling reservation:', uniqueID);

    const pool = await getPool();

    // Insert cancellation
    await pool.request()
      .input('uniqueID', uniqueID)
      .input('rawXml', xml)
      .execute('MED_InsertReservationCancel');

    // Update the reservation status
    await pool.request()
      .input('uniqueID', uniqueID)
      .query(`
        UPDATE Med_Reservation 
        SET IsCanceled = 1, CancelDate = GETDATE()
        WHERE uniqueID = @uniqueID
      `);

    // Notify via Slack
    await slackService.notifyCancellation({
      confirmationId: uniqueID,
      reason: 'Cancelled via OTA_CancelRQ'
    });

    // Log the notification
    await pool.request()
      .input('requestType', 'OTA_CancelRQ')
      .input('uniqueID', uniqueID)
      .input('rawXml', xml)
      .query(`
        INSERT INTO MED_ReservationNotificationLog 
        (RequestType, UniqueID, ResStatus, RawXml, DateInsert, IsSuccess)
        VALUES (@requestType, @uniqueID, 'Cancel', @rawXml, GETDATE(), 1)
      `);

    // Send success response
    const response = generateCancelResponse(true, uniqueID);
    res.set('Content-Type', 'application/xml');
    res.send(response);

  } catch (error) {
    console.error('[Zenith] Error processing cancellation:', error);
    
    await slackService.sendAlert('Zenith Cancel Error', error.message);
    
    const errorResponse = generateCancelResponse(false, '', error.message);
    res.set('Content-Type', 'application/xml');
    res.status(500).send(errorResponse);
  }
});

/**
 * GET /ZenithApi/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Zenith API',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /ZenithApi/push-batch
 * Push multiple opportunities to Zenith
 * Body: {
 *   opportunityIds: number[],
 *   action: 'publish' | 'update' | 'close',
 *   overrides?: {
 *     available?: number,
 *     mealPlan?: string,
 *     roomType?: string
 *   }
 * }
 */
router.post('/push-batch', async (req, res) => {
  try {
    const { opportunityIds, action = 'publish', overrides = {} } = req.body;

    if (!opportunityIds || !Array.isArray(opportunityIds) || opportunityIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'opportunityIds array is required'
      });
    }

    console.log(`[Zenith Batch] Processing ${opportunityIds.length} opportunities with action: ${action}`);

    const pool = await getPool();
    const zenithPushService = require('../services/zenith-push-service');
    
    // Fetch opportunities with Zenith mappings
    const placeholders = opportunityIds.map((_, i) => `@oppId${i}`).join(',');
    const request = pool.request();
    opportunityIds.forEach((id, i) => request.input(`oppId${i}`, id));

    const oppResult = await request.query(`
      SELECT 
        o.OpportunityId,
        o.DateForm,
        o.DateTo,
        o.PushPrice,
        o.PushHotelCode,
        o.PushRatePlanCode,
        o.PushInvTypeCode,
        o.IsPush,
        h.Innstant_ZenithId as ZenithHotelCode,
        h.RatePlanCode as DefaultRatePlanCode,
        h.InvTypeCode as DefaultInvTypeCode,
        h.Name as HotelName,
        b.BoardName as MealPlan
      FROM MED_Opportunities o
      LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
      LEFT JOIN MED_Board b ON o.BoardId = b.BoardId
      WHERE o.OpportunityId IN (${placeholders})
    `);

    const opportunities = oppResult.recordset;
    
    if (opportunities.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No opportunities found with provided IDs'
      });
    }

    const results = [];
    const errors = [];
    
    // Process each opportunity with rate limiting
    for (const opp of opportunities) {
      try {
        const hotelCode = opp.PushHotelCode || opp.ZenithHotelCode;
        const ratePlanCode = opp.PushRatePlanCode || opp.DefaultRatePlanCode;
        const invTypeCode = opp.PushInvTypeCode || opp.DefaultInvTypeCode;

        if (!hotelCode || !ratePlanCode || !invTypeCode) {
          errors.push({
            opportunityId: opp.OpportunityId,
            error: 'Missing Zenith mapping (hotelCode, ratePlanCode, or invTypeCode)',
            hotelName: opp.HotelName
          });
          continue;
        }

        const pushData = {
          hotelCode,
          invTypeCode,
          ratePlanCode,
          startDate: opp.DateForm,
          endDate: opp.DateTo,
          pushPrice: overrides.pushPrice || opp.PushPrice,
          available: action === 'close' ? 0 : (overrides.available || 1),
          mealPlan: overrides.mealPlan || opp.MealPlan
        };

        console.log(`[Zenith Batch] Pushing opportunity ${opp.OpportunityId} - ${opp.HotelName}`);

        // Call zenith push service
        let result;
        if (action === 'close') {
          result = await zenithPushService.closeBooking(pushData);
        } else {
          result = await zenithPushService.pushBooking(pushData);
        }

        if (result.success) {
          // Update opportunity status
          await pool.request()
            .input('oppId', opp.OpportunityId)
            .input('datePush', new Date())
            .query(`
              UPDATE MED_Opportunities 
              SET IsPush = 1, DatePush = @datePush
              WHERE OpportunityId = @oppId
            `);

          // Insert into push queue/log
          await pool.request()
            .input('oppId', opp.OpportunityId)
            .input('action', action)
            .query(`
              INSERT INTO Med_HotelsToPush (OpportunityId, DateInsert, DatePush, IsActive, Action)
              VALUES (@oppId, GETDATE(), GETDATE(), 0, @action)
            `);

          results.push({
            opportunityId: opp.OpportunityId,
            hotelName: opp.HotelName,
            status: 'success',
            action,
            zenithResponse: result.response?.substring(0, 200) // Truncate for response size
          });
        } else {
          errors.push({
            opportunityId: opp.OpportunityId,
            hotelName: opp.HotelName,
            error: result.error || 'Zenith push failed',
            zenithError: result.zenithError
          });
        }

        // Rate limiting: 500ms delay between pushes
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`[Zenith Batch] Error pushing opportunity ${opp.OpportunityId}:`, error);
        errors.push({
          opportunityId: opp.OpportunityId,
          hotelName: opp.HotelName,
          error: error.message
        });
      }
    }

    // Send Slack notification
    if (results.length > 0) {
      await slackService.sendNotification(
        `Zenith Batch Push Completed`,
        `Successfully pushed ${results.length} opportunities\n` +
        `Failed: ${errors.length}\n` +
        `Action: ${action}`
      );
    }

    res.json({
      success: true,
      summary: {
        total: opportunityIds.length,
        successful: results.length,
        failed: errors.length,
        action
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('[Zenith Batch] Fatal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch push',
      message: error.message
    });
  }
});

module.exports = router;
