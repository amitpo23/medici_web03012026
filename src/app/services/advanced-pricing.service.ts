import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdvancedPricingService {
  private baseUrl = `${environment.baseUrl}pricing`;

  constructor(private http: HttpClient) {}

  // =========================================================================
  // Analytics Endpoints (pricing-analytics.js)
  // =========================================================================

  /**
   * GET /pricing/analytics/ab-tests
   * Get A/B test results and analysis
   */
  getABTests(params?: {
    testType?: string;
    strategy?: string;
    days?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.testType) {
      httpParams = httpParams.set('testType', params.testType);
    }
    if (params?.strategy) {
      httpParams = httpParams.set('strategy', params.strategy);
    }
    if (params?.days) {
      httpParams = httpParams.set('days', params.days.toString());
    }
    return this.http.get(`${this.baseUrl}/analytics/ab-tests`, { params: httpParams });
  }

  /**
   * GET /pricing/analytics/strategy-comparison
   * Compare performance of different pricing strategies
   */
  getStrategyComparison(params?: {
    days?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.days) {
      httpParams = httpParams.set('days', params.days.toString());
    }
    return this.http.get(`${this.baseUrl}/analytics/strategy-comparison`, { params: httpParams });
  }

  /**
   * GET /pricing/analytics/adjustments
   * Analyze price adjustment patterns and effectiveness
   */
  getAdjustments(params?: {
    days?: number;
    reason?: string;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.days) {
      httpParams = httpParams.set('days', params.days.toString());
    }
    if (params?.reason) {
      httpParams = httpParams.set('reason', params.reason);
    }
    return this.http.get(`${this.baseUrl}/analytics/adjustments`, { params: httpParams });
  }

  /**
   * GET /pricing/analytics/revenue-optimization
   * Revenue optimization insights and recommendations
   */
  getRevenueOptimization(params?: {
    days?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.days) {
      httpParams = httpParams.set('days', params.days.toString());
    }
    return this.http.get(`${this.baseUrl}/analytics/revenue-optimization`, { params: httpParams });
  }

  /**
   * GET /pricing/analytics/trends
   * Price and performance trends over time
   */
  getTrends(params?: {
    days?: number;
    granularity?: string;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.days) {
      httpParams = httpParams.set('days', params.days.toString());
    }
    if (params?.granularity) {
      httpParams = httpParams.set('granularity', params.granularity);
    }
    return this.http.get(`${this.baseUrl}/analytics/trends`, { params: httpParams });
  }

  /**
   * POST /pricing/analytics/run-metrics
   * Manually trigger daily metrics calculation
   */
  runMetrics(date?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/analytics/run-metrics`, { date });
  }

  // =========================================================================
  // Advanced Pricing V2 Endpoints (advanced-pricing.js)
  // =========================================================================

  /**
   * POST /pricing/v2/ml-predict
   * ML-based price prediction
   */
  mlPredict(body: {
    hotelId: number;
    checkIn: string;
    checkOut: string;
    buyPrice: number;
    roomType?: string;
    leadTimeDays?: number;
    currentDemand?: number;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/v2/ml-predict`, body);
  }

  /**
   * POST /pricing/v2/ml-batch
   * Batch ML predictions
   */
  mlBatchPredict(opportunities: any[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/v2/ml-batch`, { opportunities });
  }

  /**
   * GET /pricing/v2/elasticity/:hotelId
   * Calculate price elasticity for a hotel
   */
  getElasticity(hotelId: number, params?: {
    timeframe?: number;
    minDataPoints?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.timeframe) {
      httpParams = httpParams.set('timeframe', params.timeframe.toString());
    }
    if (params?.minDataPoints) {
      httpParams = httpParams.set('minDataPoints', params.minDataPoints.toString());
    }
    return this.http.get(`${this.baseUrl}/v2/elasticity/${hotelId}`, { params: httpParams });
  }

  /**
   * POST /pricing/v2/elasticity/recommend
   * Elasticity-based price recommendation
   */
  getElasticityRecommendation(body: {
    hotelId: number;
    currentPrice: number;
    targetMetric?: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/v2/elasticity/recommend`, body);
  }

  /**
   * GET /pricing/v2/elasticity/:hotelId/segments
   * Segment elasticity analysis
   */
  getSegmentElasticity(hotelId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/v2/elasticity/${hotelId}/segments`);
  }

  /**
   * GET /pricing/v2/competitor/:hotelId/changes
   * Track competitor pricing changes
   */
  getCompetitorChanges(hotelId: number, params?: {
    daysBack?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.daysBack) {
      httpParams = httpParams.set('daysBack', params.daysBack.toString());
    }
    return this.http.get(`${this.baseUrl}/v2/competitor/${hotelId}/changes`, { params: httpParams });
  }

  /**
   * POST /pricing/v2/competitor/position
   * Analyze competitive position
   */
  getCompetitivePosition(body: {
    hotelId: number;
    ourPrice: number;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/v2/competitor/position`, body);
  }

  /**
   * POST /pricing/v2/competitor/response-strategy
   * Recommend response to competitor action
   */
  getResponseStrategy(body: {
    hotelId: number;
    competitorChange: any;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/v2/competitor/response-strategy`, body);
  }

  /**
   * GET /pricing/v2/competitor/:hotelId/new
   * Detect new competitors
   */
  getNewCompetitors(hotelId: number, params?: {
    daysBack?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.daysBack) {
      httpParams = httpParams.set('daysBack', params.daysBack.toString());
    }
    return this.http.get(`${this.baseUrl}/v2/competitor/${hotelId}/new`, { params: httpParams });
  }

  /**
   * GET /pricing/v2/competitor/:hotelId/market-share
   * Calculate market share trends
   */
  getMarketShare(hotelId: number, params?: {
    weeks?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.weeks) {
      httpParams = httpParams.set('weeks', params.weeks.toString());
    }
    return this.http.get(`${this.baseUrl}/v2/competitor/${hotelId}/market-share`, { params: httpParams });
  }

  /**
   * POST /pricing/v2/revenue/maximize
   * Calculate revenue-maximizing price
   */
  maximizeRevenue(body: {
    hotelId: number;
    checkIn: string;
    checkOut: string;
    buyPrice: number;
    availableInventory?: number;
    currentDemand?: number;
    competitorPrices?: number[];
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/v2/revenue/maximize`, body);
  }

  /**
   * POST /pricing/v2/revenue/optimize-portfolio
   * Optimize opportunity portfolio
   */
  optimizePortfolio(body: {
    opportunities: any[];
    constraints?: any;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/v2/revenue/optimize-portfolio`, body);
  }

  /**
   * GET /pricing/v2/revenue/:hotelId/yield-management
   * Yield management analysis
   */
  getYieldManagement(hotelId: number, params?: {
    timeHorizon?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.timeHorizon) {
      httpParams = httpParams.set('timeHorizon', params.timeHorizon.toString());
    }
    return this.http.get(`${this.baseUrl}/v2/revenue/${hotelId}/yield-management`, { params: httpParams });
  }
}
