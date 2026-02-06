import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ZenithService, SalesOverview } from '../../../services/zenith.service';

@Component({
  selector: 'app-sales-overview',
  template: `
    <div class="sales-overview">
      <!-- Period Selector -->
      <div class="period-selector">
        <button mat-stroked-button [class.active]="selectedDays === 7" (click)="loadData(7)">7 Days</button>
        <button mat-stroked-button [class.active]="selectedDays === 30" (click)="loadData(30)">30 Days</button>
        <button mat-stroked-button [class.active]="selectedDays === 90" (click)="loadData(90)">90 Days</button>
        <button mat-icon-button (click)="loadData(selectedDays)" [disabled]="isLoading">
          <mat-icon [class.spin]="isLoading">refresh</mat-icon>
        </button>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="isLoading && !data">
        <mat-spinner diameter="40"></mat-spinner>
        <span>Loading sales overview...</span>
      </div>

      <div *ngIf="data" class="overview-content">
        <!-- Booking Stats -->
        <h3>Inventory Status</h3>
        <div class="stats-grid">
          <mat-card class="stat-card available">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>inventory</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ data.bookings.AvailableRooms }}</span>
                <span class="stat-label">Available Rooms</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card sold">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>sell</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ data.bookings.SoldRooms }}</span>
                <span class="stat-label">Sold Rooms</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card cancelled">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>cancel</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ data.bookings.CancelledRooms }}</span>
                <span class="stat-label">Cancelled</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card profit">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>trending_up</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ data.bookings.TotalProfit | currency:'EUR' }}</span>
                <span class="stat-label">Total Profit</span>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Reservation Stats -->
        <h3>Zenith Reservations</h3>
        <div class="stats-grid">
          <mat-card class="stat-card pending">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>pending_actions</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ data.reservations.PendingReservations }}</span>
                <span class="stat-label">Pending Approval</span>
              </div>
              <button mat-stroked-button color="primary" routerLink="../reservations" *ngIf="data.reservations.PendingReservations > 0">
                Review
              </button>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card approved">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>check_circle</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ data.reservations.ApprovedReservations }}</span>
                <span class="stat-label">Approved</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card res-cancelled">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>block</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ data.reservations.CancelledReservations }}</span>
                <span class="stat-label">Cancelled</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card revenue">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>euro</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ data.reservations.TotalReservationValue | currency:'EUR' }}</span>
                <span class="stat-label">Reservation Value</span>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Push Stats -->
        <h3>Distribution Channel</h3>
        <div class="stats-grid three-cols">
          <mat-card class="stat-card pushes">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>cloud_upload</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ data.pushes.TotalPushes }}</span>
                <span class="stat-label">Total Pushes</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card push-success">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>cloud_done</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ data.pushes.SuccessfulPushes }}</span>
                <span class="stat-label">Successful</span>
              </div>
              <span class="rate">{{ getSuccessRate() }}%</span>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card push-failed">
            <mat-card-content>
              <div class="stat-icon">
                <mat-icon>cloud_off</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ data.pushes.FailedPushes }}</span>
                <span class="stat-label">Failed</span>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Recent Activity -->
        <h3>Recent Activity</h3>
        <mat-card class="activity-card">
          <mat-card-content>
            <div class="activity-list" *ngIf="data.recentActivity?.length">
              <div *ngFor="let activity of data.recentActivity" class="activity-item" [class]="activity.Status">
                <mat-icon>{{ getActivityIcon(activity.Status) }}</mat-icon>
                <div class="activity-details">
                  <span class="activity-hotel">{{ activity.HotelName || 'Unknown Hotel' }}</span>
                  <span class="activity-ref">#{{ activity.Reference }}</span>
                </div>
                <span class="activity-amount">{{ activity.Amount | currency:'EUR' }}</span>
                <mat-chip [color]="getStatusColor(activity.Status)" selected>
                  {{ activity.Status }}
                </mat-chip>
                <span class="activity-date">{{ activity.Date | date:'short' }}</span>
              </div>
            </div>
            <div class="no-activity" *ngIf="!data.recentActivity?.length">
              <mat-icon>inbox</mat-icon>
              <span>No recent activity</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');

    .sales-overview {
      padding: 32px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100%;
    }

    .period-selector {
      display: flex;
      gap: 12px;
      margin-bottom: 32px;
      align-items: center;
    }

    .period-selector button {
      background: rgba(30, 35, 75, 0.6);
      border: 1px solid rgba(99, 102, 241, 0.2);
      color: #94a3b8;
      border-radius: 10px;
      font-weight: 500;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .period-selector button:hover {
      background: rgba(99, 102, 241, 0.15);
      border-color: rgba(99, 102, 241, 0.4);
      color: #e2e8f0;
    }

    .period-selector button.active {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-color: transparent;
      color: white;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
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

    ::ng-deep .loading-state .mat-mdc-progress-spinner circle {
      stroke: #6366f1 !important;
    }

    h3 {
      margin: 32px 0 20px 0;
      font-size: 14px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    h3::before {
      content: '';
      width: 4px;
      height: 16px;
      background: linear-gradient(180deg, #6366f1, #8b5cf6);
      border-radius: 2px;
    }

    h3:first-of-type {
      margin-top: 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }

    .stats-grid.three-cols {
      grid-template-columns: repeat(3, 1fr);
    }

    .stat-card {
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.7) 0%, rgba(20, 25, 55, 0.85) 100%);
      border: 1px solid rgba(99, 102, 241, 0.12);
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
      opacity: 0;
      transition: opacity 0.3s;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      border-color: rgba(99, 102, 241, 0.3);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
    }

    .stat-card:hover::before {
      opacity: 1;
    }

    .stat-card.available::before { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
    .stat-card.sold::before { background: linear-gradient(90deg, #10b981, #34d399); }
    .stat-card.cancelled::before { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .stat-card.profit::before { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
    .stat-card.pending::before { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .stat-card.approved::before { background: linear-gradient(90deg, #10b981, #34d399); }
    .stat-card.res-cancelled::before { background: linear-gradient(90deg, #ef4444, #f87171); }
    .stat-card.revenue::before { background: linear-gradient(90deg, #06b6d4, #22d3ee); }
    .stat-card.pushes::before { background: linear-gradient(90deg, #6366f1, #818cf8); }
    .stat-card.push-success::before { background: linear-gradient(90deg, #10b981, #34d399); }
    .stat-card.push-failed::before { background: linear-gradient(90deg, #ef4444, #f87171); }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 24px !important;
    }

    .stat-icon {
      width: 60px;
      height: 60px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .stat-icon::after {
      content: '';
      position: absolute;
      inset: -3px;
      border-radius: 17px;
      background: inherit;
      filter: blur(15px);
      opacity: 0.35;
      z-index: -1;
    }

    .stat-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .stat-card.available .stat-icon { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }
    .stat-card.sold .stat-icon { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .stat-card.cancelled .stat-icon { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
    .stat-card.profit .stat-icon { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); }
    .stat-card.pending .stat-icon { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
    .stat-card.approved .stat-icon { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .stat-card.res-cancelled .stat-icon { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
    .stat-card.revenue .stat-icon { background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); }
    .stat-card.pushes .stat-icon { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); }
    .stat-card.push-success .stat-icon { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
    .stat-card.push-failed .stat-icon { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }

    .stat-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: -0.5px;
    }

    .stat-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }

    .rate {
      font-size: 22px;
      font-weight: 700;
      color: #10b981;
      font-family: 'JetBrains Mono', monospace;
    }

    .activity-card {
      margin-top: 20px;
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.7) 0%, rgba(20, 25, 55, 0.85) 100%);
      border: 1px solid rgba(99, 102, 241, 0.12);
      border-radius: 16px;
    }

    .activity-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 8px;
    }

    .activity-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: rgba(15, 20, 45, 0.6);
      border-radius: 12px;
      border-left: 4px solid rgba(99, 102, 241, 0.3);
      transition: all 0.3s;
    }

    .activity-item:hover {
      background: rgba(99, 102, 241, 0.1);
      border-left-color: #6366f1;
    }

    .activity-item.pending { border-left-color: #f59e0b; }
    .activity-item.approved { border-left-color: #10b981; }
    .activity-item.cancelled { border-left-color: #ef4444; }

    .activity-item mat-icon {
      color: #64748b;
    }

    .activity-details {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .activity-hotel {
      font-weight: 600;
      color: #e2e8f0;
    }

    .activity-ref {
      font-size: 12px;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
    }

    .activity-amount {
      font-weight: 700;
      color: #6366f1;
      font-family: 'JetBrains Mono', monospace;
      font-size: 16px;
    }

    .activity-date {
      font-size: 12px;
      color: #475569;
    }

    ::ng-deep .activity-item .mat-mdc-chip {
      font-size: 11px;
      height: 24px;
    }

    .no-activity {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px;
      color: #475569;
    }

    .no-activity mat-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      margin-bottom: 12px;
      color: #334155;
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
      .stats-grid.three-cols {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .sales-overview {
        padding: 20px;
      }
      .stats-grid,
      .stats-grid.three-cols {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class SalesOverviewComponent implements OnInit, OnDestroy {
  data: SalesOverview | null = null;
  isLoading = false;
  selectedDays = 30;

  private destroy$ = new Subject<void>();

  constructor(private zenithService: ZenithService) { }

  ngOnInit(): void {
    this.loadData(30);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(days: number): void {
    this.selectedDays = days;
    this.isLoading = true;

    this.zenithService.getSalesOverview(days)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.data = data;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load sales overview', err);
          this.isLoading = false;
        }
      });
  }

  getSuccessRate(): number {
    if (!this.data?.pushes?.TotalPushes) return 0;
    return Math.round((this.data.pushes.SuccessfulPushes / this.data.pushes.TotalPushes) * 100);
  }

  getActivityIcon(status: string): string {
    switch (status) {
      case 'pending': return 'pending';
      case 'approved': return 'check_circle';
      case 'cancelled': return 'cancel';
      default: return 'info';
    }
  }

  getStatusColor(status: string): 'primary' | 'accent' | 'warn' {
    switch (status) {
      case 'approved': return 'primary';
      case 'pending': return 'accent';
      case 'cancelled': return 'warn';
      default: return 'primary';
    }
  }
}
