import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { AIAnalysisResult, AIOpportunity, AIPredictionService, City, Hotel } from '../../services/ai-prediction.service';

@Component({
  selector: 'app-ai-prediction',
  templateUrl: './ai-prediction.component.html',
  styleUrls: ['./ai-prediction.component.scss']
})
export class AIPredictionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Data
  cities: City[] = [];
  filteredCities: City[] = [];
  hotels: Hotel[] = [];
  filteredHotels: Hotel[] = [];
  displayedHotels: Hotel[] = [];
  opportunities: AIOpportunity[] = [];
  analysisResult: AIAnalysisResult | null = null;

  // UI State
  isLoading = false;
  isLoadingOpportunities = false;
  isPushingToZenith = false;
  isSearchingCity = false;
  isBuying = false;
  buyingOppId: number | null = null;
  activeTab = 0;
  agentStatus: any = null;
  lastRefreshTime: Date | null = null;

  // Search stats
  searchStats = { total: 0, fromDb: 0, fromSearch: 0 };

  // Selection State for Zenith Push
  selectedOpportunities: Set<number> = new Set();
  selectAllOpportunities = false;

  get selectedOpportunitiesCount(): number {
    return this.selectedOpportunities.size;
  }

  // Autocomplete search controls
  citySearchCtrl = new FormControl<string>('');
  hotelSearchCtrl = new FormControl<string>('');

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

  constructor(private aiService: AIPredictionService, private snackBar: MatSnackBar) {}

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
          this.filteredCities = this.cities;
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
          this.displayedHotels = this.hotels;
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
    // City autocomplete filter
    this.citySearchCtrl.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(val => {
      const term = (val || '').toLowerCase();
      this.filteredCities = term
        ? this.cities.filter(c => c.cityName.toLowerCase().includes(term))
        : this.cities;
    });

    // Hotel autocomplete filter
    this.hotelSearchCtrl.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(val => {
      const term = (val || '').toLowerCase();
      this.displayedHotels = term
        ? this.filteredHotels.filter(h => h.hotelName.toLowerCase().includes(term))
        : this.filteredHotels;
    });

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
      this.displayedHotels = this.filteredHotels;
      this.hotelSearchCtrl.setValue('');
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

  onCitySelected(cityName: string): void {
    this.filtersForm.patchValue({ city: cityName || null });
  }

  onHotelSelectedAutocomplete(hotelId: number): void {
    this.filtersForm.patchValue({ hotelId });
  }

  clearCityFilter(): void {
    this.citySearchCtrl.setValue('');
    this.filtersForm.patchValue({ city: null });
  }

  clearHotelFilter(): void {
    this.hotelSearchCtrl.setValue('');
    this.filtersForm.patchValue({ hotelId: null });
    this.displayedHotels = this.filteredHotels;
  }

  displayCityFn(cityName: string): string {
    return cityName || '';
  }

  displayHotelFn = (hotelId: number): string => {
    if (!hotelId) return '';
    const hotel = this.hotels.find(h => h.hotelId === hotelId);
    return hotel?.hotelName || '';
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

  /**
   * Manual refresh - reload opportunities and update refresh time
   */
  manualRefresh(): void {
    this.lastRefreshTime = new Date();
    this.loadOpportunities();
  }

  /**
   * Format remaining time until next auto-refresh
   */
  formatTimeRemaining(): string {
    if (!this.lastRefreshTime) return '';
    const elapsed = Date.now() - this.lastRefreshTime.getTime();
    const remaining = Math.max(0, 5 * 60 * 1000 - elapsed); // 5 min refresh cycle
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Search opportunities by city using forward search (DB + live supplier search)
   */
  searchByCity(): void {
    const city = this.filtersForm.controls.city.value;
    if (!city) return;

    this.isSearchingCity = true;
    this.aiService.searchCityWithForwardSearch(city, {
      minProfit: this.filtersForm.controls.minProfit.value || undefined
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.opportunities = response.opportunities || [];
          this.searchStats = {
            total: response.total || 0,
            fromDb: response.fromDb || 0,
            fromSearch: response.fromSearch || 0
          };
          this.calculateStats();
        }
        this.isSearchingCity = false;
      },
      error: () => {
        this.isSearchingCity = false;
      }
    });
  }

  /**
   * Format a date value to 'YYYY-MM-DD' string for the API
   */
  private formatDateStr(dateVal: string | Date | null | undefined): string | null {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
      return dateVal.split('T')[0];
    }
    if (dateVal instanceof Date) {
      return dateVal.toISOString().split('T')[0];
    }
    return String(dateVal).split('T')[0];
  }

  /**
   * Insert opportunity to database
   */
  insertOpportunity(opp: any): void {
    if (!opp.hotelId) return;

    const checkIn = this.formatDateStr(opp.checkIn);
    const checkOut = this.formatDateStr(opp.checkOut);
    if (!checkIn || !checkOut) {
      this.snackBar.open('חסרים תאריכים להזדמנות זו', 'סגור', { duration: 3000, direction: 'rtl' });
      return;
    }

    this.aiService.insertOpportunity({
      hotelId: opp.hotelId,
      checkIn,
      checkOut,
      buyPrice: opp.buyPrice || opp.currentPrice || 0,
      sellPrice: opp.estimatedSellPrice || opp.targetPrice || 0,
      profit: opp.expectedProfit || 0,
      margin: opp.profitMargin || 0,
      confidence: opp.confidence || 0,
      source: 'AI-Prediction'
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('ההזדמנות נוספה בהצלחה', 'סגור', { duration: 3000, direction: 'rtl' });
          this.loadOpportunities();
        } else {
          this.snackBar.open(response.error || 'שגיאה בהוספת ההזדמנות', 'סגור', { duration: 3000, direction: 'rtl' });
        }
      },
      error: (err) => {
        this.snackBar.open('שגיאה בהוספת ההזדמנות: ' + (err.error?.message || err.message || 'Unknown'), 'סגור', { duration: 4000, direction: 'rtl' });
      }
    });
  }

  /**
   * Buy opportunity - insert to DB and push to Zenith
   */
  buyOpportunity(opp: any): void {
    if (!opp.hotelId) {
      this.snackBar.open('חסר מזהה מלון', 'סגור', { duration: 3000, direction: 'rtl' });
      return;
    }

    const startDateStr = this.formatDateStr(opp.checkIn);
    const endDateStr = this.formatDateStr(opp.checkOut);
    if (!startDateStr || !endDateStr) {
      this.snackBar.open('חסרים תאריכי צ\'ק-אין / צ\'ק-אאוט', 'סגור', { duration: 3000, direction: 'rtl' });
      return;
    }

    this.isBuying = true;
    this.buyingOppId = opp.hotelId;

    this.aiService.buyOpportunity({
      hotelId: opp.hotelId,
      startDateStr,
      endDateStr,
      boardlId: 1,
      categorylId: 1,
      buyPrice: opp.buyPrice || opp.currentPrice || 0,
      pushPrice: opp.estimatedSellPrice || opp.targetPrice || 0
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.isBuying = false;
        this.buyingOppId = null;
        if (response.success) {
          this.snackBar.open('הקנייה בוצעה בהצלחה!', 'סגור', { duration: 3000, direction: 'rtl' });
          this.loadOpportunities();
        } else {
          this.snackBar.open(response.error || 'שגיאה בקנייה', 'סגור', { duration: 3000, direction: 'rtl' });
        }
      },
      error: (err) => {
        this.isBuying = false;
        this.buyingOppId = null;
        this.snackBar.open('שגיאה בקנייה: ' + (err.error?.message || err.message || 'Unknown'), 'סגור', { duration: 4000, direction: 'rtl' });
      }
    });
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

    // TODO: Open Material Dialog for push confirmation and options
    // For now, directly call push
    this.pushToZenith('publish', {});
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
            console.log('✅ Push successful:', response.summary);
            alert(`הצלחה! ${response.summary?.successful || 0} הזדמנויות נדחפו ל-Zenith`);
            this.clearSelection();
            this.loadOpportunities(); // Reload to update status
          } else {
            console.error('❌ Push failed:', response);
            alert(`שגיאה: ${response.error}`);
          }
        },
        error: (err) => {
          this.isPushingToZenith = false;
          console.error('Error pushing to Zenith:', err);
          alert(`שגיאה בדחיפה ל-Zenith: ${err.message}`);
        }
      });
  }
}
