import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Skeleton Loader Component
 * Shows animated placeholder shapes while content loads
 *
 * Usage:
 * <app-skeleton-loader type="card" [count]="3"></app-skeleton-loader>
 * <app-skeleton-loader type="table" [rows]="5"></app-skeleton-loader>
 * <app-skeleton-loader type="text" [lines]="3"></app-skeleton-loader>
 */
@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Card Skeleton -->
    <div *ngIf="type === 'card'" class="skeleton-grid">
      <div *ngFor="let i of countArray" class="skeleton-card">
        <div class="skeleton-header">
          <div class="skeleton-icon pulse"></div>
          <div class="skeleton-title pulse"></div>
        </div>
        <div class="skeleton-value pulse"></div>
        <div class="skeleton-subtitle pulse"></div>
      </div>
    </div>

    <!-- Table Skeleton -->
    <div *ngIf="type === 'table'" class="skeleton-table">
      <div class="skeleton-table-header">
        <div *ngFor="let col of columnsArray" class="skeleton-th pulse"></div>
      </div>
      <div *ngFor="let row of rowsArray" class="skeleton-table-row">
        <div *ngFor="let col of columnsArray" class="skeleton-td pulse"></div>
      </div>
    </div>

    <!-- Text Skeleton -->
    <div *ngIf="type === 'text'" class="skeleton-text">
      <div *ngFor="let line of linesArray; let last = last"
           class="skeleton-line pulse"
           [style.width]="last ? '60%' : '100%'">
      </div>
    </div>

    <!-- Chart Skeleton -->
    <div *ngIf="type === 'chart'" class="skeleton-chart">
      <div class="skeleton-chart-bars">
        <div *ngFor="let bar of barsArray"
             class="skeleton-bar pulse"
             [style.height]="bar + '%'">
        </div>
      </div>
      <div class="skeleton-chart-axis pulse"></div>
    </div>

    <!-- Stats Card Skeleton -->
    <div *ngIf="type === 'stats'" class="skeleton-stats-grid">
      <div *ngFor="let i of countArray" class="skeleton-stat-card">
        <div class="skeleton-stat-icon pulse"></div>
        <div class="skeleton-stat-content">
          <div class="skeleton-stat-value pulse"></div>
          <div class="skeleton-stat-label pulse"></div>
          <div class="skeleton-stat-change pulse"></div>
        </div>
      </div>
    </div>

    <!-- List Skeleton -->
    <div *ngIf="type === 'list'" class="skeleton-list">
      <div *ngFor="let i of rowsArray" class="skeleton-list-item">
        <div class="skeleton-avatar pulse"></div>
        <div class="skeleton-list-content">
          <div class="skeleton-list-title pulse"></div>
          <div class="skeleton-list-subtitle pulse"></div>
        </div>
        <div class="skeleton-list-action pulse"></div>
      </div>
    </div>
  `,
  styles: [`
    /* Base Animation */
    .pulse {
      background: linear-gradient(90deg,
        rgba(255,255,255,0.05) 0%,
        rgba(255,255,255,0.1) 50%,
        rgba(255,255,255,0.05) 100%);
      background-size: 200% 100%;
      animation: pulse 1.5s ease-in-out infinite;
      border-radius: 4px;
    }

    @keyframes pulse {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Card Skeleton */
    .skeleton-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
    }

    .skeleton-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
    }

    .skeleton-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .skeleton-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
    }

    .skeleton-title {
      height: 14px;
      width: 100px;
    }

    .skeleton-value {
      height: 32px;
      width: 120px;
      margin-bottom: 8px;
    }

    .skeleton-subtitle {
      height: 12px;
      width: 80px;
    }

    /* Table Skeleton */
    .skeleton-table {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      overflow: hidden;
    }

    .skeleton-table-header {
      display: flex;
      gap: 16px;
      padding: 16px 20px;
      background: rgba(255,255,255,0.05);
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .skeleton-th {
      height: 14px;
      flex: 1;
    }

    .skeleton-table-row {
      display: flex;
      gap: 16px;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .skeleton-table-row:last-child {
      border-bottom: none;
    }

    .skeleton-td {
      height: 16px;
      flex: 1;
    }

    /* Text Skeleton */
    .skeleton-text {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-line {
      height: 14px;
    }

    /* Chart Skeleton */
    .skeleton-chart {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      height: 300px;
      display: flex;
      flex-direction: column;
    }

    .skeleton-chart-bars {
      flex: 1;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding-bottom: 20px;
    }

    .skeleton-bar {
      flex: 1;
      min-height: 20px;
      border-radius: 4px 4px 0 0;
    }

    .skeleton-chart-axis {
      height: 2px;
      width: 100%;
    }

    /* Stats Card Skeleton */
    .skeleton-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .skeleton-stat-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      gap: 16px;
    }

    .skeleton-stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      flex-shrink: 0;
    }

    .skeleton-stat-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .skeleton-stat-value {
      height: 28px;
      width: 80px;
    }

    .skeleton-stat-label {
      height: 12px;
      width: 100px;
    }

    .skeleton-stat-change {
      height: 10px;
      width: 60px;
    }

    /* List Skeleton */
    .skeleton-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton-list-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
    }

    .skeleton-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .skeleton-list-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .skeleton-list-title {
      height: 16px;
      width: 60%;
    }

    .skeleton-list-subtitle {
      height: 12px;
      width: 40%;
    }

    .skeleton-list-action {
      width: 80px;
      height: 32px;
      border-radius: 6px;
    }
  `]
})
export class SkeletonLoaderComponent {
  @Input() type: 'card' | 'table' | 'text' | 'chart' | 'stats' | 'list' = 'card';
  @Input() count = 4;
  @Input() rows = 5;
  @Input() columns = 5;
  @Input() lines = 3;

  get countArray(): number[] {
    return Array(this.count).fill(0).map((_, i) => i);
  }

  get rowsArray(): number[] {
    return Array(this.rows).fill(0).map((_, i) => i);
  }

  get columnsArray(): number[] {
    return Array(this.columns).fill(0).map((_, i) => i);
  }

  get linesArray(): number[] {
    return Array(this.lines).fill(0).map((_, i) => i);
  }

  get barsArray(): number[] {
    return [65, 45, 80, 55, 70, 40, 85, 60, 75, 50];
  }
}
