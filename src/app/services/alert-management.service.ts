import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, Subject } from 'rxjs';
import { switchMap, startWith, shareReplay } from 'rxjs/operators';

export interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  category: string;
  metadata: any;
  count: number;
  createdAt: Date;
  lastSeen: Date;
  status: 'active' | 'resolved';
  acknowledged: boolean;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

export interface AlertStatistics {
  active_alerts: number;
  total_24h: number;
  critical_24h: number;
  warning_24h: number;
  by_category: { [key: string]: number };
  most_frequent: Array<{ type: string; count: number }>;
}

export interface AlertConfig {
  error_rate_threshold: number;
  slow_api_threshold: number;
  cancellation_spike_threshold: number;
  revenue_drop_threshold: number;
  db_error_threshold: number;
  cpu_threshold: number;
  memory_threshold: number;
}

export interface AlertSummary {
  active: {
    total: number;
    critical: number;
    warning: number;
    unacknowledged: number;
  };
  last_24h: {
    total: number;
    critical: number;
    warning: number;
  };
  top_categories: { [key: string]: number };
  most_frequent: Array<{ type: string; count: number }>;
}

@Injectable({
  providedIn: 'root'
})
export class AlertManagementService {
  private apiUrl = '/alert-management';
  
  // Auto-refresh active alerts every 30 seconds
  public activeAlerts$: Observable<Alert[]>;
  
  // Alert notifications subject
  public newAlert$ = new Subject<Alert>();
  
  constructor(private http: HttpClient) {
    // Create auto-refreshing observable for active alerts
    this.activeAlerts$ = interval(30000).pipe(
      startWith(0),
      switchMap(() => this.getActiveAlerts()),
      shareReplay(1)
    );
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Observable<Alert[]> {
    return this.http.get<any>(`${this.apiUrl}/active`).pipe(
      switchMap(response => [response.alerts])
    );
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Observable<Alert[]> {
    return this.http.get<any>(`${this.apiUrl}/history?limit=${limit}`).pipe(
      switchMap(response => [response.alerts])
    );
  }

  /**
   * Get alert statistics
   */
  getStatistics(): Observable<AlertStatistics> {
    return this.http.get<any>(`${this.apiUrl}/statistics`).pipe(
      switchMap(response => [response.statistics])
    );
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): Observable<Alert> {
    return this.http.post<any>(`${this.apiUrl}/acknowledge/${alertId}`, {}).pipe(
      switchMap(response => [response.alert])
    );
  }

  /**
   * Resolve an alert
   */
  resolveAlert(type: string): Observable<Alert> {
    return this.http.post<any>(`${this.apiUrl}/resolve/${type}`, {}).pipe(
      switchMap(response => [response.alert])
    );
  }

  /**
   * Get alert configuration
   */
  getConfig(): Observable<AlertConfig> {
    return this.http.get<any>(`${this.apiUrl}/config`).pipe(
      switchMap(response => [response.config])
    );
  }

  /**
   * Update alert configuration
   */
  updateConfig(config: Partial<AlertConfig>): Observable<AlertConfig> {
    return this.http.put<any>(`${this.apiUrl}/config`, config).pipe(
      switchMap(response => [response.config])
    );
  }

  /**
   * Create test alert
   */
  createTestAlert(type: string): Observable<Alert> {
    return this.http.post<any>(`${this.apiUrl}/test/${type}`, {}).pipe(
      switchMap(response => [response.alert])
    );
  }

  /**
   * Get alert summary
   */
  getSummary(): Observable<AlertSummary> {
    return this.http.get<any>(`${this.apiUrl}/summary`).pipe(
      switchMap(response => [response.summary])
    );
  }

  /**
   * Get severity color
   */
  getSeverityColor(severity: string): string {
    const colors: { [key: string]: string } = {
      'critical': '#f44336',
      'warning': '#ff9800',
      'info': '#2196f3'
    };
    return colors[severity] || '#757575';
  }

  /**
   * Get severity icon
   */
  getSeverityIcon(severity: string): string {
    const icons: { [key: string]: string } = {
      'critical': '🔴',
      'warning': '⚠️',
      'info': 'ℹ️'
    };
    return icons[severity] || '•';
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'system': '🖥️',
      'api': '🔌',
      'database': '💾',
      'cancellations': '❌',
      'revenue': '💰'
    };
    return icons[category] || '📊';
  }

  /**
   * Format alert type
   */
  formatAlertType(type: string): string {
    const types: { [key: string]: string } = {
      'error_rate': 'שיעור שגיאות',
      'slow_api': 'API איטי',
      'cancellation_spike': 'עלייה בכשלי ביטולים',
      'revenue_drop': 'ירידה בהכנסות',
      'db_error': 'שגיאת מסד נתונים',
      'db_slow': 'מסד נתונים איטי'
    };
    return types[type] || type;
  }
}
