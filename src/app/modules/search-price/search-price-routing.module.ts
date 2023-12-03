import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SearchPriceComponent } from './search-price.component';

const routes: Routes = [{ path: '', component: SearchPriceComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SearchPriceRoutingModule { }
