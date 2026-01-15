/**
 * Zenith Push Service
 * Pushes rates and availability to Zenith distribution channel
 */

const axios = require('axios');

class ZenithPushService {
  constructor() {
    this.serviceUrl = process.env.ZENITH_SERVICE_URL || 'https://hotel.tools/service/Medici%20new';
    this.username = process.env.ZENITH_USERNAME || 'APIMedici:Medici Live';
    this.password = process.env.ZENITH_API_PASSWORD || '12345';
    this.agentName = process.env.ZENITH_AGENT_NAME || 'Zvi';
    this.agentPassword = process.env.ZENITH_AGENT_PASSWORD || 'karpad66';
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
    const { hotelCode, invTypeCode, ratePlanCode, startDate, endDate, price, currency = 'EUR' } = params;
    
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
      
      console.log(`[Zenith Push] Pushing availability for hotel ${params.hotelCode}`);

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
      console.error('[Zenith Push] Availability error:', error.message);
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
      
      console.log(`[Zenith Push] Pushing rate for hotel ${params.hotelCode}: €${params.price}`);

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
      console.error('[Zenith Push] Rate error:', error.message);
      return {
        success: false,
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Push both availability and rate for a booking
   * @param {Object} booking - Booking details
   */
  async pushBooking(booking) {
    const { hotelCode, invTypeCode, ratePlanCode, startDate, endDate, pushPrice } = booking;

    // Push availability first
    const availResult = await this.pushAvailability({
      hotelCode,
      invTypeCode,
      startDate,
      endDate,
      available: 1
    });

    if (!availResult.success) {
      return { success: false, error: 'Failed to push availability', details: availResult };
    }

    // Then push rate
    const rateResult = await this.pushRate({
      hotelCode,
      invTypeCode,
      ratePlanCode,
      startDate,
      endDate,
      price: pushPrice
    });

    return {
      success: rateResult.success,
      availability: availResult,
      rate: rateResult
    };
  }

  /**
   * Close availability (when room is sold or cancelled)
   * @param {Object} params - Parameters
   */
  async closeAvailability(params) {
    return this.pushAvailability({
      ...params,
      available: 0
    });
  }
}

module.exports = ZenithPushService;
