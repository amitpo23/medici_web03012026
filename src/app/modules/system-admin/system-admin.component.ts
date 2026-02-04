import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from 'src/app/environments/environment';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  checks: HealthCheck[];
}

interface HealthCheck {
  name: string;
  status: string;
  responseTime?: number;
  message?: string;
}

interface HealthMetrics {
  totalRequests: number;
  errorRate: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  uptime: number;
  requestsPerMinute: number;
  statusCodes: Record<string, number>;
}

interface LogFile {
  filename: string;
  size: number;
  modified: string;
}

interface LogSearchResult {
  lines: string[];
  total: number;
  filename: string;
}

interface LogStats {
  totalFiles: number;
  totalSize: number;
  levels: Record<string, number>;
}

interface OperationalMode {
  mode: string;
  changedAt?: string;
  changedBy?: string;
}

@Component({
  selector: 'app-system-admin',
  templateUrl: './system-admin.component.html',
  styleUrls: ['./system-admin.component.scss']
})
export class SystemAdminComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private autoRefreshDestroy$ = new Subject<void>();

  baseUrl = environment.baseUrl;

  // Health tab
  healthStatus: HealthStatus | null = null;
  healthMetrics: HealthMetrics | null = null;
  isLoadingHealth = false;
  isLoadingMetrics = false;
  autoRefreshEnabled = false;
  autoRefreshInterval = 30;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';

  // Logs tab
  logFiles: LogFile[] = [];
  selectedLogFile: string | null = null;
  logContent = '';
  isLoadingLogs = false;
  isLoadingLogContent = false;
  logSearchQuery = '';
  logSearchLevel = '';
  logSearchLimit = 100;
  tailMode = false;
  tailLines = 100;
  logStats: LogStats | null = null;
  isLoadingLogStats = false;
  logLevels: string[] = ['error', 'warn', 'info', 'debug'];

  // Mode tab
  currentMode: OperationalMode | null = null;
  isLoadingMode = false;
  isSwitchingMode = false;
  modes = [
    {
      value: 'READ_ONLY',
      label: 'Read Only',
      icon: 'visibility',
      color: 'warn',
      description: 'System is in read-only mode. No write operations or purchases are allowed. Use this for maintenance windows.'
    },
    {
      value: 'WRITE_ENABLED',
      label: 'Write Enabled',
      icon: 'edit',
      color: 'accent',
      description: 'Write operations are enabled but purchases are disabled. Use this for testing and data entry without financial transactions.'
    },
    {
      value: 'PURCHASE_ENABLED',
      label: 'Purchase Enabled',
      icon: 'shopping_cart',
      color: 'primary',
      description: 'Full operational mode. All operations including purchases are enabled. This is the standard production mode.'
    }
  ];

  // Tab
  selectedTabIndex = 0;

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadHealthStatus();
    this.loadHealthMetrics();
    this.loadOperationalMode();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.autoRefreshDestroy$.next();
    this.autoRefreshDestroy$.complete();
  }

  // --- Health Tab ---

  loadHealthStatus(): void {
    this.isLoadingHealth = true;
    this.http.get<HealthStatus>(this.baseUrl + 'health/deep')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.healthStatus = data;
          this.computeOverallStatus();
          this.isLoadingHealth = false;
        },
        error: (err) => {
          this.overallStatus = 'unhealthy';
          this.isLoadingHealth = false;
          this.showSnackbar('Failed to load health status', true);
        }
      });
  }

  loadHealthMetrics(): void {
    this.isLoadingMetrics = true;
    this.http.get<HealthMetrics>(this.baseUrl + 'health/metrics')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.healthMetrics = data;
          this.isLoadingMetrics = false;
        },
        error: (err) => {
          this.isLoadingMetrics = false;
          this.showSnackbar('Failed to load metrics', true);
        }
      });
  }

  resetMetrics(): void {
    this.http.post(this.baseUrl + 'health/metrics/reset', {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSnackbar('Metrics have been reset successfully');
          this.loadHealthMetrics();
        },
        error: () => {
          this.showSnackbar('Failed to reset metrics', true);
        }
      });
  }

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;

    if (this.autoRefreshEnabled) {
      this.autoRefreshDestroy$.next();
      interval(this.autoRefreshInterval * 1000)
        .pipe(takeUntil(this.autoRefreshDestroy$), takeUntil(this.destroy$))
        .subscribe(() => {
          this.loadHealthStatus();
          this.loadHealthMetrics();
        });
      this.showSnackbar('Auto-refresh enabled (' + this.autoRefreshInterval + 's)');
    } else {
      this.autoRefreshDestroy$.next();
      this.showSnackbar('Auto-refresh disabled');
    }
  }

  private computeOverallStatus(): void {
    if (!this.healthStatus) {
      this.overallStatus = 'unhealthy';
      return;
    }

    if (this.healthStatus.status === 'UP' || this.healthStatus.status === 'healthy') {
      const hasFailedCheck = this.healthStatus.checks?.some(
        (c) => c.status === 'DOWN' || c.status === 'unhealthy'
      );
      this.overallStatus = hasFailedCheck ? 'degraded' : 'healthy';
    } else {
      this.overallStatus = 'unhealthy';
    }
  }

  getStatusIcon(status: string): string {
    switch (status?.toUpperCase()) {
      case 'UP':
      case 'HEALTHY':
        return 'check_circle';
      case 'DEGRADED':
        return 'warning';
      default:
        return 'cancel';
    }
  }

  getStatusClass(status: string): string {
    switch (status?.toUpperCase()) {
      case 'UP':
      case 'HEALTHY':
        return 'status-healthy';
      case 'DEGRADED':
        return 'status-degraded';
      default:
        return 'status-unhealthy';
    }
  }

  formatUptime(seconds: number): string {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(days + 'd');
    if (hours > 0) parts.push(hours + 'h');
    parts.push(minutes + 'm');
    return parts.join(' ');
  }

  formatMs(ms: number): string {
    if (ms === undefined || ms === null) return 'N/A';
    return ms.toFixed(1) + ' ms';
  }

  formatPercent(val: number): string {
    if (val === undefined || val === null) return 'N/A';
    return (val * 100).toFixed(2) + '%';
  }

  // --- Logs Tab ---

  loadLogFiles(): void {
    this.isLoadingLogs = true;
    this.http.get<LogFile[]>(this.baseUrl + 'logs')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.logFiles = Array.isArray(data) ? data : [];
          this.isLoadingLogs = false;
        },
        error: () => {
          this.isLoadingLogs = false;
          this.showSnackbar('Failed to load log files', true);
        }
      });
  }

  loadLogStats(): void {
    this.isLoadingLogStats = true;
    this.http.get<LogStats>(this.baseUrl + 'logs/stats/summary')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.logStats = data;
          this.isLoadingLogStats = false;
        },
        error: () => {
          this.isLoadingLogStats = false;
        }
      });
  }

  selectLogFile(filename: string): void {
    this.selectedLogFile = filename;
    this.logContent = '';

    if (this.tailMode) {
      this.tailLogFile();
    } else {
      this.readLogFile();
    }
  }

  readLogFile(): void {
    if (!this.selectedLogFile) return;

    this.isLoadingLogContent = true;
    this.http.get(this.baseUrl + 'logs/' + encodeURIComponent(this.selectedLogFile), { responseType: 'text' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.logContent = data;
          this.isLoadingLogContent = false;
        },
        error: () => {
          this.isLoadingLogContent = false;
          this.showSnackbar('Failed to read log file', true);
        }
      });
  }

  tailLogFile(): void {
    if (!this.selectedLogFile) return;

    this.isLoadingLogContent = true;
    this.http.get(
      this.baseUrl + 'logs/tail/' + encodeURIComponent(this.selectedLogFile) + '?lines=' + this.tailLines,
      { responseType: 'text' }
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.logContent = data;
          this.isLoadingLogContent = false;
        },
        error: () => {
          this.isLoadingLogContent = false;
          this.showSnackbar('Failed to tail log file', true);
        }
      });
  }

  toggleTailMode(): void {
    this.tailMode = !this.tailMode;
    if (this.selectedLogFile) {
      if (this.tailMode) {
        this.tailLogFile();
      } else {
        this.readLogFile();
      }
    }
  }

  searchLogs(): void {
    if (!this.logSearchQuery.trim()) {
      this.showSnackbar('Please enter a search query');
      return;
    }

    this.isLoadingLogContent = true;
    const body: Record<string, string | number> = {
      query: this.logSearchQuery.trim(),
      limit: this.logSearchLimit
    };

    if (this.selectedLogFile) {
      body['filename'] = this.selectedLogFile;
    }
    if (this.logSearchLevel) {
      body['level'] = this.logSearchLevel;
    }

    this.http.post<LogSearchResult>(this.baseUrl + 'logs/search', body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          if (data && data.lines) {
            this.logContent = data.lines.join('\n');
            this.showSnackbar('Found ' + data.total + ' matching lines');
          } else {
            this.logContent = 'No results found.';
          }
          this.isLoadingLogContent = false;
        },
        error: () => {
          this.isLoadingLogContent = false;
          this.showSnackbar('Log search failed', true);
        }
      });
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return size.toFixed(1) + ' ' + units[unitIndex];
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    if (index === 1 && this.logFiles.length === 0) {
      this.loadLogFiles();
      this.loadLogStats();
    }
  }

  // --- Operational Mode Tab ---

  loadOperationalMode(): void {
    this.isLoadingMode = true;
    this.http.get<OperationalMode>(this.baseUrl + 'health/mode')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.currentMode = data;
          this.isLoadingMode = false;
        },
        error: () => {
          this.isLoadingMode = false;
          this.showSnackbar('Failed to load operational mode', true);
        }
      });
  }

  changeMode(newMode: string): void {
    if (this.currentMode && this.currentMode.mode === newMode) {
      this.showSnackbar('System is already in ' + newMode + ' mode');
      return;
    }

    const modeConfig = this.modes.find((m) => m.value === newMode);
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Change Operational Mode',
        message: 'Are you sure you want to switch to <strong>' + (modeConfig ? modeConfig.label : newMode) + '</strong> mode?<br><br>' + (modeConfig ? modeConfig.description : '')
      },
      width: '450px'
    });

    dialogRef.afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.setMode(newMode);
        }
      });
  }

  private setMode(mode: string): void {
    this.isSwitchingMode = true;
    this.http.post<OperationalMode>(this.baseUrl + 'health/mode', { mode })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.currentMode = data;
          this.isSwitchingMode = false;
          this.showSnackbar('Operational mode changed to ' + mode);
        },
        error: () => {
          this.isSwitchingMode = false;
          this.showSnackbar('Failed to change operational mode', true);
        }
      });
  }

  isModeActive(mode: string): boolean {
    return this.currentMode !== null && this.currentMode.mode === mode;
  }

  getModeIcon(mode: string): string {
    const config = this.modes.find((m) => m.value === mode);
    return config ? config.icon : 'help';
  }

  // --- Shared ---

  private showSnackbar(message: string, isError = false): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: isError ? ['error-snackbar'] : ['success-snackbar']
    });
  }

  refreshAll(): void {
    this.loadHealthStatus();
    this.loadHealthMetrics();
    this.loadOperationalMode();
  }
}
