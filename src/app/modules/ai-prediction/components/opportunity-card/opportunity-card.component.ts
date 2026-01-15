import { Component, Input } from '@angular/core';
import { AIOpportunity, AIPredictionService } from '../../../../services/ai-prediction.service';

@Component({
  selector: 'app-opportunity-card',
  templateUrl: './opportunity-card.component.html',
  styleUrls: ['./opportunity-card.component.scss']
})
export class OpportunityCardComponent {
  @Input() opportunity!: AIOpportunity;

  constructor(private aiService: AIPredictionService) {}

  get typeClass(): string {
    return this.aiService.getActionClass(this.opportunity.type);
  }

  get priorityClass(): string {
    return this.aiService.getPriorityClass(this.opportunity.priority);
  }

  get riskClass(): string {
    return this.aiService.getRiskClass(this.opportunity.riskLevel);
  }

  get typeIcon(): string {
    switch (this.opportunity.type) {
      case 'BUY': return 'shopping_cart';
      case 'SELL': return 'sell';
      case 'HOLD': return 'pause_circle';
      default: return 'help_outline';
    }
  }

  get typeLabel(): string {
    switch (this.opportunity.type) {
      case 'BUY': return 'קנה';
      case 'SELL': return 'מכור';
      case 'HOLD': return 'המתן';
      default: return this.opportunity.type;
    }
  }

  get priorityLabel(): string {
    switch (this.opportunity.priority) {
      case 'URGENT': return 'דחוף';
      case 'HIGH': return 'גבוה';
      case 'MEDIUM': return 'בינוני';
      case 'LOW': return 'נמוך';
      default: return this.opportunity.priority;
    }
  }

  get riskLabel(): string {
    switch (this.opportunity.riskLevel) {
      case 'LOW': return 'סיכון נמוך';
      case 'MEDIUM': return 'סיכון בינוני';
      case 'HIGH': return 'סיכון גבוה';
      default: return this.opportunity.riskLevel;
    }
  }
}
