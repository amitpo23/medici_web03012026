import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  CancellationsService, 
  CancellationStats,
  Cancellation,
  CancellationError,
  AutoCancellation,
  TrendData
} from '../../services/cancellations.service';

@Component({
  selector: 'app-cancellations-overview',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cancellations-overview.component.html',
  styleUrls: ['./cancellations-overview.component.scss']
})
export class CancellationsOverviewComponent implements OnInit {
  // Stats
  stats: CancellationStats | null = null;
  statsLoading = false;
  statsError: string | null = null;
  selectedPeriod = 30;

  // Recent cancellations
  recentCancellations: Cancellation[] = [];
  recentLoading = false;
  recentError: string | null = null;
  statusFilter: 'all' | 'success' | 'failure' = 'all';

  // Errors
  commonErrors: CancellationError[] = [];
  errorsLoading = false;
  errorsError: string | null = null;

  // Auto cancellations
  autoCancellations: AutoCancellation[] = [];
  autoLoading = false;
  autoError: string | null = null;

  // Trends
  trends: { successByDay: TrendData[]; failureByDay: TrendData[] } | null = null;
  trendsLoading = false;
  trendsError: string | null = null;

  // UI state
  activeTab: 'overview' | 'recent' | 'errors' | 'auto' | 'trends' = 'overview';

  constructor(private cancellationsService: CancellationsService, private router: Router) {}

  goBack(): void {
    this.router.navigate(['/system']);
  }

  ngOnInit(): void {
    this.loadStats();
    this.loadRecentCancellations();
    this.loadCommonErrors();
    this.loadAutoCancellations();
    this.loadTrends();
  }

  loadStats(): void {
    this.statsLoading = true;
    this.statsError = null;
    this.cancellationsService.getStats(this.selectedPeriod).subscribe({
      next: (response) => {
        this.stats = response.stats;
        this.statsLoading = false;
      },
      error: (err) => {
        this.statsError = err.error?.error || 'Failed to load stats';
        this.statsLoading = false;
      }
    });
  }

  loadRecentCancellations(): void {
    this.recentLoading = true;
    this.recentError = null;
    this.cancellationsService.getRecent(50, this.statusFilter).subscribe({
      next: (response) => {
        this.recentCancellations = response.cancellations;
        this.recentLoading = false;
      },
      error: (err) => {
        this.recentError = err.error?.error || 'Failed to load recent cancellations';
        this.recentLoading = false;
      }
    });
  }

  loadCommonErrors(): void {
    this.errorsLoading = true;
    this.errorsError = null;
    this.cancellationsService.getErrors(this.selectedPeriod).subscribe({
      next: (response) => {
        this.commonErrors = response.errors;
        this.errorsLoading = false;
      },
      error: (err) => {
        this.errorsError = err.error?.error || 'Failed to load errors';
        this.errorsLoading = false;
      }
    });
  }

  loadAutoCancellations(): void {
    this.autoLoading = true;
    this.autoError = null;
    this.cancellationsService.getAutoCancellations(50).subscribe({
      next: (response) => {
        this.autoCancellations = response.autoCancellations;
        this.autoLoading = false;
      },
      error: (err) => {
        this.autoError = err.error?.error || 'Failed to load auto-cancellations';
        this.autoLoading = false;
      }
    });
  }

  loadTrends(): void {
    this.trendsLoading = true;
    this.trendsError = null;
    this.cancellationsService.getTrends(this.selectedPeriod).subscribe({
      next: (response) => {
        this.trends = response.trends;
        this.trendsLoading = false;
      },
      error: (err) => {
        this.trendsError = err.error?.error || 'Failed to load trends';
        this.trendsLoading = false;
      }
    });
  }

  onPeriodChange(): void {
    this.loadStats();
    this.loadCommonErrors();
    this.loadTrends();
  }

  onStatusFilterChange(): void {
    this.loadRecentCancellations();
  }

  setActiveTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
  }

  getSuccessRateColor(): string {
    if (!this.stats) return 'gray';
    const rate = parseFloat(this.stats.successRate);
    if (rate >= 80) return 'green';
    if (rate >= 50) return 'orange';
    return 'red';
  }

  getStatusClass(status: string): string {
    return status === 'SUCCESS' ? 'success' : 'failure';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('he-IL');
  }

  formatNumber(num: number): string {
    return num?.toLocaleString('he-IL') || '0';
  }

  formatCurrency(amount: number): string {
    return `₪${amount?.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
  }

  getBarHeight(count: number, data: TrendData[]): string {
    const max = Math.max(...data.map(d => d.Count));
    const percentage = max > 0 ? (count / max) * 100 : 0;
    return `${percentage}%`;
  }
}
