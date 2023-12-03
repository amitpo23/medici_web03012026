import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { ReservationFormComponent } from '../reservation-form/reservation-form.component';

@Component({
  selector: 'app-reservation-action-renderer',
  templateUrl: './reservation-action-renderer.component.html',
  styleUrls: ['./reservation-action-renderer.component.scss']
})
export class ReservationActionRendererComponent implements OnInit,ICellRendererAngularComp {

  agGridApi: any; 
  item: any;

  constructor(
    private _matDialog: MatDialog,
  ) { }

  ngOnInit(): void {
  }

  agInit(params: ICellRendererParams<any, any>): void {
    this.agGridApi = params.api;
    this.item = params.data;
  }
  refresh(params: ICellRendererParams<any, any>): boolean {
    return true;
  }

  openDialog() {
    this._matDialog.open(ReservationFormComponent,{ 
      width: '100%',
      data: {
          item: this.item,
      }
    });
  }
}
