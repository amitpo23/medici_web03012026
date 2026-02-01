import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ThemeService } from './services/theme.service';
import { DashboardService } from './services/dashboard.service';

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
export class AppComponent implements OnInit, OnDestroy {
  title = 'Medici Booking Engine';
  isDarkMode = false;
  quickStats: QuickStats | null = null;
  private _destroy$ = new Subject<void>();
  private _statsIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    public router: Router,
    private dashboardService: DashboardService,
    private themeService: ThemeService
  ) {
    this.isDarkMode = this.themeService.isDarkMode();
  }

  ngOnInit(): void {
    if (this.isActive()) {
      this.loadQuickStats();
      // Refresh stats every 5 minutes
      this._statsIntervalId = setInterval(() => this.loadQuickStats(), 300000);
    }
  }

  ngOnDestroy(): void {
    if (this._statsIntervalId) {
      clearInterval(this._statsIntervalId);
    }
    this._destroy$.next();
    this._destroy$.complete();
  }

  isActive(): boolean {
    return this.router.url.indexOf('/sign-in') === -1;
  }

  toggleTheme(): void {
    this.isDarkMode = this.themeService.toggleTheme();
  }

  loadQuickStats(): void {
    this.dashboardService.getStats(1)
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (stats) => {
          this.quickStats = {
            activeBookings: stats.overview.ActiveCount || 0,
            todayRevenue: stats.overview.TotalPushPrice || 0,
            todayProfit: stats.overview.TotalExpectedProfit || 0
          };
        },
        error: () => {
          this.quickStats = { todayProfit: 0, activeBookings: 0, todayRevenue: 0 };
        }
      });
  }
}
