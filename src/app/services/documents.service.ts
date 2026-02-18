import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

interface BatchConfirmationsRequest {
  bookingIds?: number[];
  reservationIds?: number[];
}

interface BatchConfirmationsResponse {
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  /**
   * Download booking confirmation PDF
   * GET /Documents/BookingConfirmation/:id
   */
  downloadBookingConfirmation(id: number): void {
    const url = `${this.baseUrl}Documents/BookingConfirmation/${id}`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `booking-MED-${id.toString().padStart(6, '0')}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);
      },
      error: (err) => {
        console.error('Failed to download booking confirmation PDF', err);
      }
    });
  }

  /**
   * Get booking confirmation PDF as blob
   * GET /Documents/BookingConfirmation/:id
   */
  getBookingConfirmationBlob(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}Documents/BookingConfirmation/${id}`, {
      responseType: 'blob'
    });
  }

  /**
   * Download reservation confirmation PDF
   * GET /Documents/ReservationConfirmation/:id
   */
  downloadReservationConfirmation(id: number): void {
    const url = `${this.baseUrl}Documents/ReservationConfirmation/${id}`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reservation-${id}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);
      },
      error: (err) => {
        console.error('Failed to download reservation confirmation PDF', err);
      }
    });
  }

  /**
   * Get reservation confirmation PDF as blob
   * GET /Documents/ReservationConfirmation/:id
   */
  getReservationConfirmationBlob(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}Documents/ReservationConfirmation/${id}`, {
      responseType: 'blob'
    });
  }

  /**
   * Batch PDF generation (coming soon)
   * POST /Documents/BatchConfirmations
   */
  batchConfirmations(request: BatchConfirmationsRequest): Observable<BatchConfirmationsResponse> {
    return this.http.post<BatchConfirmationsResponse>(
      `${this.baseUrl}Documents/BatchConfirmations`,
      request
    );
  }
}
