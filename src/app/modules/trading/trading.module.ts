import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// Material imports
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

// Components
import { BuyConfirmationDialogComponent } from './buy-confirmation-dialog/buy-confirmation-dialog.component';
import { InventoryManagementComponent } from './inventory-management/inventory-management.component';
import { SearchAndBuyComponent } from './search-and-buy/search-and-buy.component';
import { TradingDashboardComponent } from './trading-dashboard/trading-dashboard.component';

const routes: Routes = [
  {
    path: '',
    component: TradingDashboardComponent,
    children: [
      { path: '', redirectTo: 'search', pathMatch: 'full' },
      { path: 'search', component: SearchAndBuyComponent },
      { path: 'inventory', component: InventoryManagementComponent }
    ]
  }
];

@NgModule({
  declarations: [
    TradingDashboardComponent,
    SearchAndBuyComponent,
    InventoryManagementComponent,
    BuyConfirmationDialogComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    
    // Material modules
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatBadgeModule,
    MatTabsModule
  ]
})
export class TradingModule { }
