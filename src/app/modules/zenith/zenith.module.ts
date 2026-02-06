import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// Material imports
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

// Components - Push Management
import { ZenithDashboardComponent } from './zenith-dashboard/zenith-dashboard.component';
import { PushManagementComponent } from './push-management/push-management.component';
import { QueueManagementComponent } from './queue-management/queue-management.component';
import { PushHistoryComponent } from './push-history/push-history.component';
import { PushConfirmDialogComponent } from './push-confirm-dialog/push-confirm-dialog.component';

// Components - Sales Office
import { SalesOverviewComponent } from './sales-overview/sales-overview.component';
import { IncomingReservationsComponent } from './incoming-reservations/incoming-reservations.component';
import { ActivityLogComponent } from './activity-log/activity-log.component';
import { CancellationsComponent } from './cancellations/cancellations.component';

const routes: Routes = [
  {
    path: '',
    component: ZenithDashboardComponent,
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      // Push Management
      { path: 'overview', component: PushManagementComponent },
      { path: 'queue', component: QueueManagementComponent },
      { path: 'history', component: PushHistoryComponent },
      // Sales Office
      { path: 'sales-overview', component: SalesOverviewComponent },
      { path: 'reservations', component: IncomingReservationsComponent },
      { path: 'activity-log', component: ActivityLogComponent },
      { path: 'cancellations', component: CancellationsComponent }
    ]
  }
];

@NgModule({
  declarations: [
    // Push Management
    ZenithDashboardComponent,
    PushManagementComponent,
    QueueManagementComponent,
    PushHistoryComponent,
    PushConfirmDialogComponent,
    // Sales Office
    SalesOverviewComponent,
    IncomingReservationsComponent,
    ActivityLogComponent,
    CancellationsComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),

    // Material modules
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
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
    MatProgressBarModule,
    MatDialogModule,
    MatSnackBarModule,
    MatBadgeModule,
    MatTabsModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatMenuModule,
    MatRadioModule
  ]
})
export class ZenithModule { }
