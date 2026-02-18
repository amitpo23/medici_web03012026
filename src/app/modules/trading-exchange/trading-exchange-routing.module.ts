import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TradingExchangeComponent } from './trading-exchange.component';
import { PortfolioDashboardComponent } from './components/portfolio-dashboard/portfolio-dashboard.component';
import { OrdersPageComponent } from './components/orders-page/orders-page.component';

const routes: Routes = [
  {
    path: '',
    component: TradingExchangeComponent
  },
  {
    path: 'portfolio',
    component: PortfolioDashboardComponent
  },
  {
    path: 'orders',
    component: OrdersPageComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TradingExchangeRoutingModule { }
