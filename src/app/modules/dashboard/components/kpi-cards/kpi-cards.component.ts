import { Component, Input, OnInit, OnChanges } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';

interface KPICard {
  title: string;
  value: number | string;
  label: string;
  icon: string;
  color: string;
  gradient: string;
  change?: number;
  changeType?: 'increase' | 'decrease';
}

@Component({
  selector: 'app-kpi-cards',
  templateUrl: './kpi-cards.component.html',
  styleUrls: ['./kpi-cards.component.scss'],
  animations: [
    trigger('cardAnimation', [
      state('void', style({
        opacity: 0,
        transform: 'translateY(20px)'
      })),
      state('*', style({
        opacity: 1,
        transform: 'translateY(0)'
      })),
      transition('void => *', animate('500ms ease-out')),
    ])
  ]
})
export class KpiCardsComponent implements OnInit, OnChanges {
  @Input() kpiData: any = {};
  
  kpiCards: KPICard[] = [];
  animateValue = true;

  ngOnInit(): void {
    this.updateKPICards();
  }

  ngOnChanges(): void {
    this.updateKPICards();
    this.animateValue = false;
    setTimeout(() => this.animateValue = true, 100);
  }

  updateKPICards(): void {
    this.kpiCards = [
      {
        title: 'סה"כ הכנסות',
        value: this.formatCurrency(this.kpiData.totalRevenue || 0),
        label: 'Total Revenue',
        icon: '💰',
        color: '#4caf50',
        gradient: 'linear-gradient(135deg, #4caf50, #66bb6a)',
        change: 12.5,
        changeType: 'increase'
      },
      {
        title: 'רווח נקי',
        value: this.formatCurrency(this.kpiData.totalProfit || 0),
        label: `${(this.kpiData.profitMargin || 0).toFixed(1)}% Margin`,
        icon: '📈',
        color: '#2196f3',
        gradient: 'linear-gradient(135deg, #2196f3, #42a5f5)',
        change: 8.3,
        changeType: 'increase'
      },
      {
        title: 'הזמנות פעילות',
        value: this.kpiData.activeBookings || 0,
        label: 'Active Bookings',
        icon: '📅',
        color: '#ff9800',
        gradient: 'linear-gradient(135deg, #ff9800, #ffa726)',
        change: 5.2,
        changeType: 'increase'
      },
      {
        title: 'תפוסה ממוצעת',
        value: `${this.kpiData.averageOccupancy || 0}%`,
        label: 'Average Occupancy',
        icon: '🏨',
        color: '#9c27b0',
        gradient: 'linear-gradient(135deg, #9c27b0, #ab47bc)',
        change: 3.1,
        changeType: 'decrease'
      },
      {
        title: 'הכנסות היום',
        value: this.formatCurrency(this.kpiData.todayRevenue || 0),
        label: "Today's Revenue",
        icon: '⚡',
        color: '#f44336',
        gradient: 'linear-gradient(135deg, #f44336, #ef5350)',
        change: 15.7,
        changeType: 'increase'
      }
    ];
  }

  formatCurrency(value: number): string {
    return `₪${value.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
  }
}

