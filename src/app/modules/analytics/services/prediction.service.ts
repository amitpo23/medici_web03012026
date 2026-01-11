import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

export interface PricePrediction {
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  recommendation: string;
}

export interface BuySellAlert {
  type: 'buy' | 'sell' | 'warning';
  hotelName: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  suggestedPrice?: number;
  potentialProfit?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PredictionService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  /**
   * חיזוי מחיר עתידי על בסיס היסטוריה
   */
  predictPrice(hotelId: number, dateFrom: string, dateTo: string): Observable<PricePrediction> {
    return this.http.get<any[]>(this.baseUrl + 'Book/Bookings').pipe(
      map(bookings => {
        // Filter relevant bookings
        const relevantBookings = bookings.filter(b => 
          b.HotelId === hotelId && !b.IsCanceled
        );

        if (relevantBookings.length === 0) {
          return {
            currentPrice: 0,
            predictedPrice: 0,
            confidence: 0,
            trend: 'stable' as const,
            recommendation: 'אין מספיק נתונים לחיזוי'
          };
        }

        // Calculate average price and trend
        const prices = relevantBookings.map(b => b.lastPrice || b.pushPrice || b.price);
        const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
        
        // Simple linear regression for trend
        const recentPrices = prices.slice(-10);
        const trend = this.calculateTrend(recentPrices);
        
        // Predict future price
        const seasonalFactor = this.getSeasonalFactor(dateFrom);
        const predictedPrice = avgPrice * (1 + trend) * seasonalFactor;
        
        const confidence = Math.min(95, 50 + (relevantBookings.length * 2));

        return {
          currentPrice: avgPrice,
          predictedPrice: Math.round(predictedPrice),
          confidence,
          trend: trend > 0.05 ? 'up' : trend < -0.05 ? 'down' : 'stable',
          recommendation: this.getRecommendation(trend, seasonalFactor)
        };
      })
    );
  }

  /**
   * קבלת התראות קנייה/מכירה חכמות
   */
  getBuySellAlerts(): Observable<BuySellAlert[]> {
    return this.http.get<any[]>(this.baseUrl + 'Book/Bookings').pipe(
      map(bookings => {
        const alerts: BuySellAlert[] = [];
        const hotelStats = this.groupByHotel(bookings);

        hotelStats.forEach((stats, hotelName) => {
          // Alert for high profit margin opportunities
          if (stats.avgProfitMargin > 30) {
            alerts.push({
              type: 'buy',
              hotelName,
              message: `מרווח רווח גבוה (${stats.avgProfitMargin.toFixed(1)}%) - הזדמנות מעולה!`,
              priority: 'high',
              suggestedPrice: stats.avgCost,
              potentialProfit: stats.avgProfit
            });
          }

          // Alert for declining prices
          if (stats.pricetrend < -0.1) {
            alerts.push({
              type: 'warning',
              hotelName,
              message: 'מחירים יורדים - שקול למכור לפני ירידה נוספת',
              priority: 'medium'
            });
          }

          // Alert for rising demand
          if (stats.recentBookings > stats.avgBookings * 1.5) {
            alerts.push({
              type: 'buy',
              hotelName,
              message: 'ביקוש עולה - זמן טוב לקנייה!',
              priority: 'high'
            });
          }

          // Alert for underpriced opportunities
          if (stats.avgPrice < stats.marketAvg * 0.8) {
            alerts.push({
              type: 'buy',
              hotelName,
              message: 'מחיר מתחת לממוצע השוק - הזדמנות!',
              priority: 'medium',
              suggestedPrice: stats.avgPrice,
              potentialProfit: (stats.marketAvg - stats.avgPrice) * 0.7
            });
          }
        });

        return alerts.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
      })
    );
  }

  /**
   * חישוב ROI צפוי
   */
  calculateROI(investment: number, expectedRevenue: number, days: number): any {
    const profit = expectedRevenue - investment;
    const roi = (profit / investment) * 100;
    const dailyROI = roi / days;
    const annualizedROI = dailyROI * 365;

    return {
      profit,
      roi: roi.toFixed(2),
      dailyROI: dailyROI.toFixed(2),
      annualizedROI: annualizedROI.toFixed(2),
      profitMargin: ((profit / expectedRevenue) * 100).toFixed(2)
    };
  }

  // Helper methods
  private calculateTrend(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const n = prices.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = prices.reduce((sum, p) => sum + p, 0);
    const sumXY = prices.reduce((sum, p, i) => sum + (i * p), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgPrice = sumY / n;
    
    return slope / avgPrice; // Normalized trend
  }

  private getSeasonalFactor(date: string): number {
    const month = new Date(date).getMonth() + 1;
    // Summer months (June-August) - high season
    if (month >= 6 && month <= 8) return 1.3;
    // Winter holidays (December-January) - high season
    if (month === 12 || month === 1) return 1.2;
    // Spring/Fall - medium season
    if (month >= 3 && month <= 5 || month >= 9 && month <= 11) return 1.1;
    // Low season
    return 0.9;
  }

  private getRecommendation(trend: number, seasonalFactor: number): string {
    if (trend > 0.1 && seasonalFactor > 1.2) {
      return '🔥 מומלץ מאוד לקנות! מגמה עולה + עונת שיא';
    } else if (trend > 0.05) {
      return '👍 מומלץ לקנות - מגמת מחירים עולה';
    } else if (trend < -0.05) {
      return '⚠️ המתן לירידה נוספת במחירים';
    } else if (seasonalFactor > 1.2) {
      return '📈 עונת שיא - שקול קנייה מוקדמת';
    }
    return '⏸️ מחירים יציבים - אפשר לחכות';
  }

  private groupByHotel(bookings: any[]): Map<string, any> {
    const hotelStats = new Map();

    bookings.forEach(b => {
      if (!b.HotelName || b.IsCanceled) return;

      if (!hotelStats.has(b.HotelName)) {
        hotelStats.set(b.HotelName, {
          prices: [],
          profits: [],
          costs: [],
          dates: [],
          recentCount: 0
        });
      }

      const stats = hotelStats.get(b.HotelName);
      const price = b.lastPrice || b.pushPrice || b.price;
      const cost = b.price || 0;
      const profit = price - cost;

      stats.prices.push(price);
      stats.profits.push(profit);
      stats.costs.push(cost);
      stats.dates.push(new Date(b.dateInsert));

      // Count recent bookings (last 30 days)
      const daysSince = (Date.now() - new Date(b.dateInsert).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 30) stats.recentCount++;
    });

    // Calculate aggregates
    hotelStats.forEach((stats, hotelName) => {
      stats.avgPrice = stats.prices.reduce((a: number, b: number) => a + b, 0) / stats.prices.length;
      stats.avgCost = stats.costs.reduce((a: number, b: number) => a + b, 0) / stats.costs.length;
      stats.avgProfit = stats.profits.reduce((a: number, b: number) => a + b, 0) / stats.profits.length;
      stats.avgProfitMargin = (stats.avgProfit / stats.avgPrice) * 100;
      stats.avgBookings = stats.prices.length / 12; // Monthly average
      stats.recentBookings = stats.recentCount;
      stats.pricetrend = this.calculateTrend(stats.prices.slice(-10));
      stats.marketAvg = Array.from(hotelStats.values())
        .reduce((sum: number, s: any) => sum + s.avgPrice, 0) / hotelStats.size;
    });

    return hotelStats;
  }
}
