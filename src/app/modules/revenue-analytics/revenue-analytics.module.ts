import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { RevenueAnalyticsRoutingModule } from './revenue-analytics-routing.module';
import { RevenueAnalyticsComponent } from './revenue-analytics.component';

@NgModule({
  declarations: [RevenueAnalyticsComponent],
  imports: [CommonModule, FormsModule, MaterialModule, RevenueAnalyticsRoutingModule]
})
export class RevenueAnalyticsModule { }
