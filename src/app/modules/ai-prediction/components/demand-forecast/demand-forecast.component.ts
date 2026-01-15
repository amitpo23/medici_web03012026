import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { AIPredictionService } from '../../../../services/ai-prediction.service';

@Component({
  selector: 'app-demand-forecast',
  templateUrl: './demand-forecast.component.html',
  styleUrls: ['./demand-forecast.component.scss']
})
export class DemandForecastComponent implements OnInit, OnChanges {
  @Input() city: string | null = null;
  @Input() hotelId: number | null = null;
  @Input() days: number = 30;

  isLoading = false;
  forecast: any = null;
  error: string | null = null;

  constructor(private aiService: AIPredictionService) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['city'] || changes['hotelId'] || changes['days']) {
      this.loadData();
    }
  }

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    this.aiService.getDemandForecast({
      city: this.city || undefined,
      hotelId: this.hotelId || undefined,
      days: this.days
    }).subscribe({
      next: (result) => {
        this.forecast = result.analysis || result;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading forecast:', err);
        this.error = 'שגיאה בטעינת חיזוי הביקוש';
        this.isLoading = false;
      }
    });
  }

  getDemandClass(level: string): string {
    switch (level?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  }

  getDemandLabel(level: string): string {
    switch (level?.toLowerCase()) {
      case 'high': return 'גבוה';
      case 'medium': return 'בינוני';
      case 'low': return 'נמוך';
      default: return level || 'לא ידוע';
    }
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }
}
