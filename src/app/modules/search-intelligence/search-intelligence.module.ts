import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { SearchIntelligenceRoutingModule } from './search-intelligence-routing.module';
import { SearchIntelligenceComponent } from './search-intelligence.component';

@NgModule({
  declarations: [
    SearchIntelligenceComponent
  ],
  imports: [
    CommonModule,
    SearchIntelligenceRoutingModule,
    MaterialModule,
    FormsModule
  ]
})
export class SearchIntelligenceModule { }
