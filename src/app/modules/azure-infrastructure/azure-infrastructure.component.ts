import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ChartConfiguration } from 'chart.js';
import {
  AzureInfrastructureService,
  AppServiceOverview,
  AppServiceConfig,
  AppSetting,
  SqlOverview,
  SqlServer,
  FirewallRule,
  MonitorMetrics,
  ResourceHealth,
  AdvisorData,
  ArchitectureDiagram,
  SecurityFinding
} from 'src/app/services/azure-infrastructure.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-azure-infrastructure',
  templateUrl: './azure-infrastructure.component.html',
  styleUrls: ['./azure-infrastructure.component.scss']
})
export class AzureInfrastructureComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private autoRefreshDestroy$ = new Subject<void>();

  selectedTabIndex = 0;

  // App Service tab
  appServiceOverview: AppServiceOverview | null = null;
  appServiceConfig: AppServiceConfig | null = null;
  appSettings: AppSetting[] = [];
  isLoadingAppService = false;

  // SQL tab
  sqlOverview: SqlOverview | null = null;
  sqlServer: SqlServer | null = null;
  firewallRules: FirewallRule[] = [];
  isLoadingSql = false;
  newFirewallRule = { name: '', startIpAddress: '', endIpAddress: '' };
  showAddFirewallForm = false;

  // Monitor tab
  monitorMetrics: MonitorMetrics | null = null;
  isLoadingMetrics = false;
  autoRefreshEnabled = false;
  selectedTimeRange = 'PT1H';
  timeRangeOptions = [
    { value: 'PT1H', label: '1 Hour' },
    { value: 'PT6H', label: '6 Hours' },
    { value: 'PT24H', label: '24 Hours' },
    { value: 'P7D', label: '7 Days' }
  ];

  // Chart configurations
  requestsChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  responseTimeChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  cpuChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  memoryChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  errorsChartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { maxTicksLimit: 8, font: { size: 10 } },
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        ticks: { font: { size: 10 } }
      }
    },
    plugins: {
      legend: { display: false }
    },
    elements: {
      point: { radius: 1 },
      line: { tension: 0.3, borderWidth: 2 }
    }
  };

  // Health tab
  healthStatuses: ResourceHealth[] = [];
  isLoadingHealth = false;

  // Advisor tab
  advisorData: AdvisorData | null = null;
  isLoadingAdvisor = false;
  advisorCategories = ['Security', 'HighAvailability', 'Cost', 'Performance', 'OperationalExcellence'];

  // Architecture tab
  architectureDiagram: ArchitectureDiagram | null = null;
  isLoadingArchitecture = false;

  constructor(
    private azureService: AzureInfrastructureService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadAppService();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.autoRefreshDestroy$.next();
    this.autoRefreshDestroy$.complete();
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    switch (index) {
      case 0: if (!this.appServiceOverview) { this.loadAppService(); } break;
      case 1: if (!this.sqlOverview) { this.loadSql(); } break;
      case 2: if (!this.monitorMetrics) { this.loadMetrics(); } break;
      case 3: if (this.healthStatuses.length === 0) { this.loadHealth(); } break;
      case 4: if (!this.advisorData) { this.loadAdvisor(); } break;
      case 5: if (!this.architectureDiagram) { this.loadArchitecture(); } break;
    }
  }

  refreshAll(): void {
    this.azureService.clearCache().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        switch (this.selectedTabIndex) {
          case 0: this.loadAppService(); break;
          case 1: this.loadSql(); break;
          case 2: this.loadMetrics(); break;
          case 3: this.loadHealth(); break;
          case 4: this.loadAdvisor(); break;
          case 5: this.loadArchitecture(); break;
        }
        this.showSnackbar('Cache cleared and data refreshed');
      },
      error: () => this.showSnackbar('Failed to clear cache', true)
    });
  }

  // ============ APP SERVICE ============

  loadAppService(): void {
    this.isLoadingAppService = true;
    this.azureService.getAppServiceOverview().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { if (res.success) { this.appServiceOverview = res.data; } },
      error: (err) => this.showSnackbar('Failed to load App Service overview', true)
    });
    this.azureService.getAppServiceConfig().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { if (res.success) { this.appServiceConfig = res.data; } this.isLoadingAppService = false; },
      error: (err) => { this.isLoadingAppService = false; this.showSnackbar('Failed to load App Service config', true); }
    });
    this.azureService.getAppServiceSettings().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { if (res.success) { this.appSettings = res.data; } },
      error: () => {}
    });
  }

  // ============ SQL DATABASE ============

  loadSql(): void {
    this.isLoadingSql = true;
    this.azureService.getSqlOverview().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { if (res.success) { this.sqlOverview = res.data; } },
      error: () => this.showSnackbar('Failed to load SQL overview', true)
    });
    this.azureService.getSqlServer().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { if (res.success) { this.sqlServer = res.data; } },
      error: () => {}
    });
    this.azureService.getFirewallRules().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { if (res.success) { this.firewallRules = res.data; } this.isLoadingSql = false; },
      error: () => { this.isLoadingSql = false; }
    });
  }

  addFirewallRule(): void {
    const { name, startIpAddress, endIpAddress } = this.newFirewallRule;
    if (!name || !startIpAddress || !endIpAddress) {
      this.showSnackbar('All fields are required', true);
      return;
    }
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Add Firewall Rule', message: `Add firewall rule "${name}" (${startIpAddress} - ${endIpAddress})?` }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.azureService.addFirewallRule(name, startIpAddress, endIpAddress)
          .pipe(takeUntil(this.destroy$)).subscribe({
            next: () => {
              this.showSnackbar('Firewall rule added');
              this.newFirewallRule = { name: '', startIpAddress: '', endIpAddress: '' };
              this.showAddFirewallForm = false;
              this.firewallRules = [];
              this.loadSql();
            },
            error: () => this.showSnackbar('Failed to add firewall rule', true)
          });
      }
    });
  }

  deleteFirewallRule(rule: FirewallRule): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete Firewall Rule', message: `Delete firewall rule "${rule.name}"?` }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.azureService.deleteFirewallRule(rule.name)
          .pipe(takeUntil(this.destroy$)).subscribe({
            next: () => {
              this.showSnackbar('Firewall rule deleted');
              this.firewallRules = [];
              this.loadSql();
            },
            error: () => this.showSnackbar('Failed to delete firewall rule', true)
          });
      }
    });
  }

  // ============ MONITOR ============

  loadMetrics(): void {
    this.isLoadingMetrics = true;
    const intervalMap: Record<string, string> = {
      'PT1H': 'PT1M',
      'PT6H': 'PT5M',
      'PT24H': 'PT15M',
      'P7D': 'PT1H'
    };
    this.azureService.getMetrics(this.selectedTimeRange, intervalMap[this.selectedTimeRange] || 'PT5M')
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          if (res.success) {
            this.monitorMetrics = res.data;
            this.buildCharts();
          }
          this.isLoadingMetrics = false;
        },
        error: () => { this.isLoadingMetrics = false; this.showSnackbar('Failed to load metrics', true); }
      });
  }

  onTimeRangeChange(): void {
    this.monitorMetrics = null;
    this.loadMetrics();
  }

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    if (this.autoRefreshEnabled) {
      this.azureService.getMetricsAutoRefresh(30000)
        .pipe(takeUntil(this.autoRefreshDestroy$)).subscribe({
          next: (res) => {
            if (res.success) {
              this.monitorMetrics = res.data;
              this.buildCharts();
            }
          }
        });
    } else {
      this.autoRefreshDestroy$.next();
    }
  }

  private buildCharts(): void {
    if (!this.monitorMetrics) { return; }

    this.requestsChartData = this.buildChartData(
      this.monitorMetrics.Requests, 'total', 'Requests', '#3b82f6'
    );
    this.responseTimeChartData = this.buildChartData(
      this.monitorMetrics.AverageResponseTime, 'average', 'Avg Response Time (s)', '#f59e0b'
    );
    this.cpuChartData = this.buildChartData(
      this.monitorMetrics.CpuTime, 'total', 'CPU Time (s)', '#ef4444'
    );
    this.memoryChartData = this.buildChartData(
      this.monitorMetrics.MemoryWorkingSet, 'average', 'Memory (MB)', '#8b5cf6',
      (v: number) => v / (1024 * 1024)
    );
    this.errorsChartData = this.buildChartData(
      this.monitorMetrics.Http5xx, 'total', '5xx Errors', '#ef4444'
    );
  }

  private buildChartData(
    data: { timestamp: string; total: number; average: number }[],
    field: 'total' | 'average',
    label: string,
    color: string,
    transform?: (v: number) => number
  ): ChartConfiguration<'line'>['data'] {
    if (!data || data.length === 0) {
      return { labels: [], datasets: [{ data: [], label, borderColor: color, backgroundColor: color + '20' }] };
    }
    const labels = data.map(d => {
      const date = new Date(d.timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    const values = data.map(d => {
      const val = d[field] || 0;
      return transform ? transform(val) : val;
    });
    return {
      labels,
      datasets: [{
        data: values,
        label,
        borderColor: color,
        backgroundColor: color + '20',
        fill: true
      }]
    };
  }

  // ============ HEALTH ============

  loadHealth(): void {
    this.isLoadingHealth = true;
    this.azureService.getHealthStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { if (res.success) { this.healthStatuses = res.data; } this.isLoadingHealth = false; },
      error: () => { this.isLoadingHealth = false; this.showSnackbar('Failed to load health status', true); }
    });
  }

  getHealthColor(state: string): string {
    switch (state) {
      case 'Available': return 'healthy';
      case 'Degraded': return 'degraded';
      case 'Unavailable': return 'unhealthy';
      default: return 'unknown';
    }
  }

  getHealthIcon(state: string): string {
    switch (state) {
      case 'Available': return 'check_circle';
      case 'Degraded': return 'warning';
      case 'Unavailable': return 'error';
      default: return 'help';
    }
  }

  // ============ ADVISOR ============

  loadAdvisor(): void {
    this.isLoadingAdvisor = true;
    this.azureService.getAdvisorRecommendations().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { if (res.success) { this.advisorData = res.data; } this.isLoadingAdvisor = false; },
      error: () => { this.isLoadingAdvisor = false; this.showSnackbar('Failed to load advisor', true); }
    });
  }

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      Security: 'security',
      HighAvailability: 'backup',
      Cost: 'savings',
      Performance: 'speed',
      OperationalExcellence: 'engineering'
    };
    return icons[category] || 'info';
  }

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      Security: 'Security',
      HighAvailability: 'High Availability',
      Cost: 'Cost Optimization',
      Performance: 'Performance',
      OperationalExcellence: 'Operational Excellence'
    };
    return labels[category] || category;
  }

  getRecommendations(category: string): { id: string; category: string; impact: string; impactedValue: string; problem: string; solution: string }[] {
    if (!this.advisorData) { return []; }
    return (this.advisorData.grouped as Record<string, typeof this.advisorData.grouped.Security>)[category] || [];
  }

  getCategoryCount(category: string): number {
    if (!this.advisorData) { return 0; }
    return this.advisorData.summary[category] || 0;
  }

  getImpactClass(impact: string): string {
    switch (impact) {
      case 'High': return 'impact-high';
      case 'Medium': return 'impact-medium';
      case 'Low': return 'impact-low';
      default: return '';
    }
  }

  // ============ ARCHITECTURE ============

  loadArchitecture(): void {
    this.isLoadingArchitecture = true;
    this.azureService.getArchitectureDiagram().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => { if (res.success) { this.architectureDiagram = res.data; } this.isLoadingArchitecture = false; },
      error: () => { this.isLoadingArchitecture = false; this.showSnackbar('Failed to load architecture', true); }
    });
  }

  // ============ UTILITIES ============

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'HIGH': return 'severity-high';
      case 'MEDIUM': return 'severity-medium';
      case 'LOW': return 'severity-low';
      default: return '';
    }
  }

  formatBytes(bytes: number): string {
    if (!bytes) { return '0 B'; }
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private showSnackbar(message: string, isError = false): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: isError ? 'snackbar-error' : 'snackbar-success',
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}
