import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { Subject, takeUntil } from 'rxjs';
import { environment } from 'src/app/environments/environment';

Chart.register(...registerables);

interface City { cityName: string; count?: number; }
interface Hotel { hotelId: number; hotelName: string; cityName?: string; }

interface RevenueScenario {
  strategy: string;
  price: number;
  expectedRevenue: number;
  expectedProfit: number;
  expectedConversionRate: number;
  confidence: number;
  riskLevel: string;
}

interface RevenueOptimization {
  recommendedPrice: number;
  expectedRevenue: number;
  expectedProfit: number;
  expectedConversionRate: number;
  confidence: number;
  riskLevel: string;
}

@Component({
  selector: 'app-revenue-optimizer',
  templateUrl: './revenue-optimizer.component.html',
  styleUrls: ['./revenue-optimizer.component.scss']
})
export class RevenueOptimizerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scenariosChart') scenariosChartCanvas!: ElementRef<HTMLCanvasElement>;
  private scenariosChart?: Chart;

  hotelId: number | null = null;
  checkIn = '';
  checkOut = '';
  buyPrice: number | null = null;

  // Validation error messages
  checkInError = '';
  checkOutError = '';
  buyPriceError = '';

  cities: City[] = [];
  hotels: Hotel[] = [];
  filteredHotels: Hotel[] = [];
  selectedCity: string | null = null;

  optimization: RevenueOptimization | null = null;
  scenarios: RevenueScenario[] = [];
  selectedStrategy = '';

  loading = false;
  error: string | null = null;

  private destroy$ = new Subject<void>();
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadHotels();

    // Set default dates
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 14);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);

    this.checkIn = checkIn.toISOString().split('T')[0];
    this.checkOut = checkOut.toISOString().split('T')[0];
  }

  loadCities(): void {
    this.http.get<any>(`${this.baseUrl}ai/cities`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.cities = res.cities || []; },
        error: () => { this.cities = []; }
      });
  }

  loadHotels(): void {
    this.http.get<any>(`${this.baseUrl}ai/hotels`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.hotels = res.hotels || [];
          this.filteredHotels = this.hotels;
        },
        error: () => { this.hotels = []; this.filteredHotels = []; }
      });
  }

  onCityChange(city: string | null): void {
    this.selectedCity = city;
    this.filteredHotels = city
      ? this.hotels.filter(h => h.cityName === city)
      : this.hotels;
    this.hotelId = null;
  }

  onHotelChange(hotelId: number): void {
    this.hotelId = hotelId;
  }

  ngAfterViewInit(): void {
    // Chart will be initialized after optimization
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.scenariosChart) {
      this.scenariosChart.destroy();
    }
  }

  maximizeRevenue(): void {
    // Comprehensive validation
    if (!this.hotelId || !this.buyPrice || !this.checkIn || !this.checkOut) {
      this.error = 'Please fill in all required fields';
      return;
    }

    if (!this.isValidDateRange()) {
      this.error = 'Please select valid dates';
      return;
    }

    if (this.buyPrice <= 0 || this.buyPrice > 10000) {
      this.error = 'Please enter a valid buy price (1-10,000 €)';
      return;
    }

    this.loading = true;
    this.error = null;

    const payload = {
      hotelId: this.hotelId,
      checkIn: this.checkIn,
      checkOut: this.checkOut,
      buyPrice: this.buyPrice,
      availableInventory: 5,
      currentDemand: 'MEDIUM'
    };

    this.http.post<any>(`${this.baseUrl}advanced-pricing/v2/revenue/maximize`, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.optimization = response.optimization;
            this.scenarios = response.scenarios || [];
            this.selectedStrategy = response.selectedStrategy || '';
            
            setTimeout(() => this.initChart(), 100);
          } else {
            this.error = response.message || 'Failed to optimize revenue';
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('Revenue optimization error:', err);
          this.error = err.error?.message || 'Failed to connect to optimization service';
          this.loading = false;
        }
      });
  }

  initChart(): void {
    if (!this.scenariosChartCanvas?.nativeElement) {
      console.warn('Chart canvas not available');
      return;
    }
    
    if (this.scenarios.length === 0) {
      console.warn('No scenarios data available for chart');
      return;
    }

    const ctx = this.scenariosChartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      console.error('Failed to get chart context');
      return;
    }

    try {
      if (this.scenariosChart) {
        this.scenariosChart.destroy();
      }

      const labels = this.scenarios.map(s => this.formatStrategyName(s.strategy));
      const revenueData = this.scenarios.map(s => s.expectedRevenue || 0);
      const profitData = this.scenarios.map(s => s.expectedProfit || 0);
      const conversionData = this.scenarios.map(s => (s.expectedConversionRate || 0) * 100);

      this.scenariosChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Expected Revenue (€)',
            data: revenueData,
            backgroundColor: '#3b82f6',
            borderColor: '#2563eb',
            borderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Expected Profit (€)',
            data: profitData,
            backgroundColor: '#10b981',
            borderColor: '#059669',
            borderWidth: 2,
            yAxisID: 'y'
          },
          {
            label: 'Conversion Rate (%)',
            data: conversionData,
            type: 'line',
            backgroundColor: 'rgba(251, 146, 60, 0.1)',
            borderColor: '#f59e0b',
            borderWidth: 3,
            pointRadius: 5,
            pointBackgroundColor: '#f59e0b',
            yAxisID: 'y1',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: { size: 12, weight: 600 as any }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            padding: 12,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: (context: any) => {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  if (context.dataset.label?.includes('%')) {
                    label += context.parsed.y.toFixed(1) + '%';
                  } else {
                    label += '€' + context.parsed.y.toFixed(2);
                  }
                }
                return label;
              }
            }
          }
        },
        scales: {
          y: {
            type: 'linear' as any,
            position: 'left',
            title: {
              display: true,
              text: 'Revenue & Profit (€)',
              font: { weight: 600 as any }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.06)'
            }
          },
          y1: {
            type: 'linear' as any,
            position: 'right',
            title: {
              display: true,
              text: 'Conversion Rate (%)',
              font: { weight: 600 as any }
            },
            grid: {
              drawOnChartArea: false
            },
            min: 0,
            max: 100
          }
        }
      }
    });
      
    } catch (error) {
      console.error('Failed to create chart:', error);
      this.error = 'Failed to display chart visualization';
    }
  }

  formatStrategyName(strategy: string): string {
    return strategy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getScenarioColor(strategy: string): string {
    if (strategy === this.selectedStrategy) return '#10b981';
    return '#94a3b8';
  }

  getRiskColor(risk: string): string {
    switch (risk) {
      case 'LOW': return '#10b981';
      case 'MEDIUM': return '#f59e0b';
      case 'HIGH': return '#ef4444';
      default: return '#94a3b8';
    }
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '€0.00';
    }
    
    // Use Intl.NumberFormat for proper currency formatting
    const formatter = new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    return formatter.format(value);
  }

  formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.0%';
    }
    return (value * 100).toFixed(1) + '%';
  }

  getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  validateDates(): void {
    this.checkInError = '';
    this.checkOutError = '';

    if (this.checkIn) {
      const checkInDate = new Date(this.checkIn);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (checkInDate < today) {
        this.checkInError = 'Check-in date cannot be in the past';
      }
    }

    if (this.checkIn && this.checkOut) {
      const checkInDate = new Date(this.checkIn);
      const checkOutDate = new Date(this.checkOut);
      
      if (checkOutDate <= checkInDate) {
        this.checkOutError = 'Check-out must be after check-in date';
      }
      
      // Maximum stay validation (optional)
      const daysDiff = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24);
      if (daysDiff > 30) {
        this.checkOutError = 'Maximum stay is 30 days';
      }
    }

    this.validateBuyPrice();
  }

  validateBuyPrice(): void {
    this.buyPriceError = '';
    
    if (this.buyPrice !== null) {
      if (this.buyPrice <= 0) {
        this.buyPriceError = 'Buy price must be greater than 0';
      } else if (this.buyPrice > 10000) {
        this.buyPriceError = 'Buy price cannot exceed €10,000';
      }
    }
  }

  isValidDateRange(): boolean {
    if (!this.checkIn || !this.checkOut) return false;
    
    const checkInDate = new Date(this.checkIn);
    const checkOutDate = new Date(this.checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return checkInDate >= today && checkOutDate > checkInDate;
  }

  reset(): void {
    this.hotelId = null;
    this.buyPrice = null;
    this.optimization = null;
    this.scenarios = [];
    this.selectedStrategy = '';
    this.error = null;
    
    // Clear validation errors
    this.checkInError = '';
    this.checkOutError = '';
    this.buyPriceError = '';

    if (this.scenariosChart) {
      this.scenariosChart.destroy();
      this.scenariosChart = undefined;
    }

    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 14);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);

    this.checkIn = checkIn.toISOString().split('T')[0];
    this.checkOut = checkOut.toISOString().split('T')[0];
  }
}
