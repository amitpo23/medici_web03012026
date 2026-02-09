import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import xmlFormat from 'xml-formatter';

@Component({
  selector: 'app-reservation-log-form',
  templateUrl: './reservation-log-form.component.html',
  styleUrls: ['./reservation-log-form.component.scss']
})
export class ReservationLogFormComponent implements OnInit {

  item: any;
  xml: string = '';
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public matDialogRef: MatDialogRef<ReservationLogFormComponent>,
  ) {
    this.item = data.item;
   }

  ngOnInit(): void {
    this.xml = this.item?.requestContent
      ? xmlFormat(this.item.requestContent, {
          indentation: '  ',
          collapseContent: true,
          lineSeparator: '\n'
        })
      : '';
  }

  discard(): void
  {
    this.matDialogRef.close();
  }

}
