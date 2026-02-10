import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface LogFile {
  name: string;
  size: string;
  modified: string;
  type: 'http' | 'error' | 'debug' | 'application';
}

export interface LogEntry {
  level?: string;
  message: string;
  timestamp: string;
  method?: string;
  url?: string;
  status?: number;
  responseTime?: string;
  ip?: string;
  requestId?: string;
  raw?: string;
  [key: string]: any;
}

export interface LogSearchParams {
  query?: string;
  level?: 'info' | 'warn' | 'error';
  startDate?: string;
  endDate?: string;
  hotelName?: string;
  bookingId?: string;
  source?: string;
  limit?: number;
}

export interface LogStats {
  totalRequests: number;
  errorCount: number;
  errorRate: string;
  avgResponseTime: string;
  slowestRequest?: {
    url: string;
    responseTime: string;
  };
  statusCodes?: {
    [key: string]: number;
  };
}

export interface ChartData {
  timeSeries: Array<{
    hour: string;
    requests: number;
    errors: number;
    avgResponseTime: number;
  }>;
  statusDistribution: { [key: string]: number };
  levelDistribution: { [key: string]: number };
  methodDistribution: { [key: string]: number };
  responseTimeDistribution: { [key: string]: number };
}

@Injectable({
  providedIn: 'root'
})
export class LogsService {
  private readonly apiUrl = `${environment.baseUrl}logs`;

  constructor(private http: HttpClient) {}

  /**
   * Get list of all log files
   */
  getLogFiles(): Observable<{ success: boolean; files: LogFile[]; count: number }> {
    return this.http.get<any>(this.apiUrl);
  }

  /**
   * Get specific log file content
   */
  getLogFile(filename: string, lines: number = 100, search?: string): Observable<{ 
    success: boolean; 
    filename: string;
    totalLines: number;
    filteredLines: number;
    returnedLines: number;
    lines: LogEntry[] 
  }> {
    let params = new HttpParams().set('lines', lines.toString());
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<any>(`${this.apiUrl}/${filename}`, { params });
  }

  /**
   * Tail log file (get last N lines efficiently)
   */
  tailLogFile(filename: string, lines: number = 50): Observable<{
    filename: string;
    lines: LogEntry[];
  }> {
    const params = new HttpParams().set('lines', lines.toString());
    return this.http.get<any>(`${this.apiUrl}/tail/${filename}`, { params });
  }

  /**
   * Search across all log files
   */
  searchLogs(searchParams: LogSearchParams): Observable<{
    success: boolean;
    results: LogEntry[];
    count: number;
  }> {
    return this.http.post<any>(`${this.apiUrl}/search`, searchParams);
  }

  /**
   * Get log statistics
   */
  getStats(): Observable<{
    success: boolean;
    stats: LogStats;
  }> {
    return this.http.get<any>(`${this.apiUrl}/stats/summary`);
  }

  /**
   * Get chart data for log visualization
   */
  getChartData(hours: number = 24): Observable<{
    success: boolean;
    period: string;
    charts: ChartData;
  }> {
    const params = new HttpParams().set('hours', hours.toString());
    return this.http.get<any>(`${this.apiUrl}/analytics/charts`, { params });
  }

  /**
   * Cleanup old logs
   */
  cleanupLogs(days: number): Observable<{
    success: boolean;
    deletedFiles: string[];
  }> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.delete<any>(`${this.apiUrl}/cleanup`, { params });
  }

  /**
   * Parse log entry to extract useful information
   */
  parseLogEntry(entry: LogEntry): {
    isError: boolean;
    isSlow: boolean;
    statusClass: string;
    icon: string;
  } {
    const isError = entry.level === 'error' || 
                    (entry.status && entry.status >= 400);
    
    const responseTimeMs = entry.responseTime ? 
      parseInt(entry.responseTime.replace('ms', '')) : 0;
    const isSlow = responseTimeMs > 2000;

    let statusClass = 'success';
    let icon = '✓';

    if (entry.status) {
      if (entry.status >= 500) {
        statusClass = 'error';
        icon = '✗';
      } else if (entry.status >= 400) {
        statusClass = 'warning';
        icon = '⚠';
      } else if (entry.status >= 300) {
        statusClass = 'redirect';
        icon = '↗';
      }
    } else if (isError) {
      statusClass = 'error';
      icon = '✗';
    }

    return { isError: !!isError, isSlow: !!isSlow, statusClass, icon };
  }

  /**
   * Format timestamp to readable format
   */
  formatTimestamp(timestamp: string): string {
    try {
      return new Date(timestamp).toLocaleString('he-IL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  }

  /**
   * Get color for log level
   */
  getLevelColor(level: string): string {
    switch (level?.toLowerCase()) {
      case 'error': return '#e74c3c';
      case 'warn': return '#f39c12';
      case 'info': return '#3498db';
      case 'debug': return '#95a5a6';
      default: return '#2c3e50';
    }
  }

  /**
   * Get HTTP method color
   */
  getMethodColor(method: string): string {
    switch (method?.toUpperCase()) {
      case 'GET': return '#3498db';
      case 'POST': return '#27ae60';
      case 'PUT': return '#f39c12';
      case 'PATCH': return '#9b59b6';
      case 'DELETE': return '#e74c3c';
      default: return '#95a5a6';
    }
  }
}
