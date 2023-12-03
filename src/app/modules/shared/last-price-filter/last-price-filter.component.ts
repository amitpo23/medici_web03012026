import { Component, OnInit } from '@angular/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IFilterParams, IDoesFilterPassParams, AgPromise, IAfterGuiAttachedParams } from 'ag-grid-community';

@Component({
  selector: 'app-last-price-filter',
  templateUrl: './last-price-filter.component.html',
  styleUrls: ['./last-price-filter.component.scss']
})
export class LastPriceFilterComponent implements OnInit, IFilterAngularComp {

  params!: IFilterParams;
  price = 'all';

  constructor() { }

  updateFilter() {
    this.params.filterChangedCallback();
  }

  agInit(params: IFilterParams<any>): void {
    this.params = params;
  }
  isFilterActive(): boolean {
    if (this.price === 'all') {
      return false;
    }
    return true;
  }
  doesFilterPass(params: IDoesFilterPassParams<any>): boolean {
    if (this.price === 'all') {
      return true;
    }
    if (this.price === 'up') {
      if (params.data.price < params.data.lastPrice) {
        return true;
      }
      else {
        return false;
      }
    }
    if (this.price === 'down') {
      if (params.data.lastPrice > 0 && params.data.lastPrice < params.data.price) {
        return true;
      }
      else {
        return false;
      }
    }

    return false;
  }

  getModel() { }

  setModel(model: any): void | AgPromise<void> { }

  ngOnInit(): void {
  }

}
