/**
 * Zenith API Routes
 * Handles OTA XML requests from Zenith distribution channel
 * Implements OTA_HotelResNotifRQ and OTA_CancelRQ
 * Enhanced with batch push and queue processing
 */

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const logger = require('../config/logger');
const { getPool } = require('../config/database');
const slackService = require('../services/slack-service');
const zenithPushService = require('../services/zenith-push-service');

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
    logger.error('[Zenith] XML Parse error', { error: error.message });
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
  logger.info('[Zenith] Received OTA_HotelResNotifRQ');

  try {
    const xml = req.rawBody;

    // Log the incoming request
    logger.info('[Zenith] Raw XML received', { xmlPreview: xml.substring(0, 500) });

    // Parse the XML
    const parseResult = parseReservationXML(xml);
    
    if (!parseResult.success) {
      const errorResponse = generateReservationResponse(false, '', parseResult.error);
      res.set('Content-Type', 'application/xml');
      return res.status(400).send(errorResponse);
    }

    const reservation = parseResult.reservation;
    logger.info('[Zenith] Parsed reservation', { reservation });

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
      const matchResult = await pool.request()
        .input('uniqueID', reservation.uniqueID)
        .input('hotelCode', reservation.hotelCode)
        .input('dateFrom', reservation.dateFrom)
        .input('dateTo', reservation.dateTo)
        .input('ratePlanCode', reservation.ratePlanCode)
        .execute('MED_FindAvailableRoom');

      // If room found, update reservation with BookId and mark as approved
      if (matchResult.recordset && matchResult.recordset.length > 0) {
        const matchedBook = matchResult.recordset[0];
        const bookId = matchedBook.id || matchedBook.BookId;
        
        if (bookId) {
          logger.info(`[Zenith] Matched reservation ${reservation.uniqueID} with Book ${bookId}`);
          
          await pool.request()
            .input('uniqueID', reservation.uniqueID)
            .input('bookId', bookId)
            .query(`
              UPDATE Med_Reservation
              SET IsApproved = 1,
                  ApprovedDate = GETDATE()
              WHERE uniqueID = @uniqueID
            `);
          
          // Mark book as sold
          await pool.request()
            .input('bookId', bookId)
            .query(`
              UPDATE MED_Book
              SET IsSold = 1,
                  SoldDate = GETDATE()
              WHERE id = @bookId
            `);
          
          // Update opportunity if exists
          await pool.request()
            .input('bookId', bookId)
            .query(`
              UPDATE [MED_Opportunities]
              SET IsSale = 1,
                  Lastupdate = GETDATE()
              WHERE OpportunityId IN (
                SELECT OpportunityId FROM MED_Book WHERE id = @bookId
              )
            `);
          
          logger.info(`[Zenith] Book ${bookId} marked as sold for reservation ${reservation.uniqueID}`);
        }
      } else {
        logger.warn(`[Zenith] No available room found for reservation ${reservation.uniqueID}`);
      }

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
    logger.error('[Zenith] Error processing reservation', { error: error.message });
    
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
  logger.info('[Zenith] Received OTA_CancelRQ');
  
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

    logger.info('[Zenith] Cancelling reservation', { uniqueID });

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
    logger.error('[Zenith] Error processing cancellation', { error: error.message });
    
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

    logger.info('[Zenith Batch] Processing opportunities', { count: opportunityIds.length, action });

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
        b.BoardCode as MealPlan
      FROM [MED_Opportunities] o
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

        logger.info('[Zenith Batch] Pushing opportunity', { opportunityId: opp.OpportunityId, hotelName: opp.HotelName });

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
              UPDATE [MED_Opportunities]
              SET IsPush = 1, Lastupdate = @datePush
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
        logger.error('[Zenith Batch] Error pushing opportunity', { opportunityId: opp.OpportunityId, error: error.message });
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
    logger.error('[Zenith Batch] Fatal error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to process batch push',
      message: error.message
    });
  }
});

/**
 * POST /zenith/process-queue
 * Process Med_HotelsToPush queue
 */
router.post('/process-queue', async (req, res) => {
  try {
    logger.info('[Zenith] Processing Med_HotelsToPush queue');
    
    const result = await zenithPushService.processQueue();
    
    const successRate = result.processed > 0 
      ? ((result.successful / result.processed) * 100).toFixed(1)
      : 0;
    
    res.json({
      success: true,
      message: 'Queue processed successfully',
      result: {
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        successRate: `${successRate}%`
      },
      details: result.details
    });
    
  } catch (error) {
    logger.error('[Zenith] Queue processing error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to process queue',
      message: error.message
    });
  }
});

/**
 * GET /zenith/queue-status
 * Get Med_HotelsToPush queue status
 */
router.get('/queue-status', async (req, res) => {
  try {
    const pool = await getPool();
    
    const result = await pool.request().query(`
      SELECT 
        COUNT(*) as TotalPending,
        COUNT(CASE WHEN Error IS NOT NULL THEN 1 END) as FailedItems,
        MIN(DateInsert) as OldestItem,
        MAX(DateInsert) as NewestItem
      FROM Med_HotelsToPush
      WHERE IsActive = 1 AND DatePush IS NULL
    `);
    
    const stats = result.recordset[0];
    
    res.json({
      success: true,
      queue: {
        pending: stats.TotalPending,
        failed: stats.FailedItems,
        oldestItem: stats.OldestItem,
        newestItem: stats.NewestItem,
        status: stats.TotalPending === 0 ? 'empty' : 
                stats.TotalPending > 100 ? 'high' : 
                stats.TotalPending > 20 ? 'medium' : 'normal'
      }
    });
    
  } catch (error) {
    logger.error('[Zenith] Queue status error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get queue status',
      message: error.message
    });
  }
});

/**
 * GET /zenith/push-stats
 * Get push statistics from MED_PushLog
 */
router.get('/push-stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysInt = parseInt(days, 10) || 7;
    const pool = await getPool();

    const result = await pool.request()
      .input('Days', sql.Int, daysInt)
      .query(`
        SELECT 
          PushType,
          COUNT(*) as TotalPushes,
          SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) as SuccessCount,
          SUM(CASE WHEN Success = 0 THEN 1 ELSE 0 END) as FailureCount,
          CAST(AVG(CASE WHEN Success = 1 THEN 100.0 ELSE 0 END) AS DECIMAL(5,2)) as SuccessRate,
          AVG(ProcessingTimeMs) as AvgProcessingTime,
          MAX(ProcessingTimeMs) as MaxProcessingTime
        FROM MED_PushLog
        WHERE PushDate >= DATEADD(DAY, -@Days, GETDATE())
        GROUP BY PushType
      `);
    
    const totalResult = await pool.request()
      .input('Days', sql.Int, daysInt)
      .query(`
        SELECT 
          COUNT(*) as TotalPushes,
          SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) as SuccessCount,
          SUM(CASE WHEN Success = 0 THEN 1 ELSE 0 END) as FailureCount,
          CAST(AVG(CASE WHEN Success = 1 THEN 100.0 ELSE 0 END) AS DECIMAL(5,2)) as OverallSuccessRate
        FROM MED_PushLog
        WHERE PushDate >= DATEADD(DAY, -@Days, GETDATE())
      `);
    
    res.json({
      success: true,
      period: `Last ${days} days`,
      overall: totalResult.recordset[0],
      byType: result.recordset
    });
    
  } catch (error) {
    logger.error('[Zenith] Push stats error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get push statistics',
      message: error.message
    });
  }
});

/**
 * GET /zenith/push-history
 * Get push log history with filters
 */
router.get('/push-history', async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      pushType,
      success,
      days = 7
    } = req.query;

    const pool = await getPool();
    const request = pool.request()
      .input('limit', parseInt(limit, 10) || 50)
      .input('offset', parseInt(offset, 10) || 0)
      .input('days', parseInt(days, 10) || 7);

    let where = 'WHERE pl.PushDate >= DATEADD(DAY, -@days, GETDATE())';

    if (pushType) {
      where += ' AND pl.PushType = @pushType';
      request.input('pushType', pushType);
    }

    if (success !== undefined && success !== null && success !== '') {
      where += ' AND pl.Success = @success';
      request.input('success', success === 'true' ? 1 : 0);
    }

    const result = await request.query(`
      SELECT
        pl.Id,
        pl.OpportunityId,
        pl.BookId,
        pl.PushType,
        pl.PushDate,
        pl.Success,
        pl.ErrorMessage,
        pl.RetryCount,
        pl.ProcessingTimeMs,
        h.Name as HotelName
      FROM MED_PushLog pl
      LEFT JOIN [MED_Opportunities] o ON pl.OpportunityId = o.OpportunityId
      LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
      ${where}
      ORDER BY pl.PushDate DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    // Get total count
    const countRequest = pool.request()
      .input('days', parseInt(days, 10) || 7);

    let countWhere = 'WHERE PushDate >= DATEADD(DAY, -@days, GETDATE())';
    if (pushType) {
      countWhere += ' AND PushType = @pushType';
      countRequest.input('pushType', pushType);
    }
    if (success !== undefined && success !== null && success !== '') {
      countWhere += ' AND Success = @success';
      countRequest.input('success', success === 'true' ? 1 : 0);
    }

    const countResult = await countRequest.query(`
      SELECT COUNT(*) as Total FROM MED_PushLog ${countWhere}
    `);

    res.json({
      success: true,
      history: result.recordset,
      pagination: {
        total: countResult.recordset[0]?.Total || 0,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      }
    });

  } catch (error) {
    logger.error('[Zenith] Push history error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get push history',
      message: error.message
    });
  }
});

/**
 * POST /zenith/push-availability
 * Push single availability update
 */
router.post('/push-availability', async (req, res) => {
  try {
    const { hotelCode, invTypeCode, startDate, endDate, available } = req.body;

    if (!hotelCode || !invTypeCode || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: hotelCode, invTypeCode, startDate, endDate'
      });
    }

    const result = await zenithPushService.pushAvailability({
      hotelCode,
      invTypeCode,
      startDate,
      endDate,
      available: available ?? 1
    });

    res.json(result);

  } catch (error) {
    logger.error('[Zenith] Push availability error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to push availability',
      message: error.message
    });
  }
});

/**
 * POST /zenith/push-rate
 * Push single rate update
 */
router.post('/push-rate', async (req, res) => {
  try {
    const { hotelCode, invTypeCode, ratePlanCode, startDate, endDate, price, currency, mealPlan } = req.body;

    if (!hotelCode || !invTypeCode || !startDate || !endDate || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: hotelCode, invTypeCode, startDate, endDate, price'
      });
    }

    const result = await zenithPushService.pushRate({
      hotelCode,
      invTypeCode,
      ratePlanCode: ratePlanCode || 'STD',
      startDate,
      endDate,
      price,
      currency: currency || 'EUR',
      mealPlan
    });

    res.json(result);

  } catch (error) {
    logger.error('[Zenith] Push rate error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to push rate',
      message: error.message
    });
  }
});

// ==================== DIRECT PRICE PUSH FEATURES ====================

/**
 * GET /ZenithApi/hotels-with-mapping
 * Search hotels that have Zenith mapping (for Direct Price Push autocomplete)
 * Query params: search (string), limit (number, default 50)
 */
router.get('/hotels-with-mapping', async (req, res) => {
  try {
    const { search = '', limit = 50 } = req.query;
    const pool = await getPool();

    const request = pool.request()
      .input('search', sql.NVarChar, `%${search}%`)
      .input('limit', sql.Int, parseInt(limit, 10) || 50);

    const result = await request.query(`
      SELECT TOP (@limit)
        h.HotelId,
        h.Name,
        h.City,
        h.Stars,
        h.Innstant_ZenithId AS ZenithHotelCode,
        h.InvTypeCode,
        h.RatePlanCode
      FROM Med_Hotels h
      WHERE h.Innstant_ZenithId IS NOT NULL
        AND h.isActive = 1
        AND (h.Name LIKE @search OR h.City LIKE @search
             OR CAST(h.HotelId AS VARCHAR) LIKE @search)
      ORDER BY h.Name ASC
    `);

    res.json({
      success: true,
      hotels: result.recordset,
      count: result.recordset.length
    });
  } catch (error) {
    logger.error('[Zenith] Hotels with mapping error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to search hotels',
      message: error.message
    });
  }
});

/**
 * POST /ZenithApi/direct-push
 * Push prices directly to Zenith for selected hotels.
 * Creates opportunity records for audit trail, then pushes availability + rates.
 * Body: {
 *   items: [{
 *     hotelId: number,
 *     zenithHotelCode: string,
 *     invTypeCode: string,
 *     ratePlanCode: string,
 *     startDate: string (YYYY-MM-DD),
 *     endDate: string (YYYY-MM-DD),
 *     pushPrice: number,
 *     boardId: number,
 *     categoryId: number,
 *     mealPlan: string ('BB','HB','FB','AI','RO'),
 *     pricingMode: 'static' | 'dynamic'
 *   }]
 * }
 */
router.post('/direct-push', async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'items array is required'
      });
    }

    logger.info('[Zenith Direct Push] Processing items', { count: items.length });

    const pool = await getPool();
    const results = [];
    const errors = [];

    for (const item of items) {
      try {
        const {
          hotelId, zenithHotelCode, invTypeCode, ratePlanCode,
          startDate, endDate, pushPrice,
          boardId = 1, categoryId = 1, mealPlan = 'RO',
          pricingMode = 'static'
        } = item;

        if (!hotelId || !zenithHotelCode || !startDate || !endDate || !pushPrice) {
          errors.push({
            hotelId: hotelId || 0,
            error: 'Missing required fields (hotelId, zenithHotelCode, startDate, endDate, pushPrice)'
          });
          continue;
        }

        // Calculate nights
        const nightsCount = Math.max(1, Math.round(
          (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
        ));

        // 1. Create opportunity record for audit trail
        let opportunityId = null;
        try {
          const oppResult = await pool.request()
            .input('OpportunityMlId', sql.Int, null)
            .input('DateCreate', sql.DateTime, new Date())
            .input('DestinationsType', sql.NVarChar, 'hotel')
            .input('DestinationsId', sql.Int, hotelId)
            .input('DateForm', sql.Date, startDate)
            .input('DateTo', sql.Date, endDate)
            .input('NumberOfNights', sql.Int, nightsCount)
            .input('BoardId', sql.Int, boardId)
            .input('CategoryId', sql.Int, categoryId)
            .input('Price', sql.Float, pushPrice)
            .input('Operator', sql.NVarChar, 'DirectPush')
            .input('Currency', sql.NVarChar, 'EUR')
            .input('FreeCancelation', sql.Bit, false)
            .input('CountryCode', sql.NVarChar, '')
            .input('PaxAdultsCount', sql.Int, 2)
            .input('PaxChildrenCount', sql.Int, 0)
            .input('PushHotelCode', sql.Int, parseInt(zenithHotelCode, 10) || 0)
            .input('PushBookingLimit', sql.Int, 1)
            .input('PushInvTypeCode', sql.NVarChar, invTypeCode || '')
            .input('PushRatePlanCode', sql.NVarChar, ratePlanCode || '')
            .input('PushPrice', sql.Float, pushPrice)
            .input('PushCurrency', sql.NVarChar, 'EUR')
            .input('ReservationFirstName', sql.NVarChar, 'DirectPush')
            .execute('MED_InsertOpportunity');

          opportunityId = oppResult.recordset?.[0]?.OpportunityId
            || oppResult.returnValue
            || null;

          // Fallback: query for latest
          if (!opportunityId) {
            const idResult = await pool.request()
              .input('hid', sql.Int, hotelId)
              .input('df', sql.NVarChar, startDate)
              .input('dt', sql.NVarChar, endDate)
              .query(`SELECT TOP 1 OpportunityId FROM [MED_Opportunities]
                      WHERE DestinationsId = @hid AND DateForm = @df AND DateTo = @dt
                      ORDER BY DateCreate DESC`);
            opportunityId = idResult.recordset[0]?.OpportunityId;
          }
        } catch (oppError) {
          logger.warn('[Zenith Direct Push] Opportunity creation failed, continuing with push', { error: oppError.message });
        }

        // 2. Push availability to Zenith
        const availResult = await zenithPushService.pushAvailability({
          hotelCode: zenithHotelCode,
          invTypeCode: invTypeCode || 'STD',
          startDate,
          endDate,
          available: 1
        });

        // 3. Push rate to Zenith
        const rateResult = await zenithPushService.pushRate({
          hotelCode: zenithHotelCode,
          invTypeCode: invTypeCode || 'STD',
          ratePlanCode: ratePlanCode || 'STD',
          startDate,
          endDate,
          price: pushPrice,
          currency: 'EUR',
          mealPlan
        });

        const pushSuccess = (availResult.success || rateResult.success);

        // 4. Update opportunity status
        if (opportunityId) {
          if (pricingMode === 'static' && pushSuccess) {
            await pool.request()
              .input('oppId', sql.Int, opportunityId)
              .query(`
                UPDATE [MED_Opportunities]
                SET IsPush = 1, Lastupdate = GETDATE()
                WHERE OpportunityId = @oppId
              `);
          }

          // 5. For dynamic mode, insert into push queue for Sales Order scanner
          if (pricingMode === 'dynamic') {
            await pool.request()
              .input('oppId', sql.Int, opportunityId)
              .input('action', sql.NVarChar, 'publish')
              .query(`
                INSERT INTO Med_HotelsToPush (OpportunityId, DateInsert, IsActive, Action)
                VALUES (@oppId, GETDATE(), 1, @action)
              `);
          }
        }

        // 6. Log to MED_PushLog
        try {
          await pool.request()
            .input('oppId', sql.Int, opportunityId || 0)
            .input('pushType', sql.NVarChar, 'RATE')
            .input('success', sql.Bit, pushSuccess ? 1 : 0)
            .input('errorMsg', sql.NVarChar, pushSuccess ? null : (rateResult.error || availResult.error || 'Unknown'))
            .input('processingTime', sql.Int, (rateResult.processingTime || 0) + (availResult.processingTime || 0))
            .query(`
              INSERT INTO MED_PushLog (OpportunityId, PushType, PushDate, Success, ErrorMessage, RetryCount, ProcessingTimeMs)
              VALUES (@oppId, @pushType, GETDATE(), @success, @errorMsg, 0, @processingTime)
            `);
        } catch { /* best effort logging */ }

        // Lookup hotel name
        let hotelName = '';
        try {
          const nameResult = await pool.request()
            .input('hid', sql.Int, hotelId)
            .query('SELECT TOP 1 Name FROM Med_Hotels WHERE HotelId = @hid');
          hotelName = nameResult.recordset[0]?.Name || '';
        } catch { /* best effort */ }

        if (pushSuccess) {
          results.push({
            hotelId,
            hotelName,
            status: 'success',
            opportunityId,
            pricingMode
          });
        } else {
          errors.push({
            hotelId,
            hotelName,
            error: rateResult.error || availResult.error || 'Zenith push failed'
          });
        }

        // Rate limiting: 500ms delay between pushes
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (itemError) {
        logger.error('[Zenith Direct Push] Error processing item', { hotelId: item.hotelId, error: itemError.message });
        errors.push({
          hotelId: item.hotelId || 0,
          error: itemError.message
        });
      }
    }

    // Slack notification
    if (results.length > 0) {
      try {
        await slackService.sendNotification(
          'Zenith Direct Push Completed',
          `Successfully pushed ${results.length} price entries\nFailed: ${errors.length}`
        );
      } catch { /* best effort */ }
    }

    res.json({
      success: true,
      summary: {
        total: items.length,
        successful: results.length,
        failed: errors.length
      },
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    logger.error('[Zenith Direct Push] Fatal error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to process direct push',
      message: error.message
    });
  }
});

// ==================== SALES OFFICE FEATURES ====================

/**
 * GET /zenith/incoming-reservations
 * View reservations received from Zenith (OTA_HotelResNotifRQ)
 */
router.get('/incoming-reservations', async (req, res) => {
  try {
    const { status, days = 30, limit = 100, offset = 0 } = req.query;
    const pool = await getPool();

    let where = 'WHERE r.DateInsert >= DATEADD(DAY, -@days, GETDATE())';
    const request = pool.request()
      .input('days', parseInt(days, 10))
      .input('limit', parseInt(limit, 10))
      .input('offset', parseInt(offset, 10));

    if (status === 'pending') {
      where += ' AND r.IsApproved = 0 AND r.IsCanceled = 0';
    } else if (status === 'approved') {
      where += ' AND r.IsApproved = 1';
    } else if (status === 'cancelled') {
      where += ' AND r.IsCanceled = 1';
    }

    const result = await request.query(`
      SELECT
        r.Id,
        r.uniqueID,
        r.HotelCode,
        h.Name as HotelName,
        r.DateFrom,
        r.DateTo,
        r.AmountAfterTax,
        r.CurrencyCode,
        r.GuestName,
        r.RatePlanCode,
        r.RoomTypeCode,
        r.AdultCount,
        r.ChildrenCount,
        r.Comments,
        r.IsApproved,
        r.IsCanceled,
        r.ApprovedDate,
        r.CancelDate,
        r.DateInsert,
        b.id as MatchedBookId,
        b.price as BookBuyPrice,
        b.lastPrice as BookPushPrice
      FROM Med_Reservation r
      LEFT JOIN Med_Hotels h ON r.HotelCode = h.Innstant_ZenithId
      LEFT JOIN MED_Book b ON r.MatchedBookId = b.id
      ${where}
      ORDER BY r.DateInsert DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    // Get counts
    const countsResult = await pool.request()
      .input('days', parseInt(days, 10))
      .query(`
        SELECT
          COUNT(*) as Total,
          SUM(CASE WHEN IsApproved = 0 AND IsCanceled = 0 THEN 1 ELSE 0 END) as Pending,
          SUM(CASE WHEN IsApproved = 1 THEN 1 ELSE 0 END) as Approved,
          SUM(CASE WHEN IsCanceled = 1 THEN 1 ELSE 0 END) as Cancelled
        FROM Med_Reservation
        WHERE DateInsert >= DATEADD(DAY, -@days, GETDATE())
      `);

    res.json({
      success: true,
      reservations: result.recordset,
      counts: countsResult.recordset[0],
      pagination: {
        total: countsResult.recordset[0]?.Total || 0,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      }
    });

  } catch (error) {
    logger.error('[Zenith] Incoming reservations error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get incoming reservations',
      message: error.message
    });
  }
});

/**
 * GET /zenith/available-rooms
 * Get available rooms that can be matched with reservations
 */
router.get('/available-rooms', async (req, res) => {
  try {
    const { hotelCode, dateFrom, dateTo } = req.query;
    const pool = await getPool();

    const request = pool.request();
    let where = 'WHERE b.IsActive = 1 AND b.IsSold = 0';

    if (hotelCode) {
      where += ' AND h.Innstant_ZenithId = @hotelCode';
      request.input('hotelCode', hotelCode);
    }
    if (dateFrom) {
      where += ' AND b.startDate >= @dateFrom';
      request.input('dateFrom', dateFrom);
    }
    if (dateTo) {
      where += ' AND b.endDate <= @dateTo';
      request.input('dateTo', dateTo);
    }

    const result = await request.query(`
      SELECT TOP 100
        b.id as BookId,
        b.HotelId,
        h.Name as HotelName,
        h.Innstant_ZenithId as HotelCode,
        b.startDate,
        b.endDate,
        b.price as BuyPrice,
        b.lastPrice as PushPrice,
        b.BoardId,
        bd.BoardCode as MealPlan,
        b.CategoryId,
        rc.Name as RoomCategory,
        b.CancellationType,
        b.CancellationTo
      FROM MED_Book b
      LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
      LEFT JOIN MED_Board bd ON b.BoardId = bd.BoardId
      LEFT JOIN MED_RoomCategory rc ON b.CategoryId = rc.CategoryId
      ${where}
      ORDER BY b.startDate ASC
    `);

    res.json({
      success: true,
      rooms: result.recordset
    });

  } catch (error) {
    logger.error('[Zenith] Available rooms error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get available rooms',
      message: error.message
    });
  }
});

/**
 * POST /zenith/approve-reservation
 * Match and approve reservation to a booking
 */
router.post('/approve-reservation', async (req, res) => {
  try {
    const { reservationId, bookId } = req.body;

    if (!reservationId || !bookId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: reservationId, bookId'
      });
    }

    const pool = await getPool();

    // Update reservation
    await pool.request()
      .input('reservationId', reservationId)
      .input('bookId', bookId)
      .query(`
        UPDATE Med_Reservation
        SET IsApproved = 1,
            ApprovedDate = GETDATE(),
            MatchedBookId = @bookId
        WHERE Id = @reservationId
      `);

    // Update booking as sold
    await pool.request()
      .input('bookId', bookId)
      .query(`
        UPDATE MED_Book
        SET IsSold = 1,
            SoldDate = GETDATE()
        WHERE id = @bookId
      `);

    // Log the activity with full context
    await pool.request()
      .input('reservationId', reservationId)
      .input('bookId', bookId)
      .query(`
        INSERT INTO [SalesOffice].[Log] (Action, ReservationId, BookId, HotelId, OpportunityId, Details, UserName, DateInsert)
        SELECT 'APPROVE_RESERVATION', @reservationId, @bookId, b.HotelId, b.OpportunityId,
               'Reservation matched and approved to booking ' + CAST(@bookId AS VARCHAR), 'System',
               GETDATE()
        FROM MED_Book b WHERE b.id = @bookId
      `);

    logger.info('[Zenith] Reservation approved', { reservationId, bookId });

    res.json({
      success: true,
      message: 'Reservation approved and matched to booking'
    });

  } catch (error) {
    logger.error('[Zenith] Approve reservation error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to approve reservation',
      message: error.message
    });
  }
});

/**
 * GET /zenith/sales-overview
 * Dashboard with available, sold, pending stats
 */
router.get('/sales-overview', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const pool = await getPool();

    // Get booking stats
    const bookingStats = await pool.request()
      .input('days', parseInt(days, 10))
      .query(`
        SELECT
          COUNT(*) as TotalBookings,
          SUM(CASE WHEN IsActive = 1 AND IsSold = 0 THEN 1 ELSE 0 END) as AvailableRooms,
          SUM(CASE WHEN IsSold = 1 THEN 1 ELSE 0 END) as SoldRooms,
          SUM(CASE WHEN IsActive = 0 THEN 1 ELSE 0 END) as CancelledRooms,
          SUM(CASE WHEN IsSold = 1 THEN ISNULL(lastPrice, 0) - ISNULL(price, 0) ELSE 0 END) as TotalProfit,
          SUM(CASE WHEN IsSold = 1 THEN ISNULL(lastPrice, 0) ELSE 0 END) as TotalRevenue
        FROM MED_Book
        WHERE DateInsert >= DATEADD(DAY, -@days, GETDATE())
      `);

    // Get reservation stats
    const reservationStats = await pool.request()
      .input('days', parseInt(days, 10))
      .query(`
        SELECT
          COUNT(*) as TotalReservations,
          SUM(CASE WHEN IsApproved = 0 AND IsCanceled = 0 THEN 1 ELSE 0 END) as PendingReservations,
          SUM(CASE WHEN IsApproved = 1 THEN 1 ELSE 0 END) as ApprovedReservations,
          SUM(CASE WHEN IsCanceled = 1 THEN 1 ELSE 0 END) as CancelledReservations,
          SUM(ISNULL(AmountAfterTax, 0)) as TotalReservationValue
        FROM Med_Reservation
        WHERE DateInsert >= DATEADD(DAY, -@days, GETDATE())
      `);

    // Get push stats
    const pushStats = await pool.request()
      .input('days', parseInt(days, 10))
      .query(`
        SELECT
          COUNT(*) as TotalPushes,
          SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) as SuccessfulPushes,
          SUM(CASE WHEN Success = 0 THEN 1 ELSE 0 END) as FailedPushes
        FROM MED_PushLog
        WHERE PushDate >= DATEADD(DAY, -@days, GETDATE())
      `);

    // Get recent activity
    const recentActivity = await pool.request()
      .query(`
        SELECT TOP 10
          'reservation' as Type,
          r.Id,
          r.uniqueID as Reference,
          h.Name as HotelName,
          r.AmountAfterTax as Amount,
          r.DateInsert as Date,
          CASE
            WHEN r.IsCanceled = 1 THEN 'cancelled'
            WHEN r.IsApproved = 1 THEN 'approved'
            ELSE 'pending'
          END as Status
        FROM Med_Reservation r
        LEFT JOIN Med_Hotels h ON r.HotelCode = h.Innstant_ZenithId
        ORDER BY r.DateInsert DESC
      `);

    res.json({
      success: true,
      period: `Last ${days} days`,
      bookings: bookingStats.recordset[0],
      reservations: reservationStats.recordset[0],
      pushes: pushStats.recordset[0],
      recentActivity: recentActivity.recordset
    });

  } catch (error) {
    logger.error('[Zenith] Sales overview error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get sales overview',
      message: error.message
    });
  }
});

/**
 * GET /zenith/activity-log
 * View SalesOffice.Log with sales activity records
 */
router.get('/activity-log', async (req, res) => {
  try {
    const { action, days = 7, limit = 100, offset = 0 } = req.query;
    const pool = await getPool();

    const request = pool.request()
      .input('days', parseInt(days, 10))
      .input('limit', parseInt(limit, 10))
      .input('offset', parseInt(offset, 10));

    let where = 'WHERE DateInsert >= DATEADD(DAY, -@days, GETDATE())';

    if (action) {
      where += ' AND Action = @action';
      request.input('action', action);
    }

    const result = await request.query(`
      SELECT
        Id,
        Action,
        ReservationId,
        BookId,
        OpportunityId,
        HotelId,
        Details,
        UserName,
        DateInsert
      FROM [SalesOffice].[Log]
      ${where}
      ORDER BY DateInsert DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    // Get total count
    const countRequest = pool.request()
      .input('days', parseInt(days, 10));

    let countWhere = 'WHERE DateInsert >= DATEADD(DAY, -@days, GETDATE())';
    if (action) {
      countWhere += ' AND Action = @action';
      countRequest.input('action', action);
    }

    const countResult = await countRequest.query(`
      SELECT COUNT(*) as Total FROM [SalesOffice].[Log] ${countWhere}
    `);

    // Get action types for filter
    const actionsResult = await pool.request().query(`
      SELECT DISTINCT Action FROM [SalesOffice].[Log]
      WHERE DateInsert >= DATEADD(DAY, -30, GETDATE())
    `);

    res.json({
      success: true,
      logs: result.recordset,
      actions: actionsResult.recordset.map(a => a.Action),
      pagination: {
        total: countResult.recordset[0]?.Total || 0,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      }
    });

  } catch (error) {
    logger.error('[Zenith] Activity log error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get activity log',
      message: error.message
    });
  }
});

/**
 * GET /zenith/cancellations
 * View cancellation requests (OTA_CancelRQ)
 */
router.get('/cancellations', async (req, res) => {
  try {
    const { status, days = 30, limit = 100, offset = 0 } = req.query;
    const pool = await getPool();

    const request = pool.request()
      .input('days', parseInt(days, 10))
      .input('limit', parseInt(limit, 10))
      .input('offset', parseInt(offset, 10));

    let where = 'WHERE rc.DateInsert >= DATEADD(DAY, -@days, GETDATE())';

    if (status === 'pending') {
      where += ' AND rc.IsProcessed = 0';
    } else if (status === 'processed') {
      where += ' AND rc.IsProcessed = 1';
    }

    const result = await request.query(`
      SELECT
        rc.Id,
        rc.uniqueID,
        rc.ReservationId,
        r.HotelCode,
        h.Name as HotelName,
        r.DateFrom,
        r.DateTo,
        r.AmountAfterTax,
        r.GuestName,
        rc.CancelReason,
        rc.IsProcessed,
        rc.ProcessedDate,
        rc.RefundAmount,
        rc.DateInsert
      FROM Med_ReservationCancel rc
      LEFT JOIN Med_Reservation r ON rc.ReservationId = r.Id OR rc.uniqueID = r.uniqueID
      LEFT JOIN Med_Hotels h ON r.HotelCode = h.Innstant_ZenithId
      ${where}
      ORDER BY rc.DateInsert DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    // Get counts
    const countsResult = await pool.request()
      .input('days', parseInt(days, 10))
      .query(`
        SELECT
          COUNT(*) as Total,
          SUM(CASE WHEN IsProcessed = 0 THEN 1 ELSE 0 END) as Pending,
          SUM(CASE WHEN IsProcessed = 1 THEN 1 ELSE 0 END) as Processed
        FROM Med_ReservationCancel
        WHERE DateInsert >= DATEADD(DAY, -@days, GETDATE())
      `);

    res.json({
      success: true,
      cancellations: result.recordset,
      counts: countsResult.recordset[0],
      pagination: {
        total: countsResult.recordset[0]?.Total || 0,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      }
    });

  } catch (error) {
    logger.error('[Zenith] Cancellations error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get cancellations',
      message: error.message
    });
  }
});

/**
 * POST /zenith/process-cancellation
 * Process a cancellation request
 */
router.post('/process-cancellation', async (req, res) => {
  try {
    const { cancellationId, refundAmount, notes } = req.body;

    if (!cancellationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: cancellationId'
      });
    }

    const pool = await getPool();

    // Get cancellation details
    const cancelResult = await pool.request()
      .input('cancellationId', cancellationId)
      .query(`
        SELECT uniqueID, ReservationId FROM Med_ReservationCancel WHERE Id = @cancellationId
      `);

    if (!cancelResult.recordset[0]) {
      return res.status(404).json({
        success: false,
        error: 'Cancellation not found'
      });
    }

    const { uniqueID, ReservationId } = cancelResult.recordset[0];

    // Update cancellation as processed
    await pool.request()
      .input('cancellationId', cancellationId)
      .input('refundAmount', refundAmount || 0)
      .input('notes', notes || '')
      .query(`
        UPDATE Med_ReservationCancel
        SET IsProcessed = 1,
            ProcessedDate = GETDATE(),
            RefundAmount = @refundAmount,
            ProcessNotes = @notes
        WHERE Id = @cancellationId
      `);

    // Update reservation as cancelled
    if (ReservationId) {
      await pool.request()
        .input('reservationId', ReservationId)
        .query(`
          UPDATE Med_Reservation
          SET IsCanceled = 1,
              CancelDate = GETDATE()
          WHERE Id = @reservationId
        `);
    } else if (uniqueID) {
      await pool.request()
        .input('uniqueID', uniqueID)
        .query(`
          UPDATE Med_Reservation
          SET IsCanceled = 1,
              CancelDate = GETDATE()
          WHERE uniqueID = @uniqueID
        `);
    }

    // Log the activity with full context
    await pool.request()
      .input('cancellationId', cancellationId)
      .input('reservationId', ReservationId)
      .input('refundAmount', refundAmount || 0)
      .query(`
        INSERT INTO [SalesOffice].[Log] (Action, ReservationId, BookId, HotelId, Details, UserName, DateInsert)
        SELECT 'PROCESS_CANCELLATION', @reservationId, r.MatchedBookId,
               (SELECT TOP 1 h.HotelId FROM Med_Hotels h WHERE h.Innstant_ZenithId = r.HotelCode),
               'Cancellation #' + CAST(@cancellationId AS VARCHAR) + ' processed. Refund: ' + CAST(@refundAmount AS VARCHAR),
               'System', GETDATE()
        FROM Med_Reservation r WHERE r.Id = @reservationId
      `);

    logger.info('[Zenith] Cancellation processed', { cancellationId, refundAmount });

    res.json({
      success: true,
      message: 'Cancellation processed successfully'
    });

  } catch (error) {
    logger.error('[Zenith] Process cancellation error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to process cancellation',
      message: error.message
    });
  }
});

// ==================== QUEUE MANAGEMENT ====================

/**
 * POST /zenith/retry-failed
 * Reset failed queue items for retry
 */
router.post('/retry-failed', async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      UPDATE Med_HotelsToPush
      SET Error = NULL,
          RetryCount = ISNULL(RetryCount, 0) + 1
      WHERE IsActive = 1
        AND DatePush IS NULL
        AND Error IS NOT NULL
    `);

    const retried = result.rowsAffected[0] || 0;
    logger.info('[Zenith] Retried failed queue items', { count: retried });

    res.json({
      success: true,
      message: `${retried} failed items reset for retry`,
      count: retried
    });

  } catch (error) {
    logger.error('[Zenith] Retry failed error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retry failed items',
      message: error.message
    });
  }
});

/**
 * POST /zenith/clear-completed
 * Remove completed (pushed) items from queue
 */
router.post('/clear-completed', async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      DELETE FROM Med_HotelsToPush
      WHERE DatePush IS NOT NULL
        OR IsActive = 0
    `);

    const cleared = result.rowsAffected[0] || 0;
    logger.info('[Zenith] Cleared completed queue items', { count: cleared });

    res.json({
      success: true,
      message: `${cleared} completed items cleared from queue`,
      count: cleared
    });

  } catch (error) {
    logger.error('[Zenith] Clear completed error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to clear completed items',
      message: error.message
    });
  }
});

/**
 * POST /zenith/clear-pending
 * Remove all pending items from queue (destructive)
 */
router.post('/clear-pending', async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      UPDATE Med_HotelsToPush
      SET IsActive = 0
      WHERE IsActive = 1
        AND DatePush IS NULL
    `);

    const cleared = result.rowsAffected[0] || 0;
    logger.info('[Zenith] Cleared pending queue items', { count: cleared });

    res.json({
      success: true,
      message: `${cleared} pending items cleared from queue`,
      count: cleared
    });

  } catch (error) {
    logger.error('[Zenith] Clear pending error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to clear pending items',
      message: error.message
    });
  }
});

module.exports = router;
