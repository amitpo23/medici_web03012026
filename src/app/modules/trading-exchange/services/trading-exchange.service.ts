import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PriceHistoryResponse,
  OrderBook,
  Portfolio,
  MarketDataResponse,
  AISignalsResponse,
  PerformanceMetrics,
  MarketOverview
} from '../models/trading-exchange.models';

@Injectable({
  providedIn: 'root'
})
export class TradingExchangeService {
  private baseUrl = environment.apiUrl || 'http://localhost:8080';
  private apiUrl = `${this.baseUrl}api/trading-exchange`;

  // Observable for real-time updates
  private refreshTrigger$ = new BehaviorSubject<boolean>(false);
  public refresh$ = this.refreshTrigger$.asObservable();

  constructor(private http: HttpClient) {}

  // Trigger refresh for all subscribers
  triggerRefresh(): void {
    this.refreshTrigger$.next(true);
  }

  // ========================================
  // Price History - OHLC Candlestick Data
  // ========================================
  getPriceHistory(
    hotelId: number,
    timeframe: string = '1D',
    days: number = 90
  ): Observable<PriceHistoryResponse> {
    const params = new HttpParams()
      .set('timeframe', timeframe)
      .set('days', days.toString());

    return this.http.get<PriceHistoryResponse>(
      `${this.apiUrl}/price-history/${hotelId}`,
      { params }
    );
  }

  // ========================================
  // Order Book - Buy/Sell Depth
  // ========================================
  getOrderBook(hotelId: number, levels: number = 10): Observable<OrderBook> {
    const params = new HttpParams().set('levels', levels.toString());

    return this.http.get<OrderBook>(
      `${this.apiUrl}/order-book/${hotelId}`,
      { params }
    );
  }

  // ========================================
  // Portfolio - Holdings & P&L
  // ========================================
  getPortfolio(days: number = 30): Observable<Portfolio> {
    const params = new HttpParams().set('days', days.toString());

    return this.http.get<Portfolio>(`${this.apiUrl}/portfolio`, { params });
  }

  // ========================================
  // Market Data - Real-time Tickers
  // ========================================
  getMarketData(limit: number = 20): Observable<MarketDataResponse> {
    const params = new HttpParams().set('limit', limit.toString());

    return this.http.get<MarketDataResponse>(`${this.apiUrl}/market-data`, { params });
  }

  // ========================================
  // AI Signals - Trading Recommendations
  // ========================================
  getAISignals(
    minConfidence: number = 50,
    limit: number = 50
  ): Observable<AISignalsResponse> {
    const params = new HttpParams()
      .set('minConfidence', minConfidence.toString())
      .set('limit', limit.toString());

    return this.http.get<AISignalsResponse>(`${this.apiUrl}/ai-signals`, { params });
  }

  // ========================================
  // Performance Metrics
  // ========================================
  getPerformanceMetrics(days: number = 30): Observable<PerformanceMetrics> {
    const params = new HttpParams().set('days', days.toString());

    return this.http.get<PerformanceMetrics>(
      `${this.apiUrl}/performance-metrics`,
      { params }
    );
  }

  // ========================================
  // Market Overview - Dashboard Summary
  // ========================================
  getMarketOverview(): Observable<MarketOverview> {
    return this.http.get<MarketOverview>(`${this.apiUrl}/market-overview`);
  }

  // ========================================
  // Opportunities - Available Trading Opportunities
  // ========================================
  getOpportunities(limit: number = 20): Observable<{ data: Record<string, unknown>[] }> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<{ data: Record<string, unknown>[] }>(
      `${this.baseUrl}Opportunity/Opportunities`,
      { params }
    );
  }

  // ========================================
  // Utility Methods
  // ========================================

  formatCurrency(amount: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  getSignalColor(signal: string): string {
    switch (signal) {
      case 'STRONG_BUY':
      case 'BUY':
        return '#4caf50'; // Green
      case 'HOLD':
        return '#ff9800'; // Orange
      case 'WATCH':
      case 'CONSIDER':
        return '#2196f3'; // Blue
      default:
        return '#757575'; // Grey
    }
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 80) return '#4caf50'; // Green
    if (confidence >= 60) return '#8bc34a'; // Light green
    if (confidence >= 40) return '#ff9800'; // Orange
    return '#f44336'; // Red
  }

  getRiskColor(risk: string): string {
    switch (risk?.toUpperCase()) {
      case 'LOW':
        return '#4caf50'; // Green
      case 'MEDIUM':
        return '#ff9800'; // Orange
      case 'HIGH':
        return '#f44336'; // Red
      default:
        return '#757575'; // Grey
    }
  }

  getPnLColor(value: number): string {
    if (value > 0) return '#4caf50'; // Green
    if (value < 0) return '#f44336'; // Red
    return '#757575'; // Grey
  }

  getMarketStatusColor(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return '#4caf50'; // Green
      case 'NORMAL':
        return '#2196f3'; // Blue
      case 'QUIET':
        return '#ff9800'; // Orange
      default:
        return '#757575'; // Grey
    }
  }
}
