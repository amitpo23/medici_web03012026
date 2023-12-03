import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { environment } from 'src/app/environments/environment';
import { OppLogFormComponent } from '../opp-log-form/opp-log-form.component';

@Component({
  selector: 'app-opp-log',
  templateUrl: './opp-log.component.html',
  styleUrls: ['./opp-log.component.scss']
})
export class OppLogComponent implements OnInit, ICellRendererAngularComp {

  agGridApi: any;
  id: any;
  baseUrl = environment.baseUrl;

  constructor(
    private _matDialog: MatDialog,
  ) { }
  agInit(params: ICellRendererParams<any, any>): void {
    this.agGridApi = params.api;
    this.id = params.data.id;
  }
  refresh(params: ICellRendererParams<any, any>): boolean {
    return false;
  }

  ngOnInit(): void {
  }

  openDialog() {
    this._matDialog.open(OppLogFormComponent, {
      width: '100%',
      data: {
        id: this.id
      }
    });
  }
}
