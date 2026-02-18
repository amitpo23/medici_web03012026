import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RevenueAnalyticsComponent } from './revenue-analytics.component';

const routes: Routes = [{ path: '', component: RevenueAnalyticsComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RevenueAnalyticsRoutingModule { }
