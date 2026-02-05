import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TradingExchangeService } from '../../services/trading-exchange.service';
import { Portfolio, PerformanceMetrics } from '../../models/trading-exchange.models';

@Component({
  selector: 'app-portfolio-dashboard',
  templateUrl: './portfolio-dashboard.component.html',
  styleUrls: ['./portfolio-dashboard.component.scss']
})
export class PortfolioDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  portfolio: Portfolio['portfolio'] | null = null;
  performanceMetrics: PerformanceMetrics | null = null;

  loading = false;
  error: string | null = null;

  selectedPeriod = 30;
  periods = [7, 14, 30, 60, 90];

  displayedColumns = ['hotelName', 'buyPrice', 'sellPrice', 'pnl', 'pnlPercent', 'daysToCheckIn', 'risk'];

  constructor(public tradingService: TradingExchangeService) {}

  ngOnInit(): void {
    this.loadData();

    this.tradingService.refresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadData());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    // Load portfolio
    this.tradingService.getPortfolio(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.portfolio = response.portfolio;
        },
        error: (err) => {
          this.error = 'Failed to load portfolio';
          console.error('Portfolio error:', err);
        }
      });

    // Load performance metrics
    this.tradingService.getPerformanceMetrics(this.selectedPeriod)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.performanceMetrics = response;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          console.error('Performance metrics error:', err);
        }
      });
  }

  onPeriodChange(): void {
    this.loadData();
  }

  formatCurrency(value: number): string {
    return this.tradingService.formatCurrency(value);
  }

  formatPercent(value: number | string): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return this.tradingService.formatPercent(num);
  }

  getPnLClass(value: number): string {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  }
}
