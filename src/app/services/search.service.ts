import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

/**
 * Search Service
 * Handles hotel search with Innstant API integration
 */
@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  /**
   * Search hotels using Innstant API with GPT best practices
   * - Smart defaults: Adults=2, PaxChildren=[]
   * - Date format: yyyy-mm-dd
   * - HotelName XOR City logic
   */
  searchInnstantPrice(params: {
    dateFrom: string;
    dateTo: string;
    hotelId?: number;
    hotelName?: string;
    city?: string;
    stars?: number;
    adults?: number;
    paxChildren?: number[];
    limit?: number;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}Search/InnstantPrice`, {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      hotelId: params.hotelId,
      hotelName: params.hotelName,
      city: params.city,
      stars: params.stars,
      adults: params.adults || 2,
      paxChildren: params.paxChildren || [],
      limit: params.limit || 50
    });
  }

  /**
   * Legacy search (database fallback)
   */
  searchDatabase(params: {
    hotelId: number;
    dateFrom: string;
    dateTo: string;
    boardId?: number;
    categoryId?: number;
    adults?: number;
    children?: number[];
  }): Observable<any[]> {
    return this.http.post<any[]>(`${this.baseUrl}Search/Search`, params);
  }
}
