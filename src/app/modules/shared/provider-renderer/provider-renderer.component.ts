import { Component, OnInit } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { environment } from 'src/app/environments/environment';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-provider-renderer',
  templateUrl: './provider-renderer.component.html',
  styleUrls: ['./provider-renderer.component.scss']
})
export class ProviderRendererComponent implements OnInit, ICellRendererAngularComp {

  agGridApi: any;
  baseUrl = environment.baseUrl;
  item: any;

  constructor(
    private dialog: MatDialog,
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
    const msg = `Reference Agency: ${this.item.refAgency} <br/>Reference Voucher Email: ${this.item.refEmail}`;

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: "Provider Reference",
        message: msg
      }
    });
  }
}
