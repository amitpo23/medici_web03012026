import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdvancedPricingService } from 'src/app/services/advanced-pricing.service';

@Component({
  selector: 'app-advanced-pricing',
  templateUrl: './advanced-pricing.component.html',
  styleUrls: ['./advanced-pricing.component.scss']
})
export class AdvancedPricingComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  selectedTabIndex = 0;

  // =========================================================================
  // Global filters
  // =========================================================================
  globalDays = 30;
  daysOptions: number[] = [7, 14, 30, 60, 90];

  // =========================================================================
  // Tab 1: A/B Tests
  // =========================================================================
  abTestsLoading = false;
  abTestsData: any[] = [];
  abTestsSummary: any = null;
  abTestsPeriod = '';
  abTestFilterType = '';
  abTestFilterStrategy = '';
  abTestColumns: string[] = [
    'TestType', 'Variant', 'Strategy', 'TotalTests',
    'Conversions', 'ConversionRate', 'AvgTestPrice',
    'AvgControlPrice', 'improvement', 'significanceLevel'
  ];

  // =========================================================================
  // Tab 2: Strategy Comparison
  // =========================================================================
  strategyLoading = false;
  strategyData: any[] = [];
  strategyRecommendation = '';
  strategyPeriod = '';
  strategyColumns: string[] = [
    'strategy', 'total', 'sold', 'conversionRate',
    'avgProfit', 'avgMargin', 'avgConfidence',
    'totalProfit', 'expectedValuePerOpp', 'avgTimeToAction'
  ];

  // =========================================================================
  // Tab 3: Price Adjustments
  // =========================================================================
  adjustmentsLoading = false;
  adjustmentsData: any[] = [];
  adjustmentsSummary: any = null;
  adjustmentsPeriod = '';
  adjustmentFilterReason = '';
  adjustmentColumns: string[] = [
    'reason', 'strategy', 'count', 'avgChange',
    'avgPriceDiff', 'automatic', 'manual',
    'avgConfidence', 'conversions', 'conversionRate', 'avgProfitWhenSold'
  ];

  // =========================================================================
  // Tab 4: Revenue Optimization
  // =========================================================================
  revenueOptLoading = false;
  revenueOptCurrent: any = null;
  revenueOptOptimizations: any[] = [];
  revenueOptProjectedImpact: any = null;
  revenueOptPeriod = '';
  revenueOptColumns: string[] = [
    'opportunity', 'affectedCount', 'currentMargin',
    'potentialMargin', 'potentialRevenue', 'expectedImpact'
  ];

  // =========================================================================
  // Tab 5: ML Pricing
  // =========================================================================
  mlLoading = false;
  mlResult: any = null;
  mlError = '';
  mlFormData = {
    hotelId: null as number | null,
    checkIn: '',
    checkOut: '',
    buyPrice: null as number | null,
    roomType: '',
    leadTimeDays: null as number | null,
    currentDemand: null as number | null
  };

  // Batch ML
  mlBatchLoading = false;
  mlBatchResult: any = null;
  mlBatchInput = '';

  // =========================================================================
  // Tab 6: Elasticity
  // =========================================================================
  elasticityLoading = false;
  elasticityResult: any = null;
  elasticityError = '';
  elasticityHotelId: number | null = null;
  elasticityTimeframe: number | null = null;
  elasticityMinDataPoints: number | null = null;

  // Segment elasticity
  segmentElasticityLoading = false;
  segmentElasticityResult: any = null;
  segmentElasticityHotelId: number | null = null;

  // Elasticity recommendation
  elasticityRecLoading = false;
  elasticityRecResult: any = null;
  elasticityRecHotelId: number | null = null;
  elasticityRecCurrentPrice: number | null = null;
  elasticityRecTargetMetric = 'revenue';

  // =========================================================================
  // Tab 7: Competitor Tracking
  // =========================================================================
  competitorChangesLoading = false;
  competitorChangesResult: any = null;
  competitorChangesHotelId: number | null = null;
  competitorChangesDaysBack: number | null = null;

  competitorPositionLoading = false;
  competitorPositionResult: any = null;
  competitorPositionHotelId: number | null = null;
  competitorPositionOurPrice: number | null = null;

  responseStrategyLoading = false;
  responseStrategyResult: any = null;
  responseStrategyHotelId: number | null = null;
  responseStrategyChange = '';

  newCompetitorsLoading = false;
  newCompetitorsResult: any = null;
  newCompetitorsHotelId: number | null = null;
  newCompetitorsDaysBack: number | null = null;

  marketShareLoading = false;
  marketShareResult: any = null;
  marketShareHotelId: number | null = null;
  marketShareWeeks: number | null = null;

  // =========================================================================
  // Tab 8: Yield Management
  // =========================================================================
  yieldLoading = false;
  yieldResult: any = null;
  yieldError = '';
  yieldHotelId: number | null = null;
  yieldTimeHorizon: number | null = null;

  // Revenue maximize
  revMaxLoading = false;
  revMaxResult: any = null;
  revMaxFormData = {
    hotelId: null as number | null,
    checkIn: '',
    checkOut: '',
    buyPrice: null as number | null,
    availableInventory: null as number | null,
    currentDemand: null as number | null,
    competitorPrices: ''
  };

  // Trends
  trendsLoading = false;
  trendsData: any[] = [];
  trendsPeriod = '';
  trendsGranularity = 'daily';
  trendsColumns: string[] = [
    'period', 'created', 'sold', 'conversionRate',
    'avgSellPrice', 'avgBuyPrice', 'avgMargin',
    'avgConfidence', 'totalProfit'
  ];

  // Run metrics
  runMetricsLoading = false;
  runMetricsResult: any = null;
  runMetricsDate = '';

  constructor(private pricingService: AdvancedPricingService) {}

  ngOnInit(): void {
    this.loadABTests();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    switch (index) {
      case 0:
        if (this.abTestsData.length === 0) {
          this.loadABTests();
        }
        break;
      case 1:
        if (this.strategyData.length === 0) {
          this.loadStrategyComparison();
        }
        break;
      case 2:
        if (this.adjustmentsData.length === 0) {
          this.loadAdjustments();
        }
        break;
      case 3:
        if (!this.revenueOptCurrent) {
          this.loadRevenueOptimization();
        }
        break;
      case 7:
        if (this.trendsData.length === 0) {
          this.loadTrends();
        }
        break;
      default:
        break;
    }
  }

  // =========================================================================
  // Tab 1: A/B Tests
  // =========================================================================

  loadABTests(): void {
    this.abTestsLoading = true;
    this.pricingService.getABTests({
      days: this.globalDays,
      testType: this.abTestFilterType || undefined,
      strategy: this.abTestFilterStrategy || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.abTestsData = res.tests || [];
          this.abTestsSummary = res.summary || null;
          this.abTestsPeriod = res.period || '';
          this.abTestsLoading = false;
        },
        error: () => {
          this.abTestsData = [];
          this.abTestsSummary = null;
          this.abTestsLoading = false;
        }
      });
  }

  // =========================================================================
  // Tab 2: Strategy Comparison
  // =========================================================================

  loadStrategyComparison(): void {
    this.strategyLoading = true;
    this.pricingService.getStrategyComparison({ days: this.globalDays })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.strategyData = res.strategies || [];
          this.strategyRecommendation = res.recommendation || '';
          this.strategyPeriod = res.period || '';
          this.strategyLoading = false;
        },
        error: () => {
          this.strategyData = [];
          this.strategyLoading = false;
        }
      });
  }

  // =========================================================================
  // Tab 3: Price Adjustments
  // =========================================================================

  loadAdjustments(): void {
    this.adjustmentsLoading = true;
    this.pricingService.getAdjustments({
      days: this.globalDays,
      reason: this.adjustmentFilterReason || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.adjustmentsData = res.adjustments || [];
          this.adjustmentsSummary = res.summary || null;
          this.adjustmentsPeriod = res.period || '';
          this.adjustmentsLoading = false;
        },
        error: () => {
          this.adjustmentsData = [];
          this.adjustmentsSummary = null;
          this.adjustmentsLoading = false;
        }
      });
  }

  // =========================================================================
  // Tab 4: Revenue Optimization
  // =========================================================================

  loadRevenueOptimization(): void {
    this.revenueOptLoading = true;
    this.pricingService.getRevenueOptimization({ days: this.globalDays })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.revenueOptCurrent = res.current || null;
          this.revenueOptOptimizations = res.optimizations || [];
          this.revenueOptProjectedImpact = res.projectedImpact || null;
          this.revenueOptPeriod = res.period || '';
          this.revenueOptLoading = false;
        },
        error: () => {
          this.revenueOptCurrent = null;
          this.revenueOptOptimizations = [];
          this.revenueOptProjectedImpact = null;
          this.revenueOptLoading = false;
        }
      });
  }

  // =========================================================================
  // Tab 5: ML Pricing
  // =========================================================================

  submitMLPrediction(): void {
    if (!this.mlFormData.hotelId || !this.mlFormData.checkIn ||
        !this.mlFormData.checkOut || !this.mlFormData.buyPrice) {
      this.mlError = 'Please fill in all required fields: Hotel ID, Check-In, Check-Out, Buy Price.';
      return;
    }
    this.mlLoading = true;
    this.mlError = '';
    this.mlResult = null;
    this.pricingService.mlPredict({
      hotelId: this.mlFormData.hotelId,
      checkIn: this.mlFormData.checkIn,
      checkOut: this.mlFormData.checkOut,
      buyPrice: this.mlFormData.buyPrice,
      roomType: this.mlFormData.roomType || undefined,
      leadTimeDays: this.mlFormData.leadTimeDays || undefined,
      currentDemand: this.mlFormData.currentDemand || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.mlResult = res;
          this.mlLoading = false;
        },
        error: (err) => {
          this.mlError = err.error?.message || err.error?.error || 'ML prediction failed.';
          this.mlLoading = false;
        }
      });
  }

  submitBatchMLPrediction(): void {
    if (!this.mlBatchInput.trim()) {
      return;
    }
    this.mlBatchLoading = true;
    this.mlBatchResult = null;
    try {
      const opportunities = JSON.parse(this.mlBatchInput);
      this.pricingService.mlBatchPredict(opportunities)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.mlBatchResult = res;
            this.mlBatchLoading = false;
          },
          error: () => {
            this.mlBatchResult = { error: 'Batch prediction failed.' };
            this.mlBatchLoading = false;
          }
        });
    } catch {
      this.mlBatchResult = { error: 'Invalid JSON input.' };
      this.mlBatchLoading = false;
    }
  }

  // =========================================================================
  // Tab 6: Elasticity
  // =========================================================================

  loadElasticity(): void {
    if (!this.elasticityHotelId) {
      this.elasticityError = 'Please enter a Hotel ID.';
      return;
    }
    this.elasticityLoading = true;
    this.elasticityError = '';
    this.elasticityResult = null;
    this.pricingService.getElasticity(this.elasticityHotelId, {
      timeframe: this.elasticityTimeframe || undefined,
      minDataPoints: this.elasticityMinDataPoints || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.elasticityResult = res;
          this.elasticityLoading = false;
        },
        error: (err) => {
          this.elasticityError = err.error?.message || 'Failed to load elasticity data.';
          this.elasticityLoading = false;
        }
      });
  }

  loadSegmentElasticity(): void {
    if (!this.segmentElasticityHotelId) {
      return;
    }
    this.segmentElasticityLoading = true;
    this.segmentElasticityResult = null;
    this.pricingService.getSegmentElasticity(this.segmentElasticityHotelId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.segmentElasticityResult = res;
          this.segmentElasticityLoading = false;
        },
        error: () => {
          this.segmentElasticityResult = null;
          this.segmentElasticityLoading = false;
        }
      });
  }

  loadElasticityRecommendation(): void {
    if (!this.elasticityRecHotelId || !this.elasticityRecCurrentPrice) {
      return;
    }
    this.elasticityRecLoading = true;
    this.elasticityRecResult = null;
    this.pricingService.getElasticityRecommendation({
      hotelId: this.elasticityRecHotelId,
      currentPrice: this.elasticityRecCurrentPrice,
      targetMetric: this.elasticityRecTargetMetric || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.elasticityRecResult = res;
          this.elasticityRecLoading = false;
        },
        error: () => {
          this.elasticityRecResult = null;
          this.elasticityRecLoading = false;
        }
      });
  }

  // =========================================================================
  // Tab 7: Competitor Tracking
  // =========================================================================

  loadCompetitorChanges(): void {
    if (!this.competitorChangesHotelId) {
      return;
    }
    this.competitorChangesLoading = true;
    this.competitorChangesResult = null;
    this.pricingService.getCompetitorChanges(this.competitorChangesHotelId, {
      daysBack: this.competitorChangesDaysBack || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.competitorChangesResult = res;
          this.competitorChangesLoading = false;
        },
        error: () => {
          this.competitorChangesResult = null;
          this.competitorChangesLoading = false;
        }
      });
  }

  loadCompetitivePosition(): void {
    if (!this.competitorPositionHotelId || !this.competitorPositionOurPrice) {
      return;
    }
    this.competitorPositionLoading = true;
    this.competitorPositionResult = null;
    this.pricingService.getCompetitivePosition({
      hotelId: this.competitorPositionHotelId,
      ourPrice: this.competitorPositionOurPrice
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.competitorPositionResult = res;
          this.competitorPositionLoading = false;
        },
        error: () => {
          this.competitorPositionResult = null;
          this.competitorPositionLoading = false;
        }
      });
  }

  loadResponseStrategy(): void {
    if (!this.responseStrategyHotelId || !this.responseStrategyChange) {
      return;
    }
    this.responseStrategyLoading = true;
    this.responseStrategyResult = null;
    let parsedChange: any;
    try {
      parsedChange = JSON.parse(this.responseStrategyChange);
    } catch {
      this.responseStrategyResult = { error: 'Invalid JSON for competitor change.' };
      this.responseStrategyLoading = false;
      return;
    }
    this.pricingService.getResponseStrategy({
      hotelId: this.responseStrategyHotelId,
      competitorChange: parsedChange
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.responseStrategyResult = res;
          this.responseStrategyLoading = false;
        },
        error: () => {
          this.responseStrategyResult = null;
          this.responseStrategyLoading = false;
        }
      });
  }

  loadNewCompetitors(): void {
    if (!this.newCompetitorsHotelId) {
      return;
    }
    this.newCompetitorsLoading = true;
    this.newCompetitorsResult = null;
    this.pricingService.getNewCompetitors(this.newCompetitorsHotelId, {
      daysBack: this.newCompetitorsDaysBack || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.newCompetitorsResult = res;
          this.newCompetitorsLoading = false;
        },
        error: () => {
          this.newCompetitorsResult = null;
          this.newCompetitorsLoading = false;
        }
      });
  }

  loadMarketShare(): void {
    if (!this.marketShareHotelId) {
      return;
    }
    this.marketShareLoading = true;
    this.marketShareResult = null;
    this.pricingService.getMarketShare(this.marketShareHotelId, {
      weeks: this.marketShareWeeks || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.marketShareResult = res;
          this.marketShareLoading = false;
        },
        error: () => {
          this.marketShareResult = null;
          this.marketShareLoading = false;
        }
      });
  }

  // =========================================================================
  // Tab 8: Yield Management
  // =========================================================================

  loadYieldManagement(): void {
    if (!this.yieldHotelId) {
      this.yieldError = 'Please enter a Hotel ID.';
      return;
    }
    this.yieldLoading = true;
    this.yieldError = '';
    this.yieldResult = null;
    this.pricingService.getYieldManagement(this.yieldHotelId, {
      timeHorizon: this.yieldTimeHorizon || undefined
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.yieldResult = res;
          this.yieldLoading = false;
        },
        error: (err) => {
          this.yieldError = err.error?.message || 'Failed to load yield management data.';
          this.yieldLoading = false;
        }
      });
  }

  submitRevenueMaximize(): void {
    if (!this.revMaxFormData.hotelId || !this.revMaxFormData.checkIn ||
        !this.revMaxFormData.checkOut || !this.revMaxFormData.buyPrice) {
      return;
    }
    this.revMaxLoading = true;
    this.revMaxResult = null;
    const competitorPrices = this.revMaxFormData.competitorPrices
      ? this.revMaxFormData.competitorPrices.split(',').map((p: string) => parseFloat(p.trim())).filter((n: number) => !isNaN(n))
      : undefined;
    this.pricingService.maximizeRevenue({
      hotelId: this.revMaxFormData.hotelId,
      checkIn: this.revMaxFormData.checkIn,
      checkOut: this.revMaxFormData.checkOut,
      buyPrice: this.revMaxFormData.buyPrice,
      availableInventory: this.revMaxFormData.availableInventory || undefined,
      currentDemand: this.revMaxFormData.currentDemand || undefined,
      competitorPrices
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.revMaxResult = res;
          this.revMaxLoading = false;
        },
        error: () => {
          this.revMaxResult = { error: 'Revenue maximization failed.' };
          this.revMaxLoading = false;
        }
      });
  }

  // =========================================================================
  // Trends (shown on Yield tab)
  // =========================================================================

  loadTrends(): void {
    this.trendsLoading = true;
    this.pricingService.getTrends({
      days: this.globalDays,
      granularity: this.trendsGranularity
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.trendsData = res.trends || [];
          this.trendsPeriod = res.period || '';
          this.trendsLoading = false;
        },
        error: () => {
          this.trendsData = [];
          this.trendsLoading = false;
        }
      });
  }

  // =========================================================================
  // Run Metrics
  // =========================================================================

  runDailyMetrics(): void {
    this.runMetricsLoading = true;
    this.runMetricsResult = null;
    this.pricingService.runMetrics(this.runMetricsDate || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.runMetricsResult = res;
          this.runMetricsLoading = false;
        },
        error: () => {
          this.runMetricsResult = { error: 'Failed to run metrics.' };
          this.runMetricsLoading = false;
        }
      });
  }

  // =========================================================================
  // Utility
  // =========================================================================

  getSignificanceClass(level: string): string {
    if (!level) {
      return '';
    }
    if (level === '99%') {
      return 'significance-high';
    }
    if (level === '95%') {
      return 'significance-medium';
    }
    if (level === '90%') {
      return 'significance-low';
    }
    return 'significance-none';
  }

  getImpactClass(impact: string): string {
    if (impact === 'HIGH') {
      return 'impact-high';
    }
    return 'impact-low';
  }

  getProfitClass(value: number): string {
    if (value > 0) {
      return 'profit-positive';
    }
    if (value < 0) {
      return 'profit-negative';
    }
    return '';
  }

  formatJson(data: any): string {
    if (!data) {
      return '';
    }
    return JSON.stringify(data, null, 2);
  }
}
