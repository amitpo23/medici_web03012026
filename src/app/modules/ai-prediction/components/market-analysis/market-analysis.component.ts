import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { AIPredictionService } from '../../../../services/ai-prediction.service';

@Component({
  selector: 'app-market-analysis',
  templateUrl: './market-analysis.component.html',
  styleUrls: ['./market-analysis.component.scss']
})
export class MarketAnalysisComponent implements OnInit, OnChanges {
  @Input() city: string | null = null;
  @Input() hotelId: number | null = null;

  isLoading = false;
  overview: any = null;
  trends: any = null;
  seasonality: any = null;
  error: string | null = null;

  constructor(private aiService: AIPredictionService) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['city'] || changes['hotelId']) {
      this.loadData();
    }
  }

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    const options = {
      city: this.city || undefined,
      hotelId: this.hotelId || undefined
    };

    // Load all three in parallel
    Promise.all([
      this.aiService.getMarketAnalysis('overview', options).toPromise(),
      this.aiService.getMarketAnalysis('trends', options).toPromise(),
      this.aiService.getMarketAnalysis('seasonality', options).toPromise()
    ]).then(([overview, trends, seasonality]) => {
      this.overview = overview?.data || overview;
      this.trends = trends?.data || trends;
      this.seasonality = seasonality?.data || seasonality;
      this.isLoading = false;
    }).catch(err => {
      console.error('Error loading market analysis:', err);
      this.error = 'שגיאה בטעינת ניתוח השוק';
      this.isLoading = false;
    });
  }

  getTrendIcon(trend: string): string {
    switch (trend?.toLowerCase()) {
      case 'rising': return 'trending_up';
      case 'falling': return 'trending_down';
      case 'stable': return 'trending_flat';
      default: return 'remove';
    }
  }

  getTrendClass(trend: string): string {
    switch (trend?.toLowerCase()) {
      case 'rising': return 'text-green-600 dark:text-green-400';
      case 'falling': return 'text-red-600 dark:text-red-400';
      case 'stable': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  }

  getTrendLabel(trend: string): string {
    switch (trend?.toLowerCase()) {
      case 'rising': return 'עולה';
      case 'falling': return 'יורד';
      case 'stable': return 'יציב';
      default: return trend || 'לא ידוע';
    }
  }
}
