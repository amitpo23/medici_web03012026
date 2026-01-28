import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
// AuthGuard temporarily disabled
// import { AuthGuard } from './core/auth/guards/auth.guard';

const routes: Routes = [
  {
    path: '', pathMatch: 'full', redirectTo: 'dashboard'
  },
  {
    path: 'auth', loadChildren: () => import('./core/auth/auth.module').then(m => m.AuthModule)
  },
  { path: 'sign-in', pathMatch: 'full', redirectTo: 'auth/sign-in' },
  { path: 'sign-out', pathMatch: 'full', redirectTo: 'auth/sign-out' },
  { path: 'signed-in-redirect', pathMatch: 'full', redirectTo: 'dashboard' },

  // AuthGuard removed for development - direct access enabled
  { path: 'dashboard', loadChildren: () => import('./modules/dashboard/dashboard.module').then(m => m.DashboardModule) },
  { path: 'analytics', loadChildren: () => import('./modules/analytics/analytics.module').then(m => m.AnalyticsModule) },
  { path: 'ai-prediction', loadChildren: () => import('./modules/ai-prediction/ai-prediction.module').then(m => m.AIPredictionModule) },
  { path: 'ai-chat', loadChildren: () => import('./modules/ai-database-chat/ai-database-chat.module').then(m => m.AIDatabaseChatModule) },
  { path: 'options', loadChildren: () => import('./modules/options/options.module').then(m => m.OptionsModule) },
  { path: 'rooms', loadChildren: () => import('./modules/rooms/rooms.module').then(m => m.RoomsModule) },
  { path: 'sales-room', loadChildren: () => import('./modules/sales-room/sales-room.module').then(m => m.SalesRoomModule) },
  { path: 'reservation', loadChildren: () => import('./modules/reservation/reservation.module').then(m => m.ReservationModule) },
  { path: 'search-price', loadChildren: () => import('./modules/search-price/search-price.module').then(m => m.SearchPriceModule) },
  { path: 'hotels', loadChildren: () => import('./modules/hotels/hotels.module').then(m => m.HotelsModule) }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {

}
