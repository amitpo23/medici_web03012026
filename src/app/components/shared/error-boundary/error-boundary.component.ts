import { Component, Input, ErrorHandler, Injectable } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

/**
 * Global Error Handler
 * Catches uncaught errors and logs them
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private errors: ErrorInfo[] = [];

  handleError(error: Error): void {
    console.error('Global error caught:', error);

    this.errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
      url: window.location.href
    });

    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }

    // Optionally send to backend
    this.reportError(error);
  }

  getErrors(): ErrorInfo[] {
    return this.errors;
  }

  clearErrors(): void {
    this.errors = [];
  }

  private reportError(_error: Error): void {
    // Could send to backend logging service
    // fetch('/api/logs/client-error', { method: 'POST', body: JSON.stringify({ error: error.message }) });
  }
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  timestamp: Date;
  url: string;
}

/**
 * Error Boundary Component
 * Displays friendly error page when something goes wrong
 */
@Component({
  selector: 'app-error-boundary',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="error-boundary" *ngIf="hasError">
      <div class="error-content">
        <div class="error-icon">
          <mat-icon>error_outline</mat-icon>
        </div>

        <h1>{{ title }}</h1>
        <p class="error-message">{{ message }}</p>

        <div class="error-details" *ngIf="showDetails && errorDetails">
          <details>
            <summary>Technical Details</summary>
            <pre>{{ errorDetails }}</pre>
          </details>
        </div>

        <div class="error-actions">
          <button mat-flat-button color="primary" (click)="retry()">
            <mat-icon>refresh</mat-icon>
            Try Again
          </button>
          <button mat-stroked-button (click)="goHome()">
            <mat-icon>home</mat-icon>
            Go to Dashboard
          </button>
        </div>

        <p class="error-hint">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  `,
  styles: [`
    .error-boundary {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--bg-primary, #0a0e27) 0%, var(--bg-secondary, #1a1f4e) 100%);
      padding: 24px;
    }

    .error-content {
      text-align: center;
      max-width: 500px;
      color: var(--text-primary, #f1f5f9);
    }

    .error-icon {
      margin-bottom: 24px;
    }

    .error-icon mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: var(--error, #ef4444);
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 12px 0;
    }

    .error-message {
      font-size: 16px;
      color: var(--text-secondary, #94a3b8);
      margin: 0 0 24px 0;
      line-height: 1.6;
    }

    .error-details {
      margin-bottom: 24px;
      text-align: left;
    }

    .error-details details {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 12px;
    }

    .error-details summary {
      cursor: pointer;
      font-size: 14px;
      color: var(--text-muted, #64748b);
      margin-bottom: 8px;
    }

    .error-details pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--error, #ef4444);
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
      max-height: 200px;
      overflow-y: auto;
    }

    .error-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-bottom: 24px;
    }

    .error-actions button {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .error-hint {
      font-size: 14px;
      color: var(--text-muted, #64748b);
      margin: 0;
    }

    @media (max-width: 480px) {
      .error-actions {
        flex-direction: column;
      }

      .error-actions button {
        width: 100%;
      }
    }
  `]
})
export class ErrorBoundaryComponent {
  @Input() hasError = false;
  @Input() title = 'Something went wrong';
  @Input() message = 'We encountered an unexpected error. Please try again.';
  @Input() errorDetails?: string;
  @Input() showDetails = false;

  constructor(private router: Router) {}

  retry(): void {
    window.location.reload();
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }
}

/**
 * Not Found Component
 * 404 page for missing routes
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  template: `
    <div class="not-found">
      <div class="content">
        <div class="error-code">404</div>
        <h1>Page Not Found</h1>
        <p>The page you're looking for doesn't exist or has been moved.</p>

        <div class="actions">
          <button mat-flat-button color="primary" (click)="goHome()">
            <mat-icon>home</mat-icon>
            Go to Dashboard
          </button>
          <button mat-stroked-button (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
            Go Back
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .not-found {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--bg-primary, #0a0e27) 0%, var(--bg-secondary, #1a1f4e) 100%);
      padding: 24px;
    }

    .content {
      text-align: center;
      color: var(--text-primary, #f1f5f9);
    }

    .error-code {
      font-size: 120px;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      background: linear-gradient(135deg, #818cf8 0%, #a78bfa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
      margin-bottom: 16px;
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 12px 0;
    }

    p {
      font-size: 16px;
      color: var(--text-secondary, #94a3b8);
      margin: 0 0 32px 0;
    }

    .actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .actions button {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class NotFoundComponent {
  constructor(private router: Router) {}

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  goBack(): void {
    window.history.back();
  }
}
