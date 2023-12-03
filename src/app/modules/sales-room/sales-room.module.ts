import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SalesRoomRoutingModule } from './sales-room-routing.module';
import { SalesRoomComponent } from './sales-room.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MaterialModule } from '../material/material.module';
import { SharedModule } from '../shared/shared.module';
import { SalesRoomActionRendererComponent } from './sales-room-action-renderer/sales-room-action-renderer.component';
import { SalesRoomFormComponent } from './sales-room-form/sales-room-form.component';


@NgModule({
  declarations: [
    SalesRoomComponent,
    SalesRoomActionRendererComponent,
    SalesRoomFormComponent
  ],
  imports: [
    CommonModule,
    SalesRoomRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    AgGridModule,
    SharedModule
  ]
})
export class SalesRoomModule { }
