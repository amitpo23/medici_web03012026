import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { MaterialModule } from '../material/material.module';
import { ProfitLossReportComponent } from './profit-loss-report/profit-loss-report.component';
import { ReportsRoutingModule } from './reports-routing.module';
import { ReportsComponent } from './reports.component';

@NgModule({
  declarations: [
    ReportsComponent,
    ProfitLossReportComponent
  ],
  imports: [
    CommonModule,
    ReportsRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    BaseChartDirective
  ]
})
export class ReportsModule { }
