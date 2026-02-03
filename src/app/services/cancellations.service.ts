import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CancellationStats {
  totalCancellations: number;
  successfulCancellations: number;
  failedCancellations: number;
  successRate: string;
  autoCancellations: number;
}

export interface Cancellation {
  Id: number;
  DateInsert: string;
  OpportunityId: number;
  BookingId: string;
  CancellationReason?: string;
  ErrorMessage?: string;
  Status: 'SUCCESS' | 'FAILURE';
  Amount: number;
  HotelName: string;
}

export interface CancellationError {
  ErrorType: string;
  Count: number;
  LastOccurrence: string;
}

export interface AutoCancellation {
  opportunityId: number;
  date: string;
  actionType: 'AUTO_CANCELLED' | 'CANCEL_FAILED';
  hotelName: string;
  checkIn: string;
  purchasePrice: number;
  refundAmount: number;
  lostAmount: number;
  cancellationId?: string;
  error?: string;
}

export interface TrendData {
  Date: string;
  Count: number;
}

@Injectable({
  providedIn: 'root'
})
export class CancellationsService {
  private readonly apiUrl = `${environment.baseUrl}/cancellations`;

  constructor(private http: HttpClient) {}

  /**
   * Get overall cancellation statistics
   */
  getStats(days: number = 30): Observable<{ success: boolean; period: string; stats: CancellationStats }> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<any>(`${this.apiUrl}/stats`, { params });
  }

  /**
   * Get recent cancellations
   */
  getRecent(limit: number = 50, status: 'all' | 'success' | 'failure' = 'all'): Observable<{ success: boolean; count: number; cancellations: Cancellation[] }> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('status', status);
    return this.http.get<any>(`${this.apiUrl}/recent`, { params });
  }

  /**
   * Get most common cancellation errors
   */
  getErrors(days: number = 30): Observable<{ success: boolean; period: string; totalUniqueErrors: number; errors: CancellationError[] }> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<any>(`${this.apiUrl}/errors`, { params });
  }

  /**
   * Get auto-cancellation history
   */
  getAutoCancellations(limit: number = 50): Observable<{ success: boolean; count: number; autoCancellations: AutoCancellation[] }> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<any>(`${this.apiUrl}/auto`, { params });
  }

  /**
   * Get full cancellation history for specific opportunity
   */
  getOpportunityHistory(opportunityId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/opportunity/${opportunityId}`);
  }

  /**
   * Get cancellation trends over time
   */
  getTrends(days: number = 30): Observable<{ success: boolean; period: string; trends: { successByDay: TrendData[]; failureByDay: TrendData[] } }> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<any>(`${this.apiUrl}/trends`, { params });
  }
}
