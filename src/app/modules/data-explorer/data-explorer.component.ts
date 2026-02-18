import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  BackofficeStats,
  ColumnInfo,
  ComprehensiveStats,
  DataExplorerService,
  Destination,
  HotelToPush,
  LookupData,
  PriceUpdate,
  QueueItem,
  QueueStats,
  SalesOfficeSummary,
  SystemLog,
  TableInfo,
  UserInfo,
} from 'src/app/services/data-explorer.service';

@Component({
  selector: 'app-data-explorer',
  templateUrl: './data-explorer.component.html',
  styleUrls: ['./data-explorer.component.scss']
})
export class DataExplorerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  selectedTabIndex = 0;

  // ============================================
  // Tab 1: Tables Overview
  // ============================================
  tables: TableInfo[] = [];
  filteredTables: TableInfo[] = [];
  tableSearchText = '';
  isLoadingTables = false;

  selectedTableForSchema: TableInfo | null = null;
  schemaColumns: ColumnInfo[] = [];
  isLoadingSchema = false;

  // ============================================
  // Tab 2: Table Query
  // ============================================
  queryTableName = '';
  queryColumns: ColumnInfo[] = [];
  queryDisplayedColumns: string[] = [];
  queryDataSource = new MatTableDataSource<Record<string, unknown>>([]);
  queryTotalRows = 0;
  queryPageSize = 25;
  queryPageIndex = 0;
  queryOrderBy = '';
  queryOrderDir: 'ASC' | 'DESC' = 'DESC';
  isLoadingQuery = false;
  isLoadingQuerySchema = false;
  queryError = '';

  @ViewChild('queryPaginator') queryPaginator!: MatPaginator;
  @ViewChild('querySort') querySort!: MatSort;

  // ============================================
  // Tab 3: Operations
  // ============================================

  // Sales Office
  salesSummary: SalesOfficeSummary | null = null;
  isLoadingSalesSummary = false;
  salesOrders: Record<string, unknown>[] = [];
  salesOrderColumns: string[] = [];
  isLoadingSalesOrders = false;

  // BackOffice
  backofficeStats: BackofficeStats | null = null;
  isLoadingBackoffice = false;

  // Queue
  queueItems: QueueItem[] = [];
  queueStats: QueueStats | null = null;
  isLoadingQueue = false;
  queueStatusFilter = '';

  // Hotels to Push
  hotelsToPush: HotelToPush[] = [];
  isLoadingHotelsToPush = false;

  // Price Updates
  priceUpdates: PriceUpdate[] = [];
  isLoadingPriceUpdates = false;
  priceUpdateHotelIdFilter = '';

  // System Logs
  systemLogs: SystemLog[] = [];
  isLoadingSystemLogs = false;
  systemLogSearch = '';

  // ============================================
  // Tab 4: Lookups
  // ============================================
  lookupData: LookupData | null = null;
  isLoadingLookups = false;
  users: UserInfo[] = [];
  isLoadingUsers = false;
  selectedLookupTab = 0;

  // ============================================
  // Tab 5: Comprehensive Stats
  // ============================================
  comprehensiveStats: ComprehensiveStats | null = null;
  isLoadingStats = false;

  // Destinations (used in Tab 3 Operations)
  destinations: Destination[] = [];
  isLoadingDestinations = false;
  destinationSearch = '';

  constructor(
    private dataExplorerService: DataExplorerService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadTables();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================
  // TAB CHANGE HANDLER
  // ============================================

  onTabChange(index: number): void {
    this.selectedTabIndex = index;

    switch (index) {
      case 0:
        if (this.tables.length === 0) {
          this.loadTables();
        }
        break;
      case 2:
        if (!this.salesSummary) {
          this.loadSalesOfficeSummary();
        }
        if (!this.backofficeStats) {
          this.loadBackofficeStats();
        }
        if (!this.queueStats) {
          this.loadQueue();
        }
        break;
      case 3:
        if (!this.lookupData) {
          this.loadLookups();
        }
        if (this.users.length === 0) {
          this.loadUsers();
        }
        break;
      case 4:
        if (!this.comprehensiveStats) {
          this.loadComprehensiveStats();
        }
        break;
    }
  }

  // ============================================
  // TAB 1: TABLES OVERVIEW
  // ============================================

  loadTables(): void {
    this.isLoadingTables = true;
    this.dataExplorerService.getAllTables()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.tables = response.tables || [];
          this.filterTables();
          this.isLoadingTables = false;
        },
        error: () => {
          this.isLoadingTables = false;
          this.showSnackbar('Failed to load tables', true);
        }
      });
  }

  filterTables(): void {
    if (!this.tableSearchText.trim()) {
      this.filteredTables = [...this.tables];
    } else {
      const search = this.tableSearchText.toLowerCase();
      this.filteredTables = this.tables.filter(
        (t) => t.TableName.toLowerCase().includes(search) || t.SchemaName.toLowerCase().includes(search)
      );
    }
  }

  getTotalRows(): number {
    return this.tables.reduce((sum, t) => sum + (t.RowCount || 0), 0);
  }

  getTotalSize(): number {
    return this.tables.reduce((sum, t) => sum + (t.SizeMB || 0), 0);
  }

  viewSchema(table: TableInfo): void {
    this.selectedTableForSchema = table;
    this.isLoadingSchema = true;
    this.dataExplorerService.getTableSchema(table.TableName)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.schemaColumns = response.columns || [];
          this.isLoadingSchema = false;
        },
        error: () => {
          this.isLoadingSchema = false;
          this.showSnackbar('Failed to load schema for ' + table.TableName, true);
        }
      });
  }

  openTableInQuery(table: TableInfo): void {
    this.queryTableName = table.TableName;
    this.selectedTabIndex = 1;
    this.loadQuerySchema();
  }

  closeSchema(): void {
    this.selectedTableForSchema = null;
    this.schemaColumns = [];
  }

  // ============================================
  // TAB 2: TABLE QUERY
  // ============================================

  loadQuerySchema(): void {
    if (!this.queryTableName) return;

    this.isLoadingQuerySchema = true;
    this.queryColumns = [];
    this.queryDisplayedColumns = [];
    this.queryDataSource.data = [];
    this.queryTotalRows = 0;
    this.queryPageIndex = 0;
    this.queryOrderBy = '';
    this.queryError = '';

    this.dataExplorerService.getTableSchema(this.queryTableName)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.queryColumns = response.columns || [];
          this.queryDisplayedColumns = this.queryColumns.map((c) => c.columnName);
          this.isLoadingQuerySchema = false;
          this.executeQuery();
        },
        error: (err) => {
          this.isLoadingQuerySchema = false;
          this.queryError = 'Failed to load schema: ' + (err.error?.error || err.message);
          this.showSnackbar('Failed to load table schema', true);
        }
      });
  }

  executeQuery(): void {
    if (!this.queryTableName) return;

    this.isLoadingQuery = true;
    this.queryError = '';

    this.dataExplorerService.queryTable(this.queryTableName, {
      limit: this.queryPageSize,
      offset: this.queryPageIndex * this.queryPageSize,
      orderBy: this.queryOrderBy || undefined,
      orderDir: this.queryOrderDir
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.queryDataSource.data = response.data || [];
          this.queryTotalRows = response.pagination?.total || 0;
          this.isLoadingQuery = false;
        },
        error: (err) => {
          this.isLoadingQuery = false;
          this.queryError = err.error?.error || err.message || 'Query failed';
          this.showSnackbar('Query failed: ' + this.queryError, true);
        }
      });
  }

  onQueryPageChange(event: PageEvent): void {
    this.queryPageSize = event.pageSize;
    this.queryPageIndex = event.pageIndex;
    this.executeQuery();
  }

  onQuerySortChange(sort: Sort): void {
    this.queryOrderBy = sort.active;
    this.queryOrderDir = sort.direction === 'asc' ? 'ASC' : 'DESC';
    this.queryPageIndex = 0;
    this.executeQuery();
  }

  onTableSelected(): void {
    this.loadQuerySchema();
  }

  // ============================================
  // TAB 3: OPERATIONS
  // ============================================

  // --- Sales Office ---
  loadSalesOfficeSummary(): void {
    this.isLoadingSalesSummary = true;
    this.dataExplorerService.getSalesOfficeSummary()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.salesSummary = response.summary || null;
          this.isLoadingSalesSummary = false;
        },
        error: () => {
          this.isLoadingSalesSummary = false;
          this.showSnackbar('Failed to load sales office summary', true);
        }
      });
  }

  loadSalesOfficeOrders(): void {
    this.isLoadingSalesOrders = true;
    this.dataExplorerService.getSalesOfficeOrders(50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.salesOrders = response.orders || [];
          if (this.salesOrders.length > 0) {
            this.salesOrderColumns = Object.keys(this.salesOrders[0]);
          }
          this.isLoadingSalesOrders = false;
        },
        error: () => {
          this.isLoadingSalesOrders = false;
          this.showSnackbar('Failed to load sales orders', true);
        }
      });
  }

  // --- BackOffice ---
  loadBackofficeStats(): void {
    this.isLoadingBackoffice = true;
    this.dataExplorerService.getBackofficeStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.backofficeStats = response.stats || null;
          this.isLoadingBackoffice = false;
        },
        error: () => {
          this.isLoadingBackoffice = false;
          this.showSnackbar('Failed to load backoffice stats', true);
        }
      });
  }

  // --- Queue ---
  loadQueue(): void {
    this.isLoadingQueue = true;
    this.dataExplorerService.getQueue(this.queueStatusFilter || undefined, 50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.queueItems = response.queue || [];
          this.queueStats = response.stats || null;
          this.isLoadingQueue = false;
        },
        error: () => {
          this.isLoadingQueue = false;
          this.showSnackbar('Failed to load queue', true);
        }
      });
  }

  // --- Hotels to Push ---
  loadHotelsToPush(): void {
    this.isLoadingHotelsToPush = true;
    this.dataExplorerService.getHotelsToPush(true, 50)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.hotelsToPush = response.hotelsToPush || [];
          this.isLoadingHotelsToPush = false;
        },
        error: () => {
          this.isLoadingHotelsToPush = false;
          this.showSnackbar('Failed to load hotels to push', true);
        }
      });
  }

  // --- Price Updates ---
  loadPriceUpdates(): void {
    this.isLoadingPriceUpdates = true;
    const hotelId = this.priceUpdateHotelIdFilter ? parseInt(this.priceUpdateHotelIdFilter, 10) : undefined;
    this.dataExplorerService.getPriceUpdates(hotelId, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.priceUpdates = response.priceUpdates || [];
          this.isLoadingPriceUpdates = false;
        },
        error: () => {
          this.isLoadingPriceUpdates = false;
          this.showSnackbar('Failed to load price updates', true);
        }
      });
  }

  // --- System Logs ---
  loadSystemLogs(): void {
    this.isLoadingSystemLogs = true;
    this.dataExplorerService.getSystemLogs(this.systemLogSearch || undefined, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.systemLogs = response.logs || [];
          this.isLoadingSystemLogs = false;
        },
        error: () => {
          this.isLoadingSystemLogs = false;
          this.showSnackbar('Failed to load system logs', true);
        }
      });
  }

  // --- Destinations ---
  loadDestinations(): void {
    this.isLoadingDestinations = true;
    this.dataExplorerService.getDestinations(this.destinationSearch || undefined, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.destinations = response.destinations || [];
          this.isLoadingDestinations = false;
        },
        error: () => {
          this.isLoadingDestinations = false;
          this.showSnackbar('Failed to load destinations', true);
        }
      });
  }

  // ============================================
  // TAB 4: LOOKUPS
  // ============================================

  loadLookups(): void {
    this.isLoadingLookups = true;
    this.dataExplorerService.getLookups()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.lookupData = response.lookups || null;
          this.isLoadingLookups = false;
        },
        error: () => {
          this.isLoadingLookups = false;
          this.showSnackbar('Failed to load lookups', true);
        }
      });
  }

  loadUsers(): void {
    this.isLoadingUsers = true;
    this.dataExplorerService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.users = response.users || [];
          this.isLoadingUsers = false;
        },
        error: () => {
          this.isLoadingUsers = false;
          this.showSnackbar('Failed to load users', true);
        }
      });
  }

  // ============================================
  // TAB 5: COMPREHENSIVE STATS
  // ============================================

  loadComprehensiveStats(): void {
    this.isLoadingStats = true;
    this.dataExplorerService.getComprehensiveStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.comprehensiveStats = response.stats || null;
          this.isLoadingStats = false;
        },
        error: () => {
          this.isLoadingStats = false;
          this.showSnackbar('Failed to load comprehensive stats', true);
        }
      });
  }

  getStatEntries(): { label: string; value: number; icon: string; color: string }[] {
    if (!this.comprehensiveStats) return [];
    return [
      { label: 'Total Bookings', value: this.comprehensiveStats.TotalBookings, icon: 'book_online', color: 'text-blue-600' },
      { label: 'Active Bookings', value: this.comprehensiveStats.ActiveBookings, icon: 'check_circle', color: 'text-green-600' },
      { label: 'Sold Bookings', value: this.comprehensiveStats.SoldBookings, icon: 'sell', color: 'text-emerald-600' },
      { label: 'Booking Value', value: this.comprehensiveStats.TotalBookingValue, icon: 'attach_money', color: 'text-green-700' },
      { label: 'Opportunities', value: this.comprehensiveStats.TotalOpportunities, icon: 'lightbulb', color: 'text-amber-600' },
      { label: 'Active Opportunities', value: this.comprehensiveStats.ActiveOpportunities, icon: 'trending_up', color: 'text-orange-600' },
      { label: 'Total Hotels', value: this.comprehensiveStats.TotalHotels, icon: 'hotel', color: 'text-indigo-600' },
      { label: 'Active Hotels', value: this.comprehensiveStats.ActiveHotels, icon: 'domain', color: 'text-purple-600' },
      { label: 'Reservations', value: this.comprehensiveStats.TotalReservations, icon: 'event_available', color: 'text-teal-600' },
      { label: 'Reservation Value', value: this.comprehensiveStats.TotalReservationValue, icon: 'payments', color: 'text-teal-700' },
      { label: 'Pre-Bookings', value: this.comprehensiveStats.TotalPreBookings, icon: 'pending_actions', color: 'text-cyan-600' },
      { label: 'Cancellations', value: this.comprehensiveStats.TotalCancellations, icon: 'cancel', color: 'text-red-600' },
      { label: 'Destinations', value: this.comprehensiveStats.TotalDestinations, icon: 'place', color: 'text-pink-600' },
      { label: 'Destination Hotels', value: this.comprehensiveStats.TotalDestinationHotels, icon: 'map', color: 'text-rose-600' },
      { label: 'Queue Items', value: this.comprehensiveStats.QueueItems, icon: 'queue', color: 'text-violet-600' },
      { label: 'Pending Pushes', value: this.comprehensiveStats.PendingPushes, icon: 'publish', color: 'text-fuchsia-600' },
      { label: 'Price Updates', value: this.comprehensiveStats.PriceUpdates, icon: 'price_change', color: 'text-lime-600' },
      { label: 'BackOffice Options', value: this.comprehensiveStats.BackOfficeOptions, icon: 'settings', color: 'text-slate-600' },
      { label: 'Sales Orders', value: this.comprehensiveStats.SalesOrders, icon: 'shopping_cart', color: 'text-sky-600' },
      { label: 'System Logs', value: this.comprehensiveStats.SystemLogs, icon: 'description', color: 'text-gray-600' },
    ];
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  formatNumber(value: number): string {
    if (value === null || value === undefined) return '0';
    return value.toLocaleString();
  }

  formatSize(sizeMB: number): string {
    if (!sizeMB) return '0 MB';
    if (sizeMB >= 1024) {
      return (sizeMB / 1024).toFixed(2) + ' GB';
    }
    return sizeMB.toFixed(2) + ' MB';
  }

  getCellValue(row: Record<string, unknown>, column: string): string {
    const value = row[column];
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  getQueueStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed': return 'status-completed';
      case 'processing': return 'status-processing';
      case 'pending': return 'status-pending';
      case 'failed': return 'status-failed';
      default: return 'status-unknown';
    }
  }

  refreshAll(): void {
    switch (this.selectedTabIndex) {
      case 0:
        this.loadTables();
        break;
      case 1:
        if (this.queryTableName) {
          this.executeQuery();
        }
        break;
      case 2:
        this.loadSalesOfficeSummary();
        this.loadBackofficeStats();
        this.loadQueue();
        break;
      case 3:
        this.loadLookups();
        this.loadUsers();
        break;
      case 4:
        this.loadComprehensiveStats();
        break;
    }
  }

  private showSnackbar(message: string, isError = false): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: isError ? ['error-snackbar'] : ['success-snackbar']
    });
  }
}
