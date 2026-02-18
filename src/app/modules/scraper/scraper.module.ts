import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { ScraperRoutingModule } from './scraper-routing.module';
import { ScraperComponent } from './scraper.component';

@NgModule({
  declarations: [
    ScraperComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    ScraperRoutingModule
  ]
})
export class ScraperModule { }
