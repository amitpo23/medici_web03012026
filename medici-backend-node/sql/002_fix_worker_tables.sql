-- ============================================================================
-- Fix Worker Tables - Add missing columns for workers
-- ============================================================================

-- Med_Reservations: Add missing columns for BuyRoom Worker
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Med_Reservation') AND name = 'SupplierBookingId')
BEGIN
    ALTER TABLE Med_Reservation ADD SupplierBookingId NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Med_Reservation') AND name = 'SupplierConfirmation')
BEGIN
    ALTER TABLE Med_Reservation ADD SupplierConfirmation NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Med_Reservation') AND name = 'SupplierPrice')
BEGIN
    ALTER TABLE Med_Reservation ADD SupplierPrice DECIMAL(18,2) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Med_Reservation') AND name = 'PurchasedAt')
BEGIN
    ALTER TABLE Med_Reservation ADD PurchasedAt DATETIME NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Med_Reservation') AND name = 'AutoPurchaseEnabled')
BEGIN
    ALTER TABLE Med_Reservation ADD AutoPurchaseEnabled BIT DEFAULT 1;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Med_Reservation') AND name = 'UpdatedAt')
BEGIN
    ALTER TABLE Med_Reservation ADD UpdatedAt DATETIME DEFAULT GETDATE();
END
GO

-- Med_Hotels: Add missing columns for worker integration
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Med_Hotels') AND name = 'InnstantHotelId')
BEGIN
    ALTER TABLE Med_Hotels ADD InnstantHotelId INT NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Med_Hotels') AND name = 'ZenithHotelCode')
BEGIN
    ALTER TABLE Med_Hotels ADD ZenithHotelCode NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Med_Hotels') AND name = 'ZenithEnabled')
BEGIN
    ALTER TABLE Med_Hotels ADD ZenithEnabled BIT DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Med_Hotels') AND name = 'LastPriceSync')
BEGIN
    ALTER TABLE Med_Hotels ADD LastPriceSync DATETIME NULL;
END
GO

-- MED_Opportunities: Add missing columns for auto-cancellation
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[MED_ֹOֹֹpportunities]') AND name = 'AutoCancelEnabled')
BEGIN
    ALTER TABLE [MED_ֹOֹֹpportunities] ADD AutoCancelEnabled BIT DEFAULT 1;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[MED_ֹOֹֹpportunities]') AND name = 'CancellationId')
BEGIN
    ALTER TABLE [MED_ֹOֹֹpportunities] ADD CancellationId NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[MED_ֹOֹֹpportunities]') AND name = 'CancelledAt')
BEGIN
    ALTER TABLE [MED_ֹOֹֹpportunities] ADD CancelledAt DATETIME NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[MED_ֹOֹֹpportunities]') AND name = 'CancellationReason')
BEGIN
    ALTER TABLE [MED_ֹOֹֹpportunities] ADD CancellationReason NVARCHAR(500) NULL;
END
GO

-- MED_RoomCategory: Add Zenith mapping
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'MED_RoomCategory') AND name = 'ZenithRoomCode')
BEGIN
    ALTER TABLE MED_RoomCategory ADD ZenithRoomCode NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'MED_RoomCategory') AND name = 'PMS_Code')
BEGIN
    ALTER TABLE MED_RoomCategory ADD PMS_Code NVARCHAR(50) NULL;
END
GO

-- Create MED_ReservationLogs if not exists
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MED_ReservationLogs')
BEGIN
    CREATE TABLE MED_ReservationLogs (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ReservationId INT NOT NULL,
        Action NVARCHAR(100) NOT NULL,
        Details NVARCHAR(MAX) NULL,
        CreatedAt DATETIME DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_ReservationLogs_ReservationId ON MED_ReservationLogs(ReservationId);
    CREATE INDEX IX_ReservationLogs_Action ON MED_ReservationLogs(Action);
    CREATE INDEX IX_ReservationLogs_CreatedAt ON MED_ReservationLogs(CreatedAt);
END
GO

-- Create MED_OpportunityLogs if not exists
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MED_OpportunityLogs')
BEGIN
    CREATE TABLE MED_OpportunityLogs (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OpportunityId INT NOT NULL,
        Action NVARCHAR(100) NOT NULL,
        Details NVARCHAR(MAX) NULL,
        CreatedAt DATETIME DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_OpportunityLogs_OpportunityId ON MED_OpportunityLogs(OpportunityId);
    CREATE INDEX IX_OpportunityLogs_Action ON MED_OpportunityLogs(Action);
    CREATE INDEX IX_OpportunityLogs_CreatedAt ON MED_OpportunityLogs(CreatedAt);
END
GO

PRINT 'Worker tables fixed successfully';
