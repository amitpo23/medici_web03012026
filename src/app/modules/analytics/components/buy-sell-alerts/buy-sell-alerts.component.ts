import { Component, OnInit } from '@angular/core';
import { PredictionService, BuySellAlert } from '../../services/prediction.service';

@Component({
  selector: 'app-buy-sell-alerts',
  templateUrl: './buy-sell-alerts.component.html',
  styleUrls: ['./buy-sell-alerts.component.scss']
})
export class BuySellAlertsComponent implements OnInit {
  alerts: BuySellAlert[] = [];
  loading = true;
  filterType: 'all' | 'buy' | 'sell' | 'warning' = 'all';

  constructor(private predictionService: PredictionService) {}

  ngOnInit(): void {
    this.loadAlerts();
  }

  loadAlerts(): void {
    this.loading = true;
    this.predictionService.getBuySellAlerts().subscribe({
      next: (alerts) => {
        this.alerts = alerts;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading alerts:', err);
        this.loading = false;
      }
    });
  }

  get filteredAlerts(): BuySellAlert[] {
    if (this.filterType === 'all') return this.alerts;
    return this.alerts.filter(a => a.type === this.filterType);
  }

  getAlertCountByType(type: string): number {
    return this.alerts.filter(a => a.type === type).length;
  }

  getAlertIcon(type: string): string {
    switch (type) {
      case 'buy': return '🟢';
      case 'sell': return '🔴';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  }

  getAlertClass(type: string): string {
    return `alert-${type}`;
  }

  getPriorityClass(priority: string): string {
    return `priority-${priority}`;
  }
}
