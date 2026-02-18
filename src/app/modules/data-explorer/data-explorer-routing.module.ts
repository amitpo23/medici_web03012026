import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DataExplorerComponent } from './data-explorer.component';

const routes: Routes = [
  {
    path: '',
    component: DataExplorerComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DataExplorerRoutingModule { }
