import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SearchPriceRoutingModule } from './search-price-routing.module';
import { SearchPriceComponent } from './search-price.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MaterialModule } from '../material/material.module';
import { SharedModule } from '../shared/shared.module';


@NgModule({
  declarations: [
    SearchPriceComponent
  ],
  imports: [
    CommonModule,
    SearchPriceRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    AgGridModule,
    SharedModule
  ]
})
export class SearchPriceModule { }
