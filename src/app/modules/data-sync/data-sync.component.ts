import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DataSyncService, SyncStatus, SyncHistoryItem, ActiveRoom, DashboardInfo, SyncEndpointConfig } from 'src/app/services/data-sync.service';

@Component({
  selector: 'app-data-sync',
  templateUrl: './data-sync.component.html',
  styleUrls: ['./data-sync.component.scss']
})
export class DataSyncComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  selectedTabIndex = 0;

  // Status
  syncStatus: SyncStatus | null = null;
  isLoadingStatus = false;
  isTriggeringSync = false;

  // History
  syncHistory: SyncHistoryItem[] = [];
  isLoadingHistory = false;
  historyLimit = 20;
  historyDisplayedColumns = ['SnapshotDate', 'TotalBookings', 'TotalRevenue', 'TotalProfit', 'ActiveRooms', 'OccupancyRate'];

  // Active Rooms
  activeRooms: ActiveRoom[] = [];
  isLoadingRooms = false;
  lastRoomUpdate: string | null = null;
  roomDisplayedColumns = ['HotelName', 'RoomType', 'Available', 'Price', 'LastUpdate'];

  // Dashboard Info
  dashboardInfo: DashboardInfo | null = null;
  isLoadingDashboard = false;

  // Config
  endpointConfigs: SyncEndpointConfig[] = [];
  isLoadingConfig = false;

  constructor(
    private dataSyncService: DataSyncService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadStatus();
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTabChange(index: number): void {
    this.selectedTabIndex = index;
    switch (index) {
      case 0:
        this.loadStatus();
        break;
      case 1:
        this.loadHistory();
        break;
      case 2:
        this.loadActiveRooms();
        break;
      case 3:
        this.loadDashboardInfo();
        break;
    }
  }

  loadStatus(): void {
    this.isLoadingStatus = true;
    this.dataSyncService.getStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.syncStatus = data;
          this.isLoadingStatus = false;
        },
        error: (err) => {
          this.snackBar.open('Failed to load sync status: ' + err.message, 'Close', { duration: 5000 });
          this.isLoadingStatus = false;
        }
      });
  }

  triggerSync(): void {
    this.isTriggeringSync = true;
    this.dataSyncService.triggerSync()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.snackBar.open(result.message, 'Close', { duration: 5000 });
          this.isTriggeringSync = false;
          setTimeout(() => this.loadStatus(), 2000);
        },
        error: (err) => {
          this.snackBar.open('Sync trigger failed: ' + err.message, 'Close', { duration: 5000 });
          this.isTriggeringSync = false;
        }
      });
  }

  loadHistory(): void {
    this.isLoadingHistory = true;
    this.dataSyncService.getHistory(this.historyLimit)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.syncHistory = data.history;
          this.isLoadingHistory = false;
        },
        error: (err) => {
          this.snackBar.open('Failed to load sync history', 'Close', { duration: 5000 });
          this.isLoadingHistory = false;
        }
      });
  }

  loadActiveRooms(): void {
    this.isLoadingRooms = true;
    this.dataSyncService.getActiveRooms()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.activeRooms = data.rooms;
          this.lastRoomUpdate = data.lastUpdate;
          this.isLoadingRooms = false;
        },
        error: (err) => {
          this.snackBar.open('Failed to load active rooms', 'Close', { duration: 5000 });
          this.isLoadingRooms = false;
        }
      });
  }

  loadDashboardInfo(): void {
    this.isLoadingDashboard = true;
    this.dataSyncService.getDashboardInfo()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.dashboardInfo = data;
          this.isLoadingDashboard = false;
        },
        error: (err) => {
          this.snackBar.open('Failed to load dashboard info', 'Close', { duration: 5000 });
          this.isLoadingDashboard = false;
        }
      });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'running': return 'status-running';
      case 'idle': return 'status-idle';
      case 'not_initialized': return 'status-warning';
      default: return 'status-unknown';
    }
  }

  formatDate(date: string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  }

  formatCurrency(value: number): string {
    if (value === null || value === undefined) return '$0';
    return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  formatPercent(value: number): string {
    if (value === null || value === undefined) return '0%';
    return value.toFixed(1) + '%';
  }
}
