import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
  category: 'navigation' | 'action' | 'view' | 'search';
}

/**
 * Keyboard Shortcuts Service
 * Power-user productivity shortcuts
 *
 * Usage:
 * - Ctrl+K: Global search
 * - Ctrl+B: Go to Bookings
 * - Ctrl+O: Go to Opportunities
 * - Ctrl+D: Go to Dashboard
 * - Ctrl+Shift+N: New Opportunity
 * - Escape: Close dialogs/panels
 * - ?: Show shortcuts help
 */
@Injectable({
  providedIn: 'root'
})
export class KeyboardShortcutsService implements OnDestroy {
  private shortcuts: KeyboardShortcut[] = [];
  private destroy$ = new Subject<void>();
  private enabled = true;

  // Events for components to subscribe
  globalSearch$ = new Subject<void>();
  newOpportunity$ = new Subject<void>();
  newBooking$ = new Subject<void>();
  refreshData$ = new Subject<void>();
  toggleSidebar$ = new Subject<void>();
  showHelp$ = new Subject<void>();

  constructor(
    private router: Router,
    private dialog: MatDialog
  ) {
    this.registerDefaultShortcuts();
    this.setupKeyboardListener();
  }

  private registerDefaultShortcuts(): void {
    this.shortcuts = [
      // Navigation
      {
        key: 'd',
        ctrl: true,
        description: 'Go to Dashboard',
        action: () => this.router.navigate(['/dashboard']),
        category: 'navigation'
      },
      {
        key: 'b',
        ctrl: true,
        description: 'Go to Bookings',
        action: () => this.router.navigate(['/bookings']),
        category: 'navigation'
      },
      {
        key: 'o',
        ctrl: true,
        description: 'Go to Opportunities',
        action: () => this.router.navigate(['/opportunities']),
        category: 'navigation'
      },
      {
        key: 'r',
        ctrl: true,
        description: 'Go to Reports',
        action: () => this.router.navigate(['/reports']),
        category: 'navigation'
      },
      {
        key: 'z',
        ctrl: true,
        description: 'Go to Zenith',
        action: () => this.router.navigate(['/zenith']),
        category: 'navigation'
      },

      // Search
      {
        key: 'k',
        ctrl: true,
        description: 'Global Search',
        action: () => this.globalSearch$.next(),
        category: 'search'
      },
      {
        key: '/',
        description: 'Focus Search',
        action: () => this.globalSearch$.next(),
        category: 'search'
      },

      // Actions
      {
        key: 'n',
        ctrl: true,
        shift: true,
        description: 'New Opportunity',
        action: () => this.newOpportunity$.next(),
        category: 'action'
      },
      {
        key: 'm',
        ctrl: true,
        shift: true,
        description: 'New Manual Booking',
        action: () => this.newBooking$.next(),
        category: 'action'
      },
      {
        key: 'r',
        ctrl: true,
        shift: true,
        description: 'Refresh Data',
        action: () => this.refreshData$.next(),
        category: 'action'
      },

      // View
      {
        key: '\\',
        ctrl: true,
        description: 'Toggle Sidebar',
        action: () => this.toggleSidebar$.next(),
        category: 'view'
      },
      {
        key: '?',
        shift: true,
        description: 'Show Keyboard Shortcuts',
        action: () => this.showHelp$.next(),
        category: 'view'
      },

      // Escape - close dialogs
      {
        key: 'Escape',
        description: 'Close Dialog / Cancel',
        action: () => this.closeAllDialogs(),
        category: 'action'
      }
    ];
  }

  private setupKeyboardListener(): void {
    document.addEventListener('keydown', this.handleKeydown.bind(this));
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable;

    // Allow Escape and Ctrl+K even in inputs
    const allowInInput = event.key === 'Escape' ||
                         (event.ctrlKey && event.key.toLowerCase() === 'k');

    if (isInput && !allowInInput) return;

    // Find matching shortcut
    const shortcut = this.shortcuts.find(s => {
      const keyMatch = s.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatch = !!s.ctrl === event.ctrlKey;
      const shiftMatch = !!s.shift === event.shiftKey;
      const altMatch = !!s.alt === event.altKey;

      return keyMatch && ctrlMatch && shiftMatch && altMatch;
    });

    if (shortcut) {
      event.preventDefault();
      shortcut.action();
    }
  }

  private closeAllDialogs(): void {
    this.dialog.closeAll();
  }

  getShortcuts(): KeyboardShortcut[] {
    return this.shortcuts;
  }

  getShortcutsByCategory(category: string): KeyboardShortcut[] {
    return this.shortcuts.filter(s => s.category === category);
  }

  formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.alt) parts.push('Alt');
    parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
    return parts.join(' + ');
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  registerShortcut(shortcut: KeyboardShortcut): void {
    this.shortcuts.push(shortcut);
  }

  unregisterShortcut(key: string): void {
    this.shortcuts = this.shortcuts.filter(s => s.key !== key);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.handleKeydown.bind(this));
    this.destroy$.next();
    this.destroy$.complete();
  }
}
