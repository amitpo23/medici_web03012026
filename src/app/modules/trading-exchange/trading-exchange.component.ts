import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TradingExchangeService } from './services/trading-exchange.service';
import { PriceChartComponent } from './components/price-chart/price-chart.component';
import { OrderBookComponent } from './components/order-book/order-book.component';
import { TradingSignal } from './models/trading-exchange.models';

@Component({
  selector: 'app-trading-exchange',
  templateUrl: './trading-exchange.component.html',
  styleUrls: ['./trading-exchange.component.scss']
})
export class TradingExchangeComponent implements OnInit, OnDestroy {
  @ViewChild('priceChart') priceChart!: PriceChartComponent;
  @ViewChild('orderBook') orderBook!: OrderBookComponent;

  private destroy$ = new Subject<void>();

  selectedHotelId: number = 0;
  selectedHotelName: string = '';
  autoRefresh = true;
  refreshInterval = 60000; // 1 minute

  constructor(private tradingService: TradingExchangeService) {}

  ngOnInit(): void {
    // Auto-refresh every minute
    interval(this.refreshInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.autoRefresh) {
          this.tradingService.triggerRefresh();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onHotelSelected(hotelId: number): void {
    this.selectedHotelId = hotelId;
    if (this.priceChart) {
      this.priceChart.setHotelId(hotelId);
    }
    if (this.orderBook) {
      this.orderBook.setHotelId(hotelId);
    }
  }

  onSignalSelected(signal: TradingSignal): void {
    this.selectedHotelId = signal.asset.hotelId;
    this.selectedHotelName = signal.asset.hotelName;
    if (this.priceChart) {
      this.priceChart.setHotelId(signal.asset.hotelId);
    }
    if (this.orderBook) {
      this.orderBook.setHotelId(signal.asset.hotelId);
    }
  }

  onBuyClicked(signal: TradingSignal): void {
    // Navigate to trading/buy page or open dialog
    console.log('Buy clicked:', signal);
    // This would typically open a buy dialog or navigate to the buy page
    window.open(`/trading/search-and-buy?hotelId=${signal.asset.hotelId}`, '_blank');
  }

  refreshAll(): void {
    this.tradingService.triggerRefresh();
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
  }
}
