import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { QuickBuyRequest, RoomResult, SearchAnalysisRequest, TradingService } from '../../../services/trading.service';
import { BuyConfirmationDialogComponent } from '../buy-confirmation-dialog/buy-confirmation-dialog.component';

@Component({
  selector: 'app-search-and-buy',
  templateUrl: './search-and-buy.component.html',
  styleUrls: ['./search-and-buy.component.scss']
})
export class SearchAndBuyComponent implements OnInit, OnDestroy {
  searchForm!: FormGroup;
  loading = false;
  searchResults: RoomResult[] = [];
  hotelAnalytics: any = null;
  searchToken: string = '';
  searchParams: any = null;
  
  private destroy$ = new Subject<void>();

  // Display columns for results table
  displayedColumns: string[] = ['roomName', 'price', 'confidence', 'profit', 'margin', 'recommendation', 'actions'];

  constructor(
    private fb: FormBuilder,
    private tradingService: TradingService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initForm(): void {
    const today = new Date();
    const defaultCheckIn = new Date(today);
    defaultCheckIn.setDate(today.getDate() + 30);
    
    const defaultCheckOut = new Date(defaultCheckIn);
    defaultCheckOut.setDate(defaultCheckIn.getDate() + 2);

    this.searchForm = this.fb.group({
      hotelId: ['', [Validators.required, Validators.min(1)]],
      checkIn: [defaultCheckIn, Validators.required],
      checkOut: [defaultCheckOut, Validators.required],
      adults: [2, [Validators.required, Validators.min(1), Validators.max(10)]],
      children: [0, [Validators.min(0), Validators.max(10)]]
    });
  }

  onSearch(): void {
    if (this.searchForm.invalid) {
      this.snackBar.open('אנא מלא את כל השדות הנדרשים', 'סגור', { duration: 3000 });
      return;
    }

    const formValue = this.searchForm.value;
    
    // Format dates to YYYY-MM-DD
    const checkIn = this.formatDate(formValue.checkIn);
    const checkOut = this.formatDate(formValue.checkOut);

    // Validate dates
    if (new Date(checkIn) >= new Date(checkOut)) {
      this.snackBar.open('תאריך צ\'ק-אאוט חייב להיות אחרי תאריך צ\'ק-אין', 'סגור', { duration: 3000 });
      return;
    }

    const request: SearchAnalysisRequest = {
      hotelId: parseInt(formValue.hotelId),
      checkIn,
      checkOut,
      adults: formValue.adults,
      children: formValue.children || 0
    };

    this.searchParams = request;
    this.loading = true;
    this.searchResults = [];
    this.hotelAnalytics = null;

    this.tradingService.searchWithAnalysis(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          
          if (response.searchResults && response.searchResults.length > 0) {
            this.searchResults = response.searchResults;
            this.hotelAnalytics = response.hotelAnalytics;
            
            // Generate a search token (in real implementation, this comes from backend)
            this.searchToken = `SEARCH-${Date.now()}-${request.hotelId}`;
            
            this.snackBar.open(
              `נמצאו ${this.searchResults.length} חדרים זמינים`,
              'סגור',
              { duration: 3000 }
            );
          } else {
            this.snackBar.open('לא נמצאו תוצאות חיפוש', 'סגור', { duration: 3000 });
          }
        },
        error: (error) => {
          this.loading = false;
          console.error('Search error:', error);
          this.snackBar.open(
            'שגיאה בחיפוש: ' + (error.error?.message || error.message),
            'סגור',
            { duration: 5000 }
          );
        }
      });
  }

  onBuyNow(room: RoomResult): void {
    if (!this.searchToken || !this.searchParams) {
      this.snackBar.open('אנא בצע חיפוש מחדש', 'סגור', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(BuyConfirmationDialogComponent, {
      width: '600px',
      data: {
        room,
        hotelAnalytics: this.hotelAnalytics,
        searchParams: this.searchParams
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.confirmed) {
        this.executeBuy(room, result.guestInfo);
      }
    });
  }

  private executeBuy(room: RoomResult, guestInfo: any): void {
    const buyRequest: QuickBuyRequest = {
      searchToken: this.searchToken,
      roomId: room.roomId,
      hotelId: this.searchParams.hotelId,
      checkIn: this.searchParams.checkIn,
      checkOut: this.searchParams.checkOut,
      guest: {
        firstName: guestInfo.firstName,
        lastName: guestInfo.lastName,
        email: guestInfo.email,
        phone: guestInfo.phone
      },
      expectedPrice: room.price,
      suggestedSellPrice: room.aiAnalysis.suggestedSellPrice
    };

    this.loading = true;

    this.tradingService.quickBuy(buyRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.loading = false;
          
          if (result.success && result.booking) {
            this.snackBar.open(
              `✅ רכישה הושלמה בהצלחה! מספר הזמנה: ${result.booking.confirmationNumber}`,
              'סגור',
              { duration: 5000 }
            );
            
            // Clear search results after successful purchase
            this.searchResults = [];
            this.hotelAnalytics = null;
          } else {
            this.snackBar.open(
              '❌ הרכישה נכשלה: ' + (result.error || 'שגיאה לא ידועה'),
              'סגור',
              { duration: 5000 }
            );
          }
        },
        error: (error) => {
          this.loading = false;
          console.error('Buy error:', error);
          this.snackBar.open(
            '❌ שגיאה ברכישה: ' + (error.error?.message || error.message),
            'סגור',
            { duration: 5000 }
          );
        }
      });
  }

  getConfidenceColor(confidence: number): string {
    return this.tradingService.getConfidenceBadgeColor(confidence);
  }

  getRecommendationColor(recommendation: string): string {
    switch (recommendation) {
      case 'STRONG BUY': return 'primary';
      case 'BUY': return 'accent';
      case 'CONSIDER': return 'warn';
      default: return 'basic';
    }
  }

  formatCurrency(amount: number): string {
    return this.tradingService.formatCurrency(amount);
  }

  private formatDate(date: Date | string): string {
    if (typeof date === 'string') {
      return date;
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  clearSearch(): void {
    this.searchResults = [];
    this.hotelAnalytics = null;
    this.searchToken = '';
    this.searchParams = null;
  }
}
