import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { CellClickedEvent, ColDef, ColumnApi, FirstDataRenderedEvent, GridApi, GridReadyEvent } from 'ag-grid-community';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Observable } from 'rxjs';
import { CockpitCommon } from 'src/app/common';
import { environment } from 'src/app/environments/environment';

@Component({
  selector: 'app-book-errors',
  templateUrl: './book-errors.component.html',
  styleUrls: ['./book-errors.component.scss']
})
export class BookErrorsComponent implements OnInit {

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
      width: 80,
    },
    {
      field: 'error',
      headerName: 'Error',
      headerTooltip: 'Error',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
    },
    {
      field: 'token',
      headerName: 'Token',
      headerTooltip: 'Token',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
    },
    {
      field: 'code',
      headerName: 'Code',
      headerTooltip: 'Code',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
    },
    {
      field: 'responseJson',
      headerName: 'Response Json',
      headerTooltip: 'Response Json',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
    },
    {
      field: 'requestJson',
      headerName: 'RequestJson',
      headerTooltip: 'Request Json',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
    },
  ];

  constructor(
    private http: HttpClient,
    private deviceService: DeviceDetectorService,
    // private _fuseNavigationService: FuseNavigationService,
  ) { }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.columnApi = params.columnApi;

    this.refreshData(false);
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

  refreshData(force: boolean) {
    // this.rowData$ = null;
    this.rowData$ = this.http.get<any[]>(this.baseUrl + 'Errors/BookErrors');
  }

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

}
