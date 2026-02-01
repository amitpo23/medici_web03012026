import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface AlertStatus {
  running: boolean;
  lastScan: string | null;
  intervalMinutes: number;
}

interface AlertRule {
  id: string;
  name: string;
  severity: string;
  enabled: boolean;
  description: string;
}

interface AlertHistoryItem {
  id: string;
  alertId: string;
  type: string;
  message: string;
  priority: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  lastScan: string | null;
}

@Component({
  selector: 'app-alerts',
  templateUrl: './alerts.component.html',
  styleUrls: ['./alerts.component.scss']
})
export class AlertsComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();
  private baseUrl = environment.baseUrl;

  // Snackbar config
  horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  verticalPosition: MatSnackBarVerticalPosition = 'bottom';
  durationInSeconds = 5;

  // State
  isLoading = false;
  autoRefresh = false;
  scanDays = 7;

  // Data
  alertStatus: AlertStatus | null = null;
  alertRules: AlertRule[] = [];
  alertHistory: AlertHistoryItem[] = [];
  alertStats: AlertStats | null = null;

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAllData(): void {
    this.isLoading = true;
    this.loadStatus();
    this.loadRules();
    this.loadHistory();
    this.loadStats();
  }

  loadStatus(): void {
    this.http.get<AlertStatus>(this.baseUrl + 'alerts/status')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.alertStatus = data;
        },
        error: (err) => {
          this.showError('Failed to load alert status: ' + (err.error?.message || err.message));
        }
      });
  }

  loadRules(): void {
    this.http.get<AlertRule[]>(this.baseUrl + 'alerts/rules')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.alertRules = Array.isArray(data) ? data : [];
        },
        error: (err) => {
          this.showError('Failed to load alert rules: ' + (err.error?.message || err.message));
        }
      });
  }

  loadHistory(): void {
    this.http.get<AlertHistoryItem[]>(this.baseUrl + 'alerts/history')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.alertHistory = Array.isArray(data) ? data : [];
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.showError('Failed to load alert history: ' + (err.error?.message || err.message));
        }
      });
  }

  loadStats(): void {
    this.http.get<AlertStats>(this.baseUrl + 'alerts/stats')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.alertStats = data;
        },
        error: (err) => {
          this.showError('Failed to load alert stats: ' + (err.error?.message || err.message));
        }
      });
  }

  scanNow(): void {
    this.isLoading = true;
    this.http.post(this.baseUrl + 'alerts/scan', {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccess('Alert scan triggered successfully');
          this.loadAllData();
        },
        error: (err) => {
          this.isLoading = false;
          this.showError('Failed to trigger scan: ' + (err.error?.message || err.message));
        }
      });
  }

  scanRange(): void {
    this.isLoading = true;
    this.http.post(this.baseUrl + 'alerts/scan-range?days=' + this.scanDays, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccess('Range scan (' + this.scanDays + ' days) triggered successfully');
          this.loadAllData();
        },
        error: (err) => {
          this.isLoading = false;
          this.showError('Failed to trigger range scan: ' + (err.error?.message || err.message));
        }
      });
  }

  startService(): void {
    this.isLoading = true;
    this.http.post(this.baseUrl + 'alerts/start', {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccess('Alert service started successfully');
          this.loadStatus();
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.showError('Failed to start alert service: ' + (err.error?.message || err.message));
        }
      });
  }

  stopService(): void {
    this.isLoading = true;
    this.http.post(this.baseUrl + 'alerts/stop', {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccess('Alert service stopped');
          this.loadStatus();
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          this.showError('Failed to stop alert service: ' + (err.error?.message || err.message));
        }
      });
  }

  resolveAlert(alertId: string): void {
    this.http.post(this.baseUrl + 'alerts/' + alertId + '/resolve', {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccess('Alert resolved successfully');
          this.loadHistory();
          this.loadStats();
        },
        error: (err) => {
          this.showError('Failed to resolve alert: ' + (err.error?.message || err.message));
        }
      });
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      interval(30000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          if (this.autoRefresh) {
            this.loadAllData();
          }
        });
      this.showSuccess('Auto-refresh enabled (every 30s)');
    } else {
      this.showSuccess('Auto-refresh disabled');
    }
  }

  getSeverityClass(severity: string): string {
    switch (severity?.toLowerCase()) {
      case 'error':
      case 'critical':
        return 'severity-error';
      case 'warning':
        return 'severity-warning';
      case 'info':
        return 'severity-info';
      default:
        return 'severity-info';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
      default:
        return 'priority-low';
    }
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      horizontalPosition: this.horizontalPosition,
      verticalPosition: this.verticalPosition,
      duration: this.durationInSeconds * 1000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      horizontalPosition: this.horizontalPosition,
      verticalPosition: this.verticalPosition,
      duration: this.durationInSeconds * 1000,
      panelClass: ['error-snackbar']
    });
  }
}
