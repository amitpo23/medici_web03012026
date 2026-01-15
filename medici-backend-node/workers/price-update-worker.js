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
const sql = require('mssql');
const ZenithPushService = require('../services/zenith-push-service');
const SlackService = require('../services/slack-service');
const dbConfig = require('../config/database');

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
                o.Id as OpportunityId,
                o.DateFrom as RateDate,
                o.PushPrice as Rate,
                o.MaxRooms as Available,
                o.Status,
                rc.CategoryCode as RoomCode,
                rc.CategoryName as RoomName,
                b.BoardName as MealPlan
            FROM MED_Opportunities o
            INNER JOIN MED_RoomCategory rc ON o.CategoryId = rc.id
            INNER JOIN MED_Board b ON o.BoardId = b.id
            WHERE o.HotelId = @hotelId
            AND o.DateFrom BETWEEN @startDate AND @endDate
            AND o.Status = 'ACTIVE'
            ORDER BY o.DateFrom, rc.CategoryCode
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
                o.DateFrom as AvailabilityDate,
                o.MaxRooms as AvailableRooms,
                o.MaxRooms as TotalRooms,
                0 as MinStay,
                0 as MaxStay,
                0 as StopSell,
                0 as ClosedToArrival,
                0 as ClosedToDeparture,
                rc.CategoryCode as RoomCode,
                rc.CategoryName as RoomName
            FROM MED_Opportunities o
            INNER JOIN MED_RoomCategory rc ON o.CategoryId = rc.id
            WHERE o.HotelId = @hotelId
            AND o.DateFrom BETWEEN @startDate AND @endDate
            AND o.Status = 'ACTIVE'
            ORDER BY o.DateFrom, rc.CategoryCode
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
    console.log(`[PriceUpdate] Syncing ${hotel.HotelName} (${hotel.ZenithHotelCode})`);
    
    try {
        // Get rates and availability
        const rates = await getHotelRates(pool, hotel.Id);
        const availability = await getHotelAvailability(pool, hotel.Id);
        
        console.log(`  Found ${rates.length} rate records, ${availability.length} availability records`);
        
        // Group for efficient pushing
        const rateGroups = groupRatesByRange(rates);
        const availGroups = groupAvailabilityByRange(availability);
        
        console.log(`  Grouped into ${rateGroups.length} rate ranges, ${availGroups.length} availability ranges`);
        
        let rateSuccess = 0;
        let rateFail = 0;
        let availSuccess = 0;
        let availFail = 0;
        
        // Push availability first
        for (const group of availGroups) {
            try {
                await zenithPushService.pushAvailability({
                    hotelCode: hotel.ZenithHotelCode,
                    invTypeCode: group.roomCode,
                    startDate: group.startDate,
                    endDate: group.endDate,
                    available: group.availableRooms
                });
                availSuccess++;
            } catch (err) {
                console.error(`  Availability push failed: ${err.message}`);
                availFail++;
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Push rates
        for (const group of rateGroups) {
            try {
                await zenithPushService.pushRates({
                    hotelCode: hotel.ZenithHotelCode,
                    invTypeCode: group.roomCode,
                    startDate: group.startDate,
                    endDate: group.endDate,
                    amount: group.rate,
                    currency: 'EUR'
                });
                rateSuccess++;
            } catch (err) {
                console.error(`  Rate push failed: ${err.message}`);
                rateFail++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Update last sync time
        await pool.request()
            .input('hotelId', hotel.Id)
            .query(`
                UPDATE Med_Hotels 
                SET LastPriceSync = GETDATE()
                WHERE id = @hotelId
            `);
        
        console.log(`[PriceUpdate] ✓ ${hotel.HotelName}: Rates ${rateSuccess}/${rateGroups.length}, Avail ${availSuccess}/${availGroups.length}`);
        
        return {
            success: true,
            rates: { success: rateSuccess, failed: rateFail },
            availability: { success: availSuccess, failed: availFail }
        };
        
    } catch (error) {
        console.error(`[PriceUpdate] ✗ Failed to sync ${hotel.HotelName}:`, error.message);
        
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
    console.log(`[PriceUpdate] Starting worker at ${new Date().toISOString()}`);
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const hotels = await getHotelsForUpdate(pool);
        console.log(`[PriceUpdate] Found ${hotels.length} hotels needing sync`);
        
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
        
        console.log(`[PriceUpdate] Completed: ${successCount} hotels synced, ${failCount} failed`);
        console.log(`  Total rates pushed: ${totalRates}`);
        console.log(`  Total availability pushed: ${totalAvail}`);
        
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
        console.error('[PriceUpdate] Worker error:', error);
        await SlackService.sendError({
            type: 'PriceUpdate Worker Error',
            error: error.message
        });
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

// Check if running as main script
if (require.main === module) {
    if (process.argv.includes('--once')) {
        console.log('[PriceUpdate] Running once...');
        runWorker().then(() => {
            console.log('[PriceUpdate] Done');
            process.exit(0);
        }).catch(err => {
            console.error('[PriceUpdate] Error:', err);
            process.exit(1);
        });
    } else {
        console.log(`[PriceUpdate] Starting scheduled worker (${CRON_SCHEDULE})`);
        cron.schedule(CRON_SCHEDULE, runWorker);
        
        // Run immediately on start
        runWorker();
    }
}

module.exports = { runWorker, syncHotelToZenith };
