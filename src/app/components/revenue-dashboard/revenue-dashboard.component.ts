import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { RevenueAnalyticsService, KPIs, DailySummary, RevenueBreakdown, Forecast, TopPerformer, RevenueTrend } from '../../services/revenue-analytics.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-revenue-dashboard',
  templateUrl: './revenue-dashboard.component.html',
  styleUrls: ['./revenue-dashboard.component.scss']
})
export class RevenueDashboardComponent implements OnInit, OnDestroy {
  kpis: KPIs | null = null;
  dailySummary: DailySummary[] = [];
  revenueByCity: RevenueBreakdown[] = [];
  revenueByHotel: RevenueBreakdown[] = [];
  revenueBySupplier: RevenueBreakdown[] = [];
  forecast: Forecast | null = null;
  topPerformers: TopPerformer[] = [];
  trends: RevenueTrend[] = [];
  
  loading = true;
  error: string | null = null;
  
  selectedTab: 'overview' | 'breakdown' | 'trends' | 'forecast' = 'overview';
  selectedPeriod: number = 30;
  periodOptions = [7, 14, 30, 60, 90];
  
  private subscriptions: Subscription[] = [];
  
  constructor(public revenueService: RevenueAnalyticsService, private router: Router) {}

  goBack(): void {
    this.router.navigate(['/system']);
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Load all data
   */
  loadAllData(): void {
    this.loading = true;
    this.error = null;

    // Load KPIs
    const kpisSub = this.revenueService.getKPIs(this.selectedPeriod).subscribe({
      next: (data) => {
        this.kpis = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load KPIs', err);
        this.error = 'Failed to load revenue data';
        this.loading = false;
      }
    });

    // Load top performers
    const performersSub = this.revenueService.getTopPerformers(this.selectedPeriod, 10).subscribe({
      next: (data) => this.topPerformers = data,
      error: (err) => console.error('Failed to load top performers', err)
    });

    // Load forecast
    const forecastSub = this.revenueService.getForecast(7).subscribe({
      next: (data) => this.forecast = data,
      error: (err) => console.error('Failed to load forecast', err)
    });

    // Load trends
    const trendsSub = this.revenueService.getTrends(this.selectedPeriod).subscribe({
      next: (data) => this.trends = data,
      error: (err) => console.error('Failed to load trends', err)
    });

    this.subscriptions.push(kpisSub, performersSub, forecastSub, trendsSub);
  }

  /**
   * Load breakdown data
   */
  loadBreakdownData(): void {
    if (this.revenueByCity.length > 0) return; // Already loaded

    const citySub = this.revenueService.getRevenueByCity(this.selectedPeriod).subscribe({
      next: (data) => this.revenueByCity = data,
      error: (err) => console.error('Failed to load city breakdown', err)
    });

    const hotelSub = this.revenueService.getRevenueByHotel(this.selectedPeriod).subscribe({
      next: (data) => this.revenueByHotel = data,
      error: (err) => console.error('Failed to load hotel breakdown', err)
    });

    const supplierSub = this.revenueService.getRevenueBySupplier(this.selectedPeriod).subscribe({
      next: (data) => this.revenueBySupplier = data,
      error: (err) => console.error('Failed to load supplier breakdown', err)
    });

    this.subscriptions.push(citySub, hotelSub, supplierSub);
  }

  /**
   * Change period
   */
  changePeriod(days: number): void {
    this.selectedPeriod = days;
    this.revenueByCity = [];
    this.revenueByHotel = [];
    this.revenueBySupplier = [];
    this.loadAllData();
  }

  /**
   * Change tab
   */
  changeTab(tab: 'overview' | 'breakdown' | 'trends' | 'forecast'): void {
    this.selectedTab = tab;
    
    if (tab === 'breakdown' && this.revenueByCity.length === 0) {
      this.loadBreakdownData();
    }
  }

  /**
   * Refresh data
   */
  refresh(): void {
    this.revenueByCity = [];
    this.revenueByHotel = [];
    this.revenueBySupplier = [];
    this.loadAllData();
    if (this.selectedTab === 'breakdown') {
      this.loadBreakdownData();
    }
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return this.revenueService.formatCurrency(amount);
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return this.revenueService.formatPercentage(value);
  }

  /**
   * Get growth color
   */
  getGrowthColor(value: number): string {
    return this.revenueService.getGrowthColor(value);
  }

  /**
   * Get growth icon
   */
  getGrowthIcon(value: number): string {
    return this.revenueService.getGrowthIcon(value);
  }

  /**
   * Get confidence color
   */
  getConfidenceColor(confidence: string): string {
    return this.revenueService.getConfidenceColor(confidence);
  }

  /**
   * Format confidence
   */
  formatConfidence(confidence: string): string {
    return this.revenueService.formatConfidence(confidence);
  }

  /**
   * Get top cities
   */
  getTopCities(): TopPerformer[] {
    return this.topPerformers.filter(p => p.type === 'city').slice(0, 5);
  }

  /**
   * Get top hotels
   */
  getTopHotels(): TopPerformer[] {
    return this.topPerformers.filter(p => p.type === 'hotel').slice(0, 5);
  }

  /**
   * Export to CSV
   */
  exportToCSV(): void {
    if (!this.kpis) return;

    const data = [
      ['Period', `${this.selectedPeriod} days`],
      [''],
      ['Current Period'],
      ['Bookings', this.kpis.current.bookings],
      ['Revenue', this.kpis.current.revenue],
      ['Cost', this.kpis.current.cost],
      ['Profit', this.kpis.current.profit],
      ['Profit Margin', `${this.kpis.current.profit_margin}%`],
      [''],
      ['Growth'],
      ['Bookings Growth', `${this.kpis.growth.bookings}%`],
      ['Revenue Growth', `${this.kpis.growth.revenue}%`],
      ['Profit Growth', `${this.kpis.growth.profit}%`]
    ];

    const csv = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue_analytics_${new Date().toISOString()}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
  }
}
