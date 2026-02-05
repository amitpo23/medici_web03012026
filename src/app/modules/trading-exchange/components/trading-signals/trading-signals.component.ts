import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TradingExchangeService } from '../../services/trading-exchange.service';
import { TradingSignal, AISignalsResponse } from '../../models/trading-exchange.models';

@Component({
  selector: 'app-trading-signals',
  templateUrl: './trading-signals.component.html',
  styleUrls: ['./trading-signals.component.scss']
})
export class TradingSignalsComponent implements OnInit, OnDestroy {
  @Output() signalSelected = new EventEmitter<TradingSignal>();
  @Output() buyClicked = new EventEmitter<TradingSignal>();

  private destroy$ = new Subject<void>();

  signals: TradingSignal[] = [];
  consensus: AISignalsResponse['consensus'] | null = null;
  historicalPerformance: AISignalsResponse['historicalPerformance'] | null = null;

  loading = false;
  error: string | null = null;

  minConfidence = 50;
  filterStrength: string = 'all';

  constructor(public tradingService: TradingExchangeService) {}

  ngOnInit(): void {
    this.loadSignals();

    // Auto-refresh
    this.tradingService.refresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadSignals());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSignals(): void {
    this.loading = true;
    this.error = null;

    this.tradingService.getAISignals(this.minConfidence, 50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.signals = response.signals;
          this.consensus = response.consensus;
          this.historicalPerformance = response.historicalPerformance;
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to load trading signals';
          this.loading = false;
          console.error('Signals error:', err);
        }
      });
  }

  get filteredSignals(): TradingSignal[] {
    if (this.filterStrength === 'all') {
      return this.signals;
    }
    return this.signals.filter(s => s.strength === this.filterStrength);
  }

  onSignalClick(signal: TradingSignal): void {
    this.signalSelected.emit(signal);
  }

  onBuyClick(signal: TradingSignal, event: Event): void {
    event.stopPropagation();
    this.buyClicked.emit(signal);
  }

  getSignalIcon(type: string): string {
    switch (type) {
      case 'BUY': return 'trending_up';
      case 'CONSIDER': return 'remove';
      case 'WATCH': return 'visibility';
      default: return 'help';
    }
  }

  getStrengthClass(strength: string): string {
    return strength?.toLowerCase() || 'weak';
  }

  formatPrice(price: number): string {
    return this.tradingService.formatCurrency(price);
  }

  formatPercent(value: number): string {
    return this.tradingService.formatPercent(value);
  }
}
