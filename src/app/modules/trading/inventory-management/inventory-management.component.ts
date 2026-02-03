import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

import { InventoryFilters, InventoryItem, TradingService } from '../../../services/trading.service';

@Component({
  selector: 'app-inventory-management',
  templateUrl: './inventory-management.component.html',
  styleUrls: ['./inventory-management.component.scss']
})
export class InventoryManagementComponent implements OnInit, OnDestroy {
  dataSource!: MatTableDataSource<InventoryItem>;
  displayedColumns: string[] = [
    'hotelName',
    'checkIn',
    'buyPrice',
    'sellPrice',
    'currentMarketPrice',
    'potentialProfit',
    'marginPercent',
    'daysUntilCheckIn',
    'urgency',
    'riskLevel',
    'actions'
  ];

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  filtersForm!: FormGroup;
  loading = false;
  summary: any = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private tradingService: TradingService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.dataSource = new MatTableDataSource<InventoryItem>([]);
  }

  ngOnInit(): void {
    this.initForm();
    this.loadInventory();
    this.setupAutoRefresh();
    
    // Listen for inventory updates
    this.tradingService.inventoryUpdates
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadInventory();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  initForm(): void {
    this.filtersForm = this.fb.group({
      daysToCheckIn: [null],
      minProfit: [null],
      hotelId: [null],
      urgency: [''],
      sortBy: ['urgency']
    });

    // Auto-reload on filter changes
    this.filtersForm.valueChanges
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadInventory();
      });
  }

  setupAutoRefresh(): void {
    // Auto-refresh every 5 minutes
    setInterval(() => {
      this.loadInventory(true);
    }, 5 * 60 * 1000);
  }

  loadInventory(silent: boolean = false): void {
    if (!silent) {
      this.loading = true;
    }

    const filters: InventoryFilters = {};
    const formValue = this.filtersForm.value;

    if (formValue.daysToCheckIn) {
      filters.daysToCheckIn = formValue.daysToCheckIn;
    }
    if (formValue.minProfit) {
      filters.minProfit = formValue.minProfit;
    }
    if (formValue.hotelId) {
      filters.hotelId = formValue.hotelId;
    }
    if (formValue.urgency) {
      filters.urgency = formValue.urgency;
    }
    if (formValue.sortBy) {
      filters.sortBy = formValue.sortBy;
    }

    this.tradingService.getActiveInventory(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.dataSource.data = response.inventory;
          this.summary = response.summary;

          if (!silent && response.inventory.length === 0) {
            this.snackBar.open('אין פריטים במלאי', 'סגור', { duration: 3000 });
          }
        },
        error: (error) => {
          this.loading = false;
          console.error('Error loading inventory:', error);
          this.snackBar.open(
            'שגיאה בטעינת המלאי: ' + (error.error?.message || error.message),
            'סגור',
            { duration: 5000 }
          );
        }
      });
  }

  onUpdatePrice(item: InventoryItem): void {
    const newPrice = prompt(`עדכון מחיר מכירה עבור ${item.hotelName}\n\nמחיר נוכחי: €${item.sellPrice}\n\nהזן מחיר חדש:`, item.sellPrice.toString());
    
    if (newPrice && !isNaN(parseFloat(newPrice))) {
      const price = parseFloat(newPrice);
      
      if (price <= item.buyPrice) {
        this.snackBar.open('המחיר החדש חייב להיות גבוה ממחיר הקנייה', 'סגור', { duration: 3000 });
        return;
      }

      const reason = prompt('סיבת השינוי (אופציונלי):') || 'Manual price update';

      this.loading = true;

      this.tradingService.updateSellPrice({
        bookingId: item.id,
        newSellPrice: price,
        reason: reason
      })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (result) => {
            this.loading = false;
            
            if (result.success) {
              this.snackBar.open(
                `✅ המחיר עודכן בהצלחה! רווח חדש: €${result.booking.newProfit.toFixed(2)}`,
                'סגור',
                { duration: 5000 }
              );
              this.loadInventory(true);
            }
          },
          error: (error) => {
            this.loading = false;
            this.snackBar.open(
              '❌ שגיאה בעדכון מחיר: ' + (error.error?.message || error.message),
              'סגור',
              { duration: 5000 }
            );
          }
        });
    }
  }

  onCheckCurrentPrice(item: InventoryItem): void {
    this.loading = true;

    this.tradingService.checkCurrentPrice(item.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.loading = false;
          
          if (result.success) {
            const priceChange = result.booking.priceDrop;
            const changePercent = result.booking.priceDropPercent;

            let message = `מחיר שוק נוכחי: €${result.booking.currentMarketPrice}\n`;
            
            if (priceChange > 0) {
              message += `📉 ירידת מחיר: €${priceChange.toFixed(2)} (${changePercent.toFixed(1)}%)\n`;
              message += `רווח פוטנציאלי גדל ל-€${result.booking.potentialProfit.toFixed(2)}`;
            } else if (priceChange < 0) {
              message += `📈 עליית מחיר: €${Math.abs(priceChange).toFixed(2)} (${Math.abs(changePercent).toFixed(1)}%)\n`;
              message += `רווח פוטנציאלי ירד ל-€${result.booking.potentialProfit.toFixed(2)}`;
            } else {
              message += `המחיר לא השתנה`;
            }

            this.snackBar.open(message, 'סגור', { duration: 8000 });
            this.loadInventory(true);
          }
        },
        error: (error) => {
          this.loading = false;
          this.snackBar.open(
            '❌ שגיאה בבדיקת מחיר: ' + (error.error?.message || error.message),
            'סגור',
            { duration: 5000 }
          );
        }
      });
  }

  getUrgencyColor(urgency: string): string {
    return this.tradingService.getUrgencyBadgeColor(urgency);
  }

  getRiskColor(risk: string): string {
    return this.tradingService.getRiskBadgeColor(risk);
  }

  formatCurrency(amount: number): string {
    return this.tradingService.formatCurrency(amount);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  clearFilters(): void {
    this.filtersForm.reset({
      daysToCheckIn: null,
      minProfit: null,
      hotelId: null,
      urgency: '',
      sortBy: 'urgency'
    });
  }

  exportToCSV(): void {
    if (this.dataSource.data.length === 0) {
      this.snackBar.open('אין נתונים לייצוא', 'סגור', { duration: 2000 });
      return;
    }

    const headers = [
      'Hotel Name',
      'Check-In',
      'Check-Out',
      'Buy Price',
      'Sell Price',
      'Current Market Price',
      'Potential Profit',
      'Margin %',
      'Days Until Check-In',
      'Urgency',
      'Risk Level'
    ];

    const rows = this.dataSource.data.map(item => [
      item.hotelName,
      item.checkIn,
      item.checkOut,
      item.buyPrice,
      item.sellPrice,
      item.currentMarketPrice || 'N/A',
      item.potentialProfit,
      item.marginPercent,
      item.daysUntilCheckIn,
      item.urgency,
      item.riskLevel
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.snackBar.open('קובץ CSV יוצא בהצלחה', 'סגור', { duration: 3000 });
  }
}
