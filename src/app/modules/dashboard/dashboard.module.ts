import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { DashboardComponent } from './dashboard.component';
import { MaterialModule } from '../material/material.module';
import { RevenueChartComponent } from './components/revenue-chart/revenue-chart.component';
import { KpiCardsComponent } from './components/kpi-cards/kpi-cards.component';
import { OccupancyTrendComponent } from './components/occupancy-trend/occupancy-trend.component';
import { TopHotelsComponent } from './components/top-hotels/top-hotels.component';
import { WorkerStatusComponent } from './components/worker-status/worker-status.component';

@NgModule({
  declarations: [
    DashboardComponent,
    RevenueChartComponent,
    KpiCardsComponent,
    OccupancyTrendComponent,
    TopHotelsComponent,
    WorkerStatusComponent
  ],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    MaterialModule
  ],
  exports: [
    WorkerStatusComponent
  ]
})
export class DashboardModule { }
