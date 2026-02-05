import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';

export interface LiveToastData {
  type: 'booking' | 'opportunity' | 'alert' | 'system' | 'error' | 'warning';
  title: string;
  message: string;
}

@Component({
  selector: 'app-live-toast',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="live-toast" [ngClass]="data.type">
      <mat-icon class="toast-icon">{{ getIcon() }}</mat-icon>
      <div class="content">
        <div class="title">{{ data.title }}</div>
        <div class="message">{{ data.message }}</div>
      </div>
      <button mat-icon-button class="close-btn" (click)="dismiss()">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .live-toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      min-width: 300px;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .live-toast.booking {
      background: linear-gradient(135deg, #4caf50, #45a049);
    }

    .live-toast.opportunity {
      background: linear-gradient(135deg, #2196f3, #1976d2);
    }

    .live-toast.alert {
      background: linear-gradient(135deg, #ff9800, #f57c00);
    }

    .live-toast.system {
      background: linear-gradient(135deg, #607d8b, #546e7a);
    }

    .live-toast.error {
      background: linear-gradient(135deg, #f44336, #d32f2f);
    }

    .live-toast.warning {
      background: linear-gradient(135deg, #ff9800, #f57c00);
    }

    .toast-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .content {
      flex: 1;
      min-width: 0;
    }

    .title {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 2px;
    }

    .message {
      font-size: 12px;
      opacity: 0.9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .close-btn {
      color: white;
      opacity: 0.8;
    }

    .close-btn:hover {
      opacity: 1;
    }
  `]
})
export class LiveToastComponent {
  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: LiveToastData,
    private snackRef: MatSnackBarRef<LiveToastComponent>
  ) {}

  getIcon(): string {
    const icons: Record<string, string> = {
      booking: 'hotel',
      opportunity: 'trending_up',
      alert: 'warning',
      system: 'settings',
      error: 'error',
      warning: 'warning_amber'
    };
    return icons[this.data.type] || 'notifications';
  }

  dismiss(): void {
    this.snackRef.dismiss();
  }
}
