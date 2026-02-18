import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DatabaseCatalogComponent } from './database-catalog.component';

const routes: Routes = [
  { path: '', component: DatabaseCatalogComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DatabaseCatalogRoutingModule { }
