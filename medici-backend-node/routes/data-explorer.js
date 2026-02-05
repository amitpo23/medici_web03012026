/**
 * Data Explorer API - Access all database tables
 * Provides comprehensive access to all 70 tables in the database
 */

const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const { getPool } = require('../config/database');

/**
 * GET /data-explorer/tables - List all tables with row counts
 */
router.get('/tables', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        t.name AS TableName,
        s.name AS SchemaName,
        p.rows AS RowCount,
        SUM(a.total_pages) * 8 / 1024 AS SizeMB
      FROM sys.tables t
      INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
      INNER JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
      INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
      GROUP BY t.name, s.name, p.rows
      ORDER BY p.rows DESC
    `);
    res.json({ success: true, tables: result.recordset });
  } catch (err) {
    logger.error('Error listing tables', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/schema/:tableName - Get table schema
 */
router.get('/schema/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const pool = await getPool();
    const result = await pool.request()
      .input('tableName', tableName)
      .query(`
        SELECT
          COLUMN_NAME as columnName,
          DATA_TYPE as dataType,
          IS_NULLABLE as nullable,
          CHARACTER_MAXIMUM_LENGTH as maxLength,
          COLUMN_DEFAULT as defaultValue
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tableName
        ORDER BY ORDINAL_POSITION
      `);
    res.json({ success: true, tableName, columns: result.recordset });
  } catch (err) {
    logger.error('Error getting schema', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/query/:tableName - Query table data with pagination
 */
router.get('/query/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { limit = 100, offset = 0, orderBy, orderDir = 'DESC' } = req.query;

    // Whitelist of allowed tables for security
    const allowedTables = [
      'MED_Book', 'MED_PreBook', 'MED_Opportunities', 'Med_Hotels', 'Med_Reservation',
      'Destinations', 'DestinationsHotels', 'BackOfficeOPT', 'BackOfficeOptLog',
      'MED_CancelBook', 'MED_CancelBookError', 'MED_Log', 'MED_Board', 'MED_Currency',
      'MED_RoomCategory', 'MED_RoomBedding', 'MED_HotelRate', 'Med_Source',
      'Queue', 'Med_HotelsToPush', 'MED_HotelsToSearch', 'RoomPriceUpdateLog',
      'MED_OpportunitiesLog', 'Med_ReservationCancel', 'Med_ReservationModify',
      'Med_ReservationNotificationLog', 'Med_BookCustomerName', 'Med_BookCustomerMoreInfo',
      'SalesOffice.Orders', 'SalesOffice.Details', 'SalesOffice.Bookings',
      'UserSettings', 'Med_Users', 'Roles', 'Permissions'
    ];

    if (!allowedTables.some(t => t.toLowerCase() === tableName.toLowerCase())) {
      return res.status(403).json({ error: 'Table not accessible' });
    }

    const pool = await getPool();

    // Get primary key or first column for ordering
    const pkResult = await pool.request()
      .input('tableName', tableName.replace('SalesOffice.', ''))
      .query(`
        SELECT TOP 1 COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tableName
        ORDER BY ORDINAL_POSITION
      `);

    const orderColumn = orderBy || pkResult.recordset[0]?.COLUMN_NAME || 'id';
    const direction = orderDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const result = await pool.request()
      .query(`
        SELECT * FROM [${tableName.includes('.') ? tableName : 'dbo].[' + tableName}]
        ORDER BY [${orderColumn}] ${direction}
        OFFSET ${parseInt(offset)} ROWS
        FETCH NEXT ${parseInt(limit)} ROWS ONLY
      `);

    const countResult = await pool.request()
      .query(`SELECT COUNT(*) as total FROM [${tableName.includes('.') ? tableName : 'dbo].[' + tableName}]`);

    res.json({
      success: true,
      tableName,
      data: result.recordset,
      pagination: {
        total: countResult.recordset[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (err) {
    logger.error('Error querying table', { error: err.message, table: req.params.tableName });
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// SPECIFIC TABLE ENDPOINTS WITH BUSINESS LOGIC
// ============================================

/**
 * GET /data-explorer/destinations - Get all destinations with hotels count
 */
router.get('/destinations', async (req, res) => {
  try {
    const { limit = 100, search } = req.query;
    const pool = await getPool();

    let query = `
      SELECT TOP (@limit)
        d.id,
        d.Name,
        d.CountryCode,
        d.Type,
        (SELECT COUNT(*) FROM DestinationsHotels dh WHERE dh.DestinationId = d.id) as HotelCount
      FROM Destinations d
    `;

    if (search) {
      query += ` WHERE d.Name LIKE '%' + @search + '%'`;
    }
    query += ` ORDER BY HotelCount DESC`;

    const request = pool.request().input('limit', parseInt(limit));
    if (search) request.input('search', search);

    const result = await request.query(query);
    res.json({ success: true, destinations: result.recordset });
  } catch (err) {
    logger.error('Error getting destinations', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/sales-office/summary - SalesOffice summary
 */
router.get('/sales-office/summary', async (req, res) => {
  try {
    const pool = await getPool();

    // Try to access SalesOffice schema - may not have permissions
    let orders = { TotalOrders: 0, CompletedOrders: 0, PendingOrders: 0 };
    let bookings = 0;
    let details = 0;

    try {
      const ordersResult = await pool.request().query(`
        SELECT
          COUNT(*) as TotalOrders,
          SUM(CASE WHEN Status = 'completed' THEN 1 ELSE 0 END) as CompletedOrders,
          SUM(CASE WHEN Status = 'pending' THEN 1 ELSE 0 END) as PendingOrders
        FROM [SalesOffice].[Orders]
      `);
      orders = ordersResult.recordset[0];
    } catch (e) { /* SalesOffice.Orders not accessible */ }

    try {
      const bookingsResult = await pool.request().query(`
        SELECT COUNT(*) as TotalBookings FROM [SalesOffice].[Bookings]
      `);
      bookings = bookingsResult.recordset[0].TotalBookings;
    } catch (e) { /* SalesOffice.Bookings not accessible */ }

    try {
      const detailsResult = await pool.request().query(`
        SELECT COUNT(*) as TotalDetails FROM [SalesOffice].[Details]
      `);
      details = detailsResult.recordset[0].TotalDetails;
    } catch (e) { /* SalesOffice.Details not accessible */ }

    res.json({
      success: true,
      summary: { orders, bookings, details },
      note: orders.TotalOrders === 0 ? 'SalesOffice schema may require different permissions' : undefined
    });
  } catch (err) {
    logger.error('Error getting sales office summary', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/sales-office/orders - Get SalesOffice orders
 */
router.get('/sales-office/orders', async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    const pool = await getPool();

    let query = `SELECT TOP (@limit) * FROM [SalesOffice].[Orders]`;
    if (status) query += ` WHERE Status = @status`;
    query += ` ORDER BY Id DESC`;

    const request = pool.request().input('limit', parseInt(limit));
    if (status) request.input('status', status);

    const result = await request.query(query);
    res.json({ success: true, orders: result.recordset });
  } catch (err) {
    logger.error('Error getting sales orders', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/backoffice/stats - BackOffice statistics
 */
router.get('/backoffice/stats', async (req, res) => {
  try {
    const pool = await getPool();

    const [opts, logs] = await Promise.all([
      pool.request().query(`
        SELECT
          COUNT(*) as TotalOpts,
          SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) as ActiveOpts
        FROM BackOfficeOPT
      `),
      pool.request().query(`
        SELECT TOP 10
          ActionType,
          COUNT(*) as Count
        FROM BackOfficeOptLog
        GROUP BY ActionType
        ORDER BY Count DESC
      `)
    ]);

    res.json({
      success: true,
      stats: {
        options: opts.recordset[0],
        topActions: logs.recordset
      }
    });
  } catch (err) {
    logger.error('Error getting backoffice stats', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/queue - Get queue items
 */
router.get('/queue', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const pool = await getPool();

    let query = `SELECT TOP (@limit) * FROM Queue`;
    if (status) query += ` WHERE Status = @status`;
    query += ` ORDER BY Id DESC`;

    const request = pool.request().input('limit', parseInt(limit));
    if (status) request.input('status', status);

    const result = await request.query(query);

    const stats = await pool.request().query(`
      SELECT
        COUNT(*) as Total,
        SUM(CASE WHEN Status = 'pending' THEN 1 ELSE 0 END) as Pending,
        SUM(CASE WHEN Status = 'processing' THEN 1 ELSE 0 END) as Processing,
        SUM(CASE WHEN Status = 'completed' THEN 1 ELSE 0 END) as Completed,
        SUM(CASE WHEN Status = 'failed' THEN 1 ELSE 0 END) as Failed
      FROM Queue
    `);

    res.json({
      success: true,
      queue: result.recordset,
      stats: stats.recordset[0]
    });
  } catch (err) {
    logger.error('Error getting queue', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/hotels-to-push - Get hotels pending push to Zenith
 */
router.get('/hotels-to-push', async (req, res) => {
  try {
    const { limit = 50, active } = req.query;
    const pool = await getPool();

    let query = `
      SELECT TOP (@limit)
        htp.*,
        h.name as HotelName,
        b.price as BookingPrice,
        b.Status as BookingStatus
      FROM Med_HotelsToPush htp
      LEFT JOIN Med_Hotels h ON htp.OpportunityId = h.HotelId
      LEFT JOIN MED_Book b ON htp.BookId = b.id
    `;

    if (active === 'true') query += ` WHERE htp.IsActive = 1`;
    query += ` ORDER BY htp.DateInsert DESC`;

    const result = await pool.request()
      .input('limit', parseInt(limit))
      .query(query);

    res.json({ success: true, hotelsToPush: result.recordset });
  } catch (err) {
    logger.error('Error getting hotels to push', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/price-updates - Room price update log
 */
router.get('/price-updates', async (req, res) => {
  try {
    const { limit = 100, hotelId } = req.query;
    const pool = await getPool();

    let query = `SELECT TOP (@limit) * FROM RoomPriceUpdateLog`;
    if (hotelId) query += ` WHERE HotelId = @hotelId`;
    query += ` ORDER BY Id DESC`;

    const request = pool.request().input('limit', parseInt(limit));
    if (hotelId) request.input('hotelId', parseInt(hotelId));

    const result = await request.query(query);
    res.json({ success: true, priceUpdates: result.recordset });
  } catch (err) {
    logger.error('Error getting price updates', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/system-logs - Get MED_Log entries
 */
router.get('/system-logs', async (req, res) => {
  try {
    const { limit = 100, search } = req.query;
    const pool = await getPool();

    let query = `SELECT TOP (@limit) * FROM MED_Log`;
    if (search) query += ` WHERE Message LIKE '%' + @search + '%'`;
    query += ` ORDER BY LogID DESC`;

    const request = pool.request().input('limit', parseInt(limit));
    if (search) request.input('search', search);

    const result = await request.query(query);
    res.json({ success: true, logs: result.recordset });
  } catch (err) {
    logger.error('Error getting system logs', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/lookups - Get all lookup tables data
 */
router.get('/lookups', async (req, res) => {
  try {
    const pool = await getPool();

    const [boards, categories, beddings, currencies, sources, confirmations] = await Promise.all([
      pool.request().query('SELECT * FROM MED_Board'),
      pool.request().query('SELECT * FROM MED_RoomCategory'),
      pool.request().query('SELECT * FROM MED_RoomBedding'),
      pool.request().query('SELECT * FROM MED_Currency'),
      pool.request().query('SELECT * FROM Med_Source'),
      pool.request().query('SELECT * FROM MED_RoomConfirmation')
    ]);

    res.json({
      success: true,
      lookups: {
        boards: boards.recordset,
        categories: categories.recordset,
        beddings: beddings.recordset,
        currencies: currencies.recordset,
        sources: sources.recordset,
        confirmations: confirmations.recordset
      }
    });
  } catch (err) {
    logger.error('Error getting lookups', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/users - Get Med_Users
 */
router.get('/users', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        userid,
        username,
        IsActive,
        AetherTokenStorageId
      FROM Med_Users
      ORDER BY userid
    `);
    res.json({ success: true, users: result.recordset });
  } catch (err) {
    logger.error('Error getting users', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /data-explorer/comprehensive-stats - Get stats from all major tables
 */
router.get('/comprehensive-stats', async (req, res) => {
  try {
    const pool = await getPool();

    // Core stats that should always work
    const coreStats = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM MED_Book) as TotalBookings,
        (SELECT COUNT(*) FROM MED_Book WHERE IsActive = 1) as ActiveBookings,
        (SELECT COUNT(*) FROM MED_Book WHERE IsSold = 1) as SoldBookings,
        (SELECT ISNULL(SUM(price), 0) FROM MED_Book) as TotalBookingValue,
        (SELECT COUNT(*) FROM [MED_ֹOֹֹpportunities]) as TotalOpportunities,
        (SELECT COUNT(*) FROM [MED_ֹOֹֹpportunities] WHERE IsActive = 1) as ActiveOpportunities,
        (SELECT COUNT(*) FROM Med_Hotels) as TotalHotels,
        (SELECT COUNT(*) FROM Med_Hotels WHERE isActive = 1) as ActiveHotels,
        (SELECT COUNT(*) FROM Med_Reservation) as TotalReservations,
        (SELECT ISNULL(SUM(AmountAfterTax), 0) FROM Med_Reservation) as TotalReservationValue,
        (SELECT COUNT(*) FROM MED_PreBook) as TotalPreBookings,
        (SELECT COUNT(*) FROM MED_CancelBook) as TotalCancellations,
        (SELECT COUNT(*) FROM Destinations) as TotalDestinations,
        (SELECT COUNT(*) FROM DestinationsHotels) as TotalDestinationHotels,
        (SELECT COUNT(*) FROM Queue) as QueueItems,
        (SELECT COUNT(*) FROM Med_HotelsToPush WHERE IsActive = 1) as PendingPushes,
        (SELECT COUNT(*) FROM RoomPriceUpdateLog) as PriceUpdates,
        (SELECT COUNT(*) FROM BackOfficeOPT) as BackOfficeOptions,
        (SELECT COUNT(*) FROM MED_Log) as SystemLogs
    `);

    // Try to get SalesOffice stats separately (might not have access)
    let salesOrders = 0;
    try {
      const salesResult = await pool.request().query(`
        SELECT COUNT(*) as cnt FROM [SalesOffice].[Orders]
      `);
      salesOrders = salesResult.recordset[0]?.cnt || 0;
    } catch (e) {
      // SalesOffice schema might not be accessible
      logger.warn('Could not access SalesOffice.Orders', { error: e.message });
    }

    res.json({
      success: true,
      stats: {
        ...coreStats.recordset[0],
        SalesOrders: salesOrders
      }
    });
  } catch (err) {
    logger.error('Error getting comprehensive stats', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
