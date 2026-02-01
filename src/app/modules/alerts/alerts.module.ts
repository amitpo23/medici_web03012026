import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { AlertsRoutingModule } from './alerts-routing.module';
import { AlertsComponent } from './alerts.component';

@NgModule({
  declarations: [
    AlertsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    AlertsRoutingModule
  ]
})
export class AlertsModule { }
