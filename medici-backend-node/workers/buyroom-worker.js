/**
 * BuyRoom Worker - Automatic Room Purchase
 * 
 * Replaces BuyRoomWebJob from .NET system
 * Runs on schedule to automatically purchase rooms from Innstant 
 * when reservations are confirmed from Zenith
 * 
 * Run: npm run worker:buyroom
 * Or schedule via cron/Azure WebJobs
 */

require('dotenv').config();
const cron = require('node-cron');
const sql = require('mssql');
const InnstantClient = require('../services/innstant-client');
const SlackService = require('../services/slack-service');
const dbConfig = require('../config/database');
const logger = require('../config/logger');

const innstantClient = new InnstantClient();

// Run every 5 minutes
const CRON_SCHEDULE = '*/5 * * * *';

/**
 * Get pending reservations that need room purchase
 */
async function getPendingReservations(pool) {
    const result = await pool.request().query(`
        SELECT 
            r.Id as ReservationId,
            r.CustomerName as GuestName,
            ISNULL(r.CustomerEmail, 'noreply@medici.com') as GuestEmail,
            r.datefrom as CheckIn,
            r.dateto as CheckOut,
            ISNULL(r.AdultCount, 2) as Adults,
            ISNULL(r.ChildrenCount, 0) as Children,
            r.AmountAfterTax as TotalPrice,
            r.ResStatus as Status,
            r.uniqueID as ExternalReservationId,
            h.HotelId,
            h.name as HotelName,
            h.InnstantHotelId,
            r.RoomTypeCode as RoomCode
        FROM Med_Reservation r
        INNER JOIN Med_Hotels h ON r.HotelCode = h.ZenithHotelCode
        WHERE r.ResStatus = 'Commit'
        AND r.SupplierBookingId IS NULL
        AND ISNULL(r.AutoPurchaseEnabled, 1) = 1
        AND r.IsCanceled = 0
        AND h.InnstantHotelId IS NOT NULL
        ORDER BY r.datefrom ASC
    `);
    
    return result.recordset;
}

/**
 * Purchase room from Innstant for a reservation
 */
async function purchaseRoom(pool, reservation) {
    logger.info(`[BuyRoom] Processing reservation ${reservation.ReservationId} for ${reservation.HotelName}`);
    
    try {
        // Step 1: Search for available rooms
        const searchParams = {
            hotelId: reservation.InnstantHotelId,
            dateFrom: reservation.CheckIn.toISOString().split('T')[0],
            dateTo: reservation.CheckOut.toISOString().split('T')[0],
            adults: reservation.Adults,
            children: reservation.Children ? [reservation.Children] : []
        };
        
        const searchResult = await innstantClient.searchHotels(searchParams);
        
        if (!searchResult || searchResult.length === 0) {
            throw new Error('No availability found on Innstant');
        }
        
        // Find matching room from search results
        const room = searchResult.find(r => r.roomCode === reservation.RoomCode) || searchResult[0];
        
        if (!room || !room.prebook_id) {
            throw new Error('No matching room with prebook_id found');
        }
        
        // Step 2: Complete booking using prebook_id
        const bookingResult = await innstantClient.book({
            prebookId: room.prebook_id,
            guestName: reservation.GuestName,
            guestEmail: reservation.GuestEmail,
            dateFrom: reservation.CheckIn.toISOString().split('T')[0],
            dateTo: reservation.CheckOut.toISOString().split('T')[0]
        });
        
        // Step 3: Update reservation with supplier booking ID
        await pool.request()
            .input('reservationId', reservation.ReservationId)
            .input('supplierBookingId', bookingResult.bookingId || bookingResult.confirmationNumber)
            .input('supplierConfirmation', bookingResult.confirmationNumber)
            .input('supplierPrice', bookingResult.totalPrice || bookingResult.price)
            .query(`
                UPDATE Med_Reservation 
                SET SupplierBookingId = @supplierBookingId,
                    SupplierConfirmation = @supplierConfirmation,
                    SupplierPrice = @supplierPrice,
                    PurchasedAt = GETDATE(),
                    UpdatedAt = GETDATE()
                WHERE Id = @reservationId
            `);
        
        // Step 4: Log the transaction
        await pool.request()
            .input('reservationId', reservation.ReservationId)
            .input('action', 'ROOM_PURCHASED')
            .input('details', JSON.stringify({
                supplierBookingId: bookingResult.bookingId || bookingResult.confirmationNumber,
                confirmationNumber: bookingResult.confirmationNumber,
                supplierPrice: bookingResult.totalPrice || bookingResult.price,
                sellingPrice: reservation.TotalPrice,
                profit: reservation.TotalPrice - (bookingResult.totalPrice || bookingResult.price)
            }))
            .query(`
                INSERT INTO MED_ReservationLogs (ReservationId, Action, Details, CreatedAt)
                VALUES (@reservationId, @action, @details, GETDATE())
            `);
        
        // Send Slack notification
        await SlackService.sendPurchaseNotification({
            reservationId: reservation.ReservationId,
            hotelName: reservation.HotelName,
            guestName: reservation.GuestName,
            checkIn: reservation.CheckIn,
            checkOut: reservation.CheckOut,
            supplierBookingId: bookingResult.bookingId,
            sellingPrice: reservation.TotalPrice,
            purchasePrice: bookingResult.totalPrice,
            profit: reservation.TotalPrice - bookingResult.totalPrice
        });
        
        logger.info(`[BuyRoom] Successfully purchased room for reservation ${reservation.ReservationId}`);
        logger.info(`  Supplier Booking: ${bookingResult.bookingId || bookingResult.confirmationNumber}`);
        logger.info(`  Profit: $${(reservation.TotalPrice - (bookingResult.totalPrice || bookingResult.price)).toFixed(2)}`);
        
        return {
            success: true,
            bookingId: bookingResult.bookingId || bookingResult.confirmationNumber
        };
        
    } catch (error) {
        logger.error(`[BuyRoom] Failed to purchase room for reservation ${reservation.ReservationId}:`, { error: error.message });
        
        // Log the error
        await pool.request()
            .input('reservationId', reservation.ReservationId)
            .input('action', 'PURCHASE_FAILED')
            .input('details', JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            }))
            .query(`
                INSERT INTO MED_ReservationLogs (ReservationId, Action, Details, CreatedAt)
                VALUES (@reservationId, @action, @details, GETDATE())
            `);
        
        // Send error notification
        await SlackService.sendError({
            type: 'BuyRoom Failed',
            reservationId: reservation.ReservationId,
            hotel: reservation.HotelName,
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
    logger.info(`[BuyRoom] Starting worker at ${new Date().toISOString()}`);
    
    let pool;
    try {
        pool = await sql.connect(dbConfig);
        
        const pendingReservations = await getPendingReservations(pool);
        logger.info(`[BuyRoom] Found ${pendingReservations.length} pending reservations`);
        
        let successCount = 0;
        let failCount = 0;
        
        for (const reservation of pendingReservations) {
            const result = await purchaseRoom(pool, reservation);
            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
            
            // Small delay between purchases to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        logger.info(`[BuyRoom] Completed: ${successCount} success, ${failCount} failed`);
        
    } catch (error) {
        logger.error('[BuyRoom] Worker error:', { error: error.message });
        await SlackService.sendError({
            type: 'BuyRoom Worker Error',
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
    // Check for --once flag to run once and exit
    if (process.argv.includes('--once')) {
        logger.info('[BuyRoom] Running once...');
        runWorker().then(() => {
            logger.info('[BuyRoom] Done');
            process.exit(0);
        }).catch(err => {
            logger.error('[BuyRoom] Error:', { error: err.message });
            process.exit(1);
        });
    } else {
        // Run on schedule
        logger.info(`[BuyRoom] Starting scheduled worker (${CRON_SCHEDULE})`);
        cron.schedule(CRON_SCHEDULE, runWorker);
        
        // Run immediately on start
        runWorker();
    }
}

module.exports = { runWorker, purchaseRoom };
