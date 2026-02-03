/**
 * Analytics API Routes
 * 
 * Provides endpoints for:
 * - Price trends and history
 * - Search patterns and demand analysis
 * - Competitor price comparisons
 * - Performance metrics
 * - Forecasting data
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const logger = require('../config/logger');

/**
 * GET /analytics/price-trends
 * Get price trends for a hotel over time
 */
router.get('/price-trends', async (req, res) => {
  try {
    const { hotelId, days = 30, dateFrom, dateTo } = req.query;
    
    if (!hotelId) {
      return res.status(400).json({ error: 'hotelId parameter required' });
    }
    
    const pool = await getPool();
    
    const result = await pool.request()
      .input('hotelId', hotelId)
      .input('days', days)
      .input('dateFrom', dateFrom || null)
      .input('dateTo', dateTo || null)
      .query(`
        SELECT 
          DateFrom,
          DateTo,
          SnapshotDate,
          BuyPrice,
          SellPrice,
          MarketPrice,
          CompetitorMinPrice,
          CompetitorMaxPrice,
          (SellPrice - BuyPrice) as GrossProfit,
          CASE 
            WHEN BuyPrice > 0 
            THEN ((SellPrice - BuyPrice) / BuyPrice * 100)
            ELSE 0 
          END as ProfitMarginPercent,
          AvailableRooms,
          Source
        FROM V_PriceTrends
        WHERE HotelId = @hotelId
        AND (
          (@dateFrom IS NULL AND @dateTo IS NULL AND SnapshotDate >= DATEADD(DAY, -@days, GETDATE()))
          OR (DateFrom >= @dateFrom AND DateTo <= @dateTo)
        )
        ORDER BY DateFrom, SnapshotDate
      `);
    
    res.json({
      success: true,
      hotelId: parseInt(hotelId),
      period: dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : `Last ${days} days`,
      dataPoints: result.recordset.length,
      trends: result.recordset
    });
    
  } catch (error) {
    logger.error('[Analytics] Price trends error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /analytics/price-changes
 * Get recent significant price changes
 */
router.get('/price-changes', async (req, res) => {
  try {
    const { hours = 24, minChangePercent = 5 } = req.query;
    
    const pool = await getPool();
    
    const result = await pool.request()
      .input('hours', hours)
      .input('minChange', minChangePercent)
      .query(`
        WITH LatestSnapshots AS (
          SELECT 
            OpportunityId,
            HotelId,
            DateFrom,
            BuyPrice,
            SellPrice,
            MarketPrice,
            SnapshotDate,
            ROW_NUMBER() OVER (PARTITION BY OpportunityId ORDER BY SnapshotDate DESC) as rn
          FROM MED_PriceHistory
          WHERE SnapshotDate >= DATEADD(HOUR, -@hours, GETDATE())
        ),
        PreviousSnapshots AS (
          SELECT 
            OpportunityId,
            BuyPrice as PrevBuyPrice,
            SellPrice as PrevSellPrice,
            MarketPrice as PrevMarketPrice
          FROM LatestSnapshots
          WHERE rn = 2
        )
        SELECT 
          l.OpportunityId,
          h.name as HotelName,
          l.DateFrom as CheckIn,
          l.BuyPrice,
          p.PrevBuyPrice,
          l.SellPrice,
          p.PrevSellPrice,
          (l.SellPrice - ISNULL(p.PrevSellPrice, l.SellPrice)) as SellPriceChange,
          CASE 
            WHEN ISNULL(p.PrevSellPrice, l.SellPrice) > 0
            THEN ((l.SellPrice - ISNULL(p.PrevSellPrice, l.SellPrice)) / p.PrevSellPrice * 100)
            ELSE 0
          END as SellPriceChangePercent,
          l.SnapshotDate
        FROM LatestSnapshots l
        LEFT JOIN PreviousSnapshots p ON l.OpportunityId = p.OpportunityId
        INNER JOIN Med_Hotels h ON l.HotelId = h.HotelId
        WHERE l.rn = 1
        AND ABS(
          CASE 
            WHEN ISNULL(p.PrevSellPrice, l.SellPrice) > 0
            THEN ((l.SellPrice - ISNULL(p.PrevSellPrice, l.SellPrice)) / p.PrevSellPrice * 100)
            ELSE 0
          END
        ) >= @minChange
        ORDER BY ABS(l.SellPrice - ISNULL(p.PrevSellPrice, l.SellPrice)) DESC
      `);
    
    res.json({
      success: true,
      period: `Last ${hours} hours`,
      minChangePercent: parseFloat(minChangePercent),
      changes: result.recordset
    });
    
  } catch (error) {
    logger.error('[Analytics] Price changes error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /analytics/search-demand
 * Get search demand patterns
 */
router.get('/search-demand', async (req, res) => {
  try {
    const { hotelId, destination, days = 30 } = req.query;
    
    const pool = await getPool();
    
    const result = await pool.request()
      .input('hotelId', hotelId || null)
      .input('destination', destination || null)
      .input('days', days)
      .query(`
        SELECT 
          CheckInDate,
          DayOfWeek,
          Month,
          HotelId,
          HotelName,
          Destination,
          SearchCount,
          BookingCount,
          ConversionRate,
          AvgLeadTime,
          AvgLOS,
          AvgSearchPrice,
          LowestPriceFound,
          HighestPriceFound
        FROM V_SearchDemand
        WHERE 1=1
        ${hotelId ? 'AND HotelId = @hotelId' : ''}
        ${destination ? 'AND Destination LIKE @destination' : ''}
        ORDER BY SearchCount DESC
      `);
    
    res.json({
      success: true,
      filters: {
        hotelId: hotelId ? parseInt(hotelId) : 'all',
        destination: destination || 'all',
        days: parseInt(days)
      },
      patterns: result.recordset
    });
    
  } catch (error) {
    logger.error('[Analytics] Search demand error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /analytics/competitor-comparison
 * Compare our prices with competitors
 */
router.get('/competitor-comparison', async (req, res) => {
  try {
    const { hotelId, days = 7 } = req.query;
    
    if (!hotelId) {
      return res.status(400).json({ error: 'hotelId parameter required' });
    }
    
    const pool = await getPool();
    
    const result = await pool.request()
      .input('hotelId', hotelId)
      .input('days', days)
      .query(`
        SELECT 
          HotelId,
          HotelName,
          CheckIn,
          CheckOut,
          CompetitorName,
          CompetitorPrice,
          OurPrice,
          OurCost,
          OurProfit,
          PriceDifference,
          PricePositionPercent,
          CompetitorAvailable,
          WeAreActive,
          ScrapedAt
        FROM V_CompetitorComparison
        WHERE HotelId = @hotelId
        AND ScrapedAt >= DATEADD(DAY, -@days, GETDATE())
        ORDER BY CheckIn, CompetitorName
      `);
    
    // Calculate summary statistics
    const summary = {
      totalComparisons: result.recordset.length,
      avgPriceDifference: 0,
      timesMoreExpensive: 0,
      timesCheaper: 0,
      competitors: []
    };
    
    if (result.recordset.length > 0) {
      summary.avgPriceDifference = result.recordset.reduce((sum, r) => sum + (r.PriceDifference || 0), 0) / result.recordset.length;
      summary.timesMoreExpensive = result.recordset.filter(r => r.PriceDifference > 0).length;
      summary.timesCheaper = result.recordset.filter(r => r.PriceDifference < 0).length;
      
      // Group by competitor
      const competitorMap = {};
      result.recordset.forEach(r => {
        if (!competitorMap[r.CompetitorName]) {
          competitorMap[r.CompetitorName] = {
            name: r.CompetitorName,
            comparisons: 0,
            avgPriceDiff: 0,
            moreExpensiveThanUs: 0,
            cheaperThanUs: 0
          };
        }
        competitorMap[r.CompetitorName].comparisons++;
        competitorMap[r.CompetitorName].avgPriceDiff += r.PriceDifference || 0;
        if (r.PriceDifference > 0) competitorMap[r.CompetitorName].cheaperThanUs++;
        if (r.PriceDifference < 0) competitorMap[r.CompetitorName].moreExpensiveThanUs++;
      });
      
      summary.competitors = Object.values(competitorMap).map(c => ({
        ...c,
        avgPriceDiff: c.avgPriceDiff / c.comparisons
      }));
    }
    
    res.json({
      success: true,
      hotelId: parseInt(hotelId),
      period: `Last ${days} days`,
      summary,
      comparisons: result.recordset
    });
    
  } catch (error) {
    logger.error('[Analytics] Competitor comparison error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /analytics/performance
 * Get performance metrics
 */
router.get('/performance', async (req, res) => {
  try {
    const { days = 7, granularity = 'daily' } = req.query;
    
    const pool = await getPool();
    
    // Daily or hourly granularity
    const groupBy = granularity === 'hourly' 
      ? 'MetricDate, MetricHour' 
      : 'MetricDate';
    
    const result = await pool.request()
      .input('days', days)
      .query(`
        SELECT 
          MetricDate,
          ${granularity === 'hourly' ? 'MetricHour,' : ''}
          ${granularity === 'hourly' ? '' : 'SUM('}ActiveOpportunities${granularity === 'hourly' ? '' : ') as ActiveOpportunities'},
          ${granularity === 'hourly' ? '' : 'SUM('}NewOpportunities${granularity === 'hourly' ? '' : ') as NewOpportunities'},
          ${granularity === 'hourly' ? '' : 'SUM('}SoldOpportunities${granularity === 'hourly' ? '' : ') as SoldOpportunities'},
          SellThroughRate,
          ${granularity === 'hourly' ? '' : 'SUM('}TotalRevenue${granularity === 'hourly' ? '' : ') as TotalRevenue'},
          ${granularity === 'hourly' ? '' : 'SUM('}TotalCost${granularity === 'hourly' ? '' : ') as TotalCost'},
          ${granularity === 'hourly' ? '' : 'SUM('}GrossProfit${granularity === 'hourly' ? '' : ') as GrossProfit'},
          ${granularity === 'hourly' ? '' : 'AVG('}ProfitMargin${granularity === 'hourly' ? '' : ') as ProfitMargin'},
          ${granularity === 'hourly' ? '' : 'AVG('}PushSuccessRate${granularity === 'hourly' ? '' : ') as PushSuccessRate'},
          ${granularity === 'hourly' ? '' : 'AVG('}BuyroomSuccessRate${granularity === 'hourly' ? '' : ') as BuyroomSuccessRate'},
          ${granularity === 'hourly' ? '' : 'SUM('}BuyroomSuccesses${granularity === 'hourly' ? '' : ') as BuyroomSuccesses'},
          ${granularity === 'hourly' ? '' : 'SUM('}BuyroomFailures${granularity === 'hourly' ? '' : ') as BuyroomFailures'},
          ${granularity === 'hourly' ? '' : 'SUM('}AutoCancellations${granularity === 'hourly' ? '' : ') as AutoCancellations'}
        FROM V_PerformanceDashboard
        WHERE MetricDate >= DATEADD(DAY, -@days, GETDATE())
        ${granularity === 'daily' ? 'GROUP BY MetricDate' : ''}
        ORDER BY MetricDate ${granularity === 'hourly' ? ', MetricHour' : ''}
      `);
    
    // Calculate totals
    const totals = {
      totalRevenue: result.recordset.reduce((sum, r) => sum + (r.TotalRevenue || 0), 0),
      totalCost: result.recordset.reduce((sum, r) => sum + (r.TotalCost || 0), 0),
      totalProfit: result.recordset.reduce((sum, r) => sum + (r.GrossProfit || 0), 0),
      totalSold: result.recordset.reduce((sum, r) => sum + (r.SoldOpportunities || 0), 0),
      totalCancelled: result.recordset.reduce((sum, r) => sum + (r.AutoCancellations || 0), 0)
    };
    
    totals.avgProfitMargin = totals.totalRevenue > 0 
      ? (totals.totalProfit / totals.totalRevenue * 100).toFixed(2)
      : 0;
    
    res.json({
      success: true,
      period: `Last ${days} days`,
      granularity,
      totals,
      metrics: result.recordset
    });
    
  } catch (error) {
    logger.error('[Analytics] Performance metrics error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /analytics/forecasting-data
 * Get data prepared for ML forecasting models
 */
router.get('/forecasting-data', async (req, res) => {
  try {
    const { hotelId, days = 90 } = req.query;
    
    if (!hotelId) {
      return res.status(400).json({ error: 'hotelId parameter required' });
    }
    
    const pool = await getPool();
    
    // Get historical data with features for ML
    const result = await pool.request()
      .input('hotelId', hotelId)
      .input('days', days)
      .query(`
        WITH PriceData AS (
          SELECT 
            DateFrom,
            DateTo,
            DATEDIFF(DAY, DateFrom, DateTo) as LOS,
            DATEPART(WEEKDAY, DateFrom) as DayOfWeek,
            DATEPART(MONTH, DateFrom) as Month,
            DATEPART(WEEK, DateFrom) as WeekOfYear,
            DATEDIFF(DAY, GETDATE(), DateFrom) as LeadTime,
            BuyPrice,
            SellPrice,
            MarketPrice,
            CompetitorMinPrice,
            (SellPrice - BuyPrice) as Profit,
            AvailableRooms,
            SnapshotDate
          FROM MED_PriceHistory
          WHERE HotelId = @hotelId
          AND SnapshotDate >= DATEADD(DAY, -@days, GETDATE())
        ),
        SearchData AS (
          SELECT 
            CheckInDate,
            SUM(SearchCount) as TotalSearches,
            AVG(ConversionRate) as AvgConversionRate,
            AVG(AvgLeadTime) as AvgSearchLeadTime
          FROM V_SearchDemand
          WHERE HotelId = @hotelId
          GROUP BY CheckInDate
        )
        SELECT 
          p.*,
          ISNULL(s.TotalSearches, 0) as SearchVolume,
          ISNULL(s.AvgConversionRate, 0) as ConversionRate,
          ISNULL(s.AvgSearchLeadTime, 0) as AvgSearchLeadTime
        FROM PriceData p
        LEFT JOIN SearchData s ON p.DateFrom = s.CheckInDate
        ORDER BY p.DateFrom, p.SnapshotDate
      `);
    
    res.json({
      success: true,
      hotelId: parseInt(hotelId),
      period: `Last ${days} days`,
      dataPoints: result.recordset.length,
      features: [
        'DateFrom', 'LOS', 'DayOfWeek', 'Month', 'WeekOfYear', 'LeadTime',
        'BuyPrice', 'SellPrice', 'MarketPrice', 'CompetitorMinPrice',
        'Profit', 'AvailableRooms', 'SearchVolume', 'ConversionRate'
      ],
      data: result.recordset
    });
    
  } catch (error) {
    logger.error('[Analytics] Forecasting data error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /analytics/track-search
 * Track a search query for pattern analysis
 */
router.post('/track-search', async (req, res) => {
  try {
    const {
      hotelId,
      destination,
      checkIn,
      checkOut,
      adults = 2,
      children = 0,
      roomCategoryId,
      resultCount,
      minPrice,
      maxPrice,
      avgPrice,
      source = 'API',
      userId,
      sessionId
    } = req.body;
    
    if (!checkIn || !checkOut) {
      return res.status(400).json({ error: 'checkIn and checkOut required' });
    }
    
    const pool = await getPool();
    
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const leadTime = Math.floor((checkInDate - new Date()) / (1000 * 60 * 60 * 24));
    const los = Math.floor((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    
    await pool.request()
      .input('hotelId', hotelId || null)
      .input('destination', destination || null)
      .input('checkIn', checkIn)
      .input('checkOut', checkOut)
      .input('adults', adults)
      .input('children', children)
      .input('roomCategoryId', roomCategoryId || null)
      .input('resultCount', resultCount || null)
      .input('minPrice', minPrice || null)
      .input('maxPrice', maxPrice || null)
      .input('avgPrice', avgPrice || null)
      .input('leadTime', leadTime)
      .input('los', los)
      .input('source', source)
      .input('userId', userId || null)
      .input('sessionId', sessionId || null)
      .query(`
        INSERT INTO MED_SearchPatterns (
          HotelId, Destination, CheckIn, CheckOut, Adults, Children,
          RoomCategoryId, ResultCount, MinPrice, MaxPrice, AvgPrice,
          LeadTime, LengthOfStay, Source, UserId, SessionId, SearchDate
        )
        VALUES (
          @hotelId, @destination, @checkIn, @checkOut, @adults, @children,
          @roomCategoryId, @resultCount, @minPrice, @maxPrice, @avgPrice,
          @leadTime, @los, @source, @userId, @sessionId, GETDATE()
        )
      `);
    
    res.json({
      success: true,
      message: 'Search tracked successfully'
    });
    
  } catch (error) {
    logger.error('[Analytics] Track search error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
