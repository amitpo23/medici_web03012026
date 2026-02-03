import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { environment } from 'src/app/environments/environment';

interface TopRoom {
  hotelName: string;
  checkIn: string;
  checkOut: string;
  buyPrice: number;
  pushPrice: number;
  profit: number;
  margin: number;
  guestName?: string;
}

@Component({
  selector: 'app-top-rooms-widget',
  templateUrl: './top-rooms-widget.component.html',
  styleUrls: ['./top-rooms-widget.component.scss']
})
export class TopRoomsWidgetComponent implements OnInit {
  topProfitableRooms: TopRoom[] = [];
  topNonProfitableRooms: TopRoom[] = [];
  isLoading = true;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTopRooms();
  }

  loadTopRooms(): void {
    this.isLoading = true;

    // Get top 10 profitable rooms
    this.http.get<any[]>(`${environment.baseUrl}reports/TopHotels?limit=10&sortBy=profit`).subscribe({
      next: (data) => {
        this.topProfitableRooms = data;
      },
      error: (error) => {
        console.error('Error loading top profitable rooms:', error);
      }
    });

    // Get top 10 non-profitable (loss) rooms
    this.http.get<any[]>(`${environment.baseUrl}reports/LossReport?limit=10`).subscribe({
      next: (data) => {
        this.topNonProfitableRooms = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading loss rooms:', error);
        this.isLoading = false;
      }
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  }

  formatPercent(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  getMarginClass(margin: number): string {
    if (margin >= 20) return 'high-margin';
    if (margin >= 10) return 'medium-margin';
    if (margin >= 0) return 'low-margin';
    return 'negative-margin';
  }
}
