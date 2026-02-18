import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  color: string;
  route?: string;
  action?: () => void;
  shortcut?: string;
}

@Component({
  selector: 'app-quick-actions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatDialogModule
  ],
  animations: [
    trigger('fabAnimation', [
      state('closed', style({
        transform: 'scale(0)',
        opacity: 0
      })),
      state('open', style({
        transform: 'scale(1)',
        opacity: 1
      })),
      transition('closed => open', [
        animate('200ms ease-out')
      ]),
      transition('open => closed', [
        animate('150ms ease-in')
      ])
    ]),
    trigger('rotateIcon', [
      state('closed', style({ transform: 'rotate(0)' })),
      state('open', style({ transform: 'rotate(45deg)' })),
      transition('closed <=> open', animate('200ms ease-out'))
    ])
  ],
  template: `
    <div class="quick-actions-container" [class.expanded]="isExpanded">
      <!-- Action Buttons -->
      <div class="action-buttons" *ngIf="isExpanded">
        <button *ngFor="let action of actions; let i = index"
                mat-mini-fab
                [style.background-color]="action.color"
                [matTooltip]="action.label + (action.shortcut ? ' (' + action.shortcut + ')' : '')"
                matTooltipPosition="left"
                [@fabAnimation]="isExpanded ? 'open' : 'closed'"
                [style.animation-delay]="(i * 50) + 'ms'"
                (click)="executeAction(action)">
          <mat-icon>{{ action.icon }}</mat-icon>
        </button>
      </div>

      <!-- Main FAB -->
      <button mat-fab
              color="primary"
              class="main-fab"
              (click)="toggleExpanded()"
              matTooltip="Quick Actions (Press Q)"
              matTooltipPosition="left">
        <mat-icon [@rotateIcon]="isExpanded ? 'open' : 'closed'">add</mat-icon>
      </button>
    </div>

    <!-- Command Palette Overlay -->
    <div class="command-palette-overlay" *ngIf="showCommandPalette" (click)="closeCommandPalette()">
      <div class="command-palette" (click)="$event.stopPropagation()">
        <div class="palette-header">
          <mat-icon>keyboard</mat-icon>
          <input type="text"
                 placeholder="Type a command..."
                 [(ngModel)]="commandQuery"
                 (keyup)="filterCommands()"
                 (keydown.escape)="closeCommandPalette()"
                 (keydown.enter)="executeFirstCommand()"
                 #commandInput />
        </div>
        <div class="palette-results">
          <div *ngFor="let action of filteredActions"
               class="palette-item"
               (click)="executeAction(action); closeCommandPalette()">
            <mat-icon [style.color]="action.color">{{ action.icon }}</mat-icon>
            <span class="item-label">{{ action.label }}</span>
            <span class="item-shortcut" *ngIf="action.shortcut">{{ action.shortcut }}</span>
          </div>
          <div class="no-results" *ngIf="filteredActions.length === 0">
            No matching commands
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .quick-actions-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      z-index: 1000;
    }

    .main-fab {
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    .action-buttons {
      display: flex;
      flex-direction: column-reverse;
      margin-bottom: 12px;
      gap: 12px;
    }

    .action-buttons button {
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    .command-palette-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding-top: 100px;
      z-index: 2000;
      backdrop-filter: blur(2px);
    }

    .command-palette {
      width: 500px;
      max-width: 90vw;
      background: white;
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.3);
      overflow: hidden;
    }

    .palette-header {
      display: flex;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #eee;
    }

    .palette-header mat-icon {
      margin-right: 12px;
      color: #666;
    }

    .palette-header input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 16px;
      background: transparent;
    }

    .palette-results {
      max-height: 400px;
      overflow-y: auto;
    }

    .palette-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .palette-item:hover {
      background: #f5f5f5;
    }

    .palette-item mat-icon {
      margin-right: 12px;
    }

    .item-label {
      flex: 1;
    }

    .item-shortcut {
      font-size: 12px;
      color: #999;
      background: #f0f0f0;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .no-results {
      padding: 24px;
      text-align: center;
      color: #999;
    }
  `]
})
export class QuickActionsComponent implements OnInit {
  isExpanded = false;
  showCommandPalette = false;
  commandQuery = '';
  filteredActions: QuickAction[] = [];

  actions: QuickAction[] = [
    {
      id: 'new-search',
      icon: 'search',
      label: 'New Search',
      color: '#2196f3',
      route: '/search-price',
      shortcut: 'Alt+S'
    },
    {
      id: 'ai-chat',
      icon: 'smart_toy',
      label: 'AI Chat',
      color: '#9c27b0',
      route: '/ai-chat',
      shortcut: 'Alt+A'
    },
    {
      id: 'opportunities',
      icon: 'trending_up',
      label: 'View Opportunities',
      color: '#4caf50',
      route: '/options',
      shortcut: 'Alt+O'
    },
    {
      id: 'bookings',
      icon: 'hotel',
      label: 'Active Bookings',
      color: '#ff9800',
      route: '/rooms',
      shortcut: 'Alt+B'
    },
    {
      id: 'dashboard',
      icon: 'dashboard',
      label: 'Dashboard',
      color: '#607d8b',
      route: '/dashboard',
      shortcut: 'Alt+D'
    },
    {
      id: 'alerts',
      icon: 'notifications',
      label: 'Alerts',
      color: '#f44336',
      route: '/alerts',
      shortcut: 'Alt+N'
    }
  ];

  constructor(private router: Router) {
    this.filteredActions = [...this.actions];
  }

  ngOnInit(): void {
    // Register keyboard shortcuts
    document.addEventListener('keydown', this.handleKeydown.bind(this));
  }

  handleKeydown(event: KeyboardEvent): void {
    // Command palette: Ctrl+K or Cmd+K
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      this.toggleCommandPalette();
      return;
    }

    // Quick toggle: Q key (when not typing)
    if (event.key === 'q' && !this.isTyping()) {
      this.toggleExpanded();
      return;
    }

    // Escape to close
    if (event.key === 'Escape') {
      this.isExpanded = false;
      this.showCommandPalette = false;
      return;
    }

    // Alt shortcuts
    if (event.altKey) {
      const shortcuts: Record<string, string> = {
        's': 'new-search',
        'a': 'ai-chat',
        'o': 'opportunities',
        'b': 'bookings',
        'd': 'dashboard',
        'n': 'alerts'
      };

      const actionId = shortcuts[event.key.toLowerCase()];
      if (actionId) {
        event.preventDefault();
        const action = this.actions.find(a => a.id === actionId);
        if (action) this.executeAction(action);
      }
    }
  }

  isTyping(): boolean {
    const activeElement = document.activeElement;
    return activeElement instanceof HTMLInputElement ||
           activeElement instanceof HTMLTextAreaElement ||
           activeElement?.getAttribute('contenteditable') === 'true';
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  toggleCommandPalette(): void {
    this.showCommandPalette = !this.showCommandPalette;
    if (this.showCommandPalette) {
      this.commandQuery = '';
      this.filteredActions = [...this.actions];
      setTimeout(() => {
        const input = document.querySelector('.palette-header input') as HTMLInputElement;
        input?.focus();
      }, 100);
    }
  }

  closeCommandPalette(): void {
    this.showCommandPalette = false;
  }

  filterCommands(): void {
    const query = this.commandQuery.toLowerCase();
    this.filteredActions = this.actions.filter(a =>
      a.label.toLowerCase().includes(query) ||
      a.id.toLowerCase().includes(query)
    );
  }

  executeFirstCommand(): void {
    if (this.filteredActions.length > 0) {
      this.executeAction(this.filteredActions[0]);
      this.closeCommandPalette();
    }
  }

  executeAction(action: QuickAction): void {
    this.isExpanded = false;
    if (action.route) {
      this.router.navigate([action.route]);
    } else if (action.action) {
      action.action();
    }
  }
}
