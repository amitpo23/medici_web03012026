import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  DailySummary,
  Forecast,
  KPIs,
  RevenueAnalyticsService,
  RevenueBreakdown,
  RevenueTrend,
  TopPerformer
} from 'src/app/services/revenue-analytics.service';

interface SummaryData {
  kpis: KPIs;
  top_performers: TopPerformer[];
  forecast_7_days: Forecast;
}

@Component({
  selector: 'app-revenue-analytics',
  templateUrl: './revenue-analytics.component.html',
  styleUrls: ['./revenue-analytics.component.scss']
})
export class RevenueAnalyticsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Loading states
  loading = false;
  kpisLoading = false;
  dailyLoading = false;
  cityLoading = false;
  hotelLoading = false;
  supplierLoading = false;
  forecastLoading = false;
  trendsLoading = false;
  topPerformersLoading = false;

  // Tab state
  selectedTabIndex = 0;

  // Period selector
  selectedPeriod = 30;
  periodOptions: { value: number; label: string }[] = [
    { value: 7, label: 'Last 7 Days' },
    { value: 14, label: 'Last 14 Days' },
    { value: 30, label: 'Last 30 Days' },
    { value: 60, label: 'Last 60 Days' },
    { value: 90, label: 'Last 90 Days' },
    { value: 180, label: 'Last 180 Days' },
    { value: 365, label: 'Last 365 Days' }
  ];

  // Granularity for trends
  selectedGranularity: 'daily' | 'hourly' = 'daily';

  // Forecast days
  forecastDays = 7;

  // KPIs data
  kpis: KPIs | null = null;

  // Daily P&L
  dailySummaryData: DailySummary[] = [];
  dailyColumns: string[] = [
    'date', 'bookings_count', 'total_revenue', 'total_cost',
    'total_profit', 'avg_profit_per_booking', 'profit_margin_percent'
  ];

  // Revenue by City
  cityData: RevenueBreakdown[] = [];
  cityColumns: string[] = [
    'city', 'bookings_count', 'total_revenue', 'total_cost',
    'total_profit', 'avg_profit', 'profit_margin'
  ];

  // Revenue by Hotel
  hotelData: RevenueBreakdown[] = [];
  hotelColumns: string[] = [
    'hotel', 'bookings_count', 'total_revenue', 'total_cost',
    'total_profit', 'avg_profit', 'profit_margin'
  ];

  // Revenue by Supplier
  supplierData: RevenueBreakdown[] = [];
  supplierColumns: string[] = [
    'supplier', 'bookings_count', 'total_revenue', 'total_cost',
    'total_profit', 'avg_profit', 'profit_margin'
  ];

  // Forecast
  forecastData: Forecast | null = null;

  // Top Performers
  topPerformers: TopPerformer[] = [];

  // Trends
  trendsData: RevenueTrend[] = [];
  trendsColumns: string[] = [
    'period', 'revenue', 'profit', 'bookings', 'avg_booking_value'
  ];

  // Summary
  summaryData: SummaryData | null = null;

  // Error states
  errorMessage = '';

  constructor(private revenueService: RevenueAnalyticsService) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPeriodChange(): void {
    this.loadAllData();
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
  }

  onGranularityChange(): void {
    this.loadTrends();
  }

  onForecastDaysChange(): void {
    this.loadForecast();
  }

  refreshData(): void {
    this.loadAllData();
  }

  loadAllData(): void {
    this.loading = true;
    this.errorMessage = '';
    this.loadKPIs();
    this.loadDailySummary();
    this.loadCityBreakdown();
    this.loadHotelBreakdown();
    this.loadSupplierBreakdown();
    this.loadForecast();
    this.loadTopPerformers();
    this.loadTrends();
  }

  private loadKPIs(): void {
    this.kpisLoading = true;
    this.revenueService.getKPIs(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.kpis = data;
          this.kpisLoading = false;
          this.checkAllLoaded();
        },
        error: () => {
          this.kpis = null;
          this.kpisLoading = false;
          this.checkAllLoaded();
        }
      });
  }

  private loadDailySummary(): void {
    this.dailyLoading = true;
    this.revenueService.getDailySummary(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.dailySummaryData = data || [];
          this.dailyLoading = false;
          this.checkAllLoaded();
        },
        error: () => {
          this.dailySummaryData = [];
          this.dailyLoading = false;
          this.checkAllLoaded();
        }
      });
  }

  private loadCityBreakdown(): void {
    this.cityLoading = true;
    this.revenueService.getRevenueByCity(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.cityData = data || [];
          this.cityLoading = false;
          this.checkAllLoaded();
        },
        error: () => {
          this.cityData = [];
          this.cityLoading = false;
          this.checkAllLoaded();
        }
      });
  }

  private loadHotelBreakdown(): void {
    this.hotelLoading = true;
    this.revenueService.getRevenueByHotel(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.hotelData = data || [];
          this.hotelLoading = false;
          this.checkAllLoaded();
        },
        error: () => {
          this.hotelData = [];
          this.hotelLoading = false;
          this.checkAllLoaded();
        }
      });
  }

  private loadSupplierBreakdown(): void {
    this.supplierLoading = true;
    this.revenueService.getRevenueBySupplier(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.supplierData = data || [];
          this.supplierLoading = false;
          this.checkAllLoaded();
        },
        error: () => {
          this.supplierData = [];
          this.supplierLoading = false;
          this.checkAllLoaded();
        }
      });
  }

  private loadForecast(): void {
    this.forecastLoading = true;
    this.revenueService.getForecast(this.forecastDays)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.forecastData = data;
          this.forecastLoading = false;
          this.checkAllLoaded();
        },
        error: () => {
          this.forecastData = null;
          this.forecastLoading = false;
          this.checkAllLoaded();
        }
      });
  }

  private loadTopPerformers(): void {
    this.topPerformersLoading = true;
    this.revenueService.getTopPerformers(this.selectedPeriod, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.topPerformers = data || [];
          this.topPerformersLoading = false;
          this.checkAllLoaded();
        },
        error: () => {
          this.topPerformers = [];
          this.topPerformersLoading = false;
          this.checkAllLoaded();
        }
      });
  }

  private loadTrends(): void {
    this.trendsLoading = true;
    this.revenueService.getTrends(this.selectedPeriod, this.selectedGranularity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.trendsData = data || [];
          this.trendsLoading = false;
          this.checkAllLoaded();
        },
        error: () => {
          this.trendsData = [];
          this.trendsLoading = false;
          this.checkAllLoaded();
        }
      });
  }

  private loadCount = 0;
  private checkAllLoaded(): void {
    this.loadCount++;
    if (this.loadCount >= 8) {
      this.loading = false;
      this.loadCount = 0;
    }
  }

  // Helper methods for template
  getProfitClass(value: number): string {
    if (value > 0) return 'profit-positive';
    if (value < 0) return 'profit-negative';
    return '';
  }

  getGrowthClass(value: number): string {
    if (value > 0) return 'growth-positive';
    if (value < 0) return 'growth-negative';
    return 'growth-neutral';
  }

  getGrowthIcon(value: number): string {
    return this.revenueService.getGrowthIcon(value);
  }

  getGrowthColor(value: number): string {
    return this.revenueService.getGrowthColor(value);
  }

  getConfidenceClass(confidence: string): string {
    const classes: { [key: string]: string } = {
      'high': 'confidence-high',
      'medium': 'confidence-medium',
      'low': 'confidence-low'
    };
    return classes[confidence] || 'confidence-low';
  }

  getConfidenceLabel(confidence: string): string {
    return this.revenueService.formatConfidence(confidence);
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === null || amount === undefined) return '--';
    return this.revenueService.formatCurrency(amount);
  }

  formatPercentage(value: number): string {
    if (value === null || value === undefined) return '--';
    return this.revenueService.formatPercentage(value);
  }

  formatNumber(value: number): string {
    if (value === null || value === undefined) return '--';
    return value.toLocaleString('en-US');
  }

  getBarWidth(value: number, maxValue: number): number {
    if (maxValue <= 0) return 0;
    return Math.min(Math.round((value / maxValue) * 100), 100);
  }

  getMaxRevenue(data: RevenueBreakdown[]): number {
    if (!data || data.length === 0) return 0;
    return Math.max(...data.map(item => item.total_revenue));
  }

  getMaxProfit(data: RevenueBreakdown[]): number {
    if (!data || data.length === 0) return 0;
    return Math.max(...data.map(item => item.total_profit));
  }
}
