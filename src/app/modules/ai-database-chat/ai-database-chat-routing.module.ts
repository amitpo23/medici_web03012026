import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AIDatabaseChatComponent } from './ai-database-chat.component';

const routes: Routes = [
  {
    path: '',
    component: AIDatabaseChatComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AIDatabaseChatRoutingModule { }
