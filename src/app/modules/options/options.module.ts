import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MaterialModule } from '../material/material.module';
import { BulkImportDialogComponent } from './bulk-import-dialog/bulk-import-dialog.component';
import { OppActionRendererComponent } from './opp-action-renderer/opp-action-renderer.component';
import { OppFormComponent } from './opp-form/opp-form.component';
import { OppLogFormComponent } from './opp-log-form/opp-log-form.component';
import { OppLogComponent } from './opp-log/opp-log.component';
import { OptionsRoutingModule } from './options-routing.module';
import { OptionsComponent } from './options.component';


@NgModule({
  declarations: [
    OptionsComponent,
    OppLogComponent,
    OppLogFormComponent,
    OppFormComponent,
    OppActionRendererComponent,
    BulkImportDialogComponent
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
