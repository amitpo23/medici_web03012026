import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get Profit/Loss report
   */
  getProfitLoss(params: {
    dateFrom?: string;
    dateTo?: string;
    hotelId?: number;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);
    if (params.hotelId) httpParams = httpParams.set('hotelId', params.hotelId.toString());

    return this.http.get(`${this.baseUrl}reports/ProfitLoss`, { params: httpParams });
  }

  /**
   * Get margin analysis by hotel
   */
  getMarginByHotel(params?: {
    dateFrom?: string;
    dateTo?: string;
  }): Observable<any[]> {
    let httpParams = new HttpParams();
    if (params?.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);

    return this.http.get<any[]>(`${this.baseUrl}reports/MarginByHotel`, { params: httpParams });
  }

  /**
   * Get margin trends over time
   */
  getMarginByDate(params?: {
    dateFrom?: string;
    dateTo?: string;
  }): Observable<any[]> {
    let httpParams = new HttpParams();
    if (params?.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);

    return this.http.get<any[]>(`${this.baseUrl}reports/MarginByDate`, { params: httpParams });
  }

  /**
   * Get opportunities performance metrics
   */
  getOpportunitiesPerformance(params?: {
    dateFrom?: string;
    dateTo?: string;
  }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);

    return this.http.get(`${this.baseUrl}reports/OpportunitiesPerformance`, { params: httpParams });
  }

  /**
   * Get top performing hotels
   */
  getTopHotels(params?: {
    limit?: number;
    sortBy?: 'bookings' | 'profit' | 'margin';
  }): Observable<any[]> {
    let httpParams = new HttpParams();
    if (params?.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params?.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);

    return this.http.get<any[]>(`${this.baseUrl}reports/TopHotels`, { params: httpParams });
  }

  /**
   * Get loss report (negative margin bookings)
   */
  getLossReport(params?: {
    dateFrom?: string;
    dateTo?: string;
  }): Observable<any[]> {
    let httpParams = new HttpParams();
    if (params?.dateFrom) httpParams = httpParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) httpParams = httpParams.set('dateTo', params.dateTo);

    return this.http.get<any[]>(`${this.baseUrl}reports/LossReport`, { params: httpParams });
  }

  /**
   * Export report to CSV
   */
  exportToCsv(data: any[], filename: string): void {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    // Get headers from first row
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Export report to Excel (using SheetJS if available)
   */
  exportToExcel(data: any[], filename: string): void {
    // For now, use CSV export
    // In production, integrate with SheetJS (xlsx) library
    this.exportToCsv(data, filename);
  }
}
