import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { environment } from 'src/app/environments/environment';

@Component({
  selector: 'app-active-room-form',
  templateUrl: './active-room-form.component.html',
  styleUrls: ['./active-room-form.component.scss']
})
export class ActiveRoomFormComponent implements OnInit {

  baseUrl = environment.baseUrl;
  composeForm: FormGroup;
  otherValidationError = false;
  validationErrorText = '';
  
  get buyPrice() { return this.composeForm.get('buyPrice'); }
  get preBookId() { return this.composeForm.get('preBookId'); }
  // get lastPrice() { return this.composeForm.get('lastPrice'); }
  get currentPrice() { return this.composeForm.get('currentPrice'); }

  priceFormat(price: number) : number {
    const presise = 100;
        if (price) {
            const num = Math.round((price + Number.EPSILON) * presise) / presise;
            return num;
        }
        else {
          return 0;
        }
  }
  constructor(
    public matDialogRef: MatDialogRef<ActiveRoomFormComponent>,
    private _formBuilder: FormBuilder,
    private http: HttpClient,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) { 
    const buyPrice = this.priceFormat(data.item.price);
    const currentPrice = this.priceFormat(data.item.pushPrice);
    this.composeForm = this._formBuilder.group({
      preBookId : [
        data.item.id, [
          Validators.required, 
          Validators.min(1), 
          Validators.max(1000000),
        
        ]
      ],
      buyPrice : [
        buyPrice, [
          Validators.required, 
          Validators.min(1), 
          Validators.max(10000),
        
        ]
      ],
      // lastPrice : [
      //   '', [          
      //     Validators.min(1), 
      //     Validators.max(10000),        
      //   ]
      // ],  
      currentPrice : [
        currentPrice, [
          Validators.required, 
          Validators.min(1), 
          Validators.max(10000), 
        ]
      ],      
    });  
  }

  priceValidatorError(): boolean {
    const error = Number.parseInt(this.buyPrice!.value) > Number.parseInt(this.currentPrice!.value);
    return error;
}

  ngOnInit(): void {
  }

  save() {
    this.otherValidationError = false;
    this.validationErrorText = '';
    if (this.priceValidatorError()) {
      this.otherValidationError = true;
      this.validationErrorText = 'Current Price can not be less then Buy Price';
      return;
    }
    this.matDialogRef.close(this.composeForm.value);
  }

  discard(): void
  {
    this.matDialogRef.close();
  }
}
