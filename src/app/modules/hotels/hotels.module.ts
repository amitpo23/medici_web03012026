import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HotelsRoutingModule } from './hotels-routing.module';
import { HotelsComponent } from './hotels.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MaterialModule } from '../material/material.module';
import { SharedModule } from '../shared/shared.module';


@NgModule({
  declarations: [
    HotelsComponent
  ],
  imports: [
    CommonModule,
    HotelsRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    AgGridModule,
    SharedModule
  ]
})
export class HotelsModule { }
