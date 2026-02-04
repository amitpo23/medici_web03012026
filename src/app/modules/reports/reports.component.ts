import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from 'src/app/environments/environment';

interface ProfitLossSummary {
  TotalRevenue: number;
  TotalCost: number;
  TotalProfit: number;
  MarginPercent: number;
  TotalBookings: number;
  ProfitableBookings: number;
  LossBookings: number;
}

interface MarginByHotel {
  HotelName: string;
  TotalBookings: number;
  TotalCost: number;
  TotalRevenue: number;
  TotalProfit: number;
  MarginPercent: number;
}

interface MarginByDate {
  Date: string;
  Bookings: number;
  TotalCost: number;
  TotalRevenue: number;
  TotalProfit: number;
}

interface TopHotel {
  Rank: number;
  HotelName: string;
  TotalProfit: number;
  MarginPercent: number;
  TotalBookings: number;
}

interface LossBooking {
  HotelName: string;
  BookingId: string;
  Cost: number;
  SellPrice: number;
  LossAmount: number;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private baseUrl = environment.baseUrl;

  loading = false;
  selectedTabIndex = 0;

  // Date range filter
  startDate: Date | null = null;
  endDate: Date | null = null;

  // P&L Summary
  profitLossData: ProfitLossSummary[] = [];
  profitLossColumns: string[] = [
    'TotalRevenue', 'TotalCost', 'TotalProfit', 'MarginPercent',
    'TotalBookings', 'ProfitableBookings', 'LossBookings'
  ];

  // Margin by Hotel
  marginByHotelData: MarginByHotel[] = [];
  marginByHotelColumns: string[] = [
    'HotelName', 'TotalBookings', 'TotalCost', 'TotalRevenue', 'TotalProfit', 'MarginPercent'
  ];

  // Daily Trends
  dailyTrendsData: MarginByDate[] = [];
  dailyTrendsColumns: string[] = [
    'Date', 'Bookings', 'TotalCost', 'TotalRevenue', 'TotalProfit'
  ];

  // Top Hotels
  topHotelsData: TopHotel[] = [];
  topHotelsColumns: string[] = [
    'Rank', 'HotelName', 'TotalProfit', 'MarginPercent', 'TotalBookings'
  ];

  // Loss Report
  lossReportData: LossBooking[] = [];
  lossReportColumns: string[] = [
    'HotelName', 'BookingId', 'Cost', 'SellPrice', 'LossAmount'
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.setDefaultDateRange();
    this.loadAllReports();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setDefaultDateRange(): void {
    const now = new Date();
    this.endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  onDateChange(): void {
    if (this.startDate && this.endDate) {
      this.loadAllReports();
    }
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
  }

  loadAllReports(): void {
    this.loading = true;
    this.loadProfitLoss();
    this.loadMarginByHotel();
    this.loadDailyTrends();
    this.loadTopHotels();
    this.loadLossReport();
  }

  private buildDateParams(): HttpParams {
    let params = new HttpParams();
    if (this.startDate) {
      params = params.set('startDate', this.formatDate(this.startDate));
    }
    if (this.endDate) {
      params = params.set('endDate', this.formatDate(this.endDate));
    }
    return params;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadProfitLoss(): void {
    const params = this.buildDateParams();
    this.http.get<ProfitLossSummary>(this.baseUrl + 'reports/ProfitLoss', { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.profitLossData = data ? [data] : [];
          this.checkLoadingComplete();
        },
        error: () => {
          this.profitLossData = [];
          this.checkLoadingComplete();
        }
      });
  }

  private loadMarginByHotel(): void {
    const params = this.buildDateParams();
    this.http.get<MarginByHotel[]>(this.baseUrl + 'reports/MarginByHotel', { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.marginByHotelData = data || [];
          this.checkLoadingComplete();
        },
        error: () => {
          this.marginByHotelData = [];
          this.checkLoadingComplete();
        }
      });
  }

  private loadDailyTrends(): void {
    const params = this.buildDateParams();
    this.http.get<MarginByDate[]>(this.baseUrl + 'reports/MarginByDate', { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.dailyTrendsData = data || [];
          this.checkLoadingComplete();
        },
        error: () => {
          this.dailyTrendsData = [];
          this.checkLoadingComplete();
        }
      });
  }

  private loadTopHotels(): void {
    const params = new HttpParams().set('limit', '10');
    this.http.get<TopHotel[]>(this.baseUrl + 'reports/TopHotels', { params })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.topHotelsData = data || [];
          this.checkLoadingComplete();
        },
        error: () => {
          this.topHotelsData = [];
          this.checkLoadingComplete();
        }
      });
  }

  private loadLossReport(): void {
    this.http.get<LossBooking[]>(this.baseUrl + 'reports/LossReport')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.lossReportData = data || [];
          this.checkLoadingComplete();
        },
        error: () => {
          this.lossReportData = [];
          this.checkLoadingComplete();
        }
      });
  }

  private loadCount = 0;
  private checkLoadingComplete(): void {
    this.loadCount++;
    if (this.loadCount >= 5) {
      this.loading = false;
      this.loadCount = 0;
    }
  }

  refreshData(): void {
    this.loadCount = 0;
    this.loadAllReports();
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
}
