import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ZenithService, ActivityLogEntry } from '../../../services/zenith.service';

@Component({
  selector: 'app-activity-log',
  template: `
    <div class="activity-log">
      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters">
            <mat-form-field appearance="outline">
              <mat-label>Action Type</mat-label>
              <mat-select [(ngModel)]="actionFilter" (selectionChange)="loadLogs()">
                <mat-option value="">All Actions</mat-option>
                <mat-option *ngFor="let action of availableActions" [value]="action">
                  {{ action }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Period</mat-label>
              <mat-select [(ngModel)]="daysFilter" (selectionChange)="loadLogs()">
                <mat-option [value]="1">Today</mat-option>
                <mat-option [value]="7">Last 7 days</mat-option>
                <mat-option [value]="30">Last 30 days</mat-option>
                <mat-option [value]="90">Last 90 days</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search</mat-label>
              <input matInput [(ngModel)]="searchQuery" placeholder="Search in details...">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <button mat-flat-button color="primary" (click)="loadLogs()">
              <mat-icon>refresh</mat-icon>
              Refresh
            </button>

            <button mat-stroked-button (click)="exportLogs()">
              <mat-icon>download</mat-icon>
              Export
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Stats Summary -->
      <div class="stats-row" *ngIf="!isLoading">
        <mat-card class="stat-card">
          <mat-card-content>
            <mat-icon>list_alt</mat-icon>
            <div class="stat-info">
              <span class="stat-value">{{ totalLogs | number }}</span>
              <span class="stat-label">Total Records</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <mat-icon>category</mat-icon>
            <div class="stat-info">
              <span class="stat-value">{{ availableActions.length }}</span>
              <span class="stat-label">Action Types</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <mat-icon>schedule</mat-icon>
            <div class="stat-info">
              <span class="stat-value">{{ daysFilter }}d</span>
              <span class="stat-label">Period</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="isLoading">
        <mat-spinner diameter="40"></mat-spinner>
        <span>Loading activity logs...</span>
      </div>

      <!-- Logs Table -->
      <mat-card class="table-card" *ngIf="!isLoading">
        <table mat-table [dataSource]="filteredLogs" class="logs-table">
          <!-- Action Column -->
          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef>Action</th>
            <td mat-cell *matCellDef="let row">
              <mat-chip [color]="getActionColor(row.Action)" selected>
                <mat-icon>{{ getActionIcon(row.Action) }}</mat-icon>
                {{ row.Action }}
              </mat-chip>
            </td>
          </ng-container>

          <!-- Details Column -->
          <ng-container matColumnDef="details">
            <th mat-header-cell *matHeaderCellDef>Details</th>
            <td mat-cell *matCellDef="let row">
              <div class="details-cell">
                <span class="details-text">{{ row.Details }}</span>
              </div>
            </td>
          </ng-container>

          <!-- References Column -->
          <ng-container matColumnDef="references">
            <th mat-header-cell *matHeaderCellDef>References</th>
            <td mat-cell *matCellDef="let row">
              <div class="references">
                <span *ngIf="row.ReservationId" class="ref-badge reservation">
                  Res #{{ row.ReservationId }}
                </span>
                <span *ngIf="row.BookId" class="ref-badge booking">
                  Book #{{ row.BookId }}
                </span>
                <span *ngIf="row.OpportunityId" class="ref-badge opportunity">
                  Opp #{{ row.OpportunityId }}
                </span>
                <span *ngIf="row.HotelId" class="ref-badge hotel">
                  Hotel #{{ row.HotelId }}
                </span>
              </div>
            </td>
          </ng-container>

          <!-- User Column -->
          <ng-container matColumnDef="user">
            <th mat-header-cell *matHeaderCellDef>User</th>
            <td mat-cell *matCellDef="let row">
              <div class="user-cell">
                <mat-icon>person</mat-icon>
                <span>{{ row.UserName || 'System' }}</span>
              </div>
            </td>
          </ng-container>

          <!-- Date Column -->
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Date & Time</th>
            <td mat-cell *matCellDef="let row">
              <div class="date-cell">
                <span class="date">{{ row.DateInsert | date:'MMM d, yyyy' }}</span>
                <span class="time">{{ row.DateInsert | date:'HH:mm:ss' }}</span>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="!filteredLogs.length">
          <mat-icon>inbox</mat-icon>
          <h3>No Activity Logs Found</h3>
          <p>No activity logs match your current filters.</p>
        </div>

        <!-- Pagination -->
        <mat-paginator #paginator
                       [length]="totalLogs"
                       [pageSize]="pageSize"
                       [pageSizeOptions]="[25, 50, 100, 250]"
                       (page)="onPageChange($event)">
        </mat-paginator>
      </mat-card>

      <!-- Timeline View Toggle -->
      <div class="view-toggle">
        <button mat-icon-button [class.active]="viewMode === 'table'" (click)="viewMode = 'table'">
          <mat-icon>table_rows</mat-icon>
        </button>
        <button mat-icon-button [class.active]="viewMode === 'timeline'" (click)="viewMode = 'timeline'">
          <mat-icon>timeline</mat-icon>
        </button>
      </div>

      <!-- Timeline View (Alternative) -->
      <mat-card class="timeline-card" *ngIf="viewMode === 'timeline' && !isLoading">
        <mat-card-header>
          <mat-card-title>Activity Timeline</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="timeline">
            <div *ngFor="let log of filteredLogs; let i = index"
                 class="timeline-item"
                 [class]="getActionClass(log.Action)">
              <div class="timeline-marker">
                <mat-icon>{{ getActionIcon(log.Action) }}</mat-icon>
              </div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="action-name">{{ log.Action }}</span>
                  <span class="timestamp">{{ log.DateInsert | date:'short' }}</span>
                </div>
                <p class="timeline-details">{{ log.Details }}</p>
                <div class="timeline-refs" *ngIf="log.ReservationId || log.BookId || log.OpportunityId">
                  <span *ngIf="log.ReservationId">Reservation #{{ log.ReservationId }}</span>
                  <span *ngIf="log.BookId">Booking #{{ log.BookId }}</span>
                  <span *ngIf="log.OpportunityId">Opportunity #{{ log.OpportunityId }}</span>
                </div>
                <span class="timeline-user" *ngIf="log.UserName">by {{ log.UserName }}</span>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .activity-log {
      padding: 24px;
    }

    .filters-card {
      margin-bottom: 24px;
    }

    .filters {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .search-field {
      flex: 1;
      min-width: 200px;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px !important;
    }

    .stat-card mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #1976d2;
    }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
    }

    .stat-label {
      font-size: 12px;
      color: #666;
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

    .logs-table {
      width: 100%;
    }

    .logs-table th {
      font-weight: 600;
      background: #fafafa;
    }

    mat-chip mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin-right: 4px;
    }

    .details-cell {
      max-width: 400px;
    }

    .details-text {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      font-size: 13px;
    }

    .references {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .ref-badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .ref-badge.reservation {
      background: #e3f2fd;
      color: #1565c0;
    }

    .ref-badge.booking {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .ref-badge.opportunity {
      background: #fff3e0;
      color: #ef6c00;
    }

    .ref-badge.hotel {
      background: #f3e5f5;
      color: #7b1fa2;
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .user-cell mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #666;
    }

    .date-cell {
      display: flex;
      flex-direction: column;
    }

    .date-cell .date {
      font-weight: 500;
    }

    .date-cell .time {
      font-size: 12px;
      color: #666;
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

    .view-toggle {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: white;
      border-radius: 24px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 4px;
      display: flex;
      gap: 4px;
    }

    .view-toggle button.active {
      background: #1976d2;
      color: white;
    }

    /* Timeline Styles */
    .timeline-card {
      margin-top: 24px;
    }

    .timeline {
      position: relative;
      padding-left: 40px;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e0e0e0;
    }

    .timeline-item {
      position: relative;
      padding-bottom: 24px;
    }

    .timeline-marker {
      position: absolute;
      left: -40px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .timeline-marker mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: white;
    }

    .timeline-item.reservation .timeline-marker { background: #1976d2; }
    .timeline-item.booking .timeline-marker { background: #4caf50; }
    .timeline-item.opportunity .timeline-marker { background: #ff9800; }
    .timeline-item.push .timeline-marker { background: #9c27b0; }
    .timeline-item.cancel .timeline-marker { background: #f44336; }

    .timeline-content {
      background: #fafafa;
      border-radius: 8px;
      padding: 16px;
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .action-name {
      font-weight: 600;
    }

    .timestamp {
      font-size: 12px;
      color: #666;
    }

    .timeline-details {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: #333;
    }

    .timeline-refs {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #666;
    }

    .timeline-user {
      font-size: 12px;
      color: #999;
      font-style: italic;
    }

    @media (max-width: 768px) {
      .filters {
        flex-direction: column;
        align-items: stretch;
      }

      .search-field {
        width: 100%;
      }

      .stats-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ActivityLogComponent implements OnInit, OnDestroy {
  logs: ActivityLogEntry[] = [];
  filteredLogs: ActivityLogEntry[] = [];
  availableActions: string[] = [];

  displayedColumns = ['action', 'details', 'references', 'user', 'date'];

  actionFilter = '';
  daysFilter = 7;
  searchQuery = '';
  pageSize = 50;
  totalLogs = 0;
  currentPage = 0;

  isLoading = false;
  viewMode: 'table' | 'timeline' = 'table';

  @ViewChild('paginator') paginator!: MatPaginator;

  private destroy$ = new Subject<void>();

  constructor(private zenithService: ZenithService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadLogs(): void {
    this.isLoading = true;
    this.zenithService.getActivityLog({
      action: this.actionFilter || undefined,
      days: this.daysFilter,
      limit: this.pageSize,
      offset: this.currentPage * this.pageSize
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.logs = response.logs;
          this.availableActions = response.actions;
          this.totalLogs = response.pagination.total;
          this.applyClientFilter();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load activity logs', err);
          this.isLoading = false;
        }
      });
  }

  applyClientFilter(): void {
    if (!this.searchQuery) {
      this.filteredLogs = this.logs;
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredLogs = this.logs.filter(log =>
      log.Details?.toLowerCase().includes(query) ||
      log.Action?.toLowerCase().includes(query) ||
      log.UserName?.toLowerCase().includes(query)
    );
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadLogs();
  }

  getActionColor(action: string): 'primary' | 'accent' | 'warn' {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('cancel') || actionLower.includes('reject')) return 'warn';
    if (actionLower.includes('approve') || actionLower.includes('confirm')) return 'primary';
    return 'accent';
  }

  getActionIcon(action: string): string {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('reservation')) return 'hotel';
    if (actionLower.includes('booking') || actionLower.includes('book')) return 'receipt';
    if (actionLower.includes('push')) return 'cloud_upload';
    if (actionLower.includes('cancel')) return 'cancel';
    if (actionLower.includes('approve')) return 'check_circle';
    if (actionLower.includes('opportunity')) return 'trending_up';
    return 'info';
  }

  getActionClass(action: string): string {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('reservation')) return 'reservation';
    if (actionLower.includes('booking') || actionLower.includes('book')) return 'booking';
    if (actionLower.includes('push')) return 'push';
    if (actionLower.includes('cancel')) return 'cancel';
    if (actionLower.includes('opportunity')) return 'opportunity';
    return '';
  }

  exportLogs(): void {
    const headers = ['Action', 'Details', 'Reservation ID', 'Book ID', 'Opportunity ID', 'Hotel ID', 'User', 'Date'];
    const rows = this.filteredLogs.map(log => [
      log.Action,
      log.Details,
      log.ReservationId || '',
      log.BookId || '',
      log.OpportunityId || '',
      log.HotelId || '',
      log.UserName || 'System',
      new Date(log.DateInsert).toISOString()
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
