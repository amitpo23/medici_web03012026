import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from '../material/material.module';

// Import standalone components
import { SystemMonitoringOverviewComponent } from './overview/overview.component';

const routes: Routes = [
  {
    path: '',
    component: SystemMonitoringOverviewComponent
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
    RouterModule.forChild(routes)
  ]
})
export class SystemMonitoringModule { }
