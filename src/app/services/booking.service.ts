import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

/**
 * Booking Service
 * Handles PreBook, Book, ManualBook, and Cancel operations
 */
@Injectable({
  providedIn: 'root'
})
export class BookingService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get all bookings
   */
  getBookings(params?: { page?: number; limit?: number; force?: boolean }): Observable<any[]> {
    const page = params?.page || 1;
    const limit = params?.limit || 200;
    const force = params?.force || false;
    return this.http.get<any[]>(`${this.baseUrl}Book/Bookings?page=${page}&limit=${limit}&force=${force}`);
  }

  /**
   * PreBook - Hold room with supplier
   */
  preBook(params: {
    opportunityId?: number;
    hotelId: number;
    dateFrom: string;
    dateTo: string;
    roomCode?: string;
    boardId?: number;
    categoryId?: number;
    adults?: number;
    paxChildren?: number[];
    searchToken?: string;
    roomId?: string;
    rateId?: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}Book/PreBook`, params);
  }

  /**
   * Confirm booking
   */
  confirmBooking(params: {
    preBookId: number;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
    specialRequests?: string;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}Book/Confirm`, params);
  }

  /**
   * Manual booking entry (no API calls)
   */
  manualBook(params: {
    opportunityId?: number;
    hotelId: number;
    dateFrom: string;
    dateTo: string;
    price: number;
    confirmationCode?: string;
    supplierReference?: string;
    provider?: string;
    guestName?: string;
    boardId?: number;
    categoryId?: number;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}Book/ManualBook`, params);
  }

  /**
   * Cancel booking with optional supplier cancellation
   */
  cancelBooking(params: {
    bookId: number;
    reason?: string;
    cancelWithSupplier?: boolean;
  }): Observable<any> {
    return this.http.delete(`${this.baseUrl}Book/CancelDirect`, {
      body: params
    });
  }

  /**
   * Get canceled bookings
   */
  getCanceledBookings(force?: boolean): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}Book/Canceled?force=${force || false}`);
  }

  /**
   * Get booking archive
   */
  getArchive(params?: { page?: number; limit?: number }): Observable<any[]> {
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    return this.http.get<any[]>(`${this.baseUrl}Book/Archive?page=${page}&limit=${limit}`);
  }

  /**
   * Download booking confirmation PDF
   */
  downloadConfirmationPDF(bookingId: number): void {
    const url = `${this.baseUrl}Documents/BookingConfirmation/${bookingId}`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `booking-MED-${bookingId.toString().padStart(6, '0')}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);
      },
      error: (err) => {
        console.error('Failed to download PDF', err);
      }
    });
  }

  /**
   * Get booking confirmation PDF as blob
   */
  getConfirmationPDF(bookingId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}Documents/BookingConfirmation/${bookingId}`, {
      responseType: 'blob'
    });
  }
}
