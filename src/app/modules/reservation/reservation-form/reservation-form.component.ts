import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { environment } from 'src/app/environments/environment';

@Component({
  selector: 'app-reservation-form',
  templateUrl: './reservation-form.component.html',
  styleUrls: ['./reservation-form.component.scss']
})
export class ReservationFormComponent implements OnInit {

  baseUrl = environment.baseUrl;
  item: any;
  newOrder: any;
  oldOrders: any;
  showTabs = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public matDialogRef: MatDialogRef<ReservationFormComponent>,
    private http: HttpClient,
  ) {
    this.item = data.item;
  }

  ngOnInit(): void {
    this.http.get(this.baseUrl + `Reservation/GetDetails?soldId=${this.item.soldId}`)
      .subscribe((result: any) => {
        // console.log(result);
        this.newOrder = result.newOrder;
        this.oldOrders = result.oldOrders;
        if (this.oldOrders.length == 0) {
          this.showTabs = false;
        }
      });
  }

  discard(): void {
    this.matDialogRef.close();
  }

}
