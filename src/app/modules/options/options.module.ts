import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { OptionsRoutingModule } from './options-routing.module';
import { OptionsComponent } from './options.component';
import { OppLogComponent } from './opp-log/opp-log.component';
import { OppLogFormComponent } from './opp-log-form/opp-log-form.component';
import { OppFormComponent } from './opp-form/opp-form.component';
import { MaterialModule } from '../material/material.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { OppActionRendererComponent } from './opp-action-renderer/opp-action-renderer.component';


@NgModule({
  declarations: [
    OptionsComponent,
    OppLogComponent,
    OppLogFormComponent,
    OppFormComponent,
    OppActionRendererComponent
  ],
  imports: [
    CommonModule,
    OptionsRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    AgGridModule
  ]
})
export class OptionsModule { }
