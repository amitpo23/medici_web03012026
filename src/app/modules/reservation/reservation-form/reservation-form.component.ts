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
    const id = this.item.soldId || this.item.Id || this.item.id;
    this.http.get(this.baseUrl + `Reservation/GetDetails?id=${id}`)
      .subscribe((result: any) => {
        if (result) {
          this.newOrder = result;
          this.oldOrders = [];
          this.showTabs = false;
        }
      });
  }

  discard(): void {
    this.matDialogRef.close();
  }

}
