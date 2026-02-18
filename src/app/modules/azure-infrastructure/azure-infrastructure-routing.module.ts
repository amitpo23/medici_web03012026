import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AzureInfrastructureComponent } from './azure-infrastructure.component';

const routes: Routes = [
  {
    path: '',
    component: AzureInfrastructureComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AzureInfrastructureRoutingModule { }
