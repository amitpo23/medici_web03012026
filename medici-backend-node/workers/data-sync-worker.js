/**
 * Data Sync Worker - Fetches data from Medici .NET Backend API every hour
 *
 * Purpose: Sync room availability, bookings, dashboard data from production .NET backend
 * Schedule: Every hour (0 * * * *)
 *
 * Base URL: https://medici-backend.azurewebsites.net
 * Auth: Basic Auth via /api/auth/OnlyNightUsersTokenAPI
 *
 * Endpoints to sync (all POST):
 * - /api/hotels/GetRoomsActive: Active room inventory
 * - /api/hotels/GetDashboardInfo: Dashboard statistics
 * - /api/hotels/GetRoomsSales: Sold rooms
 * - /api/hotels/GetOpportunities: Available opportunities
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
    this.authToken = null;
    this.tokenExpiry = null;
    this.syncStats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastError: null
    };

    // Medici .NET Backend API configuration
    this.apiConfig = {
      baseUrl: process.env.MEDICI_DOTNET_API_URL || 'https://medici-backend.azurewebsites.net',
      clientSecret: process.env.MEDICI_API_CLIENT_SECRET || ''
    };

    // Endpoints to sync (all use POST method per Swagger spec)
    this.endpoints = [
      {
        name: 'GetRoomsActive',
        path: '/api/hotels/GetRoomsActive',
        method: 'POST',
        handler: this.syncActiveRooms.bind(this),
        enabled: true,
        requestBody: {} // RoomsActiveApiParams - can filter by date, hotel, etc.
      },
      {
        name: 'GetDashboardInfo',
        path: '/api/hotels/GetDashboardInfo',
        method: 'POST',
        handler: this.syncDashboardInfo.bind(this),
        enabled: true,
        requestBody: {} // DashboardApiParams
      },
      {
        name: 'GetRoomsSales',
        path: '/api/hotels/GetRoomsSales',
        method: 'POST',
        handler: this.syncRoomsSales.bind(this),
        enabled: true,
        requestBody: {}
      },
      {
        name: 'GetOpportunities',
        path: '/api/hotels/GetOpportunities',
        method: 'POST',
        handler: this.syncOpportunities.bind(this),
        enabled: true,
        requestBody: {}
      }
    ];
  }

  /**
   * Authenticate with the .NET API and get token
   */
  async authenticate() {
    try {
      // Check if we have a valid token
      if (this.authToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        return this.authToken;
      }

      logger.info('[DataSyncWorker] Authenticating with Medici .NET API...');

      const formData = new FormData();
      formData.append('client_secret', this.apiConfig.clientSecret);

      const response = await axios.post(
        `${this.apiConfig.baseUrl}/api/auth/OnlyNightUsersTokenAPI`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: 30000
        }
      );

      this.authToken = response.data.token || response.data.access_token || response.data;
      // Token valid for 1 hour, refresh 5 minutes early
      this.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);

      logger.info('[DataSyncWorker] Authentication successful');
      return this.authToken;
    } catch (error) {
      logger.error('[DataSyncWorker] Authentication failed:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get headers for API requests
   */
  getHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
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
    logger.info(`[DataSyncWorker] API Base URL: ${this.apiConfig.baseUrl}`);

    try {
      // Authenticate first
      if (this.apiConfig.clientSecret) {
        await this.authenticate();
      } else {
        logger.warn('[DataSyncWorker] No client_secret configured, skipping authentication');
      }

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
          logger.error(`[DataSyncWorker] Failed to sync ${endpoint.name}:`, {
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
          });
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
   * Fetch data from .NET API and process it
   * All endpoints use POST method per Swagger spec
   */
  async fetchAndProcess(endpoint) {
    const url = `${this.apiConfig.baseUrl}${endpoint.path}`;

    const response = await axios({
      method: endpoint.method,
      url: url,
      headers: this.getHeaders(),
      data: endpoint.requestBody || {},
      timeout: 60000 // 60 second timeout for large datasets
    });

    // Handle different response structures
    const data = response.data?.data || response.data?.Data || response.data;

    // Call the specific handler for this endpoint
    const processed = await endpoint.handler(data);

    return {
      recordsFetched: Array.isArray(data) ? data.length : (data ? 1 : 0),
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
   * Sync sold rooms from .NET API (GetRoomsSales)
   */
  async syncRoomsSales(data) {
    if (!data || !Array.isArray(data)) {
      logger.warn('[DataSyncWorker] No room sales data received');
      return 0;
    }

    const pool = await getPool();
    let processedCount = 0;

    for (const sale of data) {
      try {
        // Log the synced sale for tracking
        await pool.request()
          .input('syncDate', sql.DateTime, new Date())
          .input('saleId', sql.Int, sale.id || sale.Id || sale.prebookId || sale.PrebookId)
          .input('hotelId', sql.Int, sale.hotelId || sale.HotelId)
          .input('hotelName', sql.NVarChar, sale.hotelName || sale.HotelName || '')
          .input('checkIn', sql.Date, sale.checkIn || sale.CheckIn || sale.dateFrom || sale.DateFrom)
          .input('checkOut', sql.Date, sale.checkOut || sale.CheckOut || sale.dateTo || sale.DateTo)
          .input('buyPrice', sql.Decimal(10, 2), sale.buyPrice || sale.BuyPrice || sale.price || sale.Price || 0)
          .input('pushPrice', sql.Decimal(10, 2), sale.pushPrice || sale.PushPrice || 0)
          .input('profit', sql.Decimal(10, 2), (sale.pushPrice || sale.PushPrice || 0) - (sale.buyPrice || sale.BuyPrice || sale.price || sale.Price || 0))
          .input('status', sql.NVarChar, sale.status || sale.Status || 'sold')
          .input('jsonData', sql.NVarChar(sql.MAX), JSON.stringify(sale))
          .query(`
            MERGE INTO MED_SyncedRoomSales AS target
            USING (SELECT @saleId AS SaleId) AS source
            ON target.SaleId = source.SaleId
            WHEN MATCHED THEN
              UPDATE SET
                HotelId = @hotelId,
                HotelName = @hotelName,
                CheckIn = @checkIn,
                CheckOut = @checkOut,
                BuyPrice = @buyPrice,
                PushPrice = @pushPrice,
                Profit = @profit,
                Status = @status,
                LastSync = @syncDate,
                RawData = @jsonData
            WHEN NOT MATCHED THEN
              INSERT (SaleId, HotelId, HotelName, CheckIn, CheckOut, BuyPrice, PushPrice, Profit, Status, LastSync, RawData)
              VALUES (@saleId, @hotelId, @hotelName, @checkIn, @checkOut, @buyPrice, @pushPrice, @profit, @status, @syncDate, @jsonData);
          `);
        processedCount++;
      } catch (error) {
        logger.error('[DataSyncWorker] Error processing room sale:', {
          saleId: sale.id || sale.Id,
          error: error.message
        });
      }
    }

    logger.info(`[DataSyncWorker] Synced ${processedCount} room sales`);
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
