import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { SystemAdminRoutingModule } from './system-admin-routing.module';
import { SystemAdminComponent } from './system-admin.component';

@NgModule({
  declarations: [
    SystemAdminComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    SystemAdminRoutingModule
  ]
})
export class SystemAdminModule { }
