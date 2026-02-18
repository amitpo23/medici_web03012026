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
  
  // 🆕 Trading Workflow - Search, Buy & Inventory Management
  { path: 'trading', loadChildren: () => import('./modules/trading/trading.module').then(m => m.TradingModule), canActivate: [AuthGuard] },

  // 🆕 Smart Room Trading Exchange - Professional Trading Platform
  { path: 'exchange', loadChildren: () => import('./modules/trading-exchange/trading-exchange.module').then(m => m.TradingExchangeModule), canActivate: [AuthGuard] },

  // 🆕 Zenith Distribution Channel - Push Availability & Rates to OTAs
  { path: 'zenith', loadChildren: () => import('./modules/zenith/zenith.module').then(m => m.ZenithModule), canActivate: [AuthGuard] },

  // Azure Infrastructure - Cloud resource monitoring & management
  { path: 'azure-infra', loadChildren: () => import('./modules/azure-infrastructure/azure-infrastructure.module').then(m => m.AzureInfrastructureModule), canActivate: [AuthGuard] },

  // Workflows - Automated Decision Engine
  { path: 'workflows', loadChildren: () => import('./modules/workflows/workflows.module').then(m => m.WorkflowsModule), canActivate: [AuthGuard] },

  // Logs & Diagnostics - System logs, worker health, cancellation errors
  { path: 'logs-diagnostics', loadChildren: () => import('./modules/logs-diagnostics/logs-diagnostics.module').then(m => m.LogsDiagnosticsModule), canActivate: [AuthGuard] },

  // Data Explorer - Browse database tables, schemas, queries
  { path: 'data-explorer', loadChildren: () => import('./modules/data-explorer/data-explorer.module').then(m => m.DataExplorerModule), canActivate: [AuthGuard] },

  // Revenue Analytics - KPIs, P&L, forecasts, trends
  { path: 'revenue-analytics', loadChildren: () => import('./modules/revenue-analytics/revenue-analytics.module').then(m => m.RevenueAnalyticsModule), canActivate: [AuthGuard] },

  // Advanced Pricing - ML pricing, A/B tests, elasticity, competitor tracking
  { path: 'advanced-pricing', loadChildren: () => import('./modules/advanced-pricing/advanced-pricing.module').then(m => m.AdvancedPricingModule), canActivate: [AuthGuard] },

  // Scraper - Competitor price scraping
  { path: 'scraper', loadChildren: () => import('./modules/scraper/scraper.module').then(m => m.ScraperModule), canActivate: [AuthGuard] },

  // Documents - PDF generation for bookings and reservations
  { path: 'documents', loadChildren: () => import('./modules/documents/documents.module').then(m => m.DocumentsModule), canActivate: [AuthGuard] },

  // Search Intelligence - Search analytics, demand forecasting, seasonality
  { path: 'search-intelligence', loadChildren: () => import('./modules/search-intelligence/search-intelligence.module').then(m => m.SearchIntelligenceModule), canActivate: [AuthGuard] },

  // Data Sync - External data synchronization
  { path: 'data-sync', loadChildren: () => import('./modules/data-sync/data-sync.module').then(m => m.DataSyncModule), canActivate: [AuthGuard] },

  // AI Command Center - Natural language system control
  { path: 'ai-command', loadChildren: () => import('./modules/ai-command/ai-command.module').then(m => m.AICommandModule), canActivate: [AuthGuard] },

  // Database Catalog - All tables with descriptions and sample data
  { path: 'db-catalog', loadChildren: () => import('./modules/database-catalog/database-catalog.module').then(m => m.DatabaseCatalogModule), canActivate: [AuthGuard] },

  // Catch-all route - redirect unknown routes to dashboard
  { path: '**', redirectTo: 'dashboard' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {

}
