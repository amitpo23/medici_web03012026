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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');

    .cancellations {
      padding: 32px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .stats-header {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 28px;
    }

    .stat-card {
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.7) 0%, rgba(20, 25, 55, 0.85) 100%);
      border: 1px solid rgba(99, 102, 241, 0.12);
      border-radius: 16px;
      overflow: hidden;
      position: relative;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
    }

    .stat-card.total::before { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
    .stat-card.pending::before { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .stat-card.processed::before { background: linear-gradient(90deg, #10b981, #34d399); }

    .stat-card:hover {
      transform: translateY(-4px);
      border-color: rgba(99, 102, 241, 0.3);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 24px !important;
    }

    .stat-card mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
    }

    .stat-card.total mat-icon { color: #818cf8; }
    .stat-card.pending mat-icon { color: #fbbf24; }
    .stat-card.processed mat-icon { color: #34d399; }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: #fff;
      font-family: 'JetBrains Mono', monospace;
    }

    .stat-label {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .filters-card {
      margin-bottom: 28px;
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.7) 0%, rgba(20, 25, 55, 0.85) 100%);
      border: 1px solid rgba(99, 102, 241, 0.12);
      border-radius: 16px;
    }

    .filters {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    mat-button-toggle-group {
      border-radius: 12px;
      border: 1px solid rgba(99, 102, 241, 0.2);
      overflow: hidden;
      background: rgba(15, 20, 45, 0.5);
    }

    ::ng-deep .mat-button-toggle {
      background: transparent !important;
    }

    ::ng-deep .mat-button-toggle-checked {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
    }

    ::ng-deep .mat-button-toggle-label-content {
      color: #94a3b8 !important;
      font-weight: 500;
    }

    ::ng-deep .mat-button-toggle-checked .mat-button-toggle-label-content {
      color: white !important;
    }

    mat-button-toggle mat-icon {
      margin-right: 6px;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    ::ng-deep .filters .mat-mdc-text-field-wrapper {
      background: rgba(15, 20, 45, 0.6) !important;
      border-radius: 10px !important;
    }

    ::ng-deep .filters .mdc-notched-outline__leading,
    ::ng-deep .filters .mdc-notched-outline__notch,
    ::ng-deep .filters .mdc-notched-outline__trailing {
      border-color: rgba(99, 102, 241, 0.2) !important;
    }

    ::ng-deep .filters .mat-mdc-select-value,
    ::ng-deep .filters .mat-mdc-floating-label {
      color: #94a3b8 !important;
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

    .cancellations-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .cancellation-card {
      background: linear-gradient(145deg, rgba(30, 35, 75, 0.7) 0%, rgba(20, 25, 55, 0.85) 100%);
      border: 1px solid rgba(99, 102, 241, 0.12);
      border-radius: 16px;
      border-left: 4px solid rgba(99, 102, 241, 0.3);
      overflow: hidden;
      transition: all 0.3s;
    }

    .cancellation-card:hover {
      border-color: rgba(99, 102, 241, 0.25);
      transform: translateX(4px);
    }

    .cancellation-card.pending {
      border-left-color: #f59e0b;
    }

    .cancellation-card.processed {
      border-left-color: #10b981;
    }

    ::ng-deep .cancellation-card mat-card-title {
      color: #f1f5f9 !important;
    }

    ::ng-deep .cancellation-card mat-card-subtitle {
      color: #94a3b8 !important;
    }

    mat-icon[mat-card-avatar] {
      background: rgba(99, 102, 241, 0.15);
      border-radius: 12px;
      padding: 10px;
    }

    mat-icon[mat-card-avatar].pending {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
    }

    mat-icon[mat-card-avatar].processed {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
    }

    mat-card-subtitle {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .unique-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      background: rgba(99, 102, 241, 0.15);
      padding: 4px 10px;
      border-radius: 6px;
      color: #a5b4fc;
    }

    ::ng-deep .cancellation-card .mat-mdc-chip {
      font-size: 11px;
      height: 24px;
    }

    .cancel-details {
      padding: 20px 0;
    }

    .detail-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      margin-bottom: 20px;
    }

    .detail-item {
      display: flex;
      gap: 14px;
    }

    .detail-item mat-icon {
      color: #64748b;
    }

    .detail-item > div {
      display: flex;
      flex-direction: column;
    }

    .detail-item .label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .detail-item .value {
      font-weight: 600;
      color: #e2e8f0;
    }

    .detail-item .value.highlight {
      color: #818cf8;
      font-size: 20px;
      font-family: 'JetBrains Mono', monospace;
    }

    .cancel-reason {
      display: flex;
      gap: 14px;
      padding: 18px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: 12px;
      margin-bottom: 20px;
    }

    .cancel-reason mat-icon {
      color: #fbbf24;
    }

    .cancel-reason > div {
      display: flex;
      flex-direction: column;
    }

    .cancel-reason .label {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .cancel-reason .value {
      color: #fbbf24;
    }

    .process-info {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 12px;
      padding: 18px;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      color: #94a3b8;
    }

    .info-row:last-child {
      margin-bottom: 0;
    }

    .info-row mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #34d399;
    }

    .info-row strong {
      color: #34d399;
    }

    mat-card-actions {
      padding: 20px !important;
      display: flex;
      gap: 14px;
    }

    mat-card-actions button[mat-flat-button] {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 10px;
      font-weight: 500;
    }

    mat-card-actions button[mat-stroked-button] {
      border-color: rgba(99, 102, 241, 0.3);
      color: #94a3b8;
      border-radius: 10px;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      padding: 14px 20px;
      background: rgba(15, 20, 45, 0.5);
      border-top: 1px solid rgba(99, 102, 241, 0.1);
      font-size: 12px;
      color: #64748b;
    }

    .card-footer span {
      display: flex;
      align-items: center;
      gap: 6px;
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
      padding: 80px;
      color: #475569;
    }

    .empty-state mat-icon {
      font-size: 72px;
      width: 72px;
      height: 72px;
      margin-bottom: 20px;
      color: #334155;
    }

    .empty-state h3 {
      color: #94a3b8;
    }

    /* Process Dialog - Premium Dark */
    .process-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 999;
    }

    .process-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 520px;
      max-width: 90vw;
      max-height: 90vh;
      background: linear-gradient(180deg, #0f1629 0%, #131842 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 20px;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
      z-index: 1000;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 28px;
      border-bottom: 1px solid rgba(99, 102, 241, 0.15);
      background: rgba(15, 20, 45, 0.5);
    }

    .dialog-header h3 {
      margin: 0;
      font-weight: 600;
      color: #f1f5f9;
      font-size: 18px;
    }

    .dialog-header button {
      color: #64748b;
    }

    .dialog-content {
      flex: 1;
      overflow-y: auto;
      padding: 28px;
    }

    .cancellation-summary {
      background: linear-gradient(145deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 28px;
    }

    .cancellation-summary h4 {
      margin: 0 0 16px 0;
      font-size: 12px;
      font-weight: 600;
      color: #818cf8;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
    }

    .summary-item .label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .summary-item .value {
      font-weight: 600;
      color: #e2e8f0;
    }

    .full-width {
      width: 100%;
      margin-bottom: 20px;
    }

    ::ng-deep .dialog-content .mat-mdc-text-field-wrapper {
      background: rgba(15, 20, 45, 0.6) !important;
      border-radius: 10px !important;
    }

    ::ng-deep .dialog-content .mdc-notched-outline__leading,
    ::ng-deep .dialog-content .mdc-notched-outline__notch,
    ::ng-deep .dialog-content .mdc-notched-outline__trailing {
      border-color: rgba(99, 102, 241, 0.2) !important;
    }

    ::ng-deep .dialog-content input,
    ::ng-deep .dialog-content textarea,
    ::ng-deep .dialog-content .mat-mdc-floating-label {
      color: #94a3b8 !important;
    }

    .quick-refund-options {
      display: flex;
      gap: 10px;
      margin-bottom: 24px;
    }

    .quick-refund-options button {
      flex: 1;
      font-size: 12px;
      border-color: rgba(99, 102, 241, 0.25);
      color: #94a3b8;
      border-radius: 10px;
      transition: all 0.3s;
    }

    .quick-refund-options button:hover {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.15);
      color: #e2e8f0;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 14px;
      padding: 20px 28px;
      border-top: 1px solid rgba(99, 102, 241, 0.15);
      background: rgba(15, 20, 45, 0.5);
    }

    .dialog-actions button[mat-stroked-button] {
      border-color: rgba(99, 102, 241, 0.3);
      color: #94a3b8;
      border-radius: 10px;
    }

    .dialog-actions button[mat-flat-button] {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border-radius: 10px;
      font-weight: 600;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 1200px) {
      .detail-row {
        grid-template-columns: repeat(2, 1fr);
      }
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
