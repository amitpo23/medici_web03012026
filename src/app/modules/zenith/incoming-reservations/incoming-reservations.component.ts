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
    .incoming-reservations {
      padding: 24px;
      position: relative;
    }

    .header-section {
      margin-bottom: 24px;
    }

    .filters {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .days-filter {
      width: 150px;
    }

    mat-button-toggle-group {
      border-radius: 8px;
    }

    mat-button-toggle mat-icon {
      margin-right: 4px;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: #666;
    }

    .loading-state span {
      margin-top: 16px;
    }

    .table-card {
      overflow: hidden;
    }

    .reservations-table {
      width: 100%;
    }

    .ref-id {
      font-family: monospace;
      font-size: 12px;
      background: #f5f5f5;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .hotel-info, .guest-info, .dates-info, .room-info {
      display: flex;
      flex-direction: column;
    }

    .hotel-name, .guest-name {
      font-weight: 500;
    }

    .hotel-code, .guest-count, .nights, .rate-plan {
      font-size: 12px;
      color: #666;
    }

    .amount {
      font-weight: 600;
      color: #1976d2;
    }

    tr.pending {
      background: #fff8e1;
    }

    tr.approved {
      background: #e8f5e9;
    }

    tr.cancelled {
      background: #ffebee;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
    }

    .empty-state p {
      margin: 0;
    }

    /* Match Panel Styles */
    .panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      z-index: 999;
    }

    .match-panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 500px;
      background: white;
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      display: flex;
      flex-direction: column;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
    }

    .panel-header h3 {
      margin: 0;
      font-weight: 500;
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .reservation-summary {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .reservation-summary h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 500;
      color: #666;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
    }

    .summary-item .label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
    }

    .summary-item .value {
      font-weight: 500;
    }

    .summary-item .value.highlight {
      color: #1976d2;
      font-size: 18px;
    }

    .available-rooms h4 {
      margin: 0 0 16px 0;
      font-size: 14px;
      font-weight: 500;
    }

    .loading-rooms {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px;
      color: #666;
    }

    .no-rooms {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 24px;
      background: #fff3e0;
      border-radius: 8px;
      color: #f57c00;
    }

    .rooms-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .room-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .room-option:hover {
      border-color: #1976d2;
      background: #e3f2fd;
    }

    .room-option.selected {
      border-color: #1976d2;
      background: #e3f2fd;
    }

    .room-details {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .room-hotel {
      font-weight: 500;
    }

    .room-type, .room-dates {
      font-size: 12px;
      color: #666;
    }

    .room-prices {
      display: flex;
      gap: 16px;
    }

    .room-prices > div {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .room-prices .label {
      font-size: 10px;
      color: #999;
      text-transform: uppercase;
    }

    .room-prices .value {
      font-weight: 600;
    }

    .margin.positive .value {
      color: #4caf50;
    }

    .margin.negative .value {
      color: #f44336;
    }

    .panel-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
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
