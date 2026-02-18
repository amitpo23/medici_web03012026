import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

export interface SearchOverview {
  TotalSearches: number;
  UniqueHotels: number;
  UniqueCities: number;
  FirstSearchDate: string;
  LastSearchDate: string;
  Last7Days: number;
  Last30Days: number;
  ThisMonth: number;
  AvgSearchPrice: number;
}

export interface CitySearchData {
  CityName: string;
  CountryCode: string;
  SearchCount: number;
  Percentage: number;
  AvgPrice: number;
  MinPrice: number;
  MaxPrice: number;
  UniqueHotels: number;
  LastSearched: string;
}

export interface HotelSearchData {
  HotelId: number;
  HotelName: string;
  CityName: string;
  CountryCode: string;
  SearchCount: number;
  Percentage: number;
  AvgPrice: number;
  MinPrice: number;
  MaxPrice: number;
  AvgStars: number;
  LastSearched: string;
}

export interface SearchTrendData {
  Period: string;
  SearchCount: number;
  UniqueHotels: number;
  UniqueCities: number;
  AvgPrice: number;
}

export interface PriceDistribution {
  Currency: string;
  SearchCount: number;
  AvgPrice: number;
  MinPrice: number;
  MaxPrice: number;
  Q1: number;
  Median: number;
  Q3: number;
}

export interface BookingWindowEntry {
  DaysBeforeStay: number;
  SearchCount: number;
  AvgPrice: number;
}

export interface MonthlySeasonalityEntry {
  Month: number;
  MonthName: string;
  SearchCount: number;
  AvgPrice: number;
}

export interface SeasonalityData {
  bookingWindow: BookingWindowEntry[];
  monthlySeasonality: MonthlySeasonalityEntry[];
}

export interface DemandForecastHistorical {
  Month: string;
  SearchCount: number;
  AvgPrice: number;
}

export interface DemandForecast {
  historical: DemandForecastHistorical[];
  forecast?: {
    nextMonthPrediction: number;
    trend: string;
    trendPercent: string;
    avgMonthlySearches: number;
  };
}

export interface RealTimeSearch {
  HotelId: number;
  HotelName: string;
  CityName: string;
  CountryCode: string;
  StayFrom: string;
  StayTo: string;
  PriceAmount: number;
  PriceAmountCurrency: string;
  RoomType: string;
  Board: string;
  Stars: number;
  UpdatedAt: string;
}

export interface ComparisonData {
  searchCount: number;
  bookingCount: number;
  conversionRate: string;
  searchToBookingRatio: string;
}

@Injectable({
  providedIn: 'root'
})
export class SearchIntelligenceService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getOverview(): Observable<{ success: boolean; data: SearchOverview }> {
    return this.http.get<{ success: boolean; data: SearchOverview }>(
      `${this.baseUrl}search-intelligence/overview`
    );
  }

  getTopCities(limit: number = 20): Observable<{ success: boolean; data: CitySearchData[] }> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<{ success: boolean; data: CitySearchData[] }>(
      `${this.baseUrl}search-intelligence/cities`,
      { params }
    );
  }

  getTopHotels(limit: number = 20, city?: string): Observable<{ success: boolean; data: HotelSearchData[] }> {
    let params = new HttpParams().set('limit', limit.toString());
    if (city) {
      params = params.set('city', city);
    }
    return this.http.get<{ success: boolean; data: HotelSearchData[] }>(
      `${this.baseUrl}search-intelligence/hotels`,
      { params }
    );
  }

  getTrends(granularity: 'daily' | 'monthly' | 'yearly' = 'monthly'): Observable<{ success: boolean; data: SearchTrendData[] }> {
    const params = new HttpParams().set('granularity', granularity);
    return this.http.get<{ success: boolean; data: SearchTrendData[] }>(
      `${this.baseUrl}search-intelligence/trends`,
      { params }
    );
  }

  getPrices(): Observable<{ success: boolean; data: PriceDistribution[] }> {
    return this.http.get<{ success: boolean; data: PriceDistribution[] }>(
      `${this.baseUrl}search-intelligence/prices`
    );
  }

  getSeasonality(): Observable<{ success: boolean; data: SeasonalityData }> {
    return this.http.get<{ success: boolean; data: SeasonalityData }>(
      `${this.baseUrl}search-intelligence/seasonality`
    );
  }

  getDemandForecast(city?: string, hotelId?: number): Observable<{ success: boolean; data: DemandForecast }> {
    let params = new HttpParams();
    if (city) {
      params = params.set('city', city);
    }
    if (hotelId) {
      params = params.set('hotelId', hotelId.toString());
    }
    return this.http.get<{ success: boolean; data: DemandForecast }>(
      `${this.baseUrl}search-intelligence/demand-forecast`,
      { params }
    );
  }

  getRealTime(limit: number = 50): Observable<{ success: boolean; data: RealTimeSearch[] }> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<{ success: boolean; data: RealTimeSearch[] }>(
      `${this.baseUrl}search-intelligence/real-time`,
      { params }
    );
  }

  getComparison(city?: string, hotelId?: number): Observable<{ success: boolean; data: ComparisonData }> {
    let params = new HttpParams();
    if (city) {
      params = params.set('city', city);
    }
    if (hotelId) {
      params = params.set('hotelId', hotelId.toString());
    }
    return this.http.get<{ success: boolean; data: ComparisonData }>(
      `${this.baseUrl}search-intelligence/comparison`,
      { params }
    );
  }
}
