import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { DatabaseCatalogRoutingModule } from './database-catalog-routing.module';
import { DatabaseCatalogComponent } from './database-catalog.component';

@NgModule({
  declarations: [DatabaseCatalogComponent],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    DatabaseCatalogRoutingModule
  ]
})
export class DatabaseCatalogModule { }
