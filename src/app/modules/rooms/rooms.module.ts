import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RoomsRoutingModule } from './rooms-routing.module';
import { RoomsComponent } from './rooms.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { MaterialModule } from '../material/material.module';
import { SharedModule } from '../shared/shared.module';
import { ActiveRoomFormComponent } from './active-room-form/active-room-form.component';
import { BoolActionRendererComponent } from './bool-action-renderer/bool-action-renderer.component';
import { ErrorSnackbarComponent } from './error-snackbar/error-snackbar.component';
import { CancelBookErrorFormComponent } from './cancel-book-error-form/cancel-book-error-form.component';
import { CancelRoomComponent } from './cancel-room/cancel-room.component';
import { CancelRoomActionRendererComponent } from './cancel-room-action-renderer/cancel-room-action-renderer.component';
import { CancelRoomFormComponent } from './cancel-room-form/cancel-room-form.component';
import { BookErrorsComponent } from './book-errors/book-errors.component';
import { CancelBookErrorsComponent } from './cancel-book-errors/cancel-book-errors.component';


@NgModule({
  declarations: [
    RoomsComponent,
    ActiveRoomFormComponent,
    BoolActionRendererComponent,
    ErrorSnackbarComponent,
    CancelRoomComponent,
    CancelRoomFormComponent,
    CancelRoomActionRendererComponent,
    CancelBookErrorFormComponent,
    BookErrorsComponent,
    CancelBookErrorsComponent
  ],
  imports: [
    CommonModule,
    RoomsRoutingModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    AgGridModule,
    SharedModule
  ]
})
export class RoomsModule { }
