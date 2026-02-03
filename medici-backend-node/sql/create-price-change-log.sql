-- ========================================
-- Price Change Log Table
-- NEW - Track all price updates for analytics
-- ========================================

-- Create price change log table (if not exists)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[MED_PriceChangeLog]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[MED_PriceChangeLog] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [BookingId] INT NOT NULL,
        [OldPrice] FLOAT NULL,
        [NewPrice] FLOAT NULL,
        [ChangeReason] NVARCHAR(500) NULL,
        [ChangedAt] DATETIME NOT NULL DEFAULT GETDATE(),
        [ChangedBy] NVARCHAR(100) NULL,
        
        CONSTRAINT FK_PriceChangeLog_Booking 
            FOREIGN KEY (BookingId) 
            REFERENCES MED_Book(id)
    );
    
    -- Create index for faster queries
    CREATE INDEX IX_PriceChangeLog_BookingId ON MED_PriceChangeLog(BookingId);
    CREATE INDEX IX_PriceChangeLog_ChangedAt ON MED_PriceChangeLog(ChangedAt DESC);
    
    PRINT 'Table MED_PriceChangeLog created successfully';
END
ELSE
BEGIN
    PRINT 'Table MED_PriceChangeLog already exists';
END
GO
