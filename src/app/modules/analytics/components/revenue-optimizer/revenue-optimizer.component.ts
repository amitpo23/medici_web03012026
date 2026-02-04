import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { Subject, takeUntil } from 'rxjs';
import { environment } from 'src/app/environments/environment';

Chart.register(...registerables);

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

  optimization: RevenueOptimization | null = null;
  scenarios: RevenueScenario[] = [];
  selectedStrategy = '';

  loading = false;
  error: string | null = null;

  private destroy$ = new Subject<void>();
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Set default dates
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 14);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);

    this.checkIn = checkIn.toISOString().split('T')[0];
    this.checkOut = checkOut.toISOString().split('T')[0];
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
    if (!this.hotelId || !this.buyPrice) return;

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

    this.http.post<any>(`${this.baseUrl}/pricing/v2/revenue/maximize`, payload)
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
    if (!this.scenariosChartCanvas?.nativeElement || this.scenarios.length === 0) return;

    const ctx = this.scenariosChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.scenariosChart) {
      this.scenariosChart.destroy();
    }

    const labels = this.scenarios.map(s => this.formatStrategyName(s.strategy));
    const revenueData = this.scenarios.map(s => s.expectedRevenue);
    const profitData = this.scenarios.map(s => s.expectedProfit);
    const conversionData = this.scenarios.map(s => s.expectedConversionRate * 100);

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

  formatCurrency(value: number): string {
    return '€' + value.toFixed(2);
  }

  formatPercent(value: number): string {
    return (value * 100).toFixed(1) + '%';
  }

  reset(): void {
    this.hotelId = null;
    this.buyPrice = null;
    this.optimization = null;
    this.scenarios = [];
    this.selectedStrategy = '';
    this.error = null;

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
