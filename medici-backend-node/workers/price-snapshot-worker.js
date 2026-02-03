/**
 * Price Snapshot Worker
 * 
 * Captures price snapshots for historical analysis and trend detection
 * Runs every hour to track price changes over time
 * 
 * Key features:
 * - Snapshots current opportunity prices
 * - Tracks competitor prices (if available)
 * - Identifies price changes and trends
 * - Supports demand forecasting ML models
 */

require('dotenv').config();
const cron = require('node-cron');
const { getPool } = require('../config/database');
const logger = require('../config/logger');
const SlackService = require('../services/slack-service');

// Run every hour
const CRON_SCHEDULE = '0 * * * *';

/**
 * Get active opportunities for snapshot
 */
async function getActiveOpportunities(pool) {
    const result = await pool.request().query(`
        SELECT 
            o.OpportunityId,
            o.DestinationsId as HotelId,
            o.CategoryId as RoomCategoryId,
            o.BoardId,
            o.DateForm as DateFrom,
            o.DateTo,
            o.Price as BuyPrice,
            o.PushPrice as SellPrice,
            o.PushBookingLimit as AvailableRooms,
            o.MaxRooms as TotalRooms,
            o.Operator as Source,
            o.IsActive
        FROM [MED_ֹOֹֹpportunities] o
        WHERE o.IsActive = 1
        AND o.DateForm >= CAST(GETDATE() as DATE)
        AND o.DateTo <= DATEADD(DAY, 365, GETDATE())
    `);
    
    return result.recordset;
}

/**
 * Get competitor prices for comparison (if available)
 */
async function getCompetitorPrices(pool, hotelId, checkIn, checkOut) {
    const result = await pool.request()
        .input('hotelId', hotelId)
        .input('checkIn', checkIn)
        .input('checkOut', checkOut)
        .query(`
            SELECT 
                MIN(Price) as MinPrice,
                MAX(Price) as MaxPrice,
                AVG(Price) as AvgPrice,
                COUNT(DISTINCT CompetitorName) as CompetitorCount
            FROM MED_CompetitorPrices
            WHERE HotelId = @hotelId
            AND CheckIn = @checkIn
            AND CheckOut = @checkOut
            AND ScrapedAt >= DATEADD(HOUR, -2, GETDATE())
            AND Available = 1
        `);
    
    return result.recordset[0];
}

/**
 * Capture price snapshot
 */
async function captureSnapshot(pool, opportunity) {
    try {
        // Get competitor data if available
        const competitorData = await getCompetitorPrices(
            pool, 
            opportunity.HotelId, 
            opportunity.DateFrom, 
            opportunity.DateTo
        );
        
        // Insert snapshot
        await pool.request()
            .input('opportunityId', opportunity.OpportunityId)
            .input('hotelId', opportunity.HotelId)
            .input('roomCategoryId', opportunity.RoomCategoryId)
            .input('boardId', opportunity.BoardId)
            .input('dateFrom', opportunity.DateFrom)
            .input('dateTo', opportunity.DateTo)
            .input('buyPrice', opportunity.BuyPrice)
            .input('sellPrice', opportunity.SellPrice)
            .input('marketPrice', competitorData?.AvgPrice || null)
            .input('competitorMinPrice', competitorData?.MinPrice || null)
            .input('competitorMaxPrice', competitorData?.MaxPrice || null)
            .input('availableRooms', opportunity.AvailableRooms)
            .input('totalRooms', opportunity.TotalRooms)
            .input('source', opportunity.Source || 'UNKNOWN')
            .query(`
                INSERT INTO MED_PriceHistory (
                    OpportunityId, HotelId, RoomCategoryId, BoardId,
                    DateFrom, DateTo, BuyPrice, SellPrice,
                    MarketPrice, CompetitorMinPrice, CompetitorMaxPrice,
                    AvailableRooms, TotalRooms, Source, SnapshotDate, IsActive
                )
                VALUES (
                    @opportunityId, @hotelId, @roomCategoryId, @boardId,
                    @dateFrom, @dateTo, @buyPrice, @sellPrice,
                    @marketPrice, @competitorMinPrice, @competitorMaxPrice,
                    @availableRooms, @totalRooms, @source, GETDATE(), 1
                )
            `);
        
        return { success: true };
        
    } catch (error) {
        logger.error(`[PriceSnapshot] Failed to capture snapshot for opportunity ${opportunity.OpportunityId}`, 
            { error: error.message });
        return { success: false, error: error.message };
    }
}

/**
 * Detect price changes since last snapshot
 */
async function detectPriceChanges(pool) {
    const result = await pool.request().query(`
        WITH LatestSnapshots AS (
            SELECT 
                OpportunityId,
                HotelId,
                BuyPrice,
                SellPrice,
                MarketPrice,
                SnapshotDate,
                ROW_NUMBER() OVER (PARTITION BY OpportunityId ORDER BY SnapshotDate DESC) as rn
            FROM MED_PriceHistory
            WHERE SnapshotDate >= DATEADD(HOUR, -2, GETDATE())
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
            l.BuyPrice,
            p.PrevBuyPrice,
            l.SellPrice,
            p.PrevSellPrice,
            l.MarketPrice,
            p.PrevMarketPrice,
            (l.BuyPrice - ISNULL(p.PrevBuyPrice, l.BuyPrice)) as BuyPriceChange,
            (l.SellPrice - ISNULL(p.PrevSellPrice, l.SellPrice)) as SellPriceChange,
            (l.MarketPrice - ISNULL(p.PrevMarketPrice, l.MarketPrice)) as MarketPriceChange
        FROM LatestSnapshots l
        LEFT JOIN PreviousSnapshots p ON l.OpportunityId = p.OpportunityId
        INNER JOIN Med_Hotels h ON l.HotelId = h.HotelId
        WHERE l.rn = 1
        AND (
            ABS(l.BuyPrice - ISNULL(p.PrevBuyPrice, l.BuyPrice)) > 0.01
            OR ABS(l.SellPrice - ISNULL(p.PrevSellPrice, l.SellPrice)) > 0.01
            OR ABS(l.MarketPrice - ISNULL(p.PrevMarketPrice, l.MarketPrice)) > 1.0
        )
    `);
    
    return result.recordset;
}

/**
 * Calculate daily metrics
 */
async function calculateDailyMetrics(pool) {
    try {
        const today = new Date();
        const metricDate = today.toISOString().split('T')[0];
        const currentHour = today.getHours();
        
        // Check if already calculated for this hour
        const existing = await pool.request()
            .input('metricDate', metricDate)
            .input('metricHour', currentHour)
            .query(`
                SELECT COUNT(*) as Count 
                FROM MED_PerformanceMetrics
                WHERE MetricDate = @metricDate 
                AND MetricHour = @metricHour
            `);
        
        if (existing.recordset[0].Count > 0) {
            logger.info('[PriceSnapshot] Metrics already calculated for this hour');
            return;
        }
        
        // Calculate metrics
        const metrics = await pool.request()
            .input('startTime', new Date(today.setHours(currentHour, 0, 0, 0)))
            .input('endTime', new Date(today.setHours(currentHour + 1, 0, 0, 0)))
            .query(`
                -- Opportunity metrics
                DECLARE @ActiveOpportunities INT = (
                    SELECT COUNT(*) FROM [MED_ֹOֹֹpportunities] WHERE IsActive = 1
                );
                
                DECLARE @NewOpportunities INT = (
                    SELECT COUNT(*) FROM [MED_ֹOֹֹpportunities] 
                    WHERE DateCreate >= @startTime AND DateCreate < @endTime
                );
                
                DECLARE @SoldOpportunities INT = (
                    SELECT COUNT(*) FROM [MED_ֹOֹֹpportunities] 
                    WHERE IsSale = 1 
                    AND Lastupdate >= @startTime AND Lastupdate < @endTime
                );
                
                -- Booking metrics
                DECLARE @TotalBookings INT = (
                    SELECT COUNT(*) FROM MED_Book 
                    WHERE DateInsert >= @startTime AND DateInsert < @endTime
                );
                
                DECLARE @BookingValue DECIMAL(18,2) = (
                    SELECT ISNULL(SUM(price), 0) FROM MED_Book 
                    WHERE DateInsert >= @startTime AND DateInsert < @endTime
                );
                
                -- Revenue metrics
                DECLARE @TotalRevenue DECIMAL(18,2) = (
                    SELECT ISNULL(SUM(PushPrice), 0) FROM [MED_ֹOֹֹpportunities]
                    WHERE IsSale = 1 
                    AND Lastupdate >= @startTime AND Lastupdate < @endTime
                );
                
                DECLARE @TotalCost DECIMAL(18,2) = (
                    SELECT ISNULL(SUM(Price), 0) FROM [MED_ֹOֹֹpportunities]
                    WHERE IsSale = 1 
                    AND Lastupdate >= @startTime AND Lastupdate < @endTime
                );
                
                -- Push metrics
                DECLARE @TotalPushes INT = (
                    SELECT COUNT(*) FROM MED_PushLog 
                    WHERE PushDate >= @startTime AND PushDate < @endTime
                );
                
                DECLARE @SuccessfulPushes INT = (
                    SELECT COUNT(*) FROM MED_PushLog 
                    WHERE PushDate >= @startTime AND PushDate < @endTime
                    AND Success = 1
                );
                
                DECLARE @AvgPushTime INT = (
                    SELECT ISNULL(AVG(ProcessingTimeMs), 0) FROM MED_PushLog 
                    WHERE PushDate >= @startTime AND PushDate < @endTime
                );
                
                -- Worker metrics
                DECLARE @BuyroomSuccesses INT = (
                    SELECT COUNT(*) FROM MED_ReservationLogs
                    WHERE Action = 'ROOM_PURCHASED'
                    AND CreatedAt >= @startTime AND CreatedAt < @endTime
                );
                
                DECLARE @BuyroomFailures INT = (
                    SELECT COUNT(*) FROM MED_ReservationLogs
                    WHERE Action = 'PURCHASE_FAILED'
                    AND CreatedAt >= @startTime AND CreatedAt < @endTime
                );
                
                DECLARE @AutoCancellations INT = (
                    SELECT COUNT(*) FROM MED_OpportunityLogs
                    WHERE Action = 'AUTO_CANCELLED'
                    AND CreatedAt >= @startTime AND CreatedAt < @endTime
                );
                
                -- Insert metrics
                INSERT INTO MED_PerformanceMetrics (
                    MetricDate, MetricHour,
                    ActiveOpportunities, NewOpportunities, SoldOpportunities,
                    TotalBookings, BookingValue,
                    TotalRevenue, TotalCost, 
                    GrossProfit, ProfitMargin,
                    TotalPushes, SuccessfulPushes, FailedPushes, AvgPushTime,
                    BuyroomSuccesses, BuyroomFailures, AutoCancellations,
                    CalculatedAt
                )
                VALUES (
                    CAST(@startTime as DATE), DATEPART(HOUR, @startTime),
                    @ActiveOpportunities, @NewOpportunities, @SoldOpportunities,
                    @TotalBookings, @BookingValue,
                    @TotalRevenue, @TotalCost,
                    (@TotalRevenue - @TotalCost),
                    CASE WHEN @TotalRevenue > 0 THEN ((@TotalRevenue - @TotalCost) / @TotalRevenue * 100) ELSE 0 END,
                    @TotalPushes, @SuccessfulPushes, (@TotalPushes - @SuccessfulPushes), @AvgPushTime,
                    @BuyroomSuccesses, @BuyroomFailures, @AutoCancellations,
                    GETDATE()
                );
            `);
        
        logger.info(`[PriceSnapshot] Calculated metrics for ${metricDate} hour ${currentHour}`);
        
    } catch (error) {
        logger.error('[PriceSnapshot] Failed to calculate metrics', { error: error.message });
    }
}

/**
 * Main worker function
 */
async function runWorker() {
    logger.info(`[PriceSnapshot] Starting worker at ${new Date().toISOString()}`);
    
    try {
        const pool = await getPool();
        
        // Get active opportunities
        const opportunities = await getActiveOpportunities(pool);
        logger.info(`[PriceSnapshot] Found ${opportunities.length} active opportunities`);
        
        let successCount = 0;
        let failCount = 0;
        
        // Capture snapshots
        for (const opportunity of opportunities) {
            const result = await captureSnapshot(pool, opportunity);
            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
        }
        
        logger.info(`[PriceSnapshot] Captured ${successCount} snapshots, ${failCount} failed`);
        
        // Detect significant price changes
        const priceChanges = await detectPriceChanges(pool);
        if (priceChanges.length > 0) {
            logger.info(`[PriceSnapshot] Detected ${priceChanges.length} price changes`);
            
            // Notify on significant changes (>10%)
            const significantChanges = priceChanges.filter(pc => 
                Math.abs(pc.SellPriceChange / pc.SellPrice * 100) > 10
            );
            
            if (significantChanges.length > 0) {
                await SlackService.sendNotification(
                    `🔔 *Price Alert*\n` +
                    `${significantChanges.length} opportunities with >10% price changes\n` +
                    significantChanges.slice(0, 5).map(pc => 
                        `• ${pc.HotelName}: €${pc.PrevSellPrice} → €${pc.SellPrice} (${((pc.SellPriceChange / pc.PrevSellPrice) * 100).toFixed(1)}%)`
                    ).join('\n')
                );
            }
        }
        
        // Calculate performance metrics
        await calculateDailyMetrics(pool);
        
        logger.info('[PriceSnapshot] Worker completed successfully');
        
    } catch (error) {
        logger.error('[PriceSnapshot] Worker error', { error: error.message, stack: error.stack });
        await SlackService.sendError({
            type: 'PriceSnapshot Worker Error',
            error: error.message
        });
    }
}

// Check if running as main script
if (require.main === module) {
    if (process.argv.includes('--once')) {
        logger.info('[PriceSnapshot] Running once...');
        runWorker().then(() => {
            logger.info('[PriceSnapshot] Done');
            process.exit(0);
        }).catch(err => {
            logger.error('[PriceSnapshot] Error', { error: err.message });
            process.exit(1);
        });
    } else {
        logger.info(`[PriceSnapshot] Starting scheduled worker (${CRON_SCHEDULE})`);
        cron.schedule(CRON_SCHEDULE, () => {
            runWorker().catch(err => {
                logger.error('[PriceSnapshot] Cron execution error', { error: err.message });
            });
        });
        
        // Run immediately on start
        runWorker();
    }
}

module.exports = { runWorker, captureSnapshot, detectPriceChanges };
