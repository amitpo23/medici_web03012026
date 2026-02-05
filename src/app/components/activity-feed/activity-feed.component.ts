import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { environment } from '../../environments/environment.prod';

interface Activity {
  id: string;
  type: 'booking' | 'opportunity' | 'search' | 'alert' | 'system';
  title: string;
  description: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'info' | 'muted';
  icon: string;
}

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatChipsModule
  ],
  template: `
    <mat-card class="activity-feed-card">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>dynamic_feed</mat-icon>
          Live Activity
        </mat-card-title>
        <div class="header-actions">
          <button mat-icon-button (click)="loadActivities()" matTooltip="Refresh">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </mat-card-header>

      <mat-card-content>
        <!-- Filters -->
        <div class="activity-filters">
          <mat-chip-listbox (change)="filterByType($event.value)">
            <mat-chip-option [selected]="selectedType === 'all'" value="all">All</mat-chip-option>
            <mat-chip-option [selected]="selectedType === 'booking'" value="booking">Bookings</mat-chip-option>
            <mat-chip-option [selected]="selectedType === 'opportunity'" value="opportunity">Opportunities</mat-chip-option>
            <mat-chip-option [selected]="selectedType === 'alert'" value="alert">Alerts</mat-chip-option>
          </mat-chip-listbox>
        </div>

        <!-- Loading -->
        <div class="loading-container" *ngIf="loading">
          <mat-spinner diameter="32"></mat-spinner>
        </div>

        <!-- Activity List -->
        <div class="activity-list" *ngIf="!loading">
          <div *ngFor="let activity of filteredActivities"
               class="activity-item"
               [class]="'status-' + activity.status">
            <div class="activity-icon">
              <mat-icon [class]="'type-' + activity.type">{{ activity.icon }}</mat-icon>
            </div>
            <div class="activity-content">
              <div class="activity-title">{{ activity.title }}</div>
              <div class="activity-description">{{ activity.description }}</div>
              <div class="activity-meta">
                <span class="activity-type">{{ activity.type | titlecase }}</span>
                <span class="activity-time">{{ getTimeAgo(activity.timestamp) }}</span>
              </div>
            </div>
            <div class="activity-status">
              <div class="status-dot" [class]="'dot-' + activity.status"></div>
            </div>
          </div>

          <div class="no-activities" *ngIf="filteredActivities.length === 0">
            <mat-icon>inbox</mat-icon>
            <span>No recent activity</span>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .activity-feed-card {
      height: 100%;
    }

    mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      margin: 0;
    }

    .activity-filters {
      margin-bottom: 16px;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 32px;
    }

    .activity-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .activity-item {
      display: flex;
      align-items: flex-start;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .activity-item:last-child {
      border-bottom: none;
    }

    .activity-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      margin-right: 12px;
    }

    .type-booking { color: #2196f3; }
    .type-opportunity { color: #4caf50; }
    .type-search { color: #9c27b0; }
    .type-alert { color: #ff9800; }
    .type-system { color: #607d8b; }

    .activity-content {
      flex: 1;
      min-width: 0;
    }

    .activity-title {
      font-weight: 500;
      font-size: 13px;
      margin-bottom: 4px;
    }

    .activity-description {
      font-size: 12px;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .activity-meta {
      display: flex;
      gap: 12px;
      margin-top: 4px;
      font-size: 11px;
      color: #999;
    }

    .activity-type {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .activity-status {
      display: flex;
      align-items: center;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dot-success { background: #4caf50; }
    .dot-warning { background: #ff9800; }
    .dot-info { background: #2196f3; }
    .dot-muted { background: #bdbdbd; }

    .status-success { border-left: 3px solid #4caf50; padding-left: 12px; }
    .status-warning { border-left: 3px solid #ff9800; padding-left: 12px; }

    .no-activities {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      color: #999;
    }

    .no-activities mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }
  `]
})
export class ActivityFeedComponent implements OnInit, OnDestroy {
  @Input() maxItems = 15;
  @Input() autoRefresh = true;
  @Input() refreshInterval = 30000;

  activities: Activity[] = [];
  filteredActivities: Activity[] = [];
  selectedType = 'all';
  loading = true;
  private refreshSubscription?: Subscription;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadActivities();
    if (this.autoRefresh) {
      this.refreshSubscription = interval(this.refreshInterval).subscribe(() => {
        this.loadActivities();
      });
    }
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  loadActivities(): void {
    this.http.get<any>(`${environment.apiUrl}/activity-feed?limit=${this.maxItems}`).subscribe({
      next: (response) => {
        if (response.success) {
          this.activities = response.activities.map((a: any) => ({
            ...a,
            timestamp: new Date(a.timestamp)
          }));
          this.applyFilter();
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        // Load fallback data
        this.activities = [];
      }
    });
  }

  filterByType(type: string): void {
    this.selectedType = type;
    this.applyFilter();
  }

  applyFilter(): void {
    if (this.selectedType === 'all') {
      this.filteredActivities = this.activities;
    } else {
      this.filteredActivities = this.activities.filter(a => a.type === this.selectedType);
    }
  }

  getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}
