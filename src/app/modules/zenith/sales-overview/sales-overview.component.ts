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
    .sales-overview {
      padding: 24px;
    }

    .period-selector {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }

    .period-selector button.active {
      background: #1976d2;
      color: white;
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

    h3 {
      margin: 24px 0 16px 0;
      font-size: 16px;
      font-weight: 500;
      color: #333;
    }

    h3:first-of-type {
      margin-top: 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .stats-grid.three-cols {
      grid-template-columns: repeat(3, 1fr);
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px !important;
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

    .stat-card.available .stat-icon { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); }
    .stat-card.sold .stat-icon { background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); }
    .stat-card.cancelled .stat-icon { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); }
    .stat-card.profit .stat-icon { background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%); }
    .stat-card.pending .stat-icon { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); }
    .stat-card.approved .stat-icon { background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); }
    .stat-card.res-cancelled .stat-icon { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); }
    .stat-card.revenue .stat-icon { background: linear-gradient(135deg, #00bcd4 0%, #0097a7 100%); }
    .stat-card.pushes .stat-icon { background: linear-gradient(135deg, #607d8b 0%, #455a64 100%); }
    .stat-card.push-success .stat-icon { background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%); }
    .stat-card.push-failed .stat-icon { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); }

    .stat-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #333;
    }

    .stat-label {
      font-size: 13px;
      color: #666;
    }

    .rate {
      font-size: 18px;
      font-weight: 600;
      color: #4caf50;
    }

    .activity-card {
      margin-top: 16px;
    }

    .activity-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .activity-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #fafafa;
      border-radius: 8px;
      border-left: 4px solid #ccc;
    }

    .activity-item.pending { border-left-color: #ff9800; }
    .activity-item.approved { border-left-color: #4caf50; }
    .activity-item.cancelled { border-left-color: #f44336; }

    .activity-item mat-icon {
      color: #666;
    }

    .activity-details {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .activity-hotel {
      font-weight: 500;
    }

    .activity-ref {
      font-size: 12px;
      color: #666;
    }

    .activity-amount {
      font-weight: 600;
      color: #1976d2;
    }

    .activity-date {
      font-size: 12px;
      color: #999;
    }

    .no-activity {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #999;
    }

    .no-activity mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
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
