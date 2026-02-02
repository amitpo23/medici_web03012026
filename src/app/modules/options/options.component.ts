import { Platform } from '@angular/cdk/platform';
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition, MatSnackBar } from '@angular/material/snack-bar';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, ColumnApi, ColDef, GridReadyEvent, FirstDataRenderedEvent, CellClickedEvent } from 'ag-grid-community';
import { Observable, Subject, startWith, map } from 'rxjs';
import { CockpitCommon } from 'src/app/common';
import { Board } from 'src/app/core/models/board';
import { InsertOpp } from 'src/app/core/models/insert-opp';
import { MedHotel } from 'src/app/core/models/med-hotel';
import { MedRoomCategory } from 'src/app/core/models/med-room-category';
import { environment } from 'src/app/environments/environment';
import { OppActionRendererComponent } from './opp-action-renderer/opp-action-renderer.component';
import { OppLogComponent } from './opp-log/opp-log.component';
import { OppFormComponent } from './opp-form/opp-form.component';
import { TableCommunicationService } from 'src/app/services/table-communication-service';
import { DeviceDetectorService } from 'ngx-device-detector';

@Component({
  selector: 'app-options',
  templateUrl: './options.component.html',
  styleUrls: ['./options.component.scss']
})
export class OptionsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  private gridApi!: GridApi<any>;
  private columnApi!: ColumnApi;
  composeForm: FormGroup;
  activeOpps = 0;
  canceledOpps = 0;
  defaultDateFrom!: Date;
  defaultDateTo!: Date;
  public paginationPageSize = 50;
  horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  verticalPosition: MatSnackBarVerticalPosition = 'bottom';
  durationInSeconds = 5;
  allCategories!: MedRoomCategory[];
  allBoards: Board[] = [];

  columnDefs: ColDef[] = [];
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
      field: 'dateInsert',
      headerName: 'Date Insert',
      filter: 'agDateColumnFilter',
      valueFormatter: CockpitCommon.dateFormatter,
      maxWidth: 120,
      filterParams: {
        inRangeInclusive: true,
        suppressAndOrCondition: true,
        comparator: CockpitCommon.perfirmDateFilter,
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      pinned: 'left'
    },
    {
      field: 'hotelName',
      headerName: 'Hotel Name',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
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
      filter: 'agDateColumnFilter',
      valueFormatter: CockpitCommon.dateFormatter,
      filterParams: {
        debounceMs: 500,
        inRangeInclusive: true,
        suppressAndOrCondition: true,
        comparator: CockpitCommon.perfirmDateFilter
      },
    },
    {
      field: 'endDate',
      headerName: 'End Date',
      filter: 'agDateColumnFilter',
      valueFormatter: CockpitCommon.dateFormatter,
      filterParams: {
        debounceMs: 500,
        inRangeInclusive: true,
        suppressAndOrCondition: true,
        comparator: CockpitCommon.perfirmDateFilter
      },
    },
    {
      field: 'board',
      headerName: 'Board',
      maxWidth: 120
    },
    {
      field: 'category',
      headerName: 'Category',
      maxWidth: 120
    },
    {
      field: 'buyPrice',
      headerName: 'Buy Price',
      filter: 'agNumberColumnFilter',
      valueFormatter: CockpitCommon.priceFormatter,
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120
    },
    {
      field: 'pushPrice',
      headerName: 'PushPrice',
      filter: 'agNumberColumnFilter',
      valueFormatter: CockpitCommon.priceFormatter,
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
    },
    {
      field: 'maxRooms',
      headerName: 'MaxRooms',
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
    },
    {
      field: 'roomToPurchase',
      headerName: 'Room Purchased',
      filter: false,
      valueFormatter: (params) => {
        const total = params.data.roomToPurchase;
        const bought = params.data.roomsBought;
        return `${bought} from ${total}`
      }
    },
    {
      field: 'log',
      headerName: 'Log',
      cellRenderer: OppLogComponent,
      filter: false,
      pinned: 'right',
      maxWidth: 80
    },
    {
      field: 'status',
      headerName: 'Status',
      cellRenderer: (params: any) => {
        if (params.value == true) {
          return '<span style="color:green">Active</span>';
        }
        else {
          return '<span style="color:red">Disabled</span>'
        }
      },
      pinned: 'right',
      maxWidth: 120
    },
    {
      field: 'action',
      headerName: 'Action',
      filter: false,
      pinned: 'right',
      maxWidth: 80,
      cellRenderer: OppActionRendererComponent,
    },
  ];

  defaultColDef: ColDef = {
    flex: 1,
    minWidth: 120,
    filter: true,
    sortable: true,
    floatingFilter: true,
    resizable: true
  };

  rowData$!: Observable<any[]>;
  filteredOptions!: Observable<MedHotel[]>;
  options: MedHotel[] = [];
  baseUrl = environment.baseUrl;

  resetAllFilters() {
    this.gridApi.setFilterModel(null);
    this.composeForm.controls['hotel'].setValue('');
  }
  onPageSizeChanged() {
    const value = (document.getElementById('page-size') as HTMLInputElement)
      .value;
    this.gridApi.paginationSetPageSize(Number(value));
  }

  openDialog() {
    this._matDialog.open(OppFormComponent, {
      data: {
        defaultDateFrom: this.defaultDateFrom,
        defaultDateTo: this.defaultDateTo,
        allHotels: this.options,
        allBoards: this.allBoards,
        allCategories: this.allCategories
      },
      width: '90%',
      height: '90%'
    }).afterClosed()
      .subscribe((result) => {
        if (result != null) {
          // insert data
          const opp = result;

          const toSave: InsertOpp = {
            hotelId: opp.hotel.hotelId,
            startDateStr: opp.dateFromStr,
            endDateStr: opp.dateToStr,
            boardlId: opp.board.boardId,
            categorylId: opp.category.categoryId,
            buyPrice: Number.parseInt(opp.buyPrice),
            pushPrice: Number.parseInt(opp.pushPrice),
            maxRooms: Number.parseInt(opp.maxRoomsPerNight),
            ratePlanCode: opp.ratePlanCode,
            invTypeCode: opp.invTypeCode,
            reservationFullName: opp.reservationFullName
          };
          if (opp.dateFromStr != null && opp.dateFromStr != '') {
            try {
              const split = opp.dateFromStr.split('-');
              const year = Number.parseInt(split[0]);
              const month = Number.parseInt(split[1]) - 1;
              const day = Number.parseInt(split[2]);
              const ny = new Date(year, month, day);
              this.defaultDateFrom = ny;
            }
            catch (e) {
              console.log(e);
              // return new Date();
            }
          }
          if (opp.dateToStr != null && opp.dateToStr != '') {
            try {
              const split = opp.dateToStr.split('-');
              const year = Number.parseInt(split[0]);
              const month = Number.parseInt(split[1]) - 1;
              const day = Number.parseInt(split[2]);
              const ny = new Date(year, month, day);
              this.defaultDateTo = ny;
            }
            catch (e) {
              console.log(e);
              // return new Date();
            }
          }
          // console.log(toSave);

          this.http.post(
            this.baseUrl + 'Opportunity/InsertOpp',
            toSave)
            .subscribe((oppId: any) => {
              const newData = {
                id: oppId.id,
                dateInsert: oppId.dateInsert,
                hotelName: opp.hotel.name,
                startDate: oppId.startDate,
                endDate: oppId.endDate,
                board: opp.board.description,
                category: opp.category.name,
                buyPrice: Number.parseInt(opp.buyPrice),
                pushPrice: Number.parseInt(opp.pushPrice),
                maxRooms: opp.maxRoomsPerNight,
                roomToPurchase: oppId.roomToPurchase,
                roomsBought: 0,
                reservationFullName: opp.reservationFullName,
                status: true
              };
              const res = this.gridApi.applyTransaction({
                add: [newData],
                addIndex: 0,
              });
              this.activeOpps = this.activeOpps + 1;
            });
        }
      });
  }

  private _unsubscribeAll: Subject<void> = new Subject<void>();

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
    private _matDialog: MatDialog,
    private http: HttpClient,
    private comm: TableCommunicationService,
    // private _fuseNavigationService: FuseNavigationService,
    public platform: Platform,
    private deviceService: DeviceDetectorService,
    private _formBuilder: FormBuilder,
    private _snackBar: MatSnackBar,
  ) {
    this.composeForm = this._formBuilder.group({
      hotel: ['']
    });
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Lifecycle hooks
  // -----------------------------------------------------------------------------------------------------

  displayFn(hotel: MedHotel): string {
    const currentName = hotel && hotel.name ? hotel.name : '';
    return currentName;
  }
  /**
   * On init
   */
  ngOnInit(): void {
    this.http.get<MedHotel[]>(this.baseUrl + 'Opportunity/Hotels')
      .subscribe((data: MedHotel[]) => {
        this.options = data;
      });

    this.http.get<Board[]>(this.baseUrl + 'Opportunity/Boards')
      .subscribe((data: Board[]) => {
        this.allBoards = data;
      });

    this.http.get<MedRoomCategory[]>(this.baseUrl + 'Opportunity/Categories')
      .subscribe((data: MedRoomCategory[]) => {
        this.allCategories = data;
      });

    const isMobile = this.deviceService.isMobile();

    this.comm.comm.subscribe((i: any) => {
      if (i != '') {
        // console.log(i);
        const split = i.split(':');
        const op = split[0];
        if (op == 'update_new_version') {
          const msg = 'Please Refresh you browser for new version: ' + split[1];
          this.openSnackBar(msg, false);
        }
        if (op != 'delete_opp') return;

        const idToUpdate = split[1];
        const itemsToUpdate: any = [];
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
          this.activeOpps = this.activeOpps - 1;
          this.canceledOpps = this.canceledOpps + 1;
          // add new
          const currItem = itemsToUpdate[0];
          const newData = {
            id: currItem.id,
            dateInsert: currItem.dateInsert,
            hotelName: currItem.hotelName,
            startDate: currItem.startDate,
            endDate: currItem.endDate,
            board: currItem.board,
            category: currItem.category,
            buyPrice: currItem.buyPrice,
            pushPrice: currItem.pushPrice,
            maxRooms: currItem.maxRooms,
            roomToPurchase: currItem.roomToPurchase,
            roomsBought: currItem.roomsBought,
            reservationFullName: currItem.reservationFullName,
            status: false
          };
          var res = this.gridApi.applyTransaction({
            add: [newData],
            addIndex: 0,
          });
        }
      }
    }
    );

    // if (!isMobile) {
    //   const navigation = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');

    //   if (navigation) {
    //     // Toggle the opened status
    //     navigation.toggle();
    //   }
    // }

    let columnState = null;
    try {
      columnState = JSON.parse(localStorage.getItem('column_defs') || 'null');
    } catch {
      localStorage.removeItem('column_defs');
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

  private _filter(value: string): MedHotel[] {
    const filterValue = value.toLowerCase();
    if (this.options == null) return [];
    return this.options.filter(option => option.name.toLowerCase().includes(filterValue));
  }

  resetColumns() {
    this.columnDefs = this.defaultColumnDefs;
    localStorage.removeItem('column_defs');
  }
  // columnState:any;
  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.columnApi = params.columnApi;

    this.gridApi.setDomLayout('autoHeight');


    this.refreshData(false);
  }

  refreshData(force: boolean) {
    this.rowData$ = this.http.get<any[]>(this.baseUrl + 'Opportunity/Opportunities?force=' + force);
  }

  onBtnExport() {
    this.gridApi.exportDataAsExcel();
  }

  onFirstDataRendered(params: FirstDataRenderedEvent) {
    this.countStatistics();
  }

  onFilterChanged(params: any) {
    this.countStatistics();
  }

  onColumnMoved(params: any) {
    const columnState = JSON.stringify(this.columnApi.getColumnState());
    localStorage.setItem('column_defs', columnState);
  }

  countStatisticsRowData(data: any) {
    this.activeOpps = 0;
    this.canceledOpps = 0;
    for (let index = 0; index < data.length; index++) {
      const element = data[index];
      if (element.status) {
        this.activeOpps += 1;
      }
      else {
        this.canceledOpps += 1;
      }
    }
  }
  countStatistics() {
    this.activeOpps = 0;
    this.canceledOpps = 0;
    this.gridApi.forEachNodeAfterFilter((rowNode, index) => {
      if (rowNode.data.status) {
        this.activeOpps += 1;
      }
      else {
        this.canceledOpps += 1;
      }
    });
  }

  onCellClicked(e: CellClickedEvent): void {
    // console.log('cellClicked', e);
  }

  /**
   * After view init
   */
  ngAfterViewInit(): void {
    // Make the data source sortable
    // this.recentTransactionsDataSource.sort = this.recentTransactionsTableMatSort;
  }

  /**
   * On destroy
   */
  ngOnDestroy(): void {
    this._unsubscribeAll.next();
    this._unsubscribeAll.complete();
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Public methods
  // -----------------------------------------------------------------------------------------------------

  /**
   * Track by function for ngFor loops
   *
   * @param index
   * @param item
   */
  trackByFn(index: number, item: any): any {
    return item.id || index;
  }

  // -----------------------------------------------------------------------------------------------------
  // @ Private methods
  // -----------------------------------------------------------------------------------------------------


}
