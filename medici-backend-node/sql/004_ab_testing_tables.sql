-- ============================================================================
-- Week 3 Phase 3.3: A/B Testing & Performance Tracking
-- ============================================================================

-- ============================================================================
-- MED_ABTests Table
-- Tracks A/B tests for pricing strategies
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MED_ABTests')
BEGIN
    CREATE TABLE MED_ABTests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OpportunityId INT NOT NULL,
        
        -- Test configuration
        TestType VARCHAR(50) NOT NULL,        -- PRICING, STRATEGY, DYNAMIC
        Variant VARCHAR(50) NOT NULL,         -- control, test, variant_a, variant_b
        Strategy VARCHAR(50) NULL,            -- balanced, aggressive, etc.
        
        -- Pricing details
        TestPrice DECIMAL(18,2) NULL,         -- Price being tested
        ControlPrice DECIMAL(18,2) NULL,      -- Original/control price
        
        -- Test lifecycle
        StartDate DATETIME NOT NULL DEFAULT GETDATE(),
        EndDate DATETIME NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        
        -- Results
        DidConvert BIT NULL,                  -- Was opportunity sold?
        ConversionTime INT NULL,              -- Hours to conversion
        ActualProfit DECIMAL(18,2) NULL,      -- Actual profit achieved
        
        -- Metadata
        CreatedBy VARCHAR(100) NULL,
        Notes NVARCHAR(500) NULL,
        
        -- Indexes
        INDEX IX_ABTests_OpportunityId (OpportunityId),
        INDEX IX_ABTests_TestType (TestType),
        INDEX IX_ABTests_IsActive (IsActive),
        INDEX IX_ABTests_StartDate (StartDate)
    );
    
    PRINT 'Created MED_ABTests table';
END
GO

-- ============================================================================
-- MED_PricingPerformance Table
-- Aggregated performance metrics for pricing strategies
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MED_PricingPerformance')
BEGIN
    CREATE TABLE MED_PricingPerformance (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Time period
        PeriodDate DATE NOT NULL,             -- Date of metric
        PeriodType VARCHAR(20) NOT NULL,      -- DAILY, WEEKLY, MONTHLY
        
        -- Strategy
        Strategy VARCHAR(50) NULL,            -- Pricing strategy used
        RiskLevel VARCHAR(20) NULL,           -- LOW, MEDIUM, HIGH
        
        -- Volume metrics
        OpportunitiesCreated INT DEFAULT 0,
        OpportunitiesActive INT DEFAULT 0,
        OpportunitiesSold INT DEFAULT 0,
        
        -- Conversion metrics
        ConversionRate DECIMAL(5,4) NULL,     -- Sold / Active
        AvgTimeToConversion INT NULL,         -- Hours
        
        -- Financial metrics
        TotalRevenue DECIMAL(18,2) DEFAULT 0,
        TotalCost DECIMAL(18,2) DEFAULT 0,
        TotalProfit DECIMAL(18,2) DEFAULT 0,
        AvgMargin DECIMAL(5,4) NULL,
        AvgProfit DECIMAL(18,2) NULL,
        
        -- Quality metrics
        AvgConfidence DECIMAL(5,4) NULL,
        AvgPriorityScore DECIMAL(5,2) NULL,
        
        -- Optimization metrics
        PriceOptimizations INT DEFAULT 0,     -- How many times optimized
        AutoUpdates INT DEFAULT 0,            -- Auto-updated prices
        ManualReviews INT DEFAULT 0,          -- Manual reviews required
        
        -- Timestamp
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Indexes
        INDEX IX_PricingPerformance_Date (PeriodDate),
        INDEX IX_PricingPerformance_Strategy (Strategy),
        INDEX IX_PricingPerformance_Composite (PeriodDate, Strategy, RiskLevel)
    );
    
    PRINT 'Created MED_PricingPerformance table';
END
GO

-- ============================================================================
-- MED_PriceAdjustments Table
-- Track all price adjustments with reasons
-- ============================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MED_PriceAdjustments')
BEGIN
    CREATE TABLE MED_PriceAdjustments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OpportunityId INT NOT NULL,
        
        -- Price change
        OldPrice DECIMAL(18,2) NOT NULL,
        NewPrice DECIMAL(18,2) NOT NULL,
        PriceDiff DECIMAL(18,2) NULL,
        ChangePercent DECIMAL(5,4) NULL,
        
        -- Reason & context
        Reason VARCHAR(50) NOT NULL,          -- OPTIMIZATION, MARKET_CHANGE, MANUAL, AB_TEST
        Strategy VARCHAR(50) NULL,
        Confidence DECIMAL(5,4) NULL,
        Risk VARCHAR(20) NULL,
        
        -- Market conditions at time of change
        DemandLevel VARCHAR(20) NULL,
        CompetitorAvgPrice DECIMAL(18,2) NULL,
        SeasonalFactor DECIMAL(5,4) NULL,
        DaysUntilCheckIn INT NULL,
        
        -- Metadata
        AdjustedBy VARCHAR(100) NULL,         -- SYSTEM, user@email.com
        IsAutomatic BIT DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        -- Indexes
        INDEX IX_PriceAdjustments_OpportunityId (OpportunityId),
        INDEX IX_PriceAdjustments_CreatedAt (CreatedAt),
        INDEX IX_PriceAdjustments_Reason (Reason)
    );
    
    PRINT 'Created MED_PriceAdjustments table';
END
GO

-- ============================================================================
-- Views for Analysis
-- ============================================================================

-- V_ABTestResults: Analyze A/B test performance
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'V_ABTestResults')
BEGIN
    EXEC('
    CREATE VIEW V_ABTestResults AS
    SELECT
        t.TestType,
        t.Variant,
        t.Strategy,
        COUNT(*) as TotalTests,
        SUM(CASE WHEN t.DidConvert = 1 THEN 1 ELSE 0 END) as Conversions,
        CAST(SUM(CASE WHEN t.DidConvert = 1 THEN 1 ELSE 0 END) as FLOAT) / COUNT(*) as ConversionRate,
        AVG(t.TestPrice) as AvgTestPrice,
        AVG(t.ControlPrice) as AvgControlPrice,
        AVG(t.ActualProfit) as AvgProfit,
        AVG(t.ConversionTime) as AvgConversionTime,
        MIN(t.StartDate) as FirstTest,
        MAX(t.StartDate) as LastTest
    FROM MED_ABTests t
    WHERE t.EndDate IS NOT NULL  -- Completed tests only
    GROUP BY t.TestType, t.Variant, t.Strategy
    ');
    
    PRINT 'Created V_ABTestResults view';
END
GO

-- V_StrategyPerformance: Compare strategy performance over time
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'V_StrategyPerformance')
BEGIN
    EXEC('
    CREATE VIEW V_StrategyPerformance AS
    SELECT
        p.Strategy,
        p.PeriodType,
        COUNT(*) as Periods,
        AVG(p.ConversionRate) as AvgConversionRate,
        AVG(p.AvgMargin) as AvgMargin,
        SUM(p.TotalProfit) as TotalProfit,
        SUM(p.OpportunitiesSold) as TotalSold,
        AVG(p.AvgConfidence) as AvgConfidence,
        MAX(p.PeriodDate) as LastPeriod
    FROM MED_PricingPerformance p
    WHERE p.Strategy IS NOT NULL
    GROUP BY p.Strategy, p.PeriodType
    ');
    
    PRINT 'Created V_StrategyPerformance view';
END
GO

-- V_PriceAdjustmentAnalysis: Analyze price adjustment patterns
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'V_PriceAdjustmentAnalysis')
BEGIN
    EXEC('
    CREATE VIEW V_PriceAdjustmentAnalysis AS
    SELECT
        pa.Reason,
        pa.Strategy,
        COUNT(*) as AdjustmentCount,
        AVG(pa.ChangePercent) as AvgChangePercent,
        AVG(pa.PriceDiff) as AvgPriceDiff,
        SUM(CASE WHEN pa.IsAutomatic = 1 THEN 1 ELSE 0 END) as AutomaticAdjustments,
        SUM(CASE WHEN pa.IsAutomatic = 0 THEN 1 ELSE 0 END) as ManualAdjustments,
        AVG(pa.Confidence) as AvgConfidence,
        
        -- Outcome analysis (join with opportunities)
        AVG(CASE WHEN o.IsSale = 1 THEN 1.0 ELSE 0.0 END) as ConversionRate
    FROM MED_PriceAdjustments pa
    LEFT JOIN [MED_ֹOֹֹpportunities] o ON pa.OpportunityId = o.OpportunityId
    GROUP BY pa.Reason, pa.Strategy
    ');
    
    PRINT 'Created V_PriceAdjustmentAnalysis view';
END
GO

-- ============================================================================
-- Stored Procedures
-- ============================================================================

-- SP_RecordPriceAdjustment: Log price adjustment with context
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'SP_RecordPriceAdjustment')
    DROP PROCEDURE SP_RecordPriceAdjustment;
GO

CREATE PROCEDURE SP_RecordPriceAdjustment
    @OpportunityId INT,
    @OldPrice DECIMAL(18,2),
    @NewPrice DECIMAL(18,2),
    @Reason VARCHAR(50),
    @Strategy VARCHAR(50) = NULL,
    @Confidence DECIMAL(5,4) = NULL,
    @Risk VARCHAR(20) = NULL,
    @AdjustedBy VARCHAR(100) = NULL,
    @IsAutomatic BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Get current market context
    DECLARE @DemandLevel VARCHAR(20);
    DECLARE @CompetitorAvgPrice DECIMAL(18,2);
    DECLARE @DaysUntilCheckIn INT;
    
    SELECT
        @DaysUntilCheckIn = DATEDIFF(DAY, GETDATE(), DateForm)
    FROM [MED_ֹOֹֹpportunities]
    WHERE OpportunityId = @OpportunityId;
    
    -- Insert adjustment record
    INSERT INTO MED_PriceAdjustments (
        OpportunityId,
        OldPrice,
        NewPrice,
        PriceDiff,
        ChangePercent,
        Reason,
        Strategy,
        Confidence,
        Risk,
        DaysUntilCheckIn,
        AdjustedBy,
        IsAutomatic,
        CreatedAt
    )
    VALUES (
        @OpportunityId,
        @OldPrice,
        @NewPrice,
        @NewPrice - @OldPrice,
        CASE WHEN @OldPrice > 0 THEN (@NewPrice - @OldPrice) / @OldPrice ELSE 0 END,
        @Reason,
        @Strategy,
        @Confidence,
        @Risk,
        @DaysUntilCheckIn,
        @AdjustedBy,
        @IsAutomatic,
        GETDATE()
    );
    
    SELECT SCOPE_IDENTITY() as AdjustmentId;
END
GO

PRINT 'Created SP_RecordPriceAdjustment procedure';
GO

-- SP_CalculateDailyPricingMetrics: Calculate daily performance metrics
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'SP_CalculateDailyPricingMetrics')
    DROP PROCEDURE SP_CalculateDailyPricingMetrics;
GO

CREATE PROCEDURE SP_CalculateDailyPricingMetrics
    @Date DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @Date IS NULL
        SET @Date = CAST(GETDATE() as DATE);
    
    -- Calculate metrics by strategy
    INSERT INTO MED_PricingPerformance (
        PeriodDate,
        PeriodType,
        Strategy,
        RiskLevel,
        OpportunitiesCreated,
        OpportunitiesActive,
        OpportunitiesSold,
        ConversionRate,
        TotalRevenue,
        TotalCost,
        TotalProfit,
        AvgMargin,
        AvgProfit,
        AvgConfidence,
        AvgPriorityScore,
        CreatedAt
    )
    SELECT
        @Date as PeriodDate,
        'DAILY' as PeriodType,
        
        -- Strategy from logs or default
        COALESCE(
            (SELECT TOP 1 JSON_VALUE(Details, '$.strategy')
             FROM MED_OpportunityLogs l
             WHERE l.OpportunityId = o.OpportunityId
             AND l.Action IN ('PRICE_OPTIMIZED', 'AI_CREATED')
             ORDER BY l.CreatedAt DESC),
            'balanced'
        ) as Strategy,
        
        o.AIRiskLevel as RiskLevel,
        
        -- Created today
        COUNT(CASE WHEN CAST(o.DateCreate as DATE) = @Date THEN 1 END) as OpportunitiesCreated,
        
        -- Active on date
        COUNT(CASE WHEN o.IsActive = 1 THEN 1 END) as OpportunitiesActive,
        
        -- Sold on date
        SUM(CASE WHEN o.IsSale = 1 AND CAST(o.Lastupdate as DATE) = @Date THEN 1 ELSE 0 END) as OpportunitiesSold,
        
        -- Conversion rate
        CASE 
            WHEN COUNT(CASE WHEN o.IsActive = 1 THEN 1 END) > 0
            THEN CAST(SUM(CASE WHEN o.IsSale = 1 THEN 1 ELSE 0 END) as FLOAT) / 
                 COUNT(CASE WHEN o.IsActive = 1 THEN 1 END)
            ELSE 0
        END as ConversionRate,
        
        -- Financial
        SUM(CASE WHEN o.IsSale = 1 THEN o.PushPrice ELSE 0 END) as TotalRevenue,
        SUM(CASE WHEN o.IsSale = 1 THEN o.Price ELSE 0 END) as TotalCost,
        SUM(CASE WHEN o.IsSale = 1 THEN (o.PushPrice - o.Price) ELSE 0 END) as TotalProfit,
        AVG((o.PushPrice - o.Price) / NULLIF(o.PushPrice, 0)) as AvgMargin,
        AVG(CASE WHEN o.IsSale = 1 THEN (o.PushPrice - o.Price) END) as AvgProfit,
        
        -- Quality
        AVG(o.AIConfidence) as AvgConfidence,
        AVG(o.AIPriorityScore) as AvgPriorityScore,
        
        GETDATE() as CreatedAt
        
    FROM [MED_ֹOֹֹpportunities] o
    WHERE o.AIGenerated = 1
    AND (
        CAST(o.DateCreate as DATE) = @Date
        OR (o.IsActive = 1 AND o.DateForm >= @Date)
    )
    GROUP BY 
        o.AIRiskLevel,
        COALESCE(
            (SELECT TOP 1 JSON_VALUE(Details, '$.strategy')
             FROM MED_OpportunityLogs l
             WHERE l.OpportunityId = o.OpportunityId
             AND l.Action IN ('PRICE_OPTIMIZED', 'AI_CREATED')
             ORDER BY l.CreatedAt DESC),
            'balanced'
        );
    
    SELECT @@ROWCOUNT as MetricsCalculated;
END
GO

PRINT 'Created SP_CalculateDailyPricingMetrics procedure';
GO

PRINT '✅ A/B Testing & Performance Tracking schema created successfully';
