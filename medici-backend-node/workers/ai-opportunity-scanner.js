/**
 * AI Opportunity Scanner Worker
 * 
 * Continuously scans market for profitable opportunities using AI
 * Auto-creates opportunities that meet confidence and profitability thresholds
 * 
 * Runs every 4 hours to discover new opportunities
 */

require('dotenv').config();
const cron = require('node-cron');
const { getAIDiscoveryService } = require('../services/ai-opportunity-discovery');
const { getPool } = require('../config/database');
const logger = require('../config/logger');
const SlackService = require('../services/slack-service');

// Run every 4 hours
const CRON_SCHEDULE = '0 */4 * * *';

/**
 * Get hotels to scan
 * Prioritize hotels with recent activity
 */
async function getHotelsToScan(pool) {
    const result = await pool.request().query(`
        SELECT TOP 20
            h.HotelId,
            h.name as HotelName,
            h.InnstantHotelId,
            COUNT(DISTINCT o.OpportunityId) as ActiveOpportunities,
            MAX(o.DateCreate) as LastOpportunityDate,
            ISNULL(SUM(CASE WHEN o.IsSale = 1 THEN 1 ELSE 0 END), 0) as SoldCount
        FROM Med_Hotels h
        LEFT JOIN [MED_ֹOֹֹpportunities] o ON h.HotelId = o.DestinationsId
            AND o.DateCreate >= DATEADD(DAY, -30, GETDATE())
        WHERE h.isActive = 1
        AND h.InnstantHotelId IS NOT NULL
        GROUP BY h.HotelId, h.name, h.InnstantHotelId
        ORDER BY 
            SoldCount DESC,
            ActiveOpportunities DESC,
            LastOpportunityDate DESC
    `);
    
    return result.recordset;
}

/**
 * Scan hotel for opportunities
 */
async function scanHotel(discovery, hotel) {
    logger.info(`[AI Scanner] Scanning hotel ${hotel.HotelName} (${hotel.HotelId})`);
    
    try {
        // Scan market for this hotel
        const scan = await discovery.scanMarket({
            hotelId: hotel.HotelId,
            daysAhead: 90,
            riskTolerance: 'medium'
        });
        
        if (!scan.success) {
            logger.info(`[AI Scanner] No opportunities found for ${hotel.HotelName}`);
            return {
                hotelId: hotel.HotelId,
                hotelName: hotel.HotelName,
                found: 0,
                created: 0
            };
        }
        
        // Filter high-confidence opportunities
        const highConfidence = scan.opportunities.filter(opp => 
            opp.aiConfidence >= 0.75 && opp.priorityScore >= 60
        );
        
        if (highConfidence.length === 0) {
            logger.info(`[AI Scanner] No high-confidence opportunities for ${hotel.HotelName}`);
            return {
                hotelId: hotel.HotelId,
                hotelName: hotel.HotelName,
                found: scan.opportunities.length,
                created: 0
            };
        }
        
        // Batch create opportunities
        const createResults = await discovery.batchCreateOpportunities(highConfidence, {
            autoActivateThreshold: 0.85,
            maxCreate: 10
        });
        
        logger.info(`[AI Scanner] Created ${createResults.created} opportunities for ${hotel.HotelName}`, {
            found: highConfidence.length,
            created: createResults.created,
            skipped: createResults.skipped,
            failed: createResults.failed
        });
        
        return {
            hotelId: hotel.HotelId,
            hotelName: hotel.HotelName,
            found: highConfidence.length,
            created: createResults.created,
            skipped: createResults.skipped,
            failed: createResults.failed,
            topOpportunities: createResults.details.slice(0, 3)
        };
        
    } catch (error) {
        logger.error(`[AI Scanner] Error scanning ${hotel.HotelName}`, { error: error.message });
        return {
            hotelId: hotel.HotelId,
            hotelName: hotel.HotelName,
            error: error.message
        };
    }
}

/**
 * Update AI opportunity fields in database (migration helper)
 */
async function ensureAIColumns(pool) {
    try {
        // Check if AI columns exist
        const check = await pool.request().query(`
            SELECT COUNT(*) as Count
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'MED_ֹOֹֹpportunities'
            AND COLUMN_NAME = 'AIGenerated'
        `);
        
        if (check.recordset[0].Count === 0) {
            logger.info('[AI Scanner] Adding AI columns to opportunities table');
            
            await pool.request().query(`
                ALTER TABLE [MED_ֹOֹֹpportunities] 
                ADD AIGenerated BIT DEFAULT 0,
                    AIConfidence DECIMAL(5,4) NULL,
                    AIPriorityScore INT NULL,
                    AIRiskLevel VARCHAR(10) NULL,
                    CreatedBy VARCHAR(50) NULL
            `);
            
            logger.info('[AI Scanner] AI columns added successfully');
        }
    } catch (error) {
        logger.warn('[AI Scanner] Could not add AI columns (may already exist)', { error: error.message });
    }
}

/**
 * Main worker function
 */
async function runWorker() {
    logger.info(`[AI Scanner] Starting worker at ${new Date().toISOString()}`);
    
    try {
        const pool = await getPool();
        const discovery = getAIDiscoveryService();
        
        // Ensure AI columns exist (only needed once)
        await ensureAIColumns(pool);
        
        // Get hotels to scan
        const hotels = await getHotelsToScan(pool);
        logger.info(`[AI Scanner] Scanning ${hotels.length} hotels`);
        
        if (hotels.length === 0) {
            logger.info('[AI Scanner] No hotels to scan');
            return;
        }
        
        const results = [];
        let totalFound = 0;
        let totalCreated = 0;
        let totalSkipped = 0;
        let totalFailed = 0;
        
        // Scan each hotel
        for (const hotel of hotels) {
            const result = await scanHotel(discovery, hotel);
            results.push(result);
            
            if (!result.error) {
                totalFound += result.found || 0;
                totalCreated += result.created || 0;
                totalSkipped += result.skipped || 0;
                totalFailed += result.failed || 0;
            }
            
            // Small delay between hotels
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Log summary
        logger.info('[AI Scanner] Scan complete', {
            hotelsScanned: hotels.length,
            opportunitiesFound: totalFound,
            created: totalCreated,
            skipped: totalSkipped,
            failed: totalFailed
        });
        
        // Send Slack notification if opportunities created
        if (totalCreated > 0) {
            const topResults = results
                .filter(r => r.created > 0)
                .sort((a, b) => b.created - a.created)
                .slice(0, 5);
            
            let message = `🤖 *AI Opportunity Scanner*\n\n`;
            message += `Scanned ${hotels.length} hotels\n`;
            message += `Found ${totalFound} opportunities\n`;
            message += `✅ Created ${totalCreated} new opportunities\n`;
            
            if (topResults.length > 0) {
                message += `\n*Top Hotels:*\n`;
                topResults.forEach(r => {
                    message += `• ${r.hotelName}: ${r.created} created`;
                    if (r.topOpportunities && r.topOpportunities.length > 0) {
                        const best = r.topOpportunities[0];
                        message += ` (best: €${best.profit.toFixed(0)} profit)`;
                    }
                    message += `\n`;
                });
            }
            
            await SlackService.sendNotification(message);
        }
        
    } catch (error) {
        logger.error('[AI Scanner] Worker error', { error: error.message, stack: error.stack });
        await SlackService.sendError({
            type: 'AI Scanner Worker Error',
            error: error.message
        });
    }
}

// Check if running as main script
if (require.main === module) {
    if (process.argv.includes('--once')) {
        logger.info('[AI Scanner] Running once...');
        runWorker().then(() => {
            logger.info('[AI Scanner] Done');
            process.exit(0);
        }).catch(err => {
            logger.error('[AI Scanner] Error', { error: err.message });
            process.exit(1);
        });
    } else {
        logger.info(`[AI Scanner] Starting scheduled worker (${CRON_SCHEDULE})`);
        cron.schedule(CRON_SCHEDULE, () => {
            runWorker().catch(err => {
                logger.error('[AI Scanner] Cron execution error', { error: err.message });
            });
        });
        
        // Run immediately on start
        runWorker();
    }
}

module.exports = { runWorker, scanHotel };
