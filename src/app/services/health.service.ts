import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

export interface BasicHealth {
  status: string;
  uptime: number;
  timestamp: string;
}

export interface DeepHealth {
  status: string;
  checks: Record<string, { status: string; responseTime?: number; message?: string }>;
  timestamp: string;
}

export interface HealthMetrics {
  totalRequests: number;
  errorRate: number;
  avgLatency: number;
  uptime: number;
  requestsPerMinute: number;
  statusCodes: Record<string, number>;
}

export interface OperationalMode {
  mode: string;
  validModes: string[];
  description: Record<string, string>;
}

export interface SupplierStats {
  success: boolean;
  suppliers: Record<string, { available: boolean; configured: boolean }>;
  timestamp: string;
}

export interface CacheStats {
  success: boolean;
  cache: Record<string, unknown>;
  timestamp: string;
}

export interface WorkerActivity {
  action: string;
  timestamp: string;
  details: Record<string, unknown> | null;
}

export interface WorkerStatus {
  success: boolean;
  workers: {
    buyroom: { recentActivity: WorkerActivity[] };
    cancellation: { recentActivity: WorkerActivity[] };
    priceUpdate: {
      pushStats: Array<Record<string, unknown>>;
      queueStatus: Record<string, unknown>;
    };
  };
  timestamp: string;
}

export interface WorkerSummary {
  success: boolean;
  period: string;
  summary: {
    buyroom: { totalAttempts: number; successful: number; failed: number; successRate: string };
    cancellation: { totalCancellations: number };
    priceUpdate: { totalPushes: number; successful: number; failed: number; successRate: string; avgProcessingTime: string };
    queue: { pendingItems: number; status: string };
  };
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class HealthService {
  private apiUrl = `${environment.baseUrl}health`;

  constructor(private http: HttpClient) {}

  getBasicHealth(): Observable<BasicHealth> {
    return this.http.get<BasicHealth>(`${this.apiUrl}`);
  }

  getDeepHealth(): Observable<DeepHealth> {
    return this.http.get<DeepHealth>(`${this.apiUrl}/deep`);
  }

  getMetrics(): Observable<HealthMetrics> {
    return this.http.get<HealthMetrics>(`${this.apiUrl}/metrics`);
  }

  resetMetrics(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/metrics/reset`, {});
  }

  getOperationalMode(): Observable<OperationalMode> {
    return this.http.get<OperationalMode>(`${this.apiUrl}/mode`);
  }

  getSupplierStatus(): Observable<SupplierStats> {
    return this.http.get<SupplierStats>(`${this.apiUrl}/suppliers`);
  }

  getCacheStats(): Observable<CacheStats> {
    return this.http.get<CacheStats>(`${this.apiUrl}/cache`);
  }

  getWorkerStatus(): Observable<WorkerStatus> {
    return this.http.get<WorkerStatus>(`${this.apiUrl}/workers`);
  }

  getWorkerSummary(): Observable<WorkerSummary> {
    return this.http.get<WorkerSummary>(`${this.apiUrl}/workers/summary`);
  }
}
