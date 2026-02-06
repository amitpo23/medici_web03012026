import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeService, Theme } from '../../../services/theme.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <button
      mat-icon-button
      class="theme-toggle"
      [class.light]="currentTheme === 'light'"
      (click)="toggle()"
      [matTooltip]="currentTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
      <div class="icon-container">
        <mat-icon class="sun-icon">light_mode</mat-icon>
        <mat-icon class="moon-icon">dark_mode</mat-icon>
      </div>
    </button>
  `,
  styles: [`
    .theme-toggle {
      position: relative;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--bg-card, rgba(255, 255, 255, 0.05));
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
      transition: all 0.3s ease;
      overflow: hidden;
    }

    .theme-toggle:hover {
      background: var(--bg-card-hover, rgba(255, 255, 255, 0.1));
      border-color: rgba(129, 140, 248, 0.3);
    }

    .theme-toggle.light {
      background: rgba(99, 102, 241, 0.1);
      border-color: rgba(99, 102, 241, 0.2);
    }

    .icon-container {
      position: relative;
      width: 24px;
      height: 24px;
    }

    .sun-icon, .moon-icon {
      position: absolute;
      top: 0;
      left: 0;
      transition: all 0.3s ease;
    }

    .sun-icon {
      color: #fbbf24;
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }

    .moon-icon {
      color: #818cf8;
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

    .theme-toggle.light .sun-icon {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

    .theme-toggle.light .moon-icon {
      opacity: 0;
      transform: rotate(90deg) scale(0.5);
    }

    /* Ripple effect */
    .theme-toggle::after {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      background: radial-gradient(circle, rgba(129, 140, 248, 0.3) 0%, transparent 70%);
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: width 0.3s, height 0.3s;
    }

    .theme-toggle:active::after {
      width: 100px;
      height: 100px;
    }
  `]
})
export class ThemeToggleComponent implements OnInit, OnDestroy {
  currentTheme: Theme = 'dark';
  private destroy$ = new Subject<void>();

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeService.theme$
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => {
        this.currentTheme = theme;
      });
  }

  toggle(): void {
    this.themeService.toggleTheme();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
