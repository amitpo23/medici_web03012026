import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { CellClickedEvent, ColDef, ColumnApi, FirstDataRenderedEvent, GridApi, GridReadyEvent } from 'ag-grid-community';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Observable } from 'rxjs';
import { CockpitCommon } from 'src/app/common';
import { environment } from 'src/app/environments/environment';

@Component({
  selector: 'app-reservation-modify',
  templateUrl: './reservation-modify.component.html',
  styleUrls: ['./reservation-modify.component.scss']
})
export class ReservationModifyComponent implements OnInit {

  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  private gridApi!: GridApi<any>;
  private columnApi!: ColumnApi;
  public paginationPageSize = 50;
  baseUrl = environment.baseUrl;
  public defaultColDef: ColDef = {
    flex: 1,
    minWidth: 150,
    filter: true,
    sortable: true,
    floatingFilter: true,
    resizable: true,
  };
  public rowData$!: Observable<any[]>;
  public columnDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'Id',
      headerTooltip: 'Id',
      maxWidth: 100,
      filter: 'agNumberColumnFilter',
      filterParams: {
        suppressAndOrCondition: true,
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
    },
    {
      field: 'uniqueId',
      headerName: 'uniqueID',
      headerTooltip: 'uniqueID',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
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
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
    },
    {
      field: 'resStatus',
      headerName: 'ResStatus',
      headerTooltip: 'ResStatus',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
    },
    {
      field: 'posCompanyName',
      headerName: 'PosCompanyName',
      headerTooltip: 'PosCompanyName',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
    },
    {
      field: 'hotelName',
      headerName: 'Hotel(code)',
      headerTooltip: 'Hotel(code)',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      valueFormatter: this.hotelNameFormatter,
    },
    {
      field: 'datefrom',
      headerName: 'Date From',
      headerTooltip: 'Date From',
      filter: 'agDateColumnFilter',
      valueFormatter: CockpitCommon.dateFormatter,
      filterParams: {
        suppressAndOrCondition: true,
        comparator: CockpitCommon.perfirmDateFilter,
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
    },
    {
      field: 'dateto',
      headerName: 'Date To',
      headerTooltip: 'Date To',
      filter: 'agDateColumnFilter',
      valueFormatter: CockpitCommon.dateFormatter,
      filterParams: {
        suppressAndOrCondition: true,
        comparator: CockpitCommon.perfirmDateFilter,
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
    },
    {
      field: 'amountAfterTax',
      headerName: 'AmountAfterTax',
      headerTooltip: 'AmountAfterTax',
      valueFormatter: CockpitCommon.priceFormatter,
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
    },
    {
      field: 'ratePlanCode',
      headerName: 'RatePlanCode',
      headerTooltip: 'RatePlanCode',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
    },
    {
      field: 'roomTypeCode',
      headerName: 'RoomTypeCode',
      headerTooltip: 'RoomTypeCode',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
    },
    {
      field: 'adultCount',
      headerName: 'AdultCount',
      headerTooltip: 'AdultCount',
      filter: 'agNumberColumnFilter',
      maxWidth: 120,
      filterParams: {
        suppressAndOrCondition: true,
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
    },
    {
      field: 'comments',
      headerName: 'Comments',
      headerTooltip: 'Comments',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
    },
    {
      field: 'isApproved',
      headerName: 'Approved',
      headerTooltip: 'Approved',
      filter: false,
      maxWidth: 120,
      cellRenderer: (params: any) => {
        let txt = '<span style="color:green"><i class="material-icons">check</i></span>';

        if (params.value == false) {
          txt = '<span style="color:red"><i class="material-icons">clear</i></span>';
        }

        let result = '<div>' + txt + '</div>';

        return result;
      },
    },
  ];

  hotelNameFormatter(params: any) {
    let name = params.value;
    if (name == null) name = '';
    let code = params.data.hotelCode;
    if (name == '') return code;
    return `${name} (${code})`;
  }

  constructor(
    private http: HttpClient,
    private deviceService: DeviceDetectorService,
    // private _fuseNavigationService: FuseNavigationService,
  ) { }

  ngOnInit(): void {
    // const isMobile = this.deviceService.isMobile();
    // if (!isMobile) {
    //   const navigation = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');

    //   if (navigation) {
    //     // Toggle the opened status
    //     navigation.toggle();
    //   }
    // }
  }
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.columnApi = params.columnApi;

    this.refreshData(false);
  }
  refreshData(force: boolean) {
    // this.rowData$ = null;
    this.rowData$ = this.http.get<any[]>(this.baseUrl + 'Reservation/ReservationModify?force=' + force);
  }
  onPageSizeChanged() {
    var value = (document.getElementById('page-size') as HTMLInputElement)
      .value;
    this.gridApi.paginationSetPageSize(Number(value));
  }
  onFilterChanged(params: any) {
    // this.countStatistics();
  }
  onFirstDataRendered(params: FirstDataRenderedEvent) {
    // this.countStatistics();
  }
  onCellClicked(e: CellClickedEvent): void {
    // console.log('cellClicked', e);
  }
}