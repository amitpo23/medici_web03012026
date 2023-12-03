import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ReservationRoutingModule } from './reservation-routing.module';
import { ReservationComponent } from './reservation.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MaterialModule } from '../material/material.module';
import { SharedModule } from '../shared/shared.module';
import { ReservationActionRendererComponent } from './reservation-action-renderer/reservation-action-renderer.component';
import { ReservationFormComponent } from './reservation-form/reservation-form.component';
import { ReservationLogFormComponent } from './reservation-log-form/reservation-log-form.component';
import { ReservationLogActionRendererComponent } from './reservation-log-action-renderer/reservation-log-action-renderer.component';
import { ReservationLogComponent } from './reservation-log/reservation-log.component';
import { ReservationCancelComponent } from './reservation-cancel/reservation-cancel.component';
import { ReservationModifyComponent } from './reservation-modify/reservation-modify.component';


@NgModule({
  declarations: [
    ReservationComponent,
    ReservationActionRendererComponent,
    ReservationFormComponent,
    ReservationModifyComponent,
    ReservationCancelComponent,
    ReservationLogComponent,
    ReservationLogFormComponent,
    ReservationLogActionRendererComponent
  ],
  imports: [
    CommonModule,
    ReservationRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    AgGridModule,
    SharedModule
  ]
})
export class ReservationModule { }
