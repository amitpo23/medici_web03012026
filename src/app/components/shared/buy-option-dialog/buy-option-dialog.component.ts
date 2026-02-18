import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment.prod';

interface RiskLevel {
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  color: string;
  label: string;
  description: string;
}

interface BuyOptionData {
  hotelId: number;
  hotelName: string;
  city: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
  price: number;
  targetPrice?: number;
  daysBeforeArrival: number;
}

interface PredictionResult {
  successProbability: number;
  hotelSuccessRate: number;
  citySuccessRate: number;
  riskLevel: string;
  riskScore: number;
  riskColor: string;
  recommendation: string;
  confidence: number;
}

@Component({
  selector: 'app-buy-option-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="buy-option-dialog">
      <!-- Header -->
      <div class="dialog-header">
        <div class="medici-logo-small">
          <span>MEDICI</span>
          <div class="stars">★★★★</div>
        </div>
        <h2>Buy option</h2>
        <button mat-icon-button class="close-btn" (click)="onCancel()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Content -->
      <div class="dialog-content">
        <!-- Hotel Info -->
        <div class="hotel-info">
          <h3>{{ data.hotelName }}</h3>
          <p class="location">{{ data.city }}</p>
          <div class="dates">
            <span>{{ data.checkIn | date:'dd/MM/yyyy' }}</span>
            <mat-icon>arrow_forward</mat-icon>
            <span>{{ data.checkOut | date:'dd/MM/yyyy' }}</span>
          </div>
          <div class="room-type">{{ data.roomType }}</div>
        </div>

        <!-- Price Section -->
        <div class="price-section">
          <div class="price-row">
            <span class="label">Buy Price:</span>
            <span class="value">{{ data.price }}$</span>
          </div>
          <div class="price-row" *ngIf="targetPrice">
            <span class="label">Target Sell:</span>
            <span class="value target">{{ targetPrice }}$</span>
          </div>
          <div class="price-row" *ngIf="expectedProfit">
            <span class="label">Expected Profit:</span>
            <span class="value profit">+{{ expectedProfit }}$</span>
          </div>
          <div class="price-row" *ngIf="expectedMargin">
            <span class="label">Margin:</span>
            <span class="value margin">{{ expectedMargin }}%</span>
          </div>
        </div>

        <!-- Risk Slider -->
        <div class="risk-section">
          <h4>Risk Level</h4>
          <div class="risk-slider-container">
            <div class="risk-labels">
              <span class="low">Low</span>
              <span class="medium">Medium</span>
              <span class="high">High</span>
            </div>
            <mat-slider
              [min]="0"
              [max]="100"
              [step]="1"
              discrete
              showTickMarks
              class="risk-slider"
              [class.low]="riskValue < 35"
              [class.medium]="riskValue >= 35 && riskValue < 65"
              [class.high]="riskValue >= 65"
            >
              <input matSliderThumb [(ngModel)]="riskValue" (valueChange)="onRiskChange($event)">
            </mat-slider>
            <div class="risk-indicator" [style.left.%]="riskValue">
              <div class="indicator-dot" [style.background]="getRiskColor()"></div>
            </div>
          </div>
          <div class="risk-description" [style.color]="getRiskColor()">
            {{ getRiskDescription() }}
          </div>
        </div>

        <!-- Prediction Section -->
        <div class="prediction-section" *ngIf="prediction">
          <h4>AI Prediction</h4>
          <div class="prediction-grid">
            <div class="prediction-item">
              <div class="prediction-value success" [class.high]="prediction.successProbability >= 70">
                {{ prediction.successProbability }}%
              </div>
              <div class="prediction-label">Success Probability</div>
            </div>
            <div class="prediction-item">
              <div class="prediction-value">{{ prediction.hotelSuccessRate }}%</div>
              <div class="prediction-label">Hotel Win Rate</div>
            </div>
            <div class="prediction-item">
              <div class="prediction-value">{{ prediction.citySuccessRate }}%</div>
              <div class="prediction-label">City Win Rate</div>
            </div>
            <div class="prediction-item">
              <div class="prediction-value" [style.color]="prediction.riskColor">
                {{ prediction.riskLevel }}
              </div>
              <div class="prediction-label">Risk Assessment</div>
            </div>
          </div>
          <div class="recommendation" [class]="prediction.recommendation.toLowerCase().replace(' ', '-')">
            <mat-icon>{{ getRecommendationIcon() }}</mat-icon>
            <span>{{ prediction.recommendation }}</span>
          </div>
        </div>

        <!-- Price Chart Preview -->
        <div class="chart-section">
          <h4>Insights - Price vs Days Before Arrival</h4>
          <div class="mini-chart">
            <svg viewBox="0 0 300 100" class="price-chart">
              <!-- Grid lines -->
              <line x1="30" y1="10" x2="30" y2="90" stroke="rgba(255,255,255,0.1)" />
              <line x1="30" y1="90" x2="290" y2="90" stroke="rgba(255,255,255,0.1)" />

              <!-- Price line (simulated based on daysBeforeArrival) -->
              <polyline
                fill="none"
                stroke="#3b82f6"
                stroke-width="2"
                [attr.points]="chartPoints"
              />

              <!-- Current position marker -->
              <circle
                [attr.cx]="currentPositionX"
                [attr.cy]="currentPositionY"
                r="5"
                fill="#D4AF37"
                stroke="white"
                stroke-width="2"
              />

              <!-- Axis labels -->
              <text x="160" y="100" fill="#64748b" font-size="8" text-anchor="middle">daysBeforeArrival</text>
              <text x="15" y="50" fill="#64748b" font-size="8" text-anchor="middle" transform="rotate(-90, 15, 50)">price</text>
            </svg>
          </div>
        </div>

        <!-- Loading State -->
        <div class="loading-overlay" *ngIf="loading">
          <mat-spinner diameter="40"></mat-spinner>
          <span>Analyzing opportunity...</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="dialog-actions">
        <button mat-button class="cancel-btn" (click)="onCancel()">Cancel</button>
        <button class="buy-btn" (click)="onConfirm()" [disabled]="loading">
          <mat-icon>shopping_cart</mat-icon>
          Buy for {{ data.price }}$
        </button>
      </div>
    </div>
  `,
  styles: [`
    .buy-option-dialog {
      background: var(--bg-secondary, #12171f);
      border-radius: 12px;
      min-width: 420px;
      max-width: 500px;
      color: var(--text-primary, #f1f5f9);
      position: relative;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));

      .medici-logo-small {
        background: linear-gradient(135deg, #D4AF37 0%, #B8962E 100%);
        padding: 6px 12px;
        border-radius: 4px;
        text-align: center;

        span {
          color: #0a0e14;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .stars {
          color: white;
          font-size: 6px;
        }
      }

      h2 {
        flex: 1;
        margin: 0;
        font-size: 18px;
        color: var(--accent-primary, #D4AF37);
      }

      .close-btn {
        color: var(--text-muted);
      }
    }

    .dialog-content {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      position: relative;
    }

    .hotel-info {
      text-align: center;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);

      h3 {
        margin: 0 0 4px 0;
        font-size: 20px;
      }

      .location {
        color: var(--text-secondary);
        margin: 0 0 8px 0;
      }

      .dates {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 14px;
        color: var(--text-secondary);

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: var(--accent-primary);
        }
      }

      .room-type {
        margin-top: 8px;
        font-size: 13px;
        color: var(--text-muted);
      }
    }

    .price-section {
      background: var(--bg-tertiary, #1a2029);
      border-radius: 8px;
      padding: 16px;

      .price-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--border-color);

        &:last-child {
          border-bottom: none;
        }

        .label {
          color: var(--text-secondary);
        }

        .value {
          font-weight: 600;

          &.target {
            color: var(--info, #3b82f6);
          }

          &.profit {
            color: var(--success, #22c55e);
          }

          &.margin {
            color: var(--accent-primary, #D4AF37);
          }
        }
      }
    }

    .risk-section {
      h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: var(--text-secondary);
      }

      .risk-slider-container {
        position: relative;
        padding: 0 8px;

        .risk-labels {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;

          .low { color: #22c55e; }
          .medium { color: #f59e0b; }
          .high { color: #ef4444; }
        }

        .risk-slider {
          width: 100%;

          &.low {
            --mdc-slider-active-track-color: #22c55e;
            --mdc-slider-handle-color: #22c55e;
          }

          &.medium {
            --mdc-slider-active-track-color: #f59e0b;
            --mdc-slider-handle-color: #f59e0b;
          }

          &.high {
            --mdc-slider-active-track-color: #ef4444;
            --mdc-slider-handle-color: #ef4444;
          }
        }
      }

      .risk-description {
        text-align: center;
        font-size: 12px;
        margin-top: 8px;
      }
    }

    .prediction-section {
      background: var(--bg-tertiary, #1a2029);
      border-radius: 8px;
      padding: 16px;

      h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: var(--accent-primary, #D4AF37);
      }

      .prediction-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;

        .prediction-item {
          text-align: center;

          .prediction-value {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 4px;

            &.success.high {
              color: var(--success, #22c55e);
            }
          }

          .prediction-label {
            font-size: 11px;
            color: var(--text-muted);
          }
        }
      }

      .recommendation {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 16px;
        padding: 10px;
        border-radius: 6px;
        font-weight: 600;

        &.strong-buy, &.buy {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        &.hold {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }

        &.avoid, &.weak {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }
      }
    }

    .chart-section {
      h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: var(--accent-primary, #D4AF37);
      }

      .mini-chart {
        background: var(--bg-tertiary, #1a2029);
        border-radius: 8px;
        padding: 12px;
        height: 120px;

        .price-chart {
          width: 100%;
          height: 100%;
        }
      }
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(10, 14, 20, 0.9);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      border-radius: 8px;
      z-index: 10;

      span {
        color: var(--text-secondary);
        font-size: 14px;
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);

      .cancel-btn {
        color: var(--text-secondary);
      }

      .buy-btn {
        background: linear-gradient(135deg, #D4AF37 0%, #C9A227 100%);
        color: #0a0e14;
        border: none;
        padding: 10px 24px;
        border-radius: 20px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s ease;

        &:hover:not(:disabled) {
          background: linear-gradient(135deg, #E5C158 0%, #D4AF37 100%);
          transform: translateY(-1px);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }

    ::ng-deep {
      .mat-mdc-dialog-surface {
        background: transparent !important;
        box-shadow: none !important;
      }
    }
  `]
})
export class BuyOptionDialogComponent implements OnInit {
  riskValue = 30;
  loading = false;
  prediction: PredictionResult | null = null;

  targetPrice = 0;
  expectedProfit = 0;
  expectedMargin = 0;

  chartPoints = '';
  currentPositionX = 150;
  currentPositionY = 50;

  constructor(
    public dialogRef: MatDialogRef<BuyOptionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: BuyOptionData,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.calculatePricing();
    this.loadPrediction();
    this.generateChartPoints();
  }

  calculatePricing(): void {
    // Calculate target price and margins
    this.targetPrice = Math.round(this.data.price * 1.15); // 15% markup default
    this.expectedProfit = this.targetPrice - this.data.price;
    this.expectedMargin = Math.round((this.expectedProfit / this.data.price) * 100);
  }

  loadPrediction(): void {
    this.loading = true;

    interface FullAnalysisResponse {
      success: boolean;
      overallScore?: number;
      overallRecommendation?: string;
      successPrediction?: {
        successProbability?: number;
        hotelSuccessRate?: number;
        citySuccessRate?: number;
      };
      riskAssessment?: {
        riskLevel?: string;
        riskScore?: number;
        riskColor?: string;
      };
    }

    this.http.post<FullAnalysisResponse>(
      `${environment.apiUrl}/ml/full-analysis`,
      {
        hotelId: this.data.hotelId,
        city: this.data.city,
        price: this.data.price,
        daysBeforeArrival: this.data.daysBeforeArrival,
        targetMargin: this.expectedMargin
      }
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.prediction = {
            successProbability: response.successPrediction?.successProbability ?? 50,
            hotelSuccessRate: response.successPrediction?.hotelSuccessRate ?? 50,
            citySuccessRate: response.successPrediction?.citySuccessRate ?? 50,
            riskLevel: response.riskAssessment?.riskLevel ?? 'MEDIUM',
            riskScore: response.riskAssessment?.riskScore ?? 50,
            riskColor: response.riskAssessment?.riskColor ?? '#f59e0b',
            recommendation: response.overallRecommendation ?? 'HOLD',
            confidence: response.overallScore ?? 50
          };
          this.riskValue = this.prediction.riskScore;
        }
        this.loading = false;
      },
      error: () => {
        // Fallback to default values
        this.prediction = {
          successProbability: 65,
          hotelSuccessRate: 60,
          citySuccessRate: 58,
          riskLevel: 'MEDIUM',
          riskScore: 45,
          riskColor: '#f59e0b',
          recommendation: 'HOLD',
          confidence: 55
        };
        this.loading = false;
      }
    });
  }

  generateChartPoints(): void {
    // Generate sample chart showing price trend over days before arrival
    const points: string[] = [];
    const basePrice = this.data.price;

    // Simulate price curve (higher prices closer to check-in)
    for (let day = 0; day <= 350; day += 25) {
      const x = 30 + (day / 350) * 260;
      // Price tends to be higher when close to check-in
      const priceMultiplier = 1 + (0.3 * Math.exp(-day / 100));
      const y = 90 - ((priceMultiplier * basePrice) / (basePrice * 1.5)) * 70;
      points.push(`${x},${y}`);
    }

    this.chartPoints = points.join(' ');

    // Calculate current position based on daysBeforeArrival
    const dayNormalized = Math.min(this.data.daysBeforeArrival, 350) / 350;
    this.currentPositionX = 30 + dayNormalized * 260;
    const priceMultiplier = 1 + (0.3 * Math.exp(-this.data.daysBeforeArrival / 100));
    this.currentPositionY = 90 - ((priceMultiplier * basePrice) / (basePrice * 1.5)) * 70;
  }

  onRiskChange(value: number): void {
    this.riskValue = value;
  }

  getRiskColor(): string {
    if (this.riskValue < 35) return '#22c55e';
    if (this.riskValue < 65) return '#f59e0b';
    return '#ef4444';
  }

  getRiskDescription(): string {
    if (this.riskValue < 35) return 'Low risk - Good historical performance';
    if (this.riskValue < 65) return 'Medium risk - Some volatility expected';
    return 'High risk - Aggressive margin or short timeline';
  }

  getRecommendationIcon(): string {
    if (!this.prediction) return 'help';
    const rec = this.prediction.recommendation.toLowerCase();
    if (rec.includes('buy')) return 'thumb_up';
    if (rec.includes('hold')) return 'pause_circle';
    return 'thumb_down';
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    this.dialogRef.close({
      confirmed: true,
      data: this.data,
      riskLevel: this.riskValue < 35 ? 'LOW' : this.riskValue < 65 ? 'MEDIUM' : 'HIGH',
      prediction: this.prediction
    });
  }
}
