/**
 * Auto-Cancellation Worker
 * 
 * Replaces AutoCancellation WebJob from .NET system
 * Automatically cancels rooms that weren't sold within the deadline
 * 
 * Run: npm run worker:cancellation
 * Or schedule via cron/Azure WebJobs
 */

require('dotenv').config();
const cron = require('node-cron');
const sql = require('mssql');
const InnstantClient = require('../services/innstant-client');
const SlackService = require('../services/slack-service');
const dbConfig = require('../config/database');

const innstantClient = new InnstantClient();

// Run every hour
const CRON_SCHEDULE = '0 * * * *';

// Cancel rooms X hours before check-in if not sold
const CANCELLATION_DEADLINE_HOURS = 48;

/**
 * Get purchased rooms that haven't been sold and are past deadline
 */
async function getUnsoldRooms(pool) {
    const deadlineDate = new Date();
    deadlineDate.setHours(deadlineDate.getHours() + CANCELLATION_DEADLINE_HOURS);
    
    const result = await pool.request()
        .input('deadlineDate', deadlineDate)
        .query(`
            SELECT 
                o.Id as OpportunityId,
                o.SupplierBookingId,
                o.BuyPrice as PurchasePrice,
                o.DateFrom as CheckIn,
                o.DateTo as CheckOut,
                o.DateInsert as CreatedAt,
                h.id as HotelId,
                h.HotelName,
                rc.CategoryCode as RoomCode,
                rc.CategoryName as RoomName
            FROM MED_Opportunities o
            INNER JOIN Med_Hotels h ON o.HotelId = h.id
            INNER JOIN MED_RoomCategory rc ON o.CategoryId = rc.id
            WHERE o.Status = 'ACTIVE'
            AND o.ReservationId IS NULL
            AND o.DateFrom <= @deadlineDate
            AND o.AutoCancelEnabled = 1
            ORDER BY o.DateFrom ASC
        `);
    
    return result.recordset;
}

/**
 * Cancel a room purchase
 */
async function cancelRoom(pool, purchase) {
    console.log(`[AutoCancel] Processing opportunity ${purchase.OpportunityId} for ${purchase.HotelName}`);
    
    try {
        // Step 1: Cancel with Innstant (if supplier booking exists)
        let cancelResult = { cancellationId: 'N/A', refundAmount: 0 };
        
        if (purchase.SupplierBookingId) {
            cancelResult = await innstantClient.cancelBooking({
                bookingId: purchase.SupplierBookingId,
                reason: 'Auto-cancellation - room not sold before deadline'
            });
        }
        
        // Step 2: Update opportunity status
        await pool.request()
            .input('opportunityId', purchase.OpportunityId)
            .input('cancellationId', cancelResult.cancellationId || 'N/A')
            .query(`
                UPDATE MED_Opportunities 
                SET Status = 'CANCELLED',
                    CancellationId = @cancellationId,
                    CancelledAt = GETDATE(),
                    CancellationReason = 'Auto-cancellation - not sold before deadline',
                    UpdatedAt = GETDATE()
                WHERE Id = @opportunityId
            `);
        
        // Step 3: Log the cancellation
        await pool.request()
            .input('opportunityId', purchase.OpportunityId)
            .input('action', 'AUTO_CANCELLED')
            .input('details', JSON.stringify({
                cancellationId: cancelResult.cancellationId,
                refundAmount: cancelResult.refundAmount,
                purchasePrice: purchase.PurchasePrice,
                lostAmount: purchase.PurchasePrice - (cancelResult.refundAmount || 0)
            }))
            .query(`
                INSERT INTO MED_OpportunityLogs (OpportunityId, Action, Details, CreatedAt)
                VALUES (@opportunityId, @action, @details, GETDATE())
            `);
        
        // Send Slack notification
        await SlackService.sendCancellationNotification({
            type: 'auto-cancel',
            opportunityId: purchase.OpportunityId,
            hotelName: purchase.HotelName,
            roomName: purchase.RoomName,
            checkIn: purchase.CheckIn,
            checkOut: purchase.CheckOut,
            purchasePrice: purchase.PurchasePrice,
            refundAmount: cancelResult.refundAmount || 0
        });
        
        console.log(`[AutoCancel] ✓ Successfully cancelled opportunity ${purchase.OpportunityId}`);
        console.log(`  Refund: $${(cancelResult.refundAmount || 0).toFixed(2)}`);
        
        return {
            success: true,
            cancellationId: cancelResult.cancellationId
        };
        
    } catch (error) {
        console.error(`[AutoCancel] ✗ Failed to cancel opportunity ${purchase.OpportunityId}:`, error.message);
        
        // Log the error
        await pool.request()
            .input('opportunityId', purchase.OpportunityId)
            .input('action', 'CANCEL_FAILED')
            .input('details', JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            }))
            .query(`
                INSERT INTO MED_OpportunityLogs (OpportunityId, Action, Details, CreatedAt)
                VALUES (@opportunityId, @action, @details, GETDATE())
            `);
        
        // Send error notification
        await SlackService.sendError({
            type: 'AutoCancel Failed',
            opportunityId: purchase.OpportunityId,
            hotel: purchase.HotelName,
            error: error.message
        });
        
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get expiring rooms (warning before auto-cancel)
 */
async function getExpiringRooms(pool) {
    const warningDate = new Date();
    warningDate.setHours(warningDate.getHours() + CANCELLATION_DEADLINE_HOURS + 24);
    
    const deadlineDate = new Date();
    deadlineDate.setHours(deadlineDate.getHours() + CANCELLATION_DEADLINE_HOURS);
    
    const result = await pool.request()
        .input('warningDate', warningDate)
        .input('deadlineDate', deadlineDate)
        .query(`
            SELECT 
                o.Id as OpportunityId,
                o.BuyPrice as PurchasePrice,
                o.DateFrom as CheckIn,
                h.HotelName,
                rc.CategoryName as RoomName,
                DATEDIFF(HOUR, GETDATE(), o.DateFrom) - ${CANCELLATION_DEADLINE_HOURS} as HoursUntilCancel
            FROM MED_Opportunities o
            INNER JOIN Med_Hotels h ON o.HotelId = h.id
            INNER JOIN MED_RoomCategory rc ON o.CategoryId = rc.id
            WHERE o.Status = 'ACTIVE'
            AND o.ReservationId IS NULL
            AND o.DateFrom BETWEEN @deadlineDate AND @warningDate
            AND o.AutoCancelEnabled = 1
            AND o.WarningNotificationSent = 0
            ORDER BY o.DateFrom ASC
        `);
    
    return result.recordset;
}

/**
 * Send warning notifications for expiring rooms
 */
async function sendWarningNotifications(pool) {
    const expiringRooms = await getExpiringRooms(pool);
    
    if (expiringRooms.length > 0) {
        console.log(`[AutoCancel] Sending warnings for ${expiringRooms.length} expiring rooms`);
        
        for (const room of expiringRooms) {
            await SlackService.sendNotification(
                `⚠️ *Room Expiring Soon*\n` +
                `Hotel: ${room.HotelName}\n` +
                `Room: ${room.RoomName}\n` +
                `Check-in: ${new Date(room.CheckIn).toLocaleDateString()}\n` +
                `Purchase Price: $${room.PurchasePrice}\n` +
                `*Will auto-cancel in ${room.HoursUntilCancel} hours*`
            );
            
            // Mark warning as sent
            await pool.request()
                .input('opportunityId', room.OpportunityId)
                .query(`
                    UPDATE MED_Opportunities 
                    SET WarningNotificationSent = 1
                    WHERE Id = @opportunityId
                `);
        }
    }
}

/**
 * Main worker function
 */
async function runWorker() {
    console.log(`[AutoCancel] Starting worker at ${new Date().toISOString()}`);
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        // Send warnings first
        await sendWarningNotifications(pool);
        
        // Get and cancel unsold rooms
        const unsoldRooms = await getUnsoldRooms(pool);
        console.log(`[AutoCancel] Found ${unsoldRooms.length} unsold rooms past deadline`);
        
        let successCount = 0;
        let failCount = 0;
        let totalLost = 0;
        
        for (const room of unsoldRooms) {
            const result = await cancelRoom(pool, room);
            if (result.success) {
                successCount++;
            } else {
                failCount++;
                totalLost += room.PurchasePrice;
            }
            
            // Small delay between cancellations
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log(`[AutoCancel] Completed: ${successCount} cancelled, ${failCount} failed`);
        
        // Send summary if any cancellations
        if (successCount > 0 || failCount > 0) {
            await SlackService.sendNotification(
                `📊 *Auto-Cancellation Summary*\n` +
                `Cancelled: ${successCount}\n` +
                `Failed: ${failCount}\n` +
                `Total at risk: $${totalLost.toFixed(2)}`
            );
        }
        
    } catch (error) {
        console.error('[AutoCancel] Worker error:', error);
        await SlackService.sendError({
            type: 'AutoCancel Worker Error',
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
        console.log('[AutoCancel] Running once...');
        runWorker().then(() => {
            console.log('[AutoCancel] Done');
            process.exit(0);
        }).catch(err => {
            console.error('[AutoCancel] Error:', err);
            process.exit(1);
        });
    } else {
        console.log(`[AutoCancel] Starting scheduled worker (${CRON_SCHEDULE})`);
        cron.schedule(CRON_SCHEDULE, runWorker);
        
        // Run immediately on start
        runWorker();
    }
}

module.exports = { runWorker, cancelRoom };
