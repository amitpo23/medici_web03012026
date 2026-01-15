import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from './environments/environment';
import { ThemeService } from './services/theme.service';

interface QuickStats {
  todayProfit: number;
  activeBookings: number;
  todayRevenue: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Medici Booking Engine';
  isDarkMode = false;
  quickStats: QuickStats | null = null;

  constructor(
    public router: Router,
    private http: HttpClient,
    private themeService: ThemeService
  ) {
    this.isDarkMode = this.themeService.isDarkMode();
  }

  ngOnInit(): void {
    if (this.isActive()) {
      this.loadQuickStats();
      // Refresh stats every 5 minutes
      setInterval(() => this.loadQuickStats(), 300000);
    }
  }

  isActive(): boolean {
    return this.router.url.indexOf('/sign-in') === -1;
  }

  toggleTheme(): void {
    this.isDarkMode = this.themeService.toggleTheme();
  }

  loadQuickStats(): void {
    this.http.get<any[]>(environment.baseUrl + 'Book/Bookings').subscribe({
      next: (bookings) => {
        const activeBookings = bookings.filter(b => !b.IsCanceled && b.IsSold);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayBookings = activeBookings.filter(b => new Date(b.dateInsert) >= today);
        
        this.quickStats = {
          activeBookings: activeBookings.length,
          todayRevenue: todayBookings.reduce((sum, b) => sum + (b.lastPrice || b.pushPrice || 0), 0),
          todayProfit: todayBookings.reduce((sum, b) => {
            const revenue = b.lastPrice || b.pushPrice || 0;
            const cost = b.price || 0;
            return sum + (revenue - cost);
          }, 0)
        };
      },
      error: () => {
        this.quickStats = { todayProfit: 0, activeBookings: 0, todayRevenue: 0 };
      }
    });
  }
}
