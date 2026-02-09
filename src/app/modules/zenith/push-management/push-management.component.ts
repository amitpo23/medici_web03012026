import { SelectionModel } from '@angular/cdk/collections';
import { Component, OnDestroy, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Observable, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import {
  ZenithService,
  OpportunityForPush,
  ZenithMappedHotel,
  DirectPushItem,
  DirectPushResult
} from '../../../services/zenith.service';
import { PushConfirmDialogComponent } from '../push-confirm-dialog/push-confirm-dialog.component';
import { BOARD_OPTIONS, CATEGORY_OPTIONS, getBoardCodeById } from '../../../core/constants/reference-data.constants';

interface PriceEntry {
  hotel: ZenithMappedHotel;
  boardId: number;
  categoryId: number;
  pushPrice: number;
  mealPlan: string;
}

interface CsvRow {
  hotelId: number;
  dateFrom: string;
  dateTo: string;
  boardId: number;
  categoryId: number;
  pushPrice: number;
  pricingMode: string;
  valid: boolean;
  error?: string;
  hotelName?: string;
  zenithCode?: string;
}

@Component({
  selector: 'app-push-management',
  template: `
    <div class="push-management">
      <mat-tab-group [(selectedIndex)]="activeTab" class="push-tabs" animationDuration="200ms">
        <!-- ==================== TAB 1: DIRECT PRICE PUSH ==================== -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>price_change</mat-icon>
            <span class="tab-label">Direct Price Push</span>
          </ng-template>

          <div class="direct-push-container">
            <!-- Hotel Selection -->
            <mat-card class="section-card">
              <mat-card-header>
                <mat-card-title>
                  <mat-icon>hotel</mat-icon>
                  Select Hotels
                </mat-card-title>
                <div class="card-actions">
                  <button mat-stroked-button (click)="csvFileInput.click()" class="csv-btn">
                    <mat-icon>upload_file</mat-icon>
                    Upload CSV
                  </button>
                  <input #csvFileInput type="file" accept=".csv" hidden (change)="onCsvFileSelected($event)">
                  <button mat-stroked-button (click)="downloadPushTemplate()" class="template-btn">
                    <mat-icon>download</mat-icon>
                    Template
                  </button>
                </div>
              </mat-card-header>
              <mat-card-content>
                <!-- Hotel Autocomplete -->
                <mat-form-field appearance="outline" class="hotel-search-field">
                  <mat-label>Search hotel by name, city or ID</mat-label>
                  <input matInput
                    [formControl]="hotelSearchCtrl"
                    [matAutocomplete]="hotelAuto"
                    placeholder="Type to search...">
                  <mat-icon matPrefix>search</mat-icon>
                  <mat-autocomplete #hotelAuto="matAutocomplete"
                    (optionSelected)="onHotelSelected($event.option.value)"
                    [displayWith]="displayHotelFn">
                    <mat-option *ngFor="let hotel of filteredHotels$ | async" [value]="hotel">
                      <div class="hotel-option">
                        <span class="hotel-option-name">{{ hotel.Name }}</span>
                        <span class="hotel-option-meta">{{ hotel.City }} | {{ hotel.Stars }}★ | Code: {{ hotel.ZenithHotelCode }}</span>
                      </div>
                    </mat-option>
                  </mat-autocomplete>
                </mat-form-field>

                <!-- Selected Hotels Chips -->
                <div class="selected-hotels" *ngIf="selectedHotels.length > 0">
                  <mat-chip-set>
                    <mat-chip *ngFor="let hotel of selectedHotels"
                      (removed)="removeHotel(hotel)"
                      class="hotel-chip">
                      {{ hotel.Name }} ({{ hotel.City }})
                      <mat-icon matChipRemove>cancel</mat-icon>
                    </mat-chip>
                  </mat-chip-set>
                  <span class="chip-count">{{ selectedHotels.length }} hotel(s) selected</span>
                </div>

                <!-- CSV Preview -->
                <div *ngIf="csvRows.length > 0" class="csv-preview">
                  <div class="csv-header">
                    <h4>CSV Preview ({{ csvRows.length }} rows)</h4>
                    <button mat-icon-button (click)="csvRows = []" matTooltip="Clear CSV">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                  <table class="csv-table">
                    <thead>
                      <tr>
                        <th>Hotel ID</th>
                        <th>Hotel Name</th>
                        <th>Date From</th>
                        <th>Date To</th>
                        <th>Board</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Mode</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of csvRows" [class.invalid-row]="!row.valid">
                        <td>{{ row.hotelId }}</td>
                        <td>{{ row.hotelName || '...' }}</td>
                        <td>{{ row.dateFrom }}</td>
                        <td>{{ row.dateTo }}</td>
                        <td>{{ getBoardLabel(row.boardId) }}</td>
                        <td>{{ getCategoryLabel(row.categoryId) }}</td>
                        <td>{{ row.pushPrice | currency:'EUR' }}</td>
                        <td>{{ row.pricingMode }}</td>
                        <td>
                          <mat-icon *ngIf="row.valid" class="valid-icon">check_circle</mat-icon>
                          <mat-icon *ngIf="!row.valid" class="invalid-icon"
                            [matTooltip]="row.error || 'Invalid row'">error</mat-icon>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <button mat-flat-button color="primary" (click)="pushCsvRows()"
                    [disabled]="isDirectPushing || !hasValidCsvRows()" class="push-csv-btn">
                    <mat-icon>send</mat-icon>
                    Push {{ getValidCsvCount() }} Valid Rows
                  </button>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Period Selection -->
            <mat-card class="section-card" *ngIf="selectedHotels.length > 0">
              <mat-card-header>
                <mat-card-title>
                  <mat-icon>date_range</mat-icon>
                  Push Period
                </mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="period-form">
                  <mat-form-field appearance="outline">
                    <mat-label>Date From</mat-label>
                    <input matInput [matDatepicker]="pushDateFrom" [formControl]="pushDateFromCtrl">
                    <mat-datepicker-toggle matSuffix [for]="pushDateFrom"></mat-datepicker-toggle>
                    <mat-datepicker #pushDateFrom></mat-datepicker>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Date To</mat-label>
                    <input matInput [matDatepicker]="pushDateTo" [formControl]="pushDateToCtrl">
                    <mat-datepicker-toggle matSuffix [for]="pushDateTo"></mat-datepicker-toggle>
                    <mat-datepicker #pushDateTo></mat-datepicker>
                  </mat-form-field>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Price Grid -->
            <mat-card class="section-card" *ngIf="selectedHotels.length > 0">
              <mat-card-header>
                <mat-card-title>
                  <mat-icon>euro</mat-icon>
                  Price Grid
                </mat-card-title>
                <div class="card-actions">
                  <button mat-stroked-button (click)="addAllCombinations()" class="combo-btn"
                    matTooltip="Add RO and BB rows for all selected hotels">
                    <mat-icon>grid_on</mat-icon>
                    Add All Combos
                  </button>
                  <button mat-stroked-button (click)="addPriceRow()" class="add-row-btn">
                    <mat-icon>add</mat-icon>
                    Add Row
                  </button>
                </div>
              </mat-card-header>
              <mat-card-content>
                <div class="price-grid-info" *ngIf="priceEntries.length === 0">
                  <mat-icon>info</mat-icon>
                  <span>Click "Add All Combos" to generate price rows for selected hotels, or add rows manually.</span>
                </div>

                <table class="price-grid-table" *ngIf="priceEntries.length > 0">
                  <thead>
                    <tr>
                      <th>Hotel</th>
                      <th>Board</th>
                      <th>Room Category</th>
                      <th>Push Price (EUR)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let entry of priceEntries; let i = index">
                      <td>
                        <mat-form-field appearance="outline" class="grid-field">
                          <mat-select [(value)]="entry.hotel" [compareWith]="compareHotels">
                            <mat-option *ngFor="let h of selectedHotels" [value]="h">
                              {{ h.Name }}
                            </mat-option>
                          </mat-select>
                        </mat-form-field>
                      </td>
                      <td>
                        <mat-form-field appearance="outline" class="grid-field">
                          <mat-select [(value)]="entry.boardId" (selectionChange)="onBoardChange(entry)">
                            <mat-option *ngFor="let b of boardOptions" [value]="b.value">
                              {{ b.label }}
                            </mat-option>
                          </mat-select>
                        </mat-form-field>
                      </td>
                      <td>
                        <mat-form-field appearance="outline" class="grid-field">
                          <mat-select [(value)]="entry.categoryId">
                            <mat-option *ngFor="let c of categoryOptions" [value]="c.value">
                              {{ c.label }}
                            </mat-option>
                          </mat-select>
                        </mat-form-field>
                      </td>
                      <td>
                        <mat-form-field appearance="outline" class="grid-field price-field">
                          <input matInput type="number" [(ngModel)]="entry.pushPrice"
                            min="1" step="1" placeholder="0">
                          <span matPrefix class="currency-prefix">€&nbsp;</span>
                        </mat-form-field>
                      </td>
                      <td>
                        <button mat-icon-button color="warn" (click)="removePriceRow(i)"
                          matTooltip="Remove row">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </mat-card-content>
            </mat-card>

            <!-- Pricing Mode & Execute -->
            <mat-card class="section-card" *ngIf="priceEntries.length > 0">
              <mat-card-header>
                <mat-card-title>
                  <mat-icon>tune</mat-icon>
                  Pricing Mode & Execute
                </mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <mat-radio-group [(ngModel)]="pricingMode" class="pricing-mode-group">
                  <mat-radio-button value="static" class="mode-option">
                    <div class="mode-content">
                      <span class="mode-title">Static Price</span>
                      <span class="mode-desc">Push exact price. Stays fixed on Zenith until manually changed.</span>
                    </div>
                  </mat-radio-button>
                  <mat-radio-button value="dynamic" class="mode-option">
                    <div class="mode-content">
                      <span class="mode-title">Dynamic (Sales Order Scanner)</span>
                      <span class="mode-desc">Price monitored by scanner. Auto-updates and processes incoming orders.</span>
                    </div>
                  </mat-radio-button>
                </mat-radio-group>

                <!-- Summary Bar -->
                <div class="push-summary">
                  <div class="summary-item">
                    <mat-icon>format_list_numbered</mat-icon>
                    <span>{{ priceEntries.length }} price entries</span>
                  </div>
                  <div class="summary-item">
                    <mat-icon>hotel</mat-icon>
                    <span>{{ getUniqueHotelCount() }} hotels</span>
                  </div>
                  <div class="summary-item">
                    <mat-icon>date_range</mat-icon>
                    <span>{{ pushDateFromCtrl.value | date:'dd/MM/yyyy' }} - {{ pushDateToCtrl.value | date:'dd/MM/yyyy' }}</span>
                  </div>
                  <div class="summary-item">
                    <mat-icon>tune</mat-icon>
                    <span>{{ pricingMode === 'static' ? 'Static' : 'Dynamic' }}</span>
                  </div>
                </div>

                <!-- Push Button -->
                <div class="push-actions">
                  <button mat-flat-button color="primary" (click)="executeDirectPush()"
                    [disabled]="isDirectPushing || !canPush()" class="execute-push-btn">
                    <mat-icon>send</mat-icon>
                    Push to Zenith
                  </button>
                  <mat-spinner *ngIf="isDirectPushing" diameter="24" class="push-spinner"></mat-spinner>
                </div>

                <!-- Results -->
                <div *ngIf="directPushResults" class="push-results">
                  <div class="results-header" [class.success]="directPushResults.summary.failed === 0"
                    [class.partial]="directPushResults.summary.failed > 0">
                    <mat-icon>{{ directPushResults.summary.failed === 0 ? 'check_circle' : 'warning' }}</mat-icon>
                    <span>
                      Pushed {{ directPushResults.summary.successful }}/{{ directPushResults.summary.total }} successfully
                      <span *ngIf="directPushResults.summary.failed > 0">
                        ({{ directPushResults.summary.failed }} failed)
                      </span>
                    </span>
                  </div>
                  <div class="results-list">
                    <div *ngFor="let r of directPushResults.results" class="result-row"
                      [class.result-success]="r.status === 'success'"
                      [class.result-error]="r.status !== 'success'">
                      <span class="result-hotel">{{ r.hotelName }}</span>
                      <span class="result-status">{{ r.status }}</span>
                      <span *ngIf="r.opportunityId" class="result-opp">Opp #{{ r.opportunityId }}</span>
                    </div>
                    <div *ngFor="let e of directPushResults.errors || []" class="result-row result-error">
                      <span class="result-hotel">Hotel #{{ e.hotelId }}</span>
                      <span class="result-status">{{ e.error }}</span>
                    </div>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- ==================== TAB 2: OPPORTUNITY PUSH (EXISTING) ==================== -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>inventory_2</mat-icon>
            <span class="tab-label">Opportunity Push</span>
          </ng-template>

          <div class="push-management-inner">
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
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .push-management {
      padding: 0;
    }

    .push-tabs ::ng-deep .mat-tab-label {
      min-width: 180px;
      height: 52px;
    }

    .tab-label {
      margin-left: 8px;
      font-weight: 500;
    }

    /* ========== DIRECT PUSH TAB ========== */
    .direct-push-container {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .section-card {
      border-radius: 12px;
      border: 1px solid rgba(99, 102, 241, 0.15);
    }

    .section-card mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 16px 0;
    }

    .section-card mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      margin: 0;
    }

    .card-actions {
      display: flex;
      gap: 8px;
    }

    .csv-btn, .template-btn {
      font-size: 12px;
    }

    .hotel-search-field {
      width: 100%;
      max-width: 500px;
    }

    .hotel-option {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }

    .hotel-option-name {
      font-weight: 500;
    }

    .hotel-option-meta {
      font-size: 11px;
      color: #888;
    }

    .selected-hotels {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .hotel-chip {
      background: rgba(99, 102, 241, 0.1) !important;
      color: #6366f1 !important;
    }

    .chip-count {
      font-size: 12px;
      color: #888;
    }

    /* CSV Preview */
    .csv-preview {
      margin-top: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
    }

    .csv-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .csv-header h4 {
      margin: 0;
      font-size: 14px;
    }

    .csv-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 13px;
    }

    .csv-table th, .csv-table td {
      padding: 6px 10px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }

    .csv-table th {
      background: #f5f5f5;
      font-weight: 600;
      font-size: 12px;
    }

    .invalid-row {
      background: #fff3f3;
    }

    .valid-icon {
      color: #4caf50;
      font-size: 18px;
    }

    .invalid-icon {
      color: #f44336;
      font-size: 18px;
      cursor: help;
    }

    .push-csv-btn {
      margin-top: 12px;
    }

    /* Period Form */
    .period-form {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .period-form mat-form-field {
      width: 200px;
    }

    /* Price Grid */
    .price-grid-info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #888;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .price-grid-table {
      width: 100%;
      border-collapse: collapse;
    }

    .price-grid-table th {
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      color: #555;
      border-bottom: 2px solid #e0e0e0;
    }

    .price-grid-table td {
      padding: 4px 8px;
      vertical-align: middle;
    }

    .grid-field {
      width: 100%;
      font-size: 13px;
    }

    .grid-field ::ng-deep .mat-form-field-wrapper {
      padding-bottom: 0;
      margin: 0;
    }

    .price-field {
      max-width: 150px;
    }

    .currency-prefix {
      color: #888;
    }

    .combo-btn, .add-row-btn {
      font-size: 12px;
    }

    /* Pricing Mode */
    .pricing-mode-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    }

    .mode-option {
      padding: 12px 0;
    }

    .mode-content {
      display: flex;
      flex-direction: column;
      margin-left: 8px;
    }

    .mode-title {
      font-weight: 600;
      font-size: 14px;
    }

    .mode-desc {
      font-size: 12px;
      color: #888;
      margin-top: 2px;
    }

    /* Summary */
    .push-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      padding: 16px;
      background: #f5f5ff;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #555;
    }

    .summary-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #6366f1;
    }

    .push-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .execute-push-btn {
      background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
      color: white !important;
      font-size: 15px;
      padding: 8px 32px;
      height: 44px;
    }

    .push-spinner {
      margin-left: 8px;
    }

    /* Results */
    .push-results {
      margin-top: 16px;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e0e0e0;
    }

    .results-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      font-weight: 600;
    }

    .results-header.success {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .results-header.partial {
      background: #fff3e0;
      color: #e65100;
    }

    .results-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .result-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      border-bottom: 1px solid #f0f0f0;
      font-size: 13px;
    }

    .result-success {
      background: #fafff9;
    }

    .result-error {
      background: #fff9f9;
    }

    .result-hotel {
      flex: 1;
      font-weight: 500;
    }

    .result-status {
      color: #888;
    }

    .result-opp {
      font-size: 11px;
      color: #6366f1;
    }

    /* ========== OPPORTUNITY PUSH TAB (existing styles) ========== */
    .push-management-inner {
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

      .period-form {
        flex-direction: column;
      }

      .period-form mat-form-field {
        width: 100%;
      }

      .push-summary {
        flex-direction: column;
        gap: 8px;
      }
    }
  `]
})
export class PushManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  // Tab state
  activeTab = 0;

  // ==================== DIRECT PUSH STATE ====================
  hotelSearchCtrl = new FormControl('');
  filteredHotels$: Observable<ZenithMappedHotel[]> = of([]);
  selectedHotels: ZenithMappedHotel[] = [];

  pushDateFromCtrl = new FormControl(new Date());
  pushDateToCtrl = new FormControl(this.addDays(new Date(), 30));

  priceEntries: PriceEntry[] = [];
  pricingMode: 'static' | 'dynamic' = 'static';

  boardOptions = BOARD_OPTIONS;
  categoryOptions = CATEGORY_OPTIONS;

  csvRows: CsvRow[] = [];
  isDirectPushing = false;
  directPushResults: DirectPushResult | null = null;

  // ==================== OPPORTUNITY PUSH STATE (existing) ====================
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
    this.setupHotelAutocomplete();
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

  // ==================== DIRECT PUSH METHODS ====================

  setupHotelAutocomplete(): void {
    this.filteredHotels$ = this.hotelSearchCtrl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => {
        const search = typeof value === 'string' ? value : '';
        if (search.length < 2) return of([]);
        return this.zenithService.searchHotelsWithMapping(search, 20).pipe(
          switchMap(res => of(res.hotels || []))
        );
      })
    );
  }

  displayHotelFn(hotel: ZenithMappedHotel): string {
    return '';
  }

  onHotelSelected(hotel: ZenithMappedHotel): void {
    if (!this.selectedHotels.find(h => h.HotelId === hotel.HotelId)) {
      this.selectedHotels.push(hotel);
    }
    this.hotelSearchCtrl.setValue('');
  }

  removeHotel(hotel: ZenithMappedHotel): void {
    this.selectedHotels = this.selectedHotels.filter(h => h.HotelId !== hotel.HotelId);
    this.priceEntries = this.priceEntries.filter(e => e.hotel.HotelId !== hotel.HotelId);
  }

  compareHotels(a: ZenithMappedHotel, b: ZenithMappedHotel): boolean {
    return a && b && a.HotelId === b.HotelId;
  }

  // --- Price Grid ---

  addPriceRow(): void {
    if (this.selectedHotels.length === 0) return;
    this.priceEntries.push({
      hotel: this.selectedHotels[0],
      boardId: 1,
      categoryId: 1,
      pushPrice: 0,
      mealPlan: 'RO'
    });
  }

  addAllCombinations(): void {
    this.priceEntries = [];
    for (const hotel of this.selectedHotels) {
      // Add RO (id=1) and BB (id=2) rows for Standard category
      this.priceEntries.push({
        hotel,
        boardId: 1,
        categoryId: 1,
        pushPrice: 0,
        mealPlan: 'RO'
      });
      this.priceEntries.push({
        hotel,
        boardId: 2,
        categoryId: 1,
        pushPrice: 0,
        mealPlan: 'BB'
      });
    }
  }

  removePriceRow(index: number): void {
    this.priceEntries.splice(index, 1);
  }

  onBoardChange(entry: PriceEntry): void {
    entry.mealPlan = getBoardCodeById(entry.boardId);
  }

  getUniqueHotelCount(): number {
    const ids = new Set(this.priceEntries.map(e => e.hotel.HotelId));
    return ids.size;
  }

  canPush(): boolean {
    return this.priceEntries.length > 0
      && this.priceEntries.every(e => e.pushPrice > 0)
      && !!this.pushDateFromCtrl.value
      && !!this.pushDateToCtrl.value;
  }

  // --- Execute Direct Push ---

  executeDirectPush(): void {
    if (!this.canPush()) return;

    const startDate = this.formatDate(this.pushDateFromCtrl.value!);
    const endDate = this.formatDate(this.pushDateToCtrl.value!);

    const items: DirectPushItem[] = this.priceEntries.map(entry => ({
      hotelId: entry.hotel.HotelId,
      zenithHotelCode: entry.hotel.ZenithHotelCode,
      invTypeCode: entry.hotel.InvTypeCode || 'STD',
      ratePlanCode: entry.hotel.RatePlanCode || 'BAR',
      startDate,
      endDate,
      pushPrice: entry.pushPrice,
      boardId: entry.boardId,
      categoryId: entry.categoryId,
      mealPlan: entry.mealPlan,
      pricingMode: this.pricingMode
    }));

    this.isDirectPushing = true;
    this.directPushResults = null;

    this.zenithService.directPush({ items })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isDirectPushing = false;
          this.directPushResults = result;

          const msg = `Pushed ${result.summary.successful}/${result.summary.total}` +
            (result.summary.failed > 0 ? ` (${result.summary.failed} failed)` : ' successfully');
          this.snackBar.open(msg, 'Close', {
            duration: 5000,
            panelClass: result.summary.failed === 0 ? 'success-snackbar' : 'warning-snackbar'
          });
        },
        error: (err) => {
          this.isDirectPushing = false;
          this.snackBar.open('Push failed: ' + (err.error?.message || 'Network error'), 'Close', { duration: 5000 });
        }
      });
  }

  // --- CSV Upload ---

  onCsvFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      this.parseCsvForPush(text);
      input.value = '';
    };
    reader.readAsText(file);
  }

  parseCsvForPush(text: string): void {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
      this.snackBar.open('CSV must have a header row and at least one data row', 'Close', { duration: 3000 });
      return;
    }

    this.csvRows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 6) {
        this.csvRows.push({
          hotelId: 0, dateFrom: '', dateTo: '', boardId: 0,
          categoryId: 0, pushPrice: 0, pricingMode: '', valid: false,
          error: `Row ${i}: Not enough columns (expected 7, got ${cols.length})`
        });
        continue;
      }

      const hotelId = parseInt(cols[0], 10);
      const dateFrom = cols[1];
      const dateTo = cols[2];
      const boardId = parseInt(cols[3], 10);
      const categoryId = parseInt(cols[4], 10);
      const pushPrice = parseFloat(cols[5]);
      const pricingMode = (cols[6] || 'static').toLowerCase();

      let valid = true;
      let error = '';

      if (!hotelId || hotelId <= 0) { valid = false; error = 'Invalid hotel ID'; }
      if (!dateFrom || !dateTo) { valid = false; error = 'Missing dates'; }
      if (boardId < 1 || boardId > 5) { valid = false; error = 'Board ID must be 1-5'; }
      if (categoryId < 1 || categoryId > 4) { valid = false; error = 'Category ID must be 1-4'; }
      if (!pushPrice || pushPrice <= 0) { valid = false; error = 'Price must be > 0'; }

      this.csvRows.push({
        hotelId, dateFrom, dateTo, boardId,
        categoryId, pushPrice, pricingMode,
        valid, error: valid ? undefined : error
      });
    }

    // Resolve hotel names from API
    const uniqueIds = [...new Set(this.csvRows.map(r => r.hotelId).filter(id => id > 0))];
    for (const id of uniqueIds) {
      this.zenithService.searchHotelsWithMapping(String(id), 1)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            const hotel = res.hotels?.find(h => h.HotelId === id);
            if (hotel) {
              for (const row of this.csvRows) {
                if (row.hotelId === id) {
                  row.hotelName = hotel.Name;
                  row.zenithCode = hotel.ZenithHotelCode;
                }
              }
            } else {
              for (const row of this.csvRows) {
                if (row.hotelId === id) {
                  row.valid = false;
                  row.error = 'Hotel not found or no Zenith mapping';
                }
              }
            }
          },
          error: () => {
            for (const row of this.csvRows) {
              if (row.hotelId === id) {
                row.valid = false;
                row.error = 'Failed to verify hotel';
              }
            }
          }
        });
    }
  }

  downloadPushTemplate(): void {
    const csv = 'hotelId,dateFrom,dateTo,boardId,categoryId,pushPrice,pricingMode\n' +
      '12345,2026-03-01,2026-03-31,1,1,150,static\n' +
      '12345,2026-03-01,2026-03-31,2,1,180,static\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zenith-push-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  hasValidCsvRows(): boolean {
    return this.csvRows.some(r => r.valid);
  }

  getValidCsvCount(): number {
    return this.csvRows.filter(r => r.valid).length;
  }

  pushCsvRows(): void {
    const validRows = this.csvRows.filter(r => r.valid);
    if (validRows.length === 0) return;

    const items: DirectPushItem[] = validRows.map(row => ({
      hotelId: row.hotelId,
      zenithHotelCode: row.zenithCode || '',
      invTypeCode: 'STD',
      ratePlanCode: 'BAR',
      startDate: row.dateFrom,
      endDate: row.dateTo,
      pushPrice: row.pushPrice,
      boardId: row.boardId,
      categoryId: row.categoryId,
      mealPlan: getBoardCodeById(row.boardId),
      pricingMode: row.pricingMode === 'dynamic' ? 'dynamic' : 'static'
    }));

    this.isDirectPushing = true;
    this.directPushResults = null;

    this.zenithService.directPush({ items })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isDirectPushing = false;
          this.directPushResults = result;
          this.snackBar.open(
            `CSV Push: ${result.summary.successful}/${result.summary.total} successful`,
            'Close', { duration: 5000 }
          );
        },
        error: (err) => {
          this.isDirectPushing = false;
          this.snackBar.open('CSV push failed: ' + (err.error?.message || 'Network error'), 'Close', { duration: 5000 });
        }
      });
  }

  getBoardLabel(boardId: number): string {
    const board = BOARD_OPTIONS.find(b => b.value === boardId);
    return board ? board.code : String(boardId);
  }

  getCategoryLabel(categoryId: number): string {
    const cat = CATEGORY_OPTIONS.find(c => c.value === categoryId);
    return cat ? cat.label : String(categoryId);
  }

  // ==================== OPPORTUNITY PUSH METHODS (existing) ====================

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

  // ==================== HELPERS ====================

  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
