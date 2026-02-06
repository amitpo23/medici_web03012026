import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { ZenithService, QueueStatus, ProcessQueueResult } from '../../../services/zenith.service';

interface QueueItem {
  id: number;
  hotelName: string;
  hotelCode: string;
  dateFrom: string;
  dateTo: string;
  pushPrice: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  error?: string;
  dateInsert: string;
}

@Component({
  selector: 'app-queue-management',
  template: `
    <div class="queue-management">
      <!-- Queue Status Card -->
      <mat-card class="status-card">
        <mat-card-header>
          <mat-icon mat-card-avatar [class]="queueStatus?.queue?.status || 'empty'">
            {{ getStatusIcon() }}
          </mat-icon>
          <mat-card-title>Queue Status</mat-card-title>
          <mat-card-subtitle>Real-time queue monitoring</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="status-grid">
            <div class="status-item">
              <span class="label">Pending Items</span>
              <span class="value pending">{{ queueStatus?.queue?.pending || 0 }}</span>
            </div>
            <div class="status-item">
              <span class="label">Failed Items</span>
              <span class="value failed">{{ queueStatus?.queue?.failed || 0 }}</span>
            </div>
            <div class="status-item">
              <span class="label">Status</span>
              <mat-chip [color]="getStatusColor()" selected>
                {{ queueStatus?.queue?.status || 'empty' }}
              </mat-chip>
            </div>
            <div class="status-item">
              <span class="label">Auto-Refresh</span>
              <mat-slide-toggle [(ngModel)]="autoRefresh" (change)="toggleAutoRefresh()" color="primary">
              </mat-slide-toggle>
            </div>
          </div>

          <div class="queue-timeline" *ngIf="queueStatus?.queue?.oldestItem || queueStatus?.queue?.newestItem">
            <div class="timeline-item" *ngIf="queueStatus?.queue?.oldestItem">
              <mat-icon>schedule</mat-icon>
              <span>Oldest: {{ queueStatus?.queue?.oldestItem | date:'short' }}</span>
            </div>
            <div class="timeline-item" *ngIf="queueStatus?.queue?.newestItem">
              <mat-icon>update</mat-icon>
              <span>Newest: {{ queueStatus?.queue?.newestItem | date:'short' }}</span>
            </div>
          </div>
        </mat-card-content>
        <mat-card-actions>
          <button mat-flat-button color="primary" (click)="processQueue()" [disabled]="isProcessing || queueStatus?.queue?.pending === 0">
            <mat-icon [class.spin]="isProcessing">{{ isProcessing ? 'sync' : 'play_arrow' }}</mat-icon>
            {{ isProcessing ? 'Processing...' : 'Process Queue Now' }}
          </button>
          <button mat-stroked-button (click)="refreshStatus()" [disabled]="isLoading">
            <mat-icon [class.spin]="isLoading">refresh</mat-icon>
            Refresh
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Last Processing Result -->
      <mat-card class="result-card" *ngIf="lastResult">
        <mat-card-header>
          <mat-icon mat-card-avatar [class]="lastResult.success ? 'success' : 'error'">
            {{ lastResult.success ? 'check_circle' : 'error' }}
          </mat-icon>
          <mat-card-title>Last Processing Result</mat-card-title>
          <mat-card-subtitle>{{ lastResult.message }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="result-stats">
            <div class="result-stat">
              <span class="label">Processed</span>
              <span class="value">{{ lastResult.result.processed }}</span>
            </div>
            <div class="result-stat">
              <span class="label">Successful</span>
              <span class="value success">{{ lastResult.result.successful }}</span>
            </div>
            <div class="result-stat">
              <span class="label">Failed</span>
              <span class="value failed">{{ lastResult.result.failed }}</span>
            </div>
            <div class="result-stat">
              <span class="label">Success Rate</span>
              <span class="value">{{ lastResult.result.successRate }}</span>
            </div>
          </div>

          <mat-progress-bar mode="determinate"
            [value]="getSuccessPercentage()"
            [color]="getSuccessPercentage() >= 90 ? 'primary' : getSuccessPercentage() >= 70 ? 'accent' : 'warn'">
          </mat-progress-bar>

          <!-- Detail Results -->
          <div class="detail-results" *ngIf="lastResult.details?.length">
            <h4>Processing Details</h4>
            <div class="detail-list">
              <div *ngFor="let detail of lastResult.details" class="detail-item" [class.success]="detail.success" [class.failed]="!detail.success">
                <mat-icon>{{ detail.success ? 'check' : 'close' }}</mat-icon>
                <span class="hotel-code">{{ detail.hotelCode }}</span>
                <span class="status">{{ detail.success ? 'Pushed' : detail.error }}</span>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Quick Actions -->
      <mat-card class="actions-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>build</mat-icon>
          <mat-card-title>Queue Management Actions</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="action-buttons">
            <button mat-stroked-button color="warn" (click)="retryFailed()" [disabled]="!queueStatus?.queue?.failed">
              <mat-icon>replay</mat-icon>
              Retry Failed ({{ queueStatus?.queue?.failed || 0 }})
            </button>
            <button mat-stroked-button (click)="clearCompleted()">
              <mat-icon>cleaning_services</mat-icon>
              Clear Completed
            </button>
            <button mat-stroked-button color="warn" (click)="clearQueue()" [disabled]="!queueStatus?.queue?.pending">
              <mat-icon>delete_sweep</mat-icon>
              Clear All Pending
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Information Card -->
      <mat-card class="info-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>info</mat-icon>
          <mat-card-title>About Zenith Queue</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>The Zenith queue manages outbound push operations to the distribution channel. Items are added to the queue when:</p>
          <ul>
            <li>New opportunities are published</li>
            <li>Rates or availability are updated</li>
            <li>Rooms are closed or cancelled</li>
          </ul>
          <p>The queue processes items in batches with automatic retry for failures. Each push includes:</p>
          <ul>
            <li><strong>Availability Update (OTA_HotelAvailNotifRQ)</strong> - Opens/closes room availability</li>
            <li><strong>Rate Update (OTA_HotelRatePlanNotifRQ)</strong> - Updates pricing and meal plans</li>
          </ul>
          <p class="note">
            <mat-icon>warning</mat-icon>
            Items that fail after 3 retries are marked as failed and require manual intervention.
          </p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .queue-management {
      padding: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
    }

    mat-card {
      height: fit-content;
    }

    mat-icon[mat-card-avatar] {
      background: #e3f2fd;
      border-radius: 8px;
      padding: 8px;
      color: #1976d2;
    }

    mat-icon[mat-card-avatar].empty { background: #f5f5f5; color: #9e9e9e; }
    mat-icon[mat-card-avatar].normal { background: #e8f5e9; color: #4caf50; }
    mat-icon[mat-card-avatar].medium { background: #fff3e0; color: #ff9800; }
    mat-icon[mat-card-avatar].high { background: #ffebee; color: #f44336; }
    mat-icon[mat-card-avatar].success { background: #e8f5e9; color: #4caf50; }
    mat-icon[mat-card-avatar].error { background: #ffebee; color: #f44336; }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
      margin: 16px 0;
    }

    .status-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .status-item .label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }

    .status-item .value {
      font-size: 24px;
      font-weight: 600;
    }

    .status-item .value.pending { color: #7c4dff; }
    .status-item .value.failed { color: #f44336; }
    .status-item .value.success { color: #4caf50; }

    .queue-timeline {
      display: flex;
      gap: 24px;
      padding: 16px;
      background: #fafafa;
      border-radius: 8px;
      margin-top: 16px;
    }

    .timeline-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #666;
    }

    .timeline-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    mat-card-actions {
      padding: 16px !important;
    }

    mat-card-actions button {
      margin-right: 8px;
    }

    .result-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin: 16px 0;
    }

    .result-stat {
      text-align: center;
    }

    .result-stat .label {
      display: block;
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
    }

    .result-stat .value {
      display: block;
      font-size: 20px;
      font-weight: 600;
    }

    mat-progress-bar {
      margin-top: 16px;
      border-radius: 4px;
    }

    .detail-results {
      margin-top: 24px;
    }

    .detail-results h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 500;
    }

    .detail-list {
      max-height: 200px;
      overflow-y: auto;
    }

    .detail-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 4px;
    }

    .detail-item.success {
      background: #e8f5e9;
    }

    .detail-item.failed {
      background: #ffebee;
    }

    .detail-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .detail-item.success mat-icon { color: #4caf50; }
    .detail-item.failed mat-icon { color: #f44336; }

    .detail-item .hotel-code {
      font-weight: 500;
      min-width: 100px;
    }

    .detail-item .status {
      flex: 1;
      font-size: 13px;
      color: #666;
    }

    .action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .info-card mat-card-content {
      font-size: 14px;
      color: #555;
      line-height: 1.6;
    }

    .info-card ul {
      margin: 12px 0;
      padding-left: 20px;
    }

    .info-card li {
      margin-bottom: 8px;
    }

    .info-card .note {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px;
      background: #fff3e0;
      border-radius: 8px;
      margin-top: 16px;
    }

    .info-card .note mat-icon {
      color: #f57c00;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .queue-management {
        grid-template-columns: 1fr;
      }

      .status-grid {
        grid-template-columns: 1fr;
      }

      .result-stats {
        grid-template-columns: repeat(2, 1fr);
      }

      .action-buttons {
        flex-direction: column;
      }

      .action-buttons button {
        width: 100%;
      }
    }
  `]
})
export class QueueManagementComponent implements OnInit, OnDestroy {
  queueStatus: QueueStatus | null = null;
  lastResult: ProcessQueueResult | null = null;
  isLoading = false;
  isProcessing = false;
  autoRefresh = true;

  private destroy$ = new Subject<void>();

  constructor(
    private zenithService: ZenithService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.refreshStatus();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshStatus(): void {
    this.isLoading = true;
    this.zenithService.getQueueStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.queueStatus = status;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load queue status', err);
          this.isLoading = false;
        }
      });
  }

  processQueue(): void {
    this.isProcessing = true;
    this.zenithService.processQueue()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.lastResult = result;
          this.isProcessing = false;
          this.refreshStatus();

          const message = result.success
            ? `Processed ${result.result.processed} items (${result.result.successRate} success rate)`
            : 'Queue processing failed';

          this.snackBar.open(message, 'Close', { duration: 5000 });
        },
        error: (err) => {
          this.isProcessing = false;
          console.error('Queue processing failed', err);
          this.snackBar.open('Queue processing failed', 'Close', { duration: 5000 });
        }
      });
  }

  toggleAutoRefresh(): void {
    if (this.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  startAutoRefresh(): void {
    interval(30000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.autoRefresh ? this.zenithService.getQueueStatus() : [])
      )
      .subscribe({
        next: (status) => {
          if (status) this.queueStatus = status;
        }
      });
  }

  getStatusIcon(): string {
    switch (this.queueStatus?.queue?.status) {
      case 'empty': return 'inbox';
      case 'normal': return 'check_circle';
      case 'medium': return 'warning';
      case 'high': return 'error';
      default: return 'help_outline';
    }
  }

  getStatusColor(): 'primary' | 'accent' | 'warn' {
    switch (this.queueStatus?.queue?.status) {
      case 'empty':
      case 'normal':
        return 'primary';
      case 'medium':
        return 'accent';
      case 'high':
        return 'warn';
      default:
        return 'primary';
    }
  }

  getSuccessPercentage(): number {
    if (!this.lastResult?.result) return 0;
    const rate = this.lastResult.result.successRate;
    return Number.parseFloat(rate.replace('%', '')) || 0;
  }

  retryFailed(): void {
    this.snackBar.open('Retry failed items - Coming soon', 'Close', { duration: 3000 });
  }

  clearCompleted(): void {
    this.snackBar.open('Clear completed items - Coming soon', 'Close', { duration: 3000 });
  }

  clearQueue(): void {
    if (confirm('Are you sure you want to clear all pending items from the queue?')) {
      this.snackBar.open('Clear queue - Coming soon', 'Close', { duration: 3000 });
    }
  }
}
