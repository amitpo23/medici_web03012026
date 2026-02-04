import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { interval, Subject, takeUntil } from 'rxjs';
import { environment } from 'src/app/environments/environment';

interface CompetitorChange {
  competitorName: string;
  oldPrice: number;
  newPrice: number;
  changeAmount: number;
  changePercent: number;
  changeDate: string;
}

interface ResponseStrategy {
  strategy: 'AGGRESSIVE_MATCH' | 'SELECTIVE_MATCH' | 'OPPORTUNISTIC_INCREASE' | 'MONITOR_ONLY';
  action: {
    newPrice: number;
    adjustment: number;
    adjustmentPercent: number;
    action: string;
  };
  rationale: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

interface Alert {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  competitor: string;
  message: string;
}

@Component({
  selector: 'app-competitor-tracker',
  templateUrl: './competitor-tracker.component.html',
  styleUrls: ['./competitor-tracker.component.scss']
})
export class CompetitorTrackerComponent implements OnInit, OnDestroy {
  selectedHotelId: number | null = null;
  daysBack = 7;
  
  changes: CompetitorChange[] = [];
  strategy: ResponseStrategy | null = null;
  alerts: Alert[] = [];
  
  loading = false;
  error: string | null = null;
  autoRefresh = true;
  
  private destroy$ = new Subject<void>();
  private baseUrl = environment.baseUrl;

  // Stats
  stats = {
    totalChanges: 0,
    avgChangePercent: 0,
    priceIncreases: 0,
    priceDecreases: 0,
    significantChanges: 0
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Auto-refresh every 2 minutes if enabled
    interval(120000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.autoRefresh && this.selectedHotelId) {
          this.trackChanges();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackChanges(): void {
    if (!this.selectedHotelId) return;

    this.loading = true;
    this.error = null;

    this.http.get<any>(`${this.baseUrl}/pricing/v2/competitor/${this.selectedHotelId}/changes?daysBack=${this.daysBack}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.changes = response.changes || [];
            this.stats = response.stats || this.stats;
            this.alerts = response.alerts || [];
            
            // Get strategy for first significant change
            const significantChange = this.changes.find(c => Math.abs(c.changePercent) > 5);
            if (significantChange) {
              this.getResponseStrategy(significantChange);
            }
          } else {
            this.error = response.message || 'Failed to track changes';
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('Competitor tracking error:', err);
          this.error = err.error?.message || 'Failed to connect to tracking service';
          this.loading = false;
        }
      });
  }

  getResponseStrategy(change: CompetitorChange): void {
    if (!this.selectedHotelId) return;

    const payload = {
      hotelId: this.selectedHotelId,
      competitorChange: {
        competitorId: 1, // You might want to get this from somewhere
        oldPrice: change.oldPrice,
        newPrice: change.newPrice,
        changePercent: change.changePercent
      }
    };

    this.http.post<any>(`${this.baseUrl}/pricing/v2/competitor/response-strategy`, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.strategy) {
            this.strategy = response.strategy;
          }
        },
        error: (err) => {
          console.error('Strategy error:', err);
        }
      });
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'HIGH': return '#f44336';
      case 'MEDIUM': return '#ff9800';
      case 'LOW': return '#2196f3';
      default: return '#9e9e9e';
    }
  }

  getUrgencyColor(urgency: string): string {
    switch (urgency) {
      case 'HIGH': return '#f44336';
      case 'MEDIUM': return '#ff9800';
      case 'LOW': return '#4caf50';
      default: return '#9e9e9e';
    }
  }

  getStrategyColor(strategy: string): string {
    switch (strategy) {
      case 'AGGRESSIVE_MATCH': return '#f44336';
      case 'SELECTIVE_MATCH': return '#ff9800';
      case 'OPPORTUNISTIC_INCREASE': return '#4caf50';
      case 'MONITOR_ONLY': return '#2196f3';
      default: return '#9e9e9e';
    }
  }

  getChangeColor(percent: number): string {
    if (percent > 0) return '#4caf50';
    if (percent < 0) return '#f44336';
    return '#9e9e9e';
  }

  formatCurrency(value: number): string {
    return '€' + value.toFixed(2);
  }

  formatPercent(value: number): string {
    const sign = value > 0 ? '+' : '';
    return sign + value.toFixed(2) + '%';
  }

  getAbsoluteValue(value: number): number {
    return Math.abs(value);
  }

  formatReadable(text: string): string {
    return text.replace(/_/g, ' ');
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
  }

  refresh(): void {
    this.trackChanges();
  }
}
