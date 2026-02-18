import { Component, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { DocumentsService } from 'src/app/services/documents.service';

interface DownloadHistoryItem {
  id: number;
  type: 'booking' | 'reservation';
  filename: string;
  timestamp: Date;
  status: 'success' | 'error';
}

@Component({
  selector: 'app-documents',
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.scss']
})
export class DocumentsComponent implements OnDestroy {

  private destroy$ = new Subject<void>();

  // Snackbar config
  horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  verticalPosition: MatSnackBarVerticalPosition = 'bottom';
  durationInSeconds = 5;

  // Booking Confirmation
  bookingId: number | null = null;
  bookingLoading = false;

  // Reservation Confirmation
  reservationId: number | null = null;
  reservationLoading = false;

  // Download History
  downloadHistory: DownloadHistoryItem[] = [];
  historyColumns: string[] = ['type', 'id', 'filename', 'timestamp', 'status'];

  constructor(
    private documentsService: DocumentsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  downloadBookingConfirmation(): void {
    if (!this.bookingId || this.bookingId <= 0) {
      this.showError('Please enter a valid Booking ID');
      return;
    }

    this.bookingLoading = true;
    const id = this.bookingId;
    const filename = `booking-MED-${id.toString().padStart(6, '0')}.pdf`;

    this.documentsService.getBookingConfirmationBlob(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.triggerDownload(blob, filename);
          this.addToHistory(id, 'booking', filename, 'success');
          this.showSuccess(`Booking confirmation ${filename} downloaded successfully`);
          this.bookingLoading = false;
        },
        error: (err) => {
          this.addToHistory(id, 'booking', filename, 'error');
          this.showError('Failed to download booking confirmation: ' + (err.error?.message || err.statusText || 'Unknown error'));
          this.bookingLoading = false;
        }
      });
  }

  downloadReservationConfirmation(): void {
    if (!this.reservationId || this.reservationId <= 0) {
      this.showError('Please enter a valid Reservation ID');
      return;
    }

    this.reservationLoading = true;
    const id = this.reservationId;
    const filename = `reservation-${id}.pdf`;

    this.documentsService.getReservationConfirmationBlob(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          this.triggerDownload(blob, filename);
          this.addToHistory(id, 'reservation', filename, 'success');
          this.showSuccess(`Reservation confirmation ${filename} downloaded successfully`);
          this.reservationLoading = false;
        },
        error: (err) => {
          this.addToHistory(id, 'reservation', filename, 'error');
          this.showError('Failed to download reservation confirmation: ' + (err.error?.message || err.statusText || 'Unknown error'));
          this.reservationLoading = false;
        }
      });
  }

  clearHistory(): void {
    this.downloadHistory = [];
    this.showSuccess('Download history cleared');
  }

  getStatusClass(status: string): string {
    if (status === 'success') {
      return 'status-success';
    }
    return 'status-error';
  }

  getTypeLabel(type: string): string {
    if (type === 'booking') {
      return 'Booking';
    }
    return 'Reservation';
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private addToHistory(id: number, type: 'booking' | 'reservation', filename: string, status: 'success' | 'error'): void {
    this.downloadHistory.unshift({
      id,
      type,
      filename,
      timestamp: new Date(),
      status
    });
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      horizontalPosition: this.horizontalPosition,
      verticalPosition: this.verticalPosition,
      duration: this.durationInSeconds * 1000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      horizontalPosition: this.horizontalPosition,
      verticalPosition: this.verticalPosition,
      duration: this.durationInSeconds * 1000,
      panelClass: ['error-snackbar']
    });
  }
}
