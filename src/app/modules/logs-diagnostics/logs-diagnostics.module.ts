import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material/material.module';
import { LogsDiagnosticsRoutingModule } from './logs-diagnostics-routing.module';
import { LogsDiagnosticsComponent } from './logs-diagnostics.component';

@NgModule({
  declarations: [LogsDiagnosticsComponent],
  imports: [CommonModule, FormsModule, MaterialModule, LogsDiagnosticsRoutingModule]
})
export class LogsDiagnosticsModule { }
