import { Component, Input, OnInit, OnChanges, SimpleChanges, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment.prod';

interface ChartDataPoint {
  x: number; // daysBeforeArrival
  y: number; // price
}

interface TrendData {
  label: string;
  daysMin: number;
  daysMax: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  dataPoints: number;
}

@Component({
  selector: 'app-insights-chart',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="insights-chart-container">
      <div class="chart-header">
        <h3>Insights</h3>
        <div class="trend-badge" *ngIf="trend" [class]="trend.toLowerCase()">
          <span class="icon">{{ getTrendIcon() }}</span>
          {{ trend }}
        </div>
      </div>

      <div class="chart-wrapper" #chartWrapper>
        <svg
          [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight"
          class="price-chart"
          role="img"
          aria-label="Price trend chart showing price vs days before arrival"
          (mousemove)="onMouseMove($event)"
          (mouseleave)="hideTooltip()"
        >
          <title>Price Trend Chart</title>
          <!-- Grid lines -->
          <g class="grid-lines">
            <!-- Horizontal grid lines -->
            <line *ngFor="let y of gridLinesY"
              [attr.x1]="padding.left"
              [attr.y1]="y"
              [attr.x2]="chartWidth - padding.right"
              [attr.y2]="y"
              stroke="rgba(255,255,255,0.05)"
              stroke-dasharray="4,4"
            />
            <!-- Vertical grid lines -->
            <line *ngFor="let x of gridLinesX"
              [attr.x1]="x"
              [attr.y1]="padding.top"
              [attr.x2]="x"
              [attr.y2]="chartHeight - padding.bottom"
              stroke="rgba(255,255,255,0.05)"
              stroke-dasharray="4,4"
            />
          </g>

          <!-- Axes -->
          <g class="axes">
            <!-- Y Axis -->
            <line
              [attr.x1]="padding.left"
              [attr.y1]="padding.top"
              [attr.x2]="padding.left"
              [attr.y2]="chartHeight - padding.bottom"
              stroke="rgba(255,255,255,0.2)"
            />
            <!-- X Axis -->
            <line
              [attr.x1]="padding.left"
              [attr.y1]="chartHeight - padding.bottom"
              [attr.x2]="chartWidth - padding.right"
              [attr.y2]="chartHeight - padding.bottom"
              stroke="rgba(255,255,255,0.2)"
            />
          </g>

          <!-- Axis Labels -->
          <g class="axis-labels">
            <!-- Y Axis labels (price) -->
            <text *ngFor="let label of yAxisLabels"
              [attr.x]="padding.left - 8"
              [attr.y]="label.y + 4"
              text-anchor="end"
              fill="#64748b"
              font-size="10"
            >{{ label.value }}</text>

            <!-- X Axis labels (days) -->
            <text *ngFor="let label of xAxisLabels"
              [attr.x]="label.x"
              [attr.y]="chartHeight - padding.bottom + 16"
              text-anchor="middle"
              fill="#64748b"
              font-size="10"
            >{{ label.value }}</text>

            <!-- Axis titles -->
            <text
              [attr.x]="chartWidth / 2"
              [attr.y]="chartHeight - 5"
              text-anchor="middle"
              fill="#94a3b8"
              font-size="11"
              font-style="italic"
            >daysBeforeArrival</text>

            <text
              [attr.x]="15"
              [attr.y]="chartHeight / 2"
              text-anchor="middle"
              fill="#94a3b8"
              font-size="11"
              font-style="italic"
              [attr.transform]="'rotate(-90, 15, ' + (chartHeight / 2) + ')'"
            >price</text>
          </g>

          <!-- Area under curve -->
          <path
            *ngIf="areaPath"
            [attr.d]="areaPath"
            fill="url(#areaGradient)"
            opacity="0.3"
          />

          <!-- Main price line -->
          <polyline
            *ngIf="linePath"
            [attr.points]="linePath"
            fill="none"
            stroke="#3b82f6"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <!-- Data points -->
          <g class="data-points">
            <circle *ngFor="let point of chartPoints; let i = index"
              [attr.cx]="point.screenX"
              [attr.cy]="point.screenY"
              r="4"
              fill="#3b82f6"
              stroke="white"
              stroke-width="1.5"
              class="data-point"
              (mouseenter)="showPointTooltip(point, i)"
            />
          </g>

          <!-- Gradient definition -->
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
            </linearGradient>
          </defs>
        </svg>

        <!-- Tooltip -->
        <div class="chart-tooltip" *ngIf="tooltipVisible"
          [style.left.px]="tooltipX"
          [style.top.px]="tooltipY"
        >
          <div class="tooltip-row">
            <span class="label">Days:</span>
            <span class="value">{{ tooltipData?.days }}</span>
          </div>
          <div class="tooltip-row">
            <span class="label">Price:</span>
            <span class="value">{{ tooltipData?.price | number:'1.0-0' }}$</span>
          </div>
        </div>
      </div>

      <!-- Trend Summary -->
      <div class="trend-summary" *ngIf="trendData && trendData.length > 0">
        <div class="summary-item" *ngFor="let bucket of trendData.slice(0, 4)">
          <span class="bucket-label">{{ bucket.label }}</span>
          <span class="bucket-price">{{ bucket.avgPrice | number:'1.0-0' }}$</span>
        </div>
      </div>

      <!-- Recommendation -->
      <div class="recommendation" *ngIf="recommendation">
        <mat-icon>lightbulb</mat-icon>
        <span>{{ recommendation }}</span>
      </div>
    </div>
  `,
  styles: [`
    .insights-chart-container {
      background: var(--bg-secondary, #12171f);
      border-radius: 8px;
      padding: 16px;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      h3 {
        margin: 0;
        font-size: 14px;
        color: var(--accent-primary, #D4AF37);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .trend-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 500;

        &.decreasing {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
        }

        &.increasing {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }

        &.stable {
          background: rgba(59, 130, 246, 0.15);
          color: #3b82f6;
        }

        .icon {
          font-size: 14px;
        }
      }
    }

    .chart-wrapper {
      position: relative;
      width: 100%;
      height: 220px;

      .price-chart {
        width: 100%;
        height: 100%;

        .data-point {
          cursor: pointer;
          transition: r 0.2s ease;

          &:hover {
            r: 6;
          }
        }
      }

      .chart-tooltip {
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid var(--accent-primary, #D4AF37);
        border-radius: 6px;
        padding: 8px 12px;
        pointer-events: none;
        z-index: 10;

        .tooltip-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          font-size: 12px;

          .label {
            color: var(--text-muted);
          }

          .value {
            color: var(--text-primary);
            font-weight: 600;
          }
        }
      }
    }

    .trend-summary {
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));

      .summary-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;

        .bucket-label {
          font-size: 10px;
          color: var(--text-muted);
        }

        .bucket-price {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
      }
    }

    .recommendation {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-top: 12px;
      padding: 12px;
      background: rgba(212, 175, 55, 0.1);
      border-radius: 6px;
      border-left: 3px solid var(--accent-primary, #D4AF37);

      mat-icon {
        color: var(--accent-primary);
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      span {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.5;
      }
    }
  `]
})
export class InsightsChartComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() hotelId = 0;
  @Input() city = '';
  @Input() height = 220;

  @ViewChild('chartWrapper') chartWrapper!: ElementRef;

  chartWidth = 400;
  chartHeight = 200;
  padding = { top: 20, right: 20, bottom: 40, left: 50 };

  chartPoints: Array<{ x: number; y: number; screenX: number; screenY: number }> = [];
  linePath = '';
  areaPath = '';

  gridLinesX: number[] = [];
  gridLinesY: number[] = [];
  xAxisLabels: Array<{ x: number; value: string }> = [];
  yAxisLabels: Array<{ y: number; value: string }> = [];

  trend = '';
  trendData: TrendData[] = [];
  recommendation = '';

  tooltipVisible = false;
  tooltipX = 0;
  tooltipY = 0;
  tooltipData: { days: number; price: number } | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.updateChartDimensions();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hotelId'] || changes['city']) {
      this.loadData();
    }
  }

  updateChartDimensions(): void {
    if (this.chartWrapper) {
      const rect = this.chartWrapper.nativeElement.getBoundingClientRect();
      this.chartWidth = rect.width || 400;
      this.chartHeight = this.height;
      this.generateChart();
    }
  }

  loadData(): void {
    if (!this.hotelId && !this.city) {
      this.generateMockData();
      return;
    }

    this.http.get<{
      success: boolean;
      trend: string;
      trendData: TrendData[];
      chartData: ChartDataPoint[];
      recommendation: string;
    }>(`${environment.apiUrl}/ml/price-trend/${this.hotelId}?city=${this.city}`).subscribe({
      next: (response) => {
        if (response.success) {
          this.trend = response.trend;
          this.trendData = response.trendData;
          this.recommendation = response.recommendation;
          this.processChartData(response.chartData);
        } else {
          this.generateMockData();
        }
      },
      error: () => {
        this.generateMockData();
      }
    });
  }

  generateMockData(): void {
    // Generate realistic mock data based on typical price patterns
    const mockData: ChartDataPoint[] = [];
    const basePrice = 120;

    for (let days = 0; days <= 350; days += 15) {
      // Price tends to be higher closer to check-in, with some randomness
      const multiplier = 1 + (0.4 * Math.exp(-days / 80)) + (Math.random() * 0.1 - 0.05);
      mockData.push({
        x: days,
        y: basePrice * multiplier
      });
    }

    this.trend = 'DECREASING';
    this.recommendation = 'Prices typically drop closer to check-in. Consider buying earlier for better margins.';
    this.trendData = [
      { label: '0-7 days', daysMin: 0, daysMax: 7, avgPrice: 175, minPrice: 160, maxPrice: 190, dataPoints: 15 },
      { label: '8-14 days', daysMin: 8, daysMax: 14, avgPrice: 155, minPrice: 140, maxPrice: 170, dataPoints: 20 },
      { label: '15-30 days', daysMin: 15, daysMax: 30, avgPrice: 140, minPrice: 125, maxPrice: 155, dataPoints: 35 },
      { label: '31-60 days', daysMin: 31, daysMax: 60, avgPrice: 125, minPrice: 110, maxPrice: 140, dataPoints: 45 }
    ];

    this.processChartData(mockData);
  }

  processChartData(data: ChartDataPoint[]): void {
    if (!data || data.length === 0) {
      this.generateMockData();
      return;
    }

    // Sort by days
    const sortedData = [...data].sort((a, b) => a.x - b.x);

    // Find min/max for scaling
    const minDays = Math.min(...sortedData.map(d => d.x));
    const maxDays = Math.max(...sortedData.map(d => d.x));
    const minPrice = Math.min(...sortedData.map(d => d.y)) * 0.9;
    const maxPrice = Math.max(...sortedData.map(d => d.y)) * 1.1;

    const plotWidth = this.chartWidth - this.padding.left - this.padding.right;
    const plotHeight = this.chartHeight - this.padding.top - this.padding.bottom;

    // Convert to screen coordinates
    this.chartPoints = sortedData.map(point => ({
      x: point.x,
      y: point.y,
      screenX: this.padding.left + ((point.x - minDays) / (maxDays - minDays || 1)) * plotWidth,
      screenY: this.padding.top + plotHeight - ((point.y - minPrice) / (maxPrice - minPrice || 1)) * plotHeight
    }));

    // Generate paths
    this.linePath = this.chartPoints.map(p => `${p.screenX},${p.screenY}`).join(' ');

    // Area path (for gradient fill)
    const bottomY = this.chartHeight - this.padding.bottom;
    this.areaPath = `M${this.chartPoints[0].screenX},${bottomY} ` +
      this.chartPoints.map(p => `L${p.screenX},${p.screenY}`).join(' ') +
      ` L${this.chartPoints[this.chartPoints.length - 1].screenX},${bottomY} Z`;

    // Generate grid lines and labels
    this.generateGridAndLabels(minDays, maxDays, minPrice, maxPrice);
  }

  generateGridAndLabels(minDays: number, maxDays: number, minPrice: number, maxPrice: number): void {
    const plotWidth = this.chartWidth - this.padding.left - this.padding.right;
    const plotHeight = this.chartHeight - this.padding.top - this.padding.bottom;

    // Y-axis grid and labels (5 lines)
    this.gridLinesY = [];
    this.yAxisLabels = [];
    for (let i = 0; i <= 4; i++) {
      const y = this.padding.top + (i / 4) * plotHeight;
      this.gridLinesY.push(y);
      const price = maxPrice - (i / 4) * (maxPrice - minPrice);
      this.yAxisLabels.push({ y, value: Math.round(price).toString() });
    }

    // X-axis grid and labels (6 lines)
    this.gridLinesX = [];
    this.xAxisLabels = [];
    for (let i = 0; i <= 5; i++) {
      const x = this.padding.left + (i / 5) * plotWidth;
      this.gridLinesX.push(x);
      const days = Math.round(minDays + (i / 5) * (maxDays - minDays));
      this.xAxisLabels.push({ x, value: days.toString() });
    }
  }

  generateChart(): void {
    if (this.chartPoints.length > 0) {
      // Re-process with new dimensions
      const data = this.chartPoints.map(p => ({ x: p.x, y: p.y }));
      this.processChartData(data);
    }
  }

  getTrendIcon(): string {
    switch (this.trend) {
      case 'DECREASING': return '↘';
      case 'INCREASING': return '↗';
      default: return '→';
    }
  }

  showPointTooltip(point: { x: number; y: number; screenX: number; screenY: number }, _index: number): void {
    this.tooltipVisible = true;
    this.tooltipX = point.screenX + 10;
    this.tooltipY = point.screenY - 40;
    this.tooltipData = { days: point.x, price: point.y };
  }

  onMouseMove(_event: MouseEvent): void {
    // Could implement hover line tracking here
  }

  hideTooltip(): void {
    this.tooltipVisible = false;
  }
}
