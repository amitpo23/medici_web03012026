import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { environment } from 'src/app/environments/environment';
import { TableCommunicationService } from 'src/app/services/table-communication-service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { UpdateNameResult } from 'src/app/core/models/update-name-result';

@Component({
  selector: 'app-sales-room-form',
  templateUrl: './sales-room-form.component.html',
  styleUrls: ['./sales-room-form.component.scss']
})
export class SalesRoomFormComponent implements OnInit {

  baseUrl = environment.baseUrl;
  item: any;
  showBtnUpdateName = true;
  newOrder: any;
  oldOrder: any;
  showError = false;
  errorMessage = '';
  selected = '1';

  options = [
    { value: '0', text: 'Name Not Updated' },
    { value: '1', text: 'Updated Name Sent To Hotel' },
    { value: '2', text: 'Name Updated Seccess' },
  ];

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: any,
    public matDialogRef: MatDialogRef<SalesRoomFormComponent>,
    private comm: TableCommunicationService,
  ) {
    this.item = data.item;
  }

  ngOnInit(): void {

    this.http.get(this.baseUrl + `SalesRoom/GetDetails?id=${this.item.id}`)
      .subscribe((result: any) => {
        // console.log(result);
        this.newOrder = result.newOrder;
        this.oldOrder = result.oldOrder;
      });
  }

  updateName() {
    this.errorMessage = '';
    this.showError = false;
    const txt = this.options.find(i => i.value == this.selected)!.text;

    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: "Update Name",
        message: "Are you sure you want to set status of Update Name to '" + txt + "'?"
      }
    }).afterClosed().subscribe((result: any) => {
      const toSave: UpdateNameResult = {
        id: this.item.id,
        result: Number.parseInt(this.selected),
      };

      this.http.post(this.baseUrl + 'SalesRoom/UpdateNameSuccess', toSave)
        .subscribe((result: any) => {
          if (result.result == -1) {
            this.errorMessage = 'Update Name Error';
            this.showError = true;
          }
          else {
            let toSaveStr = JSON.stringify(toSave);
            toSaveStr = toSaveStr.split(':').join('@');
            this.comm.addItem(`set_update_name_success:${toSaveStr}`);
          }
        });
    });
  }

  discard(): void {
    this.matDialogRef.close();
  }
}
