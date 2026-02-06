import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ZenithService, CancellationRequest } from '../../../services/zenith.service';

@Component({
  selector: 'app-cancellations',
  template: `
    <div class="cancellations">
      <!-- Header Stats -->
      <div class="stats-header">
        <mat-card class="stat-card total">
          <mat-card-content>
            <mat-icon>cancel_presentation</mat-icon>
            <div class="stat-info">
              <span class="stat-value">{{ counts?.Total || 0 }}</span>
              <span class="stat-label">Total Cancellations</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card pending">
          <mat-card-content>
            <mat-icon>pending_actions</mat-icon>
            <div class="stat-info">
              <span class="stat-value">{{ counts?.Pending || 0 }}</span>
              <span class="stat-label">Pending Review</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card processed">
          <mat-card-content>
            <mat-icon>check_circle</mat-icon>
            <div class="stat-info">
              <span class="stat-value">{{ counts?.Processed || 0 }}</span>
              <span class="stat-label">Processed</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters">
            <mat-button-toggle-group [(ngModel)]="statusFilter" (change)="loadCancellations()">
              <mat-button-toggle value="">All</mat-button-toggle>
              <mat-button-toggle value="pending">
                <mat-icon>pending</mat-icon>
                Pending
              </mat-button-toggle>
              <mat-button-toggle value="processed">
                <mat-icon>done_all</mat-icon>
                Processed
              </mat-button-toggle>
            </mat-button-toggle-group>

            <mat-form-field appearance="outline">
              <mat-label>Period</mat-label>
              <mat-select [(ngModel)]="daysFilter" (selectionChange)="loadCancellations()">
                <mat-option [value]="7">Last 7 days</mat-option>
                <mat-option [value]="30">Last 30 days</mat-option>
                <mat-option [value]="90">Last 90 days</mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-icon-button (click)="loadCancellations()" [disabled]="isLoading">
              <mat-icon [class.spin]="isLoading">refresh</mat-icon>
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="isLoading && !cancellations.length">
        <mat-spinner diameter="40"></mat-spinner>
        <span>Loading cancellations...</span>
      </div>

      <!-- Cancellations List -->
      <div class="cancellations-list" *ngIf="!isLoading || cancellations.length">
        <mat-card *ngFor="let cancel of cancellations"
                  class="cancellation-card"
                  [class.pending]="!cancel.IsProcessed"
                  [class.processed]="cancel.IsProcessed">
          <mat-card-header>
            <mat-icon mat-card-avatar [class]="cancel.IsProcessed ? 'processed' : 'pending'">
              {{ cancel.IsProcessed ? 'check_circle' : 'pending_actions' }}
            </mat-icon>
            <mat-card-title>{{ cancel.HotelName }}</mat-card-title>
            <mat-card-subtitle>
              <span class="unique-id">{{ cancel.uniqueID }}</span>
              <mat-chip [color]="cancel.IsProcessed ? 'primary' : 'warn'" selected size="small">
                {{ cancel.IsProcessed ? 'Processed' : 'Pending Review' }}
              </mat-chip>
            </mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            <div class="cancel-details">
              <div class="detail-row">
                <div class="detail-item">
                  <mat-icon>person</mat-icon>
                  <div>
                    <span class="label">Guest</span>
                    <span class="value">{{ cancel.GuestName }}</span>
                  </div>
                </div>

                <div class="detail-item">
                  <mat-icon>date_range</mat-icon>
                  <div>
                    <span class="label">Stay Dates</span>
                    <span class="value">{{ cancel.DateFrom | date:'MMM d' }} - {{ cancel.DateTo | date:'MMM d, yyyy' }}</span>
                  </div>
                </div>

                <div class="detail-item">
                  <mat-icon>hotel</mat-icon>
                  <div>
                    <span class="label">Hotel Code</span>
                    <span class="value">{{ cancel.HotelCode }}</span>
                  </div>
                </div>

                <div class="detail-item">
                  <mat-icon>euro</mat-icon>
                  <div>
                    <span class="label">Amount</span>
                    <span class="value highlight">{{ cancel.AmountAfterTax | currency:'EUR' }}</span>
                  </div>
                </div>
              </div>

              <div class="cancel-reason" *ngIf="cancel.CancelReason">
                <mat-icon>comment</mat-icon>
                <div>
                  <span class="label">Cancellation Reason</span>
                  <span class="value">{{ cancel.CancelReason }}</span>
                </div>
              </div>

              <div class="process-info" *ngIf="cancel.IsProcessed">
                <div class="info-row">
                  <mat-icon>payments</mat-icon>
                  <span>Refund Amount: <strong>{{ cancel.RefundAmount | currency:'EUR' }}</strong></span>
                </div>
                <div class="info-row">
                  <mat-icon>schedule</mat-icon>
                  <span>Processed on: <strong>{{ cancel.ProcessedDate | date:'medium' }}</strong></span>
                </div>
              </div>
            </div>
          </mat-card-content>

          <mat-card-actions *ngIf="!cancel.IsProcessed">
            <button mat-flat-button color="primary" (click)="openProcessDialog(cancel)">
              <mat-icon>done</mat-icon>
              Process Cancellation
            </button>
            <button mat-stroked-button (click)="viewReservation(cancel)">
              <mat-icon>visibility</mat-icon>
              View Reservation
            </button>
          </mat-card-actions>

          <div class="card-footer">
            <span class="received-date">
              <mat-icon>inbox</mat-icon>
              Received: {{ cancel.DateInsert | date:'short' }}
            </span>
            <span class="reservation-id">
              Reservation #{{ cancel.ReservationId }}
            </span>
          </div>
        </mat-card>

        <!-- Empty State -->
        <div class="empty-state" *ngIf="!cancellations.length && !isLoading">
          <mat-icon>inbox</mat-icon>
          <h3>No Cancellations Found</h3>
          <p>No cancellation requests match your current filters.</p>
        </div>
      </div>

      <!-- Pagination -->
      <mat-paginator *ngIf="totalCancellations > pageSize"
                     [length]="totalCancellations"
                     [pageSize]="pageSize"
                     [pageSizeOptions]="[10, 25, 50]"
                     (page)="onPageChange($event)">
      </mat-paginator>

      <!-- Process Dialog -->
      <div class="process-overlay" *ngIf="selectedCancellation" (click)="closeProcessDialog()"></div>
      <div class="process-dialog" *ngIf="selectedCancellation">
        <div class="dialog-header">
          <h3>Process Cancellation</h3>
          <button mat-icon-button (click)="closeProcessDialog()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="dialog-content">
          <div class="cancellation-summary">
            <h4>Cancellation Details</h4>
            <div class="summary-grid">
              <div class="summary-item">
                <span class="label">Reference</span>
                <span class="value">{{ selectedCancellation.uniqueID }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Hotel</span>
                <span class="value">{{ selectedCancellation.HotelName }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Guest</span>
                <span class="value">{{ selectedCancellation.GuestName }}</span>
              </div>
              <div class="summary-item">
                <span class="label">Original Amount</span>
                <span class="value">{{ selectedCancellation.AmountAfterTax | currency:'EUR' }}</span>
              </div>
            </div>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Refund Amount</mat-label>
            <input matInput type="number" [(ngModel)]="refundAmount" [max]="selectedCancellation.AmountAfterTax">
            <span matPrefix>€&nbsp;</span>
            <mat-hint>Maximum: {{ selectedCancellation.AmountAfterTax | currency:'EUR' }}</mat-hint>
          </mat-form-field>

          <div class="quick-refund-options">
            <button mat-stroked-button (click)="refundAmount = selectedCancellation.AmountAfterTax">
              Full Refund (100%)
            </button>
            <button mat-stroked-button (click)="refundAmount = selectedCancellation.AmountAfterTax * 0.5">
              50% Refund
            </button>
            <button mat-stroked-button (click)="refundAmount = 0">
              No Refund
            </button>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Processing Notes</mat-label>
            <textarea matInput [(ngModel)]="processingNotes" rows="3"
                      placeholder="Add any notes about this cancellation..."></textarea>
          </mat-form-field>
        </div>

        <div class="dialog-actions">
          <button mat-stroked-button (click)="closeProcessDialog()">Cancel</button>
          <button mat-flat-button color="primary" [disabled]="isProcessing" (click)="processCancellation()">
            <mat-icon [class.spin]="isProcessing">{{ isProcessing ? 'sync' : 'check' }}</mat-icon>
            {{ isProcessing ? 'Processing...' : 'Confirm & Process' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cancellations {
      padding: 24px;
    }

    .stats-header {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px !important;
    }

    .stat-card mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .stat-card.total mat-icon { color: #1976d2; }
    .stat-card.pending mat-icon { color: #ff9800; }
    .stat-card.processed mat-icon { color: #4caf50; }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
    }

    .stat-label {
      font-size: 13px;
      color: #666;
    }

    .filters-card {
      margin-bottom: 24px;
    }

    .filters {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    mat-button-toggle mat-icon {
      margin-right: 4px;
      font-size: 18px;
      width: 18px;
      height: 18px;
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

    .cancellations-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .cancellation-card {
      border-left: 4px solid #ccc;
    }

    .cancellation-card.pending {
      border-left-color: #ff9800;
    }

    .cancellation-card.processed {
      border-left-color: #4caf50;
    }

    mat-icon[mat-card-avatar] {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 8px;
    }

    mat-icon[mat-card-avatar].pending {
      background: #fff3e0;
      color: #ff9800;
    }

    mat-icon[mat-card-avatar].processed {
      background: #e8f5e9;
      color: #4caf50;
    }

    mat-card-subtitle {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .unique-id {
      font-family: monospace;
      font-size: 12px;
      background: #f5f5f5;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .cancel-details {
      padding: 16px 0;
    }

    .detail-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 24px;
      margin-bottom: 16px;
    }

    .detail-item {
      display: flex;
      gap: 12px;
    }

    .detail-item mat-icon {
      color: #666;
    }

    .detail-item > div {
      display: flex;
      flex-direction: column;
    }

    .detail-item .label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
    }

    .detail-item .value {
      font-weight: 500;
    }

    .detail-item .value.highlight {
      color: #1976d2;
      font-size: 18px;
    }

    .cancel-reason {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: #fff3e0;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .cancel-reason mat-icon {
      color: #f57c00;
    }

    .cancel-reason > div {
      display: flex;
      flex-direction: column;
    }

    .cancel-reason .label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
    }

    .process-info {
      background: #e8f5e9;
      border-radius: 8px;
      padding: 16px;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .info-row:last-child {
      margin-bottom: 0;
    }

    .info-row mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #4caf50;
    }

    mat-card-actions {
      padding: 16px !important;
      display: flex;
      gap: 12px;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      padding: 12px 16px;
      background: #fafafa;
      border-top: 1px solid #e0e0e0;
      font-size: 12px;
      color: #666;
    }

    .card-footer span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .card-footer mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    /* Process Dialog */
    .process-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 999;
    }

    .process-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-width: 90vw;
      max-height: 90vh;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
    }

    .dialog-header h3 {
      margin: 0;
      font-weight: 500;
    }

    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .cancellation-summary {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .cancellation-summary h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 500;
      color: #666;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
    }

    .summary-item .label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
    }

    .summary-item .value {
      font-weight: 500;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .quick-refund-options {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }

    .quick-refund-options button {
      flex: 1;
      font-size: 12px;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .stats-header {
        grid-template-columns: 1fr;
      }

      .filters {
        flex-direction: column;
        align-items: stretch;
      }

      .detail-row {
        grid-template-columns: 1fr;
      }

      .quick-refund-options {
        flex-direction: column;
      }
    }
  `]
})
export class CancellationsComponent implements OnInit, OnDestroy {
  cancellations: CancellationRequest[] = [];
  counts: { Total: number; Pending: number; Processed: number } | null = null;

  statusFilter = '';
  daysFilter = 30;
  pageSize = 25;
  totalCancellations = 0;
  currentPage = 0;

  isLoading = false;
  isProcessing = false;

  selectedCancellation: CancellationRequest | null = null;
  refundAmount = 0;
  processingNotes = '';

  private destroy$ = new Subject<void>();

  constructor(
    private zenithService: ZenithService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadCancellations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCancellations(): void {
    this.isLoading = true;
    this.zenithService.getCancellations({
      status: this.statusFilter as 'pending' | 'processed' | undefined,
      days: this.daysFilter,
      limit: this.pageSize,
      offset: this.currentPage * this.pageSize
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.cancellations = response.cancellations;
          this.counts = response.counts;
          this.totalCancellations = response.pagination.total;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load cancellations', err);
          this.isLoading = false;
          this.snackBar.open('Failed to load cancellations', 'Close', { duration: 5000 });
        }
      });
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadCancellations();
  }

  openProcessDialog(cancellation: CancellationRequest): void {
    this.selectedCancellation = cancellation;
    this.refundAmount = cancellation.AmountAfterTax;
    this.processingNotes = '';
  }

  closeProcessDialog(): void {
    this.selectedCancellation = null;
    this.refundAmount = 0;
    this.processingNotes = '';
  }

  processCancellation(): void {
    if (!this.selectedCancellation) return;

    this.isProcessing = true;
    this.zenithService.processCancellation(
      this.selectedCancellation.Id,
      this.refundAmount,
      this.processingNotes
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isProcessing = false;
          this.snackBar.open(response.message || 'Cancellation processed successfully', 'Close', { duration: 5000 });
          this.closeProcessDialog();
          this.loadCancellations();
        },
        error: (err) => {
          this.isProcessing = false;
          console.error('Failed to process cancellation', err);
          this.snackBar.open('Failed to process cancellation', 'Close', { duration: 5000 });
        }
      });
  }

  viewReservation(cancellation: CancellationRequest): void {
    this.snackBar.open(`Viewing reservation #${cancellation.ReservationId}`, 'Close', { duration: 3000 });
  }
}
