import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../../../app/environments/environment.prod';

type OrderStatus = 'pending_buy' | 'bought' | 'pending_sell' | 'sold' | 'cancel';

interface Order {
  id: number;
  orderId: string;
  hotelName: string;
  city: string;
  checkIn: Date;
  checkOut: Date;
  roomType: string;
  price: number;
  status: OrderStatus;
  orderRate?: number;
  currentRate?: number;
  createdAt?: Date;
  expiresAt?: Date;
  notes?: string;
  expanded?: boolean;
}

@Component({
  selector: 'app-orders-page',
  templateUrl: './orders-page.component.html',
  styleUrls: ['./orders-page.component.scss']
})
export class OrdersPageComponent implements OnInit {
  orders: Order[] = [];
  currentPage = 0;
  totalPages = 7;
  loading = false;

  filters = {
    hotel: '',
    city: '',
    minPrice: 10,
    maxPrice: 100
  };

  hotSaleHotels = [
    { id: 1, city: 'TLV', price: 80, imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=200&fit=crop' },
    { id: 2, city: 'TLV', price: 80, imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=200&fit=crop' },
    { id: 3, city: 'TLV', price: 80, imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&h=200&fit=crop' }
  ];

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    this.http.get<{ data: Order[] }>(`${environment.apiUrl}/trading-exchange/Orders`).subscribe({
      next: (response) => {
        this.orders = response.data || [];
        this.loading = false;
      },
      error: () => {
        // Mock data matching the template
        this.orders = [
          {
            id: 1, orderId: '23985238956', hotelName: 'TLV88', city: 'TLV',
            checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'),
            roomType: 'Classic', price: 120, status: 'pending_buy',
            orderRate: 14.023, currentRate: 13.04,
            createdAt: new Date('2018-11-19T20:59:00'), expiresAt: new Date('2018-11-20T20:59:00'),
            notes: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
          },
          {
            id: 2, orderId: '23985238957', hotelName: 'TLV88', city: 'TLV',
            checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'),
            roomType: 'Classic', price: 120, status: 'cancel'
          },
          {
            id: 3, orderId: '23985238958', hotelName: 'TLV88', city: 'TLV',
            checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'),
            roomType: 'Classic', price: 120, status: 'sold',
            orderRate: 14.023, currentRate: 13.04
          },
          {
            id: 4, orderId: '23985238959', hotelName: 'TLV88', city: 'TLV',
            checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'),
            roomType: 'Classic', price: 120, status: 'bought'
          },
          {
            id: 5, orderId: '23985238960', hotelName: 'TLV88', city: 'TLV',
            checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'),
            roomType: 'Classic', price: 120, status: 'pending_sell'
          },
          {
            id: 6, orderId: '23985238961', hotelName: 'TLV88', city: 'TLV',
            checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'),
            roomType: 'Classic', price: 120, status: 'sold'
          },
          {
            id: 7, orderId: '23985238962', hotelName: 'TLV88', city: 'TLV',
            checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'),
            roomType: 'Classic', price: 120, status: 'cancel'
          },
          {
            id: 8, orderId: '23985238963', hotelName: 'TLV88', city: 'TLV',
            checkIn: new Date('2018-10-21'), checkOut: new Date('2018-10-23'),
            roomType: 'Classic', price: 120, status: 'cancel'
          }
        ];
        this.loading = false;
      }
    });
  }

  toggleExpand(order: Order): void {
    this.orders.forEach(o => {
      if (o.id !== order.id) o.expanded = false;
    });
    order.expanded = !order.expanded;
  }

  cancelOrder(order: Order): void {
    this.snackBar.open(`Cancelling order ${order.orderId}...`, 'Close', {
      duration: 3000,
      panelClass: ['cancel-snackbar']
    });
    // API call would go here
    order.status = 'cancel';
  }

  editOrder(order: Order): void {
    this.snackBar.open(`Editing order ${order.orderId}...`, 'Close', {
      duration: 3000
    });
    // Would open edit dialog
  }

  getStatusIcon(status: OrderStatus): string {
    const icons: Record<OrderStatus, string> = {
      'pending_buy': 'schedule',
      'bought': 'shopping_bag',
      'pending_sell': 'pending',
      'sold': 'check_circle',
      'cancel': 'cancel'
    };
    return icons[status];
  }

  getStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      'pending_buy': 'Pending Buy',
      'bought': 'Bought',
      'pending_sell': 'Pending Sell',
      'sold': 'Sold',
      'cancel': 'Cancel'
    };
    return labels[status];
  }

  goToPage(page: number): void {
    this.currentPage = page;
    // Would reload data for that page
  }

  onSearch(): void {
    const params = new URLSearchParams();
    if (this.filters.hotel) params.set('hotel', this.filters.hotel);
    if (this.filters.city) params.set('city', this.filters.city);
    params.set('minPrice', String(this.filters.minPrice));
    params.set('maxPrice', String(this.filters.maxPrice));

    // Filter orders based on filters
    this.snackBar.open('Searching...', '', { duration: 1000 });
  }
}
