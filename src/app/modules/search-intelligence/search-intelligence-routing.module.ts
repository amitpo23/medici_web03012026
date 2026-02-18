import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SearchIntelligenceComponent } from './search-intelligence.component';

const routes: Routes = [{ path: '', component: SearchIntelligenceComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SearchIntelligenceRoutingModule { }
