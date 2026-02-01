import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  DashboardService,
  DashboardStats,
  DashboardAlert,
  HotelPerformance,
  ForecastResponse,
  WorkerStatus
} from '../../services/dashboard.service';

interface Activity {
  type: string;
  icon: string;
  title: string;
  time: string;
  value: string;
  valueClass: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  loading = true;
  dateRange: 'today' | 'week' | 'month' = 'month';
  private destroy$ = new Subject<void>();

  // KPI Data from backend
  kpiData = {
    totalRevenue: 0,
    totalProfit: 0,
    averageMargin: 0,
    activeBookings: 0,
    soldCount: 0,
    cancelledCount: 0,
    profitMargin: 0,
    conversionRate: 0,
    totalReservations: 0,
    reservationRevenue: 0,
    revenueChange: 0,
    profitChange: 0
  };

  // Alerts from backend
  alerts: DashboardAlert[] = [];

  // Hotel performance
  topHotels: HotelPerformance[] = [];

  // Forecast
  forecast: ForecastResponse | null = null;

  // Worker status
  workers: WorkerStatus | null = null;

  // Daily trend for charts
  dailyTrend: { Date: string; Bookings: number; Cost: number; PushPrice: number }[] = [];

  // Recent Activity (derived from daily trend)
  recentActivity: Activity[] = [];

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setDateRange(range: 'today' | 'week' | 'month'): void {
    this.dateRange = range;
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    const period = this.getPeriodDays();

    forkJoin({
      stats: this.dashboardService.getStats(period),
      alerts: this.dashboardService.getAlerts(),
      hotels: this.dashboardService.getHotelPerformance(10),
      forecast: this.dashboardService.getForecast(30),
      workers: this.dashboardService.getWorkerStatus()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ stats, alerts, hotels, forecast, workers }) => {
        this.processStats(stats);
        this.alerts = alerts;
        this.topHotels = hotels;
        this.forecast = forecast;
        this.workers = workers;
        this.dailyTrend = stats.dailyTrend || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  processStats(stats: DashboardStats): void {
    const overview = stats.overview || {};
    const reservations = stats.reservations || {};

    // סכומים מהבקאנד
    this.kpiData.totalRevenue = overview.TotalPushPrice || 0;
    this.kpiData.totalProfit = overview.TotalExpectedProfit || 0;
    this.kpiData.activeBookings = overview.ActiveCount || 0;
    this.kpiData.soldCount = overview.SoldCount || 0;
    this.kpiData.cancelledCount = overview.CancelledCount || 0;
    this.kpiData.averageMargin = overview.AvgMargin || 0;
    this.kpiData.profitMargin = overview.AvgMargin || 0;
    this.kpiData.conversionRate = parseFloat(overview.ConversionRate) || 0;
    this.kpiData.totalReservations = reservations.TotalReservations || 0;
    this.kpiData.reservationRevenue = reservations.TotalRevenue || 0;

    // אם אין נתונים משרת - להציג ערכי דמה בסביבה לוקאלית
    if (this.kpiData.totalRevenue === 0 && this.kpiData.activeBookings === 0) {
      console.warn('No data from backend, displaying sample data');
      this.kpiData.totalRevenue = overview.TotalCost || 0;
      this.kpiData.totalProfit = overview.TotalExpectedProfit || 0;
      this.kpiData.activeBookings = overview.TotalBookings || 0;
    }

    // Change percentages based on daily trend
    if (stats.dailyTrend && stats.dailyTrend.length >= 2) {
      const latest = stats.dailyTrend[stats.dailyTrend.length - 1];
      const previous = stats.dailyTrend[stats.dailyTrend.length - 2];
      if (previous.PushPrice > 0) {
        this.kpiData.revenueChange = ((latest.PushPrice - previous.PushPrice) / previous.PushPrice) * 100;
      }
    }
  }

  getPeriodDays(): number {
    switch (this.dateRange) {
      case 'today': return 1;
      case 'week': return 7;
      case 'month': return 30;
      default: return 30;
    }
  }

  refreshData(): void {
    this.loadDashboardData();
  }
}
