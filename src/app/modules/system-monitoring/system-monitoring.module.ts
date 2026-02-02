import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';

// Import standalone components
import { MonitoringDashboardComponent } from '../../components/monitoring-dashboard/monitoring-dashboard.component';
import { AlertCenterComponent } from '../../components/alert-center/alert-center.component';
import { RevenueDashboardComponent } from '../../components/revenue-dashboard/revenue-dashboard.component';
import { LogsViewerComponent } from '../../components/logs-viewer/logs-viewer.component';
import { CancellationsOverviewComponent } from '../../components/cancellations-overview/cancellations-overview.component';
import { SystemMonitoringOverviewComponent } from './overview/overview.component';

const routes: Routes = [
  {
    path: '',
    component: SystemMonitoringOverviewComponent
  },
  {
    path: 'monitoring',
    component: MonitoringDashboardComponent
  },
  {
    path: 'alerts',
    component: AlertCenterComponent
  },
  {
    path: 'revenue',
    component: RevenueDashboardComponent
  },
  {
    path: 'logs',
    component: LogsViewerComponent
  },
  {
    path: 'cancellations',
    component: CancellationsOverviewComponent
  }
];

@NgModule({
  declarations: [
    SystemMonitoringOverviewComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    RouterModule.forChild(routes),
    // Import standalone components
    MonitoringDashboardComponent,
    AlertCenterComponent,
    RevenueDashboardComponent,
    LogsViewerComponent,
    CancellationsOverviewComponent
  ]
})
export class SystemMonitoringModule { }
