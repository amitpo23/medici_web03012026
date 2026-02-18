/**
 * AI Opportunities API Routes
 * 
 * Manages AI-discovered opportunities:
 * - Scan market for opportunities
 * - View AI-generated opportunities
 * - Approve/reject AI suggestions
 * - Monitor AI performance
 */

const express = require('express');
const router = express.Router();
const { getAIDiscoveryService } = require('../services/ai-opportunity-discovery');
const { getPool } = require('../config/database');
const logger = require('../config/logger');

/**
 * POST /ai-opportunities/scan
 * Manually trigger AI market scan
 */
router.post('/scan', async (req, res) => {
  try {
    const {
      hotelId,
      city,
      daysAhead = 90,
      riskTolerance = 'medium',
      autoCreate = false,
      maxCreate = 20
    } = req.body;

    logger.info('[AI Opportunities] Manual scan requested', { hotelId, city });

    const discovery = getAIDiscoveryService();

    // Scan market
    const scan = await discovery.scanMarket({
      hotelId,
      city,
      daysAhead,
      riskTolerance
    });

    if (!scan.success) {
      return res.status(404).json({
        success: false,
        message: scan.message
      });
    }

    // Auto-create if requested
    let createResults = null;
    if (autoCreate && scan.opportunities.length > 0) {
      const highConfidence = scan.opportunities.filter(opp =>
        opp.aiConfidence >= 0.75 && opp.priorityScore >= 60
      );

      if (highConfidence.length > 0) {
        createResults = await discovery.batchCreateOpportunities(highConfidence, {
          autoActivateThreshold: 0.85,
          maxCreate
        });
      }
    }

    res.json({
      success: true,
      scan: {
        total: scan.total,
        opportunities: scan.opportunities,
        scanTime: scan.scanTime
      },
      created: createResults || { message: 'Auto-create not enabled' }
    });

  } catch (error) {
    logger.error('[AI Opportunities] Scan error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /ai-opportunities
 * Get all AI-generated opportunities
 */
router.get('/', async (req, res) => {
  try {
    const {
      minConfidence = 0,
      riskLevel,
      isActive,
      limit = 50
    } = req.query;

    const discovery = getAIDiscoveryService();

    const result = await discovery.getAIOpportunities({
      minConfidence: parseFloat(minConfidence),
      riskLevel,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: parseInt(limit)
    });

    res.json(result);

  } catch (error) {
    logger.error('[AI Opportunities] Fetch error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /ai-opportunities/:id/approve
 * Approve and activate AI-generated opportunity
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, notes } = req.body;

    const pool = await getPool();

    // Update opportunity
    await pool.request()
      .input('opportunityId', id)
      .input('userId', userId || null)
      .input('notes', notes || null)
      .query(`
        UPDATE [MED_Opportunities]
        SET IsActive = 1,
            Lastupdate = GETDATE()
        WHERE OpportunityId = @opportunityId
        AND AIGenerated = 1
      `);

    // Log approval
    await pool.request()
      .input('opportunityId', id)
      .input('action', 'AI_APPROVED')
      .input('details', JSON.stringify({ userId, notes, approvedAt: new Date() }))
      .query(`
        INSERT INTO MED_OpportunityLogs (OpportunityId, Action, Details, CreatedAt)
        VALUES (@opportunityId, @action, @details, GETDATE())
      `);

    logger.info('[AI Opportunities] Opportunity approved', { opportunityId: id, userId });

    res.json({
      success: true,
      message: 'Opportunity approved and activated',
      opportunityId: parseInt(id)
    });

  } catch (error) {
    logger.error('[AI Opportunities] Approve error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /ai-opportunities/:id/reject
 * Reject AI-generated opportunity
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, reason } = req.body;

    const pool = await getPool();

    // Deactivate opportunity
    await pool.request()
      .input('opportunityId', id)
      .query(`
        UPDATE [MED_Opportunities]
        SET IsActive = 0,
            Lastupdate = GETDATE()
        WHERE OpportunityId = @opportunityId
        AND AIGenerated = 1
      `);

    // Log rejection
    await pool.request()
      .input('opportunityId', id)
      .input('action', 'AI_REJECTED')
      .input('details', JSON.stringify({ userId, reason, rejectedAt: new Date() }))
      .query(`
        INSERT INTO MED_OpportunityLogs (OpportunityId, Action, Details, CreatedAt)
        VALUES (@opportunityId, @action, @details, GETDATE())
      `);

    logger.info('[AI Opportunities] Opportunity rejected', { opportunityId: id, userId, reason });

    res.json({
      success: true,
      message: 'Opportunity rejected',
      opportunityId: parseInt(id)
    });

  } catch (error) {
    logger.error('[AI Opportunities] Reject error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /ai-opportunities/stats
 * Get AI opportunity statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const pool = await getPool();

    const stats = await pool.request()
      .input('days', days)
      .query(`
        -- AI opportunity stats
        DECLARE @TotalCreated INT = (
          SELECT COUNT(*) FROM [MED_Opportunities]
          WHERE AIGenerated = 1
          AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
        );

        DECLARE @AutoActivated INT = (
          SELECT COUNT(*) FROM MED_OpportunityLogs
          WHERE Action = 'AI_CREATED'
          AND CreatedAt >= DATEADD(DAY, -@days, GETDATE())
          AND Details LIKE '%"autoActivate":true%'
        );

        DECLARE @ManuallyApproved INT = (
          SELECT COUNT(*) FROM MED_OpportunityLogs
          WHERE Action = 'AI_APPROVED'
          AND CreatedAt >= DATEADD(DAY, -@days, GETDATE())
        );

        DECLARE @Rejected INT = (
          SELECT COUNT(*) FROM MED_OpportunityLogs
          WHERE Action = 'AI_REJECTED'
          AND CreatedAt >= DATEADD(DAY, -@days, GETDATE())
        );

        DECLARE @Sold INT = (
          SELECT COUNT(*) FROM [MED_Opportunities]
          WHERE AIGenerated = 1
          AND IsSale = 1
          AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
        );

        DECLARE @TotalRevenue DECIMAL(18,2) = (
          SELECT ISNULL(SUM(PushPrice), 0) FROM [MED_Opportunities]
          WHERE AIGenerated = 1
          AND IsSale = 1
          AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
        );

        DECLARE @TotalCost DECIMAL(18,2) = (
          SELECT ISNULL(SUM(Price), 0) FROM [MED_Opportunities]
          WHERE AIGenerated = 1
          AND IsSale = 1
          AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
        );

        SELECT
          @TotalCreated as TotalCreated,
          @AutoActivated as AutoActivated,
          @ManuallyApproved as ManuallyApproved,
          @Rejected as Rejected,
          @Sold as Sold,
          @TotalRevenue as TotalRevenue,
          @TotalCost as TotalCost,
          (@TotalRevenue - @TotalCost) as TotalProfit,
          CASE
            WHEN @TotalRevenue > 0
            THEN ((@TotalRevenue - @TotalCost) / @TotalRevenue * 100)
            ELSE 0
          END as ProfitMargin,
          CASE
            WHEN @TotalCreated > 0
            THEN (CAST(@Sold as FLOAT) / @TotalCreated * 100)
            ELSE 0
          END as ConversionRate
      `);

    // Get confidence distribution
    const confidenceDistribution = await pool.request()
      .input('days', days)
      .query(`
        SELECT
          CASE
            WHEN AIConfidence >= 0.90 THEN '90-100%'
            WHEN AIConfidence >= 0.80 THEN '80-89%'
            WHEN AIConfidence >= 0.70 THEN '70-79%'
            ELSE '< 70%'
          END as ConfidenceRange,
          COUNT(*) as Count,
          SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as SoldCount
        FROM [MED_Opportunities]
        WHERE AIGenerated = 1
        AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
        GROUP BY
          CASE
            WHEN AIConfidence >= 0.90 THEN '90-100%'
            WHEN AIConfidence >= 0.80 THEN '80-89%'
            WHEN AIConfidence >= 0.70 THEN '70-79%'
            ELSE '< 70%'
          END
        ORDER BY ConfidenceRange DESC
      `);

    // Get risk level distribution
    const riskDistribution = await pool.request()
      .input('days', days)
      .query(`
        SELECT
          AIRiskLevel as RiskLevel,
          COUNT(*) as Count,
          SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as SoldCount,
          AVG(AIConfidence) as AvgConfidence,
          AVG(AIPriorityScore) as AvgPriorityScore
        FROM [MED_Opportunities]
        WHERE AIGenerated = 1
        AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
        AND AIRiskLevel IS NOT NULL
        GROUP BY AIRiskLevel
        ORDER BY
          CASE AIRiskLevel
            WHEN 'LOW' THEN 1
            WHEN 'MEDIUM' THEN 2
            WHEN 'HIGH' THEN 3
          END
      `);

    res.json({
      success: true,
      period: `Last ${days} days`,
      summary: stats.recordset[0],
      confidenceDistribution: confidenceDistribution.recordset,
      riskDistribution: riskDistribution.recordset
    });

  } catch (error) {
    logger.error('[AI Opportunities] Stats error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /ai-opportunities/batch-approve
 * Batch approve multiple AI opportunities
 */
router.post('/batch-approve', async (req, res) => {
  try {
    const { opportunityIds, userId, notes } = req.body;

    if (!Array.isArray(opportunityIds) || opportunityIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'opportunityIds array required'
      });
    }

    const pool = await getPool();
    let approved = 0;

    for (const id of opportunityIds) {
      try {
        await pool.request()
          .input('opportunityId', id)
          .query(`
            UPDATE [MED_Opportunities]
            SET IsActive = 1, Lastupdate = GETDATE()
            WHERE OpportunityId = @opportunityId AND AIGenerated = 1
          `);

        await pool.request()
          .input('opportunityId', id)
          .input('action', 'AI_APPROVED')
          .input('details', JSON.stringify({ userId, notes, batchApproval: true }))
          .query(`
            INSERT INTO MED_OpportunityLogs (OpportunityId, Action, Details, CreatedAt)
            VALUES (@opportunityId, @action, @details, GETDATE())
          `);

        approved++;

      } catch (error) {
        logger.error('[AI Opportunities] Batch approve error for opportunity', { id, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Approved ${approved} out of ${opportunityIds.length} opportunities`,
      approved,
      total: opportunityIds.length
    });

  } catch (error) {
    logger.error('[AI Opportunities] Batch approve error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
