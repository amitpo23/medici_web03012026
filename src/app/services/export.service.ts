import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment.prod';

interface ExportOptions {
  title?: string;
  filename?: string;
  columns?: string[];
  dateRange?: { start: Date; end: Date };
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  constructor(private http: HttpClient) {}

  /**
   * Export data to CSV
   */
  exportToCSV(data: any[], options: ExportOptions = {}): void {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    const columns = options.columns || Object.keys(data[0]);
    const filename = options.filename || `export_${this.getTimestamp()}.csv`;

    // Build CSV content
    let csv = columns.join(',') + '\n';

    data.forEach(row => {
      const values = columns.map(col => {
        let value = row[col];
        if (value === null || value === undefined) value = '';
        if (typeof value === 'string' && value.includes(',')) {
          value = `"${value}"`;
        }
        return value;
      });
      csv += values.join(',') + '\n';
    });

    this.downloadFile(csv, filename, 'text/csv');
  }

  /**
   * Export data to Excel (XLSX) via backend
   */
  async exportToExcel(data: any[], options: ExportOptions = {}): Promise<void> {
    const filename = options.filename || `export_${this.getTimestamp()}.xlsx`;

    try {
      const response = await this.http.post(
        `${environment.apiUrl}/reports/export/excel`,
        { data, options },
        { responseType: 'blob' }
      ).toPromise();

      if (response) {
        this.downloadBlob(response, filename);
      }
    } catch (error) {
      // Fallback to CSV if Excel export fails
      console.warn('Excel export failed, falling back to CSV');
      this.exportToCSV(data, { ...options, filename: filename.replace('.xlsx', '.csv') });
    }
  }

  /**
   * Export dashboard data to PDF
   */
  async exportToPDF(elementId: string, options: ExportOptions = {}): Promise<void> {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element with id "${elementId}" not found`);
      return;
    }

    const filename = options.filename || `report_${this.getTimestamp()}.pdf`;

    try {
      // Use html2canvas + jspdf if available, otherwise request from backend
      const response = await this.http.post(
        `${environment.apiUrl}/reports/export/pdf`,
        {
          html: element.innerHTML,
          title: options.title,
          options
        },
        { responseType: 'blob' }
      ).toPromise();

      if (response) {
        this.downloadBlob(response, filename);
      }
    } catch (error) {
      console.error('PDF export failed:', error);
      // Fallback: Print dialog
      this.printElement(element, options.title);
    }
  }

  /**
   * Export bookings report
   */
  async exportBookingsReport(dateRange?: { start: Date; end: Date }): Promise<void> {
    const params = new URLSearchParams();
    if (dateRange) {
      params.set('startDate', dateRange.start.toISOString());
      params.set('endDate', dateRange.end.toISOString());
    }

    try {
      const response = await this.http.get(
        `${environment.apiUrl}/reports/bookings/export?${params.toString()}`,
        { responseType: 'blob' }
      ).toPromise();

      if (response) {
        this.downloadBlob(response, `bookings_report_${this.getTimestamp()}.xlsx`);
      }
    } catch (error) {
      console.error('Bookings report export failed:', error);
    }
  }

  /**
   * Export opportunities report
   */
  async exportOpportunitiesReport(status?: string): Promise<void> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);

    try {
      const response = await this.http.get(
        `${environment.apiUrl}/reports/opportunities/export?${params.toString()}`,
        { responseType: 'blob' }
      ).toPromise();

      if (response) {
        this.downloadBlob(response, `opportunities_report_${this.getTimestamp()}.xlsx`);
      }
    } catch (error) {
      console.error('Opportunities report export failed:', error);
    }
  }

  /**
   * Quick export table data
   */
  exportTable(tableElement: HTMLTableElement, filename?: string): void {
    const rows = Array.from(tableElement.querySelectorAll('tr'));
    const data: any[] = [];

    // Get headers
    const headerRow = rows[0];
    const headers = Array.from(headerRow.querySelectorAll('th')).map(th => th.textContent?.trim() || '');

    // Get data rows
    rows.slice(1).forEach(row => {
      const cells = Array.from(row.querySelectorAll('td'));
      const rowData: any = {};
      cells.forEach((cell, index) => {
        rowData[headers[index]] = cell.textContent?.trim() || '';
      });
      data.push(rowData);
    });

    this.exportToCSV(data, { filename: filename || `table_export_${this.getTimestamp()}.csv` });
  }

  // Helper methods
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    this.downloadBlob(blob, filename);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private printElement(element: HTMLElement, title?: string): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || 'Report'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${title ? `<h1>${title}</h1>` : ''}
          ${element.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  }

  private getTimestamp(): string {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }
}
