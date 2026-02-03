import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/auth/guards/auth.guard';

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

  // Protected routes - AuthGuard ensures user is authenticated
  { path: 'dashboard', loadChildren: () => import('./modules/dashboard/dashboard.module').then(m => m.DashboardModule), canActivate: [AuthGuard] },
  { path: 'analytics', loadChildren: () => import('./modules/analytics/analytics.module').then(m => m.AnalyticsModule), canActivate: [AuthGuard] },
  { path: 'ai-prediction', loadChildren: () => import('./modules/ai-prediction/ai-prediction.module').then(m => m.AIPredictionModule), canActivate: [AuthGuard] },
  { path: 'ai-chat', loadChildren: () => import('./modules/ai-database-chat/ai-database-chat.module').then(m => m.AIDatabaseChatModule), canActivate: [AuthGuard] },
  { path: 'options', loadChildren: () => import('./modules/options/options.module').then(m => m.OptionsModule), canActivate: [AuthGuard] },
  { path: 'rooms', loadChildren: () => import('./modules/rooms/rooms.module').then(m => m.RoomsModule), canActivate: [AuthGuard] },
  { path: 'sales-room', loadChildren: () => import('./modules/sales-room/sales-room.module').then(m => m.SalesRoomModule), canActivate: [AuthGuard] },
  { path: 'reservation', loadChildren: () => import('./modules/reservation/reservation.module').then(m => m.ReservationModule), canActivate: [AuthGuard] },
  { path: 'search-price', loadChildren: () => import('./modules/search-price/search-price.module').then(m => m.SearchPriceModule), canActivate: [AuthGuard] },
  { path: 'hotels', loadChildren: () => import('./modules/hotels/hotels.module').then(m => m.HotelsModule), canActivate: [AuthGuard] },
  { path: 'reports', loadChildren: () => import('./modules/reports/reports.module').then(m => m.ReportsModule), canActivate: [AuthGuard] },
  { path: 'alerts', loadChildren: () => import('./modules/alerts/alerts.module').then(m => m.AlertsModule), canActivate: [AuthGuard] },
  { path: 'system-admin', loadChildren: () => import('./modules/system-admin/system-admin.module').then(m => m.SystemAdminModule), canActivate: [AuthGuard] },
  
  // 🆕 System Monitoring & Analytics (Tasks 2, 3, 5)
  { path: 'system', loadChildren: () => import('./modules/system-monitoring/system-monitoring.module').then(m => m.SystemMonitoringModule), canActivate: [AuthGuard] },
  
  // 🆕 Trading Workflow - Search, Buy & Inventory Management
  { path: 'trading', loadChildren: () => import('./modules/trading/trading.module').then(m => m.TradingModule), canActivate: [AuthGuard] }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {

}
