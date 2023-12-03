import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LastPriceFilterComponent } from './last-price-filter/last-price-filter.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MaterialModule } from '../material/material.module';
import { ProviderRendererComponent } from './provider-renderer/provider-renderer.component';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';



@NgModule({
  declarations: [
    LastPriceFilterComponent,
    ProviderRendererComponent,
    ConfirmDialogComponent
  ],
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    AgGridModule
  ]
})
export class SharedModule { }
