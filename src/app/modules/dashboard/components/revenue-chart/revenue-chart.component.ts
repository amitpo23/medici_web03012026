import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { ChartConfiguration, ChartType } from 'chart.js';

@Component({
  selector: 'app-revenue-chart',
  templateUrl: './revenue-chart.component.html',
  styleUrls: ['./revenue-chart.component.scss']
})
export class RevenueChartComponent implements OnInit {
  baseUrl = environment.baseUrl;

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
        position: 'top'
      },
      tooltip: {
        mode: 'index',
        intersect: false,
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
        }
      }
    }
  };

  public lineChartType: ChartType = 'line';

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
      return date.toLocaleDateString('he-IL', { month: 'short', year: '2-digit' });
    });

    const revenueData = sortedMonths.map(([_, data]) => data.revenue);
    const profitData = sortedMonths.map(([_, data]) => data.profit);

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
