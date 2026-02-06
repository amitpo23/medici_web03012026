-- Data Sync Tables Migration
-- Created: 2026-02-06
-- Purpose: Tables for storing synced data from external B2B APIs

-- =====================================================
-- Table: MED_RoomAvailability
-- Stores current room availability synced from external API
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MED_RoomAvailability]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[MED_RoomAvailability] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [HotelId] INT NOT NULL,
        [RoomId] INT NOT NULL,
        [RoomType] NVARCHAR(100),
        [Available] INT DEFAULT 0,
        [Price] DECIMAL(10,2) DEFAULT 0,
        [LastUpdate] DATETIME DEFAULT GETDATE(),
        CONSTRAINT [UQ_RoomAvailability_HotelRoom] UNIQUE ([HotelId], [RoomId])
    );

    CREATE INDEX [IX_RoomAvailability_HotelId] ON [dbo].[MED_RoomAvailability] ([HotelId]);
    CREATE INDEX [IX_RoomAvailability_LastUpdate] ON [dbo].[MED_RoomAvailability] ([LastUpdate] DESC);

    PRINT 'Created table: MED_RoomAvailability';
END
GO

-- =====================================================
-- Table: MED_DashboardSnapshots
-- Stores periodic dashboard snapshots from external API
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MED_DashboardSnapshots]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[MED_DashboardSnapshots] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [SnapshotDate] DATETIME NOT NULL DEFAULT GETDATE(),
        [TotalBookings] INT DEFAULT 0,
        [TotalRevenue] DECIMAL(18,2) DEFAULT 0,
        [TotalProfit] DECIMAL(18,2) DEFAULT 0,
        [ActiveRooms] INT DEFAULT 0,
        [OccupancyRate] DECIMAL(5,2) DEFAULT 0,
        [RawData] NVARCHAR(MAX) -- JSON storage for full API response
    );

    CREATE INDEX [IX_DashboardSnapshots_Date] ON [dbo].[MED_DashboardSnapshots] ([SnapshotDate] DESC);

    PRINT 'Created table: MED_DashboardSnapshots';
END
GO

-- =====================================================
-- Table: MED_SyncedOpportunities
-- Stores opportunities synced from external API
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MED_SyncedOpportunities]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[MED_SyncedOpportunities] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [HotelId] INT NOT NULL,
        [DateFrom] DATE NOT NULL,
        [DateTo] DATE NOT NULL,
        [SourcePrice] DECIMAL(10,2) DEFAULT 0,
        [LastSync] DATETIME DEFAULT GETDATE(),
        [IsProcessed] BIT DEFAULT 0,
        [ProcessedDate] DATETIME NULL,
        CONSTRAINT [UQ_SyncedOpportunities] UNIQUE ([HotelId], [DateFrom], [DateTo])
    );

    CREATE INDEX [IX_SyncedOpportunities_HotelId] ON [dbo].[MED_SyncedOpportunities] ([HotelId]);
    CREATE INDEX [IX_SyncedOpportunities_Dates] ON [dbo].[MED_SyncedOpportunities] ([DateFrom], [DateTo]);
    CREATE INDEX [IX_SyncedOpportunities_IsProcessed] ON [dbo].[MED_SyncedOpportunities] ([IsProcessed]) WHERE [IsProcessed] = 0;

    PRINT 'Created table: MED_SyncedOpportunities';
END
GO

-- =====================================================
-- Table: MED_SyncedRoomSales
-- Stores sold room data synced from .NET API
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MED_SyncedRoomSales]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[MED_SyncedRoomSales] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [SaleId] INT NOT NULL,
        [HotelId] INT,
        [HotelName] NVARCHAR(500),
        [CheckIn] DATE,
        [CheckOut] DATE,
        [BuyPrice] DECIMAL(10,2) DEFAULT 0,
        [PushPrice] DECIMAL(10,2) DEFAULT 0,
        [Profit] DECIMAL(10,2) DEFAULT 0,
        [Status] NVARCHAR(50),
        [LastSync] DATETIME DEFAULT GETDATE(),
        [RawData] NVARCHAR(MAX),
        CONSTRAINT [UQ_SyncedRoomSales_SaleId] UNIQUE ([SaleId])
    );

    CREATE INDEX [IX_SyncedRoomSales_HotelId] ON [dbo].[MED_SyncedRoomSales] ([HotelId]);
    CREATE INDEX [IX_SyncedRoomSales_CheckIn] ON [dbo].[MED_SyncedRoomSales] ([CheckIn]);
    CREATE INDEX [IX_SyncedRoomSales_LastSync] ON [dbo].[MED_SyncedRoomSales] ([LastSync] DESC);

    PRINT 'Created table: MED_SyncedRoomSales';
END
GO

-- =====================================================
-- Table: MED_DataSyncLog
-- Logs all data sync operations
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MED_DataSyncLog]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[MED_DataSyncLog] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [SyncDate] DATETIME NOT NULL DEFAULT GETDATE(),
        [EndpointName] NVARCHAR(100) NOT NULL,
        [Status] NVARCHAR(20) NOT NULL, -- 'success', 'error', 'partial'
        [RecordsFetched] INT DEFAULT 0,
        [RecordsProcessed] INT DEFAULT 0,
        [DurationMs] INT DEFAULT 0,
        [ErrorMessage] NVARCHAR(MAX) NULL
    );

    CREATE INDEX [IX_DataSyncLog_Date] ON [dbo].[MED_DataSyncLog] ([SyncDate] DESC);
    CREATE INDEX [IX_DataSyncLog_Status] ON [dbo].[MED_DataSyncLog] ([Status]);

    PRINT 'Created table: MED_DataSyncLog';
END
GO

-- =====================================================
-- Add ExternalBookingId column to MED_Book if not exists
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[MED_Book]') AND name = 'ExternalBookingId')
BEGIN
    ALTER TABLE [dbo].[MED_Book] ADD [ExternalBookingId] NVARCHAR(100) NULL;
    CREATE INDEX [IX_Book_ExternalId] ON [dbo].[MED_Book] ([ExternalBookingId]) WHERE [ExternalBookingId] IS NOT NULL;
    PRINT 'Added column: ExternalBookingId to MED_Book';
END
GO

-- =====================================================
-- Add SyncDate column to MED_Book if not exists
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[MED_Book]') AND name = 'SyncDate')
BEGIN
    ALTER TABLE [dbo].[MED_Book] ADD [SyncDate] DATETIME NULL;
    PRINT 'Added column: SyncDate to MED_Book';
END
GO

PRINT '========================================';
PRINT 'Data Sync Tables Migration Complete!';
PRINT '========================================';
