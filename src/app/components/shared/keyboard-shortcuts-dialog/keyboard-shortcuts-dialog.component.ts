import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { KeyboardShortcutsService, KeyboardShortcut } from '../../../services/keyboard-shortcuts.service';

@Component({
  selector: 'app-keyboard-shortcuts-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  template: `
    <div class="shortcuts-dialog">
      <div class="dialog-header">
        <div class="title-section">
          <mat-icon>keyboard</mat-icon>
          <h2>Keyboard Shortcuts</h2>
        </div>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="shortcuts-content">
        <!-- Navigation -->
        <div class="shortcut-category">
          <h3>
            <mat-icon>navigation</mat-icon>
            Navigation
          </h3>
          <div class="shortcuts-list">
            <div *ngFor="let shortcut of navigationShortcuts" class="shortcut-item">
              <span class="shortcut-desc">{{ shortcut.description }}</span>
              <kbd class="shortcut-key">{{ formatShortcut(shortcut) }}</kbd>
            </div>
          </div>
        </div>

        <!-- Search -->
        <div class="shortcut-category">
          <h3>
            <mat-icon>search</mat-icon>
            Search
          </h3>
          <div class="shortcuts-list">
            <div *ngFor="let shortcut of searchShortcuts" class="shortcut-item">
              <span class="shortcut-desc">{{ shortcut.description }}</span>
              <kbd class="shortcut-key">{{ formatShortcut(shortcut) }}</kbd>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="shortcut-category">
          <h3>
            <mat-icon>bolt</mat-icon>
            Actions
          </h3>
          <div class="shortcuts-list">
            <div *ngFor="let shortcut of actionShortcuts" class="shortcut-item">
              <span class="shortcut-desc">{{ shortcut.description }}</span>
              <kbd class="shortcut-key">{{ formatShortcut(shortcut) }}</kbd>
            </div>
          </div>
        </div>

        <!-- View -->
        <div class="shortcut-category">
          <h3>
            <mat-icon>visibility</mat-icon>
            View
          </h3>
          <div class="shortcuts-list">
            <div *ngFor="let shortcut of viewShortcuts" class="shortcut-item">
              <span class="shortcut-desc">{{ shortcut.description }}</span>
              <kbd class="shortcut-key">{{ formatShortcut(shortcut) }}</kbd>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <span class="hint">Press <kbd>?</kbd> anytime to show this dialog</span>
      </div>
    </div>
  `,
  styles: [`
    .shortcuts-dialog {
      background: linear-gradient(135deg, #0f1419 0%, #1a1f35 100%);
      border-radius: 16px;
      min-width: 500px;
      max-width: 600px;
      color: #e2e8f0;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .title-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .title-section mat-icon {
      color: #818cf8;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .title-section h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .shortcuts-content {
      padding: 20px 24px;
      max-height: 60vh;
      overflow-y: auto;
    }

    .shortcut-category {
      margin-bottom: 24px;
    }

    .shortcut-category:last-child {
      margin-bottom: 0;
    }

    .shortcut-category h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #818cf8;
      margin: 0 0 12px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .shortcut-category h3 mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .shortcuts-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .shortcut-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      transition: background 0.2s;
    }

    .shortcut-item:hover {
      background: rgba(255,255,255,0.06);
    }

    .shortcut-desc {
      font-size: 14px;
      color: #94a3b8;
    }

    .shortcut-key {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 500;
      color: #a5b4fc;
    }

    .dialog-footer {
      padding: 16px 24px;
      border-top: 1px solid rgba(255,255,255,0.1);
      text-align: center;
    }

    .hint {
      font-size: 12px;
      color: #64748b;
    }

    .hint kbd {
      padding: 2px 6px;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Scrollbar */
    .shortcuts-content::-webkit-scrollbar {
      width: 6px;
    }

    .shortcuts-content::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.05);
      border-radius: 3px;
    }

    .shortcuts-content::-webkit-scrollbar-thumb {
      background: rgba(99, 102, 241, 0.3);
      border-radius: 3px;
    }
  `]
})
export class KeyboardShortcutsDialogComponent implements OnInit {
  navigationShortcuts: KeyboardShortcut[] = [];
  searchShortcuts: KeyboardShortcut[] = [];
  actionShortcuts: KeyboardShortcut[] = [];
  viewShortcuts: KeyboardShortcut[] = [];

  constructor(
    private dialogRef: MatDialogRef<KeyboardShortcutsDialogComponent>,
    private keyboardService: KeyboardShortcutsService
  ) {}

  ngOnInit(): void {
    this.navigationShortcuts = this.keyboardService.getShortcutsByCategory('navigation');
    this.searchShortcuts = this.keyboardService.getShortcutsByCategory('search');
    this.actionShortcuts = this.keyboardService.getShortcutsByCategory('action');
    this.viewShortcuts = this.keyboardService.getShortcutsByCategory('view');
  }

  formatShortcut(shortcut: KeyboardShortcut): string {
    return this.keyboardService.formatShortcut(shortcut);
  }

  close(): void {
    this.dialogRef.close();
  }
}
