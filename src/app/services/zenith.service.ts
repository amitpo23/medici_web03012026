import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../environments/environment.prod';

export interface QueueStatus {
  success: boolean;
  queue: {
    pending: number;
    failed: number;
    oldestItem: string | null;
    newestItem: string | null;
    status: 'empty' | 'normal' | 'medium' | 'high';
  };
}

export interface PushStats {
  success: boolean;
  period: string;
  overall: {
    TotalPushes: number;
    SuccessCount: number;
    FailureCount: number;
    OverallSuccessRate: number;
  };
  byType: Array<{
    PushType: string;
    TotalPushes: number;
    SuccessCount: number;
    FailureCount: number;
    SuccessRate: number;
    AvgProcessingTime: number;
    MaxProcessingTime: number;
  }>;
}

export interface BatchPushRequest {
  opportunityIds: number[];
  action: 'publish' | 'update' | 'close';
  overrides?: {
    available?: number;
    mealPlan?: string;
    pushPrice?: number;
  };
}

export interface BatchPushResult {
  success: boolean;
  summary: {
    total: number;
    successful: number;
    failed: number;
    action: string;
  };
  results: Array<{
    opportunityId: number;
    hotelName: string;
    status: string;
    action: string;
  }>;
  errors?: Array<{
    opportunityId: number;
    hotelName: string;
    error: string;
  }>;
}

export interface ProcessQueueResult {
  success: boolean;
  message: string;
  result: {
    processed: number;
    successful: number;
    failed: number;
    successRate: string;
  };
  details?: Array<{
    id: number;
    hotelCode: string;
    success: boolean;
    error?: string;
  }>;
}

export interface PushAvailabilityRequest {
  hotelCode: string;
  invTypeCode: string;
  startDate: string;
  endDate: string;
  available: number;
}

export interface PushRateRequest {
  hotelCode: string;
  invTypeCode: string;
  ratePlanCode: string;
  startDate: string;
  endDate: string;
  price: number;
  currency?: string;
  mealPlan?: string;
}

export interface PushResult {
  success: boolean;
  response?: string;
  error?: string;
  processingTime?: number;
}

export interface OpportunityForPush {
  OpportunityId: number;
  HotelName: string;
  DateFrom: string;
  DateTo: string;
  PushPrice: number;
  BuyPrice: number;
  IsPush: boolean;
  ZenithHotelCode?: string;
  RatePlanCode?: string;
  InvTypeCode?: string;
  MealPlan?: string;
  HasZenithMapping: boolean;
}

export interface PushHistory {
  success: boolean;
  history: Array<{
    Id: number;
    OpportunityId: number;
    BookId: number;
    PushType: string;
    PushDate: string;
    Success: boolean;
    ErrorMessage: string | null;
    RetryCount: number;
    ProcessingTimeMs: number;
    HotelName?: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ZenithService {
  private apiUrl = `${environment.apiUrl}/ZenithApi`;

  private queueUpdated$ = new BehaviorSubject<boolean>(false);
  public queueUpdates = this.queueUpdated$.asObservable();

  constructor(private http: HttpClient) { }

  /**
   * Get queue status
   */
  getQueueStatus(): Observable<QueueStatus> {
    return this.http.get<QueueStatus>(`${this.apiUrl}/queue-status`);
  }

  /**
   * Get push statistics
   */
  getPushStats(days: number = 7): Observable<PushStats> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<PushStats>(`${this.apiUrl}/push-stats`, { params });
  }

  /**
   * Push batch of opportunities
   */
  pushBatch(request: BatchPushRequest): Observable<BatchPushResult> {
    return this.http.post<BatchPushResult>(`${this.apiUrl}/push-batch`, request).pipe(
      tap(() => this.queueUpdated$.next(true))
    );
  }

  /**
   * Process pending queue items
   */
  processQueue(): Observable<ProcessQueueResult> {
    return this.http.post<ProcessQueueResult>(`${this.apiUrl}/process-queue`, {}).pipe(
      tap(() => this.queueUpdated$.next(true))
    );
  }

  /**
   * Get opportunities available for push
   */
  getOpportunitiesForPush(filters?: {
    dateFrom?: string;
    dateTo?: string;
    onlyUnpushed?: boolean;
    limit?: number;
  }): Observable<{ success: boolean; opportunities: OpportunityForPush[]; total: number }> {
    let params = new HttpParams();
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);
    if (filters?.onlyUnpushed) params = params.set('onlyUnpushed', 'true');
    if (filters?.limit) params = params.set('limit', filters.limit.toString());

    return this.http.get<{ success: boolean; opportunities: OpportunityForPush[]; total: number }>(
      `${environment.apiUrl}/Opportunity/ForPush`,
      { params }
    );
  }

  /**
   * Get push history/logs
   */
  getPushHistory(filters?: {
    limit?: number;
    offset?: number;
    pushType?: string;
    success?: boolean;
    days?: number;
  }): Observable<PushHistory> {
    let params = new HttpParams();
    if (filters?.limit) params = params.set('limit', filters.limit.toString());
    if (filters?.offset) params = params.set('offset', filters.offset.toString());
    if (filters?.pushType) params = params.set('pushType', filters.pushType);
    if (filters?.success != null) params = params.set('success', filters.success.toString());
    if (filters?.days) params = params.set('days', filters.days.toString());

    return this.http.get<PushHistory>(`${this.apiUrl}/push-history`, { params });
  }

  /**
   * Push single availability update
   */
  pushAvailability(request: PushAvailabilityRequest): Observable<PushResult> {
    return this.http.post<PushResult>(`${this.apiUrl}/push-availability`, request).pipe(
      tap(() => this.queueUpdated$.next(true))
    );
  }

  /**
   * Push single rate update
   */
  pushRate(request: PushRateRequest): Observable<PushResult> {
    return this.http.post<PushResult>(`${this.apiUrl}/push-rate`, request).pipe(
      tap(() => this.queueUpdated$.next(true))
    );
  }

  /**
   * Health check
   */
  getHealth(): Observable<{ status: string; service: string; timestamp: string }> {
    return this.http.get<{ status: string; service: string; timestamp: string }>(`${this.apiUrl}/health`);
  }

  /**
   * Get queue status badge color
   */
  getQueueStatusColor(status: string): string {
    switch (status) {
      case 'empty': return 'primary';
      case 'normal': return 'accent';
      case 'medium': return 'warn';
      case 'high': return 'warn';
      default: return 'primary';
    }
  }

  /**
   * Format date for API
   */
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // ==================== SALES OFFICE FEATURES ====================

  /**
   * Get incoming reservations from Zenith
   */
  getIncomingReservations(filters?: {
    status?: 'pending' | 'approved' | 'cancelled';
    days?: number;
    limit?: number;
    offset?: number;
  }): Observable<{
    success: boolean;
    reservations: IncomingReservation[];
    counts: ReservationCounts;
    pagination: { total: number; limit: number; offset: number };
  }> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.days) params = params.set('days', filters.days.toString());
    if (filters?.limit) params = params.set('limit', filters.limit.toString());
    if (filters?.offset) params = params.set('offset', filters.offset.toString());

    return this.http.get<{
      success: boolean;
      reservations: IncomingReservation[];
      counts: ReservationCounts;
      pagination: { total: number; limit: number; offset: number };
    }>(`${this.apiUrl}/incoming-reservations`, { params });
  }

  /**
   * Get available rooms for matching
   */
  getAvailableRooms(filters?: {
    hotelCode?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Observable<{ success: boolean; rooms: AvailableRoom[] }> {
    let params = new HttpParams();
    if (filters?.hotelCode) params = params.set('hotelCode', filters.hotelCode);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo);

    return this.http.get<{ success: boolean; rooms: AvailableRoom[] }>(
      `${this.apiUrl}/available-rooms`, { params }
    );
  }

  /**
   * Approve and match reservation to booking
   */
  approveReservation(reservationId: number, bookId: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/approve-reservation`,
      { reservationId, bookId }
    ).pipe(tap(() => this.queueUpdated$.next(true)));
  }

  /**
   * Get sales overview dashboard data
   */
  getSalesOverview(days: number = 30): Observable<SalesOverview> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<SalesOverview>(`${this.apiUrl}/sales-overview`, { params });
  }

  /**
   * Get activity log
   */
  getActivityLog(filters?: {
    action?: string;
    days?: number;
    limit?: number;
    offset?: number;
  }): Observable<{
    success: boolean;
    logs: ActivityLogEntry[];
    actions: string[];
    pagination: { total: number; limit: number; offset: number };
  }> {
    let params = new HttpParams();
    if (filters?.action) params = params.set('action', filters.action);
    if (filters?.days) params = params.set('days', filters.days.toString());
    if (filters?.limit) params = params.set('limit', filters.limit.toString());
    if (filters?.offset) params = params.set('offset', filters.offset.toString());

    return this.http.get<{
      success: boolean;
      logs: ActivityLogEntry[];
      actions: string[];
      pagination: { total: number; limit: number; offset: number };
    }>(`${this.apiUrl}/activity-log`, { params });
  }

  /**
   * Get cancellations
   */
  getCancellations(filters?: {
    status?: 'pending' | 'processed';
    days?: number;
    limit?: number;
    offset?: number;
  }): Observable<{
    success: boolean;
    cancellations: CancellationRequest[];
    counts: { Total: number; Pending: number; Processed: number };
    pagination: { total: number; limit: number; offset: number };
  }> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.days) params = params.set('days', filters.days.toString());
    if (filters?.limit) params = params.set('limit', filters.limit.toString());
    if (filters?.offset) params = params.set('offset', filters.offset.toString());

    return this.http.get<{
      success: boolean;
      cancellations: CancellationRequest[];
      counts: { Total: number; Pending: number; Processed: number };
      pagination: { total: number; limit: number; offset: number };
    }>(`${this.apiUrl}/cancellations`, { params });
  }

  /**
   * Process a cancellation
   */
  processCancellation(cancellationId: number, refundAmount?: number, notes?: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/process-cancellation`,
      { cancellationId, refundAmount, notes }
    ).pipe(tap(() => this.queueUpdated$.next(true)));
  }

  // ==================== DIRECT PRICE PUSH ====================

  /**
   * Search hotels that have Zenith mapping
   */
  searchHotelsWithMapping(search: string, limit: number = 50): Observable<{ success: boolean; hotels: ZenithMappedHotel[]; count: number }> {
    const params = new HttpParams()
      .set('search', search)
      .set('limit', limit.toString());
    return this.http.get<{ success: boolean; hotels: ZenithMappedHotel[]; count: number }>(
      `${this.apiUrl}/hotels-with-mapping`, { params }
    );
  }

  /**
   * Direct push prices to Zenith
   */
  directPush(request: { items: DirectPushItem[] }): Observable<DirectPushResult> {
    return this.http.post<DirectPushResult>(
      `${this.apiUrl}/direct-push`, request
    ).pipe(tap(() => this.queueUpdated$.next(true)));
  }
}

// ==================== INTERFACES ====================

export interface IncomingReservation {
  Id: number;
  uniqueID: string;
  HotelCode: string;
  HotelName: string;
  DateFrom: string;
  DateTo: string;
  AmountAfterTax: number;
  CurrencyCode: string;
  GuestName: string;
  RatePlanCode: string;
  RoomTypeCode: string;
  AdultCount: number;
  ChildrenCount: number;
  Comments: string;
  IsApproved: boolean;
  IsCanceled: boolean;
  ApprovedDate: string | null;
  CancelDate: string | null;
  DateInsert: string;
  MatchedBookId: number | null;
  BookBuyPrice: number | null;
  BookPushPrice: number | null;
}

export interface ReservationCounts {
  Total: number;
  Pending: number;
  Approved: number;
  Cancelled: number;
}

export interface AvailableRoom {
  BookId: number;
  HotelId: number;
  HotelName: string;
  HotelCode: string;
  startDate: string;
  endDate: string;
  BuyPrice: number;
  PushPrice: number;
  BoardId: number;
  MealPlan: string;
  CategoryId: number;
  RoomCategory: string;
  CancellationType: string;
  CancellationTo: string;
}

export interface SalesOverview {
  success: boolean;
  period: string;
  bookings: {
    TotalBookings: number;
    AvailableRooms: number;
    SoldRooms: number;
    CancelledRooms: number;
    TotalProfit: number;
    TotalRevenue: number;
  };
  reservations: {
    TotalReservations: number;
    PendingReservations: number;
    ApprovedReservations: number;
    CancelledReservations: number;
    TotalReservationValue: number;
  };
  pushes: {
    TotalPushes: number;
    SuccessfulPushes: number;
    FailedPushes: number;
  };
  recentActivity: Array<{
    Type: string;
    Id: number;
    Reference: string;
    HotelName: string;
    Amount: number;
    Date: string;
    Status: string;
  }>;
}

export interface ActivityLogEntry {
  Id: number;
  Action: string;
  ReservationId: number | null;
  BookId: number | null;
  OpportunityId: number | null;
  HotelId: number | null;
  Details: string;
  UserName: string;
  DateInsert: string;
}

// ==================== DIRECT PRICE PUSH ====================

export interface ZenithMappedHotel {
  HotelId: number;
  Name: string;
  City: string;
  Stars: number;
  ZenithHotelCode: string;
  InvTypeCode: string;
  RatePlanCode: string;
}

export interface DirectPushItem {
  hotelId: number;
  zenithHotelCode: string;
  invTypeCode: string;
  ratePlanCode: string;
  startDate: string;
  endDate: string;
  pushPrice: number;
  boardId: number;
  categoryId: number;
  mealPlan: string;
  pricingMode: 'static' | 'dynamic';
}

export interface DirectPushResult {
  success: boolean;
  summary: { total: number; successful: number; failed: number };
  results: Array<{ hotelId: number; hotelName: string; status: string; opportunityId?: number; pricingMode?: string }>;
  errors?: Array<{ hotelId: number; hotelName?: string; error: string }>;
}

export interface CancellationRequest {
  Id: number;
  uniqueID: string;
  ReservationId: number;
  HotelCode: string;
  HotelName: string;
  DateFrom: string;
  DateTo: string;
  AmountAfterTax: number;
  GuestName: string;
  CancelReason: string;
  IsProcessed: boolean;
  ProcessedDate: string | null;
  RefundAmount: number;
  DateInsert: string;
}
