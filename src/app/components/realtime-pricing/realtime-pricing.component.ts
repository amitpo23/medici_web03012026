import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { interval, Subject, takeUntil } from 'rxjs';
import { environment } from 'src/app/environments/environment';

interface PriceUpdate {
  opportunityId: number;
  hotelName: string;
  city: string;
  checkIn: string;
  oldPrice: number;
  newPrice: number;
  strategy: string;
  confidence: number;
  timestamp: Date;
}

interface PerformanceMetric {
  label: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
}

@Component({
  selector: 'app-realtime-pricing',
  templateUrl: './realtime-pricing.component.html',
  styleUrls: ['./realtime-pricing.component.scss']
})
export class RealtimePricingComponent implements OnInit, OnDestroy {
  priceUpdates: PriceUpdate[] = [];
  metrics: PerformanceMetric[] = [];
  
  isLive = true;
  updateInterval = 5000; // 5 seconds
  
  private destroy$ = new Subject<void>();
  private baseUrl = environment.baseUrl;

  // Performance tracking
  totalUpdates = 0;
  avgConfidence = 0;
  strategyCounts: { [key: string]: number } = {};

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadInitialData();
    this.startLiveUpdates();
    this.initMetrics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInitialData(): void {
    // Simulate initial price updates
    this.generateMockUpdate();
  }

  startLiveUpdates(): void {
    interval(this.updateInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.isLive) {
          this.generateMockUpdate();
          this.updateMetrics();
        }
      });
  }

  initMetrics(): void {
    this.metrics = [
      { label: 'Avg Price Improvement', value: 0, change: 0, trend: 'neutral' },
      { label: 'ML Confidence', value: 0, change: 0, trend: 'neutral' },
      { label: 'Updates/Min', value: 0, change: 0, trend: 'neutral' },
      { label: 'Strategy Success', value: 0, change: 0, trend: 'neutral' }
    ];
  }

  generateMockUpdate(): void {
    const strategies = ['ML_OPTIMIZED', 'ELASTICITY_OPTIMIZED', 'COMPETITOR_MATCHED', 'AGGRESSIVE_VOLUME', 'PREMIUM_MARGIN'];
    const cities = ['Paris', 'London', 'Rome', 'Barcelona', 'Amsterdam'];
    const hotels = ['Hilton', 'Marriott', 'Hyatt', 'InterContinental', 'Radisson'];

    const oldPrice = 300 + Math.random() * 200;
    const priceChange = (Math.random() - 0.4) * 50; // Bias towards increases
    
    const update: PriceUpdate = {
      opportunityId: Math.floor(Math.random() * 10000) + 1000,
      hotelName: hotels[Math.floor(Math.random() * hotels.length)],
      city: cities[Math.floor(Math.random() * cities.length)],
      checkIn: this.getRandomDate(),
      oldPrice: oldPrice,
      newPrice: oldPrice + priceChange,
      strategy: strategies[Math.floor(Math.random() * strategies.length)],
      confidence: 0.7 + Math.random() * 0.25,
      timestamp: new Date()
    };

    this.priceUpdates.unshift(update);
    
    // Keep only last 50 updates
    if (this.priceUpdates.length > 50) {
      this.priceUpdates.pop();
    }

    this.totalUpdates++;
    
    // Track strategy usage
    this.strategyCounts[update.strategy] = (this.strategyCounts[update.strategy] || 0) + 1;
  }

  updateMetrics(): void {
    if (this.priceUpdates.length === 0) return;

    // Calculate average price improvement
    const avgImprovement = this.priceUpdates
      .map(u => u.newPrice - u.oldPrice)
      .reduce((a, b) => a + b, 0) / this.priceUpdates.length;

    // Calculate average confidence
    this.avgConfidence = this.priceUpdates
      .map(u => u.confidence)
      .reduce((a, b) => a + b, 0) / this.priceUpdates.length;

    // Updates per minute (based on total and elapsed time)
    const updatesPerMin = (this.totalUpdates / (Date.now() / 60000)) || 0;

    // Strategy success rate (confidence > 0.8)
    const highConfidenceCount = this.priceUpdates.filter(u => u.confidence > 0.8).length;
    const successRate = (highConfidenceCount / this.priceUpdates.length) * 100;

    this.metrics = [
      { 
        label: 'Avg Price Improvement', 
        value: avgImprovement, 
        change: Math.random() * 5 - 2, 
        trend: avgImprovement > 0 ? 'up' : 'down' 
      },
      { 
        label: 'ML Confidence', 
        value: this.avgConfidence * 100, 
        change: Math.random() * 3 - 1, 
        trend: this.avgConfidence > 0.8 ? 'up' : 'neutral' 
      },
      { 
        label: 'Updates/Min', 
        value: updatesPerMin, 
        change: Math.random() * 2 - 1, 
        trend: 'neutral' 
      },
      { 
        label: 'Strategy Success', 
        value: successRate, 
        change: Math.random() * 5 - 2, 
        trend: successRate > 70 ? 'up' : 'neutral' 
      }
    ];
  }

  getRandomDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(Math.random() * 60) + 7);
    return date.toISOString().split('T')[0];
  }

  getStrategyColor(strategy: string): string {
    const colors: { [key: string]: string } = {
      'ML_OPTIMIZED': '#6366f1',
      'ELASTICITY_OPTIMIZED': '#10b981',
      'COMPETITOR_MATCHED': '#f59e0b',
      'AGGRESSIVE_VOLUME': '#ef4444',
      'PREMIUM_MARGIN': '#8b5cf6'
    };
    return colors[strategy] || '#94a3b8';
  }

  getPriceChangeColor(oldPrice: number, newPrice: number): string {
    const change = newPrice - oldPrice;
    if (change > 10) return '#10b981';
    if (change > 0) return '#4ade80';
    if (change > -10) return '#f59e0b';
    return '#ef4444';
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.6) return '#f59e0b';
    return '#ef4444';
  }

  formatCurrency(value: number): string {
    return '€' + value.toFixed(2);
  }

  formatChange(oldPrice: number, newPrice: number): string {
    const change = newPrice - oldPrice;
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
  }

  formatPercent(value: number): string {
    return value.toFixed(1) + '%';
  }

  formatTimestamp(timestamp: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s ago`;
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  }

  formatStrategyName(strategy: string): string {
    return strategy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  toggleLive(): void {
    this.isLive = !this.isLive;
  }

  clearUpdates(): void {
    this.priceUpdates = [];
    this.totalUpdates = 0;
    this.strategyCounts = {};
    this.initMetrics();
  }
}
