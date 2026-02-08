import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { environment } from '../../environments/environment.prod';
import { SocketService, SocketNotification } from '../../services/socket.service';
import { LiveToastComponent, LiveToastData } from '../live-toast/live-toast.component';

interface Notification {
  id: string;
  type: 'alert' | 'opportunity' | 'booking' | 'system';
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatBadgeModule,
    MatMenuModule,
    MatButtonModule,
    MatDividerModule,
    MatTooltipModule
  ],
  template: `
    <button mat-icon-button
            [matMenuTriggerFor]="notificationMenu"
            [matBadge]="unreadCount"
            [matBadgeHidden]="unreadCount === 0"
            matBadgeColor="warn"
            matBadgeSize="small"
            matTooltip="Notifications"
            class="notification-bell">
      <mat-icon [class.has-notifications]="unreadCount > 0">
        {{ unreadCount > 0 ? 'notifications_active' : 'notifications' }}
      </mat-icon>
    </button>

    <mat-menu #notificationMenu="matMenu" class="notification-menu">
      <div class="notification-header" (click)="$event.stopPropagation()">
        <span class="header-title">Notifications</span>
        <button mat-button color="primary" (click)="markAllRead()" *ngIf="unreadCount > 0">
          Mark all read
        </button>
      </div>

      <mat-divider></mat-divider>

      <div class="notification-list" *ngIf="notifications.length > 0">
        <div *ngFor="let notification of notifications"
             class="notification-item"
             [class.unread]="!notification.read"
             [class.critical]="notification.severity === 'critical'"
             [class.high]="notification.severity === 'high'"
             (click)="handleNotificationClick(notification)">
          <div class="notification-icon">
            <mat-icon [class]="'severity-' + notification.severity">
              {{ getIcon(notification.type) }}
            </mat-icon>
          </div>
          <div class="notification-content">
            <div class="notification-title">{{ notification.title }}</div>
            <div class="notification-message">{{ notification.message }}</div>
            <div class="notification-time">{{ getTimeAgo(notification.timestamp) }}</div>
          </div>
        </div>
      </div>

      <div class="no-notifications" *ngIf="notifications.length === 0">
        <mat-icon>check_circle</mat-icon>
        <span>All caught up!</span>
      </div>

      <mat-divider *ngIf="notifications.length > 0"></mat-divider>

      <button mat-menu-item class="view-all" routerLink="/alerts">
        <mat-icon>arrow_forward</mat-icon>
        View all alerts
      </button>
    </mat-menu>
  `,
  styles: [`
    .notification-bell {
      position: relative;
    }

    .notification-bell .has-notifications {
      animation: ring 0.5s ease-in-out;
    }

    @keyframes ring {
      0%, 100% { transform: rotate(0); }
      25% { transform: rotate(15deg); }
      50% { transform: rotate(-15deg); }
      75% { transform: rotate(10deg); }
    }

    ::ng-deep .notification-menu {
      min-width: 360px !important;
      max-width: 400px !important;
    }

    .notification-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #f5f5f5;
    }

    .header-title {
      font-weight: 600;
      font-size: 14px;
    }

    .notification-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .notification-item {
      display: flex;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s;
      border-left: 3px solid transparent;
    }

    .notification-item:hover {
      background: #f0f0f0;
    }

    .notification-item.unread {
      background: #e3f2fd;
    }

    .notification-item.critical {
      border-left-color: #f44336;
    }

    .notification-item.high {
      border-left-color: #ff9800;
    }

    .notification-icon {
      margin-right: 12px;
    }

    .severity-critical { color: #f44336; }
    .severity-high { color: #ff9800; }
    .severity-medium { color: #2196f3; }
    .severity-low { color: #4caf50; }

    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-title {
      font-weight: 500;
      font-size: 13px;
      margin-bottom: 4px;
    }

    .notification-message {
      font-size: 12px;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .notification-time {
      font-size: 11px;
      color: #999;
      margin-top: 4px;
    }

    .no-notifications {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px;
      color: #4caf50;
    }

    .no-notifications mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }

    .view-all {
      justify-content: center;
    }
  `]
})
export class NotificationCenterComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  unreadCount = 0;
  private pollSubscription?: Subscription;
  private socketSubscription?: Subscription;

  constructor(
    private http: HttpClient,
    private socketService: SocketService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadNotifications();

    // Real-time Socket.IO notifications
    this.socketSubscription = this.socketService.getNotifications().subscribe((notification) => {
      this.handleSocketNotification(notification);
    });

    // Fallback polling (increased to 60 seconds since we have real-time now)
    this.pollSubscription = interval(60000).subscribe(() => {
      this.loadNotifications();
    });
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
    this.socketSubscription?.unsubscribe();
  }

  private handleSocketNotification(notification: SocketNotification): void {
    const typeMap: Record<string, 'alert' | 'opportunity' | 'booking' | 'system'> = {
      'new-booking': 'booking',
      'booking-cancelled': 'booking',
      'new-opportunity': 'opportunity',
      'alert-triggered': 'alert',
      'log-entry': 'system'
    };

    const titleMap: Record<string, string> = {
      'new-booking': 'New Booking!',
      'booking-cancelled': 'Booking Cancelled',
      'new-opportunity': 'New Opportunity',
      'alert-triggered': 'Alert',
      'log-entry': notification.data['level'] === 'error' ? 'Error Log' : 'Warning Log'
    };

    const type = typeMap[notification.event] || 'system';
    const title = titleMap[notification.event] || notification.event;
    const message = String(
      notification.data['hotelName'] ||
      notification.data['message'] ||
      'New event received'
    );

    // Determine severity based on event type
    let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    if (notification.event === 'alert-triggered') {
      severity = 'high';
    } else if (notification.event === 'log-entry') {
      severity = notification.data['level'] === 'error' ? 'critical' : 'high';
    }

    // Add to notifications list
    this.notifications.unshift({
      id: `socket-${Date.now()}`,
      type,
      title,
      message,
      severity,
      timestamp: new Date(notification.timestamp),
      read: false
    });
    this.unreadCount++;

    // Show toast notification - use special types for log entries
    let toastType: LiveToastData['type'] = type;
    if (notification.event === 'log-entry') {
      toastType = notification.data['level'] === 'error' ? 'error' : 'warning';
    }

    const toastData: LiveToastData = { type: toastType, title, message };
    this.snackBar.openFromComponent(LiveToastComponent, {
      data: toastData,
      duration: 5000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['live-toast-panel']
    });
  }

  loadNotifications(): void {
    this.http.get<any>(`${environment.apiUrl}/alerts/history?limit=10`).subscribe({
      next: (response) => {
        if (response.success && response.alerts) {
          this.notifications = response.alerts.map((alert: any) => ({
            id: alert.id,
            type: this.mapAlertType(alert.rule),
            title: alert.rule || 'Alert',
            message: alert.message,
            severity: alert.severity || 'medium',
            timestamp: new Date(alert.timestamp),
            read: alert.status === 'resolved'
          }));
          this.unreadCount = this.notifications.filter(n => !n.read).length;
        }
      },
      error: () => {
        // Silently fail - don't spam errors
      }
    });
  }

  mapAlertType(rule: string): 'alert' | 'opportunity' | 'booking' | 'system' {
    if (rule?.toLowerCase().includes('booking')) return 'booking';
    if (rule?.toLowerCase().includes('opportunity')) return 'opportunity';
    if (rule?.toLowerCase().includes('system')) return 'system';
    return 'alert';
  }

  getIcon(type: string): string {
    const icons: Record<string, string> = {
      alert: 'warning',
      opportunity: 'trending_up',
      booking: 'hotel',
      system: 'settings'
    };
    return icons[type] || 'notifications';
  }

  getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  handleNotificationClick(notification: Notification): void {
    notification.read = true;
    this.unreadCount = this.notifications.filter(n => !n.read).length;

    if (notification.actionUrl) {
      // Navigate to action URL
    }
  }

  markAllRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.unreadCount = 0;
  }
}
