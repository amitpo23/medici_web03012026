import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BOARD_OPTIONS, CATEGORY_OPTIONS } from 'src/app/core/constants/reference-data.constants';
import { BookingService } from 'src/app/services/booking.service';

@Component({
  selector: 'app-prebook-dialog',
  templateUrl: './prebook-dialog.component.html',
  styleUrls: ['./prebook-dialog.component.scss']
})
export class PrebookDialogComponent implements OnInit {
  preBookForm: FormGroup;
  confirmForm: FormGroup;
  isPreBooking = false;
  isConfirming = false;
  preBookResult: any = null;
  step: 'prebook' | 'confirm' = 'prebook';
  
  boardOptions = BOARD_OPTIONS;
  categoryOptions = CATEGORY_OPTIONS;

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<PrebookDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      hotelId: number;
      hotelName: string;
      dateFrom: string;
      dateTo: string;
      price: number;
      searchToken?: string;
      roomId?: string;
      rateId?: string;
      roomCode?: string;
    }
  ) {
    this.preBookForm = this.fb.group({
      boardId: [null, Validators.required],
      categoryId: [null, Validators.required],
      adults: [2, [Validators.required, Validators.min(1)]],
      children: [[]]
    });

    this.confirmForm = this.fb.group({
      guestName: ['', Validators.required],
      guestEmail: ['', [Validators.email]],
      guestPhone: [''],
      specialRequests: ['']
    });
  }

  ngOnInit(): void {}

  async onPreBook(): Promise<void> {
    if (this.preBookForm.invalid) {
      this.snackBar.open('Please fill all required fields', 'Close', { duration: 3000 });
      return;
    }

    this.isPreBooking = true;

    try {
      const formValue = this.preBookForm.value;
      const children = formValue.children || [];
      
      this.preBookResult = await this.bookingService.preBook({
        hotelId: this.data.hotelId,
        dateFrom: this.data.dateFrom,
        dateTo: this.data.dateTo,
        boardId: formValue.boardId,
        categoryId: formValue.categoryId,
        adults: formValue.adults,
        paxChildren: children,
        searchToken: this.data.searchToken,
        roomId: this.data.roomId,
        rateId: this.data.rateId,
        roomCode: this.data.roomCode
      }).toPromise();

      if (this.preBookResult.success) {
        this.snackBar.open('Room pre-booked successfully!', 'Close', { duration: 3000 });
        this.step = 'confirm';
      } else {
        throw new Error(this.preBookResult.error || 'PreBook failed');
      }
    } catch (error: any) {
      console.error('PreBook error:', error);
      this.snackBar.open(`PreBook failed: ${error.message || error}`, 'Close', { duration: 5000 });
    } finally {
      this.isPreBooking = false;
    }
  }

  async onConfirm(): Promise<void> {
    if (this.confirmForm.invalid) {
      this.snackBar.open('Please enter guest name', 'Close', { duration: 3000 });
      return;
    }

    this.isConfirming = true;

    try {
      const formValue = this.confirmForm.value;
      
      const result = await this.bookingService.confirmBooking({
        preBookId: this.preBookResult.preBookId,
        guestName: formValue.guestName,
        guestEmail: formValue.guestEmail,
        guestPhone: formValue.guestPhone,
        specialRequests: formValue.specialRequests
      }).toPromise();

      if (result.success) {
        this.snackBar.open(`Booking confirmed! Confirmation: ${result.confirmationNumber}`, 'Close', { 
          duration: 5000 
        });
        this.dialogRef.close(result);
      } else {
        throw new Error(result.error || 'Booking confirmation failed');
      }
    } catch (error: any) {
      console.error('Confirm error:', error);
      this.snackBar.open(`Confirmation failed: ${error.message || error}`, 'Close', { duration: 5000 });
    } finally {
      this.isConfirming = false;
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  get totalNights(): number {
    const from = new Date(this.data.dateFrom);
    const to = new Date(this.data.dateTo);
    return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  }

  get estimatedTotal(): number {
    if (this.preBookResult?.price) {
      return this.preBookResult.price * this.totalNights;
    }
    return this.data.price * this.totalNights;
  }
}
