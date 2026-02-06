/**
 * Data Sync Worker - Fetches data from external B2B API every hour
 *
 * Purpose: Sync room availability, bookings, and dashboard data from external sources
 * Schedule: Every hour (0 * * * *)
 *
 * Endpoints to sync (configured via env):
 * - GetRoomsActive: Active room inventory
 * - GetDashboardInfo: Dashboard statistics
 * - GetBookings: Recent bookings
 * - GetOpportunities: Available opportunities
 */

const cron = require('node-cron');
const axios = require('axios');
const logger = require('../config/logger');
const { getPool, sql } = require('../config/database');
const socketService = require('../services/socket-service');

class DataSyncWorker {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
    this.lastSync = null;
    this.syncStats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastError: null
    };

    // External API configuration
    this.apiConfig = {
      baseUrl: process.env.B2B_API_URL || process.env.INNSTANT_SEARCH_URL,
      authToken: process.env.B2B_API_TOKEN || process.env.INNSTANT_ACCESS_TOKEN,
      applicationKey: process.env.B2B_APPLICATION_KEY || process.env.INNSTANT_APPLICATION_KEY
    };

    // Endpoints to sync
    this.endpoints = [
      {
        name: 'GetRoomsActive',
        path: '/api/hotels/GetRoomsActive',
        method: 'GET',
        handler: this.syncActiveRooms.bind(this),
        enabled: true
      },
      {
        name: 'GetDashboardInfo',
        path: '/api/hotels/GetDashboardInfo',
        method: 'GET',
        handler: this.syncDashboardInfo.bind(this),
        enabled: true
      },
      {
        name: 'GetBookings',
        path: '/api/hotels/GetBookings',
        method: 'GET',
        handler: this.syncBookings.bind(this),
        enabled: true
      },
      {
        name: 'GetOpportunities',
        path: '/api/hotels/GetOpportunities',
        method: 'GET',
        handler: this.syncOpportunities.bind(this),
        enabled: true
      }
    ];
  }

  /**
   * Get headers for API requests
   */
  getHeaders() {
    return {
      'aether-access-token': this.apiConfig.authToken,
      'aether-application-key': this.apiConfig.applicationKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Start the worker with cron schedule
   */
  start() {
    logger.info('[DataSyncWorker] Starting data sync worker...');

    // Run every hour at minute 0
    this.cronJob = cron.schedule('0 * * * *', async () => {
      await this.runSync();
    }, {
      scheduled: true,
      timezone: 'Asia/Jerusalem'
    });

    logger.info('[DataSyncWorker] Worker started - will sync every hour');

    // Run initial sync on startup
    this.runSync();
  }

  /**
   * Stop the worker
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    logger.info('[DataSyncWorker] Worker stopped');
  }

  /**
   * Main sync function - runs all enabled endpoints
   */
  async runSync() {
    if (this.isRunning) {
      logger.warn('[DataSyncWorker] Sync already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    this.syncStats.totalSyncs++;
    const startTime = Date.now();

    logger.info('[DataSyncWorker] ====== Starting hourly data sync ======');

    try {
      const results = [];

      for (const endpoint of this.endpoints) {
        if (!endpoint.enabled) {
          continue;
        }

        try {
          logger.info(`[DataSyncWorker] Syncing: ${endpoint.name}`);
          const result = await this.fetchAndProcess(endpoint);
          results.push({ name: endpoint.name, success: true, ...result });
        } catch (error) {
          logger.error(`[DataSyncWorker] Failed to sync ${endpoint.name}:`, { error: error.message });
          results.push({ name: endpoint.name, success: false, error: error.message });
        }
      }

      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      this.lastSync = new Date();
      this.syncStats.successfulSyncs++;

      logger.info(`[DataSyncWorker] ====== Sync complete ======`, {
        duration: `${duration}ms`,
        successful: successCount,
        failed: failCount
      });

      // Emit socket event for real-time UI update
      socketService.emit('data-sync-complete', {
        timestamp: this.lastSync,
        duration,
        results
      });

    } catch (error) {
      this.syncStats.failedSyncs++;
      this.syncStats.lastError = error.message;
      logger.error('[DataSyncWorker] Sync failed:', { error: error.message });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Fetch data from external API and process it
   */
  async fetchAndProcess(endpoint) {
    const url = `${this.apiConfig.baseUrl}${endpoint.path}`;

    const response = await axios({
      method: endpoint.method,
      url: url,
      headers: this.getHeaders(),
      timeout: 30000 // 30 second timeout
    });

    // Call the specific handler for this endpoint
    const processed = await endpoint.handler(response.data);

    return {
      recordsFetched: response.data?.length || (response.data ? 1 : 0),
      recordsProcessed: processed
    };
  }

  /**
   * Sync active rooms from external API
   */
  async syncActiveRooms(data) {
    if (!data || !Array.isArray(data)) {
      logger.warn('[DataSyncWorker] No room data received');
      return 0;
    }

    const pool = await getPool();
    let processedCount = 0;

    for (const room of data) {
      try {
        // Update or insert room data
        await pool.request()
          .input('hotelId', sql.Int, room.hotelId || room.HotelId)
          .input('roomId', sql.Int, room.roomId || room.RoomId)
          .input('roomType', sql.NVarChar, room.roomType || room.RoomType)
          .input('available', sql.Int, room.available || room.Available || 0)
          .input('price', sql.Decimal(10, 2), room.price || room.Price || 0)
          .input('lastUpdate', sql.DateTime, new Date())
          .query(`
            MERGE INTO MED_RoomAvailability AS target
            USING (SELECT @hotelId AS HotelId, @roomId AS RoomId) AS source
            ON target.HotelId = source.HotelId AND target.RoomId = source.RoomId
            WHEN MATCHED THEN
              UPDATE SET
                RoomType = @roomType,
                Available = @available,
                Price = @price,
                LastUpdate = @lastUpdate
            WHEN NOT MATCHED THEN
              INSERT (HotelId, RoomId, RoomType, Available, Price, LastUpdate)
              VALUES (@hotelId, @roomId, @roomType, @available, @price, @lastUpdate);
          `);
        processedCount++;
      } catch (error) {
        logger.error('[DataSyncWorker] Error processing room:', {
          roomId: room.roomId || room.RoomId,
          error: error.message
        });
      }
    }

    logger.info(`[DataSyncWorker] Synced ${processedCount} active rooms`);
    return processedCount;
  }

  /**
   * Sync dashboard info from external API
   */
  async syncDashboardInfo(data) {
    if (!data) {
      logger.warn('[DataSyncWorker] No dashboard data received');
      return 0;
    }

    const pool = await getPool();

    try {
      // Store dashboard snapshot
      await pool.request()
        .input('snapshotDate', sql.DateTime, new Date())
        .input('totalBookings', sql.Int, data.totalBookings || data.TotalBookings || 0)
        .input('totalRevenue', sql.Decimal(18, 2), data.totalRevenue || data.TotalRevenue || 0)
        .input('totalProfit', sql.Decimal(18, 2), data.totalProfit || data.TotalProfit || 0)
        .input('activeRooms', sql.Int, data.activeRooms || data.ActiveRooms || 0)
        .input('occupancyRate', sql.Decimal(5, 2), data.occupancyRate || data.OccupancyRate || 0)
        .input('jsonData', sql.NVarChar(sql.MAX), JSON.stringify(data))
        .query(`
          INSERT INTO MED_DashboardSnapshots
          (SnapshotDate, TotalBookings, TotalRevenue, TotalProfit, ActiveRooms, OccupancyRate, RawData)
          VALUES (@snapshotDate, @totalBookings, @totalRevenue, @totalProfit, @activeRooms, @occupancyRate, @jsonData)
        `);

      logger.info('[DataSyncWorker] Dashboard info synced');
      return 1;
    } catch (error) {
      logger.error('[DataSyncWorker] Error syncing dashboard info:', { error: error.message });
      return 0;
    }
  }

  /**
   * Sync bookings from external API
   */
  async syncBookings(data) {
    if (!data || !Array.isArray(data)) {
      logger.warn('[DataSyncWorker] No booking data received');
      return 0;
    }

    const pool = await getPool();
    let processedCount = 0;

    for (const booking of data) {
      try {
        // Check if booking exists
        const existingResult = await pool.request()
          .input('externalId', sql.NVarChar, String(booking.bookingId || booking.BookingId || booking.id))
          .query(`SELECT BookID FROM MED_Book WHERE ExternalBookingId = @externalId`);

        if (existingResult.recordset.length === 0) {
          // Insert new booking
          await pool.request()
            .input('externalId', sql.NVarChar, String(booking.bookingId || booking.BookingId || booking.id))
            .input('hotelId', sql.Int, booking.hotelId || booking.HotelId)
            .input('checkIn', sql.Date, booking.checkIn || booking.CheckIn)
            .input('checkOut', sql.Date, booking.checkOut || booking.CheckOut)
            .input('guestName', sql.NVarChar, booking.guestName || booking.GuestName || '')
            .input('price', sql.Decimal(10, 2), booking.price || booking.Price || 0)
            .input('status', sql.NVarChar, booking.status || booking.Status || 'confirmed')
            .input('syncDate', sql.DateTime, new Date())
            .query(`
              INSERT INTO MED_Book
              (ExternalBookingId, HotelId, DateFrom, DateTo, GuestName, Price, Status, SyncDate)
              VALUES (@externalId, @hotelId, @checkIn, @checkOut, @guestName, @price, @status, @syncDate)
            `);
          processedCount++;
        }
      } catch (error) {
        logger.error('[DataSyncWorker] Error processing booking:', {
          bookingId: booking.bookingId || booking.BookingId,
          error: error.message
        });
      }
    }

    logger.info(`[DataSyncWorker] Synced ${processedCount} new bookings`);
    return processedCount;
  }

  /**
   * Sync opportunities from external API
   */
  async syncOpportunities(data) {
    if (!data || !Array.isArray(data)) {
      logger.warn('[DataSyncWorker] No opportunity data received');
      return 0;
    }

    const pool = await getPool();
    let processedCount = 0;

    for (const opp of data) {
      try {
        await pool.request()
          .input('hotelId', sql.Int, opp.hotelId || opp.HotelId)
          .input('dateFrom', sql.Date, opp.dateFrom || opp.DateFrom)
          .input('dateTo', sql.Date, opp.dateTo || opp.DateTo)
          .input('sourcePrice', sql.Decimal(10, 2), opp.sourcePrice || opp.SourcePrice || 0)
          .input('syncDate', sql.DateTime, new Date())
          .query(`
            MERGE INTO MED_SyncedOpportunities AS target
            USING (SELECT @hotelId AS HotelId, @dateFrom AS DateFrom, @dateTo AS DateTo) AS source
            ON target.HotelId = source.HotelId
               AND target.DateFrom = source.DateFrom
               AND target.DateTo = source.DateTo
            WHEN MATCHED THEN
              UPDATE SET SourcePrice = @sourcePrice, LastSync = @syncDate
            WHEN NOT MATCHED THEN
              INSERT (HotelId, DateFrom, DateTo, SourcePrice, LastSync)
              VALUES (@hotelId, @dateFrom, @dateTo, @sourcePrice, @syncDate);
          `);
        processedCount++;
      } catch (error) {
        logger.error('[DataSyncWorker] Error processing opportunity:', { error: error.message });
      }
    }

    logger.info(`[DataSyncWorker] Synced ${processedCount} opportunities`);
    return processedCount;
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      stats: this.syncStats,
      endpoints: this.endpoints.map(e => ({
        name: e.name,
        enabled: e.enabled,
        path: e.path
      }))
    };
  }

  /**
   * Manual trigger for immediate sync
   */
  async triggerSync() {
    logger.info('[DataSyncWorker] Manual sync triggered');
    return await this.runSync();
  }
}

// Export singleton instance
module.exports = DataSyncWorker;
