import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ZenithService } from '../../../services/zenith.service';

interface PushLogEntry {
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
}

@Component({
  selector: 'app-push-history',
  template: `
    <div class="push-history">
      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>filter_list</mat-icon>
            Filter Push History
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="filterForm" class="filter-form">
            <mat-form-field appearance="outline">
              <mat-label>Push Type</mat-label>
              <mat-select formControlName="pushType">
                <mat-option value="">All Types</mat-option>
                <mat-option value="AVAILABILITY">Availability</mat-option>
                <mat-option value="RATE">Rate</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="success">
                <mat-option [value]="null">All Statuses</mat-option>
                <mat-option [value]="true">Success</mat-option>
                <mat-option [value]="false">Failed</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Time Period</mat-label>
              <mat-select formControlName="days">
                <mat-option [value]="1">Last 24 hours</mat-option>
                <mat-option [value]="7">Last 7 days</mat-option>
                <mat-option [value]="30">Last 30 days</mat-option>
                <mat-option [value]="90">Last 90 days</mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-flat-button color="primary" (click)="loadHistory()">
              <mat-icon>search</mat-icon>
              Search
            </button>

            <button mat-stroked-button (click)="exportHistory()">
              <mat-icon>download</mat-icon>
              Export
            </button>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Stats Summary -->
      <div class="stats-summary">
        <div class="stat-chip success">
          <mat-icon>check_circle</mat-icon>
          <span>{{ successCount }} successful</span>
        </div>
        <div class="stat-chip failed">
          <mat-icon>error</mat-icon>
          <span>{{ failedCount }} failed</span>
        </div>
        <div class="stat-chip total">
          <mat-icon>analytics</mat-icon>
          <span>{{ totalCount }} total</span>
        </div>
        <div class="stat-chip avg-time" *ngIf="avgProcessingTime">
          <mat-icon>timer</mat-icon>
          <span>{{ avgProcessingTime }}ms avg</span>
        </div>
      </div>

      <!-- History Table -->
      <mat-card class="table-card">
        <mat-card-content>
          <div class="table-loading" *ngIf="isLoading">
            <mat-spinner diameter="40"></mat-spinner>
            <span>Loading history...</span>
          </div>

          <div class="table-container" *ngIf="!isLoading">
            <table mat-table [dataSource]="dataSource" matSort (matSortChange)="sortData($event)" class="history-table">
              <!-- ID Column -->
              <ng-container matColumnDef="Id">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>ID</th>
                <td mat-cell *matCellDef="let row">#{{ row.Id }}</td>
              </ng-container>

              <!-- Date Column -->
              <ng-container matColumnDef="PushDate">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Date/Time</th>
                <td mat-cell *matCellDef="let row">
                  <div class="date-cell">
                    <span class="date">{{ row.PushDate | date:'MMM d, y' }}</span>
                    <span class="time">{{ row.PushDate | date:'HH:mm:ss' }}</span>
                  </div>
                </td>
              </ng-container>

              <!-- Type Column -->
              <ng-container matColumnDef="PushType">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Type</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip [class]="row.PushType.toLowerCase()">
                    <mat-icon>{{ row.PushType === 'AVAILABILITY' ? 'event_available' : 'attach_money' }}</mat-icon>
                    {{ row.PushType }}
                  </mat-chip>
                </td>
              </ng-container>

              <!-- Opportunity/Book ID -->
              <ng-container matColumnDef="Reference">
                <th mat-header-cell *matHeaderCellDef>Reference</th>
                <td mat-cell *matCellDef="let row">
                  <span *ngIf="row.OpportunityId">Opp #{{ row.OpportunityId }}</span>
                  <span *ngIf="row.BookId">Book #{{ row.BookId }}</span>
                  <span *ngIf="!row.OpportunityId && !row.BookId" class="na">-</span>
                </td>
              </ng-container>

              <!-- Hotel Name -->
              <ng-container matColumnDef="HotelName">
                <th mat-header-cell *matHeaderCellDef>Hotel</th>
                <td mat-cell *matCellDef="let row">
                  {{ row.HotelName || '-' }}
                </td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="Success">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip [color]="row.Success ? 'primary' : 'warn'" selected>
                    <mat-icon>{{ row.Success ? 'check' : 'close' }}</mat-icon>
                    {{ row.Success ? 'Success' : 'Failed' }}
                  </mat-chip>
                </td>
              </ng-container>

              <!-- Retries -->
              <ng-container matColumnDef="RetryCount">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Retries</th>
                <td mat-cell *matCellDef="let row">
                  <span [class.retry-warning]="row.RetryCount > 0">{{ row.RetryCount }}</span>
                </td>
              </ng-container>

              <!-- Processing Time -->
              <ng-container matColumnDef="ProcessingTimeMs">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Time</th>
                <td mat-cell *matCellDef="let row">
                  <span [class]="getTimeClass(row.ProcessingTimeMs)">
                    {{ row.ProcessingTimeMs }}ms
                  </span>
                </td>
              </ng-container>

              <!-- Error Message -->
              <ng-container matColumnDef="ErrorMessage">
                <th mat-header-cell *matHeaderCellDef>Error</th>
                <td mat-cell *matCellDef="let row">
                  <span *ngIf="row.ErrorMessage" class="error-message" [matTooltip]="row.ErrorMessage">
                    {{ row.ErrorMessage | slice:0:50 }}{{ row.ErrorMessage.length > 50 ? '...' : '' }}
                  </span>
                  <span *ngIf="!row.ErrorMessage" class="na">-</span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                [class.failed-row]="!row.Success">
              </tr>

              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell" colspan="9" style="text-align: center; padding: 40px;">
                  <mat-icon style="font-size: 48px; width: 48px; height: 48px; color: #ccc;">history</mat-icon>
                  <p style="color: #666;">No push history found for the selected filters.</p>
                </td>
              </tr>
            </table>

            <mat-paginator
              [length]="totalCount"
              [pageSize]="pageSize"
              [pageSizeOptions]="[10, 25, 50, 100]"
              (page)="onPageChange($event)"
              showFirstLastButtons>
            </mat-paginator>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .push-history {
      padding: 24px;
    }

    .filters-card {
      margin-bottom: 16px;
    }

    .filters-card mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
    }

    .filter-form {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      margin-top: 16px;
    }

    .filter-form mat-form-field {
      width: 160px;
    }

    .stats-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }

    .stat-chip mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .stat-chip.success {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .stat-chip.failed {
      background: #ffebee;
      color: #c62828;
    }

    .stat-chip.total {
      background: #e3f2fd;
      color: #1565c0;
    }

    .stat-chip.avg-time {
      background: #fff3e0;
      color: #ef6c00;
    }

    .table-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: #666;
    }

    .table-loading span {
      margin-top: 16px;
    }

    .table-container {
      overflow-x: auto;
    }

    .history-table {
      width: 100%;
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

    mat-chip.availability {
      background: #e8f5e9 !important;
      color: #388e3c !important;
    }

    mat-chip.rate {
      background: #fff3e0 !important;
      color: #f57c00 !important;
    }

    mat-chip mat-icon {
      font-size: 14px !important;
      width: 14px !important;
      height: 14px !important;
      margin-right: 4px;
    }

    .na {
      color: #999;
    }

    .retry-warning {
      color: #f57c00;
      font-weight: 500;
    }

    .time-fast {
      color: #4caf50;
    }

    .time-medium {
      color: #ff9800;
    }

    .time-slow {
      color: #f44336;
    }

    .error-message {
      color: #d32f2f;
      font-size: 12px;
      cursor: help;
    }

    tr.failed-row {
      background: #fff8f8;
    }

    @media (max-width: 768px) {
      .filter-form {
        flex-direction: column;
        align-items: stretch;
      }

      .filter-form mat-form-field {
        width: 100%;
      }

      .stats-summary {
        flex-direction: column;
      }
    }
  `]
})
export class PushHistoryComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = [
    'Id', 'PushDate', 'PushType', 'Reference', 'HotelName', 'Success', 'RetryCount', 'ProcessingTimeMs', 'ErrorMessage'
  ];

  dataSource = new MatTableDataSource<PushLogEntry>([]);
  filterForm: FormGroup;
  isLoading = false;

  totalCount = 0;
  successCount = 0;
  failedCount = 0;
  avgProcessingTime = 0;

  pageSize = 25;
  currentPage = 0;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private destroy$ = new Subject<void>();

  constructor(
    private zenithService: ZenithService,
    private fb: FormBuilder
  ) {
    this.filterForm = this.fb.group({
      pushType: [''],
      success: [null],
      days: [7]
    });
  }

  ngOnInit(): void {
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadHistory(): void {
    this.isLoading = true;

    const filters = {
      limit: this.pageSize,
      offset: this.currentPage * this.pageSize,
      pushType: this.filterForm.value.pushType || undefined,
      success: this.filterForm.value.success,
      days: this.filterForm.value.days
    };

    this.zenithService.getPushHistory(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.dataSource.data = response.history || [];
          this.totalCount = response.pagination?.total || 0;

          // Calculate stats
          this.successCount = response.history?.filter(h => h.Success).length || 0;
          this.failedCount = response.history?.filter(h => !h.Success).length || 0;

          const times = response.history?.map(h => h.ProcessingTimeMs).filter(t => t > 0) || [];
          this.avgProcessingTime = times.length > 0
            ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
            : 0;

          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load history', err);
          this.isLoading = false;
        }
      });
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;
    this.loadHistory();
  }

  sortData(sort: Sort): void {
    // Client-side sorting for current page data
    const data = [...this.dataSource.data];

    if (!sort.active || sort.direction === '') {
      this.dataSource.data = data;
      return;
    }

    this.dataSource.data = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'Id': return this.compare(a.Id, b.Id, isAsc);
        case 'PushDate': return this.compare(new Date(a.PushDate).getTime(), new Date(b.PushDate).getTime(), isAsc);
        case 'PushType': return this.compare(a.PushType, b.PushType, isAsc);
        case 'Success': return this.compare(a.Success ? 1 : 0, b.Success ? 1 : 0, isAsc);
        case 'RetryCount': return this.compare(a.RetryCount, b.RetryCount, isAsc);
        case 'ProcessingTimeMs': return this.compare(a.ProcessingTimeMs, b.ProcessingTimeMs, isAsc);
        default: return 0;
      }
    });
  }

  compare(a: number | string, b: number | string, isAsc: boolean): number {
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }

  getTimeClass(ms: number): string {
    if (ms < 1000) return 'time-fast';
    if (ms < 5000) return 'time-medium';
    return 'time-slow';
  }

  exportHistory(): void {
    const data = this.dataSource.data;
    const csv = this.convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zenith-push-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  convertToCSV(data: PushLogEntry[]): string {
    const headers = ['ID', 'Date', 'Type', 'OpportunityId', 'BookId', 'Success', 'Retries', 'Time (ms)', 'Error'];
    const rows = data.map(row => [
      row.Id,
      row.PushDate,
      row.PushType,
      row.OpportunityId || '',
      row.BookId || '',
      row.Success ? 'Yes' : 'No',
      row.RetryCount,
      row.ProcessingTimeMs,
      row.ErrorMessage || ''
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}
