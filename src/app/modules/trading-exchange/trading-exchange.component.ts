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
import { AIPredictionService, City, Hotel } from '../../services/ai-prediction.service';

interface EnhancedOpportunity {
  id: number;
  hotelId: number;
  hotelName: string;
  city: string;
  checkIn: Date;
  checkOut: Date;
  roomType: string;
  price: number;
  originalPrice: number;
  expectedProfit: number;
  marginPercent: number;
  confidence: number;
  daysToCheckIn: number;
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

  // City/Hotel selection
  cities: City[] = [];
  hotels: Hotel[] = [];
  selectedCity = '';
  selectedHotelDropdownId = 0;

  // Filtering
  minProfit = 0;
  periodFilter = 'all';

  // Demand forecast
  demandForecast: any = null;
  demandLoading = false;

  // Enhanced opportunities
  allOpportunities: EnhancedOpportunity[] = [];
  filteredOpportunities: EnhancedOpportunity[] = [];

  constructor(
    private tradingService: TradingExchangeService,
    private aiService: AIPredictionService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadOpportunities();
    this.loadDemandForecast();

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

  // --- Data Loading ---

  loadCities(): void {
    this.aiService.getCities()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.cities = res.cities || []; },
        error: () => { this.cities = []; }
      });
  }

  loadOpportunities(): void {
    this.tradingService.getOpportunities(50).subscribe({
      next: (response: any) => {
        const data = response.data || response || [];
        const items = Array.isArray(data) ? data : [];
        const today = new Date();

        this.allOpportunities = items.map((item: Record<string, unknown>) => {
          const price = (item['Price'] as number) || (item['price'] as number) || 0;
          const pushPrice = (item['PushPrice'] as number) || (item['pushPrice'] as number) || 0;
          const checkIn = new Date((item['DateForm'] as string) || (item['startDate'] as string) || today);
          const checkOut = new Date((item['DateTo'] as string) || (item['endDate'] as string) || today);
          const daysToCheckIn = Math.max(0, Math.floor((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
          const expectedProfit = pushPrice > 0 ? Math.round(pushPrice - price) : 0;
          const marginPercent = price > 0 && pushPrice > 0
            ? Math.round(((pushPrice - price) / price) * 100)
            : 0;

          return {
            id: (item['OpportunityId'] as number) || (item['id'] as number) || 0,
            hotelId: (item['DestinationsId'] as number) || (item['hotelId'] as number) || 0,
            hotelName: (item['HotelName'] as string) || (item['hotelName'] as string) || 'Unknown',
            city: (item['City'] as string) || (item['city'] as string) || '',
            checkIn,
            checkOut,
            roomType: (item['RoomType'] as string) || (item['roomType'] as string) || 'Standard',
            price,
            originalPrice: pushPrice,
            expectedProfit,
            marginPercent,
            confidence: this.estimateConfidence(marginPercent, daysToCheckIn),
            daysToCheckIn
          } as EnhancedOpportunity;
        });

        this.applyFilters();
      },
      error: () => {
        this.allOpportunities = [];
        this.filteredOpportunities = [];
      }
    });
  }

  loadDemandForecast(city?: string): void {
    this.demandLoading = true;
    this.aiService.getDemandForecast({
      city: city || this.selectedCity || undefined,
      days: 30
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.demandForecast = res;
          this.demandLoading = false;
        },
        error: () => {
          this.demandForecast = null;
          this.demandLoading = false;
        }
      });
  }

  // --- City/Hotel Selection ---

  onCityChange(city: string): void {
    this.selectedCity = city;
    this.selectedHotelDropdownId = 0;

    if (city) {
      this.aiService.getHotels(city)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => { this.hotels = res.hotels || []; },
          error: () => { this.hotels = []; }
        });
      this.loadDemandForecast(city);
    } else {
      this.hotels = [];
    }

    this.applyFilters();
  }

  onHotelDropdownChange(hotelId: number): void {
    this.selectedHotelDropdownId = hotelId;
    if (hotelId) {
      this.selectedHotelId = hotelId;
      const hotel = this.hotels.find(h => h.hotelId === hotelId);
      if (hotel) {
        this.selectedHotelName = hotel.hotelName;
      }
      if (this.priceChart) { this.priceChart.setHotelId(hotelId); }
      if (this.orderBook) { this.orderBook.setHotelId(hotelId); }
    }
    this.applyFilters();
  }

  // --- Filtering ---

  applyFilters(): void {
    let filtered = [...this.allOpportunities];

    if (this.selectedCity) {
      filtered = filtered.filter(o =>
        o.city.toLowerCase().includes(this.selectedCity.toLowerCase())
      );
    }

    if (this.selectedHotelDropdownId) {
      filtered = filtered.filter(o => o.hotelId === this.selectedHotelDropdownId);
    }

    if (this.minProfit > 0) {
      filtered = filtered.filter(o => o.expectedProfit >= this.minProfit);
    }

    if (this.periodFilter !== 'all') {
      filtered = filtered.filter(o => {
        switch (this.periodFilter) {
          case '0-7': return o.daysToCheckIn <= 7;
          case '7-30': return o.daysToCheckIn > 7 && o.daysToCheckIn <= 30;
          case '30-60': return o.daysToCheckIn > 30 && o.daysToCheckIn <= 60;
          case '60+': return o.daysToCheckIn > 60;
          default: return true;
        }
      });
    }

    this.filteredOpportunities = filtered;
  }

  onMinProfitChange(value: number): void {
    this.minProfit = value || 0;
    this.applyFilters();
  }

  onPeriodFilterChange(period: string): void {
    this.periodFilter = period;
    this.applyFilters();
  }

  estimateConfidence(margin: number, daysToCheckIn: number): number {
    let score = 50;
    if (margin > 20) { score += 15; }
    else if (margin > 10) { score += 10; }
    else if (margin > 5) { score += 5; }

    if (daysToCheckIn > 30) { score += 15; }
    else if (daysToCheckIn > 14) { score += 10; }
    else if (daysToCheckIn > 7) { score += 5; }
    else { score -= 10; }

    return Math.min(95, Math.max(10, score));
  }

  // --- Selection ---

  selectOpportunity(index: number, opportunity: EnhancedOpportunity): void {
    this.selectedIndex = index;
    this.selectedHotelId = opportunity.hotelId;
    this.selectedHotelName = opportunity.hotelName;

    if (this.priceChart) { this.priceChart.setHotelId(opportunity.hotelId); }
    if (this.orderBook) { this.orderBook.setHotelId(opportunity.hotelId); }
  }

  // --- Buy Flow ---

  onBuyOpportunity(opportunity: EnhancedOpportunity): void {
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
        daysBeforeArrival: opportunity.daysToCheckIn
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.confirmed) {
        this.executeBuy(
          opportunity.hotelId,
          opportunity.hotelName,
          opportunity.checkIn,
          opportunity.checkOut,
          opportunity.price,
          opportunity.originalPrice || Math.round(opportunity.price * 1.15)
        );
      }
    });
  }

  onBuySignal(signal: TradingSignal): void {
    const dialogRef = this.dialog.open(BuyOptionDialogComponent, {
      width: '500px',
      panelClass: 'buy-option-dialog-container',
      data: {
        hotelId: signal.asset.hotelId,
        hotelName: signal.asset.hotelName,
        city: '',
        checkIn: signal.asset.checkIn,
        checkOut: signal.asset.checkOut,
        roomType: 'Standard',
        price: signal.pricing.buyPrice,
        targetPrice: signal.pricing.targetPrice,
        daysBeforeArrival: signal.asset.daysToCheckIn
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.confirmed) {
        this.executeBuy(
          signal.asset.hotelId,
          signal.asset.hotelName,
          signal.asset.checkIn,
          signal.asset.checkOut,
          signal.pricing.buyPrice,
          signal.pricing.targetPrice
        );
      }
    });
  }

  private executeBuy(hotelId: number, hotelName: string, checkIn: any, checkOut: any, buyPrice: number, sellPrice: number): void {
    // Default dates if missing: checkIn = 7 days from now, checkOut = 10 days from now
    const today = new Date();
    const defaultCheckIn = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defaultCheckOut = new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const startDate = checkIn ? (checkIn instanceof Date ? checkIn.toISOString().split('T')[0] : String(checkIn).split('T')[0]) : defaultCheckIn;
    const endDate = checkOut ? (checkOut instanceof Date ? checkOut.toISOString().split('T')[0] : String(checkOut).split('T')[0]) : defaultCheckOut;

    this.snackBar.open(`Buying ${hotelName} for $${buyPrice}...`, '', {
      duration: 2000,
      panelClass: ['gold-snackbar']
    });

    this.aiService.buyOpportunity({
      hotelId,
      startDateStr: startDate,
      endDateStr: endDate,
      boardlId: 1,
      categorylId: 1,
      buyPrice,
      pushPrice: sellPrice
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          if (response.success) {
            this.snackBar.open(
              `Bought ${hotelName}! Order #${response.opportunityId || response.id || ''}`,
              'View Portfolio',
              { duration: 5000, panelClass: ['gold-snackbar'] }
            ).onAction().subscribe(() => {
              window.location.href = '/exchange/portfolio';
            });
            this.tradingService.triggerRefresh();
            this.loadOpportunities();
          } else {
            this.snackBar.open(`Buy failed: ${response.error || 'Unknown error'}`, 'Dismiss', { duration: 5000 });
          }
        },
        error: (err: any) => {
          this.snackBar.open(`Buy failed: ${err.error?.message || 'Network error'}`, 'Dismiss', { duration: 5000 });
        }
      });
  }

  // --- Signal/Hotel Handlers ---

  onHotelSelected(hotelId: number): void {
    this.selectedHotelId = hotelId;
    if (this.priceChart) { this.priceChart.setHotelId(hotelId); }
    if (this.orderBook) { this.orderBook.setHotelId(hotelId); }
  }

  onSignalSelected(signal: TradingSignal): void {
    this.selectedHotelId = signal.asset.hotelId;
    this.selectedHotelName = signal.asset.hotelName;
    if (this.priceChart) { this.priceChart.setHotelId(signal.asset.hotelId); }
    if (this.orderBook) { this.orderBook.setHotelId(signal.asset.hotelId); }
  }

  onHotSaleHotelSelected(hotel: { id: number; hotelName: string; city: string; price: number }): void {
    this.selectedHotelId = hotel.id;
    this.selectedHotelName = hotel.hotelName;
    if (this.priceChart) { this.priceChart.setHotelId(hotel.id); }
    if (this.orderBook) { this.orderBook.setHotelId(hotel.id); }
    this.snackBar.open(`Selected ${hotel.hotelName} - ${hotel.city}`, 'View', { duration: 3000 });
  }

  onSearchRequested(filters: SearchFilters): void {
    const params = new URLSearchParams();
    if (filters.hotel) { params.set('hotel', filters.hotel); }
    if (filters.city) { params.set('city', filters.city); }
    params.set('minPrice', String(filters.minPrice));
    params.set('maxPrice', String(filters.maxPrice));
    window.location.href = `/trading/search-and-buy?${params.toString()}`;
  }

  // --- Helpers ---

  getConfidenceColor(confidence: number): string {
    return this.tradingService.getConfidenceColor(confidence);
  }

  refreshAll(): void {
    this.tradingService.triggerRefresh();
    this.loadOpportunities();
    this.loadDemandForecast();
  }
}
