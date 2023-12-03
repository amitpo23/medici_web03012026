import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { environment } from 'src/app/environments/environment';

@Component({
  selector: 'app-cancel-room-form',
  templateUrl: './cancel-room-form.component.html',
  styleUrls: ['./cancel-room-form.component.scss']
})
export class CancelRoomFormComponent implements OnInit {
  baseUrl = environment.baseUrl;
  item: any;
  canceledRoom: any;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public matDialogRef: MatDialogRef<CancelRoomFormComponent>,
    private http: HttpClient,
  ) {
    this.item = data.item;
  }


  ngOnInit(): void {
    this.http.get(this.baseUrl + `Book/CancelDetails?id=${this.item.id}`)
      .subscribe((result: any) => {
        this.canceledRoom = result;
      });
  }

  discard(): void {
    this.matDialogRef.close();
  }

}
