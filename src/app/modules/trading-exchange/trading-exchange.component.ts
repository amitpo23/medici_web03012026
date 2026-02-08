import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TradingExchangeService } from './services/trading-exchange.service';
import { PriceChartComponent } from './components/price-chart/price-chart.component';
import { OrderBookComponent } from './components/order-book/order-book.component';
import { TradingSignal } from './models/trading-exchange.models';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { BuyOptionDialogComponent } from '../../components/shared/buy-option-dialog/buy-option-dialog.component';

interface Opportunity {
  id: number;
  hotelId: number;
  hotelName: string;
  city: string;
  checkIn: Date;
  checkOut: Date;
  roomType: string;
  price: number;
  originalPrice?: number;
}

interface SearchFilters {
  hotel: string;
  city: string;
  minPrice: number;
  maxPrice: number;
}

@Component({
  selector: 'app-trading-exchange',
  templateUrl: './trading-exchange.component.html',
  styleUrls: ['./trading-exchange.component.scss']
})
export class TradingExchangeComponent implements OnInit, OnDestroy {
  @ViewChild('priceChart') priceChart!: PriceChartComponent;
  @ViewChild('orderBook') orderBook!: OrderBookComponent;

  private destroy$ = new Subject<void>();

  selectedHotelId = 0;
  selectedHotelName = '';
  selectedIndex = -1;
  autoRefresh = true;
  refreshInterval = 60000;

  opportunities: Opportunity[] = [];

  constructor(
    private tradingService: TradingExchangeService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadOpportunities();

    interval(this.refreshInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.autoRefresh) {
          this.tradingService.triggerRefresh();
          this.loadOpportunities();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOpportunities(): void {
    this.tradingService.getOpportunities().subscribe({
      next: (response: { data: Record<string, unknown>[] }) => {
        this.opportunities = (response.data || []).slice(0, 6).map((item: Record<string, unknown>) => ({
          id: item['OpportunityId'] as number,
          hotelId: item['DestinationsId'] as number,
          hotelName: item['HotelName'] as string || 'Unknown',
          city: item['City'] as string || 'TLV',
          checkIn: new Date(item['DateForm'] as string),
          checkOut: new Date(item['DateTo'] as string),
          roomType: item['RoomType'] as string || 'Classic',
          price: item['Price'] as number || 120,
          originalPrice: item['PushPrice'] as number
        }));
      },
      error: () => {
        // Fallback mock data matching template
        this.opportunities = [
          { id: 1, hotelId: 88, hotelName: 'TLV88', city: 'TLV', checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'), roomType: 'Classic', price: 120 },
          { id: 2, hotelId: 88, hotelName: 'TLV88', city: 'TLV', checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'), roomType: 'Classic', price: 120 },
          { id: 3, hotelId: 88, hotelName: 'TLV88', city: 'TLV', checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'), roomType: 'Classic', price: 120 },
          { id: 4, hotelId: 88, hotelName: 'TLV88', city: 'TLV', checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'), roomType: 'Classic', price: 120 },
          { id: 5, hotelId: 88, hotelName: 'TLV88', city: 'TLV', checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'), roomType: 'Classic', price: 120 },
          { id: 6, hotelId: 88, hotelName: 'TLV88', city: 'TLV', checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'), roomType: 'Classic', price: 120 }
        ];
      }
    });
  }

  selectOpportunity(index: number, opportunity: Opportunity): void {
    this.selectedIndex = index;
    this.selectedHotelId = opportunity.hotelId;
    this.selectedHotelName = opportunity.hotelName;

    if (this.priceChart) {
      this.priceChart.setHotelId(opportunity.hotelId);
    }
    if (this.orderBook) {
      this.orderBook.setHotelId(opportunity.hotelId);
    }
  }

  onBuyOpportunity(opportunity: Opportunity): void {
    // Calculate days before arrival
    const today = new Date();
    const checkInDate = new Date(opportunity.checkIn);
    const daysBeforeArrival = Math.max(0, Math.floor((checkInDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    const dialogRef = this.dialog.open(BuyOptionDialogComponent, {
      width: '500px',
      panelClass: 'buy-option-dialog-container',
      data: {
        hotelId: opportunity.hotelId,
        hotelName: opportunity.hotelName,
        city: opportunity.city,
        checkIn: opportunity.checkIn,
        checkOut: opportunity.checkOut,
        roomType: opportunity.roomType,
        price: opportunity.price,
        targetPrice: opportunity.originalPrice || Math.round(opportunity.price * 1.15),
        daysBeforeArrival
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.confirmed) {
        this.snackBar.open(`Buying ${opportunity.hotelName} for $${opportunity.price}...`, 'View Order', {
          duration: 5000,
          panelClass: ['gold-snackbar']
        }).onAction().subscribe(() => {
          window.location.href = '/trading/orders';
        });
        // Here you would call the actual buy API
        this.tradingService.triggerRefresh();
      }
    });
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
    window.open(`/trading/search-and-buy?hotelId=${signal.asset.hotelId}`, '_blank');
  }

  onHotSaleHotelSelected(hotel: { id: number; hotelName: string; city: string; price: number }): void {
    this.selectedHotelId = hotel.id;
    this.selectedHotelName = hotel.hotelName;

    if (this.priceChart) {
      this.priceChart.setHotelId(hotel.id);
    }
    if (this.orderBook) {
      this.orderBook.setHotelId(hotel.id);
    }

    this.snackBar.open(`Selected ${hotel.hotelName} - ${hotel.city}`, 'View', {
      duration: 3000
    });
  }

  onSearchRequested(filters: SearchFilters): void {
    const params = new URLSearchParams();
    if (filters.hotel) params.set('hotel', filters.hotel);
    if (filters.city) params.set('city', filters.city);
    params.set('minPrice', String(filters.minPrice));
    params.set('maxPrice', String(filters.maxPrice));

    window.location.href = `/trading/search-and-buy?${params.toString()}`;
  }

  refreshAll(): void {
    this.tradingService.triggerRefresh();
    this.loadOpportunities();
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
  }
}
