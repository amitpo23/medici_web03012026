/**
 * Advanced Pricing Analytics API
 * 
 * Endpoints for deep pricing analysis:
 * - A/B test results
 * - Strategy performance comparison
 * - Price adjustment analysis
 * - Revenue optimization insights
 * - Predictive analytics
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const logger = require('../config/logger');

/**
 * GET /pricing/analytics/ab-tests
 * Get A/B test results and analysis
 */
router.get('/analytics/ab-tests', async (req, res) => {
  try {
    const { testType, strategy, days = 30 } = req.query;

    const pool = await getPool();

    let query = `
      SELECT
        TestType,
        Variant,
        Strategy,
        COUNT(*) as TotalTests,
        SUM(CASE WHEN DidConvert = 1 THEN 1 ELSE 0 END) as Conversions,
        CAST(SUM(CASE WHEN DidConvert = 1 THEN 1 ELSE 0 END) as FLOAT) / COUNT(*) as ConversionRate,
        AVG(TestPrice) as AvgTestPrice,
        AVG(ControlPrice) as AvgControlPrice,
        AVG(ActualProfit) as AvgProfit,
        AVG(ConversionTime) as AvgConversionTime
      FROM MED_ABTests
      WHERE StartDate >= DATEADD(DAY, -@days, GETDATE())
      AND EndDate IS NOT NULL
    `;

    const request = pool.request().input('days', days);

    if (testType) {
      query += ` AND TestType = @testType`;
      request.input('testType', testType);
    }

    if (strategy) {
      query += ` AND Strategy = @strategy`;
      request.input('strategy', strategy);
    }

    query += ` GROUP BY TestType, Variant, Strategy ORDER BY TestType, Variant`;

    const result = await request.query(query);

    // Calculate statistical significance
    const analysis = result.recordset.map(row => {
      const controlGroup = result.recordset.find(r => 
        r.TestType === row.TestType && 
        r.Variant === 'control' &&
        r.Strategy === row.Strategy
      );

      let improvement = null;
      let significanceLevel = null;

      if (controlGroup && row.Variant !== 'control') {
        improvement = ((row.ConversionRate - controlGroup.ConversionRate) / 
                      controlGroup.ConversionRate * 100);
        
        // Simple z-test for significance
        const p1 = row.ConversionRate;
        const p2 = controlGroup.ConversionRate;
        const n1 = row.TotalTests;
        const n2 = controlGroup.TotalTests;
        
        const pooledP = (p1 * n1 + p2 * n2) / (n1 + n2);
        const se = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
        const zScore = Math.abs(p1 - p2) / se;
        
        if (zScore > 2.576) significanceLevel = '99%';
        else if (zScore > 1.96) significanceLevel = '95%';
        else if (zScore > 1.645) significanceLevel = '90%';
        else significanceLevel = 'Not Significant';
      }

      return {
        ...row,
        ConversionRate: parseFloat((row.ConversionRate * 100).toFixed(2)),
        improvement: improvement ? parseFloat(improvement.toFixed(2)) : null,
        significanceLevel,
        sampleSize: row.TotalTests
      };
    });

    res.json({
      success: true,
      period: `Last ${days} days`,
      tests: analysis,
      summary: {
        totalTests: result.recordset.reduce((sum, r) => sum + r.TotalTests, 0),
        avgConversionRate: result.recordset.reduce((sum, r) => sum + r.ConversionRate, 0) / result.recordset.length,
        bestPerformer: analysis.reduce((best, current) => 
          current.ConversionRate > (best?.ConversionRate || 0) ? current : best, null
        )
      }
    });

  } catch (error) {
    logger.error('[Pricing Analytics] A/B tests error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /pricing/analytics/strategy-comparison
 * Compare performance of different pricing strategies
 */
router.get('/analytics/strategy-comparison', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const pool = await getPool();

    const result = await pool.request()
      .input('days', days)
      .query(`
        -- Compare strategy performance
        WITH StrategyMetrics AS (
          SELECT
            COALESCE(
              (SELECT TOP 1 JSON_VALUE(Details, '$.strategy')
               FROM MED_OpportunityLogs l
               WHERE l.OpportunityId = o.OpportunityId
               AND l.Action IN ('PRICE_OPTIMIZED', 'AI_CREATED')
               ORDER BY l.CreatedAt DESC),
              'balanced'
            ) as Strategy,
            COUNT(*) as Total,
            SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as Sold,
            AVG(PushPrice - Price) as AvgProfit,
            AVG((PushPrice - Price) / PushPrice) as AvgMargin,
            AVG(AIConfidence) as AvgConfidence,
            AVG(AIPriorityScore) as AvgPriority,
            AVG(DATEDIFF(HOUR, DateCreate, Lastupdate)) as AvgTimeToAction
          FROM [MED_ֹOֹֹpportunities] o
          WHERE AIGenerated = 1
          AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
          GROUP BY 
            COALESCE(
              (SELECT TOP 1 JSON_VALUE(Details, '$.strategy')
               FROM MED_OpportunityLogs l
               WHERE l.OpportunityId = o.OpportunityId
               AND l.Action IN ('PRICE_OPTIMIZED', 'AI_CREATED')
               ORDER BY l.CreatedAt DESC),
              'balanced'
            )
        )
        SELECT
          Strategy,
          Total,
          Sold,
          CAST(Sold as FLOAT) / Total as ConversionRate,
          AvgProfit,
          AvgMargin,
          AvgConfidence,
          AvgPriority,
          AvgTimeToAction,
          -- Expected value calculation
          (Sold * AvgProfit) as TotalProfit,
          (AvgProfit * (CAST(Sold as FLOAT) / Total)) as ExpectedValuePerOpp
        FROM StrategyMetrics
        ORDER BY ExpectedValuePerOpp DESC
      `);

    const strategies = result.recordset.map(row => ({
      strategy: row.Strategy,
      total: row.Total,
      sold: row.Sold,
      conversionRate: parseFloat((row.ConversionRate * 100).toFixed(2)) + '%',
      avgProfit: Math.round(row.AvgProfit * 100) / 100,
      avgMargin: Math.round(row.AvgMargin * 100) + '%',
      avgConfidence: Math.round(row.AvgConfidence * 100) / 100,
      avgPriority: Math.round(row.AvgPriority * 100) / 100,
      totalProfit: Math.round(row.TotalProfit * 100) / 100,
      expectedValuePerOpp: Math.round(row.ExpectedValuePerOpp * 100) / 100,
      avgTimeToAction: Math.round(row.AvgTimeToAction)
    }));

    res.json({
      success: true,
      period: `Last ${days} days`,
      strategies,
      recommendation: strategies[0]?.strategy || 'balanced'
    });

  } catch (error) {
    logger.error('[Pricing Analytics] Strategy comparison error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /pricing/analytics/adjustments
 * Analyze price adjustment patterns and effectiveness
 */
router.get('/analytics/adjustments', async (req, res) => {
  try {
    const { days = 30, reason } = req.query;

    const pool = await getPool();

    let query = `
      -- Analyze price adjustments
      SELECT
        pa.Reason,
        pa.Strategy,
        COUNT(*) as AdjustmentCount,
        AVG(pa.ChangePercent) as AvgChangePercent,
        AVG(pa.PriceDiff) as AvgPriceDiff,
        SUM(CASE WHEN pa.IsAutomatic = 1 THEN 1 ELSE 0 END) as AutomaticCount,
        SUM(CASE WHEN pa.IsAutomatic = 0 THEN 1 ELSE 0 END) as ManualCount,
        AVG(pa.Confidence) as AvgConfidence,
        
        -- Outcome analysis
        SUM(CASE WHEN o.IsSale = 1 THEN 1 ELSE 0 END) as Conversions,
        CAST(SUM(CASE WHEN o.IsSale = 1 THEN 1 ELSE 0 END) as FLOAT) / COUNT(*) as ConversionRate,
        AVG(CASE WHEN o.IsSale = 1 THEN (o.PushPrice - o.Price) END) as AvgProfitWhenSold
        
      FROM MED_PriceAdjustments pa
      LEFT JOIN [MED_ֹOֹֹpportunities] o ON pa.OpportunityId = o.OpportunityId
      WHERE pa.CreatedAt >= DATEADD(DAY, -@days, GETDATE())
    `;

    const request = pool.request().input('days', days);

    if (reason) {
      query += ` AND pa.Reason = @reason`;
      request.input('reason', reason);
    }

    query += ` GROUP BY pa.Reason, pa.Strategy ORDER BY AdjustmentCount DESC`;

    const result = await request.query(query);

    const adjustments = result.recordset.map(row => ({
      reason: row.Reason,
      strategy: row.Strategy,
      count: row.AdjustmentCount,
      avgChange: parseFloat((row.AvgChangePercent * 100).toFixed(2)) + '%',
      avgPriceDiff: Math.round(row.AvgPriceDiff * 100) / 100,
      automatic: row.AutomaticCount,
      manual: row.ManualCount,
      avgConfidence: Math.round((row.AvgConfidence || 0) * 100) / 100,
      conversions: row.Conversions,
      conversionRate: parseFloat((row.ConversionRate * 100).toFixed(2)) + '%',
      avgProfitWhenSold: Math.round((row.AvgProfitWhenSold || 0) * 100) / 100
    }));

    res.json({
      success: true,
      period: `Last ${days} days`,
      adjustments,
      summary: {
        totalAdjustments: result.recordset.reduce((sum, r) => sum + r.AdjustmentCount, 0),
        avgConversionRate: result.recordset.reduce((sum, r) => sum + r.ConversionRate, 0) / result.recordset.length,
        bestPerformingReason: adjustments[0]?.reason
      }
    });

  } catch (error) {
    logger.error('[Pricing Analytics] Adjustments analysis error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /pricing/analytics/revenue-optimization
 * Revenue optimization insights and recommendations
 */
router.get('/analytics/revenue-optimization', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const pool = await getPool();

    // Get current performance
    const currentPerf = await pool.request()
      .input('days', days)
      .query(`
        SELECT
          COUNT(*) as TotalOpportunities,
          SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as Sold,
          AVG(PushPrice - Price) as AvgProfit,
          AVG((PushPrice - Price) / PushPrice) as AvgMargin,
          SUM(CASE WHEN IsSale = 1 THEN (PushPrice - Price) ELSE 0 END) as TotalProfit
        FROM [MED_ֹOֹֹpportunities]
        WHERE AIGenerated = 1
        AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
      `);

    const current = currentPerf.recordset[0];
    const conversionRate = current.TotalOpportunities > 0 ? 
      current.Sold / current.TotalOpportunities : 0;

    // Analyze potential improvements
    const improvements = await pool.request()
      .input('days', days)
      .query(`
        -- Find optimization opportunities
        SELECT
          'Increase high-confidence prices' as Opportunity,
          COUNT(*) as AffectedOpportunities,
          AVG((PushPrice - Price) / PushPrice) as CurrentMargin,
          0.35 as PotentialMargin,
          SUM(Price * 0.10) as PotentialAdditionalRevenue
        FROM [MED_ֹOֹֹpportunities]
        WHERE AIGenerated = 1
        AND IsActive = 1
        AND IsSale = 0
        AND AIConfidence >= 0.85
        AND ((PushPrice - Price) / PushPrice) < 0.30
        
        UNION ALL
        
        SELECT
          'Decrease low-confidence prices' as Opportunity,
          COUNT(*) as AffectedOpportunities,
          AVG((PushPrice - Price) / PushPrice) as CurrentMargin,
          0.18 as PotentialMargin,
          COUNT(*) * AVG(Price) * 0.20 as PotentialAdditionalRevenue
        FROM [MED_ֹOֹֹpportunities]
        WHERE AIGenerated = 1
        AND IsActive = 1
        AND IsSale = 0
        AND AIConfidence < 0.75
        AND ((PushPrice - Price) / PushPrice) > 0.25
        
        UNION ALL
        
        SELECT
          'Optimize stale opportunities' as Opportunity,
          COUNT(*) as AffectedOpportunities,
          AVG((PushPrice - Price) / PushPrice) as CurrentMargin,
          0.25 as PotentialMargin,
          COUNT(*) * AVG(Price) * 0.15 as PotentialAdditionalRevenue
        FROM [MED_ֹOֹֹpportunities]
        WHERE AIGenerated = 1
        AND IsActive = 1
        AND IsSale = 0
        AND Lastupdate < DATEADD(DAY, -7, GETDATE())
      `);

    // Calculate projections
    const projections = improvements.recordset.map(opp => {
      const expectedConversionIncrease = opp.Opportunity.includes('Decrease') ? 0.15 : 0;
      const newConversionRate = conversionRate + expectedConversionIncrease;
      const expectedRevenue = opp.PotentialAdditionalRevenue * newConversionRate;

      return {
        opportunity: opp.Opportunity,
        affectedCount: opp.AffectedOpportunities,
        currentMargin: parseFloat((opp.CurrentMargin * 100).toFixed(2)) + '%',
        potentialMargin: parseFloat((opp.PotentialMargin * 100).toFixed(2)) + '%',
        potentialRevenue: Math.round(expectedRevenue * 100) / 100,
        expectedImpact: opp.AffectedOpportunities > 0 ? 'HIGH' : 'LOW'
      };
    });

    const totalPotentialRevenue = projections.reduce((sum, p) => sum + p.potentialRevenue, 0);

    res.json({
      success: true,
      period: `Last ${days} days`,
      current: {
        opportunities: current.TotalOpportunities,
        sold: current.Sold,
        conversionRate: parseFloat((conversionRate * 100).toFixed(2)) + '%',
        avgProfit: Math.round(current.AvgProfit * 100) / 100,
        avgMargin: Math.round(current.AvgMargin * 100) + '%',
        totalProfit: Math.round(current.TotalProfit * 100) / 100
      },
      optimizations: projections.filter(p => p.affectedCount > 0),
      projectedImpact: {
        totalPotentialRevenue: Math.round(totalPotentialRevenue * 100) / 100,
        revenueIncrease: totalPotentialRevenue > 0 ? 
          parseFloat((totalPotentialRevenue / current.TotalProfit * 100).toFixed(2)) + '%' : '0%',
        recommendedAction: projections.length > 0 ? projections[0].opportunity : 'No optimizations needed'
      }
    });

  } catch (error) {
    logger.error('[Pricing Analytics] Revenue optimization error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /pricing/analytics/trends
 * Price and performance trends over time
 */
router.get('/analytics/trends', async (req, res) => {
  try {
    const { days = 30, granularity = 'daily' } = req.query;

    const pool = await getPool();

    const groupByClause = granularity === 'weekly' 
      ? `DATEPART(WEEK, DateCreate), DATEPART(YEAR, DateCreate)`
      : `CAST(DateCreate as DATE)`;

    const result = await pool.request()
      .input('days', days)
      .query(`
        SELECT
          ${groupByClause} as Period,
          COUNT(*) as OpportunitiesCreated,
          SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as Sold,
          AVG(PushPrice) as AvgSellPrice,
          AVG(Price) as AvgBuyPrice,
          AVG((PushPrice - Price) / PushPrice) as AvgMargin,
          AVG(AIConfidence) as AvgConfidence,
          SUM(CASE WHEN IsSale = 1 THEN (PushPrice - Price) ELSE 0 END) as TotalProfit
        FROM [MED_ֹOֹֹpportunities]
        WHERE AIGenerated = 1
        AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
        GROUP BY ${groupByClause}
        ORDER BY ${groupByClause}
      `);

    const trends = result.recordset.map(row => ({
      period: row.Period,
      created: row.OpportunitiesCreated,
      sold: row.Sold,
      conversionRate: row.OpportunitiesCreated > 0 ? 
        parseFloat((row.Sold / row.OpportunitiesCreated * 100).toFixed(2)) : 0,
      avgSellPrice: Math.round(row.AvgSellPrice * 100) / 100,
      avgBuyPrice: Math.round(row.AvgBuyPrice * 100) / 100,
      avgMargin: Math.round(row.AvgMargin * 100) + '%',
      avgConfidence: Math.round(row.AvgConfidence * 100) / 100,
      totalProfit: Math.round(row.TotalProfit * 100) / 100
    }));

    res.json({
      success: true,
      period: `Last ${days} days`,
      granularity,
      trends
    });

  } catch (error) {
    logger.error('[Pricing Analytics] Trends error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /pricing/analytics/run-metrics
 * Manually trigger daily metrics calculation
 */
router.post('/analytics/run-metrics', async (req, res) => {
  try {
    const { date } = req.body;

    const pool = await getPool();

    const result = await pool.request()
      .input('date', date || new Date())
      .execute('SP_CalculateDailyPricingMetrics');

    res.json({
      success: true,
      metricsCalculated: result.recordset[0].MetricsCalculated,
      date: date || new Date().toISOString().split('T')[0]
    });

  } catch (error) {
    logger.error('[Pricing Analytics] Run metrics error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
