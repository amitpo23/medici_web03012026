import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DashboardService } from './services/dashboard.service';
import { ThemeService } from './services/theme.service';
import { KeyboardShortcutsService } from './services/keyboard-shortcuts.service';
import { KeyboardShortcutsDialogComponent } from './components/shared/keyboard-shortcuts-dialog/keyboard-shortcuts-dialog.component';
import { GlobalSearchComponent } from './components/shared/global-search/global-search.component';

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
  activeAlertsCount = 0; // For monitoring menu badge
  private _destroy$ = new Subject<void>();
  private _statsIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    public router: Router,
    private dashboardService: DashboardService,
    private themeService: ThemeService,
    private keyboardService: KeyboardShortcutsService,
    private dialog: MatDialog
  ) {
    this.isDarkMode = this.themeService.isDarkMode();
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts(): void {
    // Global search (Ctrl+K)
    this.keyboardService.globalSearch$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this.dialog.open(GlobalSearchComponent, {
          panelClass: 'global-search-dialog',
          backdropClass: 'global-search-backdrop',
          width: '600px',
          maxWidth: '90vw'
        });
      });

    // Show shortcuts help (?)
    this.keyboardService.showHelp$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this.dialog.open(KeyboardShortcutsDialogComponent, {
          panelClass: 'shortcuts-dialog',
          width: '550px'
        });
      });

    // Refresh data (Ctrl+Shift+R)
    this.keyboardService.refreshData$
      .pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        this.loadQuickStats();
        this.loadActiveAlertsCount();
      });
  }

  ngOnInit(): void {
    if (this.isActive()) {
      this.loadQuickStats();
      this.loadActiveAlertsCount(); // Load alerts count
      // Refresh stats every 5 minutes
      this._statsIntervalId = setInterval(() => {
        this.loadQuickStats();
        this.loadActiveAlertsCount();
      }, 300000);
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

  loadActiveAlertsCount(): void {
    // Simulate API call - replace with actual alert service when available
    // For now, check if there are any system issues
    fetch(`${window.location.origin}/api/alert-management/active`)
      .then(res => res.json())
      .then(data => {
        this.activeAlertsCount = data.length || 0;
      })
      .catch(() => {
        this.activeAlertsCount = 0;
      });
  }
}
