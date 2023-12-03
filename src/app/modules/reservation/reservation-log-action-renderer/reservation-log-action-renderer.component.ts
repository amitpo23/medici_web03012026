import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { ReservationLogFormComponent } from '../reservation-log-form/reservation-log-form.component';

@Component({
  selector: 'app-reservation-log-action-renderer',
  templateUrl: './reservation-log-action-renderer.component.html',
  styleUrls: ['./reservation-log-action-renderer.component.scss']
})
export class ReservationLogActionRendererComponent implements OnInit,ICellRendererAngularComp {

  agGridApi: any;
  item: any;

  constructor(
    private _matDialog: MatDialog,
  ) { }
  agInit(params: ICellRendererParams<any, any>): void {
    this.agGridApi = params.api;
    this.item = params.data;
  }
  refresh(params: ICellRendererParams<any, any>): boolean {
    return true;
  }

  ngOnInit(): void {
  }

  openDialog() {
    const dialogRef = this._matDialog.open(ReservationLogFormComponent,{ 
      disableClose: true,
      width: '100%',
      data: {
          item: this.item,
      }
    });
  }
 
}
