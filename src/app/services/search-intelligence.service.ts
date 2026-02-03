import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

export interface DemandForecast {
  historical: SearchTrendData[];
  forecast: {
    nextMonthPrediction: number;
    trend: string;
    trendPercent: string;
    avgMonthlySearches: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class SearchIntelligenceService {
  private apiUrl = environment.apiUrl || environment.baseUrl;

  constructor(private http: HttpClient) {}

  getOverview(): Observable<{ success: boolean; data: SearchOverview }> {
    return this.http.get<{ success: boolean; data: SearchOverview }>(
      `${this.apiUrl}/search-intelligence/overview`
    );
  }

  getTopCities(limit: number = 10): Observable<{ success: boolean; data: CitySearchData[] }> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<{ success: boolean; data: CitySearchData[] }>(
      `${this.apiUrl}/search-intelligence/cities`,
      { params }
    );
  }

  getTopHotels(limit: number = 10, city?: string): Observable<{ success: boolean; data: HotelSearchData[] }> {
    let params = new HttpParams().set('limit', limit.toString());
    if (city) {
      params = params.set('city', city);
    }
    return this.http.get<{ success: boolean; data: HotelSearchData[] }>(
      `${this.apiUrl}/search-intelligence/hotels`,
      { params }
    );
  }

  getTrends(granularity: 'daily' | 'monthly' | 'yearly' = 'monthly'): Observable<{ success: boolean; data: SearchTrendData[] }> {
    const params = new HttpParams().set('granularity', granularity);
    return this.http.get<{ success: boolean; data: SearchTrendData[] }>(
      `${this.apiUrl}/search-intelligence/trends`,
      { params }
    );
  }

  getDemandForecast(city?: string, hotelId?: number): Observable<{ success: boolean; data: DemandForecast }> {
    let params = new HttpParams();
    if (city) params = params.set('city', city);
    if (hotelId) params = params.set('hotelId', hotelId.toString());
    
    return this.http.get<{ success: boolean; data: DemandForecast }>(
      `${this.apiUrl}/search-intelligence/demand-forecast`,
      { params }
    );
  }

  getComparison(city?: string, hotelId?: number): Observable<{ success: boolean; data: any }> {
    let params = new HttpParams();
    if (city) params = params.set('city', city);
    if (hotelId) params = params.set('hotelId', hotelId.toString());
    
    return this.http.get<{ success: boolean; data: any }>(
      `${this.apiUrl}/search-intelligence/comparison`,
      { params }
    );
  }
}
