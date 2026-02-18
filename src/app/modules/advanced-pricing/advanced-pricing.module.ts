import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { AdvancedPricingRoutingModule } from './advanced-pricing-routing.module';
import { AdvancedPricingComponent } from './advanced-pricing.component';

@NgModule({
  declarations: [
    AdvancedPricingComponent
  ],
  imports: [
    CommonModule,
    AdvancedPricingRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class AdvancedPricingModule { }
