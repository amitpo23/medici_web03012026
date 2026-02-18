import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { MaterialModule } from '../material/material.module';
import { AzureInfrastructureRoutingModule } from './azure-infrastructure-routing.module';
import { AzureInfrastructureComponent } from './azure-infrastructure.component';

@NgModule({
  declarations: [
    AzureInfrastructureComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    BaseChartDirective,
    AzureInfrastructureRoutingModule
  ]
})
export class AzureInfrastructureModule { }
