import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ZenithPushDialogData {
  count: number;
  action: 'publish' | 'update' | 'close';
}

export interface ZenithPushDialogResult {
  confirmed: boolean;
  action: 'publish' | 'update' | 'close';
}

@Component({
  selector: 'app-zenith-push-dialog',
  template: `
    <h2 mat-dialog-title>Zenith Push Confirmation</h2>
    <mat-dialog-content>
      <p>You are about to push <strong>{{ data.count }}</strong> opportunities to Zenith.</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Action</mat-label>
        <mat-select [(value)]="selectedAction">
          <mat-option value="publish">Publish (new)</mat-option>
          <mat-option value="update">Update (existing)</mat-option>
          <mat-option value="close">Close (remove)</mat-option>
        </mat-select>
      </mat-form-field>
      <p class="warning" *ngIf="selectedAction === 'close'">
        This will remove the selected opportunities from Zenith.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="onCancel()" (keyup.enter)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" type="button" (click)="onConfirm()" (keyup.enter)="onConfirm()">
        Confirm Push
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; margin-top: 12px; }
    .warning { color: #f44336; font-weight: 500; }
    mat-dialog-actions { padding-top: 16px; }
  `]
})
export class ZenithPushDialogComponent {
  selectedAction: 'publish' | 'update' | 'close';

  constructor(
    public dialogRef: MatDialogRef<ZenithPushDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ZenithPushDialogData
  ) {
    this.selectedAction = data.action || 'publish';
  }

  onCancel(): void {
    this.dialogRef.close({ confirmed: false, action: this.selectedAction });
  }

  onConfirm(): void {
    this.dialogRef.close({ confirmed: true, action: this.selectedAction });
  }
}
