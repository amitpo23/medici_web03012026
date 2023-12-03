import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/auth/guards/auth.guard';

const routes: Routes = [
  {
    path: '', pathMatch: 'full', redirectTo: 'options'
  },
  {
    path: 'auth', loadChildren: () => import('./core/auth/auth.module').then(m => m.AuthModule)
  },
  { path: 'sign-in', pathMatch: 'full', redirectTo: 'auth/sign-in' },
  { path: 'sign-out', pathMatch: 'full', redirectTo: 'auth/sign-out' },
  { path: 'signed-in-redirect', pathMatch: 'full', redirectTo: 'options' },

  { path: 'options', canActivate: [AuthGuard], canActivateChild: [AuthGuard], loadChildren: () => import('./modules/options/options.module').then(m => m.OptionsModule) },
  { path: 'rooms', canActivate: [AuthGuard], canActivateChild: [AuthGuard], loadChildren: () => import('./modules/rooms/rooms.module').then(m => m.RoomsModule) },
  { path: 'sales-room', canActivate: [AuthGuard], canActivateChild: [AuthGuard], loadChildren: () => import('./modules/sales-room/sales-room.module').then(m => m.SalesRoomModule) },
  { path: 'reservation', canActivate: [AuthGuard], canActivateChild: [AuthGuard], loadChildren: () => import('./modules/reservation/reservation.module').then(m => m.ReservationModule) },
  { path: 'search-price', canActivate: [AuthGuard], canActivateChild: [AuthGuard], loadChildren: () => import('./modules/search-price/search-price.module').then(m => m.SearchPriceModule) },
  { path: 'hotels', canActivate: [AuthGuard], canActivateChild: [AuthGuard], loadChildren: () => import('./modules/hotels/hotels.module').then(m => m.HotelsModule) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {

}
