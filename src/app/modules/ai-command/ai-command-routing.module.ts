import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AICommandComponent } from './ai-command.component';

const routes: Routes = [
  {
    path: '',
    component: AICommandComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AICommandRoutingModule { }
