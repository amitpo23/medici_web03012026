import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AIAnalysisResult, AIOpportunity, AIPredictionService, City, Hotel } from '../../services/ai-prediction.service';
import { ZenithPushDialogComponent, ZenithPushDialogResult } from './components/zenith-push-dialog/zenith-push-dialog.component';

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
  isPushingToZenith = false;
  activeTab = 0;
  agentStatus: any = null;
  autoRefreshTimer: any = null;
  lastRefreshTime: Date | null = null;
  nextRefreshIn: number = 3600; // seconds

  // Selection State for Zenith Push
  selectedOpportunities: Set<number> = new Set();
  selectAllOpportunities = false;

  get selectedOpportunitiesCount(): number {
    return this.selectedOpportunities.size;
  }

  // Filters Form
  filtersForm = new FormGroup({
    city: new FormControl<string | null>(null),
    hotelId: new FormControl<number | null>(null),
    userInstructions: new FormControl<string>(''),
    riskTolerance: new FormControl<string>('medium'),
    futureDays: new FormControl<number>(30),
    // New profit-based filters
    minProfit: new FormControl<number | null>(null),
    minMarginPercent: new FormControl<number | null>(null),
    minROI: new FormControl<number | null>(null),
    daysToCheckIn: new FormControl<number | null>(null),
    season: new FormControl<string | null>(null),
    weekendOnly: new FormControl<boolean>(false),
    freeCancellationOnly: new FormControl<boolean>(false)
  });

  // Analysis stats
  analysisStats = {
    totalOpportunities: 0,
    buyOpportunities: 0,
    sellOpportunities: 0,
    urgentCount: 0,
    avgConfidence: 0
  };

  constructor(
    private aiService: AIPredictionService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
    this.setupFormListeners();
    this.startAutoRefresh(); // Start auto-refresh every hour
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }
  }

  private loadInitialData(): void {
    // Load cities
    this.aiService.getCities().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.cities = response.cities;
        }
      },
      error: () => {}
    });

    // Load hotels
    this.aiService.getHotels().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.hotels = response.hotels;
          this.filteredHotels = this.hotels;
        }
      },
      error: () => {}
    });

    // Get AI status
    this.aiService.getStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: (status) => {
        this.agentStatus = status;
      },
      error: () => {}
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

    // Build filters object from form
    const filters: any = {};
    if (formValue.minProfit) filters.minProfit = formValue.minProfit;
    if (formValue.minMarginPercent) filters.minMarginPercent = formValue.minMarginPercent;
    if (formValue.minROI) filters.minROI = formValue.minROI;
    if (formValue.daysToCheckIn) filters.daysToCheckIn = formValue.daysToCheckIn;
    if (formValue.season) filters.season = formValue.season;
    if (formValue.weekendOnly) filters.weekendOnly = formValue.weekendOnly;
    if (formValue.freeCancellationOnly) filters.freeCancellationOnly = formValue.freeCancellationOnly;

    this.aiService.getOpportunitiesFiltered({
      city: formValue.city || undefined,
      hotelId: formValue.hotelId || undefined,
      userInstructions: formValue.userInstructions || undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      limit: 100
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.opportunities = response.opportunities || [];
          this.calculateStats();
        }
        this.isLoadingOpportunities = false;
      },
      error: () => {
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
      error: () => {
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
        this.loadOpportunities();
      },
      error: () => {}
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
    'רווח מעל 100 דולר',
    'מרווח מעל 15%',
    'חפש הזדמנויות בעונה הנמוכה',
    'התמקד במלונות 4 ו-5 כוכבים',
    'חפש מלונות עם ירידת מחירים של יותר מ-20%',
    'סופ"ש בלבד עם ביטול חינם'
  ];

  applyExample(instruction: string): void {
    this.filtersForm.patchValue({ userInstructions: instruction });
  }

  /**
   * Select/Deselect all opportunities
   */
  onSelectAll(checked: boolean): void {
    if (checked) {
      this.opportunities.forEach(opp => {
        if (opp.hotelId) {
          this.selectedOpportunities.add(opp.hotelId);
        }
      });
    } else {
      this.selectedOpportunities.clear();
    }
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedOpportunities.clear();
    this.selectAllOpportunities = false;
  }

  /**
   * Open Zenith Push Dialog
   */
  openZenithPushDialog(): void {
    if (this.selectedOpportunities.size === 0) {
      return;
    }

    const dialogRef = this.dialog.open(ZenithPushDialogComponent, {
      width: '420px',
      data: {
        count: this.selectedOpportunities.size,
        action: 'publish'
      }
    });

    dialogRef.afterClosed().pipe(takeUntil(this.destroy$)).subscribe((result: ZenithPushDialogResult | undefined) => {
      if (result?.confirmed) {
        this.pushToZenith(result.action, {});
      }
    });
  }

  /**
   * Push selected opportunities to Zenith
   */
  pushToZenith(action: 'publish' | 'update' | 'close', overrides: any): void {
    this.isPushingToZenith = true;
    const opportunityIds = Array.from(this.selectedOpportunities);

    this.aiService.pushToZenith(opportunityIds, action, overrides)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isPushingToZenith = false;
          if (response.success) {
            alert(`הצלחה! ${response.summary?.successful || 0} הזדמנויות נדחפו ל-Zenith`);
            this.clearSelection();
            this.loadOpportunities();
          } else {
            alert(`שגיאה: ${response.error}`);
          }
        },
        error: (err) => {
          this.isPushingToZenith = false;
          alert(`שגיאה בדחיפה ל-Zenith: ${err.message}`);
        }
      });
  }

  /**
   * Calculate potential profit for an opportunity
   */
  calculateProfit(opportunity: AIOpportunity): number {
    const buyPrice = opportunity.buyPrice || 0;
    const sellPrice = opportunity.estimatedSellPrice || 0;
    return sellPrice - buyPrice;
  }

  /**
   * Calculate profit margin percentage
   */
  calculateMargin(opportunity: AIOpportunity): number {
    const buyPrice = opportunity.buyPrice || 0;
    const sellPrice = opportunity.estimatedSellPrice || 0;
    if (sellPrice === 0) return 0;
    return ((sellPrice - buyPrice) / sellPrice) * 100;
  }

  /**
   * Calculate ROI percentage
   */
  calculateROI(opportunity: AIOpportunity): number {
    const buyPrice = opportunity.buyPrice || 0;
    const profit = this.calculateProfit(opportunity);
    if (buyPrice === 0) return 0;
    return (profit / buyPrice) * 100;
  }

  /**
   * Insert opportunity to database
   */
  insertOpportunity(opportunity: AIOpportunity): void {
    if (!opportunity.hotelId) return;

    this.aiService.insertOpportunity({
      hotelId: opportunity.hotelId,
      checkIn: opportunity.checkIn || '',
      checkOut: opportunity.checkOut || '',
      buyPrice: opportunity.buyPrice || 0,
      sellPrice: opportunity.estimatedSellPrice || 0,
      profit: this.calculateProfit(opportunity),
      margin: this.calculateMargin(opportunity),
      confidence: opportunity.confidence || 0,
      source: 'AI_PREDICTION'
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          alert('ההזדמנות נוספה בהצלחה!');
          this.loadOpportunities();
        } else {
          alert(`שגיאה: ${response.error}`);
        }
      },
      error: (err) => {
        alert(`שגיאה בהוספת הזדמנות: ${err.message}`);
      }
    });
  }

  /**
   * Start auto-refresh timer (every hour)
   */
  private startAutoRefresh(): void {
    this.lastRefreshTime = new Date();
    
    // Update countdown every second
    setInterval(() => {
      if (this.lastRefreshTime) {
        const elapsed = Math.floor((Date.now() - this.lastRefreshTime.getTime()) / 1000);
        this.nextRefreshIn = Math.max(0, 3600 - elapsed);
      }
    }, 1000);

    // Refresh every hour
    this.autoRefreshTimer = setInterval(() => {
      console.log('Auto-refreshing opportunities...');
      this.loadOpportunities();
      this.lastRefreshTime = new Date();
    }, 3600000); // 60 minutes
  }

  /**
   * Format seconds to MM:SS
   */
  formatTimeRemaining(): string {
    const minutes = Math.floor(this.nextRefreshIn / 60);
    const seconds = this.nextRefreshIn % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Manual refresh with timer reset
   */
  manualRefresh(): void {
    this.loadOpportunities();
    this.lastRefreshTime = new Date();
  }
}
