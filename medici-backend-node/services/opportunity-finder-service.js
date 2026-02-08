/**
 * Opportunity Finder Service
 *
 * Combines BACKWARD analysis (historical data) with FORWARD search (live prices)
 * to identify profitable trading opportunities.
 *
 * Tables Used for Historical Analysis:
 * - MED_Book: Past booking success rates, margins
 * - Med_Hotels: Hotel data, stars, city
 * - MED_Opportunities: Past opportunity conversion rates
 * - MED_SearchHotels: Historical price trends
 * - RoomPriceUpdateLog: Price volatility patterns
 * - MED_CancelBook: Cancellation risk patterns
 *
 * Live Data Sources:
 * - InnstantSearch API: Current supplier prices
 * - MultiSupplier API: Prices from multiple suppliers
 */

const sql = require('mssql');
const dbConfig = require('../config/database');
const logger = require('../config/logger');
const axios = require('axios');

class OpportunityFinderService {

  constructor() {
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:8080';
  }

  /**
   * Find opportunities by combining historical analysis with live search
   * @param {Object} params - Search parameters
   * @param {string} params.city - City to search
   * @param {string} params.dateFrom - Check-in date (yyyy-mm-dd)
   * @param {string} params.dateTo - Check-out date (yyyy-mm-dd)
   * @param {number} params.minMargin - Minimum expected margin %
   * @param {number} params.maxRisk - Maximum risk score (0-100)
   * @param {number} params.limit - Max hotels to analyze
   */
  async findOpportunities(params) {
    const {
      city,
      dateFrom,
      dateTo,
      minMargin = 10,
      maxRisk = 60,
      limit = 20,
      stars = null
    } = params;

    try {
      const pool = await sql.connect(dbConfig);
      const opportunities = [];

      // STEP 1: Get hotels with good historical performance
      const historicalHotels = await this.getHighPerformingHotels(pool, city, stars, limit);
      logger.info(`[OpportunityFinder] Found ${historicalHotels.length} historically good hotels in ${city}`);

      // STEP 2: For each hotel, run live search and compare
      for (const hotel of historicalHotels) {
        try {
          // Get live price from search API
          const livePrice = await this.getLivePrice(hotel.HotelId, dateFrom, dateTo);

          if (!livePrice) {
            continue; // Skip if no availability
          }

          // Compare with historical data
          const analysis = await this.analyzeOpportunity(
            pool,
            hotel,
            livePrice,
            dateFrom,
            dateTo
          );

          // Filter by criteria
          if (analysis.expectedMargin >= minMargin && analysis.riskScore <= maxRisk) {
            opportunities.push({
              hotelId: hotel.HotelId,
              hotelName: hotel.Name,
              city: hotel.City,
              stars: hotel.Stars,
              // Live data
              currentPrice: livePrice.price,
              currency: livePrice.currency,
              roomType: livePrice.roomType,
              checkIn: dateFrom,
              checkOut: dateTo,
              // Historical analysis
              historicalAvgPrice: analysis.historicalAvgPrice,
              priceDiffPercent: analysis.priceDiffPercent,
              historicalSuccessRate: analysis.successRate,
              historicalMargin: analysis.historicalMargin,
              // Predictions
              expectedMargin: analysis.expectedMargin,
              suggestedSellPrice: analysis.suggestedSellPrice,
              successProbability: analysis.successProbability,
              riskScore: analysis.riskScore,
              riskLevel: analysis.riskLevel,
              // Recommendation
              recommendation: analysis.recommendation,
              confidence: analysis.confidence,
              reasons: analysis.reasons
            });
          }
        } catch (hotelError) {
          logger.warn(`[OpportunityFinder] Error analyzing hotel ${hotel.HotelId}:`, hotelError.message);
        }
      }

      // Sort by expected margin (best first)
      opportunities.sort((a, b) => b.expectedMargin - a.expectedMargin);

      return {
        success: true,
        city,
        dateRange: { from: dateFrom, to: dateTo },
        totalAnalyzed: historicalHotels.length,
        opportunitiesFound: opportunities.length,
        filters: { minMargin, maxRisk },
        opportunities
      };

    } catch (error) {
      logger.error('[OpportunityFinder] Error finding opportunities:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get historically high-performing hotels in a city
   */
  async getHighPerformingHotels(pool, city, stars, limit) {
    let query = `
      SELECT TOP (@limit)
        h.HotelId,
        h.Name,
        h.City,
        h.Stars,
        h.InnstantId,
        COUNT(b.BookID) as totalBookings,
        SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as soldCount,
        AVG(b.BuyPrice) as avgBuyPrice,
        AVG(b.PushPrice) as avgSellPrice,
        AVG(CASE WHEN b.IsSold = 1 THEN ((b.PushPrice - b.BuyPrice) / NULLIF(b.BuyPrice, 0) * 100) ELSE 0 END) as avgMargin,
        CAST(SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as FLOAT) / NULLIF(COUNT(b.BookID), 0) * 100 as successRate
      FROM Med_Hotels h
      LEFT JOIN MED_Book b ON h.HotelId = b.HotelId AND b.DateInsert >= DATEADD(month, -6, GETDATE())
      WHERE h.City = @city
        AND h.InnstantId IS NOT NULL
    `;

    const request = pool.request()
      .input('city', sql.NVarChar, city)
      .input('limit', sql.Int, limit);

    if (stars) {
      query += ' AND h.Stars = @stars';
      request.input('stars', sql.Int, stars);
    }

    query += `
      GROUP BY h.HotelId, h.Name, h.City, h.Stars, h.InnstantId
      HAVING COUNT(b.BookID) >= 3 OR h.InnstantId IS NOT NULL
      ORDER BY
        CAST(SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as FLOAT) / NULLIF(COUNT(b.BookID), 0) DESC,
        COUNT(b.BookID) DESC
    `;

    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Get live price from search API
   */
  async getLivePrice(hotelId, dateFrom, dateTo) {
    try {
      // Call the InnstantPrice API
      const response = await axios.post(`${this.baseUrl}/Search/InnstantPrice`, {
        hotelId,
        dateFrom,
        dateTo,
        adults: 2
      }, {
        timeout: 30000 // 30 second timeout
      });

      if (response.data.success && response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];

        // Get cheapest room
        let cheapestRoom = null;
        if (result.rooms && result.rooms.length > 0) {
          cheapestRoom = result.rooms.reduce((min, room) =>
            room.price < min.price ? room : min
          , result.rooms[0]);
        }

        return {
          price: cheapestRoom?.price || result.price,
          currency: result.currency || 'EUR',
          roomType: cheapestRoom?.roomType || 'Standard',
          source: result.source || 'Innstant',
          rooms: result.rooms || []
        };
      }

      return null;
    } catch (error) {
      logger.warn(`[OpportunityFinder] Failed to get live price for hotel ${hotelId}:`, error.message);
      return null;
    }
  }

  /**
   * Analyze opportunity by comparing live price with historical data
   */
  async analyzeOpportunity(pool, hotel, livePrice, dateFrom, dateTo) {
    // Get historical price data
    const historicalData = await pool.request()
      .input('hotelId', sql.Int, hotel.HotelId)
      .query(`
        SELECT
          AVG(BuyPrice) as avgBuyPrice,
          AVG(PushPrice) as avgSellPrice,
          MIN(BuyPrice) as minBuyPrice,
          MAX(BuyPrice) as maxBuyPrice,
          STDEV(BuyPrice) as priceStdDev,
          COUNT(*) as totalDeals,
          SUM(CASE WHEN IsSold = 1 THEN 1 ELSE 0 END) as soldDeals,
          AVG(CASE WHEN IsSold = 1 THEN ((PushPrice - BuyPrice) / NULLIF(BuyPrice, 0) * 100) ELSE NULL END) as avgSuccessfulMargin
        FROM MED_Book
        WHERE HotelId = @hotelId
          AND DateInsert >= DATEADD(month, -6, GETDATE())
      `);

    // Get cancellation data
    const cancelData = await pool.request()
      .input('hotelId', sql.Int, hotel.HotelId)
      .query(`
        SELECT
          COUNT(*) as totalCancellations,
          SUM(CASE WHEN DATEDIFF(day, DateInsert, CheckIn) < 7 THEN 1 ELSE 0 END) as lastMinuteCancels
        FROM MED_CancelBook
        WHERE HotelId = @hotelId
          AND DateInsert >= DATEADD(month, -6, GETDATE())
      `);

    // Get search demand data
    const demandData = await pool.request()
      .input('hotelId', sql.Int, hotel.HotelId)
      .query(`
        SELECT
          COUNT(*) as searchCount,
          AVG(Price) as avgSearchPrice
        FROM MED_SearchHotels
        WHERE HotelId = @hotelId
          AND SearchDate >= DATEADD(month, -1, GETDATE())
      `);

    const hist = historicalData.recordset[0] || {};
    const cancel = cancelData.recordset[0] || {};
    const demand = demandData.recordset[0] || {};

    // Calculate metrics
    const historicalAvgPrice = hist.avgBuyPrice || livePrice.price;
    const priceDiffPercent = historicalAvgPrice > 0
      ? ((historicalAvgPrice - livePrice.price) / historicalAvgPrice * 100)
      : 0;

    const successRate = hist.totalDeals > 0
      ? (hist.soldDeals / hist.totalDeals * 100)
      : 50;

    const historicalMargin = hist.avgSuccessfulMargin || 15;

    // Calculate suggested sell price (based on historical success)
    const suggestedMarkup = Math.min(historicalMargin + 5, 25); // Cap at 25%
    const suggestedSellPrice = Math.round(livePrice.price * (1 + suggestedMarkup / 100));
    const expectedMargin = suggestedMarkup;

    // Calculate risk score (0-100)
    let riskScore = 0;

    // Price volatility risk (0-25)
    const volatility = hist.priceStdDev / (hist.avgBuyPrice || 1) * 100;
    riskScore += Math.min(25, volatility);

    // Days before arrival risk (0-20)
    const checkInDate = new Date(dateFrom);
    const today = new Date();
    const daysBeforeArrival = Math.floor((checkInDate - today) / (1000 * 60 * 60 * 24));
    if (daysBeforeArrival < 7) riskScore += 20;
    else if (daysBeforeArrival < 14) riskScore += 12;
    else if (daysBeforeArrival < 30) riskScore += 5;

    // Cancellation risk (0-20)
    const cancelRate = hist.totalDeals > 0
      ? (cancel.totalCancellations / hist.totalDeals * 100)
      : 10;
    riskScore += Math.min(20, cancelRate);

    // Low success rate risk (0-20)
    if (successRate < 40) riskScore += 20;
    else if (successRate < 60) riskScore += 10;

    // Low demand risk (0-15)
    if (demand.searchCount < 5) riskScore += 15;
    else if (demand.searchCount < 20) riskScore += 8;

    // Determine risk level
    let riskLevel;
    if (riskScore < 30) riskLevel = 'LOW';
    else if (riskScore < 60) riskLevel = 'MEDIUM';
    else riskLevel = 'HIGH';

    // Calculate success probability
    let successProbability = 50;

    // Adjust based on historical success rate
    successProbability += (successRate - 50) * 0.3;

    // Adjust based on price advantage
    if (priceDiffPercent > 10) successProbability += 15;
    else if (priceDiffPercent > 5) successProbability += 8;
    else if (priceDiffPercent < -10) successProbability -= 15;

    // Adjust based on demand
    if (demand.searchCount > 50) successProbability += 10;
    else if (demand.searchCount < 10) successProbability -= 5;

    // Cap probability
    successProbability = Math.min(95, Math.max(20, successProbability));

    // Generate recommendation
    let recommendation, confidence;
    const reasons = [];

    if (priceDiffPercent > 10 && successRate > 60 && riskScore < 40) {
      recommendation = 'STRONG BUY';
      confidence = 85;
      reasons.push(`Price ${priceDiffPercent.toFixed(1)}% below historical average`);
      reasons.push(`High success rate (${successRate.toFixed(0)}%)`);
      reasons.push('Low risk profile');
    } else if (priceDiffPercent > 0 && successRate > 50 && riskScore < 60) {
      recommendation = 'BUY';
      confidence = 70;
      if (priceDiffPercent > 0) reasons.push(`Price ${priceDiffPercent.toFixed(1)}% below average`);
      reasons.push(`Good success rate (${successRate.toFixed(0)}%)`);
    } else if (successRate > 40 && riskScore < 70) {
      recommendation = 'CONSIDER';
      confidence = 50;
      reasons.push('Moderate opportunity');
      if (priceDiffPercent < 0) reasons.push(`Price ${Math.abs(priceDiffPercent).toFixed(1)}% above average`);
    } else {
      recommendation = 'PASS';
      confidence = 30;
      if (successRate < 40) reasons.push(`Low success rate (${successRate.toFixed(0)}%)`);
      if (riskScore >= 70) reasons.push('High risk');
      if (priceDiffPercent < -10) reasons.push('Price too high vs historical');
    }

    return {
      historicalAvgPrice: Math.round(historicalAvgPrice),
      priceDiffPercent: Math.round(priceDiffPercent * 10) / 10,
      successRate: Math.round(successRate),
      historicalMargin: Math.round(historicalMargin),
      suggestedSellPrice,
      expectedMargin: Math.round(expectedMargin),
      successProbability: Math.round(successProbability),
      riskScore: Math.round(riskScore),
      riskLevel,
      recommendation,
      confidence,
      reasons,
      dataPoints: {
        bookings: hist.totalDeals || 0,
        cancellations: cancel.totalCancellations || 0,
        searches: demand.searchCount || 0,
        daysBeforeArrival
      }
    };
  }

  /**
   * Scan multiple cities for opportunities
   */
  async scanAllCities(params) {
    const {
      cities,
      dateFrom,
      dateTo,
      minMargin = 10,
      maxRisk = 60,
      limitPerCity = 10
    } = params;

    const allOpportunities = [];
    const cityResults = [];

    for (const city of cities) {
      const result = await this.findOpportunities({
        city,
        dateFrom,
        dateTo,
        minMargin,
        maxRisk,
        limit: limitPerCity
      });

      cityResults.push({
        city,
        found: result.opportunitiesFound || 0,
        analyzed: result.totalAnalyzed || 0
      });

      if (result.success && result.opportunities) {
        allOpportunities.push(...result.opportunities);
      }
    }

    // Sort all by expected margin
    allOpportunities.sort((a, b) => b.expectedMargin - a.expectedMargin);

    return {
      success: true,
      citiesScanned: cities.length,
      totalOpportunities: allOpportunities.length,
      cityBreakdown: cityResults,
      topOpportunities: allOpportunities.slice(0, 50)
    };
  }

  /**
   * Get top cities to scan based on historical performance
   */
  async getTopCitiesToScan(limit = 10) {
    try {
      const pool = await sql.connect(dbConfig);

      const result = await pool.request()
        .input('limit', sql.Int, limit)
        .query(`
          SELECT TOP (@limit)
            h.City,
            COUNT(DISTINCT h.HotelId) as hotelCount,
            COUNT(b.BookID) as totalBookings,
            SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as soldCount,
            AVG(CASE WHEN b.IsSold = 1 THEN ((b.PushPrice - b.BuyPrice) / NULLIF(b.BuyPrice, 0) * 100) ELSE 0 END) as avgMargin,
            CAST(SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as FLOAT) / NULLIF(COUNT(b.BookID), 0) * 100 as successRate
          FROM Med_Hotels h
          JOIN MED_Book b ON h.HotelId = b.HotelId
          WHERE b.DateInsert >= DATEADD(month, -3, GETDATE())
            AND h.City IS NOT NULL
            AND h.City != ''
          GROUP BY h.City
          HAVING COUNT(b.BookID) >= 10
          ORDER BY
            CAST(SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as FLOAT) / NULLIF(COUNT(b.BookID), 0) DESC,
            AVG(CASE WHEN b.IsSold = 1 THEN ((b.PushPrice - b.BuyPrice) / NULLIF(b.BuyPrice, 0) * 100) ELSE 0 END) DESC
        `);

      return result.recordset.map(r => ({
        city: r.City,
        hotelCount: r.hotelCount,
        totalBookings: r.totalBookings,
        successRate: Math.round(r.successRate || 0),
        avgMargin: Math.round(r.avgMargin || 0)
      }));

    } catch (error) {
      logger.error('[OpportunityFinder] Error getting top cities:', error);
      return [];
    }
  }
}

module.exports = new OpportunityFinderService();
