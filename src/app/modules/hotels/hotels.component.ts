import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition, MatSnackBar } from '@angular/material/snack-bar';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, ColumnApi, ColDef, GridReadyEvent, FirstDataRenderedEvent, CellClickedEvent } from 'ag-grid-community';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CockpitCommon } from 'src/app/common';
import { MedHotel } from 'src/app/core/models/med-hotel';
import { environment } from 'src/app/environments/environment';
import { TableCommunicationService } from 'src/app/services/table-communication-service';
import { ReservationActionRendererComponent } from '../reservation/reservation-action-renderer/reservation-action-renderer.component';
import { ProviderRendererComponent } from '../shared/provider-renderer/provider-renderer.component';

@Component({
  selector: 'app-hotels',
  templateUrl: './hotels.component.html',
  styleUrls: ['./hotels.component.scss']
})
export class HotelsComponent implements OnInit, OnDestroy {
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
      field: 'hotelId',
      headerName: 'Hotel Id',
      headerTooltip: 'Hotel Id',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 100,
    },
    {
      field: 'innstantId',
      headerName: 'Innstant Id',
      headerTooltip: 'Innstant Id',
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      width: 120,
    },
    {
      field: 'innstantZenithId',
      headerName: 'Innstant Zenith Id',
      headerTooltip: 'Innstant Zenith Id',
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      width: 120,
    },
    {
      field: 'goglobalid',
      headerName: 'Go Global Id',
      headerTooltip: 'Go Global Id',
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      width: 120,
    },
    {
      field: 'name',
      headerName: 'Name',
      headerTooltip: 'Name',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      width: 150,
    },
    {
      field: 'countryId',
      headerName: 'Country Id',
      headerTooltip: 'Country Id',
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      width: 120,
    },
    {
      field: 'boardId',
      headerName: 'Board Id',
      headerTooltip: 'Board Id',
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      width: 120,
    },
    {
      field: 'categoryId',
      headerName: 'Category Id',
      headerTooltip: 'Category Id',
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      width: 120,
    },
    {
      field: 'isActive',
      headerName: 'Active',
      headerTooltip: 'Active',
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      width: 120,
      cellDataType: 'boolean'
    },
    {
      field: 'RatePlanCode',
      headerName: 'RatePlanCode',
      headerTooltip: 'RatePlanCode',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      width: 120
    },  
    {
      field: 'InvTypeCode',
      headerName: 'InvTypeCode',
      headerTooltip: 'InvTypeCode',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      width: 120
    },     
  ];

  constructor(
    private deviceService: DeviceDetectorService,
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
    this.rowData$ = this.http.get<any[]>(this.baseUrl + 'hotels');
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
