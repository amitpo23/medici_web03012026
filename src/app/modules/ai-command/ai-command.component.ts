import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AICommandService, CommandResult, CommandMessage, Capability } from 'src/app/services/ai-command.service';

@Component({
  selector: 'app-ai-command',
  templateUrl: './ai-command.component.html',
  styleUrls: ['./ai-command.component.scss']
})
export class AICommandComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  selectedTabIndex = 0;

  // Command Center
  commandInput = '';
  isExecuting = false;
  commandResult: CommandResult | null = null;

  // Chat
  chatInput = '';
  isChatting = false;
  chatMessages: CommandMessage[] = [];
  sessionId: string;

  // Quick Actions
  quickActions = [
    { action: 'analyze_performance', label: 'Analyze Performance', icon: 'analytics' },
    { action: 'scan_market', label: 'Scan Market', icon: 'search' },
    { action: 'optimize_prices', label: 'Optimize Prices', icon: 'trending_up' },
    { action: 'calculate_price', label: 'Calculate Price', icon: 'attach_money' }
  ];
  isRunningAction = false;
  actionResult: CommandResult | null = null;

  // Status & Recommendations
  systemStatus: CommandResult | null = null;
  recommendations: CommandResult | null = null;
  isLoadingStatus = false;
  isLoadingRecommendations = false;

  // Capabilities
  capabilities: Capability[] = [];
  isLoadingCapabilities = false;

  // History
  history: CommandMessage[] = [];
  isLoadingHistory = false;

  constructor(
    private aiCommandService: AICommandService,
    private snackBar: MatSnackBar
  ) {
    this.sessionId = 'session-' + Date.now();
  }

  ngOnInit(): void {
    this.loadCapabilities();
    this.loadStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    switch (index) {
      case 2:
        this.loadStatus();
        this.loadRecommendations();
        break;
      case 3:
        this.loadHistory();
        break;
      case 4:
        this.loadCapabilities();
        break;
    }
  }

  executeCommand(): void {
    if (!this.commandInput.trim()) return;
    this.isExecuting = true;
    this.commandResult = null;

    this.aiCommandService.executeCommand(this.commandInput)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.commandResult = result;
          this.isExecuting = false;
        },
        error: (err) => {
          this.snackBar.open('Command failed: ' + (err.error?.message || err.message), 'Close', { duration: 5000 });
          this.isExecuting = false;
        }
      });
  }

  sendChat(): void {
    if (!this.chatInput.trim()) return;
    this.isChatting = true;

    const userMessage: CommandMessage = {
      role: 'user',
      content: this.chatInput,
      timestamp: new Date().toISOString()
    };
    this.chatMessages.push(userMessage);
    const message = this.chatInput;
    this.chatInput = '';

    this.aiCommandService.chat(message, this.sessionId, false)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          const aiMessage: CommandMessage = {
            role: 'assistant',
            content: result.response || JSON.stringify(result.data || result),
            timestamp: new Date().toISOString()
          };
          this.chatMessages.push(aiMessage);
          this.isChatting = false;
        },
        error: (err) => {
          const errorMessage: CommandMessage = {
            role: 'assistant',
            content: 'Error: ' + (err.error?.message || err.message),
            timestamp: new Date().toISOString()
          };
          this.chatMessages.push(errorMessage);
          this.isChatting = false;
        }
      });
  }

  runQuickAction(action: string): void {
    this.isRunningAction = true;
    this.actionResult = null;

    this.aiCommandService.executeAction(action)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.actionResult = result;
          this.isRunningAction = false;
        },
        error: (err) => {
          this.snackBar.open('Action failed: ' + (err.error?.message || err.message), 'Close', { duration: 5000 });
          this.isRunningAction = false;
        }
      });
  }

  loadStatus(): void {
    this.isLoadingStatus = true;
    this.aiCommandService.getStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.systemStatus = result;
          this.isLoadingStatus = false;
        },
        error: () => this.isLoadingStatus = false
      });
  }

  loadRecommendations(): void {
    this.isLoadingRecommendations = true;
    this.aiCommandService.getRecommendations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.recommendations = result;
          this.isLoadingRecommendations = false;
        },
        error: () => this.isLoadingRecommendations = false
      });
  }

  loadHistory(): void {
    this.isLoadingHistory = true;
    this.aiCommandService.getHistory(50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.history = data.messages;
          this.isLoadingHistory = false;
        },
        error: () => this.isLoadingHistory = false
      });
  }

  clearChatHistory(): void {
    this.aiCommandService.clearHistory()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.chatMessages = [];
          this.history = [];
          this.snackBar.open('History cleared', 'Close', { duration: 3000 });
        },
        error: (err) => {
          this.snackBar.open('Failed to clear history', 'Close', { duration: 3000 });
        }
      });
  }

  loadCapabilities(): void {
    this.isLoadingCapabilities = true;
    this.aiCommandService.getCapabilities()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.capabilities = data.capabilities;
          this.isLoadingCapabilities = false;
        },
        error: () => this.isLoadingCapabilities = false
      });
  }

  formatResult(result: CommandResult | null): string {
    if (!result) return '';
    if (result.response) return result.response;
    if (result.data) return JSON.stringify(result.data, null, 2);
    return JSON.stringify(result, null, 2);
  }
}
