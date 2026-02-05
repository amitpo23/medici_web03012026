// ========================================
// Trading Exchange Routes
// NEW - Professional trading UI API endpoints
// Treats hotel rooms as tradable financial assets
// ========================================

const express = require('express');
const router = express.Router();
const sql = require('mssql');
const dbConfig = require('../config/database');
const logger = require('../config/logger');

// ========================================
// Price History - OHLC Candlestick Data
// ========================================

/**
 * GET /api/trading-exchange/price-history/:hotelId
 * Returns OHLC candlestick data for TradingView charts
 * Timeframes: 1H, 4H, 1D, 1W
 */
router.get('/price-history/:hotelId', async (req, res) => {
  const { hotelId } = req.params;
  const { timeframe = '1D', days = 90 } = req.query;

  try {
    const pool = await sql.connect(dbConfig);

    // Get price history aggregated by timeframe
    let groupBy;
    switch (timeframe) {
      case '1H':
        groupBy = "DATEADD(hour, DATEDIFF(hour, 0, DateInsert), 0)";
        break;
      case '4H':
        groupBy = "DATEADD(hour, (DATEDIFF(hour, 0, DateInsert) / 4) * 4, 0)";
        break;
      case '1W':
        groupBy = "DATEADD(week, DATEDIFF(week, 0, DateInsert), 0)";
        break;
      default: // 1D
        groupBy = "CAST(DateInsert AS DATE)";
    }

    const result = await pool.request()
      .input('hotelId', sql.Int, parseInt(hotelId))
      .input('days', sql.Int, parseInt(days))
      .query(`
        WITH PriceData AS (
          SELECT
            ${groupBy} as period,
            price,
            lastPrice,
            ROW_NUMBER() OVER (PARTITION BY ${groupBy} ORDER BY DateInsert ASC) as rn_first,
            ROW_NUMBER() OVER (PARTITION BY ${groupBy} ORDER BY DateInsert DESC) as rn_last
          FROM MED_Book
          WHERE HotelId = @hotelId
            AND DateInsert >= DATEADD(day, -@days, GETDATE())
        )
        SELECT
          period as time,
          MIN(CASE WHEN rn_first = 1 THEN price END) as [open],
          MAX(price) as high,
          MIN(price) as low,
          MIN(CASE WHEN rn_last = 1 THEN price END) as [close],
          COUNT(*) as volume,
          AVG(lastPrice - price) as avgProfit,
          AVG((lastPrice - price) / NULLIF(lastPrice, 0) * 100) as avgMargin
        FROM PriceData
        GROUP BY period
        ORDER BY period ASC
      `);

    // Format for TradingView Lightweight Charts
    const candles = result.recordset.map(row => ({
      time: Math.floor(new Date(row.time).getTime() / 1000), // Unix timestamp
      open: row.open || 0,
      high: row.high || 0,
      low: row.low || 0,
      close: row.close || 0,
      volume: row.volume || 0,
      avgProfit: row.avgProfit || 0,
      avgMargin: row.avgMargin || 0
    }));

    // Get hotel name
    const hotelInfo = await pool.request()
      .input('hotelId', sql.Int, parseInt(hotelId))
      .query(`SELECT Name FROM Med_Hotels WHERE HotelId = @hotelId`);

    res.json({
      success: true,
      symbol: `HOTEL-${hotelId}`,
      name: hotelInfo.recordset[0]?.Name || `Hotel ${hotelId}`,
      timeframe,
      candles,
      count: candles.length
    });

    logger.info(`Price history fetched for hotel ${hotelId}, timeframe ${timeframe}`);
  } catch (error) {
    logger.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Failed to fetch price history', details: error.message });
  }
});

// ========================================
// Order Book - Buy/Sell Depth
// ========================================

/**
 * GET /api/trading-exchange/order-book/:hotelId
 * Returns aggregated bid/ask levels for order book visualization
 */
router.get('/order-book/:hotelId', async (req, res) => {
  const { hotelId } = req.params;
  const { levels = 10 } = req.query;

  try {
    const pool = await sql.connect(dbConfig);

    // BIDS: Active inventory we own (what we're selling)
    const bidsResult = await pool.request()
      .input('hotelId', sql.Int, parseInt(hotelId))
      .input('levels', sql.Int, parseInt(levels))
      .query(`
        SELECT TOP (@levels)
          ROUND(lastPrice, 0) as price,
          COUNT(*) as quantity,
          SUM(lastPrice) as totalValue
        FROM MED_Book
        WHERE HotelId = @hotelId
          AND IsActive = 1
          AND IsSold = 0
          AND startDate >= GETDATE()
        GROUP BY ROUND(lastPrice, 0)
        ORDER BY price DESC
      `);

    // ASKS: Opportunities available to buy
    const asksResult = await pool.request()
      .input('hotelId', sql.Int, parseInt(hotelId))
      .input('levels', sql.Int, parseInt(levels))
      .query(`
        SELECT TOP (@levels)
          ROUND(Price, 0) as price,
          COUNT(*) as quantity,
          SUM(Price) as totalValue
        FROM [MED_ֹOֹֹpportunities]
        WHERE DestinationsId = @hotelId
          AND IsActive = 1
          AND IsSale = 0
        GROUP BY ROUND(Price, 0)
        ORDER BY price ASC
      `);

    // Calculate cumulative totals
    let bidTotal = 0;
    const bids = bidsResult.recordset.map(row => {
      bidTotal += row.quantity;
      return {
        price: row.price,
        quantity: row.quantity,
        total: bidTotal,
        value: row.totalValue
      };
    });

    let askTotal = 0;
    const asks = asksResult.recordset.map(row => {
      askTotal += row.quantity;
      return {
        price: row.price,
        quantity: row.quantity,
        total: askTotal,
        value: row.totalValue
      };
    });

    // Calculate spread
    const bestBid = bids.length > 0 ? bids[0].price : 0;
    const bestAsk = asks.length > 0 ? asks[0].price : 0;
    const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
    const spreadPercent = bestBid > 0 ? ((spread / bestBid) * 100).toFixed(2) : 0;
    const midPrice = (bestBid + bestAsk) / 2;

    res.json({
      success: true,
      hotelId: parseInt(hotelId),
      bids,
      asks,
      summary: {
        bestBid,
        bestAsk,
        spread,
        spreadPercent: parseFloat(spreadPercent),
        midPrice,
        totalBidQuantity: bidTotal,
        totalAskQuantity: askTotal
      },
      timestamp: new Date().toISOString()
    });

    logger.info(`Order book fetched for hotel ${hotelId}`);
  } catch (error) {
    logger.error('Error fetching order book:', error);
    res.status(500).json({ error: 'Failed to fetch order book', details: error.message });
  }
});

// ========================================
// Portfolio - Holdings & P&L
// ========================================

/**
 * GET /api/trading-exchange/portfolio
 * Returns current portfolio with P&L calculations
 */
router.get('/portfolio', async (req, res) => {
  const { days = 30 } = req.query;

  try {
    const pool = await sql.connect(dbConfig);

    // Get active holdings
    const holdings = await pool.request().query(`
      SELECT
        b.id as bookingId,
        b.HotelId,
        h.Name as hotelName,
        b.price as buyPrice,
        b.lastPrice as sellPrice,
        b.lastPrice as marketPrice,
        (b.lastPrice - b.price) as unrealizedPnL,
        ((b.lastPrice - b.price) / NULLIF(b.price, 0) * 100) as unrealizedPnLPercent,
        b.startDate as checkIn,
        b.endDate as checkOut,
        DATEDIFF(day, GETDATE(), b.startDate) as daysToCheckIn,
        b.CancellationType,
        b.dateInsert as purchaseDate,
        DATEDIFF(day, b.dateInsert, GETDATE()) as holdingPeriod
      FROM MED_Book b
      JOIN Med_Hotels h ON b.HotelId = h.HotelId
      WHERE b.IsActive = 1
        AND b.IsSold = 0
        AND b.startDate >= GETDATE()
      ORDER BY b.startDate ASC
    `);

    // Get realized P&L (sold bookings)
    const realizedPnL = await pool.request()
      .input('days', sql.Int, parseInt(days))
      .query(`
        SELECT
          COUNT(*) as totalTrades,
          SUM(lastPrice - price) as totalProfit,
          AVG(lastPrice - price) as avgProfit,
          AVG((lastPrice - price) / NULLIF(price, 0) * 100) as avgMargin,
          SUM(CASE WHEN lastPrice > price THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN lastPrice <= price THEN 1 ELSE 0 END) as losses,
          MIN(lastPrice - price) as worstTrade,
          MAX(lastPrice - price) as bestTrade
        FROM MED_Book
        WHERE IsSold = 1
          AND DateInsert >= DATEADD(day, -@days, GETDATE())
      `);

    // Calculate portfolio summary
    const holdingsData = holdings.recordset;
    const realized = realizedPnL.recordset[0];

    const totalCostBasis = holdingsData.reduce((sum, h) => sum + h.buyPrice, 0);
    const totalMarketValue = holdingsData.reduce((sum, h) => sum + (h.marketPrice || h.sellPrice), 0);
    const totalUnrealizedPnL = holdingsData.reduce((sum, h) => sum + h.unrealizedPnL, 0);
    const totalRealizedPnL = realized.totalProfit || 0;

    const winRate = realized.totalTrades > 0
      ? ((realized.wins / realized.totalTrades) * 100).toFixed(2)
      : 0;

    // Group holdings by hotel
    const holdingsByHotel = holdingsData.reduce((acc, h) => {
      if (!acc[h.HotelId]) {
        acc[h.HotelId] = {
          hotelId: h.HotelId,
          hotelName: h.hotelName,
          positions: [],
          totalValue: 0,
          totalPnL: 0
        };
      }
      acc[h.HotelId].positions.push(h);
      acc[h.HotelId].totalValue += h.buyPrice;
      acc[h.HotelId].totalPnL += h.unrealizedPnL;
      return acc;
    }, {});

    res.json({
      success: true,
      portfolio: {
        holdings: holdingsData,
        holdingsByHotel: Object.values(holdingsByHotel),
        summary: {
          totalPositions: holdingsData.length,
          totalCostBasis,
          totalMarketValue,
          totalUnrealizedPnL,
          totalRealizedPnL,
          totalPnL: totalUnrealizedPnL + totalRealizedPnL,
          unrealizedPnLPercent: totalCostBasis > 0
            ? ((totalUnrealizedPnL / totalCostBasis) * 100).toFixed(2)
            : 0
        },
        performance: {
          totalTrades: realized.totalTrades || 0,
          winRate: parseFloat(winRate),
          wins: realized.wins || 0,
          losses: realized.losses || 0,
          avgProfit: realized.avgProfit || 0,
          avgMargin: realized.avgMargin || 0,
          bestTrade: realized.bestTrade || 0,
          worstTrade: realized.worstTrade || 0,
          profitFactor: realized.losses > 0 && realized.wins > 0
            ? (realized.wins * realized.avgProfit / Math.abs(realized.losses * realized.worstTrade)).toFixed(2)
            : 0
        }
      },
      timestamp: new Date().toISOString()
    });

    logger.info(`Portfolio fetched: ${holdingsData.length} holdings, ${realized.totalTrades} trades`);
  } catch (error) {
    logger.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio', details: error.message });
  }
});

// ========================================
// Market Data - Real-time Tickers
// ========================================

/**
 * GET /api/trading-exchange/market-data
 * Returns market tickers for top traded hotels
 */
router.get('/market-data', async (req, res) => {
  const { limit = 20 } = req.query;

  try {
    const pool = await sql.connect(dbConfig);

    // Get market data for most active hotels
    const result = await pool.request()
      .input('limit', sql.Int, parseInt(limit))
      .query(`
        WITH HotelStats AS (
          SELECT
            b.HotelId,
            h.Name as hotelName,
            COUNT(*) as totalTrades,
            AVG(b.price) as avgPrice,
            MIN(b.price) as minPrice,
            MAX(b.price) as maxPrice,
            AVG(b.lastPrice - b.price) as avgProfit,
            AVG((b.lastPrice - b.price) / NULLIF(b.price, 0) * 100) as avgMargin,
            SUM(CASE WHEN b.IsSold = 1 THEN 1 ELSE 0 END) as soldCount,
            SUM(CASE WHEN b.IsActive = 1 AND b.IsSold = 0 THEN 1 ELSE 0 END) as activeCount
          FROM MED_Book b
          JOIN Med_Hotels h ON b.HotelId = h.HotelId
          WHERE b.DateInsert >= DATEADD(month, -3, GETDATE())
          GROUP BY b.HotelId, h.Name
          HAVING COUNT(*) >= 3
        ),
        RecentPrices AS (
          SELECT
            HotelId,
            price as lastPrice,
            ROW_NUMBER() OVER (PARTITION BY HotelId ORDER BY DateInsert DESC) as rn
          FROM MED_Book
        ),
        PreviousPrices AS (
          SELECT
            HotelId,
            price as prevPrice,
            ROW_NUMBER() OVER (PARTITION BY HotelId ORDER BY DateInsert DESC) as rn
          FROM MED_Book
          WHERE DateInsert < DATEADD(day, -1, GETDATE())
        )
        SELECT TOP (@limit)
          hs.*,
          rp.lastPrice,
          pp.prevPrice,
          CASE
            WHEN pp.prevPrice > 0 THEN ((rp.lastPrice - pp.prevPrice) / pp.prevPrice * 100)
            ELSE 0
          END as priceChange24h
        FROM HotelStats hs
        LEFT JOIN RecentPrices rp ON hs.HotelId = rp.HotelId AND rp.rn = 1
        LEFT JOIN PreviousPrices pp ON hs.HotelId = pp.HotelId AND pp.rn = 1
        ORDER BY hs.totalTrades DESC
      `);

    // Generate trading signals based on data
    const tickers = result.recordset.map(row => ({
      symbol: `HOTEL-${row.HotelId}`,
      hotelId: row.HotelId,
      name: row.hotelName,
      price: row.lastPrice || row.avgPrice,
      change24h: row.priceChange24h || 0,
      changePercent24h: row.priceChange24h ? parseFloat(row.priceChange24h.toFixed(2)) : 0,
      high24h: row.maxPrice,
      low24h: row.minPrice,
      volume: row.totalTrades,
      avgProfit: row.avgProfit,
      avgMargin: row.avgMargin,
      activeInventory: row.activeCount,
      soldCount: row.soldCount,
      signal: determineSignal(row)
    }));

    res.json({
      success: true,
      tickers,
      count: tickers.length,
      timestamp: new Date().toISOString()
    });

    logger.info(`Market data fetched: ${tickers.length} tickers`);
  } catch (error) {
    logger.error('Error fetching market data:', error);
    res.status(500).json({ error: 'Failed to fetch market data', details: error.message });
  }
});

// ========================================
// AI Signals - Trading Recommendations
// ========================================

/**
 * GET /api/trading-exchange/ai-signals
 * Returns AI trading signals synthesized from all agents
 */
router.get('/ai-signals', async (req, res) => {
  const { minConfidence = 50, limit = 50 } = req.query;

  try {
    const pool = await sql.connect(dbConfig);

    // Get opportunities (fallback to basic opportunities if AI columns don't exist)
    let opportunities;
    try {
      // Try to get AI-generated opportunities with high confidence
      opportunities = await pool.request()
        .input('minConfidence', sql.Float, parseFloat(minConfidence) / 100)
        .input('limit', sql.Int, parseInt(limit))
        .query(`
          SELECT TOP (@limit)
            o.OpportunityId,
            o.DestinationsId as hotelId,
            h.Name as hotelName,
            o.Price as buyPrice,
            o.PushPrice as targetSellPrice,
            (o.PushPrice - o.Price) as expectedProfit,
            ((o.PushPrice - o.Price) / NULLIF(o.Price, 0) * 100) as expectedMargin,
            ((o.PushPrice - o.Price) / NULLIF(o.Price, 0) * 100) as roi,
            COALESCE(o.AIConfidence, 0.7) as confidence,
            COALESCE(o.AIPriorityScore, 50) as priorityScore,
            'MEDIUM' as riskLevel,
            o.DateForm as checkIn,
            o.DateTo as checkOut,
            DATEDIFF(day, GETDATE(), o.DateForm) as daysToCheckIn,
            o.DateCreate as signalDate,
            o.IsActive
          FROM [MED_ֹOֹֹpportunities] o
          JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
          WHERE o.IsActive = 1
            AND o.IsSale = 0
          ORDER BY o.DateCreate DESC
        `);
    } catch (aiErr) {
      // Fallback: Get regular opportunities without AI columns
      logger.warn('AI columns not available, using fallback query', { error: aiErr.message });
      opportunities = await pool.request()
        .input('limit', sql.Int, parseInt(limit))
        .query(`
          SELECT TOP (@limit)
            o.OpportunityId,
            o.DestinationsId as hotelId,
            h.Name as hotelName,
            o.Price as buyPrice,
            o.PushPrice as targetSellPrice,
            (o.PushPrice - o.Price) as expectedProfit,
            ((o.PushPrice - o.Price) / NULLIF(o.Price, 0) * 100) as expectedMargin,
            ((o.PushPrice - o.Price) / NULLIF(o.Price, 0) * 100) as roi,
            0.7 as confidence,
            50 as priorityScore,
            'MEDIUM' as riskLevel,
            o.DateForm as checkIn,
            o.DateTo as checkOut,
            DATEDIFF(day, GETDATE(), o.DateForm) as daysToCheckIn,
            o.DateCreate as signalDate,
            o.IsActive
          FROM [MED_ֹOֹֹpportunities] o
          JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
          WHERE o.IsActive = 1
            AND o.IsSale = 0
          ORDER BY o.DateCreate DESC
        `);
    }

    // Get historical performance for confidence validation
    const historicalPerf = await pool.request().query(`
      SELECT
        AVG(CASE WHEN lastPrice > price THEN 1.0 ELSE 0.0 END) as winRate,
        AVG((lastPrice - price) / NULLIF(price, 0) * 100) as avgMargin
      FROM MED_Book
      WHERE IsSold = 1
        AND DateInsert >= DATEADD(month, -3, GETDATE())
    `);

    const performance = historicalPerf.recordset[0];

    // Generate structured signals
    const signals = opportunities.recordset.map(opp => ({
      id: `SIG-${opp.OpportunityId}`,
      type: determineSignalType(opp),
      strength: opp.confidence >= 0.8 ? 'STRONG' : opp.confidence >= 0.6 ? 'MODERATE' : 'WEAK',
      asset: {
        hotelId: opp.hotelId,
        hotelName: opp.hotelName,
        checkIn: opp.checkIn,
        checkOut: opp.checkOut,
        daysToCheckIn: opp.daysToCheckIn
      },
      pricing: {
        buyPrice: opp.buyPrice,
        targetPrice: opp.targetSellPrice,
        expectedProfit: opp.expectedProfit,
        expectedMargin: opp.expectedMargin,
        roi: opp.roi
      },
      confidence: Math.round(opp.confidence * 100),
      riskLevel: opp.riskLevel || 'MEDIUM',
      priorityScore: opp.priorityScore,
      reasons: generateSignalReasons(opp, performance),
      timestamp: opp.signalDate,
      expiresIn: opp.daysToCheckIn > 7 ? '7d' : `${opp.daysToCheckIn}d`,
      action: {
        primary: 'BUY',
        opportunityId: opp.OpportunityId
      }
    }));

    // Get consensus from agents
    const buySignals = signals.filter(s => s.type === 'BUY').length;
    const totalSignals = signals.length;
    const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length || 0;

    res.json({
      success: true,
      signals,
      consensus: {
        direction: buySignals > totalSignals / 2 ? 'BULLISH' : 'NEUTRAL',
        buySignals,
        totalSignals,
        avgConfidence: Math.round(avgConfidence),
        marketCondition: avgConfidence > 70 ? 'FAVORABLE' : avgConfidence > 50 ? 'NORMAL' : 'CAUTIOUS'
      },
      historicalPerformance: {
        winRate: (performance.winRate * 100).toFixed(1),
        avgMargin: performance.avgMargin?.toFixed(1)
      },
      timestamp: new Date().toISOString()
    });

    logger.info(`AI signals fetched: ${signals.length} signals, avg confidence ${avgConfidence.toFixed(0)}%`);
  } catch (error) {
    logger.error('Error fetching AI signals:', error);
    res.status(500).json({ error: 'Failed to fetch AI signals', details: error.message });
  }
});

// ========================================
// Performance Metrics
// ========================================

/**
 * GET /api/trading-exchange/performance-metrics
 * Returns trading performance analytics
 */
router.get('/performance-metrics', async (req, res) => {
  const { days = 30 } = req.query;

  try {
    const pool = await sql.connect(dbConfig);

    // Overall performance
    const overall = await pool.request()
      .input('days', sql.Int, parseInt(days))
      .query(`
        SELECT
          COUNT(*) as totalTrades,
          SUM(CASE WHEN IsSold = 1 THEN 1 ELSE 0 END) as soldTrades,
          SUM(CASE WHEN IsActive = 1 AND IsSold = 0 THEN 1 ELSE 0 END) as activeTrades,
          SUM(price) as totalInvested,
          SUM(CASE WHEN IsSold = 1 THEN lastPrice ELSE 0 END) as totalRevenue,
          SUM(CASE WHEN IsSold = 1 THEN lastPrice - price ELSE 0 END) as realizedProfit,
          SUM(CASE WHEN IsActive = 1 AND IsSold = 0 THEN lastPrice - price ELSE 0 END) as unrealizedProfit,
          AVG(CASE WHEN IsSold = 1 THEN lastPrice - price ELSE NULL END) as avgProfit,
          AVG(CASE WHEN IsSold = 1 THEN (lastPrice - price) / NULLIF(price, 0) * 100 ELSE NULL END) as avgROI,
          SUM(CASE WHEN IsSold = 1 AND lastPrice > price THEN 1 ELSE 0 END) as winningTrades,
          SUM(CASE WHEN IsSold = 1 AND lastPrice <= price THEN 1 ELSE 0 END) as losingTrades
        FROM MED_Book
        WHERE DateInsert >= DATEADD(day, -@days, GETDATE())
      `);

    // Daily P&L for chart
    const dailyPnL = await pool.request()
      .input('days', sql.Int, parseInt(days))
      .query(`
        SELECT
          CAST(DateInsert AS DATE) as date,
          SUM(lastPrice - price) as dailyProfit,
          COUNT(*) as trades,
          SUM(CASE WHEN lastPrice > price THEN 1 ELSE 0 END) as wins
        FROM MED_Book
        WHERE IsSold = 1
          AND DateInsert >= DATEADD(day, -@days, GETDATE())
        GROUP BY CAST(DateInsert AS DATE)
        ORDER BY date ASC
      `);

    // Performance by risk level
    const byRisk = await pool.request()
      .input('days', sql.Int, parseInt(days))
      .query(`
        SELECT
          CASE
            WHEN (lastPrice - price) / NULLIF(price, 0) * 100 < 15 THEN 'LOW'
            WHEN (lastPrice - price) / NULLIF(price, 0) * 100 < 30 THEN 'MEDIUM'
            ELSE 'HIGH'
          END as riskLevel,
          COUNT(*) as trades,
          AVG(lastPrice - price) as avgProfit,
          SUM(CASE WHEN lastPrice > price THEN 1.0 ELSE 0.0 END) / COUNT(*) * 100 as winRate
        FROM MED_Book
        WHERE IsSold = 1
          AND DateInsert >= DATEADD(day, -@days, GETDATE())
        GROUP BY
          CASE
            WHEN (lastPrice - price) / NULLIF(price, 0) * 100 < 15 THEN 'LOW'
            WHEN (lastPrice - price) / NULLIF(price, 0) * 100 < 30 THEN 'MEDIUM'
            ELSE 'HIGH'
          END
      `);

    const metrics = overall.recordset[0];
    const winRate = metrics.soldTrades > 0
      ? ((metrics.winningTrades / metrics.soldTrades) * 100).toFixed(2)
      : 0;

    // Calculate cumulative P&L for equity curve
    let cumulative = 0;
    const equityCurve = dailyPnL.recordset.map(day => {
      cumulative += day.dailyProfit;
      return {
        date: day.date,
        dailyPnL: day.dailyProfit,
        cumulativePnL: cumulative,
        trades: day.trades,
        winRate: day.trades > 0 ? ((day.wins / day.trades) * 100).toFixed(1) : 0
      };
    });

    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    equityCurve.forEach(point => {
      if (point.cumulativePnL > peak) peak = point.cumulativePnL;
      const drawdown = peak - point.cumulativePnL;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    res.json({
      success: true,
      period: `${days} days`,
      metrics: {
        totalTrades: metrics.totalTrades,
        soldTrades: metrics.soldTrades,
        activeTrades: metrics.activeTrades,
        totalInvested: metrics.totalInvested,
        totalRevenue: metrics.totalRevenue,
        realizedProfit: metrics.realizedProfit,
        unrealizedProfit: metrics.unrealizedProfit,
        totalPnL: metrics.realizedProfit + metrics.unrealizedProfit,
        avgProfit: metrics.avgProfit,
        avgROI: metrics.avgROI,
        winRate: parseFloat(winRate),
        winningTrades: metrics.winningTrades,
        losingTrades: metrics.losingTrades,
        profitFactor: metrics.losingTrades > 0
          ? (metrics.winningTrades / metrics.losingTrades).toFixed(2)
          : metrics.winningTrades,
        maxDrawdown,
        maxDrawdownPercent: peak > 0 ? ((maxDrawdown / peak) * 100).toFixed(2) : 0
      },
      equityCurve,
      byRiskLevel: byRisk.recordset,
      timestamp: new Date().toISOString()
    });

    logger.info(`Performance metrics fetched: ${metrics.totalTrades} trades, ${winRate}% win rate`);
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics', details: error.message });
  }
});

// ========================================
// Market Overview - Dashboard Summary
// ========================================

/**
 * GET /api/trading-exchange/market-overview
 * Returns high-level market summary for dashboard
 */
router.get('/market-overview', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);

    // Market summary
    const summary = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM MED_Book WHERE IsActive = 1 AND IsSold = 0 AND startDate >= GETDATE()) as activeInventory,
        (SELECT ISNULL(SUM(lastPrice - price), 0) FROM MED_Book WHERE IsActive = 1 AND IsSold = 0 AND startDate >= GETDATE() AND lastPrice IS NOT NULL) as unrealizedValue,
        (SELECT COUNT(*) FROM [MED_ֹOֹֹpportunities] WHERE IsActive = 1 AND IsSale = 0) as openOpportunities,
        (SELECT COUNT(*) FROM [MED_ֹOֹֹpportunities] WHERE IsActive = 1) as totalOpportunities,
        (SELECT ISNULL(SUM(lastPrice - price), 0) FROM MED_Book WHERE IsSold = 1 AND DateInsert >= DATEADD(day, -7, GETDATE()) AND lastPrice IS NOT NULL) as weeklyProfit,
        (SELECT COUNT(*) FROM MED_Book WHERE IsSold = 1 AND DateInsert >= DATEADD(day, -7, GETDATE())) as weeklySales
    `);

    // Recent activity
    const recentTrades = await pool.request().query(`
      SELECT TOP 10
        b.id as tradeId,
        h.Name as hotelName,
        b.price as buyPrice,
        b.lastPrice as sellPrice,
        (b.lastPrice - b.price) as profit,
        b.IsSold,
        b.DateInsert as timestamp
      FROM MED_Book b
      JOIN Med_Hotels h ON b.HotelId = h.HotelId
      ORDER BY b.DateInsert DESC
    `);

    const data = summary.recordset[0];

    res.json({
      success: true,
      overview: {
        inventory: {
          active: data.activeInventory || 0,
          unrealizedValue: data.unrealizedValue || 0
        },
        opportunities: {
          open: data.openOpportunities || 0,
          total: data.totalOpportunities || 0
        },
        performance: {
          weeklyProfit: data.weeklyProfit || 0,
          weeklySales: data.weeklySales || 0,
          avgProfitPerSale: data.weeklySales > 0 ? (data.weeklyProfit / data.weeklySales).toFixed(2) : 0
        }
      },
      recentTrades: recentTrades.recordset,
      marketStatus: data.openOpportunities > 5 ? 'ACTIVE' : data.openOpportunities > 0 ? 'NORMAL' : 'QUIET',
      timestamp: new Date().toISOString()
    });

    logger.info('Market overview fetched');
  } catch (error) {
    logger.error('Error fetching market overview:', error);
    res.status(500).json({ error: 'Failed to fetch market overview', details: error.message });
  }
});

// ========================================
// Helper Functions
// ========================================

function determineSignal(row) {
  // Generate signal based on multiple factors
  let score = 0;

  // Margin score
  if (row.avgMargin > 25) score += 2;
  else if (row.avgMargin > 15) score += 1;

  // Volume score
  if (row.totalTrades > 20) score += 2;
  else if (row.totalTrades > 10) score += 1;

  // Price change score
  if (row.priceChange24h < -5) score += 2; // Price dropped = buy opportunity
  else if (row.priceChange24h < 0) score += 1;

  // Active inventory score
  if (row.activeCount > 5) score += 1;

  if (score >= 5) return 'STRONG_BUY';
  if (score >= 3) return 'BUY';
  if (score >= 1) return 'HOLD';
  return 'WATCH';
}

function determineSignalType(opportunity) {
  if (opportunity.confidence >= 0.7 && opportunity.expectedMargin > 20) return 'BUY';
  if (opportunity.confidence >= 0.5) return 'CONSIDER';
  return 'WATCH';
}

function generateSignalReasons(opportunity, performance) {
  const reasons = [];

  if (opportunity.confidence >= 0.8) {
    reasons.push({
      category: 'confidence',
      text: `High AI confidence (${Math.round(opportunity.confidence * 100)}%)`,
      weight: 0.3
    });
  }

  if (opportunity.expectedMargin > 25) {
    reasons.push({
      category: 'margin',
      text: `Strong expected margin (${opportunity.expectedMargin.toFixed(1)}%)`,
      weight: 0.25
    });
  }

  if (opportunity.daysToCheckIn > 14) {
    reasons.push({
      category: 'timing',
      text: `Good lead time (${opportunity.daysToCheckIn} days)`,
      weight: 0.15
    });
  }

  if (performance && performance.winRate > 0.6) {
    reasons.push({
      category: 'historical',
      text: `Historical win rate ${(performance.winRate * 100).toFixed(0)}%`,
      weight: 0.2
    });
  }

  if (opportunity.riskLevel === 'LOW') {
    reasons.push({
      category: 'risk',
      text: 'Low risk assessment',
      weight: 0.1
    });
  }

  return reasons;
}

module.exports = router;
