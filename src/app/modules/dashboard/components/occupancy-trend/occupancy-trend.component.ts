import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-occupancy-trend',
  templateUrl: './occupancy-trend.component.html',
  styleUrls: ['./occupancy-trend.component.scss']
})
export class OccupancyTrendComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  baseUrl = environment.baseUrl;

  public barChartData: ChartConfiguration['data'] = {
    datasets: [
      {
        data: [],
        label: 'תפוסה %',
        backgroundColor: 'rgba(156, 39, 176, 0.7)',
        borderColor: '#9c27b0',
        borderWidth: 2,
        hoverBackgroundColor: 'rgba(156, 39, 176, 0.9)'
      }
    ],
    labels: []
  };

  public barChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return context.dataset.label + ': ' + context.parsed.y + '%';
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          }
        }
      }
    }
  };

  public barChartType: string = 'bar';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadOccupancyData();
  }

  loadOccupancyData(): void {
    this.http.get<any[]>(this.baseUrl + 'Book/Bookings').subscribe({
      next: (bookings) => {
        this.processOccupancyData(bookings);
      },
      error: (err) => console.error('Error loading occupancy data:', err)
    });
  }

  processOccupancyData(bookings: any[]): void {
    // Group by month and calculate occupancy
    const monthlyBookings = new Map<string, number>();
    
    bookings.forEach(booking => {
      if (booking.IsCanceled) return;
      
      const date = new Date(booking.dateInsert);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      monthlyBookings.set(monthKey, (monthlyBookings.get(monthKey) || 0) + 1);
    });

    // Get last 6 months
    const sortedMonths = Array.from(monthlyBookings.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6);

    const labels = sortedMonths.map(([key]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('he-IL', { month: 'long' });
    });

    // Simulate occupancy percentage (in real app, calculate from total capacity)
    const maxBookings = Math.max(...sortedMonths.map(([_, count]) => count));
    const occupancyData = sortedMonths.map(([_, count]) => 
      Math.min(100, Math.round((count / maxBookings) * 100))
    );

    this.barChartData = {
      labels: labels,
      datasets: [{
        ...this.barChartData.datasets[0],
        data: occupancyData
      }]
    };
    
    this.updateChart();
  }

  ngAfterViewInit(): void {
    this.initChart();
  }

  private initChart(): void {
    if (this.chartCanvas && this.chartCanvas.nativeElement) {
      const ctx = this.chartCanvas.nativeElement.getContext('2d');
      if (ctx) {
        this.chart = new Chart(ctx, {
          type: 'bar',
          data: this.barChartData,
          options: this.barChartOptions as any
        });
      }
    }
  }

  private updateChart(): void {
    if (this.chart) {
      this.chart.data = this.barChartData;
      this.chart.update();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
