/**
 * Zenith Push Service
 * Pushes rates and availability to Zenith distribution channel
 */

const axios = require('axios');
const logger = require('../config/logger');

class ZenithPushService {
  constructor() {
    this.serviceUrl = process.env.ZENITH_SERVICE_URL;
    this.username = process.env.ZENITH_USERNAME;
    this.password = process.env.ZENITH_API_PASSWORD;
    this.agentName = process.env.ZENITH_AGENT_NAME;
    this.agentPassword = process.env.ZENITH_AGENT_PASSWORD;

    if (!this.serviceUrl || !this.username || !this.password || !this.agentName || !this.agentPassword) {
      logger.warn('[ZenithPushService] Missing Zenith credentials in environment variables. Push operations will fail.');
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
   * Push availability to Zenith
   * @param {Object} params - Availability parameters
   */
  async pushAvailability(params) {
    try {
      const xml = this.generateAvailabilityXML(params);
      
      logger.info(`[Zenith Push] Pushing availability for hotel ${params.hotelCode}`);

      const response = await axios.post(this.serviceUrl, xml, {
        headers: this.getSoapHeaders(),
        auth: {
          username: this.agentName,
          password: this.agentPassword
        }
      });

      // Check for success in response
      const isSuccess = response.data.includes('<Success') || response.data.includes('Success/');
      
      return {
        success: isSuccess,
        response: response.data
      };
    } catch (error) {
      logger.error('[Zenith Push] Availability error:', { error: error.message });
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Push rate to Zenith
   * @param {Object} params - Rate parameters
   */
  async pushRate(params) {
    try {
      const xml = this.generateRateXML(params);
      
      logger.info(`[Zenith Push] Pushing rate for hotel ${params.hotelCode}: EUR${params.price}`);

      const response = await axios.post(this.serviceUrl, xml, {
        headers: this.getSoapHeaders(),
        auth: {
          username: this.agentName,
          password: this.agentPassword
        }
      });

      const isSuccess = response.data.includes('<Success') || response.data.includes('Success/');
      
      return {
        success: isSuccess,
        response: response.data
      };
    } catch (error) {
      logger.error('[Zenith Push] Rate error:', { error: error.message });
      return {
        success: false,
        error: error.message,
        details: error.response?.data
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
}

module.exports = new ZenithPushService();
