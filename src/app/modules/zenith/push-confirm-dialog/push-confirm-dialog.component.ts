import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { OpportunityForPush } from '../../../services/zenith.service';

export interface PushConfirmDialogData {
  action: 'publish' | 'update' | 'close';
  count: number;
  opportunities: OpportunityForPush[];
}

export interface PushConfirmDialogResult {
  confirmed: boolean;
  overrides?: {
    mealPlan?: string;
    pushPrice?: number;
  };
}

@Component({
  selector: 'app-push-confirm-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon [class]="data.action">{{ getActionIcon() }}</mat-icon>
      {{ getActionTitle() }}
    </h2>

    <mat-dialog-content>
      <div class="confirmation-message">
        <p>You are about to <strong>{{ data.action }}</strong> {{ data.count }} opportunity{{ data.count > 1 ? 'ies' : '' }} to Zenith.</p>
      </div>

      <!-- Summary of Selected Items -->
      <div class="selected-summary" *ngIf="data.count <= 5">
        <h4>Selected Items:</h4>
        <div class="item-list">
          <div *ngFor="let opp of data.opportunities" class="item">
            <mat-icon>hotel</mat-icon>
            <div class="item-details">
              <span class="hotel-name">{{ opp.HotelName }}</span>
              <span class="dates">{{ opp.DateFrom | date:'MMM d' }} - {{ opp.DateTo | date:'MMM d, y' }}</span>
            </div>
            <span class="price">{{ opp.PushPrice | currency:'EUR' }}</span>
          </div>
        </div>
      </div>

      <div class="selected-summary" *ngIf="data.count > 5">
        <h4>Selected Items Summary:</h4>
        <div class="summary-stats">
          <div class="stat">
            <span class="label">Total Opportunities</span>
            <span class="value">{{ data.count }}</span>
          </div>
          <div class="stat">
            <span class="label">Total Push Value</span>
            <span class="value">{{ getTotalPushValue() | currency:'EUR' }}</span>
          </div>
        </div>
      </div>

      <!-- Override Options -->
      <div class="override-section" *ngIf="data.action !== 'close'">
        <mat-divider></mat-divider>
        <h4>Override Options (Optional)</h4>
        <form [formGroup]="overrideForm" class="override-form">
          <mat-form-field appearance="outline">
            <mat-label>Meal Plan</mat-label>
            <mat-select formControlName="mealPlan">
              <mat-option value="">Use Default</mat-option>
              <mat-option value="RO">Room Only</mat-option>
              <mat-option value="BB">Bed & Breakfast</mat-option>
              <mat-option value="HB">Half Board</mat-option>
              <mat-option value="FB">Full Board</mat-option>
              <mat-option value="AI">All Inclusive</mat-option>
            </mat-select>
          </mat-form-field>
        </form>
      </div>

      <!-- Warning for Close Action -->
      <div class="warning-message" *ngIf="data.action === 'close'">
        <mat-icon>warning</mat-icon>
        <p>This will close availability for the selected opportunities. Rooms will no longer be bookable through Zenith until reopened.</p>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-stroked-button (click)="cancel()">Cancel</button>
      <button mat-flat-button [color]="getButtonColor()" (click)="confirm()">
        <mat-icon>{{ getActionIcon() }}</mat-icon>
        {{ getActionButtonText() }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      padding: 16px 24px;
      background: #f5f5f5;
    }

    h2 mat-icon {
      padding: 8px;
      border-radius: 8px;
    }

    h2 mat-icon.publish {
      background: #e3f2fd;
      color: #1976d2;
    }

    h2 mat-icon.update {
      background: #fff3e0;
      color: #f57c00;
    }

    h2 mat-icon.close {
      background: #ffebee;
      color: #d32f2f;
    }

    mat-dialog-content {
      padding: 24px !important;
      min-width: 400px;
    }

    .confirmation-message p {
      margin: 0;
      font-size: 15px;
      color: #333;
    }

    .selected-summary {
      margin-top: 20px;
      padding: 16px;
      background: #fafafa;
      border-radius: 8px;
    }

    .selected-summary h4 {
      margin: 0 0 12px 0;
      font-size: 13px;
      font-weight: 500;
      color: #666;
      text-transform: uppercase;
    }

    .item-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      background: white;
      border-radius: 4px;
    }

    .item mat-icon {
      color: #1976d2;
    }

    .item-details {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .hotel-name {
      font-weight: 500;
      font-size: 14px;
    }

    .dates {
      font-size: 12px;
      color: #666;
    }

    .price {
      font-weight: 600;
      color: #1976d2;
    }

    .summary-stats {
      display: flex;
      gap: 24px;
    }

    .stat {
      display: flex;
      flex-direction: column;
    }

    .stat .label {
      font-size: 12px;
      color: #666;
    }

    .stat .value {
      font-size: 20px;
      font-weight: 600;
      color: #333;
    }

    .override-section {
      margin-top: 24px;
    }

    .override-section mat-divider {
      margin-bottom: 16px;
    }

    .override-section h4 {
      margin: 0 0 12px 0;
      font-size: 13px;
      font-weight: 500;
      color: #666;
      text-transform: uppercase;
    }

    .override-form {
      display: flex;
      gap: 16px;
    }

    .override-form mat-form-field {
      flex: 1;
    }

    .warning-message {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-top: 20px;
      padding: 16px;
      background: #fff3e0;
      border-radius: 8px;
      color: #e65100;
    }

    .warning-message mat-icon {
      color: #f57c00;
    }

    .warning-message p {
      margin: 0;
      font-size: 13px;
    }

    mat-dialog-actions {
      padding: 16px 24px !important;
      margin: 0 !important;
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }

    mat-dialog-actions button mat-icon {
      margin-right: 4px;
    }
  `]
})
export class PushConfirmDialogComponent {
  overrideForm: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<PushConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PushConfirmDialogData,
    private fb: FormBuilder
  ) {
    this.overrideForm = this.fb.group({
      mealPlan: ['']
    });
  }

  getActionTitle(): string {
    switch (this.data.action) {
      case 'publish': return 'Publish to Zenith';
      case 'update': return 'Update Rates';
      case 'close': return 'Close Availability';
      default: return 'Confirm Action';
    }
  }

  getActionIcon(): string {
    switch (this.data.action) {
      case 'publish': return 'publish';
      case 'update': return 'update';
      case 'close': return 'block';
      default: return 'check';
    }
  }

  getActionButtonText(): string {
    switch (this.data.action) {
      case 'publish': return `Publish ${this.data.count} Item${this.data.count > 1 ? 's' : ''}`;
      case 'update': return `Update ${this.data.count} Rate${this.data.count > 1 ? 's' : ''}`;
      case 'close': return `Close ${this.data.count} Item${this.data.count > 1 ? 's' : ''}`;
      default: return 'Confirm';
    }
  }

  getButtonColor(): 'primary' | 'accent' | 'warn' {
    switch (this.data.action) {
      case 'publish': return 'primary';
      case 'update': return 'accent';
      case 'close': return 'warn';
      default: return 'primary';
    }
  }

  getTotalPushValue(): number {
    return this.data.opportunities.reduce((sum, opp) => sum + (opp.PushPrice || 0), 0);
  }

  cancel(): void {
    this.dialogRef.close({ confirmed: false });
  }

  confirm(): void {
    const overrides: Record<string, unknown> = {};

    if (this.overrideForm.value.mealPlan) {
      overrides['mealPlan'] = this.overrideForm.value.mealPlan;
    }

    this.dialogRef.close({
      confirmed: true,
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined
    });
  }
}
