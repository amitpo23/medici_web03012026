import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ZenithService, QueueStatus, PushStats } from '../../../services/zenith.service';

@Component({
  selector: 'app-zenith-dashboard',
  template: `
    <div class="zenith-dashboard">
      <!-- Header -->
      <div class="dashboard-header">
        <div class="header-content">
          <div class="title-section">
            <mat-icon class="header-icon">cloud_upload</mat-icon>
            <div>
              <h1>Zenith Distribution Channel</h1>
              <p class="subtitle">Push availability, rates and manage hotel distribution to OTA channels</p>
            </div>
          </div>
          <div class="header-actions">
            <button mat-stroked-button (click)="refreshAll()" [disabled]="isRefreshing">
              <mat-icon [class.spin]="isRefreshing">refresh</mat-icon>
              Refresh
            </button>
            <button mat-flat-button color="primary" (click)="processQueue()" [disabled]="isProcessing || queueStatus?.queue?.pending === 0">
              <mat-icon>play_arrow</mat-icon>
              Process Queue ({{ queueStatus?.queue?.pending || 0 }})
            </button>
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon queue">
              <mat-icon>queue</mat-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ queueStatus?.queue?.pending || 0 }}</span>
              <span class="stat-label">Pending in Queue</span>
            </div>
            <mat-chip [color]="zenithService.getQueueStatusColor(queueStatus?.queue?.status || 'empty')" selected>
              {{ queueStatus?.queue?.status || 'empty' }}
            </mat-chip>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon success">
              <mat-icon>check_circle</mat-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ pushStats?.overall?.SuccessCount || 0 }}</span>
              <span class="stat-label">Successful Pushes (7d)</span>
            </div>
            <span class="success-rate">{{ pushStats?.overall?.OverallSuccessRate || 0 }}%</span>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon failed">
              <mat-icon>error</mat-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ pushStats?.overall?.FailureCount || 0 }}</span>
              <span class="stat-label">Failed Pushes (7d)</span>
            </div>
            <span class="failed-items">{{ queueStatus?.queue?.failed || 0 }} in queue</span>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-icon total">
              <mat-icon>bar_chart</mat-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ pushStats?.overall?.TotalPushes || 0 }}</span>
              <span class="stat-label">Total Pushes (7d)</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Push Stats by Type -->
      <div class="stats-by-type" *ngIf="pushStats?.byType?.length">
        <h3>Push Statistics by Type</h3>
        <div class="type-cards">
          <mat-card *ngFor="let stat of pushStats?.byType" class="type-card">
            <mat-card-header>
              <mat-icon mat-card-avatar [class]="stat.PushType.toLowerCase()">
                {{ stat.PushType === 'AVAILABILITY' ? 'event_available' : 'attach_money' }}
              </mat-icon>
              <mat-card-title>{{ stat.PushType }}</mat-card-title>
              <mat-card-subtitle>{{ stat.TotalPushes }} pushes</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="type-stats">
                <div class="type-stat">
                  <span class="label">Success Rate</span>
                  <span class="value success">{{ stat.SuccessRate }}%</span>
                </div>
                <div class="type-stat">
                  <span class="label">Avg Time</span>
                  <span class="value">{{ stat.AvgProcessingTime }}ms</span>
                </div>
                <div class="type-stat">
                  <span class="label">Max Time</span>
                  <span class="value">{{ stat.MaxProcessingTime }}ms</span>
                </div>
              </div>
              <mat-progress-bar mode="determinate" [value]="stat.SuccessRate"
                [color]="stat.SuccessRate >= 90 ? 'primary' : stat.SuccessRate >= 70 ? 'accent' : 'warn'">
              </mat-progress-bar>
            </mat-card-content>
          </mat-card>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <nav mat-tab-nav-bar [tabPanel]="tabPanel">
        <!-- Push Management Section -->
        <a mat-tab-link routerLink="overview" routerLinkActive #rla1="routerLinkActive" [active]="rla1.isActive">
          <mat-icon>publish</mat-icon>
          Push Management
        </a>
        <a mat-tab-link routerLink="queue" routerLinkActive #rla2="routerLinkActive" [active]="rla2.isActive">
          <mat-icon [matBadge]="queueStatus?.queue?.pending" matBadgeColor="warn"
            [matBadgeHidden]="!queueStatus?.queue?.pending">queue</mat-icon>
          Queue
        </a>
        <a mat-tab-link routerLink="history" routerLinkActive #rla3="routerLinkActive" [active]="rla3.isActive">
          <mat-icon>history</mat-icon>
          Push History
        </a>

        <!-- Divider -->
        <span class="tab-divider"></span>

        <!-- Sales Office Section -->
        <a mat-tab-link routerLink="sales-overview" routerLinkActive #rla4="routerLinkActive" [active]="rla4.isActive">
          <mat-icon>dashboard</mat-icon>
          Sales Overview
        </a>
        <a mat-tab-link routerLink="reservations" routerLinkActive #rla5="routerLinkActive" [active]="rla5.isActive">
          <mat-icon>hotel</mat-icon>
          Reservations
        </a>
        <a mat-tab-link routerLink="cancellations" routerLinkActive #rla6="routerLinkActive" [active]="rla6.isActive">
          <mat-icon>cancel</mat-icon>
          Cancellations
        </a>
        <a mat-tab-link routerLink="activity-log" routerLinkActive #rla7="routerLinkActive" [active]="rla7.isActive">
          <mat-icon>list_alt</mat-icon>
          Activity Log
        </a>
      </nav>

      <mat-tab-nav-panel #tabPanel>
        <router-outlet></router-outlet>
      </mat-tab-nav-panel>
    </div>
  `,
  styles: [`
    .zenith-dashboard {
      padding: 24px;
      background: #f5f5f5;
      min-height: 100vh;
    }

    .dashboard-header {
      background: linear-gradient(135deg, #1565c0 0%, #0d47a1 100%);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      color: white;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title-section {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: 0.9;
    }

    .title-section h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 500;
    }

    .subtitle {
      margin: 4px 0 0 0;
      opacity: 0.85;
      font-size: 14px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .header-actions button {
      color: white;
      border-color: rgba(255, 255, 255, 0.5);
    }

    .header-actions button[mat-flat-button] {
      background: rgba(255, 255, 255, 0.2);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px !important;
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stat-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .stat-icon.queue { background: linear-gradient(135deg, #7c4dff 0%, #651fff 100%); }
    .stat-icon.success { background: linear-gradient(135deg, #00c853 0%, #00e676 100%); }
    .stat-icon.failed { background: linear-gradient(135deg, #ff5252 0%, #ff1744 100%); }
    .stat-icon.total { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); }

    .stat-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #333;
    }

    .stat-label {
      font-size: 13px;
      color: #666;
    }

    .success-rate {
      font-size: 20px;
      font-weight: 600;
      color: #4caf50;
    }

    .failed-items {
      font-size: 12px;
      color: #f44336;
    }

    .stats-by-type {
      margin-bottom: 24px;
    }

    .stats-by-type h3 {
      margin: 0 0 16px 0;
      color: #333;
      font-weight: 500;
    }

    .type-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
    }

    .type-card mat-card-header {
      margin-bottom: 16px;
    }

    .type-card mat-icon[mat-card-avatar] {
      background: #e3f2fd;
      border-radius: 8px;
      padding: 8px;
      color: #1976d2;
    }

    .type-card mat-icon.availability {
      background: #e8f5e9;
      color: #388e3c;
    }

    .type-card mat-icon.rate {
      background: #fff3e0;
      color: #f57c00;
    }

    .type-stats {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .type-stat {
      text-align: center;
    }

    .type-stat .label {
      display: block;
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
    }

    .type-stat .value {
      display: block;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .type-stat .value.success {
      color: #4caf50;
    }

    nav[mat-tab-nav-bar] {
      background: white;
      border-radius: 8px 8px 0 0;
      margin-top: 24px;
    }

    mat-tab-nav-panel {
      background: white;
      border-radius: 0 0 8px 8px;
      min-height: 400px;
    }

    a[mat-tab-link] mat-icon {
      margin-right: 8px;
    }

    .tab-divider {
      width: 1px;
      height: 24px;
      background: #e0e0e0;
      margin: 0 8px;
      align-self: center;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .header-content {
        flex-direction: column;
        gap: 16px;
        text-align: center;
      }

      .title-section {
        flex-direction: column;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ZenithDashboardComponent implements OnInit, OnDestroy {
  queueStatus: QueueStatus | null = null;
  pushStats: PushStats | null = null;
  isRefreshing = false;
  isProcessing = false;

  private destroy$ = new Subject<void>();

  constructor(public zenithService: ZenithService) { }

  ngOnInit(): void {
    this.loadData();

    // Subscribe to queue updates
    this.zenithService.queueUpdates
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadData());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loadQueueStatus();
    this.loadPushStats();
  }

  refreshAll(): void {
    this.isRefreshing = true;
    this.loadData();
    setTimeout(() => this.isRefreshing = false, 1000);
  }

  loadQueueStatus(): void {
    this.zenithService.getQueueStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => this.queueStatus = status,
        error: (err) => console.error('Failed to load queue status', err)
      });
  }

  loadPushStats(): void {
    this.zenithService.getPushStats(7)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => this.pushStats = stats,
        error: (err) => console.error('Failed to load push stats', err)
      });
  }

  processQueue(): void {
    this.isProcessing = true;
    this.zenithService.processQueue()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isProcessing = false;
          this.loadData();
        },
        error: (err) => {
          this.isProcessing = false;
          console.error('Failed to process queue', err);
        }
      });
  }
}
