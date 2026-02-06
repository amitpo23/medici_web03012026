import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ZenithService, IncomingReservation, ReservationCounts, AvailableRoom } from '../../../services/zenith.service';

@Component({
  selector: 'app-incoming-reservations',
  template: `
    <div class="incoming-reservations">
      <!-- Filters & Stats -->
      <div class="header-section">
        <div class="filters">
          <mat-button-toggle-group [(ngModel)]="statusFilter" (change)="loadReservations()">
            <mat-button-toggle value="">All ({{ counts?.Total || 0 }})</mat-button-toggle>
            <mat-button-toggle value="pending">
              <mat-icon>pending_actions</mat-icon>
              Pending ({{ counts?.Pending || 0 }})
            </mat-button-toggle>
            <mat-button-toggle value="approved">
              <mat-icon>check_circle</mat-icon>
              Approved ({{ counts?.Approved || 0 }})
            </mat-button-toggle>
            <mat-button-toggle value="cancelled">
              <mat-icon>cancel</mat-icon>
              Cancelled ({{ counts?.Cancelled || 0 }})
            </mat-button-toggle>
          </mat-button-toggle-group>

          <mat-form-field appearance="outline" class="days-filter">
            <mat-label>Period</mat-label>
            <mat-select [(ngModel)]="daysFilter" (selectionChange)="loadReservations()">
              <mat-option [value]="7">Last 7 days</mat-option>
              <mat-option [value]="30">Last 30 days</mat-option>
              <mat-option [value]="90">Last 90 days</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-icon-button (click)="loadReservations()" [disabled]="isLoading">
            <mat-icon [class.spin]="isLoading">refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="isLoading && !reservations.length">
        <mat-spinner diameter="40"></mat-spinner>
        <span>Loading reservations...</span>
      </div>

      <!-- Reservations Table -->
      <mat-card class="table-card" *ngIf="reservations.length || !isLoading">
        <table mat-table [dataSource]="reservations" class="reservations-table">
          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let row">
              <mat-chip [color]="getStatusColor(row)" selected>
                <mat-icon>{{ getStatusIcon(row) }}</mat-icon>
                {{ getStatusText(row) }}
              </mat-chip>
            </td>
          </ng-container>

          <!-- UniqueID Column -->
          <ng-container matColumnDef="uniqueID">
            <th mat-header-cell *matHeaderCellDef>Reference</th>
            <td mat-cell *matCellDef="let row">
              <span class="ref-id">{{ row.uniqueID }}</span>
            </td>
          </ng-container>

          <!-- Hotel Column -->
          <ng-container matColumnDef="hotel">
            <th mat-header-cell *matHeaderCellDef>Hotel</th>
            <td mat-cell *matCellDef="let row">
              <div class="hotel-info">
                <span class="hotel-name">{{ row.HotelName }}</span>
                <span class="hotel-code">{{ row.HotelCode }}</span>
              </div>
            </td>
          </ng-container>

          <!-- Guest Column -->
          <ng-container matColumnDef="guest">
            <th mat-header-cell *matHeaderCellDef>Guest</th>
            <td mat-cell *matCellDef="let row">
              <div class="guest-info">
                <span class="guest-name">{{ row.GuestName }}</span>
                <span class="guest-count">{{ row.AdultCount }} adults<span *ngIf="row.ChildrenCount">, {{ row.ChildrenCount }} children</span></span>
              </div>
            </td>
          </ng-container>

          <!-- Dates Column -->
          <ng-container matColumnDef="dates">
            <th mat-header-cell *matHeaderCellDef>Stay Dates</th>
            <td mat-cell *matCellDef="let row">
              <div class="dates-info">
                <span>{{ row.DateFrom | date:'MMM d' }} - {{ row.DateTo | date:'MMM d, yyyy' }}</span>
                <span class="nights">{{ getNights(row.DateFrom, row.DateTo) }} nights</span>
              </div>
            </td>
          </ng-container>

          <!-- Amount Column -->
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef>Amount</th>
            <td mat-cell *matCellDef="let row">
              <span class="amount">{{ row.AmountAfterTax | currency:row.CurrencyCode }}</span>
            </td>
          </ng-container>

          <!-- Room Type Column -->
          <ng-container matColumnDef="roomType">
            <th mat-header-cell *matHeaderCellDef>Room</th>
            <td mat-cell *matCellDef="let row">
              <div class="room-info">
                <span>{{ row.RoomTypeCode }}</span>
                <span class="rate-plan">{{ row.RatePlanCode }}</span>
              </div>
            </td>
          </ng-container>

          <!-- Received Column -->
          <ng-container matColumnDef="received">
            <th mat-header-cell *matHeaderCellDef>Received</th>
            <td mat-cell *matCellDef="let row">
              {{ row.DateInsert | date:'short' }}
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let row">
              <div class="actions">
                <button mat-stroked-button color="primary"
                        *ngIf="!row.IsApproved && !row.IsCanceled"
                        (click)="openMatchDialog(row)">
                  <mat-icon>link</mat-icon>
                  Match & Approve
                </button>
                <button mat-icon-button [matMenuTriggerFor]="menu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item (click)="viewDetails(row)">
                    <mat-icon>visibility</mat-icon>
                    <span>View Details</span>
                  </button>
                  <button mat-menu-item *ngIf="row.MatchedBookId">
                    <mat-icon>receipt</mat-icon>
                    <span>View Booking #{{ row.MatchedBookId }}</span>
                  </button>
                </mat-menu>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"
              [class.pending]="!row.IsApproved && !row.IsCanceled"
              [class.approved]="row.IsApproved"
              [class.cancelled]="row.IsCanceled"></tr>
        </table>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="!reservations.length && !isLoading">
          <mat-icon>inbox</mat-icon>
          <h3>No Reservations Found</h3>
          <p>No incoming reservations match your current filters.</p>
        </div>

        <!-- Pagination -->
        <mat-paginator [length]="totalReservations"
                       [pageSize]="pageSize"
                       [pageSizeOptions]="[10, 25, 50, 100]"
                       (page)="onPageChange($event)">
        </mat-paginator>
      </mat-card>

      <!-- Match Dialog Panel (Side Panel) -->
      <div class="match-panel" *ngIf="selectedReservation" [@slideIn]>
        <div class="panel-header">
          <h3>Match & Approve Reservation</h3>
          <button mat-icon-button (click)="closeMatchDialog()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="panel-content">
          <!-- Reservation Summary -->
          <div class="reservation-summary">
            <h4>Incoming Reservation</h4>
            <div class="summary-grid">
              <div class="summary-item">
                <span class="label">Reference</span>
                <span class="value">{{ selectedReservation.uniqueID }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Hotel</span>
                <span class="value">{{ selectedReservation.HotelName }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Guest</span>
                <span class="value">{{ selectedReservation.GuestName }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Dates</span>
                <span class="value">{{ selectedReservation.DateFrom | date:'MMM d' }} - {{ selectedReservation.DateTo | date:'MMM d' }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Amount</span>
                <span class="value highlight">{{ selectedReservation.AmountAfterTax | currency:selectedReservation.CurrencyCode }}</span>
              </div>
            </div>
          </div>

          <!-- Available Rooms -->
          <div class="available-rooms">
            <h4>Available Rooms to Match</h4>
            <div class="loading-rooms" *ngIf="isLoadingRooms">
              <mat-spinner diameter="24"></mat-spinner>
              <span>Searching available rooms...</span>
            </div>

            <div class="rooms-list" *ngIf="!isLoadingRooms">
              <div class="no-rooms" *ngIf="!availableRooms.length">
                <mat-icon>warning</mat-icon>
                <span>No matching rooms available for these dates</span>
              </div>

              <div class="room-option" *ngFor="let room of availableRooms"
                   [class.selected]="selectedBookId === room.BookId"
                   (click)="selectRoom(room)">
                <div class="room-check">
                  <mat-radio-button [checked]="selectedBookId === room.BookId"></mat-radio-button>
                </div>
                <div class="room-details">
                  <span class="room-hotel">{{ room.HotelName }}</span>
                  <span class="room-type">{{ room.RoomCategory }} - {{ room.MealPlan }}</span>
                  <span class="room-dates">{{ room.startDate | date:'MMM d' }} - {{ room.endDate | date:'MMM d' }}</span>
                </div>
                <div class="room-prices">
                  <div class="buy-price">
                    <span class="label">Buy</span>
                    <span class="value">{{ room.BuyPrice | currency:'EUR' }}</span>
                  </div>
                  <div class="push-price">
                    <span class="label">Push</span>
                    <span class="value">{{ room.PushPrice | currency:'EUR' }}</span>
                  </div>
                  <div class="margin" [class.positive]="getMargin(room) > 0" [class.negative]="getMargin(room) < 0">
                    <span class="label">Margin</span>
                    <span class="value">{{ getMargin(room) | currency:'EUR' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-actions">
          <button mat-stroked-button (click)="closeMatchDialog()">Cancel</button>
          <button mat-flat-button color="primary"
                  [disabled]="!selectedBookId || isApproving"
                  (click)="approveReservation()">
            <mat-icon [class.spin]="isApproving">{{ isApproving ? 'sync' : 'check' }}</mat-icon>
            {{ isApproving ? 'Approving...' : 'Approve & Match' }}
          </button>
        </div>
      </div>

      <!-- Overlay when panel is open -->
      <div class="panel-overlay" *ngIf="selectedReservation" (click)="closeMatchDialog()"></div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');

    .incoming-reservations {
      padding: 32px;
      position: relative;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .header-section {
      margin-bottom: 28px;
    }

    .filters {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .days-filter {
      width: 160px;
    }

    ::ng-deep .days-filter .mat-mdc-text-field-wrapper {
      background: rgba(30, 35, 75, 0.6) !important;
      border-radius: 10px !important;
    }

    ::ng-deep .days-filter .mat-mdc-form-field-flex {
      background: transparent !important;
    }

    ::ng-deep .days-filter .mdc-notched-outline__leading,
    ::ng-deep .days-filter .mdc-notched-outline__notch,
    ::ng-deep .days-filter .mdc-notched-outline__trailing {
      border-color: rgba(99, 102, 241, 0.25) !important;
    }

    ::ng-deep .days-filter .mat-mdc-select-value,
    ::ng-deep .days-filter .mat-mdc-floating-label {
      color: #94a3b8 !important;
    }

    mat-button-toggle-group {
      border-radius: 12px;
      border: 1px solid rgba(99, 102, 241, 0.2);
      overflow: hidden;
      background: rgba(30, 35, 75, 0.5);
    }

    ::ng-deep .mat-button-toggle {
      background: transparent !important;
    }

    ::ng-deep .mat-button-toggle-checked {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
    }

    ::ng-deep .mat-button-toggle-label-content {
      color: #94a3b8 !important;
      font-weight: 500;
    }

    ::ng-deep .mat-button-toggle-checked .mat-button-toggle-label-content {
      color: white !important;
    }

    mat-button-toggle mat-icon {
      margin-right: 6px;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px;
      color: #94a3b8;
    }

    .loading-state span {
      margin-top: 20px;
      font-weight: 500;
    }

    .table-card {
      overflow: hidden;
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.7) 0%, rgba(20, 25, 55, 0.85) 100%);
      border: 1px solid rgba(99, 102, 241, 0.12);
      border-radius: 16px;
    }

    .reservations-table {
      width: 100%;
      background: transparent !important;
    }

    ::ng-deep .reservations-table th {
      background: rgba(15, 20, 45, 0.6) !important;
      color: #94a3b8 !important;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      border-bottom: 1px solid rgba(99, 102, 241, 0.15) !important;
    }

    ::ng-deep .reservations-table td {
      color: #e2e8f0 !important;
      border-bottom: 1px solid rgba(99, 102, 241, 0.08) !important;
    }

    ::ng-deep .reservations-table tr:hover td {
      background: rgba(99, 102, 241, 0.08) !important;
    }

    .ref-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      background: rgba(99, 102, 241, 0.15);
      padding: 6px 10px;
      border-radius: 6px;
      color: #a5b4fc;
    }

    .hotel-info, .guest-info, .dates-info, .room-info {
      display: flex;
      flex-direction: column;
    }

    .hotel-name, .guest-name {
      font-weight: 600;
      color: #f1f5f9;
    }

    .hotel-code, .guest-count, .nights, .rate-plan {
      font-size: 12px;
      color: #64748b;
    }

    .amount {
      font-weight: 700;
      color: #818cf8;
      font-family: 'JetBrains Mono', monospace;
    }

    ::ng-deep tr.pending td {
      background: rgba(245, 158, 11, 0.08) !important;
    }

    ::ng-deep tr.approved td {
      background: rgba(16, 185, 129, 0.08) !important;
    }

    ::ng-deep tr.cancelled td {
      background: rgba(239, 68, 68, 0.08) !important;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .actions button[mat-stroked-button] {
      border-color: rgba(99, 102, 241, 0.4);
      color: #a5b4fc;
      border-radius: 8px;
      font-weight: 500;
    }

    .actions button[mat-stroked-button]:hover {
      background: rgba(99, 102, 241, 0.15);
      border-color: #6366f1;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 80px;
      color: #475569;
    }

    .empty-state mat-icon {
      font-size: 72px;
      width: 72px;
      height: 72px;
      margin-bottom: 20px;
      color: #334155;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      color: #94a3b8;
      font-weight: 600;
    }

    .empty-state p {
      margin: 0;
      color: #64748b;
    }

    /* Match Panel Styles - Premium Dark Theme */
    .panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 999;
    }

    .match-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 520px;
      background: linear-gradient(180deg, #0f1629 0%, #131842 100%);
      border-left: 1px solid rgba(99, 102, 241, 0.2);
      box-shadow: -10px 0 50px rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      flex-direction: column;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 28px;
      border-bottom: 1px solid rgba(99, 102, 241, 0.15);
      background: rgba(15, 20, 45, 0.5);
    }

    .panel-header h3 {
      margin: 0;
      font-weight: 600;
      color: #f1f5f9;
      font-size: 18px;
    }

    .panel-header button {
      color: #64748b;
    }

    .panel-header button:hover {
      color: #f1f5f9;
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 28px;
    }

    .reservation-summary {
      background: linear-gradient(145deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 28px;
    }

    .reservation-summary h4 {
      margin: 0 0 16px 0;
      font-size: 12px;
      font-weight: 600;
      color: #818cf8;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
    }

    .summary-item .label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .summary-item .value {
      font-weight: 600;
      color: #e2e8f0;
    }

    .summary-item .value.highlight {
      color: #818cf8;
      font-size: 20px;
      font-family: 'JetBrains Mono', monospace;
    }

    .available-rooms h4 {
      margin: 0 0 20px 0;
      font-size: 14px;
      font-weight: 600;
      color: #e2e8f0;
    }

    .loading-rooms {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 32px;
      color: #94a3b8;
    }

    .no-rooms {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 12px;
      color: #fbbf24;
    }

    .rooms-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .room-option {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px;
      border: 2px solid rgba(99, 102, 241, 0.15);
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      background: rgba(15, 20, 45, 0.4);
    }

    .room-option:hover {
      border-color: rgba(99, 102, 241, 0.4);
      background: rgba(99, 102, 241, 0.08);
      transform: translateX(4px);
    }

    .room-option.selected {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.15);
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
    }

    ::ng-deep .room-option .mat-mdc-radio-button .mdc-radio__outer-circle {
      border-color: #64748b !important;
    }

    ::ng-deep .room-option.selected .mat-mdc-radio-button .mdc-radio__outer-circle,
    ::ng-deep .room-option.selected .mat-mdc-radio-button .mdc-radio__inner-circle {
      border-color: #6366f1 !important;
      background-color: #6366f1 !important;
    }

    .room-details {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .room-hotel {
      font-weight: 600;
      color: #f1f5f9;
    }

    .room-type, .room-dates {
      font-size: 12px;
      color: #64748b;
    }

    .room-prices {
      display: flex;
      gap: 18px;
    }

    .room-prices > div {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .room-prices .label {
      font-size: 9px;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .room-prices .value {
      font-weight: 600;
      color: #e2e8f0;
      font-family: 'JetBrains Mono', monospace;
    }

    .margin.positive .value {
      color: #10b981;
    }

    .margin.negative .value {
      color: #ef4444;
    }

    .panel-actions {
      display: flex;
      justify-content: flex-end;
      gap: 14px;
      padding: 20px 28px;
      border-top: 1px solid rgba(99, 102, 241, 0.15);
      background: rgba(15, 20, 45, 0.5);
    }

    .panel-actions button[mat-stroked-button] {
      border-color: rgba(99, 102, 241, 0.3);
      color: #94a3b8;
      border-radius: 10px;
    }

    .panel-actions button[mat-flat-button] {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 10px;
      font-weight: 600;
    }

    .panel-actions button[mat-flat-button]:hover {
      box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .match-panel {
        width: 100%;
      }

      .filters {
        flex-direction: column;
        align-items: stretch;
      }

      mat-button-toggle-group {
        width: 100%;
      }
    }
  `]
})
export class IncomingReservationsComponent implements OnInit, OnDestroy {
  reservations: IncomingReservation[] = [];
  counts: ReservationCounts | null = null;
  availableRooms: AvailableRoom[] = [];

  displayedColumns = ['status', 'uniqueID', 'hotel', 'guest', 'dates', 'amount', 'roomType', 'received', 'actions'];

  statusFilter = '';
  daysFilter = 30;
  pageSize = 25;
  totalReservations = 0;
  currentPage = 0;

  isLoading = false;
  isLoadingRooms = false;
  isApproving = false;

  selectedReservation: IncomingReservation | null = null;
  selectedBookId: number | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private zenithService: ZenithService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadReservations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadReservations(): void {
    this.isLoading = true;
    this.zenithService.getIncomingReservations({
      status: this.statusFilter as 'pending' | 'approved' | 'cancelled' | undefined,
      days: this.daysFilter,
      limit: this.pageSize,
      offset: this.currentPage * this.pageSize
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.reservations = response.reservations;
          this.counts = response.counts;
          this.totalReservations = response.pagination.total;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load reservations', err);
          this.isLoading = false;
          this.snackBar.open('Failed to load reservations', 'Close', { duration: 5000 });
        }
      });
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadReservations();
  }

  getStatusColor(row: IncomingReservation): 'primary' | 'accent' | 'warn' {
    if (row.IsCanceled) return 'warn';
    if (row.IsApproved) return 'primary';
    return 'accent';
  }

  getStatusIcon(row: IncomingReservation): string {
    if (row.IsCanceled) return 'cancel';
    if (row.IsApproved) return 'check_circle';
    return 'pending_actions';
  }

  getStatusText(row: IncomingReservation): string {
    if (row.IsCanceled) return 'Cancelled';
    if (row.IsApproved) return 'Approved';
    return 'Pending';
  }

  getNights(dateFrom: string, dateTo: string): number {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  openMatchDialog(reservation: IncomingReservation): void {
    this.selectedReservation = reservation;
    this.selectedBookId = null;
    this.loadAvailableRooms();
  }

  closeMatchDialog(): void {
    this.selectedReservation = null;
    this.selectedBookId = null;
    this.availableRooms = [];
  }

  loadAvailableRooms(): void {
    if (!this.selectedReservation) return;

    this.isLoadingRooms = true;
    this.zenithService.getAvailableRooms({
      hotelCode: this.selectedReservation.HotelCode,
      dateFrom: this.selectedReservation.DateFrom,
      dateTo: this.selectedReservation.DateTo
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.availableRooms = response.rooms;
          this.isLoadingRooms = false;
        },
        error: (err) => {
          console.error('Failed to load available rooms', err);
          this.isLoadingRooms = false;
        }
      });
  }

  selectRoom(room: AvailableRoom): void {
    this.selectedBookId = room.BookId;
  }

  getMargin(room: AvailableRoom): number {
    if (!this.selectedReservation) return 0;
    return this.selectedReservation.AmountAfterTax - room.BuyPrice;
  }

  approveReservation(): void {
    if (!this.selectedReservation || !this.selectedBookId) return;

    this.isApproving = true;
    this.zenithService.approveReservation(this.selectedReservation.Id, this.selectedBookId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isApproving = false;
          this.snackBar.open(response.message || 'Reservation approved successfully', 'Close', { duration: 5000 });
          this.closeMatchDialog();
          this.loadReservations();
        },
        error: (err) => {
          this.isApproving = false;
          console.error('Failed to approve reservation', err);
          this.snackBar.open('Failed to approve reservation', 'Close', { duration: 5000 });
        }
      });
  }

  viewDetails(reservation: IncomingReservation): void {
    this.snackBar.open(`Viewing details for ${reservation.uniqueID}`, 'Close', { duration: 3000 });
  }
}
