import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertManagementService } from '../../../services/alert-management.service';
import { MonitoringService } from '../../../services/monitoring.service';

interface SystemCard {
  title: string;
  icon: string;
  description: string;
  route: string;
  color: string;
  stats?: string;
  status?: 'healthy' | 'warning' | 'critical';
}

@Component({
  selector: 'app-system-monitoring-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class SystemMonitoringOverviewComponent implements OnInit {
  cards: SystemCard[] = [
    {
      title: 'מוניטורינג בזמן אמת',
      icon: '📊',
      description: 'צפייה בביצועי המערכת, הזמנות, הכנסות ושגיאות בזמן אמת',
      route: '/system/monitoring',
      color: '#1976d2',
      stats: 'רענון כל 10 שניות'
    },
    {
      title: 'מרכז התראות',
      icon: '⚠️',
      description: 'ניהול התראות חכמות על שגיאות, ביצועים ובעיות במערכת',
      route: '/system/alerts',
      color: '#ff9800',
      stats: 'ניטור אוטומטי 24/7'
    },
    {
      title: 'אנליטיקת הכנסות',
      icon: '💰',
      description: 'ניתוח רווחיות, תחזיות והשוואת ביצועים לפי תקופות',
      route: '/system/revenue',
      color: '#4caf50',
      stats: 'תחזית עד 30 יום'
    },
    {
      title: 'צפייה בלוגים',
      icon: '📋',
      description: 'חיפוש וניתוח לוגים מפורטים של כל פעולות המערכת',
      route: '/system/logs',
      color: '#9c27b0',
      stats: 'חיפוש מתקדם'
    },
    {
      title: 'ניהול ביטולים',
      icon: '❌',
      description: 'מעקב אחר ביטולים מוצלחים, כישלונות וסטטיסטיקות',
      route: '/system/cancellations',
      color: '#f44336',
      stats: 'ניתוח מגמות'
    }
  ];

  systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
  activeAlerts = 0;
  loading = true;

  constructor(
    private router: Router,
    private monitoringService: MonitoringService,
    private alertService: AlertManagementService
  ) {}

  ngOnInit(): void {
    this.loadSystemStatus();
  }

  loadSystemStatus(): void {
    // Load health status
    this.monitoringService.getHealth().subscribe({
      next: (health) => {
        this.systemHealth = health.status;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });

    // Load active alerts count
    this.alertService.getActiveAlerts().subscribe({
      next: (alerts) => {
        this.activeAlerts = alerts.length;
        this.cards[1].stats = `${alerts.length} התראות פעילות`;
      },
      error: () => {}
    });
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  getHealthIcon(): string {
    switch (this.systemHealth) {
      case 'healthy': return '✅';
      case 'warning': return '⚠️';
      case 'critical': return '🔴';
      default: return '•';
    }
  }

  getHealthText(): string {
    switch (this.systemHealth) {
      case 'healthy': return 'כל המערכות תקינות';
      case 'warning': return 'נמצאו בעיות קלות';
      case 'critical': return 'נדרשת תשומת לב מיידית';
      default: return 'בודק...';
    }
  }

  getHealthClass(): string {
    return this.systemHealth;
  }
}
