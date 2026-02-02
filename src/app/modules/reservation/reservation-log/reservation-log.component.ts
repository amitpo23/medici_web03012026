import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { CellClickedEvent, ColDef, ColumnApi, FirstDataRenderedEvent, GridApi, GridReadyEvent } from 'ag-grid-community';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Observable } from 'rxjs';
import { CockpitCommon } from 'src/app/common';
import { environment } from 'src/app/environments/environment';
import { ReservationLogActionRendererComponent } from '../reservation-log-action-renderer/reservation-log-action-renderer.component';

@Component({
  selector: 'app-reservation-log',
  templateUrl: './reservation-log.component.html',
  styleUrls: ['./reservation-log.component.scss']
})
export class ReservationLogComponent implements OnInit {

  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  public columnDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'Id',
      headerTooltip: 'Id',
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
        inRangeInclusive: true,
        comparator: CockpitCommon.perfirmDateFilter,
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 180,
    },
    {
      field: 'requestContent',
      headerName: 'Request Content',
      headerTooltip: 'Request Content',
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
      cellRenderer: ReservationLogActionRendererComponent,
      minWidth: 440,
    }
  ];
  public defaultColDef: ColDef = {
    flex: 1,
    minWidth: 150,
    filter: true,
    sortable: true,
    floatingFilter: true,
    resizable: true,
  };
  public rowData$!: Observable<any[]>;
  public paginationPageSize = 50;
  private gridApi!: GridApi<any>;
  private columnApi!: ColumnApi;
  baseUrl = environment.baseUrl;

  constructor(
    private deviceService: DeviceDetectorService,
    // private _fuseNavigationService: FuseNavigationService,
    private http: HttpClient,
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

    this.refreshData();
  }

  refreshData() {
    // this.rowData$ = null;
    this.rowData$ = this.http.get<any[]>(this.baseUrl + 'Reservation/Log');
  }

  onPageSizeChanged() {
    const value = (document.getElementById('page-size') as HTMLInputElement)
      .value;
    this.gridApi.paginationSetPageSize(Number(value));
  }

  onFilterChanged(params: any) {
    // this.countStatistics();
  }

  onColumnMoved(params: any) {
    // var columnState = JSON.stringify(this.columnApi.getColumnState());    
    // localStorage.setItem('column_defs_sales_room', columnState);
  }

  onCellClicked(e: CellClickedEvent): void {
    // console.log('cellClicked', e);
  }

  onFirstDataRendered(params: FirstDataRenderedEvent) {
    // this.countStatistics();
  }

}
