-- ============================================================================
-- Week 2 Phase 2.1: Price History Tracking
-- ============================================================================

-- ============================================================================
-- MED_PriceHistory Table
-- Tracks price changes over time for opportunities
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MED_PriceHistory')
BEGIN
    CREATE TABLE MED_PriceHistory (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OpportunityId INT NOT NULL,
        HotelId INT NOT NULL,
        RoomCategoryId INT NULL,
        BoardId INT NULL,
        DateFrom DATE NOT NULL,
        DateTo DATE NOT NULL,
        
        -- Price data
        BuyPrice DECIMAL(18,2) NOT NULL,          -- Cost price from supplier
        SellPrice DECIMAL(18,2) NOT NULL,         -- Price we sell at
        MarketPrice DECIMAL(18,2) NULL,           -- Market average (from competitors)
        CompetitorMinPrice DECIMAL(18,2) NULL,    -- Lowest competitor price
        CompetitorMaxPrice DECIMAL(18,2) NULL,    -- Highest competitor price
        
        -- Availability
        AvailableRooms INT NULL,
        TotalRooms INT NULL,
        
        -- Snapshot metadata
        SnapshotDate DATETIME NOT NULL DEFAULT GETDATE(),
        Source VARCHAR(50) NOT NULL,              -- INNSTANT, GOGLOBAL, MANUAL
        IsActive BIT NOT NULL DEFAULT 1,
        
        -- Indexes
        INDEX IX_PriceHistory_OpportunityId (OpportunityId),
        INDEX IX_PriceHistory_HotelId (HotelId),
        INDEX IX_PriceHistory_DateFrom (DateFrom),
        INDEX IX_PriceHistory_SnapshotDate (SnapshotDate),
        INDEX IX_PriceHistory_Composite (HotelId, DateFrom, SnapshotDate)
    );
    
    PRINT 'Created MED_PriceHistory table';
END
GO

-- ============================================================================
-- MED_SearchPatterns Table
-- Tracks search queries and patterns for demand analysis
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MED_SearchPatterns')
BEGIN
    CREATE TABLE MED_SearchPatterns (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Search criteria
        HotelId INT NULL,
        Destination NVARCHAR(100) NULL,
        CheckIn DATE NOT NULL,
        CheckOut DATE NOT NULL,
        Adults INT NOT NULL,
        Children INT NOT NULL,
        RoomCategoryId INT NULL,
        
        -- Results
        ResultCount INT NULL,
        MinPrice DECIMAL(18,2) NULL,
        MaxPrice DECIMAL(18,2) NULL,
        AvgPrice DECIMAL(18,2) NULL,
        
        -- Search metadata
        SearchDate DATETIME NOT NULL DEFAULT GETDATE(),
        LeadTime INT NULL,                         -- Days between search and check-in
        LengthOfStay INT NULL,                     -- Nights
        Source VARCHAR(50) NULL,                   -- WEBSITE, API, INTERNAL
        UserId INT NULL,
        SessionId VARCHAR(100) NULL,
        
        -- Conversion tracking
        DidBook BIT DEFAULT 0,
        BookingId INT NULL,
        ConversionTime INT NULL,                   -- Minutes to booking
        
        -- Indexes
        INDEX IX_SearchPatterns_CheckIn (CheckIn),
        INDEX IX_SearchPatterns_HotelId (HotelId),
        INDEX IX_SearchPatterns_SearchDate (SearchDate),
        INDEX IX_SearchPatterns_Destination (Destination),
        INDEX IX_SearchPatterns_Composite (HotelId, CheckIn, SearchDate)
    );
    
    PRINT 'Created MED_SearchPatterns table';
END
GO

-- ============================================================================
-- MED_CompetitorPrices Table
-- Tracks competitor pricing from scraping/monitoring
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MED_CompetitorPrices')
BEGIN
    CREATE TABLE MED_CompetitorPrices (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Hotel matching
        HotelId INT NOT NULL,                      -- Our hotel ID
        CompetitorName VARCHAR(100) NOT NULL,      -- Booking.com, Expedia, etc
        CompetitorHotelId VARCHAR(100) NULL,       -- Their hotel ID
        
        -- Date range
        CheckIn DATE NOT NULL,
        CheckOut DATE NOT NULL,
        
        -- Price data
        Price DECIMAL(18,2) NOT NULL,
        Currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        RoomType VARCHAR(100) NULL,
        BoardType VARCHAR(50) NULL,
        
        -- Availability
        Available BIT NOT NULL DEFAULT 1,
        RoomsLeft INT NULL,
        
        -- Scraping metadata
        ScrapedAt DATETIME NOT NULL DEFAULT GETDATE(),
        ScraperVersion VARCHAR(20) NULL,
        SourceUrl NVARCHAR(500) NULL,
        RawData NVARCHAR(MAX) NULL,
        
        -- Indexes
        INDEX IX_CompetitorPrices_HotelId (HotelId),
        INDEX IX_CompetitorPrices_CheckIn (CheckIn),
        INDEX IX_CompetitorPrices_ScrapedAt (ScrapedAt),
        INDEX IX_CompetitorPrices_Competitor (CompetitorName),
        INDEX IX_CompetitorPrices_Composite (HotelId, CheckIn, CompetitorName)
    );
    
    PRINT 'Created MED_CompetitorPrices table';
END
GO

-- ============================================================================
-- MED_PerformanceMetrics Table
-- Daily/hourly system performance metrics
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MED_PerformanceMetrics')
BEGIN
    CREATE TABLE MED_PerformanceMetrics (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Time period
        MetricDate DATE NOT NULL,
        MetricHour INT NULL,                       -- 0-23, NULL for daily metrics
        
        -- Opportunity metrics
        ActiveOpportunities INT NULL,
        NewOpportunities INT NULL,
        SoldOpportunities INT NULL,
        CancelledOpportunities INT NULL,
        
        -- Booking metrics
        TotalBookings INT NULL,
        ConfirmedBookings INT NULL,
        CancelledBookings INT NULL,
        BookingValue DECIMAL(18,2) NULL,
        
        -- Revenue metrics
        TotalRevenue DECIMAL(18,2) NULL,
        TotalCost DECIMAL(18,2) NULL,
        GrossProfit DECIMAL(18,2) NULL,
        ProfitMargin DECIMAL(5,2) NULL,
        
        -- Zenith push metrics
        TotalPushes INT NULL,
        SuccessfulPushes INT NULL,
        FailedPushes INT NULL,
        AvgPushTime INT NULL,                      -- Milliseconds
        
        -- Worker metrics
        BuyroomSuccesses INT NULL,
        BuyroomFailures INT NULL,
        AutoCancellations INT NULL,
        PriceUpdates INT NULL,
        
        -- Search metrics
        TotalSearches INT NULL,
        SearchToBookConversion DECIMAL(5,2) NULL,
        
        -- Metadata
        CalculatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Indexes
        INDEX IX_PerformanceMetrics_Date (MetricDate),
        INDEX IX_PerformanceMetrics_DateTime (MetricDate, MetricHour),
        UNIQUE INDEX UX_PerformanceMetrics_DateTime (MetricDate, MetricHour)
    );
    
    PRINT 'Created MED_PerformanceMetrics table';
END
GO

-- ============================================================================
-- Views for Analysis
-- ============================================================================

-- Price trend analysis view
IF EXISTS (SELECT * FROM sys.views WHERE name = 'V_PriceTrends')
    DROP VIEW V_PriceTrends;
GO

CREATE VIEW V_PriceTrends AS
SELECT 
    ph.HotelId,
    h.name as HotelName,
    ph.DateFrom,
    ph.DateTo,
    ph.SnapshotDate,
    ph.BuyPrice,
    ph.SellPrice,
    ph.MarketPrice,
    ph.CompetitorMinPrice,
    (ph.SellPrice - ph.BuyPrice) as GrossProfit,
    CASE 
        WHEN ph.BuyPrice > 0 
        THEN ((ph.SellPrice - ph.BuyPrice) / ph.BuyPrice * 100)
        ELSE 0 
    END as ProfitMarginPercent,
    CASE 
        WHEN ph.CompetitorMinPrice IS NOT NULL AND ph.CompetitorMinPrice > 0
        THEN ((ph.SellPrice - ph.CompetitorMinPrice) / ph.CompetitorMinPrice * 100)
        ELSE NULL
    END as CompetitivePosition,
    ph.AvailableRooms,
    ph.Source
FROM MED_PriceHistory ph
INNER JOIN Med_Hotels h ON ph.HotelId = h.HotelId
WHERE ph.IsActive = 1;
GO

-- Search demand analysis view
IF EXISTS (SELECT * FROM sys.views WHERE name = 'V_SearchDemand')
    DROP VIEW V_SearchDemand;
GO

CREATE VIEW V_SearchDemand AS
SELECT 
    CAST(sp.CheckIn as DATE) as CheckInDate,
    DATEPART(WEEKDAY, sp.CheckIn) as DayOfWeek,
    DATEPART(MONTH, sp.CheckIn) as Month,
    sp.HotelId,
    h.name as HotelName,
    sp.Destination,
    COUNT(*) as SearchCount,
    SUM(CASE WHEN sp.DidBook = 1 THEN 1 ELSE 0 END) as BookingCount,
    CASE 
        WHEN COUNT(*) > 0 
        THEN CAST(SUM(CASE WHEN sp.DidBook = 1 THEN 1 ELSE 0 END) as FLOAT) / COUNT(*) * 100
        ELSE 0 
    END as ConversionRate,
    AVG(sp.LeadTime) as AvgLeadTime,
    AVG(sp.LengthOfStay) as AvgLOS,
    AVG(sp.AvgPrice) as AvgSearchPrice,
    MIN(sp.MinPrice) as LowestPriceFound,
    MAX(sp.MaxPrice) as HighestPriceFound
FROM MED_SearchPatterns sp
LEFT JOIN Med_Hotels h ON sp.HotelId = h.HotelId
WHERE sp.SearchDate >= DATEADD(DAY, -90, GETDATE())
GROUP BY 
    CAST(sp.CheckIn as DATE),
    DATEPART(WEEKDAY, sp.CheckIn),
    DATEPART(MONTH, sp.CheckIn),
    sp.HotelId,
    h.name,
    sp.Destination;
GO

-- Competitor price comparison view
IF EXISTS (SELECT * FROM sys.views WHERE name = 'V_CompetitorComparison')
    DROP VIEW V_CompetitorComparison;
GO

CREATE VIEW V_CompetitorComparison AS
SELECT 
    cp.HotelId,
    h.name as HotelName,
    cp.CheckIn,
    cp.CheckOut,
    cp.CompetitorName,
    cp.Price as CompetitorPrice,
    o.PushPrice as OurPrice,
    o.Price as OurCost,
    (o.PushPrice - o.Price) as OurProfit,
    (cp.Price - o.PushPrice) as PriceDifference,
    CASE 
        WHEN cp.Price > 0 
        THEN ((o.PushPrice - cp.Price) / cp.Price * 100)
        ELSE NULL 
    END as PricePositionPercent,
    cp.Available as CompetitorAvailable,
    CASE WHEN o.IsActive = 1 THEN 1 ELSE 0 END as WeAreActive,
    cp.ScrapedAt
FROM MED_CompetitorPrices cp
INNER JOIN Med_Hotels h ON cp.HotelId = h.HotelId
LEFT JOIN [MED_ֹOֹֹpportunities] o ON o.DestinationsId = h.HotelId
    AND o.DateForm = cp.CheckIn
    AND o.DateTo = cp.CheckOut
WHERE cp.ScrapedAt >= DATEADD(DAY, -7, GETDATE());
GO

-- Performance dashboard view
IF EXISTS (SELECT * FROM sys.views WHERE name = 'V_PerformanceDashboard')
    DROP VIEW V_PerformanceDashboard;
GO

CREATE VIEW V_PerformanceDashboard AS
SELECT 
    pm.MetricDate,
    pm.MetricHour,
    
    -- Opportunities
    pm.ActiveOpportunities,
    pm.NewOpportunities,
    pm.SoldOpportunities,
    CASE 
        WHEN pm.ActiveOpportunities > 0 
        THEN CAST(pm.SoldOpportunities as FLOAT) / pm.ActiveOpportunities * 100
        ELSE 0 
    END as SellThroughRate,
    
    -- Revenue
    pm.TotalRevenue,
    pm.TotalCost,
    pm.GrossProfit,
    pm.ProfitMargin,
    
    -- Efficiency
    CASE 
        WHEN pm.TotalPushes > 0 
        THEN CAST(pm.SuccessfulPushes as FLOAT) / pm.TotalPushes * 100
        ELSE 0 
    END as PushSuccessRate,
    
    CASE 
        WHEN (pm.BuyroomSuccesses + pm.BuyroomFailures) > 0 
        THEN CAST(pm.BuyroomSuccesses as FLOAT) / (pm.BuyroomSuccesses + pm.BuyroomFailures) * 100
        ELSE 0 
    END as BuyroomSuccessRate,
    
    pm.SearchToBookConversion,
    
    -- Worker activity
    pm.BuyroomSuccesses,
    pm.BuyroomFailures,
    pm.AutoCancellations,
    pm.PriceUpdates,
    
    pm.CalculatedAt
FROM MED_PerformanceMetrics pm
WHERE pm.MetricDate >= DATEADD(DAY, -30, GETDATE());
GO

PRINT 'Phase 2.1 tables and views created successfully';
