import { HttpClient } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition, MatSnackBar } from '@angular/material/snack-bar';
import { AgGridAngular } from 'ag-grid-angular';
import { GridApi, ColumnApi, ColDef, FirstDataRenderedEvent, GridReadyEvent, RowSelectedEvent, RowClickedEvent, SelectionChangedEvent } from 'ag-grid-community';
import { DeviceDetectorService } from 'ngx-device-detector';
import { Observable, startWith, map } from 'rxjs';
import { CockpitCommon } from 'src/app/common';
import { Board } from 'src/app/core/models/board';
import { InsertOpp } from 'src/app/core/models/insert-opp';
import { MedHotel } from 'src/app/core/models/med-hotel';
import { MedRoomCategory } from 'src/app/core/models/med-room-category';
import { SearchHotelRequest } from 'src/app/core/models/search-hotel-request';
import { environment } from 'src/app/environments/environment';
import { OppFormComponent } from '../options/opp-form/opp-form.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-search-price',
  templateUrl: './search-price.component.html',
  styleUrls: ['./search-price.component.scss']
})
export class SearchPriceComponent implements OnInit {
  baseUrl = environment.baseUrl;
  composeForm: FormGroup;
  options: MedHotel[] = [];
  selectedDateFromInput: Date;
  selectedDateToInput: Date;
  filteredOptions!: Observable<MedHotel[]>;
  categories!: MedRoomCategory[];
  boards!: Board[];
  allBoards: Board[] = [];
  allCategories!: MedRoomCategory[];
  selectedHotelData!: any[];
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;
  private gridApi!: GridApi<any>;
  private columnApi!: ColumnApi;
  public paginationPageSize = 50;
  horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  verticalPosition: MatSnackBarVerticalPosition = 'bottom';
  durationInSeconds = 5;
  isLoading: boolean = false;
  public defaultColDef: ColDef = {
    flex: 1,
    minWidth: 150,
    filter: true,
    sortable: true,
    floatingFilter: true,
    resizable: true,
  };
  public rowData: any[] = [];
  public columnDefs: ColDef[] = [
    {
      field: 'netPrice.amount',
      headerName: 'Net Price',
      headerTooltip: 'Net Price',
      filter: 'agNumberColumnFilter',
      valueFormatter: CockpitCommon.priceFormatter,
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      hide: false,
      maxWidth: 100,
    },
    {
      field: 'price.amount',
      headerName: 'Price',
      headerTooltip: 'Price',
      filter: 'agNumberColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      valueFormatter: CockpitCommon.priceFormatter,
      hide: false,
      maxWidth: 100,
    },
    {
      field: 'commissionable',
      headerName: 'Commissionable',
      headerTooltip: 'Commissionable',
      filter: false,
      maxWidth: 100,
      cellRenderer: (params: any) => {
        let txt = '<span style="color:green"><i class="material-icons">check</i></span>';

        if (params.value == false) {
          txt = '<span style="color:red"><i class="material-icons">clear</i></span>';
        }

        const result = '<div>' + txt + '</div>';

        return result;
      },
    },
    {
      field: 'confirmation',
      headerName: 'Confirmation',
      headerTooltip: 'Confirmation',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
    },
    {
      field: 'paymentType',
      headerName: 'Payment Type',
      headerTooltip: 'Payment Type',
      filter: 'agTextColumnFilter',
      filterParams: {
        buttons: ['apply', 'reset'],
        closeOnApply: true,
      },
      maxWidth: 120,
    },
    {
      field: 'items',
      headerName: 'Items',
      headerTooltip: 'Items',
      filter: false,
      hide: false,
      cellRenderer: (params: any) => {
        let fullText = '';

        for (let index = 0; index < params.value.length; index++) {
          const element = params.value[index];
          const txt = `Name:${element.name}, hotelId:${element.hotelId}, category:${element.category}, board:${element.board}, bedding:${element.bedding}`;
          fullText = fullText + txt + '\n';
        }

        const result = '<div><textarea rows=10 style="width:100%;height:100%;">' + fullText + '</textarea></div>';

        return result;
      },
      width: 300,
    },
    {
      field: 'providers',
      headerName: 'Providers',
      headerTooltip: 'Providers',
      // filter: 'agTextColumnFilter',          
      // filterParams: {
      //     buttons: ['apply', 'reset'],
      //     closeOnApply: true,
      // },
      filter: false,
      hide: false,
      cellRenderer: (params: any) => {
        let fullText = '';
        for (let index = 0; index < params.value.length; index++) {
          const element = params.value[index];
          const txt = `Name:${element.name}, Id:${element.id}`;
          fullText = fullText + txt + '\n';
        }
        const result = '<div><textarea rows=10 style="width:100%;height:100%;">' + fullText + '</textarea></div>';
        return result;
      },
      maxWidth: 150,
    },
    {
      field: 'cancellation',
      headerName: 'Cancellation',
      headerTooltip: 'Cancellation',
      hide: false,
      filter: false,
      // filter: 'agTextColumnFilter',          
      // filterParams: {
      //     buttons: ['apply', 'reset'],
      //     closeOnApply: true,
      // },
      cellRenderer: (params: any) => {
        let fullText = '';
        //let result = '<div>Type:' + params.value.type;
        if (params.value.frames != null) {
          const frms = params.value.frames;
          for (let index = 0; index < frms.length; index++) {
            const element = frms[index];
            const txt = `From:${element.from}, To:${element.to}, Penalty:$${element.penalty.amount}`;
            fullText = fullText + txt + '\n';
          }
          const result = '<div>Type:' + params.value.type + '<br/><textarea style="width:100%;height:150px;overflow-y:scroll;">' + fullText + '</textarea></div>';
          return result;
        }
        else {
          const result = '<div>Type:' + params.value.type + '</div>';
          return result;
        }

      },
      width: 200,
    },
    {
      field: 'specialOffers',
      headerName: 'Special Offers',
      headerTooltip: 'Special Offers',
      // filter: 'agTextColumnFilter',          
      // filterParams: {
      //     buttons: ['apply', 'reset'],
      //     closeOnApply: true,
      // },
      filter: false,
      hide: false,
      cellRenderer: (params: any) => {
        let fullText = '';

        for (let index = 0; index < params.value.length; index++) {
          const element = params.value[index];
          const txt = `Title:${element.title}, Type:${element.type}, Description:${element.description}`;
          fullText = fullText + txt + '\n';
        }

        const result = '<div><textarea rows=10 style="width:100%;height:100%;">' + fullText + '</textarea></div>';

        return result;
      },
      maxWidth: 100,
    },
  ];

  defaultDateFrom!: Date;
  defaultDateTo!: Date;

  constructor(
    private deviceService: DeviceDetectorService,
    // private _fuseNavigationService: FuseNavigationService,
    private _formBuilder: FormBuilder,
    private http: HttpClient,
    private _snackBar: MatSnackBar,
    private _matDialog: MatDialog,
  ) {
    const selectedDateFrom = new Date();
    selectedDateFrom.setDate(selectedDateFrom.getDate() + 30);
    this.selectedDateFromInput = selectedDateFrom;

    const yearFrom = selectedDateFrom.getFullYear();
    const monthFrom = selectedDateFrom.getMonth();
    const dayFrom = selectedDateFrom.getDate();

    const selectedDateTo = new Date(yearFrom, monthFrom, dayFrom);
    selectedDateTo.setDate(selectedDateTo.getDate() + 1);
    this.selectedDateToInput = selectedDateTo;

    this.composeForm = this._formBuilder.group({
      hotel: ['', [Validators.required]],
      dateFromStr: ['', [Validators.required]],
      dateToStr: ['', [Validators.required]],
    });
    let dtf = this.getStringFromDate(this.selectedDateFromInput);
    this.composeForm.controls['dateFromStr'].setValue(dtf);

    dtf = this.getStringFromDate(this.selectedDateToInput);
    this.composeForm.controls['dateToStr'].setValue(dtf);

  }

  onPageSizeChanged() {
    const value = (document.getElementById('page-size') as HTMLInputElement)
      .value;
    this.gridApi.paginationSetPageSize(Number(value));
  }

  getDateTimeFromString(strDate: string): Date {
    try {
      const split = strDate.split('-');
      const year = Number.parseInt(split[0]);
      const month = Number.parseInt(split[1]) - 1;
      const day = Number.parseInt(split[2]);
      return new Date(year, month, day);
    }
    catch (e) {
      return new Date();
    }
  }

  toChanged(event: any) {
    console.log('to date: ' + event);
    // try to parse input
    if (event == null || event == '') {
      this.composeForm.controls['dateToStr'].setValue(null);
      return;
    }
    const selectedDate = this.getDateTimeFromString(event);
    const dtf = this.getStringFromDate(selectedDate);
    this.composeForm.controls['dateToStr'].setValue(dtf);
  }

  fromChanged(event: any) {
    console.log('from date: ' + event);
    // try to parse input
    if (event == null || event == '') {
      this.composeForm.controls['dateFromStr'].setValue(null);
      return;
    }
    const sd = this.getDateTimeFromString(event);
    let dtf = this.getStringFromDate(sd);
    this.composeForm.controls['dateFromStr'].setValue(dtf);


    // update dateTo
    const sdt = sd;
    sdt.setDate(sd.getDate() + 1);
    // this.composeForm.controls['dateTo'].setValue(sdt);
    this.selectedDateToInput = sd;
    dtf = this.getStringFromDate(sd);
    this.composeForm.controls['dateToStr'].setValue(dtf);
  }

  displayFn(hotel: MedHotel): string {
    const currentName = hotel && hotel.name ? hotel.name : '';
    return currentName;
  }

  getStringFromDate(dt: Date): string {
    const yearFrom = dt.getFullYear();
    const monthFrom = dt.getMonth() + 1;
    const dayFrom = dt.getDate();
    return `${yearFrom}-${monthFrom}-${dayFrom}`;
  }

  fullNameValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const split = control.value.split(' ').filter(Boolean);
      const error = split.length < 2;
      return error ? { fullName: { value: control.value } } : null;
    };
  }
  get buyPrice() { return this.composeForm.get('buyPrice'); }
  get pushPrice() { return this.composeForm.get('pushPrice'); }
  get maxRoomsPerNight() { return this.composeForm.get('maxRoomsPerNight'); }
  get reservationFullName() { return this.composeForm.get('reservationFullName'); }
  get category() { return this.composeForm.get('category'); }

  ngOnInit(): void {
    this.http.get<Board[]>(this.baseUrl + 'Opportunity/Boards')
      .subscribe((data: Board[]) => {
        this.allBoards = data;
      });

    this.http.get<MedHotel[]>(this.baseUrl + 'Opportunity/Hotels')
      .subscribe((data: MedHotel[]) => {
        this.options = data;
      });

    this.http.get<MedRoomCategory[]>(this.baseUrl + 'Opportunity/Categories')
      .subscribe((data: MedRoomCategory[]) => {
        this.allCategories = data;
      });

    const isMobile = this.deviceService.isMobile();
    // if (!isMobile) {
    //   const navigation = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');

    //   if (navigation) {
    //     // Toggle the opened status
    //     navigation.toggle();
    //   }
    // }
    this.filteredOptions = this.composeForm.controls['hotel'].valueChanges.pipe(
      startWith(''),
      map(value => {
        if (typeof value !== 'string') {
          this.fillCatAndBoard(value);
        }
        const name = typeof value === 'string' ? value : value?.name;
        return name ? this._filter(name as string) : this.options.slice();
      }),
    );
  }

  onFirstDataRendered(params: FirstDataRenderedEvent) {
    // this.countStatistics();
    this.gridApi = params.api;
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.columnApi = params.columnApi;
  }

  fillCatAndBoard(hotel: MedHotel) {
    if (hotel == null) return;
    // create categories for selected hotel
    this.http.get<any>(this.baseUrl + `Opportunity/CatAndBoards?hotelId=${hotel.hotelId}`)
      .subscribe((data: any) => {
        // console.log(data);
        this.selectedHotelData = data;
        this.categories = [];
        this.boards = [];

        for (let index = 0; index < data.length; index++) {
          const element = data[index];
          const mc = this.allCategories.find(i => i.categoryId == element.categoryId);
          if (!this.categories.some(i => i.categoryId == mc!.categoryId)) {
            this.categories.push(mc!);
          }
          const bd = this.allBoards.find(i => i.boardId == element.boardId);
          if (!this.boards.some(i => i.boardId == bd!.boardId)) {
            this.boards.push(bd!);
          }
        }
      });
  }
  private _filter(value: string): MedHotel[] {
    const filterValue = value.toLowerCase();
    if (this.options == null) return [];
    return this.options.filter(option => option.name.toLowerCase().includes(filterValue));
  }

  onSelectionChanged(e: SelectionChangedEvent<any>) {
    const selectedRows = this.gridApi.getSelectedRows();

    if (selectedRows.length > 0) {
      const row = selectedRows[0];

      if (row.items.length > 0) {
        const item = row.items[0];
        const dateFrom = new Date(this.composeForm.value.dateFromStr);
        const dateTo = new Date(this.composeForm.value.dateToStr);
        const hotelId = parseInt(item.hotelId);
        const categoryCode = item.category;
        const boardCode = item.board;
        const bedding = item.bedding;

        this._matDialog.open(OppFormComponent, {
          data: {
            defaultDateFrom: dateFrom,
            defaultDateTo: dateTo,
            defaultHotelId: hotelId,
            defaultCategoryCode: categoryCode,
            defaultBoardCode: boardCode,
            defaultBedding: bedding,
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
                });
            }
          });
      }

    }
  }

  search() {
    this.rowData = [];

    const search: SearchHotelRequest = {
      dateFrom: this.composeForm.value.dateFromStr,
      dateTo: this.composeForm.value.dateToStr,
      hotelId: this.composeForm.value.hotel.hotelId
    };

    this.composeForm.disable();

    this.gridApi.showLoadingOverlay();

    this.isLoading = true;

    this.http.post(this.baseUrl + 'Search/Search', search)
      .subscribe((data: any) => {
        let resultsCount = 0;
        let msg = 'Search done, results count: ';

        if (data) {
          this.rowData = data.results;
          resultsCount = data.results.length;
        }

        msg = msg + resultsCount;

        this._snackBar.open(msg, 'Close', {
          horizontalPosition: this.horizontalPosition,
          verticalPosition: this.verticalPosition,
          duration: this.durationInSeconds * 1000,
          panelClass: ['success-snackbar']
        });

        this.composeForm.enable();
        this.gridApi.hideOverlay();
        this.isLoading = false;
      });
  }
}
