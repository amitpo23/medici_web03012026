import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  LogsDiagnosticsService,
  LogFileEntry,
  LogLineEntry,
  LogSearchResultEntry,
  LogStatsData,
  ChartsData,
  TimeSeriesPoint,
  CancellationSummary,
  TopCancellationError,
  Recommendation,
  CancellationErrorDetail,
  WorkerHealthResponse,
  WorkerStatus,
  DatabaseHealthResponse,
  InventoryOverall,
  InventoryByHotel,
  InventoryAlert
} from 'src/app/services/logs-diagnostics.service';

@Component({
  selector: 'app-logs-diagnostics',
  templateUrl: './logs-diagnostics.component.html',
  styleUrls: ['./logs-diagnostics.component.scss']
})
export class LogsDiagnosticsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private autoRefreshDestroy$ = new Subject<void>();

  selectedTabIndex = 0;
  autoRefreshEnabled = false;
  autoRefreshInterval = 30;

  // ==========================================
  // Tab 1: Log Files
  // ==========================================
  logFiles: LogFileEntry[] = [];
  isLoadingLogFiles = false;
  selectedLogFile: string | null = null;
  logLines: LogLineEntry[] = [];
  isLoadingLogContent = false;
  tailMode = false;
  tailLines = 50;
  logViewLines = 100;
  logFileSearch = '';

  // ==========================================
  // Tab 2: Log Search
  // ==========================================
  searchQuery = '';
  searchLevel = '';
  searchDateFrom = '';
  searchDateTo = '';
  searchHotelName = '';
  searchBookingId = '';
  searchSource = '';
  searchLimit = 100;
  searchResults: LogSearchResultEntry[] = [];
  searchResultCount = 0;
  isSearching = false;
  logLevels: string[] = ['error', 'warn', 'info', 'debug', 'http'];

  // ==========================================
  // Tab 3: Log Stats & Charts
  // ==========================================
  logStats: LogStatsData | null = null;
  isLoadingStats = false;
  chartsData: ChartsData | null = null;
  isLoadingCharts = false;
  chartHours = 24;

  // ==========================================
  // Tab 4: Cancellation Diagnostics
  // ==========================================
  cancellationSummary: CancellationSummary | null = null;
  topCancellationErrors: TopCancellationError[] = [];
  recommendations: Recommendation[] = [];
  isLoadingCancellations = false;
  cancellationErrorDetails: CancellationErrorDetail[] = [];
  isLoadingCancellationDetails = false;
  cancellationDetailsLimit = 50;
  cancellationErrorFilter = '';
  showCancellationDetails = false;

  // ==========================================
  // Tab 5: Worker Health
  // ==========================================
  workerHealth: WorkerHealthResponse | null = null;
  isLoadingWorkerHealth = false;

  // ==========================================
  // Tab 6: System Health
  // ==========================================
  databaseHealth: DatabaseHealthResponse | null = null;
  isLoadingDatabaseHealth = false;
  inventoryOverall: InventoryOverall | null = null;
  inventoryByHotel: InventoryByHotel[] = [];
  inventoryAlerts: InventoryAlert[] = [];
  isLoadingInventory = false;

  // Table columns
  cancellationDetailsColumns: string[] = ['Id', 'DateInsert', 'PreBookId', 'contentBookingID', 'Error'];
  inventoryHotelColumns: string[] = ['HotelName', 'ActiveRooms', 'TotalValue', 'PotentialProfit'];

  constructor(
    private logsDiagnosticsService: LogsDiagnosticsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadLogFiles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.autoRefreshDestroy$.next();
    this.autoRefreshDestroy$.complete();
  }

  // ==========================================
  // Tab Navigation
  // ==========================================

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    switch (index) {
      case 0:
        if (this.logFiles.length === 0) {
          this.loadLogFiles();
        }
        break;
      case 1:
        // Log Search - no auto-load
        break;
      case 2:
        if (!this.logStats) {
          this.loadLogStats();
        }
        if (!this.chartsData) {
          this.loadCharts();
        }
        break;
      case 3:
        if (!this.cancellationSummary) {
          this.loadCancellationErrors();
        }
        break;
      case 4:
        if (!this.workerHealth) {
          this.loadWorkerHealth();
        }
        break;
      case 5:
        if (!this.databaseHealth) {
          this.loadDatabaseHealth();
        }
        if (!this.inventoryOverall) {
          this.loadInventoryAnalysis();
        }
        break;
      default:
        break;
    }
  }

  // ==========================================
  // Auto-Refresh
  // ==========================================

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    if (this.autoRefreshEnabled) {
      this.autoRefreshDestroy$.next();
      interval(this.autoRefreshInterval * 1000)
        .pipe(takeUntil(this.autoRefreshDestroy$), takeUntil(this.destroy$))
        .subscribe(() => {
          this.refreshCurrentTab();
        });
      this.showSnackbar('Auto-refresh enabled (' + this.autoRefreshInterval + 's)');
    } else {
      this.autoRefreshDestroy$.next();
      this.showSnackbar('Auto-refresh disabled');
    }
  }

  refreshCurrentTab(): void {
    switch (this.selectedTabIndex) {
      case 0:
        this.loadLogFiles();
        break;
      case 2:
        this.loadLogStats();
        this.loadCharts();
        break;
      case 3:
        this.loadCancellationErrors();
        break;
      case 4:
        this.loadWorkerHealth();
        break;
      case 5:
        this.loadDatabaseHealth();
        this.loadInventoryAnalysis();
        break;
      default:
        break;
    }
  }

  refreshAll(): void {
    this.loadLogFiles();
    this.loadLogStats();
    this.loadCharts();
    this.loadCancellationErrors();
    this.loadWorkerHealth();
    this.loadDatabaseHealth();
    this.loadInventoryAnalysis();
  }

  // ==========================================
  // Tab 1: Log Files
  // ==========================================

  loadLogFiles(): void {
    this.isLoadingLogFiles = true;
    this.logsDiagnosticsService.getLogFiles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.logFiles = Array.isArray(data.files) ? data.files : [];
          this.isLoadingLogFiles = false;
        },
        error: () => {
          this.isLoadingLogFiles = false;
          this.showSnackbar('Failed to load log files', true);
        }
      });
  }

  selectLogFile(filename: string): void {
    this.selectedLogFile = filename;
    this.logLines = [];
    if (this.tailMode) {
      this.tailSelectedFile();
    } else {
      this.viewSelectedFile();
    }
  }

  viewSelectedFile(): void {
    if (!this.selectedLogFile) return;
    this.isLoadingLogContent = true;
    this.logsDiagnosticsService.viewLogFile(
      this.selectedLogFile,
      this.logViewLines,
      this.logFileSearch || undefined
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.logLines = Array.isArray(data.lines) ? data.lines : [];
          this.isLoadingLogContent = false;
          if (this.logFileSearch) {
            this.showSnackbar('Found ' + data.filteredLines + ' matching lines');
          }
        },
        error: () => {
          this.isLoadingLogContent = false;
          this.showSnackbar('Failed to read log file', true);
        }
      });
  }

  tailSelectedFile(): void {
    if (!this.selectedLogFile) return;
    this.isLoadingLogContent = true;
    this.logsDiagnosticsService.tailLogFile(this.selectedLogFile, this.tailLines)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.logLines = Array.isArray(data.lines) ? data.lines : [];
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
        this.tailSelectedFile();
      } else {
        this.viewSelectedFile();
      }
    }
  }

  searchWithinFile(): void {
    if (this.selectedLogFile) {
      this.viewSelectedFile();
    }
  }

  deleteLogFile(filename: string, event: Event): void {
    event.stopPropagation();
    if (!confirm('Are you sure you want to delete ' + filename + '?')) {
      return;
    }
    this.logsDiagnosticsService.deleteLogFile(filename)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.showSnackbar(data.message || 'Log file deleted');
          this.loadLogFiles();
          if (this.selectedLogFile === filename) {
            this.selectedLogFile = null;
            this.logLines = [];
          }
        },
        error: (err) => {
          this.showSnackbar(err.error?.error || 'Failed to delete log file', true);
        }
      });
  }

  // ==========================================
  // Tab 2: Log Search
  // ==========================================

  executeSearch(): void {
    if (!this.searchQuery.trim() && !this.searchLevel && !this.searchHotelName && !this.searchBookingId) {
      this.showSnackbar('Please enter at least one search criterion');
      return;
    }

    this.isSearching = true;
    this.logsDiagnosticsService.searchLogs({
      query: this.searchQuery.trim() || undefined,
      level: this.searchLevel || undefined,
      startDate: this.searchDateFrom || undefined,
      endDate: this.searchDateTo || undefined,
      hotelName: this.searchHotelName.trim() || undefined,
      bookingId: this.searchBookingId.trim() || undefined,
      source: this.searchSource.trim() || undefined,
      limit: this.searchLimit
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.searchResults = Array.isArray(data.results) ? data.results : [];
          this.searchResultCount = data.count || 0;
          this.isSearching = false;
          this.showSnackbar('Found ' + this.searchResultCount + ' results');
        },
        error: () => {
          this.isSearching = false;
          this.showSnackbar('Log search failed', true);
        }
      });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchLevel = '';
    this.searchDateFrom = '';
    this.searchDateTo = '';
    this.searchHotelName = '';
    this.searchBookingId = '';
    this.searchSource = '';
    this.searchResults = [];
    this.searchResultCount = 0;
  }

  // ==========================================
  // Tab 3: Log Stats & Charts
  // ==========================================

  loadLogStats(): void {
    this.isLoadingStats = true;
    this.logsDiagnosticsService.getLogStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.logStats = data.stats;
          this.isLoadingStats = false;
        },
        error: () => {
          this.isLoadingStats = false;
          this.showSnackbar('Failed to load log statistics', true);
        }
      });
  }

  loadCharts(): void {
    this.isLoadingCharts = true;
    this.logsDiagnosticsService.getLogCharts(this.chartHours)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.chartsData = data.charts;
          this.isLoadingCharts = false;
        },
        error: () => {
          this.isLoadingCharts = false;
          this.showSnackbar('Failed to load chart data', true);
        }
      });
  }

  getStatTypeKeys(): string[] {
    if (!this.logStats?.byType) return [];
    return Object.keys(this.logStats.byType);
  }

  getDistributionKeys(obj: Record<string, number> | undefined): string[] {
    if (!obj) return [];
    return Object.keys(obj);
  }

  getDistributionTotal(obj: Record<string, number> | undefined): number {
    if (!obj) return 0;
    return Object.values(obj).reduce((sum, val) => sum + val, 0);
  }

  getDistributionPercent(obj: Record<string, number> | undefined, key: string): number {
    if (!obj) return 0;
    const total = this.getDistributionTotal(obj);
    if (total === 0) return 0;
    return Math.round((obj[key] / total) * 100);
  }

  getMaxTimeSeries(): number {
    if (!this.chartsData?.timeSeries) return 1;
    const max = Math.max(...this.chartsData.timeSeries.map(p => p.requests));
    return max > 0 ? max : 1;
  }

  // ==========================================
  // Tab 4: Cancellation Diagnostics
  // ==========================================

  loadCancellationErrors(): void {
    this.isLoadingCancellations = true;
    this.logsDiagnosticsService.getCancellationErrors()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.cancellationSummary = data.summary;
          this.topCancellationErrors = Array.isArray(data.topErrors) ? data.topErrors : [];
          this.recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
          this.isLoadingCancellations = false;
        },
        error: () => {
          this.isLoadingCancellations = false;
          this.showSnackbar('Failed to load cancellation diagnostics', true);
        }
      });
  }

  loadCancellationDetails(errorMessage?: string): void {
    this.isLoadingCancellationDetails = true;
    this.showCancellationDetails = true;
    this.logsDiagnosticsService.getCancellationErrorDetails(
      this.cancellationDetailsLimit,
      errorMessage || this.cancellationErrorFilter || undefined
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.cancellationErrorDetails = Array.isArray(data.errors) ? data.errors : [];
          this.isLoadingCancellationDetails = false;
        },
        error: () => {
          this.isLoadingCancellationDetails = false;
          this.showSnackbar('Failed to load cancellation error details', true);
        }
      });
  }

  drillIntoCancellationError(errorMessage: string): void {
    this.cancellationErrorFilter = errorMessage;
    this.loadCancellationDetails(errorMessage);
  }

  // ==========================================
  // Tab 5: Worker Health
  // ==========================================

  loadWorkerHealth(): void {
    this.isLoadingWorkerHealth = true;
    this.logsDiagnosticsService.getWorkerHealth()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.workerHealth = data;
          this.isLoadingWorkerHealth = false;
        },
        error: () => {
          this.isLoadingWorkerHealth = false;
          this.showSnackbar('Failed to load worker health', true);
        }
      });
  }

  getWorkerNames(): string[] {
    if (!this.workerHealth?.workers) return [];
    return Object.keys(this.workerHealth.workers);
  }

  getWorkerData(name: string): WorkerStatus | null {
    if (!this.workerHealth?.workers) return null;
    return (this.workerHealth.workers as Record<string, WorkerStatus>)[name] || null;
  }

  getWorkerDisplayName(key: string): string {
    const names: Record<string, string> = {
      buyRoomWorker: 'Buy Room Worker',
      priceUpdateWorker: 'Price Update Worker',
      autoCancelWorker: 'Auto Cancel Worker'
    };
    return names[key] || key;
  }

  getWorkerIcon(key: string): string {
    const icons: Record<string, string> = {
      buyRoomWorker: 'shopping_cart',
      priceUpdateWorker: 'price_change',
      autoCancelWorker: 'cancel_schedule_send'
    };
    return icons[key] || 'work';
  }

  // ==========================================
  // Tab 6: System Health
  // ==========================================

  loadDatabaseHealth(): void {
    this.isLoadingDatabaseHealth = true;
    this.logsDiagnosticsService.getDatabaseHealth()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.databaseHealth = data;
          this.isLoadingDatabaseHealth = false;
        },
        error: () => {
          this.isLoadingDatabaseHealth = false;
          this.showSnackbar('Failed to load database health', true);
        }
      });
  }

  loadInventoryAnalysis(): void {
    this.isLoadingInventory = true;
    this.logsDiagnosticsService.getInventoryAnalysis()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.inventoryOverall = data.overall;
          this.inventoryByHotel = Array.isArray(data.byHotel) ? data.byHotel : [];
          this.inventoryAlerts = Array.isArray(data.alerts) ? data.alerts : [];
          this.isLoadingInventory = false;
        },
        error: () => {
          this.isLoadingInventory = false;
          this.showSnackbar('Failed to load inventory analysis', true);
        }
      });
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'up':
        return 'status-healthy';
      case 'warning':
      case 'degraded':
        return 'status-warning';
      case 'critical':
      case 'unhealthy':
      case 'down':
        return 'status-critical';
      default:
        return 'status-unknown';
    }
  }

  getStatusIcon(status: string): string {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'up':
        return 'check_circle';
      case 'warning':
      case 'degraded':
        return 'warning';
      case 'critical':
      case 'unhealthy':
      case 'down':
        return 'cancel';
      default:
        return 'help_outline';
    }
  }

  getLevelClass(level: string): string {
    switch (level?.toLowerCase()) {
      case 'error':
        return 'level-error';
      case 'warn':
      case 'warning':
        return 'level-warn';
      case 'info':
        return 'level-info';
      case 'debug':
        return 'level-debug';
      case 'http':
        return 'level-http';
      default:
        return 'level-default';
    }
  }

  getSeverityClass(severity: string): string {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'severity-critical';
      case 'medium':
      case 'warning':
        return 'severity-warning';
      case 'low':
      case 'info':
        return 'severity-info';
      default:
        return 'severity-info';
    }
  }

  getAlertSeverityClass(severity: string): string {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'alert-critical';
      case 'warning':
        return 'alert-warning';
      case 'info':
        return 'alert-info';
      default:
        return 'alert-info';
    }
  }

  formatLogLine(line: LogLineEntry): string {
    if (line.raw) return line.raw;
    const parts: string[] = [];
    if (line.timestamp) parts.push('[' + line.timestamp + ']');
    if (line.level) parts.push(line.level.toUpperCase());
    if (line.message) parts.push(line.message);
    if (line.method && line.url) parts.push(line.method + ' ' + line.url);
    if (line.status) parts.push('Status: ' + line.status);
    if (line.responseTime) parts.push(line.responseTime);
    return parts.join(' | ');
  }

  formatFileSize(sizeStr: string): string {
    return sizeStr || '0 KB';
  }

  formatCurrency(value: number): string {
    if (value === undefined || value === null) return '$0';
    return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  formatResponseTime(ms: number): string {
    if (ms === undefined || ms === null || ms < 0) return 'N/A';
    return ms + ' ms';
  }

  getBarWidth(point: TimeSeriesPoint): number {
    const max = this.getMaxTimeSeries();
    return Math.round((point.requests / max) * 100);
  }

  formatHour(hourStr: string): string {
    if (!hourStr) return '';
    // hourStr format: "2024-01-15T14" -> "14:00"
    const parts = hourStr.split('T');
    if (parts.length > 1) {
      return parts[1] + ':00';
    }
    return hourStr;
  }

  private showSnackbar(message: string, isError = false): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: isError ? ['error-snackbar'] : ['success-snackbar']
    });
  }
}
