import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MaterialModule } from '../material/material.module';
import { SharedModule } from '../shared/shared.module';
import { PrebookDialogComponent } from './prebook-dialog/prebook-dialog.component';
import { SearchPriceRoutingModule } from './search-price-routing.module';
import { SearchPriceComponent } from './search-price.component';


@NgModule({
  declarations: [
    SearchPriceComponent,
    PrebookDialogComponent
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
