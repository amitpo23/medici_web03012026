import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBarRef, MAT_SNACK_BAR_DATA } from '@angular/material/snack-bar';
import { CancelBookErrorFormComponent } from 'app/cancel-book-error-form/cancel-book-error-form.component';

@Component({
  selector: 'app-error-snackbar',
  templateUrl: './error-snackbar.component.html',
  styleUrls: ['./error-snackbar.component.scss']
})
export class ErrorSnackbarComponent implements OnInit {

  item: any;

  doAction() {
    const dialogRef = this._matDialog.open(CancelBookErrorFormComponent,{ 
      disableClose: true,
      data: {
        item: this.item,        
      }
    });
  }

  close() {
    this._snackRef.dismiss(); 
  }

  constructor(
    private _matDialog: MatDialog,
    @Inject(MAT_SNACK_BAR_DATA) public data,
    private _snackRef: MatSnackBarRef<ErrorSnackbarComponent>,
  ) { 
    this.item = data;
  }

  ngOnInit(): void {
  }

}
