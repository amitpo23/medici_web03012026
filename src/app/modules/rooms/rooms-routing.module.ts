import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RoomsComponent } from './rooms.component';
import { CancelRoomComponent } from './cancel-room/cancel-room.component';
import { BookErrorsComponent } from './book-errors/book-errors.component';
import { CancelBookErrorsComponent } from './cancel-book-errors/cancel-book-errors.component';

const routes: Routes = [
  { path: '', component: RoomsComponent },
  { path: 'cancel', component: CancelRoomComponent },
  { path: 'bookerrors', component: BookErrorsComponent },
  { path: 'cancelbookerrors', component: CancelBookErrorsComponent }
];


@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RoomsRoutingModule { }
