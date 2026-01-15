import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AIPredictionService, AIOpportunity, City, Hotel, AIAnalysisResult } from '../../services/ai-prediction.service';

@Component({
  selector: 'app-ai-prediction',
  templateUrl: './ai-prediction.component.html',
  styleUrls: ['./ai-prediction.component.scss']
})
export class AIPredictionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  cities: City[] = [];
  hotels: Hotel[] = [];
  filteredHotels: Hotel[] = [];
  opportunities: AIOpportunity[] = [];
  analysisResult: AIAnalysisResult | null = null;

  // UI State
  isLoading = false;
  isLoadingOpportunities = false;
  activeTab = 0;
  agentStatus: any = null;

  // Filters Form
  filtersForm = new FormGroup({
    city: new FormControl<string | null>(null),
    hotelId: new FormControl<number | null>(null),
    userInstructions: new FormControl<string>(''),
    riskTolerance: new FormControl<string>('medium'),
    futureDays: new FormControl<number>(30)
  });

  // Analysis stats
  analysisStats = {
    totalOpportunities: 0,
    buyOpportunities: 0,
    sellOpportunities: 0,
    urgentCount: 0,
    avgConfidence: 0
  };

  constructor(private aiService: AIPredictionService) {}

  ngOnInit(): void {
    this.loadInitialData();
    this.setupFormListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadInitialData(): void {
    // Load cities
    this.aiService.getCities().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.cities = response.cities;
        }
      },
      error: (err) => console.error('Error loading cities:', err)
    });

    // Load hotels
    this.aiService.getHotels().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.hotels = response.hotels;
          this.filteredHotels = this.hotels;
        }
      },
      error: (err) => console.error('Error loading hotels:', err)
    });

    // Get AI status
    this.aiService.getStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: (status) => {
        this.agentStatus = status;
      },
      error: (err) => console.error('Error getting AI status:', err)
    });

    // Load initial opportunities
    this.loadOpportunities();
  }

  private setupFormListeners(): void {
    // When city changes, filter hotels
    this.filtersForm.get('city')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged()
    ).subscribe(city => {
      if (city) {
        this.filteredHotels = this.hotels.filter(h => h.cityName === city);
      } else {
        this.filteredHotels = this.hotels;
      }
      // Reset hotel selection when city changes
      this.filtersForm.patchValue({ hotelId: null });
    });

    // Auto-refresh opportunities on instruction changes
    this.filtersForm.get('userInstructions')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(1000),
      distinctUntilChanged()
    ).subscribe(() => {
      if (this.activeTab === 0) {
        this.loadOpportunities();
      }
    });
  }

  loadOpportunities(): void {
    this.isLoadingOpportunities = true;
    const formValue = this.filtersForm.value;

    this.aiService.getOpportunities({
      city: formValue.city || undefined,
      hotelId: formValue.hotelId || undefined,
      userInstructions: formValue.userInstructions || undefined,
      limit: 50
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.opportunities = response.opportunities || [];
          this.calculateStats();
        }
        this.isLoadingOpportunities = false;
      },
      error: (err) => {
        console.error('Error loading opportunities:', err);
        this.isLoadingOpportunities = false;
      }
    });
  }

  runFullAnalysis(): void {
    this.isLoading = true;
    const formValue = this.filtersForm.value;

    this.aiService.runAnalysis({
      city: formValue.city || undefined,
      hotelId: formValue.hotelId || undefined,
      userInstructions: formValue.userInstructions || undefined,
      riskTolerance: formValue.riskTolerance || 'medium',
      futureDays: formValue.futureDays || 30
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.analysisResult = result;
        if (result.synthesis?.actionPlan) {
          this.opportunities = result.synthesis.actionPlan.map((action: any, index: number) => ({
            type: action.action?.includes('קנה') || action.action?.toLowerCase().includes('buy') ? 'BUY' :
                  action.action?.includes('מכור') || action.action?.toLowerCase().includes('sell') ? 'SELL' : 'HOLD',
            priority: action.priority as any || 'MEDIUM',
            action: action.action,
            reason: action.reason,
            confidence: result.synthesis.confidence || 70,
            riskLevel: result.synthesis.riskLevel as any || 'MEDIUM'
          }));
          this.calculateStats();
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error running analysis:', err);
        this.isLoading = false;
      }
    });
  }

  private calculateStats(): void {
    this.analysisStats = {
      totalOpportunities: this.opportunities.length,
      buyOpportunities: this.opportunities.filter(o => o.type === 'BUY').length,
      sellOpportunities: this.opportunities.filter(o => o.type === 'SELL').length,
      urgentCount: this.opportunities.filter(o => o.priority === 'URGENT').length,
      avgConfidence: this.opportunities.length > 0 
        ? Math.round(this.opportunities.reduce((sum, o) => sum + (o.confidence || 0), 0) / this.opportunities.length)
        : 0
    };
  }

  onTabChange(index: number): void {
    this.activeTab = index;
  }

  clearFilters(): void {
    this.filtersForm.reset({
      city: null,
      hotelId: null,
      userInstructions: '',
      riskTolerance: 'medium',
      futureDays: 30
    });
    this.filteredHotels = this.hotels;
    this.loadOpportunities();
  }

  clearCache(): void {
    this.aiService.clearCache().pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        console.log('Cache cleared');
        this.loadOpportunities();
      },
      error: (err) => console.error('Error clearing cache:', err)
    });
  }

  getPriorityClass(priority: string): string {
    return this.aiService.getPriorityClass(priority);
  }

  getActionClass(type: string): string {
    return this.aiService.getActionClass(type);
  }

  getRiskClass(risk: string): string {
    return this.aiService.getRiskClass(risk);
  }

  // Example instructions for users (in Hebrew)
  exampleInstructions = [
    'חפש הזדמנויות לקנות בעונה הנמוכה',
    'התמקד במלונות 4 ו-5 כוכבים',
    'חפש הזדמנויות ארביטראז׳',
    'התמקד בסופי שבוע',
    'חפש מלונות עם ירידת מחירים של יותר מ-20%'
  ];

  applyExample(instruction: string): void {
    this.filtersForm.patchValue({ userInstructions: instruction });
  }
}
