import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LogsDiagnosticsComponent } from './logs-diagnostics.component';

const routes: Routes = [
  {
    path: '',
    component: LogsDiagnosticsComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LogsDiagnosticsRoutingModule { }
