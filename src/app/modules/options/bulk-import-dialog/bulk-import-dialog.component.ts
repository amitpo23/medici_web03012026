import { HttpClient } from '@angular/common/http';
import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BOARD_OPTIONS, calculatePrices, CATEGORY_OPTIONS } from 'src/app/core/constants/reference-data.constants';
import { environment } from 'src/app/environments/environment';

interface CsvRow {
  hotelId: number;
  hotelName?: string;
  dateFrom: string;
  dateTo: string;
  boardId: number;
  categoryId: number;
  sourcePrice: number;
  buyPrice?: number;
  pushPrice?: number;
  maxRooms: number;
  status?: 'pending' | 'success' | 'error';
  error?: string;
}

@Component({
  selector: 'app-bulk-import-dialog',
  templateUrl: './bulk-import-dialog.component.html',
  styleUrls: ['./bulk-import-dialog.component.scss']
})
export class BulkImportDialogComponent {
  selectedFile: File | null = null;
  parsedData: CsvRow[] = [];
  isProcessing = false;
  importProgress = 0;
  importResults = { success: 0, failed: 0, total: 0 };
  showResults = false;

  boardOptions = BOARD_OPTIONS;
  categoryOptions = CATEGORY_OPTIONS;

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<BulkImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      this.selectedFile = file;
      this.parseCSV(file);
    } else {
      this.snackBar.open('Please select a valid CSV file', 'Close', { duration: 3000 });
    }
  }

  parseCSV(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const csv = e.target.result;
      const lines = csv.split('\n');
      const headers = lines[0].split(',').map((h: string) => h.trim());

      this.parsedData = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map((v: string) => v.trim());
        const row: any = {};

        headers.forEach((header: string, index: number) => {
          row[header] = values[index];
        });

        // Validate and convert
        const csvRow: CsvRow = {
          hotelId: parseInt(row.hotelId || row.HotelId),
          hotelName: row.hotelName || row.HotelName,
          dateFrom: row.dateFrom || row.DateFrom,
          dateTo: row.dateTo || row.DateTo,
          boardId: parseInt(row.boardId || row.BoardId),
          categoryId: parseInt(row.categoryId || row.CategoryId),
          sourcePrice: parseFloat(row.sourcePrice || row.SourcePrice),
          buyPrice: row.buyPrice ? parseFloat(row.buyPrice) : undefined,
          pushPrice: row.pushPrice ? parseFloat(row.pushPrice) : undefined,
          maxRooms: parseInt(row.maxRooms || row.MaxRooms || '1'),
          status: 'pending'
        };

        // Auto-calculate prices if not provided
        if (!csvRow.buyPrice || !csvRow.pushPrice) {
          const prices = calculatePrices(csvRow.sourcePrice);
          csvRow.buyPrice = csvRow.buyPrice || prices.buyPrice;
          csvRow.pushPrice = csvRow.pushPrice || prices.pushPrice;
        }

        // Validate
        if (this.validateRow(csvRow)) {
          this.parsedData.push(csvRow);
        }
      }

      this.snackBar.open(`Parsed ${this.parsedData.length} valid rows`, 'Close', { duration: 3000 });
    };
    reader.readAsText(file);
  }

  validateRow(row: CsvRow): boolean {
    if (!row.hotelId || isNaN(row.hotelId)) {
      row.status = 'error';
      row.error = 'Invalid hotelId';
      return false;
    }
    if (!row.dateFrom || !row.dateTo) {
      row.status = 'error';
      row.error = 'Missing dates';
      return false;
    }
    if (!row.boardId || !row.categoryId) {
      row.status = 'error';
      row.error = 'Missing board/category';
      return false;
    }
    if (!row.sourcePrice || row.sourcePrice <= 0) {
      row.status = 'error';
      row.error = 'Invalid price';
      return false;
    }
    return true;
  }

  async importAll(): Promise<void> {
    this.isProcessing = true;
    this.showResults = false;
    this.importResults = { success: 0, failed: 0, total: this.parsedData.length };

    for (let i = 0; i < this.parsedData.length; i++) {
      const row = this.parsedData[i];
      this.importProgress = Math.round(((i + 1) / this.parsedData.length) * 100);

      try {
        await this.http.post(`${environment.baseUrl}Opportunity/InsertOpp`, {
          hotelId: row.hotelId,
          startDateStr: row.dateFrom,
          endDateStr: row.dateTo,
          boardlId: row.boardId,
          categorylId: row.categoryId,
          sourcePrice: row.sourcePrice,
          buyPrice: row.buyPrice,
          pushPrice: row.pushPrice,
          maxRooms: row.maxRooms
        }).toPromise();

        row.status = 'success';
        this.importResults.success++;
      } catch (error: any) {
        row.status = 'error';
        row.error = error.message || 'Import failed';
        this.importResults.failed++;
      }
    }

    this.isProcessing = false;
    this.showResults = true;
    this.snackBar.open(
      `Import completed: ${this.importResults.success} success, ${this.importResults.failed} failed`,
      'Close',
      { duration: 5000 }
    );
  }

  downloadTemplate(): void {
    const csvContent = 'hotelId,dateFrom,dateTo,boardId,categoryId,sourcePrice,maxRooms\n' +
      '1,2026-03-01,2026-03-05,2,1,100,5\n' +
      '2,2026-03-10,2026-03-15,1,2,150,3\n';

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opportunities_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      default: return 'pending';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'success': return 'success';
      case 'error': return 'error';
      default: return 'primary';
    }
  }

  getBoardName(boardId: number): string {
    return this.boardOptions.find(b => b.value === boardId)?.label || `Board ${boardId}`;
  }

  getCategoryName(categoryId: number): string {
    return this.categoryOptions.find(c => c.value === categoryId)?.label || `Category ${categoryId}`;
  }

  onClose(): void {
    this.dialogRef.close(this.importResults.success > 0);
  }
}
