import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-revenue-chart',
  templateUrl: './revenue-chart.component.html',
  styleUrls: ['./revenue-chart.component.scss']
})
export class RevenueChartComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;
  baseUrl = environment.baseUrl;

  public lineChartData: ChartConfiguration['data'] = {
    datasets: [
      {
        data: [],
        label: 'Revenue',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        borderColor: '#2196f3',
        pointBackgroundColor: '#2196f3',
        pointBorderColor: '#fff',
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#2196f3',
        fill: true,
        tension: 0.4,
        borderWidth: 3
      },
      {
        data: [],
        label: 'Profit',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderColor: '#4caf50',
        pointBackgroundColor: '#4caf50',
        pointBorderColor: '#fff',
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#4caf50',
        fill: true,
        tension: 0.4,
        borderWidth: 3
      }
    ],
    labels: []
  };

  public lineChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {
            size: 12,
            weight: '500'
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed && context.parsed.y !== null) {
              label += '$' + context.parsed.y.toLocaleString();
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.06)'
        },
        ticks: {
          font: {
            size: 11
          },
          callback: function(value: any) {
            if (value >= 1000000) {
              return '$' + (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              return '$' + (value / 1000).toFixed(0) + 'K';
            }
            return '$' + value.toLocaleString();
          }
        }
      }
    }
  };

  // Summary data
  totalRevenue = 0;
  totalProfit = 0;
  avgMonthlyRevenue = 0;
  growthRate = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadChartData();
  }

  loadChartData(): void {
    this.http.get<any[]>(this.baseUrl + 'Book/Bookings').subscribe({
      next: (bookings) => {
        this.processChartData(bookings);
      },
      error: (err) => console.error('Error loading chart data:', err)
    });
  }

  processChartData(bookings: any[]): void {
    // Group by month
    const monthlyData = new Map<string, { revenue: number, profit: number }>();
    
    bookings.forEach(booking => {
      if (booking.IsCanceled) return;
      
      const date = new Date(booking.dateInsert);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const revenue = booking.lastPrice || booking.pushPrice || 0;
      const cost = booking.price || 0;
      const profit = revenue - cost;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { revenue: 0, profit: 0 });
      }
      
      const data = monthlyData.get(monthKey)!;
      data.revenue += revenue;
      data.profit += profit;
    });

    // Sort by date and take last 12 months
    const sortedMonths = Array.from(monthlyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12);

    const labels = sortedMonths.map(([key]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    const revenueData = sortedMonths.map(([_, data]) => data.revenue);
    const profitData = sortedMonths.map(([_, data]) => data.profit);

    // Calculate summary stats
    this.totalRevenue = revenueData.reduce((sum, val) => sum + val, 0);
    this.totalProfit = profitData.reduce((sum, val) => sum + val, 0);
    this.avgMonthlyRevenue = revenueData.length > 0 ? this.totalRevenue / revenueData.length : 0;
    
    // Calculate growth rate (last month vs previous)
    if (revenueData.length >= 2) {
      const lastMonth = revenueData[revenueData.length - 1];
      const prevMonth = revenueData[revenueData.length - 2];
      this.growthRate = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;
    }

    this.lineChartData = {
      labels: labels,
      datasets: [
        {
          ...this.lineChartData.datasets[0],
          data: revenueData
        },
        {
          ...this.lineChartData.datasets[1],
          data: profitData
        }
      ]
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
          type: 'line',
          data: this.lineChartData,
          options: this.lineChartOptions as any
        });
      }
    }
  }

  private updateChart(): void {
    if (this.chart) {
      this.chart.data = this.lineChartData;
      this.chart.update();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
