import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface CancellationError {
  ErrorMessage: string;
  ErrorCount: number;
  Percentage: number;
  AvgDaysBeforeCheckIn: number;
  TotalAmountAtRisk: number;
}

export interface CancellationErrorSummary {
  summary: {
    totalCancellationAttempts: number;
    successfulCancellations: number;
    failedCancellations: number;
    successRate: number;
    failureRate: number;
    totalAmountAtRisk: number;
  };
  topErrors: CancellationError[];
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    issue: string;
    recommendation: string;
  }>;
}

export interface WorkerStatus {
  status: 'healthy' | 'warning' | 'critical';
  lastActivity: string | null;
  pendingReservations?: number;
  lastUpdateTime?: string | null;
  lastProcessedBooking?: number;
  healthMessage: string;
}

export interface WorkerHealthResponse {
  overallHealth: 'healthy' | 'warning' | 'critical';
  workers: {
    buyRoomWorker: WorkerStatus;
    priceUpdateWorker: WorkerStatus;
    autoCancelWorker: WorkerStatus;
  };
  timestamp: string;
}

export interface DatabaseHealthResponse {
  status: 'healthy' | 'degraded' | 'critical';
  connectionTest: boolean;
  responseTime: number;
  timestamp: string;
}

export interface InventoryAnalysis {
  overall: {
    TotalActiveInventory: number;
    UnsoldRooms: number;
    SoldRooms: number;
    NearingDeadline: number;
    TotalValueAtRisk: number;
    PotentialProfit: number;
  };
  byHotel: Array<{
    HotelName: string;
    ActiveRooms: number;
    TotalValue: number;
    PotentialProfit: number;
  }>;
  alerts: Array<{
    severity: 'critical' | 'warning' | 'info';
    message: string;
    affectedRooms: number;
    actionRequired: string;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class DiagnosticsService {
  private apiUrl = '/api/diagnostics';

  constructor(private http: HttpClient) { }

  /**
   * Get cancellation error analysis
   */
  getCancellationErrors(): Observable<CancellationErrorSummary> {
    return this.http.get<CancellationErrorSummary>(`${this.apiUrl}/cancellation-errors`);
  }

  /**
   * Get detailed cancellation errors with filters
   */
  getCancellationErrorDetails(errorMessage?: string, limit: number = 50): Observable<any> {
    let url = `${this.apiUrl}/cancellation-errors/details?limit=${limit}`;
    if (errorMessage) {
      url += `&errorMessage=${encodeURIComponent(errorMessage)}`;
    }
    return this.http.get(url);
  }

  /**
   * Get worker health status
   */
  getWorkerHealth(): Observable<WorkerHealthResponse> {
    return this.http.get<WorkerHealthResponse>(`${this.apiUrl}/worker-health`);
  }

  /**
   * Get database health
   */
  getDatabaseHealth(): Observable<DatabaseHealthResponse> {
    return this.http.get<DatabaseHealthResponse>(`${this.apiUrl}/database-health`);
  }

  /**
   * Get inventory analysis
   */
  getInventoryAnalysis(): Observable<InventoryAnalysis> {
    return this.http.get<InventoryAnalysis>(`${this.apiUrl}/inventory-analysis`);
  }

  /**
   * Format large numbers
   */
  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Get health status color
   */
  getHealthColor(status: string): string {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warn';
      case 'critical': return 'error';
      default: return 'primary';
    }
  }

  /**
   * Get severity color
   */
  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warn';
      case 'info': return 'primary';
      default: return 'accent';
    }
  }
}
