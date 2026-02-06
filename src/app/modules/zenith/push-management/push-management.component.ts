import { SelectionModel } from '@angular/cdk/collections';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ZenithService, OpportunityForPush } from '../../../services/zenith.service';
import { PushConfirmDialogComponent } from '../push-confirm-dialog/push-confirm-dialog.component';

@Component({
  selector: 'app-push-management',
  template: `
    <div class="push-management">
      <!-- Filters Section -->
      <mat-card class="filters-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>filter_list</mat-icon>
            Select Opportunities to Push
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="filterForm" class="filter-form">
            <mat-form-field appearance="outline">
              <mat-label>Date From</mat-label>
              <input matInput [matDatepicker]="dateFromPicker" formControlName="dateFrom">
              <mat-datepicker-toggle matSuffix [for]="dateFromPicker"></mat-datepicker-toggle>
              <mat-datepicker #dateFromPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Date To</mat-label>
              <input matInput [matDatepicker]="dateToPicker" formControlName="dateTo">
              <mat-datepicker-toggle matSuffix [for]="dateToPicker"></mat-datepicker-toggle>
              <mat-datepicker #dateToPicker></mat-datepicker>
            </mat-form-field>

            <mat-slide-toggle formControlName="onlyUnpushed" color="primary">
              Only Unpushed
            </mat-slide-toggle>

            <button mat-flat-button color="primary" (click)="loadOpportunities()">
              <mat-icon>search</mat-icon>
              Search
            </button>
          </form>
        </mat-card-content>
      </mat-card>

      <!-- Actions Bar -->
      <div class="actions-bar" *ngIf="selection.hasValue()">
        <div class="selection-info">
          <mat-icon>check_circle</mat-icon>
          <span>{{ selection.selected.length }} opportunities selected</span>
        </div>
        <div class="action-buttons">
          <button mat-stroked-button color="primary" (click)="pushSelected('publish')" [disabled]="isPushing">
            <mat-icon>publish</mat-icon>
            Publish Selected
          </button>
          <button mat-stroked-button color="accent" (click)="pushSelected('update')" [disabled]="isPushing">
            <mat-icon>update</mat-icon>
            Update Rates
          </button>
          <button mat-stroked-button color="warn" (click)="pushSelected('close')" [disabled]="isPushing">
            <mat-icon>block</mat-icon>
            Close Availability
          </button>
        </div>
      </div>

      <!-- Opportunities Table -->
      <mat-card class="table-card">
        <mat-card-content>
          <div class="table-loading" *ngIf="isLoading">
            <mat-spinner diameter="40"></mat-spinner>
            <span>Loading opportunities...</span>
          </div>

          <div class="table-container" *ngIf="!isLoading">
            <table mat-table [dataSource]="dataSource" matSort class="opportunities-table">
              <!-- Checkbox Column -->
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef>
                  <mat-checkbox (change)="$event ? toggleAllRows() : null"
                    [checked]="selection.hasValue() && isAllSelected()"
                    [indeterminate]="selection.hasValue() && !isAllSelected()">
                  </mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let row">
                  <mat-checkbox (click)="$event.stopPropagation()"
                    (change)="$event ? selection.toggle(row) : null"
                    [checked]="selection.isSelected(row)"
                    [disabled]="!row.HasZenithMapping">
                  </mat-checkbox>
                </td>
              </ng-container>

              <!-- Hotel Name -->
              <ng-container matColumnDef="HotelName">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Hotel</th>
                <td mat-cell *matCellDef="let row">
                  <div class="hotel-info">
                    <span class="hotel-name">{{ row.HotelName }}</span>
                    <span class="hotel-codes" *ngIf="row.ZenithHotelCode">
                      Code: {{ row.ZenithHotelCode }}
                    </span>
                  </div>
                </td>
              </ng-container>

              <!-- Dates -->
              <ng-container matColumnDef="DateFrom">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Check-in</th>
                <td mat-cell *matCellDef="let row">{{ row.DateFrom | date:'MMM d, y' }}</td>
              </ng-container>

              <ng-container matColumnDef="DateTo">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Check-out</th>
                <td mat-cell *matCellDef="let row">{{ row.DateTo | date:'MMM d, y' }}</td>
              </ng-container>

              <!-- Prices -->
              <ng-container matColumnDef="BuyPrice">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Buy Price</th>
                <td mat-cell *matCellDef="let row" class="price buy-price">
                  {{ row.BuyPrice | currency:'EUR' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="PushPrice">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Push Price</th>
                <td mat-cell *matCellDef="let row" class="price push-price">
                  {{ row.PushPrice | currency:'EUR' }}
                </td>
              </ng-container>

              <!-- Margin -->
              <ng-container matColumnDef="Margin">
                <th mat-header-cell *matHeaderCellDef>Margin</th>
                <td mat-cell *matCellDef="let row" class="margin">
                  <span [class.positive]="row.PushPrice - row.BuyPrice > 0">
                    {{ row.PushPrice - row.BuyPrice | currency:'EUR' }}
                  </span>
                </td>
              </ng-container>

              <!-- Status -->
              <ng-container matColumnDef="Status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip *ngIf="row.IsPush" color="primary" selected>Pushed</mat-chip>
                  <mat-chip *ngIf="!row.IsPush && row.HasZenithMapping">Ready</mat-chip>
                  <mat-chip *ngIf="!row.HasZenithMapping" color="warn" selected>No Mapping</mat-chip>
                </td>
              </ng-container>

              <!-- Meal Plan -->
              <ng-container matColumnDef="MealPlan">
                <th mat-header-cell *matHeaderCellDef>Meal Plan</th>
                <td mat-cell *matCellDef="let row">
                  <mat-chip>{{ row.MealPlan || 'RO' }}</mat-chip>
                </td>
              </ng-container>

              <!-- Actions -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-icon-button [matMenuTriggerFor]="menu"
                    [disabled]="!row.HasZenithMapping || isPushing">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #menu="matMenu">
                    <button mat-menu-item (click)="pushSingle(row, 'publish')">
                      <mat-icon>publish</mat-icon>
                      <span>Publish</span>
                    </button>
                    <button mat-menu-item (click)="pushSingle(row, 'update')">
                      <mat-icon>update</mat-icon>
                      <span>Update Rate</span>
                    </button>
                    <button mat-menu-item (click)="pushSingle(row, 'close')">
                      <mat-icon>block</mat-icon>
                      <span>Close Availability</span>
                    </button>
                  </mat-menu>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                [class.no-mapping]="!row.HasZenithMapping"
                [class.selected]="selection.isSelected(row)">
              </tr>

              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell" colspan="10" style="text-align: center; padding: 40px;">
                  <mat-icon style="font-size: 48px; width: 48px; height: 48px; color: #ccc;">inbox</mat-icon>
                  <p style="color: #666;">No opportunities found. Adjust your filters and try again.</p>
                </td>
              </tr>
            </table>

            <mat-paginator [pageSizeOptions]="[10, 25, 50, 100]" [pageSize]="25" showFirstLastButtons>
            </mat-paginator>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .push-management {
      padding: 24px;
    }

    .filters-card {
      margin-bottom: 16px;
    }

    .filters-card mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
    }

    .filter-form {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      margin-top: 16px;
    }

    .filter-form mat-form-field {
      width: 180px;
    }

    .actions-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #e3f2fd;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .selection-info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1565c0;
      font-weight: 500;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    .table-card {
      overflow: hidden;
    }

    .table-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: #666;
    }

    .table-loading span {
      margin-top: 16px;
    }

    .table-container {
      overflow-x: auto;
    }

    .opportunities-table {
      width: 100%;
    }

    .hotel-info {
      display: flex;
      flex-direction: column;
    }

    .hotel-name {
      font-weight: 500;
    }

    .hotel-codes {
      font-size: 11px;
      color: #666;
    }

    .price {
      font-weight: 500;
    }

    .buy-price {
      color: #f57c00;
    }

    .push-price {
      color: #1976d2;
    }

    .margin .positive {
      color: #4caf50;
      font-weight: 600;
    }

    tr.no-mapping {
      opacity: 0.6;
      background: #fafafa;
    }

    tr.selected {
      background: #e3f2fd !important;
    }

    @media (max-width: 768px) {
      .filter-form {
        flex-direction: column;
        align-items: stretch;
      }

      .filter-form mat-form-field {
        width: 100%;
      }

      .actions-bar {
        flex-direction: column;
        gap: 12px;
      }

      .action-buttons {
        flex-wrap: wrap;
        justify-content: center;
      }
    }
  `]
})
export class PushManagementComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = [
    'select', 'HotelName', 'DateFrom', 'DateTo', 'BuyPrice', 'PushPrice', 'Margin', 'Status', 'MealPlan', 'actions'
  ];

  dataSource = new MatTableDataSource<OpportunityForPush>([]);
  selection = new SelectionModel<OpportunityForPush>(true, []);
  filterForm: FormGroup;
  isLoading = false;
  isPushing = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private destroy$ = new Subject<void>();

  constructor(
    private zenithService: ZenithService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.filterForm = this.fb.group({
      dateFrom: [new Date()],
      dateTo: [this.addDays(new Date(), 30)],
      onlyUnpushed: [true]
    });
  }

  ngOnInit(): void {
    this.loadOpportunities();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  loadOpportunities(): void {
    this.isLoading = true;
    this.selection.clear();

    const filters = {
      dateFrom: this.zenithService.formatDate(this.filterForm.value.dateFrom),
      dateTo: this.zenithService.formatDate(this.filterForm.value.dateTo),
      onlyUnpushed: this.filterForm.value.onlyUnpushed,
      limit: 500
    };

    this.zenithService.getOpportunitiesForPush(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.dataSource.data = response.opportunities || [];
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load opportunities', err);
          this.isLoading = false;
          this.snackBar.open('Failed to load opportunities', 'Close', { duration: 3000 });
        }
      });
  }

  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.filter(row => row.HasZenithMapping).length;
    return numSelected === numRows;
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.dataSource.data
        .filter(row => row.HasZenithMapping)
        .forEach(row => this.selection.select(row));
    }
  }

  pushSelected(action: 'publish' | 'update' | 'close'): void {
    const selectedIds = this.selection.selected.map(opp => opp.OpportunityId);

    const dialogRef = this.dialog.open(PushConfirmDialogComponent, {
      width: '450px',
      data: {
        action,
        count: selectedIds.length,
        opportunities: this.selection.selected
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.confirmed) {
        this.executePush(selectedIds, action, result.overrides);
      }
    });
  }

  pushSingle(opportunity: OpportunityForPush, action: 'publish' | 'update' | 'close'): void {
    const dialogRef = this.dialog.open(PushConfirmDialogComponent, {
      width: '450px',
      data: {
        action,
        count: 1,
        opportunities: [opportunity]
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.confirmed) {
        this.executePush([opportunity.OpportunityId], action, result.overrides);
      }
    });
  }

  executePush(opportunityIds: number[], action: 'publish' | 'update' | 'close', overrides?: Record<string, unknown>): void {
    this.isPushing = true;

    this.zenithService.pushBatch({
      opportunityIds,
      action,
      overrides
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isPushing = false;
          this.selection.clear();

          const message = `Pushed ${result.summary.successful}/${result.summary.total} opportunities. ` +
            (result.summary.failed > 0 ? `${result.summary.failed} failed.` : '');

          this.snackBar.open(message, 'Close', {
            duration: 5000,
            panelClass: result.summary.failed === 0 ? 'success-snackbar' : 'warning-snackbar'
          });

          this.loadOpportunities();
        },
        error: (err) => {
          this.isPushing = false;
          console.error('Push failed', err);
          this.snackBar.open('Push operation failed. Please try again.', 'Close', { duration: 5000 });
        }
      });
  }
}
