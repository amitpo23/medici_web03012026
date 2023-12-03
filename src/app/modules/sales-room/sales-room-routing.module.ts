import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SalesRoomComponent } from './sales-room.component';

const routes: Routes = [{ path: '', component: SalesRoomComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SalesRoomRoutingModule { }
