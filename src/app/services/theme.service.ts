import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'medici-theme';
  private themeSubject: BehaviorSubject<Theme>;
  public theme$: Observable<Theme>;

  constructor() {
    const savedTheme = this.getSavedTheme();
    this.themeSubject = new BehaviorSubject<Theme>(savedTheme);
    this.theme$ = this.themeSubject.asObservable();
    this.applyTheme(savedTheme);
    this.watchSystemPreference();
  }

  private getSavedTheme(): Theme {
    const saved = localStorage.getItem(this.THEME_KEY) as Theme;
    if (saved) {
      return saved;
    }

    // Check system preference - default to dark for premium look
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }

    return 'dark';
  }

  private watchSystemPreference(): void {
    window.matchMedia?.('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        // Only auto-switch if user hasn't set a preference
        if (!localStorage.getItem(this.THEME_KEY)) {
          const newTheme = e.matches ? 'dark' : 'light';
          this.themeSubject.next(newTheme);
          this.applyTheme(newTheme);
        }
      });
  }

  getCurrentTheme(): Theme {
    return this.themeSubject.value;
  }

  setTheme(theme: Theme): void {
    this.themeSubject.next(theme);
    this.applyTheme(theme);
    localStorage.setItem(this.THEME_KEY, theme);
  }

  toggleTheme(): boolean {
    const newTheme = this.themeSubject.value === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
    return newTheme === 'dark';
  }

  isDarkMode(): boolean {
    return this.themeSubject.value === 'dark';
  }

  private applyTheme(theme: Theme): void {
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      this.applyDarkThemeVariables(root);
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      this.applyLightThemeVariables(root);
    }

    // Also set data attribute for easier CSS targeting
    root.setAttribute('data-theme', theme);
  }

  private applyDarkThemeVariables(root: HTMLElement): void {
    // Medici World Trade Market - Premium Dark Theme with Gold Accents
    root.style.setProperty('--bg-primary', '#0a0e14');
    root.style.setProperty('--bg-secondary', '#12171f');
    root.style.setProperty('--bg-tertiary', '#1a2029');
    root.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.02)');
    root.style.setProperty('--bg-card-hover', 'rgba(255, 255, 255, 0.05)');
    root.style.setProperty('--bg-row-selected', 'rgba(212, 175, 55, 0.15)');
    root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--text-primary', '#f1f5f9');
    root.style.setProperty('--text-secondary', '#94a3b8');
    root.style.setProperty('--text-muted', '#64748b');
    // Gold/Amber accent colors (Medici branding)
    root.style.setProperty('--accent-primary', '#D4AF37');
    root.style.setProperty('--accent-secondary', '#C9A227');
    root.style.setProperty('--accent-light', '#E5C158');
    root.style.setProperty('--accent-dark', '#B8962E');
    root.style.setProperty('--success', '#22c55e');
    root.style.setProperty('--warning', '#f59e0b');
    root.style.setProperty('--error', '#ef4444');
    root.style.setProperty('--info', '#3b82f6');
    root.style.setProperty('--glow-color', 'rgba(212, 175, 55, 0.2)');
    root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.4)');
    // Status colors
    root.style.setProperty('--status-sold', '#22c55e');
    root.style.setProperty('--status-pending', '#D4AF37');
    root.style.setProperty('--status-bought', '#3b82f6');
    root.style.setProperty('--status-cancel', '#ef4444');
  }

  private applyLightThemeVariables(root: HTMLElement): void {
    // Medici World Trade Market - Light Theme with Gold Accents
    root.style.setProperty('--bg-primary', '#f8fafc');
    root.style.setProperty('--bg-secondary', '#ffffff');
    root.style.setProperty('--bg-tertiary', '#f1f5f9');
    root.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.9)');
    root.style.setProperty('--bg-card-hover', 'rgba(255, 255, 255, 1)');
    root.style.setProperty('--bg-row-selected', 'rgba(212, 175, 55, 0.1)');
    root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.1)');
    root.style.setProperty('--text-primary', '#0f172a');
    root.style.setProperty('--text-secondary', '#475569');
    root.style.setProperty('--text-muted', '#94a3b8');
    // Gold/Amber accent colors (Medici branding)
    root.style.setProperty('--accent-primary', '#B8962E');
    root.style.setProperty('--accent-secondary', '#9A7B1C');
    root.style.setProperty('--accent-light', '#D4AF37');
    root.style.setProperty('--accent-dark', '#7A6118');
    root.style.setProperty('--success', '#16a34a');
    root.style.setProperty('--warning', '#d97706');
    root.style.setProperty('--error', '#dc2626');
    root.style.setProperty('--info', '#2563eb');
    root.style.setProperty('--glow-color', 'rgba(212, 175, 55, 0.15)');
    root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.1)');
    // Status colors
    root.style.setProperty('--status-sold', '#16a34a');
    root.style.setProperty('--status-pending', '#B8962E');
    root.style.setProperty('--status-bought', '#2563eb');
    root.style.setProperty('--status-cancel', '#dc2626');
  }

  // Get CSS variable value
  getCssVariable(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
}
