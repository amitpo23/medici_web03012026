import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-trading-dashboard',
  templateUrl: './trading-dashboard.component.html',
  styleUrls: ['./trading-dashboard.component.scss']
})
export class TradingDashboardComponent implements OnInit {
  navLinks = [
    { path: 'search', label: 'חיפוש וקנייה', icon: 'search' },
    { path: 'inventory', label: 'ניהול מלאי', icon: 'inventory' }
  ];

  constructor() { }

  ngOnInit(): void {
  }
}
