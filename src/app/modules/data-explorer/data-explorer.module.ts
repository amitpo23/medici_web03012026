import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { DataExplorerRoutingModule } from './data-explorer-routing.module';
import { DataExplorerComponent } from './data-explorer.component';

@NgModule({
  declarations: [
    DataExplorerComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    DataExplorerRoutingModule
  ]
})
export class DataExplorerModule { }
