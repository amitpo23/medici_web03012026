import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { CancelRoomFormComponent } from '../cancel-room-form/cancel-room-form.component';

@Component({
  selector: 'app-cancel-room-action-renderer',
  templateUrl: './cancel-room-action-renderer.component.html',
  styleUrls: ['./cancel-room-action-renderer.component.scss']
})
export class CancelRoomActionRendererComponent implements OnInit, ICellRendererAngularComp {

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
    this._matDialog.open(CancelRoomFormComponent,{ 
      width: '100%',
      data: {
          item: this.item,
      }
    });
  }

}
