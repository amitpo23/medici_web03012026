import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { AnalyticsRoutingModule } from './analytics-routing.module';
import { AnalyticsComponent } from './analytics.component';
import { BuySellAlertsComponent } from './components/buy-sell-alerts/buy-sell-alerts.component';
import { PricePredictorComponent } from './components/price-predictor/price-predictor.component';
import { RoiCalculatorComponent } from './components/roi-calculator/roi-calculator.component';
// Week 6 - Advanced ML Components (Feb 2026)
import { CompetitorTrackerComponent } from './components/competitor-tracker/competitor-tracker.component';
import { MlPricePredictorComponent } from './components/ml-price-predictor/ml-price-predictor.component';
import { RevenueOptimizerComponent } from './components/revenue-optimizer/revenue-optimizer.component';

@NgModule({
  declarations: [
    AnalyticsComponent,
    PricePredictorComponent,
    BuySellAlertsComponent,
    RoiCalculatorComponent,
    // Week 6 ML Components
    MlPricePredictorComponent,
    CompetitorTrackerComponent,
    RevenueOptimizerComponent
  ],
  imports: [
    CommonModule,
    AnalyticsRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class AnalyticsModule { }
