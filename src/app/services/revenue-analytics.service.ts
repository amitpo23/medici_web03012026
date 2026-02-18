import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from 'src/app/environments/environment';

export interface KPIs {
  current: {
    bookings: number;
    revenue: number;
    cost: number;
    profit: number;
    avg_booking_value: number;
    avg_profit_per_booking: number;
    profit_margin: number;
  };
  previous: {
    bookings: number;
    revenue: number;
    profit: number;
  };
  growth: {
    bookings: number;
    revenue: number;
    profit: number;
  };
}

export interface DailySummary {
  date: Date;
  bookings_count: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  avg_profit_per_booking: number;
  profit_margin_percent: number;
}

export interface RevenueBreakdown {
  city?: string;
  hotel?: string;
  supplier?: string;
  bookings_count: number;
  total_revenue: number;
  total_cost?: number;
  total_profit: number;
  avg_profit: number;
  profit_margin: number;
}

export interface Forecast {
  forecast_days: number;
  forecasted_revenue: number;
  forecasted_profit: number;
  forecasted_bookings: number;
  confidence: 'low' | 'medium' | 'high';
  based_on_days: number;
  daily_averages: {
    revenue: number;
    profit: number;
    bookings: number;
  };
}

export interface TopPerformer {
  name: string;
  type: 'city' | 'hotel';
  total_profit: number;
  bookings: number;
}

export interface RevenueTrend {
  period: string;
  revenue: number;
  profit: number;
  bookings: number;
  avg_booking_value: number;
}

@Injectable({
  providedIn: 'root'
})
export class RevenueAnalyticsService {
  private apiUrl = `${environment.baseUrl}revenue-analytics`;

  constructor(private http: HttpClient) {}

  /**
   * Get KPIs
   */
  getKPIs(days: number = 30): Observable<KPIs> {
    return this.http.get<any>(`${this.apiUrl}/kpis?days=${days}`).pipe(
      switchMap(response => [response.kpis])
    );
  }

  /**
   * Get daily summary
   */
  getDailySummary(days: number = 30): Observable<DailySummary[]> {
    return this.http.get<any>(`${this.apiUrl}/daily?days=${days}`).pipe(
      switchMap(response => [response.summary])
    );
  }

  /**
   * Get revenue by city
   */
  getRevenueByCity(days: number = 30): Observable<RevenueBreakdown[]> {
    return this.http.get<any>(`${this.apiUrl}/by-city?days=${days}`).pipe(
      switchMap(response => [response.breakdown])
    );
  }

  /**
   * Get revenue by hotel
   */
  getRevenueByHotel(days: number = 30): Observable<RevenueBreakdown[]> {
    return this.http.get<any>(`${this.apiUrl}/by-hotel?days=${days}`).pipe(
      switchMap(response => [response.breakdown])
    );
  }

  /**
   * Get revenue by supplier
   */
  getRevenueBySupplier(days: number = 30): Observable<RevenueBreakdown[]> {
    return this.http.get<any>(`${this.apiUrl}/by-supplier?days=${days}`).pipe(
      switchMap(response => [response.breakdown])
    );
  }

  /**
   * Get forecast
   */
  getForecast(days: number = 7): Observable<Forecast> {
    return this.http.get<any>(`${this.apiUrl}/forecast?days=${days}`).pipe(
      switchMap(response => [response.forecast])
    );
  }

  /**
   * Get top performers
   */
  getTopPerformers(days: number = 30, limit: number = 5): Observable<TopPerformer[]> {
    return this.http.get<any>(`${this.apiUrl}/top-performers?days=${days}&limit=${limit}`).pipe(
      switchMap(response => [response.performers])
    );
  }

  /**
   * Get trends
   */
  getTrends(days: number = 30, period: 'daily' | 'hourly' = 'daily'): Observable<RevenueTrend[]> {
    return this.http.get<any>(`${this.apiUrl}/trends?days=${days}&period=${period}`).pipe(
      switchMap(response => [response.trends])
    );
  }

  /**
   * Get comprehensive summary
   */
  getSummary(days: number = 30): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/summary?days=${days}`).pipe(
      switchMap(response => [response.summary])
    );
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  /**
   * Get growth color
   */
  getGrowthColor(value: number): string {
    if (value > 0) return '#4caf50';
    if (value < 0) return '#f44336';
    return '#757575';
  }

  /**
   * Get growth icon (Material icon name)
   */
  getGrowthIcon(value: number): string {
    if (value > 0) return 'trending_up';
    if (value < 0) return 'trending_down';
    return 'trending_flat';
  }

  /**
   * Get confidence color
   */
  getConfidenceColor(confidence: string): string {
    const colors: { [key: string]: string } = {
      'high': '#4caf50',
      'medium': '#ff9800',
      'low': '#f44336'
    };
    return colors[confidence] || '#757575';
  }

  /**
   * Format confidence text
   */
  formatConfidence(confidence: string): string {
    const texts: { [key: string]: string } = {
      'high': 'גבוהה',
      'medium': 'בינונית',
      'low': 'נמוכה'
    };
    return texts[confidence] || confidence;
  }
}
