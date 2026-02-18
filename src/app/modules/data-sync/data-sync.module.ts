import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { DataSyncRoutingModule } from './data-sync-routing.module';
import { DataSyncComponent } from './data-sync.component';

@NgModule({
  declarations: [
    DataSyncComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    DataSyncRoutingModule
  ]
})
export class DataSyncModule { }
