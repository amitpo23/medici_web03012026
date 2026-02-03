import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../../environments/environment';

interface MLPrediction {
  optimalPrice: number;
  confidence: number;
  priceRange: {
    min: number;
    max: number;
    recommended: number;
  };
  expectedConversion: number;
  expectedProfit: number;
  expectedRevenue: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  models: {
    base: number;
    elasticity: number;
    competitor: number;
    seasonal: number;
  };
  features?: {
    leadTime: number;
    demand: number;
    competition: number;
    seasonality: number;
  };
}

@Component({
  selector: 'app-ml-price-predictor',
  templateUrl: './ml-price-predictor.component.html',
  styleUrls: ['./ml-price-predictor.component.scss']
})
export class MlPricePredictorComponent implements OnInit, OnDestroy {
  predictionForm: FormGroup;
  prediction: MLPrediction | null = null;
  loading = false;
  error: string | null = null;
  
  private destroy$ = new Subject<void>();
  private baseUrl = environment.baseUrl;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    this.predictionForm = this.fb.group({
      hotelId: [null, Validators.required],
      checkIn: ['', Validators.required],
      checkOut: ['', Validators.required],
      buyPrice: [null, [Validators.required, Validators.min(0)]],
      roomType: ['STANDARD'],
      currentDemand: ['MEDIUM']
    });
  }

  ngOnInit(): void {
    // Set default dates (2 weeks from now for 2 nights)
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 14);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);

    this.predictionForm.patchValue({
      checkIn: checkIn.toISOString().split('T')[0],
      checkOut: checkOut.toISOString().split('T')[0]
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  predictPrice(): void {
    if (this.predictionForm.invalid) {
      Object.keys(this.predictionForm.controls).forEach(key => {
        this.predictionForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading = true;
    this.error = null;
    this.prediction = null;

    const formValue = this.predictionForm.value;

    this.http.post<any>(`${this.baseUrl}/pricing/v2/ml-predict`, formValue)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.prediction) {
            this.prediction = response.prediction;
          } else {
            this.error = response.message || 'Failed to get prediction';
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('ML Prediction error:', err);
          this.error = err.error?.message || 'Failed to connect to prediction service';
          this.loading = false;
        }
      });
  }

  getRiskColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'LOW': return '#4caf50';
      case 'MEDIUM': return '#ff9800';
      case 'HIGH': return '#f44336';
      default: return '#9e9e9e';
    }
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 0.8) return '#4caf50';
    if (confidence >= 0.6) return '#ff9800';
    return '#f44336';
  }

  getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.6) return 'Medium Confidence';
    return 'Low Confidence';
  }

  getModelBreakdown(): Array<{name: string, value: number, color: string}> {
    if (!this.prediction?.models) return [];

    return [
      { name: 'Base Model', value: this.prediction.models.base, color: '#2196F3' },
      { name: 'Elasticity Adj.', value: this.prediction.models.elasticity, color: '#4CAF50' },
      { name: 'Competitor Adj.', value: this.prediction.models.competitor, color: '#FF9800' },
      { name: 'Seasonal Factor', value: this.prediction.models.seasonal, color: '#9C27B0' }
    ];
  }

  getPriceRangePercentages(): { min: number, optimal: number, max: number } {
    if (!this.prediction?.priceRange) return { min: 0, optimal: 50, max: 100 };

    const { min, recommended, max } = this.prediction.priceRange;
    const range = max - min;
    
    return {
      min: 0,
      optimal: ((recommended - min) / range) * 100,
      max: 100
    };
  }

  formatCurrency(value: number): string {
    return '€' + value.toFixed(2);
  }

  formatPercent(value: number): string {
    return (value * 100).toFixed(1) + '%';
  }

  reset(): void {
    this.predictionForm.reset({
      roomType: 'STANDARD',
      currentDemand: 'MEDIUM'
    });
    this.prediction = null;
    this.error = null;
    
    // Reset dates
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 14);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + 2);

    this.predictionForm.patchValue({
      checkIn: checkIn.toISOString().split('T')[0],
      checkOut: checkOut.toISOString().split('T')[0]
    });
  }
}
