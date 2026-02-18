import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/app/environments/environment';

export interface SearchAnalysisRequest {
  hotelId: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
}

export interface AIAnalysis {
  suggestedBuyPrice: number;
  suggestedSellPrice: number;
  expectedProfit: number;
  expectedMargin: number;
  buyConfidence: number;
  recommendation: 'STRONG BUY' | 'BUY' | 'CONSIDER' | 'AVOID';
  reasoning: string;
}

export interface RoomResult {
  roomId: string;
  roomName: string;
  price: number;
  currency: string;
  cancellationPolicy: string;
  aiAnalysis: AIAnalysis;
}

export interface SearchAnalysisResponse {
  searchResults: RoomResult[];
  hotelAnalytics: {
    totalBookings: number;
    avgProfit: number;
    avgMarginPercent: number;
    conversionRate: number;
    searchDemand: number;
  };
}

export interface QuickBuyRequest {
  searchToken: string;
  roomId: string;
  hotelId: number;
  checkIn: string;
  checkOut: string;
  guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  expectedPrice: number;
  suggestedSellPrice: number;
}

export interface BookingResult {
  success: boolean;
  booking?: {
    bookingId: number;
    supplierBookingId: string;
    confirmationNumber: string;
    buyPrice: number;
    sellPrice: number;
    expectedProfit: number;
    marginPercent: number;
    status: string;
  };
  error?: string;
}

export interface InventoryFilters {
  daysToCheckIn?: number;
  minProfit?: number;
  hotelId?: number;
  urgency?: 'high' | 'medium' | 'low';
  sortBy?: 'date' | 'profit' | 'margin' | 'urgency';
}

export interface InventoryItem {
  id: number;
  hotelName: string;
  hotelCity: string;
  buyPrice: number;
  sellPrice: number;
  currentMarketPrice?: number;
  potentialProfit: number;
  marginPercent: number;
  checkIn: string;
  checkOut: string;
  daysUntilCheckIn: number;
  hoursUntilCancelDeadline?: number;
  urgency: 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low';
  suggestedActions: string[];
  roomType: string;
  guests: string;
}

export interface InventoryResponse {
  totalItems: number;
  inventory: InventoryItem[];
  summary: {
    totalPotentialProfit: number;
    avgMargin: number;
    urgentItems: number;
    highRiskItems: number;
  };
}

export interface PriceUpdateRequest {
  bookingId: number;
  newSellPrice: number;
  reason: string;
}

export interface PriceUpdateResult {
  success: boolean;
  message: string;
  booking: {
    bookingId: number;
    oldPrice: number;
    newPrice: number;
    priceChange: number;
    newProfit: number;
    newMargin: number;
  };
  zenithPushQueued: boolean;
}

export interface PriceCheckResult {
  success: boolean;
  booking: {
    bookingId: number;
    originalPrice: number;
    currentMarketPrice: number;
    priceDrop: number;
    priceDropPercent: number;
    sellPrice: number;
    originalProfit: number;
    potentialProfit: number;
  };
  recommendation: string;
}

export interface CitySearchRequest {
  city: string;
  dateFrom: string;
  dateTo: string;
  adults?: number;
  stars?: number;
  limit?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TradingService {
  private apiUrl = `${environment.baseUrl}api/trading`;

  // Observable for inventory updates
  private inventoryUpdated$ = new BehaviorSubject<boolean>(false);
  public inventoryUpdates = this.inventoryUpdated$.asObservable();

  constructor(private http: HttpClient) { }

  getAISignals(minConfidence = 50, limit = 10): Observable<any> {
    const params = new HttpParams()
      .set('minConfidence', minConfidence.toString())
      .set('limit', limit.toString());
    return this.http.get<any>(`${environment.baseUrl}api/trading-exchange/ai-signals`, { params });
  }

  getHotDeals(limit = 6): Observable<any> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<any>(`${environment.baseUrl}api/trading-exchange/HotDeals`, { params });
  }

  searchByCity(request: CitySearchRequest): Observable<any> {
    return this.http.post<any>(`${environment.baseUrl}Search/InnstantPrice`, {
      city: request.city,
      dateFrom: request.dateFrom,
      dateTo: request.dateTo,
      adults: request.adults || 2,
      stars: request.stars,
      limit: request.limit || 50
    });
  }

  searchWithAnalysis(request: SearchAnalysisRequest): Observable<SearchAnalysisResponse> {
    return this.http.post<SearchAnalysisResponse>(`${this.apiUrl}/search-with-analysis`, request);
  }

  /**
   * Quick buy - complete purchase in one call
   */
  quickBuy(request: QuickBuyRequest): Observable<BookingResult> {
    return this.http.post<BookingResult>(`${this.apiUrl}/quick-buy`, request).pipe(
      tap(result => {
        if (result.success) {
          // Notify subscribers that inventory changed
          this.inventoryUpdated$.next(true);
        }
      })
    );
  }

  /**
   * Get active inventory with filters
   */
  getActiveInventory(filters?: InventoryFilters): Observable<InventoryResponse> {
    let params = new HttpParams();
    
    if (filters) {
      if (filters.daysToCheckIn) {
        params = params.set('daysToCheckIn', filters.daysToCheckIn.toString());
      }
      if (filters.minProfit) {
        params = params.set('minProfit', filters.minProfit.toString());
      }
      if (filters.hotelId) {
        params = params.set('hotelId', filters.hotelId.toString());
      }
      if (filters.urgency) {
        params = params.set('urgency', filters.urgency);
      }
      if (filters.sortBy) {
        params = params.set('sortBy', filters.sortBy);
      }
    }

    return this.http.get<InventoryResponse>(`${this.apiUrl}/active-inventory`, { params });
  }

  /**
   * Update sell price for a booking
   */
  updateSellPrice(request: PriceUpdateRequest): Observable<PriceUpdateResult> {
    return this.http.post<PriceUpdateResult>(`${this.apiUrl}/update-sell-price`, request).pipe(
      tap(result => {
        if (result.success) {
          this.inventoryUpdated$.next(true);
        }
      })
    );
  }

  /**
   * Check current market price for a booking
   */
  checkCurrentPrice(bookingId: number): Observable<PriceCheckResult> {
    return this.http.post<PriceCheckResult>(`${this.apiUrl}/check-current-price`, { bookingId }).pipe(
      tap(result => {
        if (result.success) {
          this.inventoryUpdated$.next(true);
        }
      })
    );
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Get confidence badge color
   */
  getConfidenceBadgeColor(confidence: number): string {
    if (confidence >= 80) return 'success';
    if (confidence >= 60) return 'primary';
    if (confidence >= 40) return 'warn';
    return 'accent';
  }

  /**
   * Get urgency badge color
   */
  getUrgencyBadgeColor(urgency: string): string {
    switch (urgency) {
      case 'high': return 'warn';
      case 'medium': return 'accent';
      default: return 'primary';
    }
  }

  /**
   * Get risk badge color
   */
  getRiskBadgeColor(risk: string): string {
    switch (risk) {
      case 'high': return 'warn';
      case 'medium': return 'accent';
      default: return 'success';
    }
  }
}
