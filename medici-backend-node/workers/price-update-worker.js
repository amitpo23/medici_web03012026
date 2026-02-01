/**
 * Price Update Worker - Sync Prices to Zenith
 * 
 * Replaces LastPriceUpdate WebJob from .NET system
 * Pushes updated rates and availability to Zenith distribution channel
 * 
 * Run: npm run worker:priceupdate
 * Or schedule via cron/Azure WebJobs
 */

require('dotenv').config();
const cron = require('node-cron');
const ZenithPushService = require('../services/zenith-push-service');
const SlackService = require('../services/slack-service');
const { getPool } = require('../config/database');
const logger = require('../config/logger');
const { withRetry, withConcurrencyLimit } = require('../services/retry-helper');

const zenithPushService = new ZenithPushService();

// Run every 30 minutes
const CRON_SCHEDULE = '*/30 * * * *';

// How many days ahead to push rates
const DAYS_AHEAD = 365;

/**
 * Get hotels that need rate updates
 */
async function getHotelsForUpdate(pool) {
    const result = await pool.request().query(`
        SELECT DISTINCT
            h.id as Id,
            h.id as HotelId,
            h.HotelName,
            h.ZenithHotelCode,
            h.LastPriceSync
        FROM Med_Hotels h
        WHERE h.isActive = 1
        AND h.ZenithEnabled = 1
        AND (
            h.LastPriceSync IS NULL 
            OR h.LastPriceSync < DATEADD(HOUR, -1, GETDATE())
        )
        ORDER BY h.LastPriceSync ASC
    `);
    
    return result.recordset;
}

/**
 * Get rates for a hotel
 */
async function getHotelRates(pool, hotelId) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + DAYS_AHEAD);
    
    const result = await pool.request()
        .input('hotelId', hotelId)
        .input('startDate', startDate)
        .input('endDate', endDate)
        .query(`
            SELECT
                o.OpportunityId,
                o.DateForm as RateDate,
                o.PushPrice as Rate,
                o.PushBookingLimit as Available,
                CASE WHEN o.IsActive = 1 THEN 'ACTIVE' ELSE 'INACTIVE' END as Status,
                rc.PMS_Code as RoomCode,
                rc.Name as RoomName,
                b.BoardCode as MealPlan
            FROM [MED_ֹOֹֹpportunities] o
            INNER JOIN MED_RoomCategory rc ON o.CategoryId = rc.CategoryId
            INNER JOIN MED_Board b ON o.BoardId = b.BoardId
            WHERE o.DestinationsId = @hotelId
            AND o.DateForm BETWEEN @startDate AND @endDate
            AND o.IsActive = 1
            ORDER BY o.DateForm, rc.PMS_Code
        `);
    
    return result.recordset;
}

/**
 * Get availability for a hotel
 */
async function getHotelAvailability(pool, hotelId) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + DAYS_AHEAD);
    
    const result = await pool.request()
        .input('hotelId', hotelId)
        .input('startDate', startDate)
        .input('endDate', endDate)
        .query(`
            SELECT
                o.DateForm as AvailabilityDate,
                o.PushBookingLimit as AvailableRooms,
                o.PushBookingLimit as TotalRooms,
                0 as MinStay,
                0 as MaxStay,
                0 as StopSell,
                0 as ClosedToArrival,
                0 as ClosedToDeparture,
                rc.PMS_Code as RoomCode,
                rc.Name as RoomName
            FROM [MED_ֹOֹֹpportunities] o
            INNER JOIN MED_RoomCategory rc ON o.CategoryId = rc.CategoryId
            WHERE o.DestinationsId = @hotelId
            AND o.DateForm BETWEEN @startDate AND @endDate
            AND o.IsActive = 1
            ORDER BY o.DateForm, rc.PMS_Code
        `);
    
    return result.recordset;
}

/**
 * Group rates by date range for efficient pushing
 */
function groupRatesByRange(rates) {
    const groups = [];
    let currentGroup = null;
    
    for (const rate of rates) {
        if (!currentGroup || 
            currentGroup.roomCode !== rate.RoomCode ||
            currentGroup.rate !== rate.Rate) {
            
            if (currentGroup) {
                groups.push(currentGroup);
            }
            
            currentGroup = {
                roomCode: rate.RoomCode,
                rate: rate.Rate,
                startDate: rate.RateDate,
                endDate: rate.RateDate,
                mealPlan: rate.MealPlan
            };
        } else {
            currentGroup.endDate = rate.RateDate;
        }
    }
    
    if (currentGroup) {
        groups.push(currentGroup);
    }
    
    return groups;
}

/**
 * Group availability by date range
 */
function groupAvailabilityByRange(availability) {
    const groups = [];
    let currentGroup = null;
    
    for (const avail of availability) {
        if (!currentGroup || 
            currentGroup.roomCode !== avail.RoomCode ||
            currentGroup.availableRooms !== avail.AvailableRooms ||
            currentGroup.stopSell !== avail.StopSell) {
            
            if (currentGroup) {
                groups.push(currentGroup);
            }
            
            currentGroup = {
                roomCode: avail.RoomCode,
                availableRooms: avail.AvailableRooms,
                stopSell: avail.StopSell,
                minStay: avail.MinStay,
                maxStay: avail.MaxStay,
                closedToArrival: avail.ClosedToArrival,
                closedToDeparture: avail.ClosedToDeparture,
                startDate: avail.AvailabilityDate,
                endDate: avail.AvailabilityDate
            };
        } else {
            currentGroup.endDate = avail.AvailabilityDate;
        }
    }
    
    if (currentGroup) {
        groups.push(currentGroup);
    }
    
    return groups;
}

/**
 * Push rates and availability for a hotel
 */
async function syncHotelToZenith(pool, hotel) {
    logger.info(`[PriceUpdate] Syncing ${hotel.HotelName} (${hotel.ZenithHotelCode})`);

    try {
        // Get rates and availability
        const rates = await getHotelRates(pool, hotel.Id);
        const availability = await getHotelAvailability(pool, hotel.Id);

        logger.info(`[PriceUpdate] Found ${rates.length} rate records, ${availability.length} availability records`, { hotel: hotel.HotelName });

        // Group for efficient pushing
        const rateGroups = groupRatesByRange(rates);
        const availGroups = groupAvailabilityByRange(availability);

        logger.info(`[PriceUpdate] Grouped into ${rateGroups.length} rate ranges, ${availGroups.length} availability ranges`, { hotel: hotel.HotelName });

        let rateSuccess = 0;
        let rateFail = 0;
        let availSuccess = 0;
        let availFail = 0;

        // Push availability with retry and concurrency limit
        const availResults = await withConcurrencyLimit(availGroups, async (group) => {
            return withRetry(
                () => zenithPushService.pushAvailability({
                    hotelCode: hotel.ZenithHotelCode,
                    invTypeCode: group.roomCode,
                    startDate: group.startDate,
                    endDate: group.endDate,
                    available: group.availableRooms
                }),
                { maxRetries: 3, baseDelay: 1000, operationName: `Availability push ${hotel.HotelName}/${group.roomCode}` }
            );
        }, 5);

        for (const result of availResults) {
            if (result && result.error) {
                availFail++;
            } else {
                availSuccess++;
            }
        }

        // Push rates with retry and concurrency limit
        const rateResults = await withConcurrencyLimit(rateGroups, async (group) => {
            return withRetry(
                () => zenithPushService.pushRates({
                    hotelCode: hotel.ZenithHotelCode,
                    invTypeCode: group.roomCode,
                    startDate: group.startDate,
                    endDate: group.endDate,
                    amount: group.rate,
                    currency: 'EUR'
                }),
                { maxRetries: 3, baseDelay: 1000, operationName: `Rate push ${hotel.HotelName}/${group.roomCode}` }
            );
        }, 5);

        for (const result of rateResults) {
            if (result && result.error) {
                rateFail++;
            } else {
                rateSuccess++;
            }
        }

        // Update last sync time
        await pool.request()
            .input('hotelId', hotel.Id)
            .query(`
                UPDATE Med_Hotels
                SET LastPriceSync = GETDATE()
                WHERE id = @hotelId
            `);

        logger.info(`[PriceUpdate] Completed ${hotel.HotelName}: Rates ${rateSuccess}/${rateGroups.length}, Avail ${availSuccess}/${availGroups.length}`);

        return {
            success: true,
            rates: { success: rateSuccess, failed: rateFail },
            availability: { success: availSuccess, failed: availFail }
        };

    } catch (error) {
        logger.error(`[PriceUpdate] Failed to sync ${hotel.HotelName}`, { error: error.message });

        await SlackService.sendError({
            type: 'Price Sync Failed',
            hotel: hotel.HotelName,
            error: error.message
        });

        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Main worker function
 */
async function runWorker() {
    logger.info(`[PriceUpdate] Starting worker at ${new Date().toISOString()}`);

    try {
        const pool = await getPool();

        const hotels = await getHotelsForUpdate(pool);
        logger.info(`[PriceUpdate] Found ${hotels.length} hotels needing sync`);

        let successCount = 0;
        let failCount = 0;
        let totalRates = 0;
        let totalAvail = 0;

        for (const hotel of hotels) {
            const result = await syncHotelToZenith(pool, hotel);
            if (result.success) {
                successCount++;
                totalRates += result.rates.success;
                totalAvail += result.availability.success;
            } else {
                failCount++;
            }

            // Delay between hotels
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        logger.info(`[PriceUpdate] Completed: ${successCount} hotels synced, ${failCount} failed. Rates: ${totalRates}, Avail: ${totalAvail}`);

        // Send summary notification
        if (hotels.length > 0) {
            await SlackService.sendNotification(
                `📊 *Price Sync Summary*\n` +
                `Hotels synced: ${successCount}/${hotels.length}\n` +
                `Rate updates: ${totalRates}\n` +
                `Availability updates: ${totalAvail}`
            );
        }

    } catch (error) {
        logger.error('[PriceUpdate] Worker error', { error: error.message, stack: error.stack });
        await SlackService.sendError({
            type: 'PriceUpdate Worker Error',
            error: error.message
        });
    }
}

// Check if running as main script
if (require.main === module) {
    if (process.argv.includes('--once')) {
        logger.info('[PriceUpdate] Running once...');
        runWorker().then(() => {
            logger.info('[PriceUpdate] Done');
            process.exit(0);
        }).catch(err => {
            logger.error('[PriceUpdate] Error', { error: err.message });
            process.exit(1);
        });
    } else {
        logger.info(`[PriceUpdate] Starting scheduled worker (${CRON_SCHEDULE})`);
        cron.schedule(CRON_SCHEDULE, () => {
            runWorker().catch(err => {
                logger.error('[PriceUpdate] Cron execution error', { error: err.message });
            });
        });

        // Run immediately on start
        runWorker();
    }
}

module.exports = { runWorker, syncHotelToZenith };
