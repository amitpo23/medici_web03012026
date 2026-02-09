import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { environment } from 'src/app/environments/environment';
import { Board } from 'src/app/core/models/board';
import { MedHotel } from 'src/app/core/models/med-hotel';
import { MedRoomCategory } from 'src/app/core/models/med-room-category';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-opp-form',
  templateUrl: './opp-form.component.html',
  styleUrls: ['./opp-form.component.scss']
})
export class OppFormComponent implements OnInit {

  baseUrl = environment.baseUrl;
  composeForm: FormGroup;
  options: MedHotel[] = [];
  allCategories: MedRoomCategory[];
  categories!: MedRoomCategory[];
  allBoards: Board[] = [];
  boards!: Board[];
  selectedHotelData!: any[];
  otherValidationError = false;
  validationErrorText = '';
  selectedHotelIdInput: number = 0;
  selectedDateFromInput: Date;
  selectedDateToInput: Date;
  selectedBoardIdInput: number = 0;
  selectedCategoryIdInput: number = 0;

  filteredOptions!: Observable<MedHotel[]>;

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

    // this.composeForm.controls['dateTo'].setValue(selectedDate);
    // this.composeForm.controls['dateToStr'].setValue(event);
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

    // this.composeForm.controls['dateFrom'].setValue(sd);
    // this.composeForm.controls['dateFromStr'].setValue(event);
    // update dateTo
    const sdt = sd;
    sdt.setDate(sd.getDate() + 1);
    // this.composeForm.controls['dateTo'].setValue(sdt);
    this.selectedDateToInput = sd;
    dtf = this.getStringFromDate(sd);
    this.composeForm.controls['dateToStr'].setValue(dtf);
  }

  getStringFromDate(dt: Date): string {
    const yearFrom = dt.getFullYear();
    const monthFrom = dt.getMonth() + 1;
    const dayFrom = dt.getDate();
    return `${yearFrom}-${monthFrom}-${dayFrom}`;
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

  constructor(
    public matDialogRef: MatDialogRef<OppFormComponent>,
    private dialog: MatDialog,
    private _formBuilder: FormBuilder,
    private http: HttpClient,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    let selectedDateFrom = new Date();
    selectedDateFrom.setDate(selectedDateFrom.getDate() + 30);
    this.selectedDateFromInput = selectedDateFrom;

    if (data.defaultDateFrom != null) {
      selectedDateFrom = data.defaultDateFrom;
      this.selectedDateFromInput = data.defaultDateFrom;
    }

    const yearFrom = selectedDateFrom.getFullYear();
    const monthFrom = selectedDateFrom.getMonth();
    const dayFrom = selectedDateFrom.getDate();

    const selectedDateTo = new Date(yearFrom, monthFrom, dayFrom);
    selectedDateTo.setDate(selectedDateTo.getDate() + 1);
    this.selectedDateToInput = selectedDateTo;
    if (data.defaultDateTo != null) {
      this.selectedDateToInput = data.defaultDateTo;
    }

    this.options = data.allHotels;
    this.allBoards = data.allBoards;
    this.allCategories = data.allCategories;

    this.composeForm = this._formBuilder.group({
      hotel: ['', [Validators.required]],

      dateFromStr: ['', [Validators.required]],

      dateToStr: ['', [Validators.required]],
      category: [
        '', [Validators.required]
      ],
      board: [
        '', [Validators.required]
      ],
      ratePlanCode: [
        '', [Validators.required]
      ],
      invTypeCode: [
        '', [Validators.required]
      ],
      buyPrice: [
        '1', [
          Validators.required,
          Validators.min(1),
          Validators.max(10000),

        ]
      ],
      pushPrice: [
        '1', [
          Validators.required,
          Validators.min(1),
          Validators.max(10000),

        ]
      ],
      maxRoomsPerNight: [
        '1', [Validators.required, Validators.min(1), Validators.max(30)]
      ],
      reservationFullName: [
        '', [Validators.required, this.fullNameValidator()]
      ],
    });

    // save canonical date string 
    let dtf = this.getStringFromDate(this.selectedDateFromInput);
    this.composeForm.controls['dateFromStr'].setValue(dtf);

    dtf = this.getStringFromDate(this.selectedDateToInput);
    this.composeForm.controls['dateToStr'].setValue(dtf);

    if (data.defaultHotelId != null) {
      this.selectedHotelIdInput = data.defaultHotelId;
    }

    if (data.defaultCategoryCode != null) {
      const category = this.allCategories.find(x => x.name.toLocaleLowerCase() == data.defaultCategoryCode.toLocaleLowerCase());

      console.log(data.defaultCategoryCode);
      console.log(this.allCategories);
      console.log(category);
    }

    if (data.defaultBoardId != null) {
      this.selectedBoardIdInput = data.defaultBoardId;
    }

  }

  fullNameValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const split = control.value.split(' ').filter(Boolean);
      const error = split.length < 2;
      return error ? { fullName: { value: control.value } } : null;
    };
  }

  priceValidatorError(): boolean {
    // Use parseFloat instead of parseInt to handle decimal prices properly
    const buyPriceValue = parseFloat(this.buyPrice!.value);
    const pushPriceValue = parseFloat(this.pushPrice!.value);
    
    // Check for valid numbers and ensure buy price is not greater than push price
    if (isNaN(buyPriceValue) || isNaN(pushPriceValue)) {
      return true; // Invalid if either price is not a valid number
    }
    
    const error = buyPriceValue > pushPriceValue;
    return error;
  }
  dateValidatorError(): boolean {
    const dtFrom = this.getDateTimeFromString(this.composeForm.controls['dateFromStr'].value);
    const dtTo = this.getDateTimeFromString(this.composeForm.controls['dateToStr'].value);

    const error = dtFrom >= dtTo;
    return error;
  }
  ngAfterViewInit(): void {

  }
  ngOnInit(): void {

    this.http.get(this.baseUrl + 'Opportunity/ReservationFullName')
      .subscribe((data: any) => {
        this.composeForm.controls['reservationFullName'].setValue(data.fullName);
      });

    this.composeForm.controls['buyPrice'].valueChanges.subscribe(data => {
      if (data != null && data != '') {
        let pushPrice = Number.parseFloat(data);
        pushPrice = pushPrice * 1.05;
        this.composeForm.controls['pushPrice'].setValue(pushPrice);

      }
    });

    this.filteredOptions = this.composeForm.controls['hotel'].valueChanges.pipe(
      // startWith(''),
      map(value => {
        console.log(value);
        if (typeof value !== 'string') {
          this.fillCatAndBoard(value);
        }
        const name = typeof value === 'string' ? value : value?.name;
        return name ? this._filter(name as string) : this.options.slice();
      }),
    );

    this.composeForm.controls['board'].valueChanges.subscribe(data => {
      const cc = this.selectedHotelData.filter(i => i.boardId == data.boardId);
      if (cc != null) {
        const currCateg = this.category;
        const ccc = cc.find(i => i.categoryId == currCateg!.value.categoryId);
        if (ccc == null) {
          // category is not selected yet
          const plnCode = cc.find(i => i.boardId == data.boardId);
          if (plnCode != null) {
            this.composeForm.controls['ratePlanCode'].setValue(plnCode.ratePlanCode ?? '[N/A]');
          }
          else {
            this.composeForm.controls['ratePlanCode'].setValue('[N/A]');
          }
        }
        else {
          this.composeForm.controls['ratePlanCode'].setValue(ccc.ratePlanCode ?? '[N/A]');
        }

      }
    });

    this.composeForm.controls['category'].valueChanges.subscribe(data => {
      const cc = this.selectedHotelData.filter(i => i.categoryId == data.categoryId);
      for (let index = 0; index < cc.length; index++) {
        const element = cc[index];
        let invTypeCodeStr = element.invTypeCode.toLowerCase();
        if (invTypeCodeStr == 'std') invTypeCodeStr = 'sta';
        if (invTypeCodeStr == 'apt') invTypeCodeStr = 'apa';
        const dataName = data.name.toLowerCase();
        if (dataName.indexOf(invTypeCodeStr) != -1) {
          this.composeForm.controls['invTypeCode'].setValue(element.invTypeCode);
          break;
        }
      }
    });

    if (this.selectedHotelIdInput) {
      const element = this.options.find(x => x.hotelId == this.selectedHotelIdInput);

      if (element) {
        this.composeForm.controls['hotel'].setValue(element);
        this.composeForm.patchValue({ hotel: element });

        this.fillCatAndBoard(element);
      }
      // if (element) this.composeForm.controls['hotel'].setValue(element);
    }
  }

  get buyPrice() { return this.composeForm.get('buyPrice'); }
  get pushPrice() { return this.composeForm.get('pushPrice'); }
  get maxRoomsPerNight() { return this.composeForm.get('maxRoomsPerNight'); }
  get reservationFullName() { return this.composeForm.get('reservationFullName'); }
  get category() { return this.composeForm.get('category'); }

  displayFn(hotel: MedHotel): string {
    const currentName = hotel && hotel.name ? hotel.name : '';
    return currentName;
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

  discard(): void {
    this.matDialogRef.close();
  }

  save(): void {
    this.otherValidationError = false;
    this.validationErrorText = '';
    // console.log('start price validation');
    if (this.priceValidatorError()) {
      this.otherValidationError = true;
      this.validationErrorText = 'Push Price can not be less then Buy Price';
      return;
    }
    // console.log('end price validation');
    // console.log('start date validation');
    if (this.dateValidatorError()) {
      this.otherValidationError = true;
      this.validationErrorText = 'End Date can not be less or equal then Start Date';
      return;
    }
    // console.log('end date validation');

    const buyPrice = Number.parseInt(this.buyPrice!.value);
    const pushPrice = Number.parseInt(this.pushPrice!.value);
    if (buyPrice == 1 || pushPrice == 1) {
      this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: "Buy Price, Push Price warning",
          message: "Are you sure you want to SAVE this prices?"
        }
      }).afterClosed().subscribe((result: any) => {
        if (result) {
          this.matDialogRef.close(this.composeForm.value);
        }
        else {
          this.composeForm.controls['category'].setErrors({ 'incorrect': false });
        }
      });

      //  console.log('saving started:' + this.composeForm.value);
      this.composeForm.controls['category'].setErrors({ 'incorrect': true });
      //  confirmation.afterClosed().subscribe((result) => {
      //   if ( result === 'confirmed' ){
      this.matDialogRef.close(this.composeForm.value);
      //   }
      //   else{
      //     this.composeForm.controls['category'].setErrors({'incorrect': false});
      //   }
      // });
    }
    else {
      this.composeForm.controls['category'].setErrors({ 'incorrect': true });
      this.matDialogRef.close(this.composeForm.value);
    }
  }
}
