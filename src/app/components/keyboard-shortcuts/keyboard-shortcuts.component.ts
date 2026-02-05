import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

@Component({
  selector: 'app-keyboard-shortcuts-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="shortcuts-dialog">
      <div class="dialog-header">
        <mat-icon>keyboard</mat-icon>
        <h2>Keyboard Shortcuts</h2>
        <button mat-icon-button mat-dialog-close class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="shortcuts-content">
        <div *ngFor="let group of shortcutGroups" class="shortcut-group">
          <h3>{{ group.title }}</h3>
          <div class="shortcut-list">
            <div *ngFor="let shortcut of group.shortcuts" class="shortcut-item">
              <span class="shortcut-keys">
                <kbd *ngFor="let key of shortcut.keys.split('+')"
                     class="key">{{ key }}</kbd>
              </span>
              <span class="shortcut-desc">{{ shortcut.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <span class="tip">Press <kbd>?</kbd> anytime to show this dialog</span>
      </div>
    </div>
  `,
  styles: [`
    .shortcuts-dialog {
      width: 500px;
      max-width: 90vw;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
    }

    .dialog-header h2 {
      flex: 1;
      margin: 0;
      font-size: 18px;
    }

    .dialog-header mat-icon {
      color: #666;
    }

    .shortcuts-content {
      padding: 16px 24px;
      max-height: 60vh;
      overflow-y: auto;
    }

    .shortcut-group {
      margin-bottom: 24px;
    }

    .shortcut-group:last-child {
      margin-bottom: 0;
    }

    .shortcut-group h3 {
      font-size: 14px;
      color: #666;
      margin: 0 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .shortcut-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .shortcut-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
    }

    .shortcut-keys {
      display: flex;
      gap: 4px;
    }

    kbd.key {
      display: inline-block;
      padding: 4px 8px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }

    .shortcut-desc {
      color: #333;
    }

    .dialog-footer {
      padding: 12px 24px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
    }

    .tip {
      font-size: 12px;
      color: #999;
    }

    .tip kbd {
      padding: 2px 6px;
      background: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 3px;
      font-family: monospace;
    }
  `]
})
export class KeyboardShortcutsDialogComponent {
  shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Navigation',
      shortcuts: [
        { keys: 'Alt+D', description: 'Go to Dashboard' },
        { keys: 'Alt+S', description: 'New Search' },
        { keys: 'Alt+A', description: 'Open AI Chat' },
        { keys: 'Alt+O', description: 'View Opportunities' },
        { keys: 'Alt+B', description: 'Active Bookings' },
        { keys: 'Alt+N', description: 'View Alerts' }
      ]
    },
    {
      title: 'Quick Actions',
      shortcuts: [
        { keys: 'Ctrl+K', description: 'Open Command Palette' },
        { keys: 'Q', description: 'Toggle Quick Actions Menu' },
        { keys: 'Escape', description: 'Close dialogs/menus' }
      ]
    },
    {
      title: 'General',
      shortcuts: [
        { keys: '?', description: 'Show this help dialog' },
        { keys: 'Ctrl+/', description: 'Focus search' }
      ]
    }
  ];
}

/**
 * Service to manage keyboard shortcuts globally
 */
@Component({
  selector: 'app-keyboard-shortcuts-listener',
  standalone: true,
  imports: [],
  template: ''
})
export class KeyboardShortcutsListenerComponent {
  constructor(private dialog: MatDialog) {}

  @HostListener('document:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent): void {
    // Show help dialog on '?' key
    if (event.key === '?' && !this.isTyping()) {
      event.preventDefault();
      this.showHelpDialog();
    }
  }

  private isTyping(): boolean {
    const activeElement = document.activeElement;
    return activeElement instanceof HTMLInputElement ||
           activeElement instanceof HTMLTextAreaElement ||
           activeElement?.getAttribute('contenteditable') === 'true';
  }

  private showHelpDialog(): void {
    this.dialog.open(KeyboardShortcutsDialogComponent, {
      width: '500px',
      maxWidth: '90vw'
    });
  }
}
