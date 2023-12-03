import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CellClickedEvent, ColDef, ColumnApi, FirstDataRenderedEvent, GridApi, GridReadyEvent } from 'ag-grid-community';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

@Component({
  selector: 'app-opp-log-form',
  templateUrl: './opp-log-form.component.html',
  styleUrls: ['./opp-log-form.component.scss']
})
export class OppLogFormComponent implements OnInit {

  private gridApi!: GridApi<any>;
  private columnApi!: ColumnApi;
  public paginationPageSize = 50;
  public rowData$!: Observable<any[]>;
  baseUrl = environment.baseUrl;
  id: number;
  constructor(
    private http: HttpClient,
    @Inject(MAT_DIALOG_DATA) public data: any,
    public matDialogRef: MatDialogRef<OppLogFormComponent>,
  ) { 
    this.id = data.id;
  }

  ngOnInit(): void {
  }

  onCellClicked( e: CellClickedEvent): void {
    // console.log('cellClicked', e);
  }

  onFirstDataRendered(params: FirstDataRenderedEvent) {
    // this.countStatistics();
  }

  onGridReady(params: GridReadyEvent) {
    this.gridApi = params.api;
    this.columnApi = params.columnApi;
   
    this.refreshData(this.id);
 }

 refreshData(id: number) {  
  this.rowData$ = this.http.get<any[]>(this.baseUrl + 'Opportunity/Log?id=' + id);
 }

  dateFormatter(params:any) {
    let dateAsString = params.value;
    // remove time
    let dateOnly = dateAsString.split('T');

    let dateParts = dateOnly[0].split('-');
    return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
  }

  perfirmDateFilter(filterLocalDateAtMidnight:any, cellValue:any) {
    if (cellValue == null) {
        return 0;
    }
    let dateOnly = cellValue.split('T');
    let dateParts = dateOnly[0].split('-');
    let year = Number(dateParts[0]);
    let month = Number(dateParts[1]) - 1;
    let day = Number(dateParts[2]);
    let cellDate = new Date(year, month, day);

    if (cellDate < filterLocalDateAtMidnight) {
    return -1;
    } else if (cellDate > filterLocalDateAtMidnight) {
    return 1;
    } else {
    return 0;
    }
  }

  public defaultColDef: ColDef = {
    flex: 1,
    minWidth: 150,
    filter: true,
    sortable: true,
    floatingFilter: true,
    resizable: true,
  };

  close(): void
  {
    this.matDialogRef.close();
  }

  columnDefs: ColDef[] = [
    { 
      field: 'createDate',
      headerName: 'Create Date',            
      filter: 'agDateColumnFilter',
      maxWidth: 150,
      valueFormatter: this.dateFormatter,            
      filterParams: {
          suppressAndOrCondition: true,
          comparator: this.perfirmDateFilter,
          buttons: ['apply', 'reset'],
          closeOnApply: true,
      },
    },
    {
      field: 'backOfficeOppId',
      headerName: 'Opportunity Id',  
      maxWidth: 150,
      filter: 'agNumberColumnFilter',
            filterParams: {
                buttons: ['apply', 'reset'],
                closeOnApply: true,
            },
    },
    {
      field: 'content',
      headerName: 'Content',  
      filter: 'agTextColumnFilter',
            filterParams: {
                buttons: ['apply', 'reset'],
                closeOnApply: true,
            },
      cellRenderer: (params:any) => {
        if (params.value.indexOf('price:') != -1){
            return '<span style="color:green">'+params.value+'</span>';
        }
        else {
          return '<span style="color:red">'+params.value+'</span>';
        }
      },
    },
  ]
}
