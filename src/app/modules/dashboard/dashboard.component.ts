import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface Activity {
  type: string;
  icon: string;
  title: string;
  time: string;
  value: string;
  valueClass: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  baseUrl = environment.baseUrl;
  loading = true;
  dateRange: 'today' | 'week' | 'month' = 'month';
  private destroy$ = new Subject<void>();

  // KPI Data
  kpiData = {
    totalRevenue: 0,
    totalProfit: 0,
    averageOccupancy: 0,
    activeBookings: 0,
    profitMargin: 0,
    todayRevenue: 0,
    revenueChange: 0,
    profitChange: 0
  };

  // Recent Activity
  recentActivity: Activity[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setDateRange(range: 'today' | 'week' | 'month'): void {
    this.dateRange = range;
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    
    this.http.get<any[]>(this.baseUrl + 'Book/Bookings')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (bookings) => {
          this.calculateKPIs(bookings);
          this.generateRecentActivity(bookings);
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading dashboard data:', err);
          this.loading = false;
        }
      });
  }

  calculateKPIs(bookings: any[]): void {
    const now = new Date();
    const startDate = this.getStartDate();
    
    const activeBookings = bookings.filter(b => !b.IsCanceled && b.IsSold);
    const filteredBookings = activeBookings.filter(b => new Date(b.dateInsert) >= startDate);
    
    // Previous period for comparison
    const previousStart = new Date(startDate);
    const periodLength = now.getTime() - startDate.getTime();
    previousStart.setTime(previousStart.getTime() - periodLength);
    
    const previousBookings = activeBookings.filter(b => {
      const date = new Date(b.dateInsert);
      return date >= previousStart && date < startDate;
    });

    // Calculate current period
    this.kpiData.activeBookings = activeBookings.length;
    this.kpiData.totalRevenue = filteredBookings.reduce((sum, b) => sum + (b.lastPrice || b.pushPrice || 0), 0);
    this.kpiData.totalProfit = filteredBookings.reduce((sum, b) => {
      const revenue = b.lastPrice || b.pushPrice || 0;
      const cost = b.price || 0;
      return sum + (revenue - cost);
    }, 0);
    
    if (this.kpiData.totalRevenue > 0) {
      this.kpiData.profitMargin = (this.kpiData.totalProfit / this.kpiData.totalRevenue) * 100;
    }

    // Calculate previous period for comparison
    const prevRevenue = previousBookings.reduce((sum, b) => sum + (b.lastPrice || b.pushPrice || 0), 0);
    const prevProfit = previousBookings.reduce((sum, b) => {
      const revenue = b.lastPrice || b.pushPrice || 0;
      const cost = b.price || 0;
      return sum + (revenue - cost);
    }, 0);

    // Calculate change percentages
    this.kpiData.revenueChange = prevRevenue > 0 
      ? ((this.kpiData.totalRevenue - prevRevenue) / prevRevenue) * 100 
      : 0;
    this.kpiData.profitChange = prevProfit > 0 
      ? ((this.kpiData.totalProfit - prevProfit) / prevProfit) * 100 
      : 0;
  }

  getStartDate(): Date {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    switch (this.dateRange) {
      case 'today':
        return now;
      case 'week':
        now.setDate(now.getDate() - 7);
        return now;
      case 'month':
      default:
        now.setMonth(now.getMonth() - 1);
        return now;
    }
  }

  generateRecentActivity(bookings: any[]): void {
    const sorted = [...bookings]
      .sort((a, b) => new Date(b.dateInsert).getTime() - new Date(a.dateInsert).getTime())
      .slice(0, 5);

    this.recentActivity = sorted.map(b => {
      const profit = (b.lastPrice || b.pushPrice || 0) - (b.price || 0);
      const isProfit = profit >= 0;
      
      return {
        type: b.IsCanceled ? 'cancel' : b.IsSold ? 'sale' : 'booking',
        icon: b.IsCanceled ? 'cancel' : b.IsSold ? 'sell' : 'book',
        title: `${b.hotelName || 'Hotel'} - ${b.roomType || 'Room'}`,
        time: this.getRelativeTime(new Date(b.dateInsert)),
        value: isProfit ? `+$${profit.toFixed(0)}` : `-$${Math.abs(profit).toFixed(0)}`,
        valueClass: isProfit ? 'positive' : 'negative'
      };
    });
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  refreshData(): void {
    this.loadDashboardData();
  }
}
