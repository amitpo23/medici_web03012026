import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { Booking } from 'src/app/core/models/booking';
import { environment } from 'src/app/environments/environment';
import { TableCommunicationService } from 'src/app/services/table-communication-service';
import { ActiveRoomFormComponent } from '../active-room-form/active-room-form.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-bool-action-renderer',
  templateUrl: './bool-action-renderer.component.html',
  styleUrls: ['./bool-action-renderer.component.scss']
})
export class BoolActionRendererComponent implements OnInit, ICellRendererAngularComp {

  agGridApi: any;
  id: any;
  baseUrl = environment.baseUrl;
  item: any;

  constructor(
    private http: HttpClient,
    private comm: TableCommunicationService,
    private dialog: MatDialog
  ) { }
  agInit(params: ICellRendererParams<any, any>): void {
    this.agGridApi = params.api;
    this.item = params.data;
    this.id = params.data.id;
  }
  refresh(params: ICellRendererParams<any, any>): boolean {
    return true;
  }

  ngOnInit(): void {
  }

  openDialogChangeStatus() {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: "Set status Canceled",
        message: "Are you sure you want to set status CANCELED to this room? <span class=\"font-medium\">This action cannot be undone!</span>"
      }
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.http.delete(this.baseUrl + `Book/SetCancelStatus?id=${this.id}`)
          .subscribe((data: any) => {
            if (data == false) {
              this.comm.addItem(`set_status_booking_error:${this.id}`);
            }
            else {
              this.comm.addItem(`set_status_cancel:${this.id}`);
            }
          });
      }
    });
  }

  openDialogCancel() {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: "Cancel room",
        message: "Are you sure you want to CANCEL this room? <span class=\"font-medium\">This action cannot be undone!</span>"
      }
    }).afterClosed().subscribe((result) => {
      if (result) {
        this.http.delete(this.baseUrl + `Book/CancelBooking?id=${this.id}`)
          .subscribe((data: any) => {
            if (data == false) {
              // alert('Error Booking Cancelation');
              this.comm.addItem(`delete_booking_error:${this.id}`);
            }
            else {
              const saveObj = { bookingId: this.id, result: data };

              let toSaveStr = JSON.stringify(saveObj);
              toSaveStr = toSaveStr.split(':').join('@');
              this.comm.addItem(`delete_booking:${toSaveStr}`);
            }

          });
      }
    });
  }

  openDialogEditPushPrice() {
    this.dialog.open(ActiveRoomFormComponent, {
      data: {
        item: this.item,
      },
      width: '75%',
      height: '75%',
    }).afterClosed()
      .subscribe((result: any) => {
        if (result != null) {

          const toSave: Booking = {
            preBookId: result.preBookId,
            buyPrice: result.buyPrice,
            pushPrice: result.currentPrice,
            // lastPrice: lp,
          };
          this.http.post(
            this.baseUrl + 'Book/UpdatePrice',
            toSave)
            .subscribe((bookingResult: any) => {
              if (bookingResult) {
                let toSaveStr = JSON.stringify(bookingResult);
                toSaveStr = toSaveStr.split(':').join('@');

                this.comm.addItem(`update_booking:${toSaveStr}`);
              }
              else {
                this.comm.addItem(`update_booking_error:${toSave.preBookId}`);
              }
            });
        }
      });
  }
}
