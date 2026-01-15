import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

// Components
import { AIPredictionComponent } from './ai-prediction.component';
import { OpportunityCardComponent } from './components/opportunity-card/opportunity-card.component';
import { AgentStatusComponent } from './components/agent-status/agent-status.component';
import { MarketAnalysisComponent } from './components/market-analysis/market-analysis.component';
import { DemandForecastComponent } from './components/demand-forecast/demand-forecast.component';

const routes: Routes = [
  { path: '', component: AIPredictionComponent }
];

@NgModule({
  declarations: [
    AIPredictionComponent,
    OpportunityCardComponent,
    AgentStatusComponent,
    MarketAnalysisComponent,
    DemandForecastComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    // Material
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTabsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatExpansionModule,
    MatSliderModule,
    MatButtonToggleModule
  ],
  exports: [
    AIPredictionComponent
  ]
})
export class AIPredictionModule { }
