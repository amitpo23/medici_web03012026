import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TradingExchangeService } from '../../services/trading-exchange.service';
import { OrderBook, OrderBookLevel } from '../../models/trading-exchange.models';

@Component({
  selector: 'app-order-book',
  templateUrl: './order-book.component.html',
  styleUrls: ['./order-book.component.scss']
})
export class OrderBookComponent implements OnInit, OnDestroy {
  @Input() hotelId: number = 0;
  @Input() levels: number = 10;

  private destroy$ = new Subject<void>();

  orderBook: OrderBook | null = null;
  loading = false;
  error: string | null = null;

  maxBidQuantity = 0;
  maxAskQuantity = 0;

  constructor(private tradingService: TradingExchangeService) {}

  ngOnInit(): void {
    if (this.hotelId > 0) {
      this.loadOrderBook();
    }

    // Auto-refresh
    this.tradingService.refresh$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.hotelId > 0) {
          this.loadOrderBook();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrderBook(): void {
    if (!this.hotelId || this.hotelId <= 0) return;

    this.loading = true;
    this.error = null;

    this.tradingService.getOrderBook(this.hotelId, this.levels)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.orderBook = response;
          this.calculateMaxQuantities();
          this.loading = false;
        },
        error: (err) => {
          this.error = 'Failed to load order book';
          this.loading = false;
          console.error('Order book error:', err);
        }
      });
  }

  private calculateMaxQuantities(): void {
    if (!this.orderBook) return;

    this.maxBidQuantity = Math.max(
      ...this.orderBook.bids.map(b => b.quantity),
      1
    );
    this.maxAskQuantity = Math.max(
      ...this.orderBook.asks.map(a => a.quantity),
      1
    );
  }

  getBidBarWidth(level: OrderBookLevel): number {
    return (level.quantity / this.maxBidQuantity) * 100;
  }

  getAskBarWidth(level: OrderBookLevel): number {
    return (level.quantity / this.maxAskQuantity) * 100;
  }

  formatPrice(price: number): string {
    return this.tradingService.formatCurrency(price);
  }

  setHotelId(hotelId: number): void {
    this.hotelId = hotelId;
    this.loadOrderBook();
  }
}
