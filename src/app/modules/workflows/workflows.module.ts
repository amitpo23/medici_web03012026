import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { WorkflowsRoutingModule } from './workflows-routing.module';
import { WorkflowsComponent } from './workflows.component';

@NgModule({
  declarations: [
    WorkflowsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
    WorkflowsRoutingModule
  ]
})
export class WorkflowsModule { }
