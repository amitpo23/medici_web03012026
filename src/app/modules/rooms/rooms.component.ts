import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, ColumnApi, CellClickedEvent, ColDef, FirstDataRenderedEvent, GridReadyEvent } from 'ag-grid-community';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Observable, Subject, startWith, map, debounceTime } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CockpitCommon } from 'src/app/common';
import { MedHotel } from 'src/app/core/models/med-hotel';
import { environment } from 'src/app/environments/environment';
import { TableCommunicationService } from 'src/app/services/table-communication-service';
import { LastPriceFilterComponent } from '../shared/last-price-filter/last-price-filter.component';
import { ProviderRendererComponent } from '../shared/provider-renderer/provider-renderer.component';
import { BoolActionRendererComponent } from './bool-action-renderer/bool-action-renderer.component';
import { ErrorSnackbarComponent } from './error-snackbar/error-snackbar.component';

@Component({
  selector: 'app-rooms',
  templateUrl: './rooms.component.html',
  styleUrls: ['./rooms.component.scss']
})
export class RoomsComponent implements OnInit, OnDestroy {
  horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  verticalPosition: MatSnackBarVerticalPosition = 'bottom';
  durationInSeconds = 5;
  composeForm: FormGroup;
  lastPriceFilter: LastPriceFilterOption | undefined;
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  gridApi!: GridApi<any>;
  columnApi!: ColumnApi;
  paginationPageSize = 50;
  baseUrl = environment.baseUrl;
  columnDefs: ColDef[] = [];
  defaultColDef: ColDef = {
    flex: 1,
    minWidth: 90,
    filter: true,
    sortable: true,
    floatingFilter: true,
    resizable: true,
  };
  public rowData$!: Observable<any[]>;
  
  // Auto-refresh functionality
  private refreshInterval: any;
  private readonly REFRESH_INTERVAL_MS = 30000; // 30 seconds
  public autoRefreshEnabled = true;
  public lastRefreshTime: Date = new Date();
  public nextRefreshIn = 30;

  clearInput() {
    this.composeForm.controls['hotel'].setValue('');
    this.applyFilter('');
  }

  applyFilter(data: any) {
    const instance = this.gridApi.getFilterInstance('name');

    instance!.setModel({
      type: 'contains',
      filter: data.name
    });
    this.gridApi.onFilterChanged();
  }

  resetAllFilters() {
    this.gridApi.setFilterModel(null);
    this.gridApi.onFilterChanged();
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.columnApi = params.columnApi;

    this.refreshData(false);
    this.startAutoRefresh();
  }
  
  refreshData(force: boolean) {
    this.rowData$ = this.http.get<any[]>(this.baseUrl + 'Book/Bookings?force=' + force);
    this.lastRefreshTime = new Date();
    this.nextRefreshIn = this.REFRESH_INTERVAL_MS / 1000;
  }
  
  /**
   * Start auto-refresh timer
   */
  startAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // Countdown timer (update every second)
    setInterval(() => {
      if (this.autoRefreshEnabled && this.nextRefreshIn > 0) {
        this.nextRefreshIn--;
      }
    }, 1000);

    // Actual refresh timer
    this.refreshInterval = setInterval(() => {
      if (this.autoRefreshEnabled) {
        console.log('[Rooms] Auto-refreshing data...');
        this.refreshData(false);
      }
    }, this.REFRESH_INTERVAL_MS);
  }

  /**
   * Toggle auto-refresh
   */
  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
    }
  }

  /**
   * Manual refresh button
   */
  manualRefresh(): void {
    this.refreshData(true);
  }
  onFirstDataRendered(params: FirstDataRenderedEvent) {
    // this.countStatistics();
  }
  onFilterChanged(params: any) {
    // this.countStatistics();
  }
  onCellClicked(e: CellClickedEvent): void {
    // console.log('cellClicked', e);
  }
  onColumnMoved(params: any) {
    const columnState = JSON.stringify(this.columnApi.getColumnState());
    localStorage.setItem('column_defs_booking', columnState);
  }
  defaultColumnDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'Id',
      headerTooltip: 'Id',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 70,
      pinned: 'left'
    },
    {
      field: 'contentBookingId',
      headerName: 'Content Booking Id',
      headerTooltip: 'Content Booking Id',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
      pinned: 'left'
    },
    {
      field: 'dateInsert',
      headerName: 'Date Insert',
      headerTooltip: 'Date Insert',
      filter: 'agDateColumnFilter',
      valueFormatter: CockpitCommon.dateFormatter,
      filterParams: {
        suppressAndOrCondition: true,
        comparator: CockpitCommon.perfirmDateFilter,
        inRangeInclusive: true,
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
      pinned: 'left'
    },
    {
      field: 'name',
      headerName: 'Hotel Name',
      headerTooltip: 'Hotel Name',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
      pinned: 'left'
    },
    {
      field: 'reservationFullName',
      headerName: 'Guest Name',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
      pinned: 'left'
    },
    {
      field: 'startDate',
      headerName: 'Start Date',
      headerTooltip: 'Start Date',
      filter: 'agDateColumnFilter',
      valueFormatter: CockpitCommon.dateFormatter,
      filterParams: {
        debounceMs: 500,
        suppressAndOrCondition: true,
        inRangeInclusive: true,
        comparator: CockpitCommon.perfirmDateFilter
      },
      maxWidth: 100,
    },
    {
      field: 'endDate',
      headerName: 'End Date',
      headerTooltip: 'End Date',
      filter: 'agDateColumnFilter',
      valueFormatter: CockpitCommon.dateFormatter,
      filterParams: {
        debounceMs: 500,
        suppressAndOrCondition: true,
        inRangeInclusive: true,
        comparator: CockpitCommon.perfirmDateFilter
      },
      maxWidth: 100,
    },
    {
      field: 'board',
      headerName: 'Board',
      headerTooltip: 'Board',
      maxWidth: 100,
    },
    {
      field: 'category',
      headerName: 'Category',
      headerTooltip: 'Category',
      maxWidth: 100,
    },
    {
      field: 'price',
      headerName: 'Buy Price',
      headerTooltip: 'Buy Price',
      valueFormatter: CockpitCommon.priceFormatter,
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
    },
    {
      field: 'pushPrice',
      headerName: 'Push Price',
      headerTooltip: 'Push Price',
      valueFormatter: CockpitCommon.priceFormatter,
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
    },
    {
      field: 'lastPrice',
      headerName: 'Last Price',
      headerTooltip: 'Last Price',
      width: 150,
      minWidth: 150,
      maxWidth: 300,
      cellClass: params => {
        if (params.data.price != params.value) {
          if (params.data.price < params.value) {
            return 'up';
          } else return 'down';
        }

        return '';
      },
      filter: LastPriceFilterComponent,
      cellRenderer: (params: any) => {
        if (params.value) {
          const dateAsString = params.data.dateLastPrice;
          const dateOnly = dateAsString.split('T');
          const dateParts = dateOnly[0].split('-');
          const dateShow = `(${dateParts[2]}/${dateParts[1]}/${dateParts[0]})`;

          const presise = 100;
          // let num = Math.round((params.value + Number.EPSILON) * presise) / presise;
          const num = params.value.toFixed(2);
          const txt = `$${num}`;
          const up = '<span style="color:green"><sub>' + dateShow + '</sub><i class="material-icons">arrow_upward</i></span>';
          const down = '<span style="color:red"><i class="material-icons">arrow_downward</i><sub><span style="color:black">' + dateShow + '</span></sub></span>';

          let result = '';

          if (params.data.price == params.value) {
            result = txt;
          } else {
            if (params.data.price < params.value) {
              result = txt + up;
            }
            else {
              result = txt + down;
            }
          }

          return result;
        }

        return null;
      },
      // valueFormatter: this.lastPriceFormatter,       
    },
    {
      field: 'isActive',
      headerName: 'Status',
      headerTooltip: 'Status',
      maxWidth: 100,
      cellRenderer: (params: any) => {
        if (params.data.isActive) {
          return '<span style="color:green">Active</span>';
        }
        if (params.data.isSold) {
          return '<span style="color:green">Sale</span>';
        }
        return '<span style="color:red">Cancel Error</span>';
      },
    },
    {
      field: 'cancellationTo',
      headerName: 'Cancellation To',
      headerTooltip: 'Cancellation To',
      filter: 'agDateColumnFilter',
      valueFormatter: CockpitCommon.dateFormatter,
      filterParams: {
        suppressAndOrCondition: true,
        comparator: CockpitCommon.perfirmDateFilter,
        buttons: ['apply', 'reset'],
      },
      maxWidth: 100,
    },
    {
      field: 'provider',
      headerName: 'Provider',
      headerTooltip: 'Provider',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
      cellRenderer: ProviderRendererComponent,
    },
    {
      field: 'supplierReference',
      headerName: 'Supplier Reference',
      headerTooltip: 'Supplier Reference',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100
    },
    {
      field: 'action',
      headerName: 'Action',
      headerTooltip: 'Action',
      filter: false,
      cellRenderer: BoolActionRendererComponent,
      width: 150,
      pinned: 'right'
    }
  ];

  resetColumns() {
    this.columnDefs = this.defaultColumnDefs;
    localStorage.removeItem('column_defs_booking');
  }

  onBtnExport() {
    this.gridApi.exportDataAsExcel();
  }

  onPageSizeChanged() {
    const value = (document.getElementById('page-size') as HTMLInputElement)
      .value;
    this.gridApi.paginationSetPageSize(Number(value));
  }

  private _unsubscribeAll: Subject<void> = new Subject<void>();

  displayFn(hotel: MedHotel): string {
    const currentName = hotel && hotel.name ? hotel.name : '';
    return currentName;
  }

  openSnackBar(message: string, close: boolean = true) {
    if (close) {
      this._snackBar.open(message, 'Close', {
        horizontalPosition: this.horizontalPosition,
        verticalPosition: this.verticalPosition,
        duration: this.durationInSeconds * 1000,
        panelClass: ['success-snackbar']
      });
    }
    else {
      this._snackBar.open(message, 'Close', {
        horizontalPosition: this.horizontalPosition,
        verticalPosition: this.verticalPosition,
        panelClass: ['success-snackbar']
      });
    }
  }
  /**
   * Constructor
   */
  constructor(
    private _changeDetectorRef: ChangeDetectorRef,
    private deviceService: DeviceDetectorService,
    // private _fuseNavigationService: FuseNavigationService,
    private http: HttpClient,
    private comm: TableCommunicationService,
    private _snackBar: MatSnackBar,
    private _formBuilder: FormBuilder,
  ) {
    this.composeForm = this._formBuilder.group({
      hotel: ['']
    });
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Lifecycle hooks
  // -----------------------------------------------------------------------------------------------------
  filteredOptions!: Observable<MedHotel[]>;
  options: MedHotel[] = [];

  lastValueOptions: LastPriceFilterOption[] = [
    { value: 'all', viewValue: 'All' },
    { value: 'up', viewValue: 'Up' },
    { value: 'down', viewValue: 'Down' },
  ];

  private _filter(value: string): MedHotel[] {
    const filterValue = value.toLowerCase();
    if (this.options == null) return [];
    return this.options.filter(option => option.name.toLowerCase().includes(filterValue));
  }
  onLastPriceFilterChange(event: any) {
    // console.log(event);
    const instance = this.gridApi.getFilterInstance('lastPrice');
    instance!.setModel({
      type: 'contains',
      filter: 'arrow_upward'
    });
    this.gridApi.onFilterChanged();
  }
  /**
   * On init
   */
  ngOnInit(): void {
    this.lastPriceFilter = this.lastValueOptions[0];

    this.http.get<MedHotel[]>(this.baseUrl + 'Opportunity/Hotels')
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((data: MedHotel[]) => {
        this.options = data;
      });

    this.filteredOptions = this.composeForm.controls['hotel'].valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      map(value => {
        if (typeof value !== 'string') {
          this.applyFilter(value);
        }
        const name = typeof value === 'string' ? value : value?.name;
        return name ? this._filter(name as string) : this.options.slice();
      }),
    );

    const isMobile = this.deviceService.isMobile();
    if (!isMobile) {
      // const navigation = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');

      // if (navigation) {
      //   // Toggle the opened status
      //   navigation.toggle();
      // }
    }
    let columnState = null;
    try {
      columnState = JSON.parse(localStorage.getItem('column_defs_booking') || 'null');
    } catch {
      localStorage.removeItem('column_defs_booking');
    }

    if (columnState) {
      columnState.forEach((element: any) => {
        const clmn = this.defaultColumnDefs.find(i => i.field == element.colId);
        if (clmn) {
          this.columnDefs.push(clmn);
        }
      });
    }
    else {
      this.columnDefs = this.defaultColumnDefs;
    }

    this.comm.comm.pipe(takeUntil(this._unsubscribeAll)).subscribe((i: any) => {
      if (i != '') {
        // console.log(i);
        const split = i.split(':');
        const op = split[0];
        if (op == 'update_new_version') {
          const msg = 'Please Refresh you browser for new version: ' + split[1];
          this.openSnackBar(msg, false);
        }
        if (op == 'set_status_booking_error') {
          this.openSnackBar('Error Set status Cancel', false);
          return;
        }
        if (op == 'delete_booking_error') {
          // show error notification
          const objId = split[1];
          this._snackBar.openFromComponent(ErrorSnackbarComponent, {
            data: objId
          });
          // this.openSnackBar('Error Cancel Room', false);

          var itemsToUpdate: any = [];
          this.gridApi.forEachNodeAfterFilterAndSort(function (rowNode, index) {
            const data = rowNode.data;
            if (data.id == objId) {
              data.isActive = false;
              data.isSold = false;
              itemsToUpdate.push(data);
            }

          });
          if (itemsToUpdate.length > 0) {
            // delete old
            var res = this.gridApi.applyTransaction({ update: itemsToUpdate });
          }
          return;
        }
        if (op == 'update_booking_error') {
          // show error notification
          this.openSnackBar('Error Update Room');
          return;
        }
        if (op == 'set_status_cancel') {
          const idToUpdate = split[1];
          var itemsToUpdate: any = [];
          this.gridApi.forEachNodeAfterFilterAndSort(function (rowNode, index) {
            const data = rowNode.data;
            if (data.id == idToUpdate) {
              data.status = false;
              itemsToUpdate.push(data);
            }

          });
          if (itemsToUpdate.length > 0) {
            // delete old
            var res = this.gridApi.applyTransaction({ remove: itemsToUpdate });
          }
          // show notificaion    
          this.openSnackBar('Set status cancel SUCCESS');
        }
        if (op == 'delete_booking') {
          let strObj = split[1];
          strObj = strObj.split('@').join(':');
          const objToDelete = JSON.parse(strObj);

          const idToUpdate = objToDelete.bookingId;
          var itemsToUpdate: any = [];
          this.gridApi.forEachNodeAfterFilterAndSort(function (rowNode, index) {
            const data = rowNode.data;
            if (data.id == idToUpdate) {
              data.status = false;
              itemsToUpdate.push(data);
            }

          });
          if (itemsToUpdate.length > 0) {
            // delete old
            var res = this.gridApi.applyTransaction({ remove: itemsToUpdate });
          }
          // show notificaion
          const arrResults = objToDelete.result;
          let msg = '';
          for (let index = 0; index < arrResults.length; index++) {
            const element = arrResults[index];
            const txt = `${element.name}: ${element.result}\n`;
            msg = msg + txt;
          }
          this.openSnackBar(msg, false);
        }
        if (op == 'update_booking') {
          let strObj = split[1];
          strObj = strObj.split('@').join(':');
          const objToUpdate = JSON.parse(strObj);
          const arrToUpdate = objToUpdate.booking;
          var itemsToUpdate: any = [];
          this.gridApi.forEachNodeAfterFilterAndSort(function (rowNode, index) {
            const data = rowNode.data;

            for (let index = 0; index < arrToUpdate.length; index++) {
              const element = arrToUpdate[index];
              if (data.id == element.preBookId) {
                data.pushPrice = element.pushPrice;
                itemsToUpdate.push(data);
              }
            }

          });
          if (itemsToUpdate.length > 0) {
            var res = this.gridApi.applyTransaction({ update: itemsToUpdate });
          }
          // show notificaion
          const arrResults = objToUpdate.result;
          let msg = '';
          for (let index = 0; index < arrResults.length; index++) {
            const element = arrResults[index];
            const txt = `${element.name}: ${element.result}\n`;
            msg = msg + txt;
          }
          this.openSnackBar(msg, false);
        }
      }
    }
    );
  }

  /**
   * On destroy
   */
  ngOnDestroy(): void {
    // Clear auto-refresh interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    this._unsubscribeAll.next();
    this._unsubscribeAll.complete();
  }

}
interface LastPriceFilterOption {
  value: string;
  viewValue: string;
}