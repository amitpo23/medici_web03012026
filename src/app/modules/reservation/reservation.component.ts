import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition, MatSnackBar } from '@angular/material/snack-bar';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, ColumnApi, ColDef, GridReadyEvent, FirstDataRenderedEvent, CellClickedEvent } from 'ag-grid-community';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Observable, Subject, startWith, map } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CockpitCommon } from 'src/app/common';
import { MedHotel } from 'src/app/core/models/med-hotel';
import { environment } from 'src/app/environments/environment';
import { TableCommunicationService } from 'src/app/services/table-communication-service';
import { ProviderRendererComponent } from '../shared/provider-renderer/provider-renderer.component';
import { ReservationActionRendererComponent } from './reservation-action-renderer/reservation-action-renderer.component';

@Component({
  selector: 'app-reservation',
  templateUrl: './reservation.component.html',
  styleUrls: ['./reservation.component.scss']
})
export class ReservationComponent implements OnInit, OnDestroy {
  private _unsubscribeAll: Subject<void> = new Subject<void>();
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  private gridApi!: GridApi<any>;
  private columnApi!: ColumnApi;
  public paginationPageSize = 50;
  horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  verticalPosition: MatSnackBarVerticalPosition = 'bottom';
  durationInSeconds = 5;
  baseUrl = environment.baseUrl;
  composeForm: FormGroup;
  filteredOptions!: Observable<MedHotel[]>;
  options: MedHotel[] = [];
  public defaultColDef: ColDef = {
    flex: 1,
    minWidth: 150,
    filter: true,
    sortable: true,
    floatingFilter: true,
    resizable: true,
  };
  public rowData$!: Observable<any[]>;
  public columnDefs: ColDef[] = [];
  defaultColumnDefs: ColDef[] = [
    {
      field: 'soldId',
      headerName: 'Sold Id',
      headerTooltip: 'Sold Id',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
      pinned: 'left'
    },
    {
      field: 'contentBookingId',
      headerName: 'Content Booking Id',
      headerTooltip: 'Content Booking Id',
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
      hide: true,
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
        inRangeInclusive: true,
        comparator: CockpitCommon.perfirmDateFilter,
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
      pinned: 'left'
    },
    {
      field: 'hotelName',
      headerName: 'Hotel Name',
      headerTooltip: 'Hotel Name',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
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
        inRangeInclusive: true,
        suppressAndOrCondition: true,
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
        inRangeInclusive: true,
        suppressAndOrCondition: true,
        comparator: CockpitCommon.perfirmDateFilter
      },
      maxWidth: 100,
    },
    {
      field: 'board',
      headerName: 'Board',
      headerTooltip: 'Board',
      maxWidth: 100,
      hide: false,
    },
    {
      field: 'category',
      headerName: 'Category',
      headerTooltip: 'Category',
      maxWidth: 100,
      hide: false,
    },
    {
      field: 'pushPrice',
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
      field: 'salePrice',
      headerName: 'Sale Price',
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
      field: 'profit',
      headerName: 'Profit',
      headerTooltip: 'Profit',
      valueFormatter: this.profitFormatter,
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
    },
    {
      field: 'numOfNight',
      headerName: 'Nights',
      headerTooltip: 'Nights',
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
    },
    {
      field: 'statusChangeName',
      headerName: 'Status Change Name',
      headerTooltip: 'StatusChangeName',
      filter: false,
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      cellRenderer: (params: any) => {
        if (params.data.statusChangeName == 0) {
          return '<span style="color:red">Name not Update</span>';
        }
        if (params.data.statusChangeName == 1) {
          return '<span style="color:gold">Update Name Sent to Hotel</span>';
        }
        if (params.data.statusChangeName == 2) {
          return '<span style="color:green">Name Update Success</span>';
        }

        return '';
      },
      maxWidth: 100,
    },
    {
      field: 'nameUpdate',
      headerName: 'Status Update Name',
      headerTooltip: 'Status Update Name',
      maxWidth: 200,
      editable: false,
      hide: true,
      cellRenderer: (params: any) => {
        if (params.data.nameUpdate != '') {
          return '<span style="color:green">Name Update</span>';
        }
        else {
          return '<span style="color:red">Name not Update</span>';
        }
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
        inRangeInclusive: true,
        comparator: CockpitCommon.perfirmDateFilter,
        buttons: ['apply', 'reset'],
      },
      maxWidth: 100
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
      width: 150,
      hide: false,
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
      hide: false,
    },
    {
      field: 'isCanceled',
      headerName: 'Canceled',
      headerTooltip: 'Canceled',
      filter: false,
      hide: true,
      maxWidth: 120,
      // cellRenderer: (params) => {
      //   let txt = '<span style="color:green"><i class="material-icons">check</i></span>';
      //   if (params.value == false) {
      //     txt = '<span style="color:red"><i class="material-icons">clear</i></span>';
      //   }
      //   let result = '<div>'+ txt + '</div>';
      //   return result;                          
      // },  
    },
    {
      field: 'action',
      headerName: 'Action',
      headerTooltip: 'Action',
      filter: false,
      editable: false,
      cellRenderer: ReservationActionRendererComponent,
      width: 100,
      pinned: 'right'
    }
  ];

  profitFormatter(params: any) {
    const presise = 100;
    try {
      const value = params.data.salePrice - params.data.pushPrice;
      const num = Math.round((value + Number.EPSILON) * presise) / presise;
      return `$${num}`;
    }
    catch (e) {
      return '';
    }
  }

  constructor(
    private deviceService: DeviceDetectorService,
    // private _fuseNavigationService: FuseNavigationService,
    private http: HttpClient,
    private _formBuilder: FormBuilder,
    private comm: TableCommunicationService,
    private _snackBar: MatSnackBar,
  ) {
    this.composeForm = this._formBuilder.group({
      hotel: ['']
    });
  }

  resetAllFilters() {
    this.gridApi.setFilterModel(null);
  }
  clearInput() {
    this.composeForm.controls['hotel'].setValue('');
    this.applyFilter('');
  }
  applyFilter(data: any) {
    const instance = this.gridApi.getFilterInstance('hotelName');

    instance!.setModel({
      type: 'contains',
      filter: data.name
    });

    this.gridApi.onFilterChanged();
  }

  displayFn(hotel: MedHotel): string {
    const currentName = hotel && hotel.name ? hotel.name : '';
    return currentName;
  }

  private _filter(value: string): MedHotel[] {
    const filterValue = value.toLowerCase();
    if (this.options == null) return [];
    return this.options.filter(option => option.name.toLowerCase().includes(filterValue));
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

  ngOnDestroy(): void {
    this._unsubscribeAll.next();
    this._unsubscribeAll.complete();
  }

  ngOnInit(): void {
    this.comm.comm.pipe(takeUntil(this._unsubscribeAll)).subscribe((i: any) => {
      if (i != '') {
        const split = i.split(':');
        const op = split[0];
        if (op == 'update_new_version') {
          const msg = 'Please Refresh you browser for new version: ' + split[1];
          this.openSnackBar(msg, false);
        }
      }
    }
    );

    this.http.get<MedHotel[]>(this.baseUrl + 'Opportunity/Hotels')
      .pipe(takeUntil(this._unsubscribeAll))
      .subscribe((data: MedHotel[]) => {
        this.options = data;
      });

    this.filteredOptions = this.composeForm.controls['hotel'].valueChanges.pipe(
      startWith(''),
      map(value => {
        if (typeof value !== 'string') {
          this.applyFilter(value);
        }
        const name = typeof value === 'string' ? value : value?.name;
        return name ? this._filter(name as string) : this.options.slice();
      }),
    );
    let columnState = null;
    try {
      columnState = JSON.parse(localStorage.getItem('column_defs_reservation') || 'null');
    } catch {
      localStorage.removeItem('column_defs_reservation');
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
  }
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.columnApi = params.columnApi;

    this.refreshData(false);
  }
  refreshData(force: boolean) {
    this.rowData$ = this.http.get<any[]>(this.baseUrl + 'SalesRoom/Reservations?force=' + force);
  }
  onPageSizeChanged() {
    const value = (document.getElementById('page-size') as HTMLInputElement)
      .value;
    this.gridApi.paginationSetPageSize(Number(value));
  }
  onFilterChanged(params: any) {
  }
  onFirstDataRendered(params: FirstDataRenderedEvent) {
  }
  onCellClicked(e: CellClickedEvent): void {
  }
}

