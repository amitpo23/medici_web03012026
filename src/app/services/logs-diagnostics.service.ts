import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

// ==========================================
// Log File Interfaces
// ==========================================

export interface LogFileEntry {
  name: string;
  size: string;
  modified: string;
  type: string;
}

export interface LogFileListResponse {
  success: boolean;
  logsDirectory: string;
  files: LogFileEntry[];
  count: number;
}

export interface LogLineEntry {
  timestamp?: string;
  level?: string;
  message?: string;
  status?: number;
  method?: string;
  url?: string;
  responseTime?: string;
  raw?: string;
  [key: string]: unknown;
}

export interface LogFileViewResponse {
  success: boolean;
  filename: string;
  totalLines: number;
  filteredLines: number;
  returnedLines: number;
  lines: LogLineEntry[];
}

export interface LogTailResponse {
  filename: string;
  lines: LogLineEntry[];
}

export interface LogSearchParams {
  query?: string;
  level?: string;
  startDate?: string;
  endDate?: string;
  hotelName?: string;
  bookingId?: string;
  source?: string;
  limit?: number;
}

export interface LogSearchResultEntry {
  file: string;
  timestamp?: string;
  level?: string;
  message?: string;
  [key: string]: unknown;
}

export interface LogSearchResponse {
  success: boolean;
  query: LogSearchParams;
  results: LogSearchResultEntry[];
  count: number;
}

export interface LogStatsByType {
  count: number;
  size: number;
}

export interface RecentError {
  timestamp: string;
  message: string;
  file: string;
}

export interface LogStatsData {
  totalFiles: number;
  totalSize: string;
  byType: Record<string, LogStatsByType>;
  recentErrors: RecentError[];
}

export interface LogStatsResponse {
  success: boolean;
  stats: LogStatsData;
}

export interface TimeSeriesPoint {
  hour: string;
  requests: number;
  errors: number;
  avgResponseTime: number;
}

export interface ChartsData {
  timeSeries: TimeSeriesPoint[];
  statusDistribution: Record<string, number>;
  levelDistribution: Record<string, number>;
  methodDistribution: Record<string, number>;
  responseTimeDistribution: Record<string, number>;
}

export interface LogChartsResponse {
  success: boolean;
  period: string;
  charts: ChartsData;
}

export interface LogDeleteResponse {
  success: boolean;
  message: string;
}

// ==========================================
// Diagnostics Interfaces
// ==========================================

export interface CancellationSummary {
  totalCancellationAttempts: number;
  successfulCancellations: number;
  failedCancellations: number;
  successRate: number;
  failureRate: number;
  totalErrors: number;
}

export interface TopCancellationError {
  ErrorMessage: string;
  ErrorCount: number;
  Percentage: number;
  FirstOccurrence: string;
  LastOccurrence: string;
}

export interface Recommendation {
  priority: string;
  issue: string;
  recommendation: string;
}

export interface CancellationErrorsResponse {
  summary: CancellationSummary;
  topErrors: TopCancellationError[];
  recommendations: Recommendation[];
}

export interface CancellationErrorDetail {
  Id: number;
  DateInsert: string;
  PreBookId: number;
  contentBookingID: string;
  Error: string;
}

export interface CancellationErrorDetailsResponse {
  success: boolean;
  count: number;
  errors: CancellationErrorDetail[];
}

export interface WorkerStatus {
  status: string;
  lastActivity: string | null;
  healthMessage: string;
  pendingReservations?: number;
  lastUpdateTime?: string | null;
}

export interface WorkerHealthResponse {
  overallHealth: string;
  workers: {
    buyRoomWorker: WorkerStatus;
    priceUpdateWorker: WorkerStatus;
    autoCancelWorker: WorkerStatus;
  };
  timestamp: string;
}

export interface DatabaseHealthResponse {
  status: string;
  connectionTest: boolean;
  responseTime: number;
  timestamp: string;
}

export interface InventoryOverall {
  TotalActiveInventory: number;
  UnsoldRooms: number;
  SoldRooms: number;
  NearingDeadline: number;
  TotalValueAtRisk: number;
  PotentialProfit: number;
}

export interface InventoryByHotel {
  HotelName: string;
  ActiveRooms: number;
  TotalValue: number;
  PotentialProfit: number;
}

export interface InventoryAlert {
  severity: string;
  message: string;
  affectedRooms: number;
  actionRequired: string;
}

export interface InventoryAnalysisResponse {
  overall: InventoryOverall;
  byHotel: InventoryByHotel[];
  alerts: InventoryAlert[];
}

// ==========================================
// Service
// ==========================================

@Injectable({
  providedIn: 'root'
})
export class LogsDiagnosticsService {
  private logsUrl = `${environment.baseUrl}logs`;
  private diagnosticsUrl = `${environment.baseUrl}api/diagnostics`;

  constructor(private http: HttpClient) {}

  // ---- Logs Endpoints ----

  getLogFiles(): Observable<LogFileListResponse> {
    return this.http.get<LogFileListResponse>(this.logsUrl);
  }

  viewLogFile(filename: string, lines?: number, search?: string): Observable<LogFileViewResponse> {
    let params = new HttpParams();
    if (lines !== undefined) {
      params = params.set('lines', lines.toString());
    }
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<LogFileViewResponse>(
      `${this.logsUrl}/${encodeURIComponent(filename)}`,
      { params }
    );
  }

  tailLogFile(filename: string, lines: number = 50): Observable<LogTailResponse> {
    const params = new HttpParams().set('lines', lines.toString());
    return this.http.get<LogTailResponse>(
      `${this.logsUrl}/tail/${encodeURIComponent(filename)}`,
      { params }
    );
  }

  searchLogs(searchParams: LogSearchParams): Observable<LogSearchResponse> {
    return this.http.post<LogSearchResponse>(`${this.logsUrl}/search`, searchParams);
  }

  getLogStats(): Observable<LogStatsResponse> {
    return this.http.get<LogStatsResponse>(`${this.logsUrl}/stats/summary`);
  }

  getLogCharts(hours: number = 24): Observable<LogChartsResponse> {
    const params = new HttpParams().set('hours', hours.toString());
    return this.http.get<LogChartsResponse>(`${this.logsUrl}/analytics/charts`, { params });
  }

  deleteLogFile(filename: string): Observable<LogDeleteResponse> {
    return this.http.delete<LogDeleteResponse>(
      `${this.logsUrl}/${encodeURIComponent(filename)}`
    );
  }

  // ---- Diagnostics Endpoints ----

  getCancellationErrors(): Observable<CancellationErrorsResponse> {
    return this.http.get<CancellationErrorsResponse>(
      `${this.diagnosticsUrl}/cancellation-errors`
    );
  }

  getCancellationErrorDetails(
    limit: number = 50,
    errorMessage?: string
  ): Observable<CancellationErrorDetailsResponse> {
    let params = new HttpParams().set('limit', limit.toString());
    if (errorMessage) {
      params = params.set('errorMessage', errorMessage);
    }
    return this.http.get<CancellationErrorDetailsResponse>(
      `${this.diagnosticsUrl}/cancellation-errors/details`,
      { params }
    );
  }

  getWorkerHealth(): Observable<WorkerHealthResponse> {
    return this.http.get<WorkerHealthResponse>(
      `${this.diagnosticsUrl}/worker-health`
    );
  }

  getDatabaseHealth(): Observable<DatabaseHealthResponse> {
    return this.http.get<DatabaseHealthResponse>(
      `${this.diagnosticsUrl}/database-health`
    );
  }

  getInventoryAnalysis(): Observable<InventoryAnalysisResponse> {
    return this.http.get<InventoryAnalysisResponse>(
      `${this.diagnosticsUrl}/inventory-analysis`
    );
  }
}
