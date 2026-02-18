import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

// ==================== REQUEST INTERFACES ====================

export interface ScrapeCompetitorPricesRequest {
  hotelName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  sources?: string[];
}

export interface ComparePricesRequest {
  hotelName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

// ==================== RESPONSE INTERFACES ====================

export interface ScrapedPrice {
  hotel: string;
  source: string;
  checkIn: string;
  checkOut: string;
  price: number;
  currency: string;
  scrapedAt: string;
  raw?: string;
}

export interface ScrapeCompetitorPricesResponse {
  success: boolean;
  hotel?: string;
  source?: string;
  checkIn?: string;
  checkOut?: string;
  price?: number;
  currency?: string;
  scrapedAt?: string;
  raw?: string;
  prices?: ScrapedPrice[];
  error?: string;
}

export interface ComparePricesResponse {
  success: boolean;
  hotel: string;
  checkIn: string;
  checkOut: string;
  prices: ScrapedPrice[];
  cheapest?: ScrapedPrice;
  error?: string;
}

export interface BrowserSession {
  id: string;
  status: string;
  createdAt: string;
  lastActivity?: string;
  url?: string;
}

export interface SessionsResponse {
  sessions: BrowserSession[];
}

export interface TestScrapeResponse {
  test: 'completed' | 'failed';
  result?: ScrapeCompetitorPricesResponse;
  timestamp?: string;
  error?: string;
}

// ==================== SERVICE ====================

@Injectable({
  providedIn: 'root'
})
export class ScraperService {
  private apiUrl = `${environment.baseUrl}scraper`;

  constructor(private http: HttpClient) { }

  /**
   * Scrape competitor prices for a hotel
   */
  scrapeCompetitorPrices(request: ScrapeCompetitorPricesRequest): Observable<ScrapeCompetitorPricesResponse> {
    return this.http.post<ScrapeCompetitorPricesResponse>(`${this.apiUrl}/competitor-prices`, request);
  }

  /**
   * Compare prices across multiple platforms
   */
  comparePrices(request: ComparePricesRequest): Observable<ComparePricesResponse> {
    return this.http.post<ComparePricesResponse>(`${this.apiUrl}/compare-prices`, request);
  }

  /**
   * Get active browser sessions
   */
  getSessions(): Observable<SessionsResponse> {
    return this.http.get<SessionsResponse>(`${this.apiUrl}/sessions`);
  }

  /**
   * Test scraper with a known hotel
   */
  testScraper(): Observable<TestScrapeResponse> {
    return this.http.post<TestScrapeResponse>(`${this.apiUrl}/test`, {});
  }

  /**
   * Get source badge color
   */
  getSourceBadgeColor(source: string): string {
    switch (source?.toLowerCase()) {
      case 'booking.com': return 'source-booking';
      case 'expedia': return 'source-expedia';
      case 'hotels.com': return 'source-hotels';
      case 'agoda': return 'source-agoda';
      default: return 'source-default';
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number, currency: string = 'EUR'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  }
}
