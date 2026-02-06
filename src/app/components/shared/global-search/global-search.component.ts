import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Router } from '@angular/router';
import { Subject, debounceTime, takeUntil } from 'rxjs';

interface SearchResult {
  type: 'booking' | 'opportunity' | 'hotel' | 'page';
  id?: string | number;
  title: string;
  subtitle?: string;
  icon: string;
  route: string;
}

/**
 * Global Search Component
 * Ctrl+K to open, search across bookings, opportunities, hotels, and pages
 */
@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule
  ],
  template: `
    <div class="global-search">
      <div class="search-header">
        <mat-icon>search</mat-icon>
        <input
          #searchInput
          type="text"
          [(ngModel)]="searchQuery"
          (ngModelChange)="onSearch($event)"
          (keydown)="onKeydown($event)"
          placeholder="Search bookings, opportunities, hotels..."
          autocomplete="off">
        <kbd>ESC</kbd>
      </div>

      <div class="search-results" *ngIf="searchQuery.length > 0">
        <!-- Quick Actions -->
        <div class="result-section" *ngIf="quickActions.length > 0">
          <div class="section-title">Quick Actions</div>
          <div
            *ngFor="let action of quickActions; let i = index"
            class="result-item"
            [class.selected]="selectedIndex === i"
            (click)="selectResult(action)"
            (mouseenter)="selectedIndex = i">
            <mat-icon class="result-icon action">{{ action.icon }}</mat-icon>
            <div class="result-content">
              <div class="result-title">{{ action.title }}</div>
              <div class="result-subtitle">{{ action.subtitle }}</div>
            </div>
            <kbd>Enter</kbd>
          </div>
        </div>

        <!-- Pages -->
        <div class="result-section" *ngIf="pageResults.length > 0">
          <div class="section-title">Pages</div>
          <div
            *ngFor="let page of pageResults; let i = index"
            class="result-item"
            [class.selected]="selectedIndex === quickActions.length + i"
            (click)="selectResult(page)"
            (mouseenter)="selectedIndex = quickActions.length + i">
            <mat-icon class="result-icon page">{{ page.icon }}</mat-icon>
            <div class="result-content">
              <div class="result-title">{{ page.title }}</div>
              <div class="result-subtitle">{{ page.subtitle }}</div>
            </div>
          </div>
        </div>

        <!-- No Results -->
        <div class="no-results" *ngIf="searchQuery.length > 2 && allResults.length === 0">
          <mat-icon>search_off</mat-icon>
          <p>No results for "{{ searchQuery }}"</p>
        </div>
      </div>

      <!-- Help -->
      <div class="search-footer" *ngIf="searchQuery.length === 0">
        <div class="hint">
          <kbd>↑</kbd><kbd>↓</kbd> to navigate
          <kbd>Enter</kbd> to select
          <kbd>ESC</kbd> to close
        </div>
      </div>
    </div>
  `,
  styles: [`
    .global-search {
      background: linear-gradient(135deg, #0f1419 0%, #1a1f35 100%);
      border-radius: 16px;
      width: 600px;
      max-width: 90vw;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    .search-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .search-header mat-icon {
      color: #64748b;
      font-size: 24px;
    }

    .search-header input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      font-size: 18px;
      color: #f1f5f9;
      font-family: inherit;
    }

    .search-header input::placeholder {
      color: #64748b;
    }

    .search-header kbd {
      padding: 4px 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      font-size: 12px;
      color: #64748b;
      font-family: 'JetBrains Mono', monospace;
    }

    .search-results {
      max-height: 400px;
      overflow-y: auto;
      padding: 8px;
    }

    .result-section {
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      padding: 8px 12px;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .result-item:hover,
    .result-item.selected {
      background: rgba(99, 102, 241, 0.1);
    }

    .result-item.selected {
      border: 1px solid rgba(99, 102, 241, 0.3);
    }

    .result-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      font-size: 20px;
    }

    .result-icon.action {
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
    }

    .result-icon.page {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }

    .result-icon.booking {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
    }

    .result-icon.opportunity {
      background: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
    }

    .result-content {
      flex: 1;
    }

    .result-title {
      font-size: 14px;
      font-weight: 500;
      color: #f1f5f9;
    }

    .result-subtitle {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }

    .result-item kbd {
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      font-size: 10px;
      color: #64748b;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .result-item.selected kbd {
      opacity: 1;
    }

    .no-results {
      text-align: center;
      padding: 40px 20px;
      color: #64748b;
    }

    .no-results mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
      opacity: 0.5;
    }

    .search-footer {
      padding: 12px 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 12px;
      color: #64748b;
    }

    .hint kbd {
      padding: 2px 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Scrollbar */
    .search-results::-webkit-scrollbar {
      width: 6px;
    }

    .search-results::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
    }

    .search-results::-webkit-scrollbar-thumb {
      background: rgba(99, 102, 241, 0.3);
      border-radius: 3px;
    }
  `]
})
export class GlobalSearchComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  searchQuery = '';
  selectedIndex = 0;
  quickActions: SearchResult[] = [];
  pageResults: SearchResult[] = [];
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // All available pages
  private pages: SearchResult[] = [
    { type: 'page', title: 'Dashboard', subtitle: 'Overview and statistics', icon: 'dashboard', route: '/dashboard' },
    { type: 'page', title: 'Bookings', subtitle: 'Manage hotel bookings', icon: 'book', route: '/bookings' },
    { type: 'page', title: 'Opportunities', subtitle: 'Buy opportunities', icon: 'trending_up', route: '/opportunities' },
    { type: 'page', title: 'Zenith Distribution', subtitle: 'Push and manage rates', icon: 'cloud_upload', route: '/zenith' },
    { type: 'page', title: 'Reports', subtitle: 'Analytics and insights', icon: 'assessment', route: '/reports' },
    { type: 'page', title: 'Revenue Analytics', subtitle: 'Revenue tracking', icon: 'attach_money', route: '/revenue' },
    { type: 'page', title: 'AI Chat', subtitle: 'Ask questions in natural language', icon: 'smart_toy', route: '/ai-chat' },
    { type: 'page', title: 'Trading Exchange', subtitle: 'Room inventory trading', icon: 'swap_horiz', route: '/trading-exchange' },
    { type: 'page', title: 'Data Explorer', subtitle: 'Explore database tables', icon: 'storage', route: '/data-explorer' },
    { type: 'page', title: 'Activity Feed', subtitle: 'Recent system activity', icon: 'history', route: '/activity-feed' },
    { type: 'page', title: 'Alerts', subtitle: 'System alerts and notifications', icon: 'notifications', route: '/alerts' },
    { type: 'page', title: 'Search Hotels', subtitle: 'Search for available rooms', icon: 'hotel', route: '/search' },
    { type: 'page', title: 'Settings', subtitle: 'System configuration', icon: 'settings', route: '/settings' }
  ];

  constructor(
    private dialogRef: MatDialogRef<GlobalSearchComponent>,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Focus input on open
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 100);

    // Debounced search
    this.searchSubject
      .pipe(
        debounceTime(150),
        takeUntil(this.destroy$)
      )
      .subscribe(query => this.performSearch(query));
  }

  onSearch(query: string): void {
    this.searchSubject.next(query);
  }

  private performSearch(query: string): void {
    const q = query.toLowerCase().trim();
    this.selectedIndex = 0;

    if (q.length === 0) {
      this.quickActions = [];
      this.pageResults = [];
      return;
    }

    // Quick actions based on query
    this.quickActions = [];
    if (q.includes('book') || q.includes('new')) {
      this.quickActions.push({
        type: 'booking',
        title: 'Create New Booking',
        subtitle: 'Open manual booking form',
        icon: 'add_circle',
        route: '/bookings?action=new'
      });
    }
    if (q.includes('opp') || q.includes('new')) {
      this.quickActions.push({
        type: 'opportunity',
        title: 'Create New Opportunity',
        subtitle: 'Add a buy opportunity',
        icon: 'add_circle',
        route: '/opportunities?action=new'
      });
    }

    // Filter pages
    this.pageResults = this.pages.filter(page =>
      page.title.toLowerCase().includes(q) ||
      page.subtitle?.toLowerCase().includes(q)
    );
  }

  get allResults(): SearchResult[] {
    return [...this.quickActions, ...this.pageResults];
  }

  onKeydown(event: KeyboardEvent): void {
    const total = this.allResults.length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % Math.max(total, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = this.selectedIndex > 0 ? this.selectedIndex - 1 : Math.max(total - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.allResults[this.selectedIndex]) {
          this.selectResult(this.allResults[this.selectedIndex]);
        }
        break;
      case 'Escape':
        this.dialogRef.close();
        break;
    }
  }

  selectResult(result: SearchResult): void {
    this.dialogRef.close();
    this.router.navigateByUrl(result.route);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
