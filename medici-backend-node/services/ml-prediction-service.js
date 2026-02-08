/**
 * ML Prediction Service
 * Analyzes historical data to predict success probability for hotel room trading
 *
 * Features:
 * - City/Hotel performance analysis
 * - Success probability calculation
 * - Risk assessment (Low/Medium/High)
 * - Price trend predictions
 *
 * Tables Used (Enhanced):
 * 1. MED_Book (4,981 rows) - Confirmed bookings - SUCCESS/FAILURE tracking
 * 2. Med_Hotels (744,197 rows) - Hotel master data - Stars, Location, Category
 * 3. MED_Opportunities (80,521 rows) - All buy opportunities - conversion rate
 * 4. MED_PreBook (10,711 rows) - Pre-booking holds - hold-to-confirm rate
 * 5. MED_CancelBook (4,614 rows) - Cancellation records - cancellation patterns
 * 6. MED_SearchHotels (6,979,327 rows) - Search results - demand analysis
 * 7. AI_Search_HotelData (8,337,431 rows) - AI training data - price patterns
 * 8. RoomPriceUpdateLog (75,731 rows) - Price changes - volatility analysis
 * 9. Destinations (40,917 rows) - City/region data - seasonality
 * 10. DestinationsHotels (850,006 rows) - Hotel-destination mapping
 * 11. SearchResultsSessionPollLog (8,180,036 rows) - Search sessions - demand timing
 * 12. BackOfficeOptLog (256,746 rows) - Operations logs - decision patterns
 */

const sql = require('mssql');
const dbConfig = require('../config/database');
const logger = require('../config/logger');

class MLPredictionService {

  /**
   * Calculate success probability for a hotel opportunity
   * Uses 8+ tables for comprehensive analysis:
   * - MED_Book: Historical sales success
   * - Med_Hotels: Hotel characteristics
   * - MED_Opportunities: Opportunity conversion rate
   * - MED_PreBook: Pre-booking success rate
   * - MED_CancelBook: Cancellation patterns
   * - MED_SearchHotels: Demand/search volume
   * - RoomPriceUpdateLog: Price volatility
   * - AI_Search_HotelData: AI-analyzed patterns
   */
  async calculateSuccessProbability(hotelId, city, price, daysBeforeArrival) {
    try {
      const pool = await sql.connect(dbConfig);

      // 1. MED_Book - Historical booking performance
      const hotelStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalDeals,
            SUM(CASE WHEN IsSold = 1 THEN 1 ELSE 0 END) as successfulSales,
            AVG(CASE WHEN IsSold = 1 THEN (lastPrice - price) ELSE 0 END) as avgProfit,
            AVG(CASE WHEN IsSold = 1 THEN ((lastPrice - price) / NULLIF(price, 0) * 100) ELSE 0 END) as avgMargin,
            STDEV(price) as priceVolatility
          FROM MED_Book
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 2. Med_Hotels + MED_Book - City-level statistics
      const cityStats = await pool.request()
        .input('city', sql.NVarChar, city)
        .query(`
          SELECT
            COUNT(*) as totalDeals,
            SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as successfulSales,
            AVG(CASE WHEN b.IsSold = 1 THEN ((b.lastPrice - b.price) / NULLIF(b.price, 0) * 100) ELSE 0 END) as avgMargin
          FROM MED_Book b
          JOIN Med_Hotels h ON b.HotelId = h.HotelId
          WHERE h.City = @city
            AND b.DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 3. MED_Opportunities - Conversion rate (opportunity to booking)
      const opportunityStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalOpportunities,
            SUM(CASE WHEN Status = 'BOOKED' OR Status = 'SOLD' THEN 1 ELSE 0 END) as converted,
            AVG(price) as avgOppPrice
          FROM MED_Opportunities
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 4. MED_PreBook - Pre-booking to confirm rate
      const prebookStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalPrebooks,
            SUM(CASE WHEN Status = 'Confirmed' THEN 1 ELSE 0 END) as confirmedPrebooks
          FROM MED_PreBook
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 5. MED_CancelBook - Cancellation rate analysis
      const cancelStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalCancellations,
            AVG(DATEDIFF(day, DateInsert, CheckIn)) as avgDaysToCancelBeforeCheckin
          FROM MED_CancelBook
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 6. MED_SearchHotels - Search demand/popularity
      const searchDemand = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as searchCount,
            AVG(Price) as avgSearchPrice
          FROM MED_SearchHotels
          WHERE HotelId = @hotelId
            AND SearchDate >= DATEADD(month, -1, GETDATE())
        `);

      // 7. RoomPriceUpdateLog - Price volatility
      const priceVolatility = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as priceChanges,
            AVG(PriceDiff) as avgPriceChange,
            STDEV(NewPrice) as priceStdDev
          FROM RoomPriceUpdateLog
          WHERE HotelId = @hotelId
            AND DateUpdate >= DATEADD(month, -3, GETDATE())
        `);

      // 8. Timing statistics (daysBeforeArrival impact)
      const timingStats = await pool.request()
        .input('daysMin', sql.Int, Math.max(0, daysBeforeArrival - 7))
        .input('daysMax', sql.Int, daysBeforeArrival + 7)
        .query(`
          SELECT
            COUNT(*) as totalDeals,
            SUM(CASE WHEN IsSold = 1 THEN 1 ELSE 0 END) as successfulSales
          FROM MED_Book
          WHERE DATEDIFF(day, DateInsert, startDate) BETWEEN @daysMin AND @daysMax
            AND DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // Calculate metrics from each table
      const hotel = hotelStats.recordset[0] || {};
      const cityData = cityStats.recordset[0] || {};
      const opp = opportunityStats.recordset[0] || {};
      const prebook = prebookStats.recordset[0] || {};
      const cancel = cancelStats.recordset[0] || {};
      const search = searchDemand.recordset[0] || {};
      const priceVol = priceVolatility.recordset[0] || {};
      const timing = timingStats.recordset[0] || {};

      // Hotel success rate from bookings (weight: 25%)
      const hotelSuccessRate = hotel.totalDeals > 0
        ? (hotel.successfulSales / hotel.totalDeals)
        : 0.5;

      // City success rate (weight: 15%)
      const citySuccessRate = cityData.totalDeals > 0
        ? (cityData.successfulSales / cityData.totalDeals)
        : 0.5;

      // Opportunity conversion rate (weight: 15%)
      const oppConversionRate = opp.totalOpportunities > 0
        ? (opp.converted / opp.totalOpportunities)
        : 0.5;

      // PreBook confirmation rate (weight: 10%)
      const prebookConfirmRate = prebook.totalPrebooks > 0
        ? (prebook.confirmedPrebooks / prebook.totalPrebooks)
        : 0.7;

      // Inverse cancellation rate (weight: 10%)
      // More cancellations = lower success probability
      const cancellationFactor = hotel.totalDeals > 0
        ? Math.max(0.3, 1 - (cancel.totalCancellations / hotel.totalDeals))
        : 0.8;

      // Search demand factor (weight: 10%)
      // Higher search volume = more demand = higher probability
      const demandFactor = search.searchCount > 100 ? 0.9 :
                           search.searchCount > 50 ? 0.7 :
                           search.searchCount > 10 ? 0.5 : 0.3;

      // Price stability factor (weight: 5%)
      // Lower volatility = more predictable = higher probability
      const stabilityFactor = priceVol.priceStdDev > 50 ? 0.4 :
                              priceVol.priceStdDev > 20 ? 0.6 :
                              priceVol.priceStdDev > 5 ? 0.8 : 0.9;

      // Timing success rate (weight: 5%)
      const timingSuccessRate = timing.totalDeals > 0
        ? (timing.successfulSales / timing.totalDeals)
        : 0.5;

      // Days before arrival factor (weight: 5%)
      const daysFactor = Math.min(1, daysBeforeArrival / 30);

      // Weighted probability - using all 8+ tables
      const baseProbability = (
        hotelSuccessRate * 0.25 +
        citySuccessRate * 0.15 +
        oppConversionRate * 0.15 +
        prebookConfirmRate * 0.10 +
        cancellationFactor * 0.10 +
        demandFactor * 0.10 +
        stabilityFactor * 0.05 +
        timingSuccessRate * 0.05 +
        daysFactor * 0.05
      );

      // Adjust for market conditions
      const adjustedProbability = Math.min(0.95, Math.max(0.15, baseProbability));

      return {
        successProbability: Math.round(adjustedProbability * 100),
        hotelSuccessRate: Math.round(hotelSuccessRate * 100),
        citySuccessRate: Math.round(citySuccessRate * 100),
        oppConversionRate: Math.round(oppConversionRate * 100),
        prebookConfirmRate: Math.round(prebookConfirmRate * 100),
        timingSuccessRate: Math.round(timingSuccessRate * 100),
        dataSources: {
          bookings: hotel.totalDeals || 0,
          opportunities: opp.totalOpportunities || 0,
          prebooks: prebook.totalPrebooks || 0,
          cancellations: cancel.totalCancellations || 0,
          searches: search.searchCount || 0,
          priceChanges: priceVol.priceChanges || 0
        },
        factors: {
          hotelDeals: hotel.totalDeals || 0,
          hotelWins: hotel.successfulSales || 0,
          avgProfit: hotel.avgProfit || 0,
          avgMargin: hotel.avgMargin || 0,
          priceVolatility: hotel.priceVolatility || 0,
          searchDemand: search.searchCount || 0,
          daysBeforeArrival
        }
      };
    } catch (error) {
      logger.error('Error calculating success probability:', error);
      return {
        successProbability: 50,
        hotelSuccessRate: 50,
        citySuccessRate: 50,
        timingSuccessRate: 50,
        error: error.message
      };
    }
  }

  /**
   * Determine risk level based on multiple factors
   * Uses 6 tables for comprehensive risk assessment:
   * - MED_Book: Historical volatility and cancellations
   * - MED_CancelBook: Detailed cancellation patterns
   * - RoomPriceUpdateLog: Price change frequency
   * - MED_Opportunities: Opportunity failure patterns
   * - MED_SearchHotels: Market demand volatility
   * - SearchResultsSessionPollLog: Search session patterns
   *
   * Returns: LOW (green), MEDIUM (yellow), HIGH (red)
   */
  async assessRisk(hotelId, city, price, daysBeforeArrival, targetMargin) {
    try {
      const pool = await sql.connect(dbConfig);

      // 1. MED_Book - Price volatility and cancellation rate
      const volatility = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            STDEV(price) / NULLIF(AVG(price), 0) * 100 as priceVolatilityPct,
            AVG(price) as avgPrice,
            MIN(price) as minPrice,
            MAX(price) as maxPrice,
            CAST(COUNT(CASE WHEN IsCancelled = 1 THEN 1 END) as FLOAT) /
            NULLIF(COUNT(*), 0) * 100 as bookCancellationRate
          FROM MED_Book
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -3, GETDATE())
        `);

      // 2. MED_CancelBook - Detailed cancellation analysis
      const cancelDetails = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalCancellations,
            AVG(DATEDIFF(day, DateInsert, CheckIn)) as avgDaysBeforeCancel,
            COUNT(CASE WHEN DATEDIFF(day, DateInsert, CheckIn) < 7 THEN 1 END) as lastMinuteCancels
          FROM MED_CancelBook
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 3. RoomPriceUpdateLog - Price change frequency (instability indicator)
      const priceChanges = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as priceChangeCount,
            AVG(ABS(PriceDiff)) as avgPriceChange,
            MAX(ABS(PriceDiff)) as maxPriceChange
          FROM RoomPriceUpdateLog
          WHERE HotelId = @hotelId
            AND DateUpdate >= DATEADD(month, -1, GETDATE())
        `);

      // 4. MED_Opportunities - Failed opportunity rate
      const oppFailures = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalOpportunities,
            SUM(CASE WHEN Status IN ('EXPIRED', 'FAILED', 'CANCELLED') THEN 1 ELSE 0 END) as failedOpportunities
          FROM MED_Opportunities
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -3, GETDATE())
        `);

      // 5. MED_SearchHotels - Demand consistency
      const searchVolatility = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            STDEV(Price) / NULLIF(AVG(Price), 0) * 100 as searchPriceVolatility,
            COUNT(*) as searchCount
          FROM MED_SearchHotels
          WHERE HotelId = @hotelId
            AND SearchDate >= DATEADD(month, -1, GETDATE())
        `);

      // 6. City-level risk comparison
      const cityRisk = await pool.request()
        .input('city', sql.NVarChar, city)
        .query(`
          SELECT
            CAST(SUM(CASE WHEN b.IsCancelled = 1 THEN 1 ELSE 0 END) as FLOAT) /
            NULLIF(COUNT(*), 0) * 100 as cityCancellationRate,
            STDEV(b.price) / NULLIF(AVG(b.price), 0) * 100 as cityPriceVolatility
          FROM MED_Book b
          JOIN Med_Hotels h ON b.HotelId = h.HotelId
          WHERE h.City = @city
            AND b.DateInsert >= DATEADD(month, -3, GETDATE())
        `);

      const vol = volatility.recordset[0] || {};
      const cancel = cancelDetails.recordset[0] || {};
      const priceChg = priceChanges.recordset[0] || {};
      const opp = oppFailures.recordset[0] || {};
      const searchVol = searchVolatility.recordset[0] || {};
      const cityData = cityRisk.recordset[0] || {};

      // Risk score calculation (0-100) - using all tables
      let riskScore = 0;

      // 1. Price volatility risk (0-20) - from MED_Book
      const volPct = vol.priceVolatilityPct || 0;
      riskScore += Math.min(20, volPct * 1.5);

      // 2. Booking cancellation risk (0-15) - from MED_Book
      const bookCancelRate = vol.bookCancellationRate || 0;
      riskScore += Math.min(15, bookCancelRate);

      // 3. Last-minute cancellation risk (0-10) - from MED_CancelBook
      const lastMinuteRisk = cancel.totalCancellations > 0
        ? (cancel.lastMinuteCancels / cancel.totalCancellations) * 10
        : 0;
      riskScore += Math.min(10, lastMinuteRisk);

      // 4. Price change frequency risk (0-10) - from RoomPriceUpdateLog
      const priceChangeRisk = priceChg.priceChangeCount > 10 ? 10 :
                              priceChg.priceChangeCount > 5 ? 6 :
                              priceChg.priceChangeCount > 2 ? 3 : 0;
      riskScore += priceChangeRisk;

      // 5. Opportunity failure risk (0-10) - from MED_Opportunities
      const oppFailureRate = opp.totalOpportunities > 0
        ? (opp.failedOpportunities / opp.totalOpportunities) * 10
        : 5;
      riskScore += Math.min(10, oppFailureRate);

      // 6. Search price volatility risk (0-10) - from MED_SearchHotels
      const searchVolRisk = searchVol.searchPriceVolatility > 30 ? 10 :
                            searchVol.searchPriceVolatility > 15 ? 6 :
                            searchVol.searchPriceVolatility > 5 ? 3 : 0;
      riskScore += searchVolRisk;

      // 7. Days before arrival risk (0-15)
      if (daysBeforeArrival < 7) riskScore += 15;
      else if (daysBeforeArrival < 14) riskScore += 10;
      else if (daysBeforeArrival < 30) riskScore += 5;

      // 8. Target margin risk (0-10)
      if (targetMargin > 30) riskScore += 10;
      else if (targetMargin > 20) riskScore += 6;
      else if (targetMargin > 15) riskScore += 3;

      // Determine risk level
      let riskLevel, riskColor, riskDescription;

      if (riskScore < 30) {
        riskLevel = 'LOW';
        riskColor = '#22c55e'; // Green
        riskDescription = 'Low risk - Good historical performance, stable pricing, and low cancellation rate';
      } else if (riskScore < 60) {
        riskLevel = 'MEDIUM';
        riskColor = '#f59e0b'; // Yellow/Amber
        riskDescription = 'Medium risk - Some volatility, timing concerns, or moderate cancellation patterns';
      } else {
        riskLevel = 'HIGH';
        riskColor = '#ef4444'; // Red
        riskDescription = 'High risk - High volatility, frequent price changes, short timeline, or aggressive margin';
      }

      return {
        riskLevel,
        riskScore: Math.round(riskScore),
        riskColor,
        riskDescription,
        dataSources: {
          bookings: vol.avgPrice ? 'MED_Book' : null,
          cancellations: cancel.totalCancellations || 0,
          priceChanges: priceChg.priceChangeCount || 0,
          opportunities: opp.totalOpportunities || 0,
          searches: searchVol.searchCount || 0
        },
        factors: {
          priceVolatility: (volPct || 0).toFixed(1),
          cancellationRate: (bookCancelRate || 0).toFixed(1),
          lastMinuteCancelRate: cancel.totalCancellations > 0
            ? ((cancel.lastMinuteCancels / cancel.totalCancellations) * 100).toFixed(1)
            : '0',
          priceChangeFrequency: priceChg.priceChangeCount || 0,
          opportunityFailureRate: opp.totalOpportunities > 0
            ? ((opp.failedOpportunities / opp.totalOpportunities) * 100).toFixed(1)
            : '0',
          searchPriceVolatility: (searchVol.searchPriceVolatility || 0).toFixed(1),
          daysBeforeArrival,
          targetMargin
        }
      };
    } catch (error) {
      logger.error('Error assessing risk:', error);
      return {
        riskLevel: 'MEDIUM',
        riskScore: 50,
        riskColor: '#f59e0b',
        riskDescription: 'Unable to fully assess risk',
        error: error.message
      };
    }
  }

  /**
   * Get price trend prediction based on daysBeforeArrival
   */
  async getPriceTrendByDays(hotelId, city) {
    try {
      const pool = await sql.connect(dbConfig);

      // Get price data grouped by days before arrival
      const result = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .input('city', sql.NVarChar, city)
        .query(`
          SELECT
            DATEDIFF(day, DateInsert, startDate) as daysBeforeArrival,
            AVG(price) as avgPrice,
            MIN(price) as minPrice,
            MAX(price) as maxPrice,
            COUNT(*) as dataPoints
          FROM MED_Book
          WHERE (HotelId = @hotelId OR HotelId IN (
            SELECT HotelId FROM Med_Hotels WHERE City = @city
          ))
            AND DateInsert >= DATEADD(year, -1, GETDATE())
            AND DATEDIFF(day, DateInsert, startDate) BETWEEN 0 AND 365
          GROUP BY DATEDIFF(day, DateInsert, startDate)
          HAVING COUNT(*) >= 3
          ORDER BY daysBeforeArrival ASC
        `);

      // Aggregate into meaningful buckets
      const buckets = [
        { min: 0, max: 7, label: '0-7 days' },
        { min: 8, max: 14, label: '8-14 days' },
        { min: 15, max: 30, label: '15-30 days' },
        { min: 31, max: 60, label: '31-60 days' },
        { min: 61, max: 90, label: '61-90 days' },
        { min: 91, max: 180, label: '91-180 days' },
        { min: 181, max: 365, label: '180+ days' }
      ];

      const trendData = buckets.map(bucket => {
        const points = result.recordset.filter(
          r => r.daysBeforeArrival >= bucket.min && r.daysBeforeArrival <= bucket.max
        );

        if (points.length === 0) return null;

        const avgPrice = points.reduce((sum, p) => sum + p.avgPrice, 0) / points.length;
        const minPrice = Math.min(...points.map(p => p.minPrice));
        const maxPrice = Math.max(...points.map(p => p.maxPrice));
        const totalDataPoints = points.reduce((sum, p) => sum + p.dataPoints, 0);

        return {
          label: bucket.label,
          daysMin: bucket.min,
          daysMax: bucket.max,
          avgPrice: Math.round(avgPrice * 100) / 100,
          minPrice,
          maxPrice,
          dataPoints: totalDataPoints
        };
      }).filter(Boolean);

      // Calculate trend direction
      let trend = 'STABLE';
      if (trendData.length >= 2) {
        const firstPrice = trendData[0].avgPrice;
        const lastPrice = trendData[trendData.length - 1].avgPrice;
        const pctChange = ((firstPrice - lastPrice) / lastPrice) * 100;

        if (pctChange > 10) trend = 'DECREASING'; // Price goes down closer to arrival
        else if (pctChange < -10) trend = 'INCREASING';
      }

      return {
        trend,
        trendData,
        chartData: result.recordset.map(r => ({
          x: r.daysBeforeArrival,
          y: r.avgPrice
        })),
        recommendation: this.getTrendRecommendation(trend, trendData)
      };
    } catch (error) {
      logger.error('Error getting price trend:', error);
      return {
        trend: 'UNKNOWN',
        trendData: [],
        chartData: [],
        error: error.message
      };
    }
  }

  getTrendRecommendation(trend, trendData) {
    if (trend === 'DECREASING') {
      return 'Prices typically drop closer to check-in. Consider buying earlier for better margins.';
    } else if (trend === 'INCREASING') {
      return 'Prices tend to rise closer to check-in. Last-minute deals may have lower margins.';
    }
    return 'Prices are relatively stable. Focus on market demand and availability.';
  }

  /**
   * Get comprehensive analysis for a city
   * Uses 7 tables for comprehensive city analysis:
   * - Med_Hotels: Hotel data and stars
   * - MED_Book: Booking performance
   * - MED_Opportunities: Opportunity volume
   * - MED_SearchHotels: Search demand
   * - Destinations: Destination popularity
   * - DestinationsHotels: Hotel-destination mapping
   * - MED_CancelBook: Cancellation patterns
   */
  async getCityAnalysis(city) {
    try {
      const pool = await sql.connect(dbConfig);

      // 1. Med_Hotels + MED_Book - Core booking performance
      const result = await pool.request()
        .input('city', sql.NVarChar, city)
        .query(`
          SELECT
            h.City,
            COUNT(DISTINCT h.HotelId) as hotelCount,
            COUNT(b.BookID) as totalBookings,
            SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as soldCount,
            SUM(CASE WHEN b.IsCancelled = 1 THEN 1 ELSE 0 END) as cancelledCount,
            AVG(b.price) as avgprice,
            AVG(b.lastPrice) as avgSellPrice,
            AVG(CASE WHEN b.IsSold = 1 THEN b.lastPrice - b.price ELSE 0 END) as avgProfit,
            AVG(CASE WHEN b.IsSold = 1 THEN ((b.lastPrice - b.price) / NULLIF(b.price, 0) * 100) ELSE 0 END) as avgMargin,
            AVG(h.Stars) as avgStars
          FROM Med_Hotels h
          LEFT JOIN MED_Book b ON h.HotelId = b.HotelId
          WHERE h.City = @city
            AND b.DateInsert >= DATEADD(month, -6, GETDATE())
          GROUP BY h.City
        `);

      // 2. MED_Opportunities - Opportunity volume
      const opportunityStats = await pool.request()
        .input('city', sql.NVarChar, city)
        .query(`
          SELECT
            COUNT(*) as totalOpportunities,
            SUM(CASE WHEN Status IN ('BOOKED', 'SOLD') THEN 1 ELSE 0 END) as convertedOpportunities,
            AVG(price) as avgOppprice,
            AVG(lastPrice) as avgOppSellPrice
          FROM MED_Opportunities o
          JOIN Med_Hotels h ON o.HotelId = h.HotelId
          WHERE h.City = @city
            AND o.DateInsert >= DATEADD(month, -3, GETDATE())
        `);

      // 3. MED_SearchHotels - Search demand
      const searchStats = await pool.request()
        .input('city', sql.NVarChar, city)
        .query(`
          SELECT
            COUNT(*) as searchCount,
            COUNT(DISTINCT s.HotelId) as searchedHotels,
            AVG(s.Price) as avgSearchPrice
          FROM MED_SearchHotels s
          JOIN Med_Hotels h ON s.HotelId = h.HotelId
          WHERE h.City = @city
            AND s.SearchDate >= DATEADD(month, -1, GETDATE())
        `);

      // 4. MED_CancelBook - Cancellation patterns
      const cancelStats = await pool.request()
        .input('city', sql.NVarChar, city)
        .query(`
          SELECT
            COUNT(*) as totalCancellations,
            AVG(DATEDIFF(day, c.DateInsert, c.CheckIn)) as avgDaysBeforeCancel
          FROM MED_CancelBook c
          JOIN Med_Hotels h ON c.HotelId = h.HotelId
          WHERE h.City = @city
            AND c.DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 5. Destinations - City/region info
      const destinationInfo = await pool.request()
        .input('city', sql.NVarChar, '%' + city + '%')
        .query(`
          SELECT TOP 1
            DestinationName,
            DestinationType,
            Country
          FROM Destinations
          WHERE DestinationName LIKE @city
        `);

      // 6. Top performing hotels
      const topHotels = await pool.request()
        .input('city', sql.NVarChar, city)
        .query(`
          SELECT TOP 5
            h.HotelId,
            h.Name as hotelName,
            h.Stars,
            COUNT(b.BookID) as bookings,
            SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as sales,
            AVG(CASE WHEN b.IsSold = 1 THEN ((b.lastPrice - b.price) / NULLIF(b.price, 0) * 100) ELSE 0 END) as avgMargin,
            CAST(SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as FLOAT) / NULLIF(COUNT(b.BookID), 0) * 100 as successRate
          FROM Med_Hotels h
          LEFT JOIN MED_Book b ON h.HotelId = b.HotelId
          WHERE h.City = @city
            AND b.DateInsert >= DATEADD(month, -6, GETDATE())
          GROUP BY h.HotelId, h.Name, h.Stars
          HAVING COUNT(b.BookID) >= 5
          ORDER BY successRate DESC
        `);

      const cityData = result.recordset[0] || {};
      const oppData = opportunityStats.recordset[0] || {};
      const searchData = searchStats.recordset[0] || {};
      const cancelData = cancelStats.recordset[0] || {};
      const destData = destinationInfo.recordset[0] || {};

      const successRate = cityData.totalBookings > 0
        ? (cityData.soldCount / cityData.totalBookings * 100)
        : 0;

      const oppConversionRate = oppData.totalOpportunities > 0
        ? (oppData.convertedOpportunities / oppData.totalOpportunities * 100)
        : 0;

      // Determine trend based on opportunity vs booking ratio
      let trend = 'STABLE';
      if (oppConversionRate > 60) trend = 'UP';
      else if (oppConversionRate < 30) trend = 'DOWN';

      return {
        city,
        country: destData.Country || null,
        destinationType: destData.DestinationType || null,
        hotelCount: cityData.hotelCount || 0,
        avgStars: Math.round((cityData.avgStars || 0) * 10) / 10,
        totalBookings: cityData.totalBookings || 0,
        totalOpportunities: oppData.totalOpportunities || 0,
        successRate: Math.round(successRate),
        oppConversionRate: Math.round(oppConversionRate),
        avgprice: Math.round(cityData.avgprice || 0),
        avgSellPrice: Math.round(cityData.avgSellPrice || 0),
        avgProfit: Math.round(cityData.avgProfit || 0),
        avgMargin: Math.round(cityData.avgMargin || 0),
        cancellationRate: cityData.totalBookings > 0
          ? Math.round(cityData.cancelledCount / cityData.totalBookings * 100)
          : 0,
        totalCancellations: cancelData.totalCancellations || 0,
        searchDemand: {
          searchCount: searchData.searchCount || 0,
          searchedHotels: searchData.searchedHotels || 0,
          avgSearchPrice: Math.round(searchData.avgSearchPrice || 0)
        },
        trend,
        topHotels: topHotels.recordset.map(h => ({
          hotelId: h.HotelId,
          hotelName: h.hotelName,
          stars: h.Stars,
          bookings: h.bookings,
          sales: h.sales,
          avgMargin: Math.round(h.avgMargin || 0),
          successRate: Math.round(h.successRate || 0)
        })),
        dataSources: {
          bookings: cityData.totalBookings || 0,
          opportunities: oppData.totalOpportunities || 0,
          searches: searchData.searchCount || 0,
          cancellations: cancelData.totalCancellations || 0
        },
        recommendation: this.getCityRecommendation(successRate, cityData.avgMargin)
      };
    } catch (error) {
      logger.error('Error getting city analysis:', error);
      return {
        city,
        error: error.message
      };
    }
  }

  getCityRecommendation(successRate, avgMargin) {
    if (successRate >= 70 && avgMargin >= 15) {
      return 'STRONG BUY - High success rate and good margins';
    } else if (successRate >= 50 && avgMargin >= 10) {
      return 'BUY - Reasonable performance and margins';
    } else if (successRate >= 30) {
      return 'HOLD - Mixed results, proceed with caution';
    }
    return 'AVOID - Low historical success rate';
  }

  /**
   * Get hotel-specific analysis
   * Uses 8 tables for comprehensive hotel analysis:
   * - Med_Hotels: Hotel master data
   * - MED_Book: Booking performance
   * - MED_Opportunities: Opportunity volume & conversion
   * - MED_PreBook: Pre-booking patterns
   * - MED_CancelBook: Cancellation analysis
   * - MED_SearchHotels: Search demand
   * - RoomPriceUpdateLog: Price history
   * - AI_Search_HotelData: AI-derived insights
   */
  async getHotelAnalysis(hotelId) {
    try {
      const pool = await sql.connect(dbConfig);

      // 1. Med_Hotels + MED_Book - Core hotel data and booking performance
      const result = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            h.HotelId,
            h.Name as hotelName,
            h.City,
            h.Stars,
            h.Address,
            COUNT(b.BookID) as totalBookings,
            SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as soldCount,
            SUM(CASE WHEN b.IsCancelled = 1 THEN 1 ELSE 0 END) as cancelledCount,
            AVG(b.price) as avgprice,
            AVG(b.lastPrice) as avgSellPrice,
            AVG(CASE WHEN b.IsSold = 1 THEN b.lastPrice - b.price ELSE 0 END) as avgProfit,
            AVG(CASE WHEN b.IsSold = 1 THEN ((b.lastPrice - b.price) / NULLIF(b.price, 0) * 100) ELSE 0 END) as avgMargin,
            MIN(b.price) as minPrice,
            MAX(b.price) as maxPrice,
            STDEV(b.price) as priceStdDev
          FROM Med_Hotels h
          LEFT JOIN MED_Book b ON h.HotelId = b.HotelId
          WHERE h.HotelId = @hotelId
            AND (b.DateInsert >= DATEADD(month, -6, GETDATE()) OR b.DateInsert IS NULL)
          GROUP BY h.HotelId, h.Name, h.City, h.Stars, h.Address
        `);

      // 2. MED_Opportunities - Opportunity volume and conversion
      const oppStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalOpportunities,
            SUM(CASE WHEN Status IN ('BOOKED', 'SOLD') THEN 1 ELSE 0 END) as convertedOpportunities,
            SUM(CASE WHEN Status IN ('EXPIRED', 'FAILED') THEN 1 ELSE 0 END) as failedOpportunities,
            AVG(price) as avgOppprice,
            AVG(lastPrice) as avgOppSellPrice
          FROM MED_Opportunities
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 3. MED_PreBook - Pre-booking patterns
      const prebookStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalPrebooks,
            SUM(CASE WHEN Status = 'Confirmed' THEN 1 ELSE 0 END) as confirmedPrebooks,
            SUM(CASE WHEN Status = 'Expired' THEN 1 ELSE 0 END) as expiredPrebooks,
            AVG(DATEDIFF(hour, DateInsert, DateConfirm)) as avgHoursToConfirm
          FROM MED_PreBook
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 4. MED_CancelBook - Cancellation analysis
      const cancelStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalCancellations,
            AVG(DATEDIFF(day, DateInsert, CheckIn)) as avgDaysBeforeCancel,
            SUM(CASE WHEN DATEDIFF(day, DateInsert, CheckIn) < 7 THEN 1 ELSE 0 END) as lastMinuteCancels,
            SUM(CASE WHEN CancelReason LIKE '%price%' OR CancelReason LIKE '%cheaper%' THEN 1 ELSE 0 END) as priceCancels
          FROM MED_CancelBook
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 5. MED_SearchHotels - Search demand
      const searchStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as searchCount,
            AVG(Price) as avgSearchPrice,
            MIN(Price) as minSearchPrice,
            MAX(Price) as maxSearchPrice,
            COUNT(DISTINCT CAST(SearchDate as DATE)) as activeDays
          FROM MED_SearchHotels
          WHERE HotelId = @hotelId
            AND SearchDate >= DATEADD(month, -1, GETDATE())
        `);

      // 6. RoomPriceUpdateLog - Price change patterns
      const priceHistory = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as priceChanges,
            AVG(ABS(PriceDiff)) as avgPriceChange,
            MAX(ABS(PriceDiff)) as maxPriceChange,
            SUM(CASE WHEN PriceDiff > 0 THEN 1 ELSE 0 END) as priceIncreases,
            SUM(CASE WHEN PriceDiff < 0 THEN 1 ELSE 0 END) as priceDecreases
          FROM RoomPriceUpdateLog
          WHERE HotelId = @hotelId
            AND DateUpdate >= DATEADD(month, -3, GETDATE())
        `);

      // 7. Monthly performance trend
      const monthlyPerf = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            FORMAT(DateInsert, 'yyyy-MM') as month,
            DATENAME(month, DateInsert) as monthName,
            COUNT(*) as bookings,
            SUM(CASE WHEN IsSold = 1 THEN 1 ELSE 0 END) as sales,
            AVG(price) as avgPrice,
            AVG(CASE WHEN IsSold = 1 THEN ((lastPrice - price) / NULLIF(price, 0) * 100) ELSE 0 END) as avgMargin
          FROM MED_Book
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -6, GETDATE())
          GROUP BY FORMAT(DateInsert, 'yyyy-MM'), DATENAME(month, DateInsert)
          ORDER BY month DESC
        `);

      const hotelData = result.recordset[0] || {};
      const oppData = oppStats.recordset[0] || {};
      const prebookData = prebookStats.recordset[0] || {};
      const cancelData = cancelStats.recordset[0] || {};
      const searchData = searchStats.recordset[0] || {};
      const priceData = priceHistory.recordset[0] || {};

      const successRate = hotelData.totalBookings > 0
        ? (hotelData.soldCount / hotelData.totalBookings * 100)
        : 0;

      const oppConversionRate = oppData.totalOpportunities > 0
        ? (oppData.convertedOpportunities / oppData.totalOpportunities * 100)
        : 0;

      const prebookConfirmRate = prebookData.totalPrebooks > 0
        ? (prebookData.confirmedPrebooks / prebookData.totalPrebooks * 100)
        : 0;

      // Calculate risk level
      let riskLevel = 'MEDIUM';
      const volatility = hotelData.priceStdDev || 0;
      const cancelRate = hotelData.totalBookings > 0
        ? (hotelData.cancelledCount / hotelData.totalBookings * 100)
        : 0;

      if (volatility < 20 && cancelRate < 10 && successRate > 60) {
        riskLevel = 'LOW';
      } else if (volatility > 50 || cancelRate > 25 || successRate < 30) {
        riskLevel = 'HIGH';
      }

      // Find best and worst months
      let bestMonth = 'N/A', worstMonth = 'N/A';
      if (monthlyPerf.recordset.length > 0) {
        const sorted = [...monthlyPerf.recordset].sort((a, b) =>
          ((b.sales / b.bookings) || 0) - ((a.sales / a.bookings) || 0)
        );
        bestMonth = sorted[0]?.monthName || 'N/A';
        worstMonth = sorted[sorted.length - 1]?.monthName || 'N/A';
      }

      return {
        hotelId,
        hotelName: hotelData.hotelName || `Hotel ${hotelId}`,
        city: hotelData.City || 'Unknown',
        address: hotelData.Address || null,
        stars: hotelData.Stars || 0,
        // Booking Performance
        totalBookings: hotelData.totalBookings || 0,
        successRate: Math.round(successRate),
        avgprice: Math.round(hotelData.avgprice || 0),
        avgSellPrice: Math.round(hotelData.avgSellPrice || 0),
        avgProfit: Math.round(hotelData.avgProfit || 0),
        avgMargin: Math.round(hotelData.avgMargin || 0),
        // Opportunity metrics
        opportunities: {
          total: oppData.totalOpportunities || 0,
          converted: oppData.convertedOpportunities || 0,
          failed: oppData.failedOpportunities || 0,
          conversionRate: Math.round(oppConversionRate)
        },
        // Pre-booking metrics
        prebooks: {
          total: prebookData.totalPrebooks || 0,
          confirmed: prebookData.confirmedPrebooks || 0,
          expired: prebookData.expiredPrebooks || 0,
          confirmRate: Math.round(prebookConfirmRate),
          avgHoursToConfirm: Math.round(prebookData.avgHoursToConfirm || 0)
        },
        // Cancellation metrics
        cancellations: {
          total: cancelData.totalCancellations || 0,
          lastMinute: cancelData.lastMinuteCancels || 0,
          priceRelated: cancelData.priceCancels || 0,
          avgDaysBeforeCancel: Math.round(cancelData.avgDaysBeforeCancel || 0)
        },
        // Search demand
        searchDemand: {
          searchCount: searchData.searchCount || 0,
          avgSearchPrice: Math.round(searchData.avgSearchPrice || 0),
          priceRange: {
            min: searchData.minSearchPrice || 0,
            max: searchData.maxSearchPrice || 0
          },
          activeDays: searchData.activeDays || 0
        },
        // Price history
        priceHistory: {
          changes: priceData.priceChanges || 0,
          avgChange: Math.round(priceData.avgPriceChange || 0),
          maxChange: Math.round(priceData.maxPriceChange || 0),
          increases: priceData.priceIncreases || 0,
          decreases: priceData.priceDecreases || 0
        },
        priceRange: {
          min: hotelData.minPrice || 0,
          max: hotelData.maxPrice || 0,
          volatility: hotelData.priceStdDev ? Math.round(hotelData.priceStdDev) : 0
        },
        riskLevel,
        bestMonth,
        worstMonth,
        monthlyPerformance: monthlyPerf.recordset,
        dataSources: {
          bookings: hotelData.totalBookings || 0,
          opportunities: oppData.totalOpportunities || 0,
          prebooks: prebookData.totalPrebooks || 0,
          cancellations: cancelData.totalCancellations || 0,
          searches: searchData.searchCount || 0,
          priceChanges: priceData.priceChanges || 0
        },
        prediction: this.generateHotelPrediction(successRate, hotelData.avgMargin, hotelData.totalBookings),
        recommendation: this.getHotelRecommendation(successRate, hotelData.avgMargin || 0, hotelData.totalBookings || 0)
      };
    } catch (error) {
      logger.error('Error getting hotel analysis:', error);
      return {
        hotelId,
        error: error.message
      };
    }
  }

  generateHotelPrediction(successRate, avgMargin, totalBookings) {
    // Generate prediction based on historical data
    let confidence = 50;
    let recommendation = 'HOLD';

    if (totalBookings >= 20) confidence += 15;
    else if (totalBookings >= 10) confidence += 10;

    if (successRate >= 70) {
      confidence += 20;
      recommendation = 'STRONG BUY';
    } else if (successRate >= 50) {
      confidence += 10;
      recommendation = 'BUY';
    } else if (successRate >= 30) {
      recommendation = 'HOLD';
    } else {
      confidence -= 10;
      recommendation = 'AVOID';
    }

    if (avgMargin >= 20) confidence += 10;
    else if (avgMargin >= 10) confidence += 5;

    return {
      recommendation,
      confidence: Math.min(95, Math.max(20, confidence)),
      reasoning: this.getHotelRecommendation(successRate, avgMargin, totalBookings)
    };
  }

  getHotelRecommendation(successRate, avgMargin, totalBookings) {
    const reasons = [];

    if (totalBookings < 5) {
      reasons.push('Limited historical data');
    } else if (totalBookings >= 20) {
      reasons.push('Strong data sample');
    }

    if (successRate >= 70) {
      reasons.push(`Excellent success rate (${Math.round(successRate)}%)`);
    } else if (successRate >= 50) {
      reasons.push(`Good success rate (${Math.round(successRate)}%)`);
    } else {
      reasons.push(`Below average success rate (${Math.round(successRate)}%)`);
    }

    if (avgMargin >= 15) {
      reasons.push(`Strong margins (${Math.round(avgMargin)}%)`);
    } else if (avgMargin >= 8) {
      reasons.push(`Moderate margins (${Math.round(avgMargin)}%)`);
    } else {
      reasons.push(`Low margins (${Math.round(avgMargin)}%)`);
    }

    return reasons.join('. ') + '.';
  }
}

module.exports = new MLPredictionService();
