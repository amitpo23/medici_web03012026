import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdvancedPricingComponent } from './advanced-pricing.component';

const routes: Routes = [{ path: '', component: AdvancedPricingComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdvancedPricingRoutingModule { }
