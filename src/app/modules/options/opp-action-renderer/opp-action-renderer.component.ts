import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { environment } from 'src/app/environments/environment';
import { TableCommunicationService } from 'src/app/services/table-communication-service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-opp-action-renderer',
  templateUrl: './opp-action-renderer.component.html',
  styleUrls: ['./opp-action-renderer.component.scss']
})
export class OppActionRendererComponent implements OnInit, ICellRendererAngularComp {

  agGridApi: any;
  id: any;
  showCancelButton: boolean = true;
  baseUrl = environment.baseUrl;

  constructor(
    private dialog: MatDialog,
    private http: HttpClient,
    private comm: TableCommunicationService,
  ) { }
  agInit(params: ICellRendererParams<any, any>): void {
    this.agGridApi = params.api;
    this.id = params.data.id;
    this.showCancelButton = params.data.status;
  }
  refresh(params: ICellRendererParams<any, any>): boolean {
    this.showCancelButton = params.data.status;
    return true;
  }

  ngOnInit(): void {
  }

  openDialog() {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: "Cancel opportunity",
        message: "Are you sure you want to CANCEL this opportunity? <span class=\"font-medium\">This action cannot be undone!</span>"
      }
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.http.get(this.baseUrl + `Opportunity/CancelOpp?oppId=${this.id}`)
          .subscribe((data: any) => {
            this.comm.addItem(`delete_opp:${this.id}`);
          });
      }
    });
  }
}