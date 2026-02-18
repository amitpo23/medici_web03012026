import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

export interface AIOpportunity {
  type: 'BUY' | 'SELL' | 'HOLD';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  hotelId?: number;
  hotelName?: string;
  cityName?: string;
  action: string;
  reason: string;
  confidence: number;
  currentPrice?: number;
  targetPrice?: number;
  expectedProfit?: number;
  profitMargin?: number;
  roi?: number;
  buyPrice?: number;
  estimatedSellPrice?: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  validUntil?: string;
  details?: any;
  startDate?: string;
  endDate?: string;
  formattedDate?: string;
  rank?: number;
  checkIn?: string;
  checkOut?: string;
}

export interface AgentAnalysis {
  agentId: string;
  name: string;
  status: string;
  confidence: number;
  recommendation: string;
  insights: string[];
}

export interface AIAnalysisResult {
  success: boolean;
  timestamp: string;
  parameters: any;
  agentResults: { [key: string]: any };
  synthesis: {
    recommendation: string;
    confidence: number;
    riskLevel: string;
    consensus: number;
    actionPlan: {
      action: string;
      reason: string;
      priority: string;
    }[];
    executiveSummary: string;
  };
}

export interface City {
  cityName: string;
  count?: number;
}

export interface Hotel {
  hotelId: number;
  hotelName: string;
  cityName?: string;
  rating?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AIPredictionService {
  private baseUrl = environment.baseUrl;
  
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();
  
  private currentAnalysisSubject = new BehaviorSubject<AIAnalysisResult | null>(null);
  currentAnalysis$ = this.currentAnalysisSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get AI system status
   */
  getStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}ai/status`);
  }

  /**
   * Get available cities
   */
  getCities(): Observable<{ success: boolean; count: number; cities: City[] }> {
    return this.http.get<{ success: boolean; count: number; cities: City[] }>(`${this.baseUrl}ai/cities`);
  }

  /**
   * Get hotels, optionally filtered by city
   */
  getHotels(city?: string): Observable<{ success: boolean; count: number; hotels: Hotel[] }> {
    const params = city ? `?city=${encodeURIComponent(city)}` : '';
    return this.http.get<{ success: boolean; count: number; hotels: Hotel[] }>(`${this.baseUrl}ai/hotels${params}`);
  }

  /**
   * Run full AI analysis
   */
  runAnalysis(options: {
    hotelId?: number;
    city?: string;
    userInstructions?: string;
    riskTolerance?: string;
    futureDays?: number;
  }): Observable<AIAnalysisResult> {
    this.loadingSubject.next(true);
    return new Observable(observer => {
      this.http.post<AIAnalysisResult>(`${this.baseUrl}ai/analyze`, options).subscribe({
        next: (result) => {
          this.currentAnalysisSubject.next(result);
          this.loadingSubject.next(false);
          observer.next(result);
          observer.complete();
        },
        error: (err) => {
          this.loadingSubject.next(false);
          observer.error(err);
        }
      });
    });
  }

  /**
   * Get opportunities
   */
  getOpportunities(options?: {
    hotelId?: number;
    city?: string;
    userInstructions?: string;
    limit?: number;
  }): Observable<{ success: boolean; opportunities: AIOpportunity[] }> {
    if (options) {
      return this.http.post<{ success: boolean; opportunities: AIOpportunity[] }>(`${this.baseUrl}ai/opportunities`, options);
    }
    return this.http.get<{ success: boolean; opportunities: AIOpportunity[] }>(`${this.baseUrl}ai/opportunities`);
  }

  /**
   * Get opportunities with advanced filters
   */
  getOpportunitiesFiltered(options?: {
    hotelId?: number;
    city?: string;
    userInstructions?: string;
    filters?: {
      minProfit?: number;
      minMarginPercent?: number;
      minROI?: number;
      profitRange?: [number, number];
      daysToCheckIn?: number;
      season?: string;
      weekendOnly?: boolean;
      freeCancellationOnly?: boolean;
      isPushed?: boolean;
      isSold?: boolean;
    };
    limit?: number;
  }): Observable<{ success: boolean; opportunities: AIOpportunity[]; appliedFilters?: any }> {
    return this.http.post<{ success: boolean; opportunities: AIOpportunity[]; appliedFilters?: any }>(
      `${this.baseUrl}ai/opportunities/filter`,
      options
    );
  }

  /**
   * Get market analysis
   */
  getMarketAnalysis(type: 'overview' | 'trends' | 'seasonality', options?: { hotelId?: number; city?: string }): Observable<any> {
    const params = new URLSearchParams();
    if (options?.hotelId) params.append('hotelId', options.hotelId.toString());
    if (options?.city) params.append('city', options.city);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.http.get(`${this.baseUrl}ai/market/${type}${queryString}`);
  }

  /**
   * Get demand forecast
   */
  getDemandForecast(options?: { hotelId?: number; city?: string; days?: number }): Observable<any> {
    const params = new URLSearchParams();
    if (options?.hotelId) params.append('hotelId', options.hotelId.toString());
    if (options?.city) params.append('city', options.city);
    if (options?.days) params.append('days', options.days.toString());
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.http.get(`${this.baseUrl}ai/forecast${queryString}`);
  }

  /**
   * Clear analysis cache
   */
  clearCache(): Observable<any> {
    return this.http.post(`${this.baseUrl}ai/clear-cache`, {});
  }

  /**
   * Insert opportunity to database
   * Maps frontend field names to backend InsertOpp expected fields:
   * startDateStr, endDateStr, boardlId, categorylId, buyPrice, pushPrice
   */
  insertOpportunity(opportunity: {
    hotelId: number;
    checkIn: string;
    checkOut: string;
    buyPrice: number;
    sellPrice: number;
    profit: number;
    margin: number;
    confidence: number;
    source: string;
  }): Observable<{ success: boolean; error?: string; opportunityId?: number }> {
    return this.http.post<any>(`${this.baseUrl}Opportunity/InsertOpp`, {
      hotelId: opportunity.hotelId,
      startDateStr: opportunity.checkIn,
      endDateStr: opportunity.checkOut,
      boardlId: 1,
      categorylId: 1,
      buyPrice: opportunity.buyPrice,
      pushPrice: opportunity.sellPrice
    });
  }

  /**   * Push opportunities to Zenith
   */
  pushToZenith(
    opportunityIds: number[],
    action: 'publish' | 'update' | 'close',
    overrides?: {
      pushPrice?: number;
      available?: number;
      mealPlan?: string;
    }
  ): Observable<{
    success: boolean;
    summary?: {
      total: number;
      successful: number;
      failed: number;
      action: string;
    };
    results?: any[];
    errors?: any[];
    error?: string;
    message?: string;
  }> {
    return this.http.post<any>(`${this.baseUrl}ZenithApi/push-batch`, {
      opportunityIds,
      action,
      overrides
    });
  }

  /**   * Get priority color class
   */
  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  }

  /**
   * Get action color class
   */
  getActionClass(type: string): string {
    switch (type) {
      case 'BUY': return 'bg-emerald-500 text-white';
      case 'SELL': return 'bg-red-500 text-white';
      case 'HOLD': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  }

  /**
   * Search city with forward search - checks DB + runs live supplier search
   */
  searchCityWithForwardSearch(cityCode: string, options?: {
    checkInFrom?: string;
    checkInTo?: string;
    nights?: number;
    minProfit?: number;
  }): Observable<{
    success: boolean;
    opportunities: AIOpportunity[];
    fromDb: number;
    fromSearch: number;
    total: number;
  }> {
    return this.http.post<any>(`${this.baseUrl}ai/search-city-forward`, {
      cityCode,
      checkInFrom: options?.checkInFrom || new Date().toISOString().split('T')[0],
      checkInTo: options?.checkInTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      nights: options?.nights || 3,
      minProfit: options?.minProfit || 10
    });
  }

  /**
   * Buy opportunity - Insert to DB via InsertOpp endpoint
   */
  buyOpportunity(opportunity: {
    hotelId: number;
    startDateStr: string;
    endDateStr: string;
    boardlId: number;
    categorylId: number;
    buyPrice: number;
    pushPrice: number;
  }): Observable<{ success: boolean; opportunityId?: number; id?: number; error?: string }> {
    return this.http.post<any>(`${this.baseUrl}Opportunity/InsertOpp`, opportunity);
  }

  /**
   * Get risk color class
   */
  getRiskClass(risk: string): string {
    switch (risk) {
      case 'LOW': return 'text-green-600 dark:text-green-400';
      case 'MEDIUM': return 'text-yellow-600 dark:text-yellow-400';
      case 'HIGH': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  }
}
