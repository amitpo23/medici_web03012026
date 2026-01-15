import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { environment } from '../../../../environments/environment';

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

  // Summary statistics
  avgOccupancy: number = 0;
  peakOccupancy: number = 0;
  peakMonth: string = '';
  trend: number = 0;

  public barChartData: ChartConfiguration['data'] = {
    datasets: [
      {
        data: [],
        label: 'Occupancy %',
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return 'rgba(139, 92, 246, 0.7)';
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
          gradient.addColorStop(1, 'rgba(139, 92, 246, 0.9)');
          return gradient;
        },
        borderColor: '#8b5cf6',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
        hoverBackgroundColor: 'rgba(139, 92, 246, 1)'
      }
    ],
    labels: []
  };

  public barChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(139, 92, 246, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: function(items: any[]) {
            return items[0]?.label || '';
          },
          label: function(context: any) {
            return `Occupancy: ${context.parsed.y}%`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.06)',
          drawBorder: false
        },
        ticks: {
          color: '#64748b',
          font: { size: 11 },
          callback: function(value: any) {
            return value + '%';
          }
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#64748b',
          font: { size: 11 }
        }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
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
      return date.toLocaleDateString('en-US', { month: 'short' });
    });

    // Simulate occupancy percentage (in real app, calculate from total capacity)
    const maxBookings = Math.max(...sortedMonths.map(([_, count]) => count));
    const occupancyData = sortedMonths.map(([_, count]) => 
      Math.min(100, Math.round((count / maxBookings) * 100))
    );

    // Calculate summary statistics
    this.avgOccupancy = occupancyData.length > 0 
      ? Math.round(occupancyData.reduce((a, b) => a + b, 0) / occupancyData.length) 
      : 0;
    this.peakOccupancy = Math.max(...occupancyData, 0);
    const peakIndex = occupancyData.indexOf(this.peakOccupancy);
    this.peakMonth = labels[peakIndex] || '-';
    
    // Calculate trend (last month vs previous)
    if (occupancyData.length >= 2) {
      const lastMonth = occupancyData[occupancyData.length - 1];
      const prevMonth = occupancyData[occupancyData.length - 2];
      this.trend = prevMonth > 0 ? Math.round(((lastMonth - prevMonth) / prevMonth) * 100) : 0;
    }

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
