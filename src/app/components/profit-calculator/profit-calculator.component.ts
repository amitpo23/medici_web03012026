import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatDividerModule } from '@angular/material/divider';

@Component({
  selector: 'app-profit-calculator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatDividerModule
  ],
  template: `
    <mat-card class="calculator-card">
      <mat-card-header>
        <mat-icon mat-card-avatar>calculate</mat-icon>
        <mat-card-title>Profit Calculator</mat-card-title>
        <mat-card-subtitle>Quick ROI estimation</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <!-- Buy Price -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Buy Price (USD)</mat-label>
          <input matInput type="number" [(ngModel)]="buyPrice" (ngModelChange)="calculate()">
          <mat-icon matPrefix>shopping_cart</mat-icon>
        </mat-form-field>

        <!-- Sell Price -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Sell Price (USD)</mat-label>
          <input matInput type="number" [(ngModel)]="sellPrice" (ngModelChange)="calculate()">
          <mat-icon matPrefix>sell</mat-icon>
        </mat-form-field>

        <!-- Nights -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Number of Nights</mat-label>
          <input matInput type="number" [(ngModel)]="nights" (ngModelChange)="calculate()" min="1">
          <mat-icon matPrefix>nights_stay</mat-icon>
        </mat-form-field>

        <!-- Commission Slider -->
        <div class="slider-container">
          <label>Commission: {{ commission }}%</label>
          <mat-slider min="0" max="30" step="0.5" discrete>
            <input matSliderThumb [(ngModel)]="commission" (ngModelChange)="calculate()">
          </mat-slider>
        </div>

        <mat-divider class="divider"></mat-divider>

        <!-- Results -->
        <div class="results">
          <div class="result-row">
            <span class="label">Gross Profit</span>
            <span class="value" [class.positive]="grossProfit > 0" [class.negative]="grossProfit < 0">
              {{ grossProfit | currency:'USD':'symbol':'1.2-2' }}
            </span>
          </div>

          <div class="result-row">
            <span class="label">Commission Cost</span>
            <span class="value negative">
              -{{ commissionAmount | currency:'USD':'symbol':'1.2-2' }}
            </span>
          </div>

          <div class="result-row highlight">
            <span class="label">Net Profit</span>
            <span class="value" [class.positive]="netProfit > 0" [class.negative]="netProfit < 0">
              {{ netProfit | currency:'USD':'symbol':'1.2-2' }}
            </span>
          </div>

          <div class="result-row">
            <span class="label">Margin</span>
            <span class="value" [class.positive]="margin > 0" [class.negative]="margin < 0">
              {{ margin | number:'1.1-1' }}%
            </span>
          </div>

          <div class="result-row">
            <span class="label">ROI</span>
            <span class="value" [class.positive]="roi > 0" [class.negative]="roi < 0">
              {{ roi | number:'1.1-1' }}%
            </span>
          </div>

          <div class="result-row">
            <span class="label">Profit per Night</span>
            <span class="value">
              {{ profitPerNight | currency:'USD':'symbol':'1.2-2' }}
            </span>
          </div>
        </div>

        <!-- Recommendation -->
        <div class="recommendation" [class]="recommendation.type">
          <mat-icon>{{ recommendation.icon }}</mat-icon>
          <span>{{ recommendation.message }}</span>
        </div>
      </mat-card-content>

      <mat-card-actions>
        <button mat-button (click)="reset()">
          <mat-icon>refresh</mat-icon>
          Reset
        </button>
        <button mat-raised-button color="primary" (click)="applyToSearch()">
          <mat-icon>search</mat-icon>
          Find Similar
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    .calculator-card {
      max-width: 400px;
    }

    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }

    .slider-container {
      padding: 0 8px;
      margin-bottom: 16px;
    }

    .slider-container label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      color: #666;
    }

    .slider-container mat-slider {
      width: 100%;
    }

    .divider {
      margin: 16px 0;
    }

    .results {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .result-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }

    .result-row:last-child {
      border-bottom: none;
    }

    .result-row.highlight {
      background: white;
      margin: 8px -8px;
      padding: 12px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 16px;
    }

    .label {
      color: #666;
    }

    .value {
      font-weight: 500;
    }

    .positive {
      color: #4caf50;
    }

    .negative {
      color: #f44336;
    }

    .recommendation {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
    }

    .recommendation.success {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .recommendation.warning {
      background: #fff3e0;
      color: #ef6c00;
    }

    .recommendation.danger {
      background: #ffebee;
      color: #c62828;
    }

    mat-card-actions {
      display: flex;
      justify-content: space-between;
    }
  `]
})
export class ProfitCalculatorComponent {
  buyPrice = 0;
  sellPrice = 0;
  nights = 1;
  commission = 10;

  grossProfit = 0;
  commissionAmount = 0;
  netProfit = 0;
  margin = 0;
  roi = 0;
  profitPerNight = 0;

  recommendation = {
    type: 'warning',
    icon: 'info',
    message: 'Enter prices to see recommendation'
  };

  calculate(): void {
    this.grossProfit = this.sellPrice - this.buyPrice;
    this.commissionAmount = (this.sellPrice * this.commission) / 100;
    this.netProfit = this.grossProfit - this.commissionAmount;

    if (this.sellPrice > 0) {
      this.margin = (this.netProfit / this.sellPrice) * 100;
    } else {
      this.margin = 0;
    }

    if (this.buyPrice > 0) {
      this.roi = (this.netProfit / this.buyPrice) * 100;
    } else {
      this.roi = 0;
    }

    this.profitPerNight = this.nights > 0 ? this.netProfit / this.nights : 0;

    this.updateRecommendation();
  }

  updateRecommendation(): void {
    if (this.buyPrice === 0 || this.sellPrice === 0) {
      this.recommendation = {
        type: 'warning',
        icon: 'info',
        message: 'Enter prices to see recommendation'
      };
      return;
    }

    if (this.margin >= 15) {
      this.recommendation = {
        type: 'success',
        icon: 'thumb_up',
        message: 'Excellent deal! High profit margin'
      };
    } else if (this.margin >= 10) {
      this.recommendation = {
        type: 'success',
        icon: 'check_circle',
        message: 'Good deal with healthy margin'
      };
    } else if (this.margin >= 5) {
      this.recommendation = {
        type: 'warning',
        icon: 'warning',
        message: 'Marginal profit - consider carefully'
      };
    } else if (this.margin > 0) {
      this.recommendation = {
        type: 'warning',
        icon: 'trending_down',
        message: 'Low margin - may not be worth the risk'
      };
    } else {
      this.recommendation = {
        type: 'danger',
        icon: 'dangerous',
        message: 'Loss-making deal - avoid!'
      };
    }
  }

  reset(): void {
    this.buyPrice = 0;
    this.sellPrice = 0;
    this.nights = 1;
    this.commission = 10;
    this.calculate();
  }

  applyToSearch(): void {
    // Navigate to search with these parameters
    console.log('Navigate to search with margin:', this.margin);
  }
}
