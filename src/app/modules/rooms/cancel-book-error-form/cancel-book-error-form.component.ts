import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { environment } from 'src/app/environments/environment';

@Component({
  selector: 'app-cancel-book-error-form',
  templateUrl: './cancel-book-error-form.component.html',
  styleUrls: ['./cancel-book-error-form.component.scss']
})
export class CancelBookErrorFormComponent implements OnInit {

  baseUrl = environment.baseUrl;
  item: any;
  error: any;
  constructor(
    private http: HttpClient,
    @Inject(MAT_DIALOG_DATA) public data: any,
    public matDialogRef: MatDialogRef<CancelBookErrorFormComponent>,
  ) {
    this.item = data.item;
  }

  discard(): void {
    this.matDialogRef.close();
  }

  ngOnInit(): void {
    this.http.get(this.baseUrl + `Errors/GetCancelBookError?preBookId=${this.item}`)
      .subscribe((result: any) => {
        this.error = result;
      });
  }

}
