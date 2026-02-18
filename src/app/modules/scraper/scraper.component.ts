import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from 'src/app/environments/environment';
import {
  ScraperService,
  ScrapedPrice,
  ScrapeCompetitorPricesResponse,
  ComparePricesResponse,
  BrowserSession,
  TestScrapeResponse
} from 'src/app/services/scraper.service';

@Component({
  selector: 'app-scraper',
  templateUrl: './scraper.component.html',
  styleUrls: ['./scraper.component.scss']
})
export class ScraperComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();
  private baseUrl = environment.baseUrl;

  // Snackbar config
  horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  verticalPosition: MatSnackBarVerticalPosition = 'bottom';
  durationInSeconds = 5;

  // Tab index
  selectedTabIndex = 0;

  // Available scraper sources
  availableSources: string[] = ['booking.com', 'expedia', 'hotels.com', 'agoda'];

  // ==================== Scrape Prices Tab ====================
  scrapeHotelName = '';
  scrapeCheckIn = '';
  scrapeCheckOut = '';
  scrapeGuests = 2;
  scrapeSelectedSources: string[] = [];
  scrapeLoading = false;
  scrapeResult: ScrapeCompetitorPricesResponse | null = null;
  scrapePrices: ScrapedPrice[] = [];

  // ==================== Compare Prices Tab ====================
  compareHotelName = '';
  compareCheckIn = '';
  compareCheckOut = '';
  compareGuests = 2;
  compareLoading = false;
  compareResult: ComparePricesResponse | null = null;
  comparePrices: ScrapedPrice[] = [];
  compareCheapest: ScrapedPrice | null = null;

  // ==================== Sessions & Test Tab ====================
  sessions: BrowserSession[] = [];
  sessionsLoading = false;
  testLoading = false;
  testResult: TestScrapeResponse | null = null;

  constructor(
    private http: HttpClient,
    private scraperService: ScraperService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ==================== Scrape Prices ====================

  onScrapeSubmit(): void {
    if (!this.scrapeHotelName || !this.scrapeCheckIn || !this.scrapeCheckOut) {
      this.showError('Please fill in hotel name, check-in and check-out dates');
      return;
    }

    this.scrapeLoading = true;
    this.scrapeResult = null;
    this.scrapePrices = [];

    this.scraperService.scrapeCompetitorPrices({
      hotelName: this.scrapeHotelName,
      checkIn: this.scrapeCheckIn,
      checkOut: this.scrapeCheckOut,
      guests: this.scrapeGuests,
      sources: this.scrapeSelectedSources.length > 0 ? this.scrapeSelectedSources : undefined
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.scrapeResult = response;
          if (response.prices && response.prices.length > 0) {
            this.scrapePrices = response.prices;
          } else if (response.success && response.price) {
            this.scrapePrices = [{
              hotel: response.hotel || this.scrapeHotelName,
              source: response.source || 'unknown',
              checkIn: response.checkIn || this.scrapeCheckIn,
              checkOut: response.checkOut || this.scrapeCheckOut,
              price: response.price,
              currency: response.currency || 'EUR',
              scrapedAt: response.scrapedAt || new Date().toISOString()
            }];
          }
          this.scrapeLoading = false;
          if (this.scrapePrices.length > 0) {
            this.showSuccess('Scraping completed - ' + this.scrapePrices.length + ' result(s) found');
          } else {
            this.showError('Scraping completed but no prices found');
          }
        },
        error: (err) => {
          this.scrapeLoading = false;
          this.showError('Scrape failed: ' + (err.error?.error || err.error?.message || err.message));
        }
      });
  }

  toggleSource(source: string): void {
    const index = this.scrapeSelectedSources.indexOf(source);
    if (index >= 0) {
      this.scrapeSelectedSources.splice(index, 1);
    } else {
      this.scrapeSelectedSources.push(source);
    }
  }

  isSourceSelected(source: string): boolean {
    return this.scrapeSelectedSources.includes(source);
  }

  // ==================== Compare Prices ====================

  onCompareSubmit(): void {
    if (!this.compareHotelName || !this.compareCheckIn || !this.compareCheckOut) {
      this.showError('Please fill in hotel name, check-in and check-out dates');
      return;
    }

    this.compareLoading = true;
    this.compareResult = null;
    this.comparePrices = [];
    this.compareCheapest = null;

    this.scraperService.comparePrices({
      hotelName: this.compareHotelName,
      checkIn: this.compareCheckIn,
      checkOut: this.compareCheckOut,
      guests: this.compareGuests
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.compareResult = response;
          this.comparePrices = response.prices || [];
          this.compareCheapest = response.cheapest || null;
          this.compareLoading = false;
          if (this.comparePrices.length > 0) {
            this.showSuccess('Comparison completed - ' + this.comparePrices.length + ' source(s) compared');
          } else {
            this.showError('Comparison completed but no prices found');
          }
        },
        error: (err) => {
          this.compareLoading = false;
          this.showError('Comparison failed: ' + (err.error?.error || err.error?.message || err.message));
        }
      });
  }

  isCheapest(price: ScrapedPrice): boolean {
    if (!this.compareCheapest) {
      return false;
    }
    return price.source === this.compareCheapest.source && price.price === this.compareCheapest.price;
  }

  // ==================== Sessions ====================

  loadSessions(): void {
    this.sessionsLoading = true;
    this.scraperService.getSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.sessions = response.sessions || [];
          this.sessionsLoading = false;
        },
        error: (err) => {
          this.sessionsLoading = false;
          this.sessions = [];
          this.showError('Failed to load sessions: ' + (err.error?.error || err.error?.message || err.message));
        }
      });
  }

  // ==================== Test Scraper ====================

  runTest(): void {
    this.testLoading = true;
    this.testResult = null;

    this.scraperService.testScraper()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.testResult = response;
          this.testLoading = false;
          if (response.test === 'completed') {
            this.showSuccess('Scraper test completed successfully');
          } else {
            this.showError('Scraper test failed: ' + (response.error || 'Unknown error'));
          }
        },
        error: (err) => {
          this.testLoading = false;
          this.testResult = {
            test: 'failed',
            error: err.error?.error || err.error?.message || err.message
          };
          this.showError('Scraper test failed: ' + (err.error?.error || err.error?.message || err.message));
        }
      });
  }

  // ==================== Helpers ====================

  getSourceClass(source: string): string {
    return this.scraperService.getSourceBadgeColor(source);
  }

  formatCurrency(amount: number, currency: string = 'EUR'): string {
    return this.scraperService.formatCurrency(amount, currency);
  }

  getSessionStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active': return 'session-active';
      case 'idle': return 'session-idle';
      case 'closed': return 'session-closed';
      default: return 'session-idle';
    }
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
