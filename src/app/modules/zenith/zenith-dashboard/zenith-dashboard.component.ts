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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');

    .zenith-dashboard {
      padding: 32px;
      background: linear-gradient(180deg, #0a0e27 0%, #131842 50%, #1a1f4e 100%);
      min-height: 100vh;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .dashboard-header {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 20px;
      padding: 32px 40px;
      margin-bottom: 32px;
      color: white;
      position: relative;
      overflow: hidden;
      backdrop-filter: blur(20px);
    }

    .dashboard-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%);
      pointer-events: none;
    }

    .dashboard-header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), transparent);
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      z-index: 1;
    }

    .title-section {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .header-icon {
      font-size: 52px;
      width: 52px;
      height: 52px;
      color: #818cf8;
      filter: drop-shadow(0 0 20px rgba(129, 140, 248, 0.5));
      animation: pulse-glow 3s ease-in-out infinite;
    }

    @keyframes pulse-glow {
      0%, 100% { filter: drop-shadow(0 0 20px rgba(129, 140, 248, 0.5)); }
      50% { filter: drop-shadow(0 0 30px rgba(129, 140, 248, 0.8)); }
    }

    .title-section h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(135deg, #fff 0%, #c7d2fe 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .subtitle {
      margin: 6px 0 0 0;
      opacity: 0.7;
      font-size: 14px;
      font-weight: 400;
      color: #a5b4fc;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .header-actions button {
      color: white;
      border-color: rgba(129, 140, 248, 0.4);
      border-radius: 12px;
      font-weight: 500;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .header-actions button:hover {
      border-color: #818cf8;
      background: rgba(129, 140, 248, 0.15);
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(99, 102, 241, 0.3);
    }

    .header-actions button[mat-flat-button] {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border: none;
    }

    .header-actions button[mat-flat-button]:hover {
      background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.8) 0%, rgba(20, 25, 55, 0.9) 100%);
      border: 1px solid rgba(99, 102, 241, 0.15);
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7);
      opacity: 0;
      transition: opacity 0.3s;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      border-color: rgba(99, 102, 241, 0.4);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 40px rgba(99, 102, 241, 0.1);
    }

    .stat-card:hover::before {
      opacity: 1;
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 24px !important;
    }

    .stat-icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .stat-icon::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 18px;
      background: inherit;
      filter: blur(12px);
      opacity: 0.4;
      z-index: -1;
    }

    .stat-icon mat-icon {
      font-size: 30px;
      width: 30px;
      height: 30px;
      color: white;
    }

    .stat-icon.queue {
      background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
    }
    .stat-icon.success {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    }
    .stat-icon.failed {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
    .stat-icon.total {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }

    .stat-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: -1px;
    }

    .stat-label {
      font-size: 13px;
      color: #94a3b8;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .success-rate {
      font-size: 24px;
      font-weight: 700;
      color: #10b981;
      font-family: 'JetBrains Mono', monospace;
    }

    .failed-items {
      font-size: 12px;
      color: #ef4444;
      font-weight: 500;
    }

    .stats-by-type {
      margin-bottom: 32px;
    }

    .stats-by-type h3 {
      margin: 0 0 20px 0;
      color: #e2e8f0;
      font-weight: 600;
      font-size: 18px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stats-by-type h3::before {
      content: '';
      width: 4px;
      height: 20px;
      background: linear-gradient(180deg, #6366f1, #8b5cf6);
      border-radius: 2px;
    }

    .type-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 20px;
    }

    .type-card {
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.8) 0%, rgba(20, 25, 55, 0.9) 100%);
      border: 1px solid rgba(99, 102, 241, 0.15);
      border-radius: 16px;
      transition: all 0.3s;
    }

    .type-card:hover {
      border-color: rgba(99, 102, 241, 0.3);
      transform: translateY(-2px);
    }

    .type-card mat-card-header {
      margin-bottom: 20px;
    }

    .type-card mat-card-title {
      color: #fff !important;
      font-weight: 600;
    }

    .type-card mat-card-subtitle {
      color: #94a3b8 !important;
    }

    .type-card mat-icon[mat-card-avatar] {
      background: rgba(99, 102, 241, 0.15);
      border-radius: 12px;
      padding: 10px;
      color: #818cf8;
    }

    .type-card mat-icon.availability {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }

    .type-card mat-icon.rate {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
    }

    .type-stats {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .type-stat {
      text-align: center;
    }

    .type-stat .label {
      display: block;
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .type-stat .value {
      display: block;
      font-size: 18px;
      font-weight: 600;
      color: #e2e8f0;
      font-family: 'JetBrains Mono', monospace;
    }

    .type-stat .value.success {
      color: #10b981;
    }

    nav[mat-tab-nav-bar] {
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.9) 0%, rgba(20, 25, 55, 0.95) 100%);
      border: 1px solid rgba(99, 102, 241, 0.15);
      border-bottom: none;
      border-radius: 16px 16px 0 0;
      margin-top: 32px;
      padding: 8px 8px 0;
    }

    mat-tab-nav-panel {
      background: linear-gradient(180deg, rgba(20, 25, 55, 0.95) 0%, rgba(15, 20, 45, 0.98) 100%);
      border: 1px solid rgba(99, 102, 241, 0.15);
      border-top: none;
      border-radius: 0 0 16px 16px;
      min-height: 500px;
    }

    a[mat-tab-link] {
      color: #94a3b8 !important;
      font-weight: 500;
      border-radius: 10px 10px 0 0;
      margin: 0 4px;
      transition: all 0.3s;
    }

    a[mat-tab-link]:hover {
      color: #e2e8f0 !important;
      background: rgba(99, 102, 241, 0.1);
    }

    a[mat-tab-link].mdc-tab--active {
      color: #fff !important;
      background: rgba(99, 102, 241, 0.2);
    }

    a[mat-tab-link] mat-icon {
      margin-right: 8px;
      color: inherit;
    }

    .tab-divider {
      width: 2px;
      height: 28px;
      background: linear-gradient(180deg, transparent, rgba(99, 102, 241, 0.4), transparent);
      margin: 0 12px;
      align-self: center;
      border-radius: 1px;
    }

    ::ng-deep .mat-mdc-tab-link .mdc-tab-indicator__content--underline {
      border-color: #6366f1 !important;
    }

    ::ng-deep .mat-badge-content {
      background: linear-gradient(135deg, #f59e0b, #d97706) !important;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
    }

    ::ng-deep .mat-mdc-chip {
      background: rgba(99, 102, 241, 0.2) !important;
      color: #a5b4fc !important;
      font-weight: 500;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 1200px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .zenith-dashboard {
        padding: 16px;
      }

      .header-content {
        flex-direction: column;
        gap: 20px;
        text-align: center;
      }

      .title-section {
        flex-direction: column;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .dashboard-header {
        padding: 24px;
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
