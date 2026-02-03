-- Migration 001: Push Logging Table
-- Created: 2026-02-02
-- Purpose: Track all Zenith push operations for monitoring and debugging

-- Check if table exists and create if not
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MED_PushLog')
BEGIN
    CREATE TABLE MED_PushLog (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OpportunityId INT NULL,
        BookId INT NULL,
        PushType VARCHAR(50) NOT NULL, -- 'OPPORTUNITY', 'BOOKING', 'PRICE_UPDATE', 'AVAILABILITY'
        PushDate DATETIME NOT NULL DEFAULT GETDATE(),
        ZenithRequest NVARCHAR(MAX) NULL,
        ZenithResponse NVARCHAR(MAX) NULL,
        Success BIT NOT NULL DEFAULT 0,
        ErrorMessage NVARCHAR(500) NULL,
        RetryCount INT NOT NULL DEFAULT 0,
        ProcessingTimeMs INT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Foreign keys
        CONSTRAINT FK_PushLog_Opportunity 
            FOREIGN KEY (OpportunityId) 
            REFERENCES MED_Opportunity(id),
        
        CONSTRAINT FK_PushLog_Book 
            FOREIGN KEY (BookId) 
            REFERENCES MED_Book(id)
    );
    
    -- Indexes for performance
    CREATE INDEX IX_PushLog_OpportunityId ON MED_PushLog(OpportunityId);
    CREATE INDEX IX_PushLog_BookId ON MED_PushLog(BookId);
    CREATE INDEX IX_PushLog_PushDate ON MED_PushLog(PushDate DESC);
    CREATE INDEX IX_PushLog_Success ON MED_PushLog(Success);
    CREATE INDEX IX_PushLog_PushType ON MED_PushLog(PushType);
    
    PRINT 'MED_PushLog table created successfully';
END
ELSE
BEGIN
    PRINT 'MED_PushLog table already exists';
END
GO

-- Create view for easy monitoring
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'V_PushLog_Summary')
BEGIN
    EXEC('
    CREATE VIEW V_PushLog_Summary AS
    SELECT 
        PushType,
        CAST(PushDate AS DATE) as PushDate,
        COUNT(*) as TotalPushes,
        SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) as SuccessCount,
        SUM(CASE WHEN Success = 0 THEN 1 ELSE 0 END) as FailureCount,
        CAST(AVG(CASE WHEN Success = 1 THEN 100.0 ELSE 0 END) AS DECIMAL(5,2)) as SuccessRate,
        AVG(ProcessingTimeMs) as AvgProcessingTimeMs,
        MAX(ProcessingTimeMs) as MaxProcessingTimeMs
    FROM MED_PushLog
    WHERE PushDate >= DATEADD(DAY, -7, GETDATE())
    GROUP BY PushType, CAST(PushDate AS DATE)
    ');
    
    PRINT 'V_PushLog_Summary view created successfully';
END
GO
