import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ReportsService } from 'src/app/services/reports.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-profit-loss-report',
  templateUrl: './profit-loss-report.component.html',
  styleUrls: ['./profit-loss-report.component.scss']
})
export class ProfitLossReportComponent implements OnInit {
  filterForm: FormGroup;
  isLoading = false;
  reportData: any = null;
  detailsData: any[] = [];

  // Chart data
  chartLabels: string[] = [];
  chartDatasets: any[] = [];
  chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom' },
      title: { display: true, text: 'Profit Trend' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  constructor(
    private fb: FormBuilder,
    private reportsService: ReportsService,
    private snackBar: MatSnackBar
  ) {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    this.filterForm = this.fb.group({
      dateFrom: [lastMonth],
      dateTo: [today],
      hotelId: [null]
    });
  }

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    if (this.filterForm.invalid) {
      return;
    }

    this.isLoading = true;
    const formValue = this.filterForm.value;

    const params = {
      dateFrom: formValue.dateFrom ? this.formatDate(formValue.dateFrom) : undefined,
      dateTo: formValue.dateTo ? this.formatDate(formValue.dateTo) : undefined,
      hotelId: formValue.hotelId || undefined
    };

    this.reportsService.getProfitLoss(params).subscribe({
      next: (data) => {
        this.reportData = data;
        this.detailsData = data.details || [];
        this.prepareChartData();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading report:', error);
        this.snackBar.open('Failed to load report', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  prepareChartData(): void {
    if (!this.reportData || !this.reportData.byDate) {
      return;
    }

    const byDate = this.reportData.byDate;
    this.chartLabels = byDate.map((item: any) => item.date);
    
    this.chartDatasets = [
      {
        label: 'Profit',
        data: byDate.map((item: any) => item.profit),
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        borderColor: 'rgba(76, 175, 80, 1)',
        borderWidth: 2,
        fill: true
      },
      {
        label: 'Revenue',
        data: byDate.map((item: any) => item.revenue),
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        borderColor: 'rgba(33, 150, 243, 1)',
        borderWidth: 2,
        fill: true
      }
    ];
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  exportToExcel(): void {
    if (!this.detailsData || this.detailsData.length === 0) {
      this.snackBar.open('No data to export', 'Close', { duration: 3000 });
      return;
    }

    this.reportsService.exportToExcel(this.detailsData, 'profit-loss-report');
    this.snackBar.open('Report exported successfully', 'Close', { duration: 3000 });
  }

  resetFilters(): void {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    this.filterForm.patchValue({
      dateFrom: lastMonth,
      dateTo: today,
      hotelId: null
    });

    this.loadReport();
  }

  get totalProfit(): number {
    return this.reportData?.summary?.totalProfit || 0;
  }

  get totalRevenue(): number {
    return this.reportData?.summary?.totalRevenue || 0;
  }

  get totalCost(): number {
    return this.reportData?.summary?.totalCost || 0;
  }

  get averageMargin(): number {
    return this.reportData?.summary?.averageMargin || 0;
  }

  get totalBookings(): number {
    return this.reportData?.summary?.totalBookings || 0;
  }
}
