import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataExplorerService, TableInfo, ComprehensiveStats } from '../../services/data-explorer.service';

@Component({
  selector: 'app-data-explorer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="data-explorer-container">
      <header class="explorer-header">
        <h1>Data Explorer</h1>
        <p class="subtitle">Browse all 70 database tables with millions of records</p>
      </header>

      <!-- Stats Overview -->
      <section class="stats-overview" *ngIf="comprehensiveStats">
        <div class="stat-card primary">
          <mat-icon>hotel</mat-icon>
          <div class="stat-content">
            <span class="stat-value">{{ comprehensiveStats.TotalHotels | number }}</span>
            <span class="stat-label">Hotels</span>
          </div>
        </div>
        <div class="stat-card success">
          <mat-icon>book_online</mat-icon>
          <div class="stat-content">
            <span class="stat-value">{{ comprehensiveStats.TotalBookings | number }}</span>
            <span class="stat-label">Bookings</span>
          </div>
        </div>
        <div class="stat-card warning">
          <mat-icon>trending_up</mat-icon>
          <div class="stat-content">
            <span class="stat-value">{{ comprehensiveStats.TotalOpportunities | number }}</span>
            <span class="stat-label">Opportunities</span>
          </div>
        </div>
        <div class="stat-card info">
          <mat-icon>place</mat-icon>
          <div class="stat-content">
            <span class="stat-value">{{ comprehensiveStats.TotalDestinations | number }}</span>
            <span class="stat-label">Destinations</span>
          </div>
        </div>
        <div class="stat-card">
          <mat-icon>receipt</mat-icon>
          <div class="stat-content">
            <span class="stat-value">{{ comprehensiveStats.TotalReservations | number }}</span>
            <span class="stat-label">Reservations</span>
          </div>
        </div>
        <div class="stat-card">
          <mat-icon>queue</mat-icon>
          <div class="stat-content">
            <span class="stat-value">{{ comprehensiveStats.QueueItems | number }}</span>
            <span class="stat-label">Queue Items</span>
          </div>
        </div>
      </section>

      <mat-tab-group>
        <!-- Tables Tab -->
        <mat-tab label="All Tables ({{ tables.length }})">
          <div class="tab-content">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search tables</mat-label>
              <input matInput [(ngModel)]="tableSearch" placeholder="Type to filter...">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <div class="tables-grid">
              <mat-card *ngFor="let table of filteredTables"
                        class="table-card"
                        [class.selected]="selectedTable === table.TableName"
                        (click)="selectTable(table.TableName)">
                <div class="table-info">
                  <span class="table-name">{{ table.TableName }}</span>
                  <span class="table-schema">{{ table.SchemaName }}</span>
                </div>
                <div class="table-stats">
                  <span class="row-count">{{ table.RowCount | number }} rows</span>
                  <span class="size">{{ table.SizeMB | number:'1.1-1' }} MB</span>
                </div>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <!-- Data Browser Tab -->
        <mat-tab label="Data Browser">
          <div class="tab-content">
            <div class="browser-controls">
              <mat-form-field appearance="outline">
                <mat-label>Select Table</mat-label>
                <mat-select [(ngModel)]="selectedTable" (selectionChange)="loadTableData()">
                  <mat-option *ngFor="let table of accessibleTables" [value]="table">
                    {{ table }}
                  </mat-option>
                </mat-select>
              </mat-form-field>
              <button mat-raised-button color="primary" (click)="loadTableData()" [disabled]="!selectedTable">
                <mat-icon>refresh</mat-icon> Load Data
              </button>
            </div>

            <div *ngIf="loading" class="loading-spinner">
              <mat-spinner diameter="40"></mat-spinner>
              <span>Loading data...</span>
            </div>

            <div *ngIf="tableData.length > 0 && !loading" class="data-table-container">
              <table mat-table [dataSource]="tableData" class="data-table">
                <ng-container *ngFor="let col of tableColumns" [matColumnDef]="col">
                  <th mat-header-cell *matHeaderCellDef>{{ col }}</th>
                  <td mat-cell *matCellDef="let row">{{ formatCell(row[col]) }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="tableColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: tableColumns;"></tr>
              </table>

              <mat-paginator
                [length]="totalRecords"
                [pageSize]="pageSize"
                [pageSizeOptions]="[25, 50, 100]"
                (page)="onPageChange($event)">
              </mat-paginator>
            </div>
          </div>
        </mat-tab>

        <!-- Quick Stats Tab -->
        <mat-tab label="Quick Stats">
          <div class="tab-content stats-grid" *ngIf="comprehensiveStats">
            <mat-card class="stat-detail-card">
              <mat-card-header>
                <mat-icon mat-card-avatar>book_online</mat-icon>
                <mat-card-title>Bookings</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="stat-row">
                  <span>Total:</span>
                  <strong>{{ comprehensiveStats.TotalBookings | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>Active:</span>
                  <strong>{{ comprehensiveStats.ActiveBookings | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>Sold:</span>
                  <strong>{{ comprehensiveStats.SoldBookings | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>Total Value:</span>
                  <strong>\${{ comprehensiveStats.TotalBookingValue | number:'1.2-2' }}</strong>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stat-detail-card">
              <mat-card-header>
                <mat-icon mat-card-avatar>trending_up</mat-icon>
                <mat-card-title>Opportunities</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="stat-row">
                  <span>Total:</span>
                  <strong>{{ comprehensiveStats.TotalOpportunities | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>Active:</span>
                  <strong>{{ comprehensiveStats.ActiveOpportunities | number }}</strong>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stat-detail-card">
              <mat-card-header>
                <mat-icon mat-card-avatar>hotel</mat-icon>
                <mat-card-title>Hotels</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="stat-row">
                  <span>Total:</span>
                  <strong>{{ comprehensiveStats.TotalHotels | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>Active:</span>
                  <strong>{{ comprehensiveStats.ActiveHotels | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>Destination Links:</span>
                  <strong>{{ comprehensiveStats.TotalDestinationHotels | number }}</strong>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stat-detail-card">
              <mat-card-header>
                <mat-icon mat-card-avatar>receipt</mat-icon>
                <mat-card-title>Reservations</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="stat-row">
                  <span>Total:</span>
                  <strong>{{ comprehensiveStats.TotalReservations | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>Pre-Bookings:</span>
                  <strong>{{ comprehensiveStats.TotalPreBookings | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>Cancellations:</span>
                  <strong>{{ comprehensiveStats.TotalCancellations | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>Total Value:</span>
                  <strong>\${{ comprehensiveStats.TotalReservationValue | number:'1.2-2' }}</strong>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stat-detail-card">
              <mat-card-header>
                <mat-icon mat-card-avatar>settings</mat-icon>
                <mat-card-title>System</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="stat-row">
                  <span>Queue Items:</span>
                  <strong>{{ comprehensiveStats.QueueItems | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>Pending Pushes:</span>
                  <strong>{{ comprehensiveStats.PendingPushes | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>Price Updates:</span>
                  <strong>{{ comprehensiveStats.PriceUpdates | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>System Logs:</span>
                  <strong>{{ comprehensiveStats.SystemLogs | number }}</strong>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="stat-detail-card">
              <mat-card-header>
                <mat-icon mat-card-avatar>store</mat-icon>
                <mat-card-title>Sales Office</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="stat-row">
                  <span>Orders:</span>
                  <strong>{{ comprehensiveStats.SalesOrders | number }}</strong>
                </div>
                <div class="stat-row">
                  <span>BackOffice Options:</span>
                  <strong>{{ comprehensiveStats.BackOfficeOptions | number }}</strong>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .data-explorer-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .explorer-header {
      margin-bottom: 24px;
    }

    .explorer-header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 500;
    }

    .subtitle {
      color: #666;
      margin: 4px 0 0;
    }

    .stats-overview {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .stat-card mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #666;
    }

    .stat-card.primary mat-icon { color: #1976d2; }
    .stat-card.success mat-icon { color: #4caf50; }
    .stat-card.warning mat-icon { color: #ff9800; }
    .stat-card.info mat-icon { color: #2196f3; }

    .stat-content {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      line-height: 1.2;
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }

    .tab-content {
      padding: 24px 0;
    }

    .search-field {
      width: 100%;
      max-width: 400px;
      margin-bottom: 16px;
    }

    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }

    .table-card {
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .table-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .table-card.selected {
      border: 2px solid #1976d2;
    }

    .table-info {
      display: flex;
      flex-direction: column;
      margin-bottom: 8px;
    }

    .table-name {
      font-weight: 500;
      font-size: 14px;
    }

    .table-schema {
      font-size: 12px;
      color: #666;
    }

    .table-stats {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #888;
    }

    .row-count {
      color: #1976d2;
      font-weight: 500;
    }

    .browser-controls {
      display: flex;
      gap: 16px;
      align-items: center;
      margin-bottom: 24px;
    }

    .browser-controls mat-form-field {
      width: 300px;
    }

    .loading-spinner {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 40px;
      justify-content: center;
    }

    .data-table-container {
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      min-width: 800px;
    }

    .data-table th {
      background: #f5f5f5;
      font-weight: 600;
    }

    .data-table td {
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }

    .stat-detail-card mat-card-header {
      margin-bottom: 16px;
    }

    .stat-detail-card mat-icon[mat-card-avatar] {
      background: #e3f2fd;
      color: #1976d2;
      padding: 8px;
      border-radius: 50%;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }

    .stat-row:last-child {
      border-bottom: none;
    }
  `]
})
export class DataExplorerComponent implements OnInit {
  tables: TableInfo[] = [];
  comprehensiveStats: ComprehensiveStats | null = null;
  tableSearch = '';
  selectedTable = '';
  tableData: unknown[] = [];
  tableColumns: string[] = [];
  totalRecords = 0;
  pageSize = 50;
  currentPage = 0;
  loading = false;

  accessibleTables = [
    'MED_Book', 'MED_PreBook', 'MED_Opportunities', 'Med_Hotels', 'Med_Reservation',
    'Destinations', 'DestinationsHotels', 'BackOfficeOPT', 'MED_CancelBook',
    'MED_Log', 'MED_Board', 'MED_RoomCategory', 'Queue', 'Med_HotelsToPush',
    'RoomPriceUpdateLog', 'MED_OpportunitiesLog', 'Med_ReservationCancel',
    'SalesOffice.Orders', 'SalesOffice.Details', 'UserSettings', 'Med_Users'
  ];

  get filteredTables(): TableInfo[] {
    if (!this.tableSearch) return this.tables;
    const search = this.tableSearch.toLowerCase();
    return this.tables.filter(t =>
      t.TableName.toLowerCase().includes(search) ||
      t.SchemaName.toLowerCase().includes(search)
    );
  }

  constructor(private dataExplorer: DataExplorerService) {}

  ngOnInit(): void {
    this.loadTables();
    this.loadStats();
  }

  loadTables(): void {
    this.dataExplorer.getAllTables().subscribe({
      next: (res) => {
        this.tables = res.tables;
      },
      error: (err) => console.error('Failed to load tables', err)
    });
  }

  loadStats(): void {
    this.dataExplorer.getComprehensiveStats().subscribe({
      next: (res) => {
        this.comprehensiveStats = res.stats;
      },
      error: (err) => console.error('Failed to load stats', err)
    });
  }

  selectTable(tableName: string): void {
    this.selectedTable = tableName;
    this.loadTableData();
  }

  loadTableData(): void {
    if (!this.selectedTable) return;

    this.loading = true;
    this.dataExplorer.queryTable(this.selectedTable, {
      limit: this.pageSize,
      offset: this.currentPage * this.pageSize
    }).subscribe({
      next: (res) => {
        this.tableData = res.data;
        this.totalRecords = res.pagination.total;
        if (res.data.length > 0) {
          this.tableColumns = Object.keys(res.data[0] as object);
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load table data', err);
        this.loading = false;
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTableData();
  }

  formatCell(value: unknown): string {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value).substring(0, 50);
    if (typeof value === 'string' && value.length > 50) return value.substring(0, 50) + '...';
    return String(value);
  }
}
