import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReservationComponent } from './reservation.component';
import { ReservationLogComponent } from './reservation-log/reservation-log.component';
import { ReservationCancelComponent } from './reservation-cancel/reservation-cancel.component';
import { ReservationModifyComponent } from './reservation-modify/reservation-modify.component';

const routes: Routes = [
  { path: '', component: ReservationComponent },
  { path: 'cancel', component: ReservationCancelComponent },
  { path: 'modify', component: ReservationModifyComponent },
  { path: 'log', component: ReservationLogComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReservationRoutingModule { }
