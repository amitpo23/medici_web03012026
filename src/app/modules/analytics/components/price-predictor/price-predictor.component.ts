import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { PredictionService, PricePrediction } from '../../services/prediction.service';

@Component({
  selector: 'app-price-predictor',
  templateUrl: './price-predictor.component.html',
  styleUrls: ['./price-predictor.component.scss']
})
export class PricePredictorComponent implements OnInit {
  baseUrl = environment.baseUrl;
  hotels: any[] = [];
  predictionForm: FormGroup;
  prediction: PricePrediction | null = null;
  loading = false;

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private predictionService: PredictionService
  ) {
    this.predictionForm = this.fb.group({
      hotelId: ['', Validators.required],
      dateFrom: ['', Validators.required],
      dateTo: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadHotels();
  }

  loadHotels(): void {
    this.http.get<any[]>(this.baseUrl + 'Opportunity/Hotels').subscribe({
      next: (hotels) => {
        this.hotels = hotels;
      },
      error: (err) => console.error('Error loading hotels:', err)
    });
  }

  predict(): void {
    if (this.predictionForm.invalid) return;

    const { hotelId, dateFrom, dateTo } = this.predictionForm.value;
    this.loading = true;

    this.predictionService.predictPrice(hotelId, dateFrom, dateTo).subscribe({
      next: (prediction) => {
        this.prediction = prediction;
        this.loading = false;
      },
      error: (err) => {
        console.error('Prediction error:', err);
        this.loading = false;
      }
    });
  }

  getTrendIcon(trend: string): string {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  }

  getTrendColor(trend: string): string {
    switch (trend) {
      case 'up': return 'trend-up';
      case 'down': return 'trend-down';
      default: return 'trend-stable';
    }
  }

  getConfidenceColor(confidence: number): string {
    if (confidence >= 80) return 'high-confidence';
    if (confidence >= 60) return 'medium-confidence';
    return 'low-confidence';
  }
}
