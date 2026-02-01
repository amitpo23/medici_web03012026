import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// Angular Material
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

// Components
import { AIPredictionComponent } from './ai-prediction.component';
import { AgentStatusComponent } from './components/agent-status/agent-status.component';
import { DemandForecastComponent } from './components/demand-forecast/demand-forecast.component';
import { MarketAnalysisComponent } from './components/market-analysis/market-analysis.component';
import { OpportunityCardComponent } from './components/opportunity-card/opportunity-card.component';
import { ZenithPushDialogComponent } from './components/zenith-push-dialog/zenith-push-dialog.component';

const routes: Routes = [
  { path: '', component: AIPredictionComponent }
];

@NgModule({
  declarations: [
    AIPredictionComponent,
    OpportunityCardComponent,
    AgentStatusComponent,
    MarketAnalysisComponent,
    DemandForecastComponent,
    ZenithPushDialogComponent
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
    MatButtonToggleModule,
    MatDialogModule
  ],
  exports: [
    AIPredictionComponent
  ]
})
export class AIPredictionModule { }
