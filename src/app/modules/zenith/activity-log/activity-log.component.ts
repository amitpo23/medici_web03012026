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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');

    .activity-log {
      padding: 32px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .filters-card {
      margin-bottom: 28px;
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.7) 0%, rgba(20, 25, 55, 0.85) 100%);
      border: 1px solid rgba(99, 102, 241, 0.12);
      border-radius: 16px;
    }

    .filters {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    ::ng-deep .filters .mat-mdc-text-field-wrapper {
      background: rgba(15, 20, 45, 0.6) !important;
      border-radius: 10px !important;
    }

    ::ng-deep .filters .mdc-notched-outline__leading,
    ::ng-deep .filters .mdc-notched-outline__notch,
    ::ng-deep .filters .mdc-notched-outline__trailing {
      border-color: rgba(99, 102, 241, 0.2) !important;
    }

    ::ng-deep .filters .mat-mdc-select-value,
    ::ng-deep .filters .mat-mdc-floating-label,
    ::ng-deep .filters input {
      color: #94a3b8 !important;
    }

    .search-field {
      flex: 1;
      min-width: 220px;
    }

    .filters button[mat-flat-button] {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 10px;
      font-weight: 500;
    }

    .filters button[mat-stroked-button] {
      border-color: rgba(99, 102, 241, 0.3);
      color: #94a3b8;
      border-radius: 10px;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 28px;
    }

    .stat-card {
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.7) 0%, rgba(20, 25, 55, 0.85) 100%);
      border: 1px solid rgba(99, 102, 241, 0.12);
      border-radius: 14px;
      transition: all 0.3s;
    }

    .stat-card:hover {
      border-color: rgba(99, 102, 241, 0.3);
      transform: translateY(-2px);
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 20px !important;
    }

    .stat-card mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #818cf8;
    }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
    }

    .stat-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
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

    .logs-table {
      width: 100%;
      background: transparent !important;
    }

    ::ng-deep .logs-table th {
      background: rgba(15, 20, 45, 0.6) !important;
      color: #94a3b8 !important;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      border-bottom: 1px solid rgba(99, 102, 241, 0.15) !important;
    }

    ::ng-deep .logs-table td {
      color: #e2e8f0 !important;
      border-bottom: 1px solid rgba(99, 102, 241, 0.08) !important;
    }

    ::ng-deep .logs-table tr:hover td {
      background: rgba(99, 102, 241, 0.08) !important;
    }

    ::ng-deep .logs-table .mat-mdc-chip {
      background: rgba(99, 102, 241, 0.15) !important;
      font-size: 11px;
      height: 26px;
    }

    ::ng-deep .logs-table .mat-mdc-chip mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
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
      color: #94a3b8;
    }

    .references {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .ref-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
    }

    .ref-badge.reservation {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
    }

    .ref-badge.booking {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
    }

    .ref-badge.opportunity {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
    }

    .ref-badge.hotel {
      background: rgba(139, 92, 246, 0.15);
      color: #a78bfa;
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .user-cell mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #64748b;
    }

    .date-cell {
      display: flex;
      flex-direction: column;
    }

    .date-cell .date {
      font-weight: 500;
      color: #e2e8f0;
    }

    .date-cell .time {
      font-size: 12px;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
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

    .view-toggle {
      position: fixed;
      bottom: 28px;
      right: 28px;
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.95) 0%, rgba(20, 25, 55, 0.98) 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      padding: 6px;
      display: flex;
      gap: 6px;
    }

    .view-toggle button {
      color: #64748b;
      border-radius: 10px;
    }

    .view-toggle button.active {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
    }

    /* Timeline Styles - Premium Dark */
    .timeline-card {
      margin-top: 28px;
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.7) 0%, rgba(20, 25, 55, 0.85) 100%);
      border: 1px solid rgba(99, 102, 241, 0.12);
      border-radius: 16px;
    }

    ::ng-deep .timeline-card mat-card-title {
      color: #f1f5f9 !important;
    }

    .timeline {
      position: relative;
      padding-left: 48px;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 18px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(180deg, #6366f1 0%, rgba(99, 102, 241, 0.2) 100%);
      border-radius: 1px;
    }

    .timeline-item {
      position: relative;
      padding-bottom: 28px;
    }

    .timeline-marker {
      position: absolute;
      left: -48px;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .timeline-marker mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: white;
    }

    .timeline-item.reservation .timeline-marker { background: linear-gradient(135deg, #3b82f6, #2563eb); }
    .timeline-item.booking .timeline-marker { background: linear-gradient(135deg, #10b981, #059669); }
    .timeline-item.opportunity .timeline-marker { background: linear-gradient(135deg, #f59e0b, #d97706); }
    .timeline-item.push .timeline-marker { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
    .timeline-item.cancel .timeline-marker { background: linear-gradient(135deg, #ef4444, #dc2626); }

    .timeline-content {
      background: rgba(15, 20, 45, 0.6);
      border: 1px solid rgba(99, 102, 241, 0.1);
      border-radius: 12px;
      padding: 18px;
      transition: all 0.3s;
    }

    .timeline-content:hover {
      border-color: rgba(99, 102, 241, 0.25);
      background: rgba(99, 102, 241, 0.08);
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .action-name {
      font-weight: 600;
      color: #f1f5f9;
    }

    .timestamp {
      font-size: 12px;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
    }

    .timeline-details {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #94a3b8;
      line-height: 1.5;
    }

    .timeline-refs {
      display: flex;
      gap: 14px;
      font-size: 12px;
      color: #818cf8;
    }

    .timeline-user {
      font-size: 12px;
      color: #64748b;
      font-style: italic;
      margin-top: 8px;
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
