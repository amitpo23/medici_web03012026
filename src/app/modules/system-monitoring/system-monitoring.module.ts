import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from '../material/material.module';

// Import standalone components
import { SystemMonitoringOverviewComponent } from './overview/overview.component';
import { LogsViewerComponent } from '../../components/logs-viewer/logs-viewer.component';

const routes: Routes = [
  {
    path: '',
    component: SystemMonitoringOverviewComponent
  },
  {
    path: 'logs',
    component: LogsViewerComponent
  }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    SystemMonitoringOverviewComponent,
    LogsViewerComponent,
    RouterModule.forChild(routes)
  ]
})
export class SystemMonitoringModule { }
