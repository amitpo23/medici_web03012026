import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

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
  HotelCount: number;
}

export interface QueueItem {
  Id: number;
  Status: string;
  CreatedAt: string;
  ProcessedAt?: string;
}

export interface QueueStats {
  Total: number;
  Pending: number;
  Processing: number;
  Completed: number;
  Failed: number;
}

export interface QueueResponse {
  success: boolean;
  queue: QueueItem[];
  stats: QueueStats;
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

export interface BackofficeStats {
  options: {
    TotalOpts: number;
    ActiveOpts: number;
  };
  topActions: { ActionType: string; Count: number }[];
}

export interface UserInfo {
  userid: number;
  username: string;
  IsActive: boolean;
  AetherTokenStorageId: string | null;
}

export interface HotelToPush {
  BookId: number;
  OpportunityId: number;
  IsActive: boolean;
  DateInsert: string;
  HotelName: string;
  BookingPrice: number;
  BookingStatus: string;
}

export interface PriceUpdate {
  Id: number;
  HotelId: number;
  OldPrice: number;
  NewPrice: number;
  UpdateDate: string;
}

export interface SystemLog {
  LogID: number;
  Message: string;
  LogDate: string;
  LogLevel: string;
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
      `${this.baseUrl}data-explorer/schema/${encodeURIComponent(tableName)}`
    );
  }

  queryTable(
    tableName: string,
    options: { limit?: number; offset?: number; orderBy?: string; orderDir?: 'ASC' | 'DESC' } = {}
  ): Observable<PaginatedResponse<Record<string, unknown>>> {
    let params = new HttpParams();
    if (options.limit) params = params.set('limit', options.limit.toString());
    if (options.offset !== undefined) params = params.set('offset', options.offset.toString());
    if (options.orderBy) params = params.set('orderBy', options.orderBy);
    if (options.orderDir) params = params.set('orderDir', options.orderDir);

    return this.http.get<PaginatedResponse<Record<string, unknown>>>(
      `${this.baseUrl}data-explorer/query/${encodeURIComponent(tableName)}`,
      { params }
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
    let params = new HttpParams().set('limit', limit.toString());
    if (search) params = params.set('search', search);

    return this.http.get<{ success: boolean; destinations: Destination[] }>(
      `${this.baseUrl}data-explorer/destinations`,
      { params }
    );
  }

  getSalesOfficeSummary(): Observable<{ success: boolean; summary: SalesOfficeSummary }> {
    return this.http.get<{ success: boolean; summary: SalesOfficeSummary }>(
      `${this.baseUrl}data-explorer/sales-office/summary`
    );
  }

  getSalesOfficeOrders(limit = 50, status?: string): Observable<{ success: boolean; orders: Record<string, unknown>[] }> {
    let params = new HttpParams().set('limit', limit.toString());
    if (status) params = params.set('status', status);

    return this.http.get<{ success: boolean; orders: Record<string, unknown>[] }>(
      `${this.baseUrl}data-explorer/sales-office/orders`,
      { params }
    );
  }

  getBackofficeStats(): Observable<{ success: boolean; stats: BackofficeStats }> {
    return this.http.get<{ success: boolean; stats: BackofficeStats }>(
      `${this.baseUrl}data-explorer/backoffice/stats`
    );
  }

  getQueue(status?: string, limit = 50): Observable<QueueResponse> {
    let params = new HttpParams().set('limit', limit.toString());
    if (status) params = params.set('status', status);

    return this.http.get<QueueResponse>(
      `${this.baseUrl}data-explorer/queue`,
      { params }
    );
  }

  getHotelsToPush(active = true, limit = 50): Observable<{ success: boolean; hotelsToPush: HotelToPush[] }> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('active', active.toString());

    return this.http.get<{ success: boolean; hotelsToPush: HotelToPush[] }>(
      `${this.baseUrl}data-explorer/hotels-to-push`,
      { params }
    );
  }

  getPriceUpdates(hotelId?: number, limit = 100): Observable<{ success: boolean; priceUpdates: PriceUpdate[] }> {
    let params = new HttpParams().set('limit', limit.toString());
    if (hotelId) params = params.set('hotelId', hotelId.toString());

    return this.http.get<{ success: boolean; priceUpdates: PriceUpdate[] }>(
      `${this.baseUrl}data-explorer/price-updates`,
      { params }
    );
  }

  getSystemLogs(search?: string, limit = 100): Observable<{ success: boolean; logs: SystemLog[] }> {
    let params = new HttpParams().set('limit', limit.toString());
    if (search) params = params.set('search', search);

    return this.http.get<{ success: boolean; logs: SystemLog[] }>(
      `${this.baseUrl}data-explorer/system-logs`,
      { params }
    );
  }

  getLookups(): Observable<{ success: boolean; lookups: LookupData }> {
    return this.http.get<{ success: boolean; lookups: LookupData }>(
      `${this.baseUrl}data-explorer/lookups`
    );
  }

  getUsers(): Observable<{ success: boolean; users: UserInfo[] }> {
    return this.http.get<{ success: boolean; users: UserInfo[] }>(
      `${this.baseUrl}data-explorer/users`
    );
  }
}
