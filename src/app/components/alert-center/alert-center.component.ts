import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertManagementService, Alert, AlertStatistics, AlertConfig, AlertSummary } from '../../services/alert-management.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-alert-center',
  templateUrl: './alert-center.component.html',
  styleUrls: ['./alert-center.component.scss']
})
export class AlertCenterComponent implements OnInit, OnDestroy {
  activeAlerts: Alert[] = [];
  alertHistory: Alert[] = [];
  statistics: AlertStatistics | null = null;
  summary: AlertSummary | null = null;
  config: AlertConfig | null = null;
  
  loading = true;
  error: string | null = null;
  
  selectedTab: 'active' | 'history' | 'statistics' | 'config' = 'active';
  
  private subscriptions: Subscription[] = [];
  
  constructor(public alertService: AlertManagementService) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Load all data
   */
  loadAllData(): void {
    this.loading = true;
    this.error = null;

    // Load active alerts
    const activeSub = this.alertService.getActiveAlerts().subscribe({
      next: (alerts) => {
        this.activeAlerts = alerts;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load active alerts', err);
        this.error = 'Failed to load alerts';
        this.loading = false;
      }
    });

    // Load summary
    const summarySub = this.alertService.getSummary().subscribe({
      next: (summary) => this.summary = summary,
      error: (err) => console.error('Failed to load summary', err)
    });

    // Load statistics
    const statsSub = this.alertService.getStatistics().subscribe({
      next: (stats) => this.statistics = stats,
      error: (err) => console.error('Failed to load statistics', err)
    });

    // Load config
    const configSub = this.alertService.getConfig().subscribe({
      next: (config) => this.config = config,
      error: (err) => console.error('Failed to load config', err)
    });

    this.subscriptions.push(activeSub, summarySub, statsSub, configSub);
  }

  /**
   * Load history
   */
  loadHistory(): void {
    const historySub = this.alertService.getAlertHistory(100).subscribe({
      next: (alerts) => this.alertHistory = alerts,
      error: (err) => console.error('Failed to load history', err)
    });
    
    this.subscriptions.push(historySub);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alert: Alert): void {
    const sub = this.alertService.acknowledgeAlert(alert.id).subscribe({
      next: (updatedAlert) => {
        alert.acknowledged = true;
        alert.acknowledgedAt = updatedAlert.acknowledgedAt;
      },
      error: (err) => console.error('Failed to acknowledge alert', err)
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alert: Alert): void {
    const sub = this.alertService.resolveAlert(alert.type).subscribe({
      next: () => {
        this.activeAlerts = this.activeAlerts.filter(a => a.id !== alert.id);
      },
      error: (err) => console.error('Failed to resolve alert', err)
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Create test alert
   */
  createTestAlert(type: string): void {
    const sub = this.alertService.createTestAlert(type).subscribe({
      next: () => {
        this.loadAllData();
      },
      error: (err) => console.error('Failed to create test alert', err)
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Save config
   */
  saveConfig(): void {
    if (!this.config) return;

    const sub = this.alertService.updateConfig(this.config).subscribe({
      next: (newConfig) => {
        this.config = newConfig;
        alert('הגדרות נשמרו בהצלחה!');
      },
      error: (err) => {
        console.error('Failed to save config', err);
        alert('שגיאה בשמירת הגדרות');
      }
    });
    
    this.subscriptions.push(sub);
  }

  /**
   * Refresh data
   */
  refresh(): void {
    this.loadAllData();
    if (this.selectedTab === 'history') {
      this.loadHistory();
    }
  }

  /**
   * Change tab
   */
  changeTab(tab: 'active' | 'history' | 'statistics' | 'config'): void {
    this.selectedTab = tab;
    
    if (tab === 'history' && this.alertHistory.length === 0) {
      this.loadHistory();
    }
  }

  /**
   * Get severity color
   */
  getSeverityColor(severity: string): string {
    return this.alertService.getSeverityColor(severity);
  }

  /**
   * Get severity icon
   */
  getSeverityIcon(severity: string): string {
    return this.alertService.getSeverityIcon(severity);
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category: string): string {
    return this.alertService.getCategoryIcon(category);
  }

  /**
   * Format alert type
   */
  formatAlertType(type: string): string {
    return this.alertService.formatAlertType(type);
  }

  /**
   * Time ago
   */
  timeAgo(timestamp: Date | string): string {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return `לפני ${seconds} שניות`;
    if (seconds < 3600) return `לפני ${Math.floor(seconds / 60)} דקות`;
    if (seconds < 86400) return `לפני ${Math.floor(seconds / 3600)} שעות`;
    return `לפני ${Math.floor(seconds / 86400)} ימים`;
  }

  /**
   * Get category entries as array
   */
  getCategoryEntries(): Array<{ category: string; count: number }> {
    if (!this.statistics?.by_category) return [];
    
    return Object.entries(this.statistics.by_category)
      .map(([category, count]) => ({ category, count: count as number }))
      .sort((a, b) => b.count - a.count);
  }
}
