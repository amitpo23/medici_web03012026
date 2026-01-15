import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

interface AgentInfo {
  id: string;
  name: string;
  nameHe: string;
  description: string;
  icon: string;
  color: string;
  status: string;
}

@Component({
  selector: 'app-agent-status',
  templateUrl: './agent-status.component.html',
  styleUrls: ['./agent-status.component.scss']
})
export class AgentStatusComponent implements OnChanges {
  @Input() status: any;

  agents: AgentInfo[] = [
    {
      id: 'marketAnalysis',
      name: 'Market Analysis',
      nameHe: 'ניתוח שוק',
      description: 'מנתח מגמות מחירים היסטוריות ודפוסי שוק לזיהוי הזדמנויות',
      icon: 'analytics',
      color: 'blue',
      status: 'idle'
    },
    {
      id: 'demandPrediction',
      name: 'Demand Prediction',
      nameHe: 'חיזוי ביקוש',
      description: 'חוזה דפוסי ביקוש עתידיים על סמך נתונים היסטוריים ועונתיות',
      icon: 'trending_up',
      color: 'green',
      status: 'idle'
    },
    {
      id: 'competitionMonitor',
      name: 'Competition Monitor',
      nameHe: 'ניטור תחרות',
      description: 'עוקב אחר מחירי מתחרים ומזהה פערי מחירים',
      icon: 'visibility',
      color: 'orange',
      status: 'idle'
    },
    {
      id: 'opportunityDetector',
      name: 'Opportunity Detector',
      nameHe: 'גלאי הזדמנויות',
      description: 'מזהה הזדמנויות קנייה ומכירה אופטימליות',
      icon: 'lightbulb',
      color: 'purple',
      status: 'idle'
    },
    {
      id: 'decisionMaker',
      name: 'Decision Maker',
      nameHe: 'מקבל החלטות',
      description: 'מסנתז את כל ניתוחי הסוכנים להמלצות סופיות',
      icon: 'psychology',
      color: 'red',
      status: 'idle'
    }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['status'] && this.status?.agents) {
      this.updateAgentStatus();
    }
  }

  private updateAgentStatus(): void {
    for (const agent of this.agents) {
      const statusInfo = this.status.agents.find((a: any) => a.agentId === agent.id);
      if (statusInfo) {
        agent.status = statusInfo.status;
      }
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'analyzing': return 'text-blue-500 animate-pulse';
      case 'complete': return 'text-green-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-400';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'analyzing': return 'sync';
      case 'complete': return 'check_circle';
      case 'error': return 'error';
      default: return 'radio_button_unchecked';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'analyzing': return 'מנתח...';
      case 'complete': return 'הושלם';
      case 'error': return 'שגיאה';
      default: return 'ממתין';
    }
  }

  getColorClass(color: string): string {
    return `bg-${color}-100 text-${color}-600 dark:bg-${color}-900/30 dark:text-${color}-400`;
  }
}
