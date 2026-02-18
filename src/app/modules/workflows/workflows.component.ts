import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  DecisionRule,
  DecisionHistoryItem,
  ProcessResult,
  BatchProcessResult,
  WorkflowsService
} from 'src/app/services/workflows.service';

@Component({
  selector: 'app-workflows',
  templateUrl: './workflows.component.html',
  styleUrls: ['./workflows.component.scss']
})
export class WorkflowsComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // Snackbar config
  horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  verticalPosition: MatSnackBarVerticalPosition = 'bottom';
  durationInSeconds = 5;

  // Tab state
  selectedTabIndex = 0;

  // Loading states
  isLoadingRules = false;
  isProcessing = false;
  isBatchProcessing = false;
  isLoadingHistory = false;

  // Decision Rules
  rules: DecisionRule[] = [];

  // Process Opportunity
  opportunityId: number | null = null;
  processResult: ProcessResult | null = null;

  // Batch Process
  batchIdsText = '';
  batchResult: BatchProcessResult | null = null;

  // Decision History
  history: DecisionHistoryItem[] = [];
  historyLimit = 100;
  historyDisplayedColumns: string[] = ['timestamp', 'opportunityId', 'ruleName', 'action', 'details'];

  constructor(
    private workflowsService: WorkflowsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadRules();
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Decision Rules ---

  loadRules(): void {
    this.isLoadingRules = true;
    this.workflowsService.getRules()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.rules = Array.isArray(data.rules) ? data.rules : [];
          this.isLoadingRules = false;
        },
        error: (err) => {
          this.isLoadingRules = false;
          this.showError('Failed to load decision rules: ' + (err.error?.message || err.message));
        }
      });
  }

  toggleRule(rule: DecisionRule): void {
    const newEnabled = !rule.enabled;
    this.workflowsService.updateRule(rule.id, newEnabled)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          rule.enabled = newEnabled;
          this.showSuccess('Rule "' + rule.name + '" ' + (newEnabled ? 'enabled' : 'disabled'));
        },
        error: (err) => {
          this.showError('Failed to update rule: ' + (err.error?.message || err.message));
        }
      });
  }

  // --- Process Single Opportunity ---

  processOpportunity(): void {
    if (this.opportunityId === null || this.opportunityId === undefined) {
      this.showError('Please enter a valid Opportunity ID');
      return;
    }

    this.isProcessing = true;
    this.processResult = null;

    this.workflowsService.processOpportunity(this.opportunityId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.processResult = result;
          this.isProcessing = false;
          this.showSuccess('Opportunity #' + this.opportunityId + ' processed successfully');
        },
        error: (err) => {
          this.isProcessing = false;
          this.showError('Failed to process opportunity: ' + (err.error?.message || err.message));
        }
      });
  }

  // --- Batch Process ---

  batchProcess(): void {
    const ids = this.parseBatchIds();
    if (ids.length === 0) {
      this.showError('Please enter at least one valid Opportunity ID');
      return;
    }

    this.isBatchProcessing = true;
    this.batchResult = null;

    this.workflowsService.batchProcess(ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.batchResult = result;
          this.isBatchProcessing = false;
          this.showSuccess('Batch processed ' + result.processed + ' opportunities');
        },
        error: (err) => {
          this.isBatchProcessing = false;
          this.showError('Batch process failed: ' + (err.error?.message || err.message));
        }
      });
  }

  parseBatchIds(): number[] {
    if (!this.batchIdsText || !this.batchIdsText.trim()) {
      return [];
    }
    return this.batchIdsText
      .split(/[,\n\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n));
  }

  getBatchIdCount(): number {
    return this.parseBatchIds().length;
  }

  // --- Decision History ---

  loadHistory(): void {
    this.isLoadingHistory = true;
    this.workflowsService.getHistory(this.historyLimit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.history = Array.isArray(data.history) ? data.history : [];
          this.isLoadingHistory = false;
        },
        error: (err) => {
          this.isLoadingHistory = false;
          this.showError('Failed to load decision history: ' + (err.error?.message || err.message));
        }
      });
  }

  refreshHistory(): void {
    this.loadHistory();
  }

  // --- Action badge helpers ---

  getActionClass(action: string): string {
    switch (action?.toLowerCase()) {
      case 'book':
      case 'auto_book':
      case 'approve':
        return 'action-approve';
      case 'reject':
      case 'auto_reject':
      case 'decline':
        return 'action-reject';
      case 'hold':
      case 'review':
      case 'manual_review':
        return 'action-hold';
      case 'alert':
      case 'notify':
        return 'action-alert';
      default:
        return 'action-default';
    }
  }

  // --- Snackbar helpers ---

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      horizontalPosition: this.horizontalPosition,
      verticalPosition: this.verticalPosition,
      duration: this.durationInSeconds * 1000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      horizontalPosition: this.horizontalPosition,
      verticalPosition: this.verticalPosition,
      duration: this.durationInSeconds * 1000,
      panelClass: ['error-snackbar']
    });
  }
}
