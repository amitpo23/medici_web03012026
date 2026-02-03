/**
 * Zenith Push Service - Enhanced with Batch, Retry, and Logging
 * Pushes rates and availability to Zenith distribution channel
 * 
 * Features:
 * - Batch push operations
 * - Automatic retry with exponential backoff
 * - Complete logging to MED_PushLog
 * - Performance tracking
 * - Error recovery
 */

const axios = require('axios');
const logger = require('../config/logger');
const sql = require('mssql');
const poolPromise = require('../config/database');

class ZenithPushService {
  constructor() {
    this.serviceUrl = process.env.ZENITH_SERVICE_URL;
    this.username = process.env.ZENITH_USERNAME;
    this.password = process.env.ZENITH_API_PASSWORD;
    this.agentName = process.env.ZENITH_AGENT_NAME;
    this.agentPassword = process.env.ZENITH_AGENT_PASSWORD;
    
    // Retry configuration
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
    this.maxRetryDelay = 30000; // Max 30 seconds
    
    // Batch configuration
    this.maxBatchSize = 50;
    this.batchDelayMs = 100; // Delay between batch items

    if (!this.serviceUrl || !this.username || !this.password || !this.agentName || !this.agentPassword) {
      logger.warn('[ZenithPushService] Missing Zenith credentials in environment variables. Push operations will fail.');
    }
  }
  
  /**
   * Log push operation to database
   */
  async logPushOperation(params) {
    try {
      const pool = await poolPromise;
      
      await pool.request()
        .input('OpportunityId', sql.Int, params.opportunityId || null)
        .input('BookId', sql.Int, params.bookId || null)
        .input('PushType', sql.VarChar(50), params.pushType)
        .input('ZenithRequest', sql.NVarChar(sql.MAX), params.request || null)
        .input('ZenithResponse', sql.NVarChar(sql.MAX), params.response || null)
        .input('Success', sql.Bit, params.success ? 1 : 0)
        .input('ErrorMessage', sql.NVarChar(500), params.errorMessage || null)
        .input('RetryCount', sql.Int, params.retryCount || 0)
        .input('ProcessingTimeMs', sql.Int, params.processingTime || null)
        .query(`
          INSERT INTO MED_PushLog (
            OpportunityId, BookId, PushType, 
            ZenithRequest, ZenithResponse,
            Success, ErrorMessage, RetryCount, ProcessingTimeMs
          )
          VALUES (
            @OpportunityId, @BookId, @PushType,
            @ZenithRequest, @ZenithResponse,
            @Success, @ErrorMessage, @RetryCount, @ProcessingTimeMs
          )
        `);
        
    } catch (error) {
      logger.error('[ZenithPushService] Failed to log push operation', { error: error.message });
      // Don't throw - logging failure shouldn't break the push operation
    }
  }

  /**
   * Get SOAP headers for authentication
   */
  getSoapHeaders() {
    return {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'http://www.opentravel.org/OTA/2003/05'
    };
  }

  /**
   * Generate OTA_HotelAvailNotifRQ XML for pushing availability
   * @param {Object} params - Availability parameters
   */
  generateAvailabilityXML(params) {
    const { hotelCode, invTypeCode, startDate, endDate, available = 1 } = params;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <OTA_HotelAvailNotifRQ xmlns="http://www.opentravel.org/OTA/2003/05"
                           Version="1.0"
                           TimeStamp="${new Date().toISOString()}">
      <POS>
        <Source>
          <RequestorID Type="10" ID="${this.username}">
            <CompanyName Code="${this.agentName}"/>
          </RequestorID>
        </Source>
      </POS>
      <AvailStatusMessages HotelCode="${hotelCode}">
        <AvailStatusMessage>
          <StatusApplicationControl Start="${startDate}" End="${endDate}"
                                     InvTypeCode="${invTypeCode}"
                                     RatePlanCode="STD"/>
          <LengthsOfStay>
            <LengthOfStay MinMaxMessageType="SetMinLOS" Time="1" TimeUnit="Day"/>
          </LengthsOfStay>
          <RestrictionStatus Status="${available > 0 ? 'Open' : 'Close'}"/>
        </AvailStatusMessage>
      </AvailStatusMessages>
    </OTA_HotelAvailNotifRQ>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Generate OTA_HotelRatePlanNotifRQ XML for pushing rates
   * @param {Object} params - Rate parameters
   */
  generateRateXML(params) {
    const { hotelCode, invTypeCode, ratePlanCode, startDate, endDate, price, currency = 'EUR', mealPlan } = params;
    
    // Meal plan mapping
    const mealPlanCodes = {
      'BB': '1', // Bed & Breakfast
      'HB': '3', // Half Board
      'FB': '4', // Full Board
      'AI': '5'  // All Inclusive
    };

    const mealPlanCode = mealPlanCodes[mealPlan] || '14'; // Default: Room Only
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <OTA_HotelRatePlanNotifRQ xmlns="http://www.opentravel.org/OTA/2003/05"
                              Version="1.0"
                              TimeStamp="${new Date().toISOString()}">
      <POS>
        <Source>
          <RequestorID Type="10" ID="${this.username}">
            <CompanyName Code="${this.agentName}"/>
          </RequestorID>
        </Source>
      </POS>
      <RatePlans HotelCode="${hotelCode}">
        <RatePlan RatePlanCode="${ratePlanCode}" RatePlanNotifType="Overlay">
          <Rates>
            <Rate InvTypeCode="${invTypeCode}" Start="${startDate}" End="${endDate}">
              <BaseByGuestAmts>
                <BaseByGuestAmt AmountAfterTax="${price}" CurrencyCode="${currency}" NumberOfGuests="2"/>
              </BaseByGuestAmts>
              ${mealPlan ? `<MealsIncluded MealPlanCode="${mealPlanCode}"/>` : ''}
            </Rate>
          </Rates>
        </RatePlan>
      </RatePlans>
    </OTA_HotelRatePlanNotifRQ>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Push availability to Zenith with retry logic
   * @param {Object} params - Availability parameters
   * @param {Number} retryCount - Current retry attempt
   */
  async pushAvailability(params, retryCount = 0) {
    const startTime = Date.now();
    
    try {
      if (!this.serviceUrl) {
        throw new Error('Zenith service not configured');
      }
      
      const xml = this.generateAvailabilityXML(params);
      
      logger.info(`[Zenith Push] Pushing availability for hotel ${params.hotelCode}`, {
        attempt: retryCount + 1,
        maxRetries: this.maxRetries
      });

      const response = await axios.post(this.serviceUrl, xml, {
        headers: this.getSoapHeaders(),
        auth: {
          username: this.agentName,
          password: this.agentPassword
        },
        timeout: 30000 // 30 second timeout
      });

      const isSuccess = response.data.includes('<Success') || response.data.includes('Success/');
      const processingTime = Date.now() - startTime;
      
      // Log to database
      await this.logPushOperation({
        opportunityId: params.opportunityId,
        bookId: params.bookId,
        pushType: 'AVAILABILITY',
        request: xml,
        response: response.data,
        success: isSuccess,
        retryCount: retryCount,
        processingTime: processingTime
      });
      
      if (!isSuccess) {
        throw new Error('Zenith returned non-success response');
      }
      
      return {
        success: true,
        response: response.data,
        processingTime
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('[Zenith Push] Availability error:', { 
        error: error.message,
        attempt: retryCount + 1,
        hotelCode: params.hotelCode
      });
      
      // Log failed attempt
      await this.logPushOperation({
        opportunityId: params.opportunityId,
        bookId: params.bookId,
        pushType: 'AVAILABILITY',
        request: this.generateAvailabilityXML(params),
        response: error.response?.data || null,
        success: false,
        errorMessage: error.message,
        retryCount: retryCount,
        processingTime: processingTime
      });
      
      // Retry logic
      if (retryCount < this.maxRetries) {
        const delay = Math.min(
          this.retryDelay * Math.pow(2, retryCount),
          this.maxRetryDelay
        );
        
        logger.info(`[Zenith Push] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.pushAvailability(params, retryCount + 1);
      }
      
      return {
        success: false,
        error: error.message,
        details: error.response?.data,
        processingTime
      };
    }
  }

  /**
   * Push rate to Zenith with retry logic
   * @param {Object} params - Rate parameters
   * @param {Number} retryCount - Current retry attempt
   */
  async pushRate(params, retryCount = 0) {
    const startTime = Date.now();
    
    try {
      if (!this.serviceUrl) {
        throw new Error('Zenith service not configured');
      }
      
      const xml = this.generateRateXML(params);
      
      logger.info(`[Zenith Push] Pushing rate for hotel ${params.hotelCode}: ${params.currency || 'EUR'}${params.price}`, {
        attempt: retryCount + 1,
        maxRetries: this.maxRetries
      });

      const response = await axios.post(this.serviceUrl, xml, {
        headers: this.getSoapHeaders(),
        auth: {
          username: this.agentName,
          password: this.agentPassword
        },
        timeout: 30000
      });

      const isSuccess = response.data.includes('<Success') || response.data.includes('Success/');
      const processingTime = Date.now() - startTime;
      
      // Log to database
      await this.logPushOperation({
        opportunityId: params.opportunityId,
        bookId: params.bookId,
        pushType: 'RATE',
        request: xml,
        response: response.data,
        success: isSuccess,
        retryCount: retryCount,
        processingTime: processingTime
      });
      
      if (!isSuccess) {
        throw new Error('Zenith returned non-success response');
      }
      
      return {
        success: true,
        response: response.data,
        processingTime
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('[Zenith Push] Rate error:', { 
        error: error.message,
        attempt: retryCount + 1,
        hotelCode: params.hotelCode
      });
      
      // Log failed attempt
      await this.logPushOperation({
        opportunityId: params.opportunityId,
        bookId: params.bookId,
        pushType: 'RATE',
        request: this.generateRateXML(params),
        response: error.response?.data || null,
        success: false,
        errorMessage: error.message,
        retryCount: retryCount,
        processingTime: processingTime
      });
      
      // Retry logic
      if (retryCount < this.maxRetries) {
        const delay = Math.min(
          this.retryDelay * Math.pow(2, retryCount),
          this.maxRetryDelay
        );
        
        logger.info(`[Zenith Push] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.pushRate(params, retryCount + 1);
      }
      
      return {
        success: false,
        error: error.message,
        details: error.response?.data,
        processingTime
      };
    }
  }

  /**
   * Push rate to Zenith (alias for pushRate with different parameter names)
   * Accepts { hotelCode, invTypeCode, startDate, endDate, amount, currency }
   * @param {Object} params - Rate parameters
   */
  async pushRates(params) {
    return this.pushRate({
      hotelCode: params.hotelCode,
      invTypeCode: params.invTypeCode,
      ratePlanCode: params.ratePlanCode || 'STD',
      startDate: params.startDate,
      endDate: params.endDate,
      price: params.amount || params.price,
      currency: params.currency || 'EUR',
      mealPlan: params.mealPlan
    });
  }

  /**
   * Push both availability and rate for a booking
   * @param {Object} booking - Booking details
   */
  async pushBooking(booking) {
    const { hotelCode, invTypeCode, ratePlanCode, startDate, endDate, pushPrice, available = 1, mealPlan } = booking;

    // Push availability first
    const availResult = await this.pushAvailability({
      hotelCode,
      invTypeCode,
      startDate,
      endDate,
      available
    });

    if (!availResult.success) {
      return { 
        success: false, 
        error: 'Failed to push availability', 
        zenithError: availResult.error,
        details: availResult 
      };
    }

    // Then push rate with meal plan
    const rateResult = await this.pushRate({
      hotelCode,
      invTypeCode,
      ratePlanCode,
      startDate,
      endDate,
      price: pushPrice,
      mealPlan
    });

    return {
      success: rateResult.success,
      error: rateResult.success ? null : 'Failed to push rate',
      zenithError: rateResult.error,
      availability: availResult,
      rate: rateResult,
      response: rateResult.response
    };
  }

  /**
   * Close availability (when room is sold or cancelled)
   * @param {Object} params - Parameters
   */
  async closeBooking(params) {
    return this.pushBooking({
      ...params,
      available: 0
    });
  }
  
  /**
   * Push multiple bookings in batch
   * @param {Array} bookings - Array of booking objects
   */
  async pushBatch(bookings) {
    logger.info(`[Zenith Batch] Starting batch push for ${bookings.length} items`);
    
    const results = {
      total: bookings.length,
      successful: 0,
      failed: 0,
      items: []
    };
    
    const startTime = Date.now();
    
    // Process in chunks to avoid overwhelming the service
    const chunks = this.chunkArray(bookings, this.maxBatchSize);
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      logger.info(`[Zenith Batch] Processing chunk ${chunkIndex + 1}/${chunks.length}`);
      
      for (let i = 0; i < chunk.length; i++) {
        const booking = chunk[i];
        
        try {
          const result = await this.pushBooking(booking);
          
          results.items.push({
            id: booking.id || booking.opportunityId || booking.bookId,
            hotelCode: booking.hotelCode,
            success: result.success,
            error: result.error || null
          });
          
          if (result.success) {
            results.successful++;
          } else {
            results.failed++;
          }
          
          // Small delay between pushes to avoid rate limiting
          if (i < chunk.length - 1) {
            await new Promise(resolve => setTimeout(resolve, this.batchDelayMs));
          }
          
        } catch (error) {
          logger.error(`[Zenith Batch] Error pushing booking`, { 
            booking: booking.id || booking.hotelCode,
            error: error.message 
          });
          
          results.items.push({
            id: booking.id || booking.opportunityId || booking.bookId,
            hotelCode: booking.hotelCode,
            success: false,
            error: error.message
          });
          
          results.failed++;
        }
      }
      
      // Longer delay between chunks
      if (chunkIndex < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const totalTime = Date.now() - startTime;
    const successRate = ((results.successful / results.total) * 100).toFixed(1);
    
    logger.info(`[Zenith Batch] Batch push completed`, {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
      successRate: `${successRate}%`,
      totalTime: `${totalTime}ms`
    });
    
    return results;
  }
  
  /**
   * Process Med_HotelsToPush queue
   */
  async processQueue() {
    try {
      const pool = await poolPromise;
      
      // Get pending items from queue
      const result = await pool.request().query(`
        SELECT TOP 50
          htp.id as QueueId,
          htp.BookId,
          htp.OpportunityId,
          b.HotelId,
          h.Innstant_ZenithId as HotelCode,
          h.InvTypeCode,
          h.RatePlanCode,
          b.startDate,
          b.endDate,
          b.pushPrice,
          b.BoardId,
          rb.Name as MealPlan
        FROM Med_HotelsToPush htp
        LEFT JOIN MED_Book b ON b.id = htp.BookId
        LEFT JOIN Med_Hotels h ON h.HotelId = b.HotelId
        LEFT JOIN MED_Board rb ON rb.id = b.BoardId
        WHERE htp.IsActive = 1
          AND htp.DatePush IS NULL
          AND h.Innstant_ZenithId IS NOT NULL
        ORDER BY htp.DateInsert ASC
      `);
      
      if (result.recordset.length === 0) {
        logger.info('[Zenith Queue] No items in queue');
        return { processed: 0, successful: 0, failed: 0 };
      }
      
      logger.info(`[Zenith Queue] Processing ${result.recordset.length} items from queue`);
      
      // Prepare bookings for batch push
      const bookings = result.recordset.map(item => ({
        queueId: item.QueueId,
        bookId: item.BookId,
        opportunityId: item.OpportunityId,
        hotelCode: item.HotelCode,
        invTypeCode: item.InvTypeCode,
        ratePlanCode: item.RatePlanCode || 'STD',
        startDate: item.startDate,
        endDate: item.endDate,
        pushPrice: item.pushPrice,
        mealPlan: item.MealPlan,
        available: 1
      }));
      
      // Push batch
      const batchResult = await this.pushBatch(bookings);
      
      // Update queue items
      for (const item of batchResult.items) {
        const booking = bookings.find(b => 
          b.bookId === item.id || b.opportunityId === item.id
        );
        
        if (!booking) continue;
        
        await pool.request()
          .input('QueueId', sql.Int, booking.queueId)
          .input('Success', sql.Bit, item.success ? 1 : 0)
          .input('ErrorMessage', sql.NVarChar(500), item.error || null)
          .query(`
            UPDATE Med_HotelsToPush
            SET 
              IsActive = CASE WHEN @Success = 1 THEN 0 ELSE 1 END,
              DatePush = CASE WHEN @Success = 1 THEN GETDATE() ELSE NULL END,
              Error = @ErrorMessage
            WHERE id = @QueueId
          `);
      }
      
      logger.info('[Zenith Queue] Queue processing completed', {
        processed: batchResult.total,
        successful: batchResult.successful,
        failed: batchResult.failed
      });
      
      return {
        processed: batchResult.total,
        successful: batchResult.successful,
        failed: batchResult.failed,
        details: batchResult.items
      };
      
    } catch (error) {
      logger.error('[Zenith Queue] Queue processing error', { error: error.message });
      throw error;
    }
  }
  
  /**
   * Utility: Split array into chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

module.exports = new ZenithPushService();
