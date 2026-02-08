/**
 * ML Prediction Service
 * Analyzes historical data to predict success probability for hotel room trading
 *
 * Verified Tables Used:
 * 1. MED_Book - Confirmed bookings (columns: id, HotelId, price, lastPrice, IsSold, IsActive, Status, DateInsert, startDate, endDate)
 * 2. Med_Hotels - Hotel data (columns: HotelId, name, countryId, BoardId, CategoryId, isActive)
 * 3. MED_Opportunities - Buy opportunities (columns: OpportunityId, DestinationsId, Price, PushPrice, DateForm, DateTo)
 * 4. MED_CancelBook - Cancellation records
 */

const sql = require('mssql');
const dbConfig = require('../config/database');
const logger = require('../config/logger');

class MLPredictionService {

  /**
   * Calculate success probability for a hotel opportunity
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

      // 2. Overall booking statistics (since City column doesn't exist)
      const overallStats = await pool.request()
        .query(`
          SELECT
            COUNT(*) as totalDeals,
            SUM(CASE WHEN IsSold = 1 THEN 1 ELSE 0 END) as successfulSales,
            AVG(CASE WHEN IsSold = 1 THEN ((lastPrice - price) / NULLIF(price, 0) * 100) ELSE 0 END) as avgMargin
          FROM MED_Book
          WHERE DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 3. MED_Opportunities - Conversion rate
      const opportunityStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalOpportunities,
            SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as converted,
            AVG(Price) as avgOppPrice
          FROM [MED_ֹOֹֹpportunities]
          WHERE DestinationsId = @hotelId
            AND DateCreate >= DATEADD(month, -6, GETDATE())
        `);

      // 4. MED_CancelBook - Cancellation rate (join through MED_Book)
      const cancelStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT COUNT(*) as totalCancellations
          FROM MED_CancelBook c
          JOIN MED_Book b ON c.contentBookingID = b.contentBookingID
          WHERE b.HotelId = @hotelId
            AND c.DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 5. Timing statistics
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

      // Calculate metrics
      const hotel = hotelStats.recordset[0] || {};
      const overall = overallStats.recordset[0] || {};
      const opp = opportunityStats.recordset[0] || {};
      const cancel = cancelStats.recordset[0] || {};
      const timing = timingStats.recordset[0] || {};

      // Hotel success rate (weight: 30%)
      const hotelSuccessRate = hotel.totalDeals > 0
        ? (hotel.successfulSales / hotel.totalDeals)
        : 0.5;

      // Overall success rate (weight: 20%)
      const overallSuccessRate = overall.totalDeals > 0
        ? (overall.successfulSales / overall.totalDeals)
        : 0.5;

      // Opportunity conversion rate (weight: 20%)
      const oppConversionRate = opp.totalOpportunities > 0
        ? (opp.converted / opp.totalOpportunities)
        : 0.5;

      // Cancellation factor (weight: 15%)
      const cancellationFactor = hotel.totalDeals > 0
        ? Math.max(0.3, 1 - (cancel.totalCancellations / hotel.totalDeals))
        : 0.8;

      // Timing success rate (weight: 10%)
      const timingSuccessRate = timing.totalDeals > 0
        ? (timing.successfulSales / timing.totalDeals)
        : 0.5;

      // Days before arrival factor (weight: 5%)
      const daysFactor = Math.min(1, daysBeforeArrival / 30);

      // Weighted probability
      const baseProbability = (
        hotelSuccessRate * 0.30 +
        overallSuccessRate * 0.20 +
        oppConversionRate * 0.20 +
        cancellationFactor * 0.15 +
        timingSuccessRate * 0.10 +
        daysFactor * 0.05
      );

      const adjustedProbability = Math.min(0.95, Math.max(0.15, baseProbability));

      return {
        successProbability: Math.round(adjustedProbability * 100),
        hotelSuccessRate: Math.round(hotelSuccessRate * 100),
        overallSuccessRate: Math.round(overallSuccessRate * 100),
        oppConversionRate: Math.round(oppConversionRate * 100),
        timingSuccessRate: Math.round(timingSuccessRate * 100),
        dataSources: {
          bookings: hotel.totalDeals || 0,
          opportunities: opp.totalOpportunities || 0,
          cancellations: cancel.totalCancellations || 0
        },
        factors: {
          hotelDeals: hotel.totalDeals || 0,
          hotelWins: hotel.successfulSales || 0,
          avgProfit: hotel.avgProfit || 0,
          avgMargin: hotel.avgMargin || 0,
          priceVolatility: hotel.priceVolatility || 0,
          daysBeforeArrival
        }
      };
    } catch (error) {
      logger.error('Error calculating success probability:', error);
      return {
        successProbability: 50,
        hotelSuccessRate: 50,
        overallSuccessRate: 50,
        timingSuccessRate: 50,
        error: error.message
      };
    }
  }

  /**
   * Determine risk level based on multiple factors
   */
  async assessRisk(hotelId, city, price, daysBeforeArrival, targetMargin) {
    try {
      const pool = await sql.connect(dbConfig);

      // 1. MED_Book - Price volatility
      const volatility = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            STDEV(price) / NULLIF(AVG(price), 0) * 100 as priceVolatilityPct,
            AVG(price) as avgPrice,
            MIN(price) as minPrice,
            MAX(price) as maxPrice
          FROM MED_Book
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -3, GETDATE())
        `);

      // 2. MED_CancelBook - Cancellation analysis (join through MED_Book)
      const cancelDetails = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT COUNT(*) as totalCancellations
          FROM MED_CancelBook c
          JOIN MED_Book b ON c.contentBookingID = b.contentBookingID
          WHERE b.HotelId = @hotelId
            AND c.DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 3. MED_Opportunities - Failure rate
      const oppFailures = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalOpportunities,
            SUM(CASE WHEN IsSale = 0 AND IsActive = 0 THEN 1 ELSE 0 END) as failedOpportunities
          FROM [MED_ֹOֹֹpportunities]
          WHERE DestinationsId = @hotelId
            AND DateCreate >= DATEADD(month, -3, GETDATE())
        `);

      // 4. MED_Book - Overall stats for this hotel
      const bookStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT COUNT(*) as totalDeals
          FROM MED_Book
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      const vol = volatility.recordset[0] || {};
      const cancel = cancelDetails.recordset[0] || {};
      const opp = oppFailures.recordset[0] || {};
      const book = bookStats.recordset[0] || {};

      // Risk score calculation (0-100)
      let riskScore = 0;

      // 1. Price volatility risk (0-25)
      const volPct = vol.priceVolatilityPct || 0;
      riskScore += Math.min(25, volPct * 1.5);

      // 2. Cancellation risk (0-20)
      const cancelRate = book.totalDeals > 0
        ? (cancel.totalCancellations / book.totalDeals) * 100
        : 0;
      riskScore += Math.min(20, cancelRate);

      // 3. Opportunity failure risk (0-15)
      const oppFailureRate = opp.totalOpportunities > 0
        ? (opp.failedOpportunities / opp.totalOpportunities) * 15
        : 5;
      riskScore += Math.min(15, oppFailureRate);

      // 4. Days before arrival risk (0-20)
      if (daysBeforeArrival < 7) riskScore += 20;
      else if (daysBeforeArrival < 14) riskScore += 12;
      else if (daysBeforeArrival < 30) riskScore += 5;

      // 5. Target margin risk (0-20)
      if (targetMargin > 30) riskScore += 20;
      else if (targetMargin > 20) riskScore += 10;
      else if (targetMargin > 15) riskScore += 5;

      // Determine risk level
      let riskLevel, riskColor, riskDescription;

      if (riskScore < 30) {
        riskLevel = 'LOW';
        riskColor = '#22c55e';
        riskDescription = 'Low risk - Good historical performance and stable pricing';
      } else if (riskScore < 60) {
        riskLevel = 'MEDIUM';
        riskColor = '#f59e0b';
        riskDescription = 'Medium risk - Some volatility or timing concerns';
      } else {
        riskLevel = 'HIGH';
        riskColor = '#ef4444';
        riskDescription = 'High risk - High volatility, short timeline, or aggressive margin';
      }

      return {
        riskLevel,
        riskScore: Math.round(riskScore),
        riskColor,
        riskDescription,
        dataSources: {
          bookings: book.totalDeals || 0,
          cancellations: cancel.totalCancellations || 0,
          opportunities: opp.totalOpportunities || 0
        },
        factors: {
          priceVolatility: (volPct || 0).toFixed(1),
          cancellationRate: cancelRate.toFixed(1),
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
        .query(`
          SELECT
            DATEDIFF(day, DateInsert, startDate) as daysBeforeArrival,
            AVG(price) as avgPrice,
            MIN(price) as minPrice,
            MAX(price) as maxPrice,
            COUNT(*) as dataPoints
          FROM MED_Book
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(year, -1, GETDATE())
            AND DATEDIFF(day, DateInsert, startDate) BETWEEN 0 AND 365
          GROUP BY DATEDIFF(day, DateInsert, startDate)
          HAVING COUNT(*) >= 2
          ORDER BY daysBeforeArrival ASC
        `);

      // Aggregate into meaningful buckets
      const buckets = [
        { min: 0, max: 7, label: '0-7 days' },
        { min: 8, max: 14, label: '8-14 days' },
        { min: 15, max: 30, label: '15-30 days' },
        { min: 31, max: 60, label: '31-60 days' },
        { min: 61, max: 90, label: '61-90 days' },
        { min: 91, max: 180, label: '91-180 days' }
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

        if (pctChange > 10) trend = 'DECREASING';
        else if (pctChange < -10) trend = 'INCREASING';
      }

      return {
        trend,
        trendData,
        chartData: result.recordset.map(r => ({
          x: r.daysBeforeArrival,
          y: r.avgPrice
        })),
        recommendation: this.getTrendRecommendation(trend)
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

  getTrendRecommendation(trend) {
    if (trend === 'DECREASING') {
      return 'Prices typically drop closer to check-in. Consider buying earlier for better margins.';
    } else if (trend === 'INCREASING') {
      return 'Prices tend to rise closer to check-in. Last-minute deals may have lower margins.';
    }
    return 'Prices are relatively stable. Focus on market demand and availability.';
  }

  /**
   * Get comprehensive analysis for a city (simplified - no city column in hotels)
   */
  async getCityAnalysis(city) {
    try {
      const pool = await sql.connect(dbConfig);

      // Get overall booking performance
      const result = await pool.request()
        .query(`
          SELECT
            COUNT(*) as totalBookings,
            SUM(CASE WHEN IsSold = 1 THEN 1 ELSE 0 END) as soldCount,
            AVG(price) as avgBuyPrice,
            AVG(lastPrice) as avgSellPrice,
            AVG(CASE WHEN IsSold = 1 THEN lastPrice - price ELSE 0 END) as avgProfit,
            AVG(CASE WHEN IsSold = 1 THEN ((lastPrice - price) / NULLIF(price, 0) * 100) ELSE 0 END) as avgMargin
          FROM MED_Book
          WHERE DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // Get hotel count
      const hotelCount = await pool.request()
        .query(`SELECT COUNT(*) as hotelCount FROM Med_Hotels WHERE isActive = 1`);

      // Get opportunity stats
      const oppStats = await pool.request()
        .query(`
          SELECT
            COUNT(*) as totalOpportunities,
            SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as convertedOpportunities
          FROM [MED_ֹOֹֹpportunities]
          WHERE DateCreate >= DATEADD(month, -3, GETDATE())
        `);

      const data = result.recordset[0] || {};
      const hotels = hotelCount.recordset[0] || {};
      const opp = oppStats.recordset[0] || {};

      const successRate = data.totalBookings > 0
        ? (data.soldCount / data.totalBookings * 100)
        : 0;

      const oppConversionRate = opp.totalOpportunities > 0
        ? (opp.convertedOpportunities / opp.totalOpportunities * 100)
        : 0;

      let trend = 'STABLE';
      if (oppConversionRate > 60) trend = 'UP';
      else if (oppConversionRate < 30) trend = 'DOWN';

      return {
        city: city || 'All',
        hotelCount: hotels.hotelCount || 0,
        totalBookings: data.totalBookings || 0,
        totalOpportunities: opp.totalOpportunities || 0,
        successRate: Math.round(successRate),
        oppConversionRate: Math.round(oppConversionRate),
        avgBuyPrice: Math.round(data.avgBuyPrice || 0),
        avgSellPrice: Math.round(data.avgSellPrice || 0),
        avgProfit: Math.round(data.avgProfit || 0),
        avgMargin: Math.round(data.avgMargin || 0),
        trend,
        recommendation: this.getCityRecommendation(successRate, data.avgMargin)
      };
    } catch (error) {
      logger.error('Error getting city analysis:', error);
      return {
        city: city || 'All',
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
   */
  async getHotelAnalysis(hotelId) {
    try {
      const pool = await sql.connect(dbConfig);

      // 1. Hotel info + booking performance
      const result = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            h.HotelId,
            h.name as hotelName,
            COUNT(b.id) as totalBookings,
            SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as soldCount,
            AVG(b.price) as avgBuyPrice,
            AVG(b.lastPrice) as avgSellPrice,
            AVG(CASE WHEN b.IsSold = 1 THEN b.lastPrice - b.price ELSE 0 END) as avgProfit,
            AVG(CASE WHEN b.IsSold = 1 THEN ((b.lastPrice - b.price) / NULLIF(b.price, 0) * 100) ELSE 0 END) as avgMargin,
            MIN(b.price) as minPrice,
            MAX(b.price) as maxPrice,
            STDEV(b.price) as priceStdDev
          FROM Med_Hotels h
          LEFT JOIN MED_Book b ON h.HotelId = b.HotelId
            AND b.DateInsert >= DATEADD(month, -6, GETDATE())
          WHERE h.HotelId = @hotelId
          GROUP BY h.HotelId, h.name
        `);

      // 2. MED_Opportunities - Opportunity volume
      const oppStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT
            COUNT(*) as totalOpportunities,
            SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as convertedOpportunities,
            SUM(CASE WHEN IsSale = 0 AND IsActive = 0 THEN 1 ELSE 0 END) as failedOpportunities
          FROM [MED_ֹOֹֹpportunities]
          WHERE DestinationsId = @hotelId
            AND DateCreate >= DATEADD(month, -6, GETDATE())
        `);

      // 3. MED_CancelBook - Cancellation stats (join through MED_Book)
      const cancelStats = await pool.request()
        .input('hotelId', sql.Int, hotelId)
        .query(`
          SELECT COUNT(*) as totalCancellations
          FROM MED_CancelBook c
          JOIN MED_Book b ON c.contentBookingID = b.contentBookingID
          WHERE b.HotelId = @hotelId
            AND c.DateInsert >= DATEADD(month, -6, GETDATE())
        `);

      // 4. Monthly performance trend
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
      const cancelData = cancelStats.recordset[0] || {};

      const successRate = hotelData.totalBookings > 0
        ? (hotelData.soldCount / hotelData.totalBookings * 100)
        : 0;

      const oppConversionRate = oppData.totalOpportunities > 0
        ? (oppData.convertedOpportunities / oppData.totalOpportunities * 100)
        : 0;

      // Calculate risk level
      let riskLevel = 'MEDIUM';
      const volatility = hotelData.priceStdDev || 0;
      const cancelRate = hotelData.totalBookings > 0
        ? (cancelData.totalCancellations / hotelData.totalBookings * 100)
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
        // Booking Performance
        totalBookings: hotelData.totalBookings || 0,
        successRate: Math.round(successRate),
        avgBuyPrice: Math.round(hotelData.avgBuyPrice || 0),
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
        // Cancellation metrics
        cancellations: {
          total: cancelData.totalCancellations || 0
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
          cancellations: cancelData.totalCancellations || 0
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
