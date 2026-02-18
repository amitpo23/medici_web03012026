import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { interval, Observable } from 'rxjs';
import { shareReplay, startWith, switchMap } from 'rxjs/operators';
import { environment } from 'src/app/environments/environment';

export interface Metrics {
  bookings: {
    total_today: number;
    last_hour: number;
    active_opportunities: number;
    conversion_rate: string;
    last_updated: string;
  };
  api: {
    total_requests: number;
    error_count: number;
    error_rate: string;
    avg_response_time: string;
    slow_requests: Array<{
      url: string;
      responseTime: string;
      status: number;
    }>;
    status_codes: { [key: string]: number };
    last_updated: string;
  };
  revenue: {
    today: string;
    today_raw: number;
    this_hour: string;
    profit: string;
    profit_raw: number;
    avg_margin: string;
    bookings_count: number;
    last_updated: string;
  };
  errors: {
    last_5_errors: Array<{
      timestamp: Date;
      message: string;
    }>;
    cancellation_failures_last_hour: number;
    top_errors: Array<{
      error_type: string;
      count: number;
    }>;
    last_updated: string;
  };
  system: {
    cpu_usage: string;
    memory_usage: string;
    free_memory: string;
    total_memory: string;
    uptime: string;
    db_status: string;
    db_response_time: string;
    node_version: string;
    platform: string;
    last_updated: string;
  };
  timestamp: string;
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  timestamp: string;
}

export interface Activity {
  type: 'booking' | 'cancellation';
  reference: string;
  timestamp: Date;
  amount: string | null;
  details: string;
  status: 'success' | 'error';
}

export interface TrendData {
  hour: string;
  bookings: number;
  revenue: number;
  profit: number;
}

export interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  category: string;
}

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  private apiUrl = `${environment.baseUrl}monitoring`;
  
  // Auto-refresh metrics every 10 seconds
  public metrics$: Observable<Metrics>;
  
  constructor(private http: HttpClient) {
    // Create auto-refreshing observable
    this.metrics$ = interval(10000).pipe(
      startWith(0),
      switchMap(() => this.getMetrics()),
      shareReplay(1)
    );
  }

  /**
   * Get all current metrics
   */
  getMetrics(): Observable<Metrics> {
    return this.http.get<any>(`${this.apiUrl}/metrics`).pipe(
      switchMap(response => [response.metrics])
    );
  }

  /**
   * Get specific metric category
   */
  getMetricCategory(category: 'bookings' | 'api' | 'revenue' | 'errors' | 'system'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/metrics/${category}`).pipe(
      switchMap(response => [response.metrics])
    );
  }

  /**
   * Get system health status
   */
  getHealth(): Observable<HealthStatus> {
    return this.http.get<any>(`${this.apiUrl}/health`).pipe(
      switchMap(response => [response.health])
    );
  }

  /**
   * Get recent activity
   */
  getActivity(limit: number = 50): Observable<Activity[]> {
    return this.http.get<any>(`${this.apiUrl}/activity?limit=${limit}`).pipe(
      switchMap(response => [response.activity])
    );
  }

  /**
   * Get hourly trends for last 24 hours
   */
  getTrends(): Observable<TrendData[]> {
    return this.http.get<any>(`${this.apiUrl}/trends`).pipe(
      switchMap(response => [response.trends])
    );
  }

  /**
   * Get active alerts
   */
  getAlerts(): Observable<Alert[]> {
    return this.http.get<any>(`${this.apiUrl}/alerts`).pipe(
      switchMap(response => [response.alerts])
    );
  }

  /**
   * Format number with thousand separators
   */
  formatNumber(num: number): string {
    return num.toLocaleString('he-IL');
  }

  /**
   * Get status color
   */
  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'healthy': '#4caf50',
      'warning': '#ff9800',
      'critical': '#f44336',
      'success': '#4caf50',
      'error': '#f44336'
    };
    return colors[status] || '#757575';
  }

  /**
   * Get severity icon
   */
  getSeverityIcon(severity: string): string {
    const icons: { [key: string]: string } = {
      'critical': '🔴',
      'warning': '⚠️',
      'info': 'ℹ️',
      'healthy': '✅'
    };
    return icons[severity] || '•';
  }
}
