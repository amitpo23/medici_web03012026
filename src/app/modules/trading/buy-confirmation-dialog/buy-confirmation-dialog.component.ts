import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-buy-confirmation-dialog',
  templateUrl: './buy-confirmation-dialog.component.html',
  styleUrls: ['./buy-confirmation-dialog.component.scss']
})
export class BuyConfirmationDialogComponent {
  guestForm!: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<BuyConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder
  ) {
    this.initForm();
  }

  initForm(): void {
    this.guestForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]+$/)]]
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.guestForm.valid) {
      this.dialogRef.close({
        confirmed: true,
        guestInfo: this.guestForm.value
      });
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }
}
