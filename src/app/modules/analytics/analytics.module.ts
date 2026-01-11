import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsRoutingModule } from './analytics-routing.module';
import { AnalyticsComponent } from './analytics.component';
import { MaterialModule } from '../material/material.module';
import { NgChartsModule } from 'ng2-charts';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PricePredictorComponent } from './components/price-predictor/price-predictor.component';
import { BuySellAlertsComponent } from './components/buy-sell-alerts/buy-sell-alerts.component';
import { RoiCalculatorComponent } from './components/roi-calculator/roi-calculator.component';

@NgModule({
  declarations: [
    AnalyticsComponent,
    PricePredictorComponent,
    BuySellAlertsComponent,
    RoiCalculatorComponent
  ],
  imports: [
    CommonModule,
    AnalyticsRoutingModule,
    MaterialModule,
    NgChartsModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class AnalyticsModule { }
