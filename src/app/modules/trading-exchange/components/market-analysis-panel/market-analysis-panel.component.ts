import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TradingExchangeService } from '../../services/trading-exchange.service';
import { MarketOverview, MarketTicker, MarketDataResponse } from '../../models/trading-exchange.models';

@Component({
  selector: 'app-market-analysis-panel',
  templateUrl: './market-analysis-panel.component.html',
  styleUrls: ['./market-analysis-panel.component.scss']
})
export class MarketAnalysisPanelComponent implements OnInit, OnDestroy {
  @Output() hotelSelected = new EventEmitter<number>();

  private destroy$ = new Subject<void>();

  marketOverview: MarketOverview | null = null;
  marketData: MarketTicker[] = [];

  loading = false;
  error: string | null = null;

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

    // Load market overview
    this.tradingService.getMarketOverview()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.marketOverview = response;
        },
        error: (err) => {
          console.error('Market overview error:', err);
        }
      });

    // Load market data (tickers)
    this.tradingService.getMarketData(20)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.marketData = response.tickers;
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to load market data';
          this.loading = false;
          console.error('Market data error:', err);
        }
      });
  }

  onTickerClick(ticker: MarketTicker): void {
    this.hotelSelected.emit(ticker.hotelId);
  }

  formatCurrency(value: number): string {
    return this.tradingService.formatCurrency(value);
  }

  formatPercent(value: number): string {
    return this.tradingService.formatPercent(value);
  }

  getChangeClass(change: number): string {
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return 'neutral';
  }
}
