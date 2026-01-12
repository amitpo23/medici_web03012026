import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { ChartConfiguration, ChartType } from 'chart.js';

interface Period {
  label: string;
  value: number;
}

@Component({
  selector: 'app-revenue-chart',
  templateUrl: './revenue-chart.component.html',
  styleUrls: ['./revenue-chart.component.scss']
})
export class RevenueChartComponent implements OnInit {
  baseUrl = environment.baseUrl;
  
  // Period options
  periods: Period[] = [
    { label: '3 חודשים', value: 3 },
    { label: '6 חודשים', value: 6 },
    { label: 'שנה', value: 12 }
  ];
  selectedPeriod: number = 12;
  
  // Stats
  totalRevenue: number = 0;
  totalProfit: number = 0;
  averageMonthly: number = 0;

  // Chart configuration
  public lineChartData: ChartConfiguration['data'] = {
    datasets: [
      {
        data: [],
        label: 'הכנסות',
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        borderColor: '#2196f3',
        pointBackgroundColor: '#2196f3',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#2196f3',
        fill: true,
        tension: 0.4
      },
      {
        data: [],
        label: 'רווח',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        borderColor: '#4caf50',
        pointBackgroundColor: '#4caf50',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#4caf50',
        fill: true,
        tension: 0.4
      }
    ],
    labels: []
  };

  public lineChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 13,
            weight: '600'
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        borderRadius: 8,
        titleFont: {
          size: 14,
          weight: 'bold'
        },
        bodyFont: {
          size: 13
        },
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += '₪' + context.parsed.y.toLocaleString();
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '₪' + value.toLocaleString();
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  public lineChartType: ChartType = 'line';
  private allBookings: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadChartData();
  }

  loadChartData(): void {
    this.http.get<any[]>(this.baseUrl + 'Book/Bookings').subscribe({
      next: (bookings) => {
        this.allBookings = bookings;
        this.processChartData(bookings);
      },
      error: (err) => console.error('Error loading chart data:', err)
    });
  }

  selectPeriod(months: number): void {
    this.selectedPeriod = months;
    this.processChartData(this.allBookings);
  }

  changeChartType(type: 'line' | 'bar'): void {
    this.lineChartType = type as ChartType;
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

    // Sort by date and take selected period
    const sortedMonths = Array.from(monthlyData.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-this.selectedPeriod);

    const labels = sortedMonths.map(([key]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' });
    });

    const revenueData = sortedMonths.map(([_, data]) => data.revenue);
    const profitData = sortedMonths.map(([_, data]) => data.profit);

    // Calculate stats
    this.totalRevenue = revenueData.reduce((sum, val) => sum + val, 0);
    this.totalProfit = profitData.reduce((sum, val) => sum + val, 0);
    this.averageMonthly = this.totalRevenue / revenueData.length;

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
  }
}
