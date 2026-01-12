import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ThemeService } from '../../services/theme.service';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('500ms ease-in', style({ opacity: 1 }))
      ])
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('500ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ])
    ])
  ]
})
export class DashboardComponent implements OnInit {
  baseUrl = environment.baseUrl;
  loading = true;
  isDarkMode = false;

  // KPI Data
  kpiData = {
    totalRevenue: 0,
    totalProfit: 0,
    averageOccupancy: 0,
    activeBookings: 0,
    profitMargin: 0,
    todayRevenue: 0
  };

  constructor(
    private http: HttpClient,
    private themeService: ThemeService
  ) {
    this.isDarkMode = this.themeService.getCurrentTheme() === 'dark';
  }

  ngOnInit(): void {
    this.loadDashboardData();
    
    // Subscribe to theme changes
    this.themeService.theme$.subscribe(theme => {
      this.isDarkMode = theme === 'dark';
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  loadDashboardData(): void {
    this.loading = true;
    
    // Load bookings and calculate KPIs
    this.http.get<any[]>(this.baseUrl + 'Book/Bookings').subscribe({
      next: (bookings) => {
        this.calculateKPIs(bookings);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading dashboard data:', err);
        this.loading = false;
      }
    });
  }

  calculateKPIs(bookings: any[]): void {
    const activeBookings = bookings.filter(b => !b.IsCanceled && b.IsSold);
    
    this.kpiData.activeBookings = activeBookings.length;
    this.kpiData.totalRevenue = activeBookings.reduce((sum, b) => sum + (b.lastPrice || b.pushPrice || 0), 0);
    this.kpiData.totalProfit = activeBookings.reduce((sum, b) => {
      const revenue = b.lastPrice || b.pushPrice || 0;
      const cost = b.price || 0;
      return sum + (revenue - cost);
    }, 0);
    
    if (this.kpiData.totalRevenue > 0) {
      this.kpiData.profitMargin = (this.kpiData.totalProfit / this.kpiData.totalRevenue) * 100;
    }

    // Calculate today's revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    this.kpiData.todayRevenue = activeBookings
      .filter(b => new Date(b.dateInsert) >= today)
      .reduce((sum, b) => sum + (b.lastPrice || b.pushPrice || 0), 0);

    // Average occupancy (simplified calculation)
    this.kpiData.averageOccupancy = activeBookings.length > 0 ? 75 : 0; // Placeholder
  }

  refreshData(): void {
    this.loadDashboardData();
  }
}
