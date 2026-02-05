import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface TableInfo {
  TableName: string;
  SchemaName: string;
  RowCount: number;
  SizeMB: number;
}

export interface ColumnInfo {
  columnName: string;
  dataType: string;
  nullable: string;
  maxLength: number | null;
  defaultValue: string | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  tableName: string;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ComprehensiveStats {
  TotalBookings: number;
  ActiveBookings: number;
  SoldBookings: number;
  TotalBookingValue: number;
  TotalOpportunities: number;
  ActiveOpportunities: number;
  TotalHotels: number;
  ActiveHotels: number;
  TotalReservations: number;
  TotalReservationValue: number;
  TotalPreBookings: number;
  TotalCancellations: number;
  TotalDestinations: number;
  TotalDestinationHotels: number;
  QueueItems: number;
  PendingPushes: number;
  PriceUpdates: number;
  BackOfficeOptions: number;
  SalesOrders: number;
  SystemLogs: number;
}

export interface Destination {
  id: number;
  Name: string;
  CountryCode: string;
  Type: string;
  HotelCount: number;
}

export interface QueueItem {
  Id: number;
  Status: string;
  CreatedAt: Date;
  ProcessedAt?: Date;
}

export interface QueueStats {
  Total: number;
  Pending: number;
  Processing: number;
  Completed: number;
  Failed: number;
}

export interface LookupData {
  boards: { BoardId: number; BoardCode: string; Description: string }[];
  categories: { CategoryId: number; Name: string; Description: string; PMS_Code: string }[];
  beddings: { BeddingId: number; Name: string; Description: string }[];
  currencies: { CurrencyId: number; CurrencyCode: string; Description: string }[];
  sources: { Id: number; Name: string; IsAcive: boolean }[];
  confirmations: { ConfirmationId: number; Name: string; Description: string }[];
}

export interface SalesOfficeSummary {
  orders: {
    TotalOrders: number;
    CompletedOrders: number;
    PendingOrders: number;
  };
  bookings: number;
  details: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataExplorerService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  // ============================================
  // TABLE METADATA
  // ============================================

  getAllTables(): Observable<{ success: boolean; tables: TableInfo[] }> {
    return this.http.get<{ success: boolean; tables: TableInfo[] }>(
      `${this.baseUrl}data-explorer/tables`
    );
  }

  getTableSchema(tableName: string): Observable<{ success: boolean; tableName: string; columns: ColumnInfo[] }> {
    return this.http.get<{ success: boolean; tableName: string; columns: ColumnInfo[] }>(
      `${this.baseUrl}data-explorer/schema/${tableName}`
    );
  }

  queryTable<T>(
    tableName: string,
    options: { limit?: number; offset?: number; orderBy?: string; orderDir?: 'ASC' | 'DESC' } = {}
  ): Observable<PaginatedResponse<T>> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.orderBy) params.set('orderBy', options.orderBy);
    if (options.orderDir) params.set('orderDir', options.orderDir);

    return this.http.get<PaginatedResponse<T>>(
      `${this.baseUrl}data-explorer/query/${tableName}?${params.toString()}`
    );
  }

  // ============================================
  // COMPREHENSIVE STATS
  // ============================================

  getComprehensiveStats(): Observable<{ success: boolean; stats: ComprehensiveStats }> {
    return this.http.get<{ success: boolean; stats: ComprehensiveStats }>(
      `${this.baseUrl}data-explorer/comprehensive-stats`
    );
  }

  // ============================================
  // SPECIFIC DATA ENDPOINTS
  // ============================================

  getDestinations(search?: string, limit = 100): Observable<{ success: boolean; destinations: Destination[] }> {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    if (search) params.set('search', search);

    return this.http.get<{ success: boolean; destinations: Destination[] }>(
      `${this.baseUrl}data-explorer/destinations?${params.toString()}`
    );
  }

  getSalesOfficeSummary(): Observable<{ success: boolean; summary: SalesOfficeSummary }> {
    return this.http.get<{ success: boolean; summary: SalesOfficeSummary }>(
      `${this.baseUrl}data-explorer/sales-office/summary`
    );
  }

  getSalesOfficeOrders(limit = 50, status?: string): Observable<{ success: boolean; orders: unknown[] }> {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    if (status) params.set('status', status);

    return this.http.get<{ success: boolean; orders: unknown[] }>(
      `${this.baseUrl}data-explorer/sales-office/orders?${params.toString()}`
    );
  }

  getBackofficeStats(): Observable<{ success: boolean; stats: unknown }> {
    return this.http.get<{ success: boolean; stats: unknown }>(
      `${this.baseUrl}data-explorer/backoffice/stats`
    );
  }

  getQueue(status?: string, limit = 50): Observable<{ success: boolean; queue: QueueItem[]; stats: QueueStats }> {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    if (status) params.set('status', status);

    return this.http.get<{ success: boolean; queue: QueueItem[]; stats: QueueStats }>(
      `${this.baseUrl}data-explorer/queue?${params.toString()}`
    );
  }

  getHotelsToPush(active = true, limit = 50): Observable<{ success: boolean; hotelsToPush: unknown[] }> {
    return this.http.get<{ success: boolean; hotelsToPush: unknown[] }>(
      `${this.baseUrl}data-explorer/hotels-to-push?limit=${limit}&active=${active}`
    );
  }

  getPriceUpdates(hotelId?: number, limit = 100): Observable<{ success: boolean; priceUpdates: unknown[] }> {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    if (hotelId) params.set('hotelId', hotelId.toString());

    return this.http.get<{ success: boolean; priceUpdates: unknown[] }>(
      `${this.baseUrl}data-explorer/price-updates?${params.toString()}`
    );
  }

  getSystemLogs(search?: string, limit = 100): Observable<{ success: boolean; logs: unknown[] }> {
    const params = new URLSearchParams();
    params.set('limit', limit.toString());
    if (search) params.set('search', search);

    return this.http.get<{ success: boolean; logs: unknown[] }>(
      `${this.baseUrl}data-explorer/system-logs?${params.toString()}`
    );
  }

  getLookups(): Observable<{ success: boolean; lookups: LookupData }> {
    return this.http.get<{ success: boolean; lookups: LookupData }>(
      `${this.baseUrl}data-explorer/lookups`
    );
  }

  getUsers(): Observable<{ success: boolean; users: unknown[] }> {
    return this.http.get<{ success: boolean; users: unknown[] }>(
      `${this.baseUrl}data-explorer/users`
    );
  }
}
