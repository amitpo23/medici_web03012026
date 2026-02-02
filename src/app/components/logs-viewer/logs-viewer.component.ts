import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  LogsService, 
  LogFile, 
  LogEntry, 
  LogSearchParams,
  LogStats 
} from '../../services/logs.service';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-logs-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  activeTab: 'viewer' | 'search' | 'stats' = 'viewer';
  autoRefresh = false;
  refreshInterval = 10; // seconds
  private refreshSubscription?: Subscription;

  // Advanced search
  advancedSearch: LogSearchParams = {
    limit: 50
  };
  searchResults: LogEntry[] = [];
  searchLoading = false;

  constructor(public logsService: LogsService) {}

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
    }
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
}
