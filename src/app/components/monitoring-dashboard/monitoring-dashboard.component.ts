import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { Activity, Alert, HealthStatus, Metrics, MonitoringService, TrendData } from '../../services/monitoring.service';

@Component({
  selector: 'app-monitoring-dashboard',
  templateUrl: './monitoring-dashboard.component.html',
  styleUrls: ['./monitoring-dashboard.component.scss']
})
export class MonitoringDashboardComponent implements OnInit, OnDestroy {
  metrics: Metrics | null = null;
  health: HealthStatus | null = null;
  activity: Activity[] = [];
  alerts: Alert[] = [];
  trends: TrendData[] = [];
  
  loading = true;
  error: string | null = null;
  
  private subscriptions: Subscription[] = [];
  
  // UI State
  selectedTab: 'overview' | 'activity' | 'trends' = 'overview';
  autoRefresh = true;
  refreshInterval = 10; // seconds
  
  constructor(private monitoringService: MonitoringService, private router: Router) {}

  ngOnInit(): void {
    this.loadAllData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Load all dashboard data
   */
  loadAllData(): void {
    this.loading = true;
    this.error = null;

    // Load metrics
    const metricsSub = this.monitoringService.getMetrics().subscribe({
      next: (data) => {
        this.metrics = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load metrics', err);
        this.error = 'Failed to load metrics';
        this.loading = false;
      }
    });

    // Load health
    const healthSub = this.monitoringService.getHealth().subscribe({
      next: (data) => this.health = data,
      error: (err) => console.error('Failed to load health', err)
    });

    // Load activity
    const activitySub = this.monitoringService.getActivity(30).subscribe({
      next: (data) => this.activity = data,
      error: (err) => console.error('Failed to load activity', err)
    });

    // Load alerts
    const alertsSub = this.monitoringService.getAlerts().subscribe({
      next: (data) => this.alerts = data,
      error: (err) => console.error('Failed to load alerts', err)
    });

    // Load trends
    const trendsSub = this.monitoringService.getTrends().subscribe({
      next: (data) => this.trends = data,
      error: (err) => console.error('Failed to load trends', err)
    });

    this.subscriptions.push(metricsSub, healthSub, activitySub, alertsSub, trendsSub);
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh(): void {
    if (this.autoRefresh) {
      const refreshSub = interval(this.refreshInterval * 1000)
        .subscribe(() => this.loadAllData());
      this.subscriptions.push(refreshSub);
    }
  }

  /**
   * Toggle auto-refresh
   */
  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  /**
   * Manual refresh
   */
  refresh(): void {
    this.loadAllData();
  }

  /**
   * Get status color
   */
  getStatusColor(status: string): string {
    return this.monitoringService.getStatusColor(status);
  }

  /**
   * Get severity icon
   */
  getSeverityIcon(severity: string): string {
    return this.monitoringService.getSeverityIcon(severity);
  }

  /**
   * Format number
   */
  formatNumber(num: number): string {
    return this.monitoringService.formatNumber(num);
  }

  /**
   * Get activity icon
   */
  getActivityIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'booking': '📦',
      'cancellation': '❌',
      'error': '⚠️'
    };
    return icons[type] || '•';
  }

  /**
   * Get activity color
   */
  getActivityColor(status: string): string {
    return this.getStatusColor(status);
  }

  /**
   * Parse percentage from string
   */
  parsePercentage(value: string): number {
    return parseFloat(value.replace('%', ''));
  }

  /**
   * Get health status text in Hebrew
   */
  getHealthStatusText(status: string): string {
    const texts: { [key: string]: string } = {
      'healthy': 'תקין',
      'warning': 'אזהרה',
      'critical': 'קריטי'
    };
    return texts[status] || status;
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): void {
    if (!this.metrics) return;

    const dataStr = JSON.stringify(this.metrics, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `metrics_${new Date().toISOString()}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * Get chart data for bookings trend
   */
  getBookingsTrendData(): any[] {
    if (!this.trends.length) return [];
    
    return this.trends.map(t => ({
      name: t.hour,
      value: t.bookings
    }));
  }

  /**
   * Get chart data for revenue trend
   */
  getRevenueTrendData(): any[] {
    if (!this.trends.length) return [];
    
    return this.trends.map(t => ({
      name: t.hour,
      value: t.revenue
    }));
  }

  /**
   * Get chart data for profit trend
   */
  getProfitTrendData(): any[] {
    if (!this.trends.length) return [];
    
    return this.trends.map(t => ({
      name: t.hour,
      value: t.profit
    }));
  }

  /**
   * Get critical alerts count
   */
  getCriticalAlertsCount(): number {
    return this.alerts.filter(a => a.severity === 'critical').length;
  }

  /**
   * Get warning alerts count
   */
  getWarningAlertsCount(): number {
    return this.alerts.filter(a => a.severity === 'warning').length;
  }

  /**
   * Dismiss alert
   */
  dismissAlert(alertId: string): void {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
  }

  /**
   * Calculate time ago
   */
  timeAgo(timestamp: string | Date): string {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return `לפני ${seconds} שניות`;
    if (seconds < 3600) return `לפני ${Math.floor(seconds / 60)} דקות`;
    if (seconds < 86400) return `לפני ${Math.floor(seconds / 3600)} שעות`;
    return `לפני ${Math.floor(seconds / 86400)} ימים`;
  }

  /**
   * Get status codes as array for iteration
   */
  getStatusCodesArray(): Array<{ code: string, count: number }> {
    if (!this.metrics?.api?.status_codes) return [];
    
    return Object.entries(this.metrics.api.status_codes)
      .map(([code, count]) => ({ code, count: count as number }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get status code color
   */
  getStatusCodeColor(code: string): string {
    const codeNum = parseInt(code);
    if (codeNum >= 200 && codeNum < 300) return '#4caf50';
    if (codeNum >= 300 && codeNum < 400) return '#2196f3';
    if (codeNum >= 400 && codeNum < 500) return '#ff9800';
    if (codeNum >= 500) return '#f44336';
    return '#757575';
  }

  /**
   * Navigate back to system overview
   */
  goBack(): void {
    this.router.navigate(['/system']);
  }
}
