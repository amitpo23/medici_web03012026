import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition, MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, ColumnApi, ColDef, FirstDataRenderedEvent, CellClickedEvent, GridReadyEvent } from 'ag-grid-community';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Observable, Subject, startWith, map } from 'rxjs';
import { CockpitCommon } from 'src/app/common';
import { MedHotel } from 'src/app/core/models/med-hotel';
import { environment } from 'src/app/environments/environment';
import { TableCommunicationService } from 'src/app/services/table-communication-service';
import { ProviderRendererComponent } from '../shared/provider-renderer/provider-renderer.component';
import { SalesRoomActionRendererComponent } from './sales-room-action-renderer/sales-room-action-renderer.component';

@Component({
  selector: 'app-sales-room',
  templateUrl: './sales-room.component.html',
  styleUrls: ['./sales-room.component.scss']
})
export class SalesRoomComponent implements OnInit, OnDestroy {
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  verticalPosition: MatSnackBarVerticalPosition = 'bottom';
  durationInSeconds = 5;
  composeForm: FormGroup;
  private gridApi!: GridApi<any>;
  private columnApi!: ColumnApi;
  public paginationPageSize = 50;
  baseUrl = environment.baseUrl;
  filteredOptions!: Observable<MedHotel[]>;
  options: MedHotel[] = [];
  public columnDefs: ColDef[] = [];
  public defaultColDef: ColDef = {
    flex: 1,
    minWidth: 150,
    filter: true,
    sortable: true,
    floatingFilter: true,
    resizable: true,
  };
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
      maxWidth: 100,
      hide: true
    },
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
      width: 120,
      hide: true,
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
      width: 120,
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
      width: 150,
    },
    {
      field: 'reservationFullName',
      headerName: 'Guest Name',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
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
      width: 120,
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
      width: 120,
    },
    {
      field: 'board',
      headerName: 'Board',
      headerTooltip: 'Board',
      width: 120,
    },
    {
      field: 'category',
      headerName: 'Category',
      headerTooltip: 'Category',
      width: 120,
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
      width: 120,
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
      width: 120,
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
      width: 120,
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
      width: 120,
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
    },
    {
      field: 'action',
      headerName: 'Action',
      headerTooltip: 'Action',
      filter: false,
      editable: false,
      cellRenderer: SalesRoomActionRendererComponent,
      width: 100,
      pinned: 'right'
      // minWidth: 440,  
    }
  ];
  public rowData$!: Observable<any[]>;

  private _unsubscribeAll: Subject<void> = new Subject<void>();

  private _filter(value: string): MedHotel[] {
    const filterValue = value.toLowerCase();
    if (this.options == null) return [];
    return this.options.filter(option => option.name.toLowerCase().includes(filterValue));
  }

  displayFn(hotel: MedHotel): string {
    let currentName = hotel && hotel.name ? hotel.name : '';
    return currentName;
  }

  applyFilter(data: any) {
    var instance = this.gridApi.getFilterInstance('name');

    instance!.setModel({
      type: 'contains',
      filter: data.name
    });

    this.gridApi.onFilterChanged();
  }

  clearInput() {
    this.composeForm.controls['hotel'].setValue('');
    this.applyFilter('');
  }

  resetColumns() {
    this.columnDefs = this.defaultColumnDefs;
    localStorage.removeItem('column_defs_sales_room');
  }

  resetAllFilters() {
    this.gridApi.setFilterModel(null);
  }

  onBtnExport() {
    this.gridApi.exportDataAsExcel();
  }



  /**
   * Constructor
   */
  constructor(
    private deviceService: DeviceDetectorService,
    // private _fuseNavigationService: FuseNavigationService,
    private _router: Router,
    private http: HttpClient,
    private _formBuilder: FormBuilder,
    private comm: TableCommunicationService,
    private _snackBar: MatSnackBar,
  ) {
    this.composeForm = this._formBuilder.group({
      hotel: ['']
    });
  }



  divRenderer(params: any) {
    return `<div>${params.value}</div>`;
  }

  onPageSizeChanged() {
    var value = (document.getElementById('page-size') as HTMLInputElement)
      .value;
    this.gridApi.paginationSetPageSize(Number(value));
  }

  onFilterChanged(params: any) {
    // this.countStatistics();
  }

  onColumnMoved(params: any) {
    var columnState = JSON.stringify(this.columnApi.getColumnState());
    localStorage.setItem('column_defs_sales_room', columnState);
  }

  onFirstDataRendered(params: FirstDataRenderedEvent) {
    // this.countStatistics();
  }

  onCellClicked(e: CellClickedEvent): void {
    // console.log('cellClicked', e);
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.columnApi = params.columnApi;

    this.refreshData(false);
  }
  refreshData(force: boolean) {
    // this.rowData$ = null;
    this.rowData$ = this.http.get<any[]>(this.baseUrl + 'SalesRoom/Sales?force=' + force);
  }
  /**
   * On init
   */
  ngOnInit(): void {
    this.comm.comm.subscribe((i: any) => {
      if (i != '') {
        // console.log(i);
        let split = i.split(':');
        let op = split[0];
        if (op == 'update_new_version') {
          let msg = 'Please Refresh you browser for new version: ' + split[1];
          this.openSnackBar(msg, false);
        }
        if (op != 'set_update_name_success') return;

        let strObj = split[1];
        strObj = strObj.split('@').join(':');
        let objToUpdate = JSON.parse(strObj);

        let idToUpdate = objToUpdate.id;
        var itemsToUpdate: any = [];
        this.gridApi.forEachNodeAfterFilterAndSort(function (rowNode, index) {
          var data = rowNode.data;
          if (data.id == idToUpdate) {
            data.statusChangeName = objToUpdate.result;
            itemsToUpdate.push(data);
          }

        });
        if (itemsToUpdate.length > 0) {
          let msg = 'Update Name Success';
          this.openSnackBar(msg);
          // update
          var res = this.gridApi.applyTransaction({ update: itemsToUpdate });
        }
      }
    }
    );

    this.http.get<MedHotel[]>(this.baseUrl + 'Opportunity/Hotels')
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

    const isMobile = this.deviceService.isMobile();
    // if (!isMobile) {
    //   const navigation = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');

    //   if (navigation) {
    //     // Toggle the opened status
    //     navigation.toggle();
    //   }
    // }

    let columnState = null;
    try {
      columnState = JSON.parse(localStorage.getItem('column_defs_sales_room') || 'null');
    } catch {
      localStorage.removeItem('column_defs_sales_room');
    }

    if (columnState) {
      columnState.forEach((element: any) => {
        let clmn = this.defaultColumnDefs.find(i => i.field == element.colId);
        if (clmn) {
          this.columnDefs.push(clmn);
        }
      });
    }
    else {
      this.columnDefs = this.defaultColumnDefs;
    }
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
   * On destroy
   */
  ngOnDestroy(): void {
    this._unsubscribeAll.next();
    this._unsubscribeAll.complete();
  }
}