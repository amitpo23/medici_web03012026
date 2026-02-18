import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from 'src/app/environments/environment';

import { CitySearchRequest, QuickBuyRequest, RoomResult, SearchAnalysisRequest, TradingService } from '../../../services/trading.service';
import { BuyConfirmationDialogComponent } from '../buy-confirmation-dialog/buy-confirmation-dialog.component';

interface City { cityName: string; count?: number; }
interface Hotel { hotelId: number; hotelName: string; cityName?: string; }

@Component({
  selector: 'app-search-and-buy',
  templateUrl: './search-and-buy.component.html',
  styleUrls: ['./search-and-buy.component.scss']
})
export class SearchAndBuyComponent implements OnInit, OnDestroy {
  searchForm!: FormGroup;
  loading = false;
  searchResults: RoomResult[] = [];
  hotelAnalytics: any = null;
  searchToken = '';
  searchParams: any = null;

  // City + Hotel selector
  cities: City[] = [];
  hotels: Hotel[] = [];
  filteredHotels: Hotel[] = [];
  selectedCity: string | null = null;

  // Auto-discovery
  aiSignals: any[] = [];
  hotDeals: any[] = [];
  loadingSignals = false;

  // City search results
  cityResults: any[] = [];
  citySearchMode = false;

  private destroy$ = new Subject<void>();
  private baseUrl = environment.baseUrl;

  displayedColumns: string[] = ['roomName', 'price', 'confidence', 'profit', 'margin', 'recommendation', 'actions'];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private tradingService: TradingService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.loadCities();
    this.loadHotels();
    this.loadOpportunities();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Data Loading ---

  loadCities(): void {
    this.http.get<any>(`${this.baseUrl}ai/cities`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.cities = res.cities || []; },
        error: () => { this.cities = []; }
      });
  }

  loadHotels(): void {
    this.http.get<any>(`${this.baseUrl}ai/hotels`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.hotels = res.hotels || [];
          this.filteredHotels = this.hotels;
        },
        error: () => { this.hotels = []; this.filteredHotels = []; }
      });
  }

  loadOpportunities(): void {
    this.loadingSignals = true;

    this.tradingService.getAISignals(50, 10)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.aiSignals = res.signals || [];
          this.loadingSignals = false;
        },
        error: () => { this.aiSignals = []; this.loadingSignals = false; }
      });

    this.tradingService.getHotDeals(6)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.hotDeals = res.data || []; },
        error: () => { this.hotDeals = []; }
      });
  }

  // --- City/Hotel Selection ---

  onCityChange(city: string | null): void {
    this.selectedCity = city;
    this.filteredHotels = city
      ? this.hotels.filter(h => h.cityName === city)
      : this.hotels;
    this.searchForm.patchValue({ hotelId: '' });
  }

  onHotelChange(hotelId: number): void {
    this.searchForm.patchValue({ hotelId });
  }

  // --- Form ---

  initForm(): void {
    const today = new Date();
    const defaultCheckIn = new Date(today);
    defaultCheckIn.setDate(today.getDate() + 30);
    const defaultCheckOut = new Date(defaultCheckIn);
    defaultCheckOut.setDate(defaultCheckIn.getDate() + 2);

    this.searchForm = this.fb.group({
      hotelId: [''],
      checkIn: [defaultCheckIn, Validators.required],
      checkOut: [defaultCheckOut, Validators.required],
      adults: [2, [Validators.required, Validators.min(1), Validators.max(10)]],
      children: [0, [Validators.min(0), Validators.max(10)]]
    });
  }

  // --- Search ---

  onSearch(): void {
    const formValue = this.searchForm.value;
    const checkIn = this.formatDate(formValue.checkIn);
    const checkOut = this.formatDate(formValue.checkOut);

    if (new Date(checkIn) >= new Date(checkOut)) {
      this.snackBar.open('תאריך צ\'ק-אאוט חייב להיות אחרי תאריך צ\'ק-אין', 'סגור', { duration: 3000 });
      return;
    }

    // If hotel is selected → single hotel search with AI analysis
    if (formValue.hotelId) {
      this.searchHotel(formValue.hotelId, checkIn, checkOut, formValue.adults, formValue.children);
      return;
    }

    // If only city selected → city-wide search
    if (this.selectedCity) {
      this.searchCity(this.selectedCity, checkIn, checkOut, formValue.adults);
      return;
    }

    this.snackBar.open('אנא בחר עיר או מלון לחיפוש', 'סגור', { duration: 3000 });
  }

  private searchHotel(hotelId: number, checkIn: string, checkOut: string, adults: number, children: number): void {
    const request: SearchAnalysisRequest = {
      hotelId: parseInt(String(hotelId), 10),
      checkIn,
      checkOut,
      adults,
      children: children || 0
    };

    this.searchParams = request;
    this.loading = true;
    this.searchResults = [];
    this.cityResults = [];
    this.citySearchMode = false;
    this.hotelAnalytics = null;

    this.tradingService.searchWithAnalysis(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.searchResults && response.searchResults.length > 0) {
            this.searchResults = response.searchResults;
            this.hotelAnalytics = response.hotelAnalytics;
            this.searchToken = `SEARCH-${Date.now()}-${request.hotelId}`;
            this.snackBar.open(`נמצאו ${this.searchResults.length} חדרים זמינים`, 'סגור', { duration: 3000 });
          } else {
            this.snackBar.open('לא נמצאו תוצאות חיפוש', 'סגור', { duration: 3000 });
          }
        },
        error: (error) => {
          this.loading = false;
          this.snackBar.open('שגיאה בחיפוש: ' + (error.error?.message || error.message), 'סגור', { duration: 5000 });
        }
      });
  }

  private searchCity(city: string, checkIn: string, checkOut: string, adults: number): void {
    const request: CitySearchRequest = { city, dateFrom: checkIn, dateTo: checkOut, adults };

    this.loading = true;
    this.searchResults = [];
    this.cityResults = [];
    this.citySearchMode = true;
    this.hotelAnalytics = null;

    this.tradingService.searchByCity(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          const results = response.results || response.data || [];
          if (results.length > 0) {
            this.cityResults = results;
            this.snackBar.open(`נמצאו ${results.length} תוצאות ב-${city}`, 'סגור', { duration: 3000 });
          } else {
            this.snackBar.open(`לא נמצאו תוצאות ב-${city}`, 'סגור', { duration: 3000 });
          }
        },
        error: (error) => {
          this.loading = false;
          this.snackBar.open('שגיאה בחיפוש: ' + (error.error?.message || error.message), 'סגור', { duration: 5000 });
        }
      });
  }

  // --- Buy ---

  onBuyNow(room: RoomResult): void {
    if (!this.searchToken || !this.searchParams) {
      this.snackBar.open('אנא בצע חיפוש מחדש', 'סגור', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(BuyConfirmationDialogComponent, {
      width: '600px',
      data: { room, hotelAnalytics: this.hotelAnalytics, searchParams: this.searchParams }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.confirmed) {
        this.executeBuy(room, result.guestInfo);
      }
    });
  }

  private executeBuy(room: RoomResult, guestInfo: any): void {
    const buyRequest: QuickBuyRequest = {
      searchToken: this.searchToken,
      roomId: room.roomId,
      hotelId: this.searchParams.hotelId,
      checkIn: this.searchParams.checkIn,
      checkOut: this.searchParams.checkOut,
      guest: {
        firstName: guestInfo.firstName,
        lastName: guestInfo.lastName,
        email: guestInfo.email,
        phone: guestInfo.phone
      },
      expectedPrice: room.price,
      suggestedSellPrice: room.aiAnalysis.suggestedSellPrice
    };

    this.loading = true;

    this.tradingService.quickBuy(buyRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.loading = false;
          if (result.success && result.booking) {
            this.snackBar.open(`רכישה הושלמה! מספר הזמנה: ${result.booking.confirmationNumber}`, 'סגור', { duration: 5000 });
            this.searchResults = [];
            this.hotelAnalytics = null;
          } else {
            this.snackBar.open('הרכישה נכשלה: ' + (result.error || 'שגיאה לא ידועה'), 'סגור', { duration: 5000 });
          }
        },
        error: (error) => {
          this.loading = false;
          this.snackBar.open('שגיאה ברכישה: ' + (error.error?.message || error.message), 'סגור', { duration: 5000 });
        }
      });
  }

  // --- Helpers ---

  getConfidenceColor(confidence: number): string {
    return this.tradingService.getConfidenceBadgeColor(confidence);
  }

  getRecommendationColor(recommendation: string): string {
    switch (recommendation) {
      case 'STRONG BUY': return 'primary';
      case 'BUY': return 'accent';
      case 'CONSIDER': return 'warn';
      default: return 'basic';
    }
  }

  getSignalColor(type: string): string {
    switch (type) {
      case 'BUY': return '#4caf50';
      case 'CONSIDER': return '#ff9800';
      case 'WATCH': return '#2196f3';
      default: return '#9e9e9e';
    }
  }

  formatCurrency(amount: number): string {
    if (!amount && amount !== 0) return '€0.00';
    return this.tradingService.formatCurrency(amount);
  }

  formatDate(date: Date | string): string {
    if (typeof date === 'string') return date;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatShortDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  canSearch(): boolean {
    return !this.loading && (!!this.searchForm.value.hotelId || !!this.selectedCity);
  }

  clearSearch(): void {
    this.searchResults = [];
    this.cityResults = [];
    this.citySearchMode = false;
    this.hotelAnalytics = null;
    this.searchToken = '';
    this.searchParams = null;
  }
}
