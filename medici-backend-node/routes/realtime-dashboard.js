/**
 * Real-time Dashboard API
 * 
 * Provides live metrics and activity feeds for dashboard
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { verifyToken: authenticateRequest } = require('../middleware/auth');
const logger = require('../config/logger');

/**
 * GET /realtime/dashboard
 * Real-time dashboard data
 */
router.get('/dashboard', authenticateRequest, async (req, res) => {
  try {
    const pool = await getPool();
    const { timeRange = '24h' } = req.query;

    // Calculate time filter
    const hoursBack = timeRange === '7d' ? 168 : timeRange === '30d' ? 720 : 24;

    const [opportunities, performance, activity, alerts] = await Promise.all([
      // Opportunities overview
      pool.request().query(`
        SELECT
          COUNT(*) as Total,
          SUM(CASE WHEN IsActive = 1 AND IsSale = 0 THEN 1 ELSE 0 END) as Active,
          SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as Sold,
          SUM(CASE WHEN AIGenerated = 1 THEN 1 ELSE 0 END) as AIGenerated,
          AVG(CASE WHEN IsActive = 1 THEN AIConfidence ELSE NULL END) as AvgConfidence,
          SUM(CASE WHEN IsActive = 1 AND IsSale = 0 THEN SuggestedSellPrice - SuggestedBuyPrice ELSE 0 END) as PotentialProfit,
          SUM(CASE WHEN IsSale = 1 THEN SuggestedSellPrice - SuggestedBuyPrice ELSE 0 END) as RealizedProfit
        FROM [MED_Opportunities]
        WHERE DateCreate >= DATEADD(HOUR, -${hoursBack}, GETDATE())
      `),

      // Performance metrics
      pool.request().query(`
        SELECT TOP 1
          ConversionRate,
          AvgMargin,
          TotalRevenue,
          TotalProfit,
          OpportunitiesCreated,
          OpportunitiesSold,
          AvgConfidence
        FROM MED_PricingPerformance
        WHERE PeriodType = 'DAILY'
        ORDER BY PeriodDate DESC
      `),

      // Recent activity
      pool.request().query(`
        SELECT TOP 20
          Action,
          OpportunityId,
          CreatedAt,
          Details
        FROM MED_OpportunityLogs
        WHERE CreatedAt >= DATEADD(HOUR, -${hoursBack}, GETDATE())
        ORDER BY CreatedAt DESC
      `),

      // Active alerts
      pool.request().query(`
        SELECT
          AlertType,
          COUNT(*) as Count
        FROM MED_Alerts
        WHERE IsActive = 1
        AND Severity IN ('HIGH', 'CRITICAL')
        GROUP BY AlertType
      `)
    ]);

    // Calculate rates
    const opps = opportunities.recordset[0];
    const perf = performance.recordset[0] || {};
    
    const conversionRate = opps.Total > 0 ? (opps.Sold / opps.Total) : 0;
    const aiAdoptionRate = opps.Total > 0 ? (opps.AIGenerated / opps.Total) : 0;

    res.json({
      timestamp: new Date().toISOString(),
      timeRange,
      opportunities: {
        total: opps.Total || 0,
        active: opps.Active || 0,
        sold: opps.Sold || 0,
        aiGenerated: opps.AIGenerated || 0,
        aiAdoptionRate: aiAdoptionRate,
        avgConfidence: opps.AvgConfidence || 0,
        potentialProfit: opps.PotentialProfit || 0,
        realizedProfit: opps.RealizedProfit || 0
      },
      performance: {
        conversionRate: perf.ConversionRate || conversionRate,
        avgMargin: perf.AvgMargin || 0,
        totalRevenue: perf.TotalRevenue || 0,
        totalProfit: perf.TotalProfit || 0,
        opportunitiesCreated: perf.OpportunitiesCreated || opps.Total,
        opportunitiesSold: perf.OpportunitiesSold || opps.Sold,
        avgConfidence: perf.AvgConfidence || opps.AvgConfidence || 0
      },
      activity: activity.recordset.map(a => ({
        action: a.Action,
        opportunityId: a.OpportunityId,
        timestamp: a.CreatedAt,
        details: a.Details
      })),
      alerts: alerts.recordset.map(a => ({
        type: a.AlertType,
        count: a.Count
      })),
      health: {
        status: 'healthy',
        score: calculateHealthScore(opps, perf, alerts.recordset)
      }
    });

  } catch (error) {
    logger.error('[Realtime Dashboard] Error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Failed to load dashboard',
      message: error.message
    });
  }
});

/**
 * GET /realtime/live-feed
 * Live activity feed
 */
router.get('/live-feed', authenticateRequest, async (req, res) => {
  try {
    const pool = await getPool();
    const { since, limit = 50 } = req.query;

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 5 * 60 * 1000); // Last 5 min

    const events = await pool.request()
      .input('since', sinceDate)
      .input('limit', parseInt(limit))
      .query(`
        SELECT TOP (@limit)
          'OPPORTUNITY' as EventType,
          OpportunityId as Id,
          Action as EventAction,
          CreatedAt as Timestamp,
          Details
        FROM MED_OpportunityLogs
        WHERE CreatedAt > @since
        
        UNION ALL
        
        SELECT TOP (@limit)
          'ALERT' as EventType,
          AlertId as Id,
          AlertType as EventAction,
          CreatedAt as Timestamp,
          Message as Details
        FROM MED_Alerts
        WHERE CreatedAt > @since
        AND IsActive = 1
        
        ORDER BY Timestamp DESC
      `);

    res.json({
      timestamp: new Date().toISOString(),
      since: sinceDate.toISOString(),
      events: events.recordset.map(e => ({
        type: e.EventType,
        id: e.Id,
        action: e.EventAction,
        timestamp: e.Timestamp,
        details: e.Details
      }))
    });

  } catch (error) {
    logger.error('[Realtime] Live feed error', { 
      error: error.message 
    });
    res.status(500).json({
      error: 'Failed to load live feed',
      message: error.message
    });
  }
});

/**
 * GET /realtime/widgets/:widgetType
 * Individual dashboard widgets
 */
router.get('/widgets/:widgetType', authenticateRequest, async (req, res) => {
  try {
    const { widgetType } = req.params;
    const pool = await getPool();

    let data;
    switch (widgetType) {
      case 'top-opportunities':
        data = await getTopOpportunities(pool);
        break;
      case 'recent-sales':
        data = await getRecentSales(pool);
        break;
      case 'strategy-performance':
        data = await getStrategyPerformance(pool);
        break;
      case 'risk-distribution':
        data = await getRiskDistribution(pool);
        break;
      case 'hourly-activity':
        data = await getHourlyActivity(pool);
        break;
      default:
        return res.status(404).json({ error: 'Widget not found' });
    }

    res.json({
      widget: widgetType,
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Realtime] Widget error', { 
      error: error.message,
      widget: req.params.widgetType 
    });
    res.status(500).json({
      error: 'Failed to load widget',
      message: error.message
    });
  }
});

// Widget data functions
async function getTopOpportunities(pool) {
  const result = await pool.request().query(`
    SELECT TOP 10
      o.OpportunityId,
      h.HotelName,
      o.StartDate,
      o.EndDate,
      o.SuggestedBuyPrice,
      o.SuggestedSellPrice,
      (o.SuggestedSellPrice - o.SuggestedBuyPrice) as Profit,
      o.AIConfidence,
      o.AIRiskLevel,
      o.AIPriorityScore
    FROM [MED_Opportunities] o
    LEFT JOIN MED_Hotels h ON o.HotelId = h.HotelId
    WHERE o.IsActive = 1
    AND o.IsSale = 0
    ORDER BY o.AIPriorityScore DESC
  `);

  return result.recordset;
}

async function getRecentSales(pool) {
  const result = await pool.request().query(`
    SELECT TOP 10
      o.OpportunityId,
      h.HotelName,
      o.StartDate,
      o.SuggestedBuyPrice,
      o.SuggestedSellPrice,
      (o.SuggestedSellPrice - o.SuggestedBuyPrice) as Profit,
      o.DateCreate,
      DATEDIFF(HOUR, o.DateCreate, o.Lastupdate) as HoursToSell
    FROM [MED_Opportunities] o
    LEFT JOIN MED_Hotels h ON o.HotelId = h.HotelId
    WHERE o.IsSale = 1
    ORDER BY o.Lastupdate DESC
  `);

  return result.recordset;
}

async function getStrategyPerformance(pool) {
  const result = await pool.request().query(`
    SELECT
      Strategy,
      AVG(ConversionRate) as AvgConversion,
      SUM(TotalProfit) as TotalProfit,
      COUNT(*) as DataPoints
    FROM MED_PricingPerformance
    WHERE PeriodDate >= DATEADD(DAY, -30, GETDATE())
    AND Strategy IS NOT NULL
    GROUP BY Strategy
    ORDER BY TotalProfit DESC
  `);

  return result.recordset;
}

async function getRiskDistribution(pool) {
  const result = await pool.request().query(`
    SELECT
      AIRiskLevel,
      COUNT(*) as Count,
      AVG(AIConfidence) as AvgConfidence,
      AVG(SuggestedSellPrice - SuggestedBuyPrice) as AvgProfit
    FROM [MED_Opportunities]
    WHERE IsActive = 1
    AND IsSale = 0
    GROUP BY AIRiskLevel
  `);

  return result.recordset;
}

async function getHourlyActivity(pool) {
  const result = await pool.request().query(`
    SELECT
      DATEPART(HOUR, CreatedAt) as Hour,
      COUNT(*) as ActivityCount,
      COUNT(DISTINCT Action) as UniqueActions
    FROM MED_OpportunityLogs
    WHERE CreatedAt >= DATEADD(DAY, -1, GETDATE())
    GROUP BY DATEPART(HOUR, CreatedAt)
    ORDER BY Hour
  `);

  return result.recordset;
}

function calculateHealthScore(opportunities, performance, alerts) {
  let score = 100;

  // Deduct for low activity
  if (opportunities.Total < 10) score -= 20;
  if (opportunities.Active < 5) score -= 15;

  // Deduct for low conversion
  const conversion = performance.ConversionRate || 0;
  if (conversion < 0.3) score -= 20;
  else if (conversion < 0.5) score -= 10;

  // Deduct for active alerts
  const criticalAlerts = alerts.filter(a => a.Count > 0).length;
  score -= (criticalAlerts * 10);

  // Deduct for low confidence
  if (opportunities.AvgConfidence && opportunities.AvgConfidence < 0.7) score -= 10;

  return Math.max(0, Math.min(100, score));
}

module.exports = router;
