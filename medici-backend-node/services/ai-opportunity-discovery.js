/**
 * AI Opportunity Discovery Service
 * 
 * Connects AI predictions to business actions:
 * 1. Scans market for potential opportunities using prediction-engine
 * 2. Evaluates opportunities with confidence scoring
 * 3. Auto-creates opportunities in MED_Opportunities table
 * 4. Applies smart pricing based on AI analysis
 * 5. Tracks AI-generated opportunities for learning
 */

const { getPredictionEngine } = require('./prediction-engine');
const { getPool } = require('../config/database');
const logger = require('../config/logger');
const SlackService = require('./slack-service');
const { getSmartPricingService, STRATEGIES } = require('./smart-pricing-service');

class AIOpportunityDiscovery {
    constructor() {
        this.engine = getPredictionEngine();
        this.confidenceThreshold = 0.7; // 70% minimum confidence
        this.minProfitMargin = 0.15; // 15% minimum profit margin
        this.maxAutoCreatePerRun = 20; // Safety limit
    }

    /**
     * Scan market for opportunities
     * Uses prediction engine to identify potential deals
     */
    async scanMarket(options = {}) {
        const {
            hotelId,
            city,
            daysAhead = 90,
            riskTolerance = 'medium'
        } = options;

        logger.info('[AI Discovery] Starting market scan', { hotelId, city, daysAhead });

        try {
            // Get opportunities from prediction engine
            const predictions = await this.engine.getOpportunities({
                hotelId,
                city,
                userInstructions: 'Find profitable booking opportunities with high confidence',
                filters: {
                    minConfidence: this.confidenceThreshold,
                    minProfitMargin: this.minProfitMargin,
                    daysAhead
                }
            });

            if (!predictions.success) {
                logger.warn('[AI Discovery] No predictions available', { reason: predictions.message });
                return {
                    success: false,
                    message: predictions.message,
                    opportunities: []
                };
            }

            // Filter and enrich opportunities
            const opportunities = predictions.opportunities
                .filter(opp => this.validateOpportunity(opp))
                .map(opp => this.enrichOpportunity(opp, riskTolerance));

            logger.info('[AI Discovery] Market scan complete', {
                found: opportunities.length,
                highPriority: opportunities.filter(o => o.aiConfidence >= 0.85).length
            });

            return {
                success: true,
                total: opportunities.length,
                opportunities,
                scanTime: new Date().toISOString()
            };

        } catch (error) {
            logger.error('[AI Discovery] Market scan failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Validate opportunity meets business rules
     */
    validateOpportunity(opportunity) {
        // Must have pricing data
        if (!opportunity.suggestedBuyPrice || !opportunity.suggestedSellPrice) {
            return false;
        }

        // Must be profitable
        const profit = opportunity.suggestedSellPrice - opportunity.suggestedBuyPrice;
        const margin = profit / opportunity.suggestedSellPrice;
        if (margin < this.minProfitMargin) {
            return false;
        }

        // Must have reasonable confidence
        if (opportunity.confidence < this.confidenceThreshold) {
            return false;
        }

        // Must have dates
        if (!opportunity.startDate || !opportunity.endDate) {
            return false;
        }

        return true;
    }

    /**
     * Enrich opportunity with additional data and scoring
     */
    async enrichOpportunity(opportunity, riskTolerance) {
        // Use smart pricing if available
        const smartPricing = getSmartPricingService();
        let suggestedBuyPrice = opportunity.suggestedBuyPrice;
        let suggestedSellPrice = opportunity.suggestedSellPrice;
        let smartPricingData = null;

        // Try to get smart pricing recommendations
        if (suggestedBuyPrice) {
            try {
                const pricingStrategy = riskTolerance === 'low' ? STRATEGIES.CONSERVATIVE :
                                      riskTolerance === 'high' ? STRATEGIES.AGGRESSIVE :
                                      STRATEGIES.BALANCED;

                const pricingResult = await smartPricing.calculateOptimalPrice({
                    hotelId: opportunity.hotelId,
                    checkIn: opportunity.startDate,
                    checkOut: opportunity.endDate,
                    buyPrice: suggestedBuyPrice,
                    currentSellPrice: suggestedSellPrice,
                    roomCategory: opportunity.roomCategoryId,
                    boardType: opportunity.boardId
                }, pricingStrategy);

                if (pricingResult.success) {
                    // Use smart pricing recommendation
                    suggestedSellPrice = pricingResult.recommendedSellPrice;
                    smartPricingData = {
                        confidence: pricingResult.confidence,
                        risk: pricingResult.risk,
                        market: pricingResult.market,
                        adjustments: pricingResult.adjustments
                    };

                    logger.info('[AI Discovery] Smart pricing applied', {
                        hotelId: opportunity.hotelId,
                        originalSell: opportunity.suggestedSellPrice,
                        smartSell: suggestedSellPrice,
                        confidence: pricingResult.confidence
                    });
                }
            } catch (error) {
                logger.warn('[AI Discovery] Smart pricing failed, using AI prediction', {
                    error: error.message
                });
            }
        }

        const profit = suggestedSellPrice - suggestedBuyPrice;
        const margin = profit / suggestedSellPrice;

        // Calculate AI confidence score (0-1)
        let aiConfidence = opportunity.confidence || 0.5;

        // Boost confidence if smart pricing is available and confident
        if (smartPricingData && smartPricingData.confidence > 0.7) {
            aiConfidence = (aiConfidence + smartPricingData.confidence) / 2;
        }

        // Adjust for risk tolerance
        const riskMultiplier = {
            low: 0.95,   // Slightly reduce confidence for conservative approach
            medium: 1.0,
            high: 1.05   // Slightly boost for aggressive approach
        }[riskTolerance] || 1.0;

        aiConfidence = Math.min(1.0, aiConfidence * riskMultiplier);

        // Calculate priority score
        const priorityScore = this.calculatePriorityScore({
            confidence: aiConfidence,
            profitMargin: margin,
            profit: profit,
            daysUntilCheckIn: opportunity.daysUntilCheckIn || 30
        });

        return {
            ...opportunity,
            suggestedBuyPrice,
            suggestedSellPrice,
            aiConfidence,
            profit,
            profitMargin: margin,
            priorityScore,
            riskLevel: this.assessRiskLevel(aiConfidence, margin),
            autoApprove: this.shouldAutoApprove(aiConfidence, margin, profit),
            smartPricing: smartPricingData
        };
    }

    /**
     * Calculate priority score (0-100)
     */
    calculatePriorityScore(factors) {
        const {
            confidence,
            profitMargin,
            profit,
            daysUntilCheckIn
        } = factors;

        // Weight factors
        const confidenceWeight = 0.4;
        const marginWeight = 0.3;
        const profitWeight = 0.2;
        const urgencyWeight = 0.1;

        // Normalize profit (assuming €100+ is high)
        const normalizedProfit = Math.min(profit / 100, 1);

        // Normalize urgency (prefer 7-30 days out)
        const urgencyScore = daysUntilCheckIn >= 7 && daysUntilCheckIn <= 30 ? 1 : 0.5;

        const score = (
            confidence * confidenceWeight +
            profitMargin * marginWeight +
            normalizedProfit * profitWeight +
            urgencyScore * urgencyWeight
        ) * 100;

        return Math.round(Math.min(score, 100));
    }

    /**
     * Assess risk level
     */
    assessRiskLevel(confidence, margin) {
        if (confidence >= 0.85 && margin >= 0.25) return 'LOW';
        if (confidence >= 0.75 && margin >= 0.20) return 'MEDIUM';
        if (confidence >= 0.70 && margin >= 0.15) return 'MEDIUM';
        return 'HIGH';
    }

    /**
     * Determine if opportunity should be auto-approved
     */
    shouldAutoApprove(confidence, margin, profit) {
        // Auto-approve only if:
        // - Very high confidence (>85%)
        // - Good margin (>20%)
        // - Reasonable profit (>€50)
        return confidence >= 0.85 && margin >= 0.20 && profit >= 50;
    }

    /**
     * Create opportunity in database
     */
    async createOpportunity(opportunity, options = {}) {
        const {
            autoActivate = false,
            createdBy = 'AI_DISCOVERY'
        } = options;

        try {
            const pool = await getPool();

            // Check if similar opportunity already exists
            const existing = await pool.request()
                .input('hotelId', opportunity.hotelId)
                .input('dateFrom', opportunity.startDate)
                .input('dateTo', opportunity.endDate)
                .query(`
                    SELECT COUNT(*) as Count
                    FROM [MED_ֹOֹֹpportunities]
                    WHERE DestinationsId = @hotelId
                    AND DateForm = @dateFrom
                    AND DateTo = @dateTo
                    AND IsActive = 1
                `);

            if (existing.recordset[0].Count > 0) {
                logger.info('[AI Discovery] Similar opportunity already exists', {
                    hotelId: opportunity.hotelId,
                    dates: `${opportunity.startDate} to ${opportunity.endDate}`
                });
                return {
                    success: false,
                    reason: 'duplicate',
                    message: 'Similar opportunity already exists'
                };
            }

            // Insert opportunity
            const result = await pool.request()
                .input('destinationsId', opportunity.hotelId)
                .input('dateFrom', opportunity.startDate)
                .input('dateTo', opportunity.endDate)
                .input('categoryId', opportunity.roomCategoryId || null)
                .input('boardId', opportunity.boardId || null)
                .input('buyPrice', opportunity.suggestedBuyPrice)
                .input('sellPrice', opportunity.suggestedSellPrice)
                .input('operator', opportunity.supplier || 'INNSTANT')
                .input('maxRooms', opportunity.maxRooms || 5)
                .input('isActive', autoActivate ? 1 : 0)
                .input('freeCancellation', 1)
                .input('aiGenerated', 1)
                .input('aiConfidence', opportunity.aiConfidence)
                .input('aiPriorityScore', opportunity.priorityScore)
                .input('aiRiskLevel', opportunity.riskLevel)
                .input('createdBy', createdBy)
                .query(`
                    INSERT INTO [MED_ֹOֹֹpportunities] (
                        DestinationsId, DateForm, DateTo, CategoryId, BoardId,
                        Price, PushPrice, Operator, MaxRooms,
                        IsActive, IsSale, FreeCancelation,
                        DateCreate, Lastupdate,
                        AIGenerated, AIConfidence, AIPriorityScore, AIRiskLevel,
                        CreatedBy
                    )
                    OUTPUT INSERTED.OpportunityId
                    VALUES (
                        @destinationsId, @dateFrom, @dateTo, @categoryId, @boardId,
                        @buyPrice, @sellPrice, @operator, @maxRooms,
                        @isActive, 0, @freeCancellation,
                        GETDATE(), GETDATE(),
                        @aiGenerated, @aiConfidence, @aiPriorityScore, @aiRiskLevel,
                        @createdBy
                    )
                `);

            const opportunityId = result.recordset[0].OpportunityId;

            // Log creation
            await pool.request()
                .input('opportunityId', opportunityId)
                .input('action', 'AI_CREATED')
                .input('details', JSON.stringify({
                    aiConfidence: opportunity.aiConfidence,
                    priorityScore: opportunity.priorityScore,
                    riskLevel: opportunity.riskLevel,
                    profit: opportunity.profit,
                    profitMargin: opportunity.profitMargin,
                    autoActivate
                }))
                .query(`
                    INSERT INTO MED_OpportunityLogs (OpportunityId, Action, Details, CreatedAt)
                    VALUES (@opportunityId, @action, @details, GETDATE())
                `);

            logger.info('[AI Discovery] Opportunity created', {
                opportunityId,
                hotelId: opportunity.hotelId,
                profit: opportunity.profit.toFixed(2),
                confidence: (opportunity.aiConfidence * 100).toFixed(1) + '%'
            });

            return {
                success: true,
                opportunityId,
                autoActivated: autoActivate
            };

        } catch (error) {
            logger.error('[AI Discovery] Failed to create opportunity', {
                error: error.message,
                opportunity
            });
            throw error;
        }
    }

    /**
     * Batch create opportunities
     */
    async batchCreateOpportunities(opportunities, options = {}) {
        const {
            autoActivateThreshold = 0.85,
            maxCreate = this.maxAutoCreatePerRun
        } = options;

        const results = {
            total: opportunities.length,
            created: 0,
            skipped: 0,
            failed: 0,
            details: []
        };

        // Sort by priority
        const sorted = opportunities
            .sort((a, b) => b.priorityScore - a.priorityScore)
            .slice(0, maxCreate);

        for (const opp of sorted) {
            try {
                const autoActivate = opp.aiConfidence >= autoActivateThreshold;
                const result = await this.createOpportunity(opp, { autoActivate });

                if (result.success) {
                    results.created++;
                    results.details.push({
                        opportunityId: result.opportunityId,
                        hotel: opp.hotelName,
                        dates: `${opp.startDate} to ${opp.endDate}`,
                        profit: opp.profit,
                        confidence: opp.aiConfidence,
                        activated: autoActivate
                    });
                } else {
                    results.skipped++;
                }

            } catch (error) {
                results.failed++;
                logger.error('[AI Discovery] Failed to create opportunity', {
                    error: error.message,
                    opportunity: opp
                });
            }
        }

        return results;
    }

    /**
     * Get AI-generated opportunities from database
     */
    async getAIOpportunities(filters = {}) {
        const {
            minConfidence = 0,
            riskLevel,
            isActive,
            limit = 50
        } = filters;

        try {
            const pool = await getPool();

            const result = await pool.request()
                .input('minConfidence', minConfidence)
                .input('riskLevel', riskLevel || null)
                .input('isActive', isActive !== undefined ? isActive : null)
                .input('limit', limit)
                .query(`
                    SELECT TOP (@limit)
                        o.OpportunityId,
                        o.DestinationsId as HotelId,
                        h.name as HotelName,
                        o.DateForm as CheckIn,
                        o.DateTo as CheckOut,
                        o.Price as BuyPrice,
                        o.PushPrice as SellPrice,
                        (o.PushPrice - o.Price) as Profit,
                        o.AIConfidence,
                        o.AIPriorityScore,
                        o.AIRiskLevel,
                        o.IsActive,
                        o.IsSale,
                        o.DateCreate,
                        o.Lastupdate
                    FROM [MED_ֹOֹֹpportunities] o
                    LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
                    WHERE o.AIGenerated = 1
                    AND o.AIConfidence >= @minConfidence
                    ${riskLevel ? 'AND o.AIRiskLevel = @riskLevel' : ''}
                    ${isActive !== undefined ? 'AND o.IsActive = @isActive' : ''}
                    ORDER BY o.AIPriorityScore DESC, o.DateCreate DESC
                `);

            return {
                success: true,
                opportunities: result.recordset
            };

        } catch (error) {
            logger.error('[AI Discovery] Failed to fetch AI opportunities', { error: error.message });
            throw error;
        }
    }
}

// Singleton instance
let discoveryInstance = null;

function getAIDiscoveryService() {
    if (!discoveryInstance) {
        discoveryInstance = new AIOpportunityDiscovery();
    }
    return discoveryInstance;
}

module.exports = { AIOpportunityDiscovery, getAIDiscoveryService };
