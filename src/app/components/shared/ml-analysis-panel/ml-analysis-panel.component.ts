import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { environment } from '../../../environments/environment.prod';

interface CityAnalysis {
  city: string;
  totalOpportunities: number;
  successRate: number;
  avgPrice: number;
  avgMargin: number;
  topHotels: Array<{ hotelId: number; hotelName: string; successRate: number }>;
  trend: 'UP' | 'DOWN' | 'STABLE';
  recommendation: string;
}

interface HotelAnalysis {
  hotelId: number;
  hotelName: string;
  city: string;
  totalDeals: number;
  successRate: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  avgMargin: number;
  bestMonth: string;
  worstMonth: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
}

@Component({
  selector: 'app-ml-analysis-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <div class="ml-analysis-panel">
      <!-- Header -->
      <div class="panel-header">
        <div class="header-title">
          <mat-icon>psychology</mat-icon>
          <h3>ML Analysis</h3>
        </div>
        <div class="mode-toggle">
          <button [class.active]="mode === 'city'" (click)="setMode('city')">City</button>
          <button [class.active]="mode === 'hotel'" (click)="setMode('hotel')">Hotel</button>
        </div>
      </div>

      <!-- Search Input -->
      <div class="search-section">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>{{ mode === 'city' ? 'Enter City' : 'Enter Hotel ID' }}</mat-label>
          <input matInput [(ngModel)]="searchQuery" (keyup.enter)="search()"
                 [placeholder]="mode === 'city' ? 'e.g., Paris, London' : 'e.g., 12345'">
          <button mat-icon-button matSuffix (click)="search()">
            <mat-icon>search</mat-icon>
          </button>
        </mat-form-field>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="loading">
        <mat-spinner diameter="40"></mat-spinner>
        <span>Analyzing {{ mode === 'city' ? 'city' : 'hotel' }} data...</span>
      </div>

      <!-- City Analysis Results -->
      <div class="analysis-results" *ngIf="!loading && cityAnalysis && mode === 'city'">
        <div class="result-header">
          <h4>{{ cityAnalysis.city }}</h4>
          <span class="trend-badge" [class]="cityAnalysis.trend.toLowerCase()">
            {{ getTrendIcon(cityAnalysis.trend) }} {{ cityAnalysis.trend }}
          </span>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-value">{{ cityAnalysis.totalOpportunities }}</span>
            <span class="metric-label">Total Deals</span>
          </div>
          <div class="metric-card success">
            <span class="metric-value">{{ cityAnalysis.successRate }}%</span>
            <span class="metric-label">Success Rate</span>
          </div>
          <div class="metric-card">
            <span class="metric-value">{{ cityAnalysis.avgPrice | number:'1.0-0' }}$</span>
            <span class="metric-label">Avg Price</span>
          </div>
          <div class="metric-card profit">
            <span class="metric-value">{{ cityAnalysis.avgMargin }}%</span>
            <span class="metric-label">Avg Margin</span>
          </div>
        </div>

        <!-- Top Hotels in City -->
        <div class="top-hotels" *ngIf="cityAnalysis.topHotels?.length">
          <h5>Top Performing Hotels</h5>
          <div class="hotel-list">
            <div class="hotel-item" *ngFor="let hotel of cityAnalysis.topHotels.slice(0, 3)"
                 (click)="selectHotel(hotel.hotelId)">
              <span class="hotel-name">{{ hotel.hotelName }}</span>
              <span class="hotel-rate" [class.high]="hotel.successRate >= 70">
                {{ hotel.successRate }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Recommendation -->
        <div class="recommendation-box">
          <mat-icon>lightbulb</mat-icon>
          <p>{{ cityAnalysis.recommendation }}</p>
        </div>
      </div>

      <!-- Hotel Analysis Results -->
      <div class="analysis-results" *ngIf="!loading && hotelAnalysis && mode === 'hotel'">
        <div class="result-header">
          <h4>{{ hotelAnalysis.hotelName }}</h4>
          <span class="risk-badge" [class]="hotelAnalysis.riskLevel.toLowerCase()">
            {{ hotelAnalysis.riskLevel }} RISK
          </span>
        </div>

        <div class="hotel-meta">
          <span class="city">{{ hotelAnalysis.city }}</span>
          <span class="id">ID: {{ hotelAnalysis.hotelId }}</span>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-value">{{ hotelAnalysis.totalDeals }}</span>
            <span class="metric-label">Total Deals</span>
          </div>
          <div class="metric-card success">
            <span class="metric-value">{{ hotelAnalysis.successRate }}%</span>
            <span class="metric-label">Success Rate</span>
          </div>
          <div class="metric-card">
            <span class="metric-value">{{ hotelAnalysis.avgBuyPrice | number:'1.0-0' }}$</span>
            <span class="metric-label">Avg Buy</span>
          </div>
          <div class="metric-card profit">
            <span class="metric-value">{{ hotelAnalysis.avgMargin }}%</span>
            <span class="metric-label">Avg Margin</span>
          </div>
        </div>

        <!-- Performance by Month -->
        <div class="performance-section">
          <div class="perf-item best">
            <mat-icon>trending_up</mat-icon>
            <div class="perf-content">
              <span class="perf-label">Best Month</span>
              <span class="perf-value">{{ hotelAnalysis.bestMonth }}</span>
            </div>
          </div>
          <div class="perf-item worst">
            <mat-icon>trending_down</mat-icon>
            <div class="perf-content">
              <span class="perf-label">Worst Month</span>
              <span class="perf-value">{{ hotelAnalysis.worstMonth }}</span>
            </div>
          </div>
        </div>

        <!-- Recommendation -->
        <div class="recommendation-box">
          <mat-icon>lightbulb</mat-icon>
          <p>{{ hotelAnalysis.recommendation }}</p>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && !cityAnalysis && !hotelAnalysis">
        <mat-icon>analytics</mat-icon>
        <p>Search for a {{ mode === 'city' ? 'city' : 'hotel' }} to see ML predictions and analysis</p>
      </div>

      <!-- Quick Stats -->
      <div class="quick-stats" *ngIf="quickStats">
        <h5>Today's Highlights</h5>
        <div class="stats-row">
          <div class="stat-item">
            <span class="stat-value success">{{ quickStats.topCity }}</span>
            <span class="stat-label">Best City</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ quickStats.avgSuccessRate }}%</span>
            <span class="stat-label">Avg Success</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ml-analysis-panel {
      background: var(--bg-secondary, #12171f);
      border-radius: 8px;
      padding: 16px;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;

        mat-icon {
          color: var(--accent-primary, #D4AF37);
        }

        h3 {
          margin: 0;
          font-size: 14px;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
      }

      .mode-toggle {
        display: flex;
        background: var(--bg-tertiary, #1a2029);
        border-radius: 6px;
        padding: 2px;

        button {
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 12px;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.2s ease;

          &.active {
            background: var(--accent-primary, #D4AF37);
            color: #0a0e14;
          }

          &:hover:not(.active) {
            color: var(--text-primary);
          }
        }
      }
    }

    .search-section {
      margin-bottom: 16px;

      .search-field {
        width: 100%;

        ::ng-deep {
          .mat-mdc-text-field-wrapper {
            background: var(--bg-tertiary, #1a2029);
          }

          .mat-mdc-form-field-subscript-wrapper {
            display: none;
          }
        }
      }
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 40px;
      color: var(--text-muted);
    }

    .analysis-results {
      flex: 1;
      overflow-y: auto;

      .result-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        h4 {
          margin: 0;
          font-size: 18px;
          color: var(--text-primary);
        }

        .trend-badge, .risk-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;

          &.up, &.low { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
          &.stable, &.medium { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
          &.down, &.high { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
        }
      }

      .hotel-meta {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        font-size: 12px;
        color: var(--text-muted);
      }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 16px;

      .metric-card {
        background: var(--bg-tertiary, #1a2029);
        border-radius: 8px;
        padding: 12px;
        text-align: center;

        .metric-value {
          display: block;
          font-size: 20px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .metric-label {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        &.success .metric-value { color: #22c55e; }
        &.profit .metric-value { color: var(--accent-primary, #D4AF37); }
      }
    }

    .top-hotels {
      margin-bottom: 16px;

      h5 {
        margin: 0 0 8px 0;
        font-size: 12px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .hotel-list {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .hotel-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-tertiary, #1a2029);
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            background: rgba(212, 175, 55, 0.1);
            border-left: 2px solid var(--accent-primary);
          }

          .hotel-name {
            font-size: 13px;
            color: var(--text-primary);
          }

          .hotel-rate {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-secondary);

            &.high { color: #22c55e; }
          }
        }
      }
    }

    .performance-section {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;

      .perf-item {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--bg-tertiary, #1a2029);
        padding: 12px;
        border-radius: 8px;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }

        &.best mat-icon { color: #22c55e; }
        &.worst mat-icon { color: #ef4444; }

        .perf-content {
          display: flex;
          flex-direction: column;

          .perf-label {
            font-size: 10px;
            color: var(--text-muted);
          }

          .perf-value {
            font-size: 14px;
            font-weight: 600;
            color: var(--text-primary);
          }
        }
      }
    }

    .recommendation-box {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: rgba(212, 175, 55, 0.1);
      border-left: 3px solid var(--accent-primary, #D4AF37);
      padding: 12px;
      border-radius: 0 6px 6px 0;

      mat-icon {
        color: var(--accent-primary);
        font-size: 18px;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
      }

      p {
        margin: 0;
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.5;
      }
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 40px;
      text-align: center;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--text-muted);
        opacity: 0.5;
      }

      p {
        margin: 0;
        font-size: 13px;
        color: var(--text-muted);
      }
    }

    .quick-stats {
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));

      h5 {
        margin: 0 0 12px 0;
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .stats-row {
        display: flex;
        gap: 16px;

        .stat-item {
          flex: 1;
          text-align: center;

          .stat-value {
            display: block;
            font-size: 16px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 4px;

            &.success { color: #22c55e; }
          }

          .stat-label {
            font-size: 10px;
            color: var(--text-muted);
          }
        }
      }
    }
  `]
})
export class MlAnalysisPanelComponent implements OnInit, OnChanges {
  @Input() initialCity = '';
  @Input() initialHotelId = 0;

  @Output() hotelSelected = new EventEmitter<number>();

  mode: 'city' | 'hotel' = 'city';
  searchQuery = '';
  loading = false;

  cityAnalysis: CityAnalysis | null = null;
  hotelAnalysis: HotelAnalysis | null = null;

  quickStats: { topCity: string; avgSuccessRate: number } | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadQuickStats();

    if (this.initialCity) {
      this.mode = 'city';
      this.searchQuery = this.initialCity;
      this.search();
    } else if (this.initialHotelId) {
      this.mode = 'hotel';
      this.searchQuery = this.initialHotelId.toString();
      this.search();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialCity']?.currentValue) {
      this.mode = 'city';
      this.searchQuery = changes['initialCity'].currentValue;
      this.search();
    }
    if (changes['initialHotelId']?.currentValue) {
      this.mode = 'hotel';
      this.searchQuery = changes['initialHotelId'].currentValue.toString();
      this.search();
    }
  }

  setMode(mode: 'city' | 'hotel'): void {
    this.mode = mode;
    this.searchQuery = '';
    this.cityAnalysis = null;
    this.hotelAnalysis = null;
  }

  search(): void {
    if (!this.searchQuery.trim()) return;

    this.loading = true;
    this.cityAnalysis = null;
    this.hotelAnalysis = null;

    if (this.mode === 'city') {
      this.searchCity(this.searchQuery.trim());
    } else {
      this.searchHotel(parseInt(this.searchQuery.trim(), 10));
    }
  }

  searchCity(city: string): void {
    this.http.get<{ success: boolean; analysis: CityAnalysis }>(
      `${environment.apiUrl}/ml/city-analysis/${encodeURIComponent(city)}`
    ).subscribe({
      next: (response) => {
        if (response.success && response.analysis) {
          this.cityAnalysis = response.analysis;
        } else {
          this.cityAnalysis = this.getMockCityAnalysis(city);
        }
        this.loading = false;
      },
      error: () => {
        this.cityAnalysis = this.getMockCityAnalysis(city);
        this.loading = false;
      }
    });
  }

  searchHotel(hotelId: number): void {
    this.http.get<{ success: boolean; analysis: HotelAnalysis }>(
      `${environment.apiUrl}/ml/hotel-analysis/${hotelId}`
    ).subscribe({
      next: (response) => {
        if (response.success && response.analysis) {
          this.hotelAnalysis = response.analysis;
        } else {
          this.hotelAnalysis = this.getMockHotelAnalysis(hotelId);
        }
        this.loading = false;
      },
      error: () => {
        this.hotelAnalysis = this.getMockHotelAnalysis(hotelId);
        this.loading = false;
      }
    });
  }

  loadQuickStats(): void {
    // Load general quick stats
    this.quickStats = {
      topCity: 'Paris',
      avgSuccessRate: 68
    };
  }

  selectHotel(hotelId: number): void {
    this.hotelSelected.emit(hotelId);
    this.mode = 'hotel';
    this.searchQuery = hotelId.toString();
    this.search();
  }

  getTrendIcon(trend: string): string {
    switch (trend) {
      case 'UP': return '↗';
      case 'DOWN': return '↘';
      default: return '→';
    }
  }

  getMockCityAnalysis(city: string): CityAnalysis {
    return {
      city,
      totalOpportunities: Math.floor(Math.random() * 500) + 100,
      successRate: Math.floor(Math.random() * 30) + 55,
      avgPrice: Math.floor(Math.random() * 100) + 80,
      avgMargin: Math.floor(Math.random() * 15) + 10,
      topHotels: [
        { hotelId: 1001, hotelName: `${city} Grand Hotel`, successRate: 78 },
        { hotelId: 1002, hotelName: `${city} Plaza`, successRate: 72 },
        { hotelId: 1003, hotelName: `${city} Inn`, successRate: 68 }
      ],
      trend: ['UP', 'DOWN', 'STABLE'][Math.floor(Math.random() * 3)] as 'UP' | 'DOWN' | 'STABLE',
      recommendation: `${city} shows strong trading potential. Focus on 15-30 day advance bookings for optimal margins.`
    };
  }

  getMockHotelAnalysis(hotelId: number): HotelAnalysis {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return {
      hotelId,
      hotelName: `Hotel ${hotelId}`,
      city: 'Unknown City',
      totalDeals: Math.floor(Math.random() * 100) + 20,
      successRate: Math.floor(Math.random() * 30) + 50,
      avgBuyPrice: Math.floor(Math.random() * 80) + 60,
      avgSellPrice: Math.floor(Math.random() * 100) + 80,
      avgMargin: Math.floor(Math.random() * 15) + 8,
      bestMonth: months[Math.floor(Math.random() * 12)],
      worstMonth: months[Math.floor(Math.random() * 12)],
      riskLevel: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)] as 'LOW' | 'MEDIUM' | 'HIGH',
      recommendation: 'This hotel has consistent performance. Consider increasing exposure during peak season.'
    };
  }
}
