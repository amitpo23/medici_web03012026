import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { SalesRoomFormComponent } from '../sales-room-form/sales-room-form.component';

@Component({
  selector: 'app-sales-room-action-renderer',
  templateUrl: './sales-room-action-renderer.component.html',
  styleUrls: ['./sales-room-action-renderer.component.scss']
})
export class SalesRoomActionRendererComponent implements OnInit,ICellRendererAngularComp {

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
    this._matDialog.open(SalesRoomFormComponent,{ 
      width: '100%',
      data: {
          item: this.item,
      }
    });
  }
}
