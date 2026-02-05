import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, registerables } from 'chart.js';
import {
    LogEntry, LogFile, LogSearchParams, LogsService, LogStats, ChartData as LogChartData
} from '../../services/logs.service';

// Register all chart.js components
Chart.register(...registerables);

@Component({
  selector: 'app-logs-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './logs-viewer.component.html',
  styleUrls: ['./logs-viewer.component.scss']
})
export class LogsViewerComponent implements OnInit, OnDestroy {
  // Log files
  logFiles: LogFile[] = [];
  selectedFile: string = '';
  filesLoading = false;
  filesError: string | null = null;

  // Log entries
  logEntries: LogEntry[] = [];
  logsLoading = false;
  logsError: string | null = null;
  
  // Search & Filter
  searchQuery = '';
  selectedLevel: '' | 'info' | 'warn' | 'error' = '';
  selectedMethod: '' | 'GET' | 'POST' | 'PUT' | 'DELETE' = '';
  selectedStatus: '' | '2xx' | '3xx' | '4xx' | '5xx' = '';
  startDate = '';
  endDate = '';
  maxLines = 100;

  // Stats
  stats: LogStats | null = null;
  statsLoading = false;

  // UI State
  activeTab: 'viewer' | 'search' | 'stats' | 'charts' = 'viewer';
  autoRefresh = false;
  refreshInterval = 10; // seconds
  private refreshSubscription?: Subscription;

  // Charts
  chartsLoading = false;
  chartHours = 24;

  // Time series chart (requests over time)
  timeSeriesChartData: ChartData<'line'> = {
    labels: [],
    datasets: []
  };
  timeSeriesChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Requests & Errors Over Time' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  // Status distribution pie chart
  statusChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: []
  };
  statusChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' },
      title: { display: true, text: 'HTTP Status Distribution' }
    }
  };

  // Method distribution bar chart
  methodChartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };
  methodChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'HTTP Methods Distribution' }
    }
  };

  // Response time distribution bar chart
  responseTimeChartData: ChartData<'bar'> = {
    labels: [],
    datasets: []
  };
  responseTimeChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Response Time Distribution' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  // Advanced search
  advancedSearch: LogSearchParams = {
    limit: 50
  };
  searchResults: LogEntry[] = [];
  searchLoading = false;

  constructor(public logsService: LogsService, private router: Router) {}

  goBack(): void {
    this.router.navigate(['/system']);
  }

  ngOnInit(): void {
    this.loadLogFiles();
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  loadLogFiles(): void {
    this.filesLoading = true;
    this.filesError = null;
    
    this.logsService.getLogFiles().subscribe({
      next: (response) => {
        this.logFiles = response.files;
        this.filesLoading = false;
        
        // Auto-select today's HTTP log
        const today = new Date().toISOString().split('T')[0];
        const httpLog = this.logFiles.find(f => 
          f.name.includes('http') && f.name.includes(today)
        );
        if (httpLog && !this.selectedFile) {
          this.selectedFile = httpLog.name;
          this.loadLogFile();
        }
      },
      error: (err) => {
        this.filesError = err.error?.error || 'Failed to load log files';
        this.filesLoading = false;
      }
    });
  }

  loadLogFile(): void {
    if (!this.selectedFile) return;

    this.logsLoading = true;
    this.logsError = null;

    this.logsService.getLogFile(
      this.selectedFile, 
      this.maxLines, 
      this.searchQuery || undefined
    ).subscribe({
      next: (response) => {
        this.logEntries = response.lines;
        this.logsLoading = false;
      },
      error: (err) => {
        this.logsError = err.error?.error || 'Failed to load log file';
        this.logsLoading = false;
      }
    });
  }

  loadStats(): void {
    this.statsLoading = true;
    this.logsService.getStats().subscribe({
      next: (response) => {
        this.stats = response.stats;
        this.statsLoading = false;
      },
      error: () => {
        this.statsLoading = false;
      }
    });
  }

  performAdvancedSearch(): void {
    this.searchLoading = true;
    
    // Build search params
    const params: LogSearchParams = {
      ...this.advancedSearch,
      query: this.searchQuery || undefined,
      level: this.selectedLevel || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined
    };

    this.logsService.searchLogs(params).subscribe({
      next: (response) => {
        this.searchResults = response.results;
        this.searchLoading = false;
      },
      error: (err) => {
        this.logsError = err.error?.error || 'Search failed';
        this.searchLoading = false;
      }
    });
  }

  onFileSelect(): void {
    this.loadLogFile();
  }

  onSearchChange(): void {
    // Debounce would be better, but for simplicity:
    if (this.activeTab === 'viewer') {
      this.loadLogFile();
    }
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedLevel = '';
    this.selectedMethod = '';
    this.selectedStatus = '';
    this.startDate = '';
    this.endDate = '';
    this.loadLogFile();
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    
    if (this.autoRefresh) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    this.refreshSubscription = interval(this.refreshInterval * 1000)
      .pipe(
        switchMap(() => {
          if (this.activeTab === 'viewer') {
            return this.logsService.tailLogFile(this.selectedFile, this.maxLines);
          } else {
            return [];
          }
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response.lines) {
            this.logEntries = response.lines;
          }
        }
      });
  }

  private stopAutoRefresh(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = undefined;
    }
  }

  setActiveTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;

    if (tab === 'stats') {
      this.loadStats();
    } else if (tab === 'charts') {
      this.loadChartData();
    }
  }

  loadChartData(): void {
    this.chartsLoading = true;

    this.logsService.getChartData(this.chartHours).subscribe({
      next: (response) => {
        const charts = response.charts;

        // Time series chart
        const labels = charts.timeSeries.map(d => {
          const date = new Date(d.hour + ':00:00Z');
          return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        });

        this.timeSeriesChartData = {
          labels,
          datasets: [
            {
              label: 'Requests',
              data: charts.timeSeries.map(d => d.requests),
              borderColor: '#3498db',
              backgroundColor: 'rgba(52, 152, 219, 0.1)',
              fill: true,
              tension: 0.4
            },
            {
              label: 'Errors',
              data: charts.timeSeries.map(d => d.errors),
              borderColor: '#e74c3c',
              backgroundColor: 'rgba(231, 76, 60, 0.1)',
              fill: true,
              tension: 0.4
            }
          ]
        };

        // Status distribution
        this.statusChartData = {
          labels: Object.keys(charts.statusDistribution),
          datasets: [{
            data: Object.values(charts.statusDistribution),
            backgroundColor: ['#27ae60', '#3498db', '#f39c12', '#e74c3c']
          }]
        };

        // Method distribution
        this.methodChartData = {
          labels: Object.keys(charts.methodDistribution),
          datasets: [{
            data: Object.values(charts.methodDistribution),
            backgroundColor: ['#3498db', '#27ae60', '#f39c12', '#e74c3c', '#95a5a6']
          }]
        };

        // Response time distribution
        this.responseTimeChartData = {
          labels: Object.keys(charts.responseTimeDistribution),
          datasets: [{
            data: Object.values(charts.responseTimeDistribution),
            backgroundColor: '#9b59b6'
          }]
        };

        this.chartsLoading = false;
      },
      error: () => {
        this.chartsLoading = false;
      }
    });
  }

  onChartHoursChange(): void {
    this.loadChartData();
  }

  getFilteredEntries(): LogEntry[] {
    let filtered = [...this.logEntries];

    // Filter by method
    if (this.selectedMethod) {
      filtered = filtered.filter(e => 
        e.method?.toUpperCase() === this.selectedMethod
      );
    }

    // Filter by status
    if (this.selectedStatus) {
      const statusCode = parseInt(this.selectedStatus.charAt(0));
      filtered = filtered.filter(e => 
        e.status && Math.floor(e.status / 100) === statusCode
      );
    }

    // Filter by level (if not already filtered by search)
    if (this.selectedLevel && !this.searchQuery) {
      filtered = filtered.filter(e => 
        e.level?.toLowerCase() === this.selectedLevel
      );
    }

    return filtered;
  }

  getEntryClass(entry: LogEntry): string {
    const parsed = this.logsService.parseLogEntry(entry);
    return parsed.statusClass;
  }

  getEntryIcon(entry: LogEntry): string {
    const parsed = this.logsService.parseLogEntry(entry);
    return parsed.icon;
  }

  formatTimestamp(timestamp: string): string {
    return this.logsService.formatTimestamp(timestamp);
  }

  downloadLogs(): void {
    const filtered = this.getFilteredEntries();
    const json = JSON.stringify(filtered, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${this.selectedFile}-${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  exportToCSV(): void {
    const filtered = this.getFilteredEntries();
    const headers = ['Timestamp', 'Level', 'Method', 'URL', 'Status', 'Response Time', 'Message'];
    const rows = filtered.map(entry => [
      entry.timestamp || '',
      entry.level || '',
      entry.method || '',
      entry.url || '',
      entry.status?.toString() || '',
      entry.responseTime || '',
      entry.message || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${this.selectedFile}-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  refresh(): void {
    if (this.activeTab === 'viewer') {
      this.loadLogFile();
    } else if (this.activeTab === 'search') {
      this.performAdvancedSearch();
    } else {
      this.loadStats();
    }
  }

  getStatusCodeColor(status: number): string {
    if (status >= 500) return '#e74c3c';
    if (status >= 400) return '#f39c12';
    if (status >= 300) return '#3498db';
    if (status >= 200) return '#27ae60';
    return '#95a5a6';
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  parseInt(value: string): number {
    return Number.parseInt(value, 10);
  }

  parseFloat(value: string): number {
    return Number.parseFloat(value);
  }
}
