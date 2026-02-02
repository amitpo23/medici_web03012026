import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { CellClickedEvent, ColDef, ColumnApi, FirstDataRenderedEvent, GridApi, GridReadyEvent } from 'ag-grid-community';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { CockpitCommon } from 'src/app/common';
import { MedHotel } from 'src/app/core/models/med-hotel';
import { environment } from 'src/app/environments/environment';
import { ProviderRendererComponent } from '../../shared/provider-renderer/provider-renderer.component';
import { CancelRoomActionRendererComponent } from '../cancel-room-action-renderer/cancel-room-action-renderer.component';

@Component({
  selector: 'app-cancel-room',
  templateUrl: './cancel-room.component.html',
  styleUrls: ['./cancel-room.component.scss']
})
export class CancelRoomComponent implements OnInit {

  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  private gridApi!: GridApi<any>;
  private columnApi!: ColumnApi;
  public paginationPageSize = 50;
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
      maxWidth: 100,
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
      width: 120,
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
        suppressAndOrCondition: true,
        inRangeInclusive: true,
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
        suppressAndOrCondition: true,
        inRangeInclusive: true,
        comparator: CockpitCommon.perfirmDateFilter
      },
      width: 120,
    },
    {
      field: 'board',
      headerName: 'Board',
      headerTooltip: 'Board',
      width: 120,
      hide: false,
    },
    {
      field: 'category',
      headerName: 'Category',
      headerTooltip: 'Category',
      width: 120,
      hide: false,
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
      field: 'lastPrice',
      headerName: 'Last Price',
      headerTooltip: 'Last Price',
      filter: false,
      minWidth: 250,
      hide: true,
      cellRenderer: (params: any) => {
        if (params.value) {
          const dateAsString = params.data.dateLastPrice;
          const dateOnly = dateAsString.split('T');
          const dateParts = dateOnly[0].split('-');
          const dateShow = `(${dateParts[2]}/${dateParts[1]}/${dateParts[0]})`;

          const presise = 100;
          const num = Math.round((params.value + Number.EPSILON) * presise) / presise;
          const txt = `$${num}`;
          const up = '<span style="color:green"><i class="material-icons">arrow_upward</i><sub><span style="color:black">' + dateShow + '</span></sub></span>';
          const down = '<span style="color:red"><i class="material-icons">arrow_downward</i><sub><span style="color:black">' + dateShow + '</span></sub></span>';

          let result = '';

          if (params.data.pushPrice < params.value) {
            result = txt + up;
          }
          else {
            result = txt + down;
          }
          return result;
        }

        return null;
      },
    },
    {
      field: 'isActive',
      headerName: 'Status',
      headerTooltip: 'Status',
      maxWidth: 150,
      cellRenderer: (params: any) => {
        if (!params.data.isActive && !params.data.isSold) {
          return '<span title="Cancellation Success" style="color:green">Cancellation Success</span>';
        }
        //if (params.data.isSold){
        //    return '<span style="color:green">Sale</span>';
        //}
        return '<span title="Cancel Error" style="color:red">Cancel Error</span>';
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
      cellRenderer: CancelRoomActionRendererComponent,

    }
  ];

  constructor(
    private http: HttpClient,
    private deviceService: DeviceDetectorService,
    // private _fuseNavigationService: FuseNavigationService,
    private _formBuilder: FormBuilder,
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
    const instance = this.gridApi.getFilterInstance('name');

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

  ngOnInit(): void {
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
    if (!isMobile) {
      // const navigation = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');

      // if ( navigation )
      // {
      //     // Toggle the opened status
      //     navigation.toggle();
      // }
    }
  }

  private _filter(value: string): MedHotel[] {
    const filterValue = value.toLowerCase();
    if (this.options == null) return [];
    return this.options.filter(option => option.name.toLowerCase().includes(filterValue));
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.columnApi = params.columnApi;

    this.refreshData(false);
  }
  refreshData(force: boolean) {
    this.rowData$ = this.http.get<any[]>(this.baseUrl + 'Book/Canceled?force=' + force);
  }
  onPageSizeChanged() {
    const value = (document.getElementById('page-size') as HTMLInputElement)
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
