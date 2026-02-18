import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  SearchIntelligenceService,
  SearchOverview,
  CitySearchData,
  HotelSearchData,
  SearchTrendData,
  PriceDistribution,
  SeasonalityData,
  DemandForecast,
  RealTimeSearch,
  ComparisonData
} from 'src/app/services/search-intelligence.service';

@Component({
  selector: 'app-search-intelligence',
  templateUrl: './search-intelligence.component.html',
  styleUrls: ['./search-intelligence.component.scss']
})
export class SearchIntelligenceComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  loading = false;
  selectedTabIndex = 0;

  // Tab 1: Overview
  overview: SearchOverview | null = null;
  overviewLoading = false;

  // Tab 2: Top Cities
  citiesData: CitySearchData[] = [];
  citiesLoading = false;
  citiesLimit = 20;
  citiesColumns: string[] = [
    'CityName', 'CountryCode', 'SearchCount', 'Percentage',
    'AvgPrice', 'UniqueHotels', 'LastSearched'
  ];

  // Tab 3: Top Hotels
  hotelsData: HotelSearchData[] = [];
  hotelsLoading = false;
  hotelsLimit = 20;
  hotelCityFilter = '';
  hotelsColumns: string[] = [
    'HotelName', 'CityName', 'SearchCount', 'Percentage',
    'AvgPrice', 'AvgStars', 'LastSearched'
  ];

  // Tab 4: Trends
  trendsData: SearchTrendData[] = [];
  trendsLoading = false;
  trendsGranularity: 'daily' | 'monthly' | 'yearly' = 'monthly';
  trendsColumns: string[] = [
    'Period', 'SearchCount', 'UniqueHotels', 'UniqueCities', 'AvgPrice'
  ];

  // Tab 5: Prices
  pricesData: PriceDistribution[] = [];
  pricesLoading = false;
  pricesColumns: string[] = [
    'Currency', 'SearchCount', 'AvgPrice', 'MinPrice', 'MaxPrice',
    'Q1', 'Median', 'Q3'
  ];

  // Tab 6: Seasonality
  seasonalityData: SeasonalityData | null = null;
  seasonalityLoading = false;
  bookingWindowColumns: string[] = ['DaysBeforeStay', 'SearchCount', 'AvgPrice'];
  monthlySeasonColumns: string[] = ['MonthName', 'SearchCount', 'AvgPrice'];

  // Tab 7: Demand Forecast
  forecastData: DemandForecast | null = null;
  forecastLoading = false;
  forecastCity = '';
  forecastHotelId: number | null = null;
  forecastColumns: string[] = ['Month', 'SearchCount', 'AvgPrice'];

  // Tab 8: Real-Time
  realTimeData: RealTimeSearch[] = [];
  realTimeLoading = false;
  realTimeLimit = 50;
  realTimeColumns: string[] = [
    'HotelName', 'CityName', 'StayFrom', 'StayTo',
    'PriceAmount', 'PriceAmountCurrency', 'RoomType', 'Board', 'Stars', 'UpdatedAt'
  ];

  // Tab 9: Conversion
  comparisonData: ComparisonData | null = null;
  comparisonLoading = false;
  comparisonCity = '';
  comparisonHotelId: number | null = null;
  comparisonError = '';

  constructor(private searchIntelligenceService: SearchIntelligenceService) {}

  ngOnInit(): void {
    this.loadOverview();
    this.loadCities();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    switch (index) {
      case 0:
        if (!this.overview) { this.loadOverview(); }
        break;
      case 1:
        if (this.citiesData.length === 0) { this.loadCities(); }
        break;
      case 2:
        if (this.hotelsData.length === 0) { this.loadHotels(); }
        break;
      case 3:
        if (this.trendsData.length === 0) { this.loadTrends(); }
        break;
      case 4:
        if (this.pricesData.length === 0) { this.loadPrices(); }
        break;
      case 5:
        if (!this.seasonalityData) { this.loadSeasonality(); }
        break;
      case 6:
        if (!this.forecastData) { this.loadForecast(); }
        break;
      case 7:
        if (this.realTimeData.length === 0) { this.loadRealTime(); }
        break;
      case 8:
        break;
      default:
        break;
    }
  }

  // --- Tab 1: Overview ---

  loadOverview(): void {
    this.overviewLoading = true;
    this.searchIntelligenceService.getOverview()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.overview = res.data;
          this.overviewLoading = false;
        },
        error: () => {
          this.overview = null;
          this.overviewLoading = false;
        }
      });
  }

  // --- Tab 2: Top Cities ---

  loadCities(): void {
    this.citiesLoading = true;
    this.searchIntelligenceService.getTopCities(this.citiesLimit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.citiesData = res.data || [];
          this.citiesLoading = false;
        },
        error: () => {
          this.citiesData = [];
          this.citiesLoading = false;
        }
      });
  }

  onCitiesLimitChange(): void {
    this.loadCities();
  }

  // --- Tab 3: Top Hotels ---

  loadHotels(): void {
    this.hotelsLoading = true;
    const city = this.hotelCityFilter.trim() || undefined;
    this.searchIntelligenceService.getTopHotels(this.hotelsLimit, city)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.hotelsData = res.data || [];
          this.hotelsLoading = false;
        },
        error: () => {
          this.hotelsData = [];
          this.hotelsLoading = false;
        }
      });
  }

  onHotelFilterChange(): void {
    this.loadHotels();
  }

  // --- Tab 4: Trends ---

  loadTrends(): void {
    this.trendsLoading = true;
    this.searchIntelligenceService.getTrends(this.trendsGranularity)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.trendsData = res.data || [];
          this.trendsLoading = false;
        },
        error: () => {
          this.trendsData = [];
          this.trendsLoading = false;
        }
      });
  }

  onGranularityChange(): void {
    this.loadTrends();
  }

  getTrendIndicator(index: number): string {
    if (index === 0 || this.trendsData.length < 2) {
      return '';
    }
    const current = this.trendsData[index].SearchCount;
    const previous = this.trendsData[index - 1].SearchCount;
    if (current > previous) {
      return 'trending_up';
    }
    if (current < previous) {
      return 'trending_down';
    }
    return 'trending_flat';
  }

  getTrendClass(index: number): string {
    const indicator = this.getTrendIndicator(index);
    if (indicator === 'trending_up') {
      return 'trend-up';
    }
    if (indicator === 'trending_down') {
      return 'trend-down';
    }
    return 'trend-flat';
  }

  // --- Tab 5: Prices ---

  loadPrices(): void {
    this.pricesLoading = true;
    this.searchIntelligenceService.getPrices()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.pricesData = res.data || [];
          this.pricesLoading = false;
        },
        error: () => {
          this.pricesData = [];
          this.pricesLoading = false;
        }
      });
  }

  // --- Tab 6: Seasonality ---

  loadSeasonality(): void {
    this.seasonalityLoading = true;
    this.searchIntelligenceService.getSeasonality()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.seasonalityData = res.data;
          this.seasonalityLoading = false;
        },
        error: () => {
          this.seasonalityData = null;
          this.seasonalityLoading = false;
        }
      });
  }

  getSeasonalityBarWidth(entry: { SearchCount: number }): number {
    if (!this.seasonalityData || this.seasonalityData.monthlySeasonality.length === 0) {
      return 0;
    }
    const maxCount = Math.max(
      ...this.seasonalityData.monthlySeasonality.map(m => m.SearchCount)
    );
    return maxCount > 0 ? (entry.SearchCount / maxCount) * 100 : 0;
  }

  // --- Tab 7: Demand Forecast ---

  loadForecast(): void {
    this.forecastLoading = true;
    const city = this.forecastCity.trim() || undefined;
    const hotelId = this.forecastHotelId || undefined;
    this.searchIntelligenceService.getDemandForecast(city, hotelId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.forecastData = res.data;
          this.forecastLoading = false;
        },
        error: () => {
          this.forecastData = null;
          this.forecastLoading = false;
        }
      });
  }

  onForecastFilterChange(): void {
    this.loadForecast();
  }

  getForecastTrendIcon(): string {
    if (!this.forecastData?.forecast) {
      return 'help_outline';
    }
    return this.forecastData.forecast.trend === 'increasing'
      ? 'trending_up'
      : 'trending_down';
  }

  getForecastTrendClass(): string {
    if (!this.forecastData?.forecast) {
      return '';
    }
    return this.forecastData.forecast.trend === 'increasing'
      ? 'trend-up'
      : 'trend-down';
  }

  // --- Tab 8: Real-Time ---

  loadRealTime(): void {
    this.realTimeLoading = true;
    this.searchIntelligenceService.getRealTime(this.realTimeLimit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.realTimeData = res.data || [];
          this.realTimeLoading = false;
        },
        error: () => {
          this.realTimeData = [];
          this.realTimeLoading = false;
        }
      });
  }

  onRealTimeLimitChange(): void {
    this.loadRealTime();
  }

  getTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    return `${Math.floor(diffHours / 24)}d ago`;
  }

  // --- Tab 9: Conversion / Comparison ---

  loadComparison(): void {
    const city = this.comparisonCity.trim() || undefined;
    const hotelId = this.comparisonHotelId || undefined;
    if (!city && !hotelId) {
      this.comparisonError = 'Please enter a city name or hotel ID to compare.';
      return;
    }
    this.comparisonError = '';
    this.comparisonLoading = true;
    this.searchIntelligenceService.getComparison(city, hotelId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.comparisonData = res.data;
          this.comparisonLoading = false;
        },
        error: (err) => {
          this.comparisonData = null;
          this.comparisonError = err.error?.error || 'Failed to load comparison data.';
          this.comparisonLoading = false;
        }
      });
  }

  // --- Global ---

  refreshCurrentTab(): void {
    switch (this.selectedTabIndex) {
      case 0: this.loadOverview(); break;
      case 1: this.loadCities(); break;
      case 2: this.loadHotels(); break;
      case 3: this.loadTrends(); break;
      case 4: this.loadPrices(); break;
      case 5: this.loadSeasonality(); break;
      case 6: this.loadForecast(); break;
      case 7: this.loadRealTime(); break;
      case 8: this.loadComparison(); break;
      default: break;
    }
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    return value.toLocaleString();
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    return '$' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}
