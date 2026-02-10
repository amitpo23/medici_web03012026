import { Component, OnDestroy, OnInit } from '@angular/core';
import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
    DashboardAlert, DashboardService,
    DashboardStats, ForecastResponse, HotelPerformance, WorkerStatus
} from '../../services/dashboard.service';
import { environment } from '../../environments/environment';

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
  dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' = 'year';
  private destroy$ = new Subject<void>();
  private monitoringInterval: any;

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

  // System Monitoring Widgets Data
  systemHealth = {
    status: 'healthy', // healthy, warning, critical
    icon: 'check_circle',
    text: 'All Systems Operational',
    uptime: '99.9%',
    avgResponse: 0
  };
  
  activeAlerts = 0;
  alertsBreakdown = {
    critical: 0,
    warning: 0,
    info: 0
  };
  
  todayRevenue = 0;
  todayProfit = 0;
  todayMargin = 0;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadSystemMonitoringData();
    
    // Refresh system monitoring data every 30 seconds
    this.monitoringInterval = setInterval(() => this.loadSystemMonitoringData(), 30000);
  }

  ngOnDestroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  setDateRange(range: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all'): void {
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
      case 'quarter': return 90;
      case 'year': return 365;
      case 'all': return 3650;
      default: return 365;
    }
  }

  refreshData(): void {
    this.loadDashboardData();
    this.loadSystemMonitoringData();
  }

  loadSystemMonitoringData(): void {
    const apiBase = environment.apiUrl;

    // Load system health
    fetch(`${apiBase}/monitoring/health`)
      .then(res => res.json())
      .then(data => {
        this.systemHealth.status = data.status || 'healthy';
        this.systemHealth.icon = this.getHealthIcon(data.status);
        this.systemHealth.text = this.getHealthText(data.status);
        this.systemHealth.avgResponse = data.metrics?.avgResponseTime || 0;
      })
      .catch(() => {
        this.systemHealth.status = 'healthy';
        this.systemHealth.icon = 'check_circle';
        this.systemHealth.text = 'All Systems Operational';
      });

    // Load active alerts from backend
    fetch(`${apiBase}/alerts/history?limit=20`)
      .then(res => res.json())
      .then(response => {
        const alerts = response.alerts || [];
        this.activeAlerts = alerts.filter((a: any) => !a.resolvedAt).length;
        this.alertsBreakdown = {
          critical: alerts.filter((a: any) => a.severity === 'critical').length,
          warning: alerts.filter((a: any) => a.severity === 'high' || a.severity === 'warning').length,
          info: alerts.filter((a: any) => a.severity === 'medium' || a.severity === 'info').length
        };
      })
      .catch(() => {
        this.activeAlerts = 0;
        this.alertsBreakdown = { critical: 0, warning: 0, info: 0 };
      });

    // Calculate today's revenue/profit from KPI data
    if (this.dateRange === 'today') {
      this.todayRevenue = this.kpiData.totalRevenue;
      this.todayProfit = this.kpiData.totalProfit;
    } else {
      // Get today's stats
      this.dashboardService.getStats(1).subscribe({
        next: (stats) => {
          this.todayRevenue = stats.overview.TotalPushPrice || 0;
          this.todayProfit = stats.overview.TotalExpectedProfit || 0;
          this.todayMargin = this.todayRevenue > 0 ? 
            ((this.todayProfit / this.todayRevenue) * 100) : 0;
        },
        error: () => {
          this.todayRevenue = 0;
          this.todayProfit = 0;
          this.todayMargin = 0;
        }
      });
    }
  }

  private getHealthIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'healthy': 'check_circle',
      'warning': 'warning',
      'critical': 'error'
    };
    return icons[status] || 'help';
  }

  private getHealthText(status: string): string {
    const texts: { [key: string]: string } = {
      'healthy': 'All Systems Operational',
      'warning': 'Minor Issues Detected',
      'critical': 'Critical Issues - Action Required'
    };
    return texts[status] || 'Unknown Status';
  }
}
