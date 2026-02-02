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
import { TopRoomsWidgetComponent } from './components/top-rooms-widget/top-rooms-widget.component';
// Search Intelligence Components (Standalone)
import { SearchOverviewComponent } from './components/search-overview/search-overview.component';
import { SearchTopCitiesComponent } from './components/search-top-cities/search-top-cities.component';
import { SearchTopHotelsComponent } from './components/search-top-hotels/search-top-hotels.component';

@NgModule({
  declarations: [
    DashboardComponent,
    RevenueChartComponent,
    KpiCardsComponent,
    OccupancyTrendComponent,
    TopHotelsComponent,
    WorkerStatusComponent,
    TopRoomsWidgetComponent
  ],
  imports: [
    CommonModule,
    DashboardRoutingModule,
    MaterialModule,
    // Import standalone search components
    SearchOverviewComponent,
    SearchTopCitiesComponent,
    SearchTopHotelsComponent
  ],
  exports: [
    WorkerStatusComponent,
    TopRoomsWidgetComponent
  ]
})
export class DashboardModule { }
