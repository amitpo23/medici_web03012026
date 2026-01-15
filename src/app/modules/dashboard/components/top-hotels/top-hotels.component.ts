import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface HotelStats {
  hotelName: string;
  revenue: number;
  profit: number;
  profitMargin: number;
  bookings: number;
}

@Component({
  selector: 'app-top-hotels',
  templateUrl: './top-hotels.component.html',
  styleUrls: ['./top-hotels.component.scss']
})
export class TopHotelsComponent implements OnInit {
  baseUrl = environment.baseUrl;
  topHotels: HotelStats[] = [];
  loading = true;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTopHotels();
  }

  loadTopHotels(): void {
    this.http.get<any[]>(this.baseUrl + 'Book/Bookings').subscribe({
      next: (bookings) => {
        this.processHotelStats(bookings);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading hotel stats:', err);
        this.loading = false;
      }
    });
  }

  processHotelStats(bookings: any[]): void {
    const hotelStats = new Map<string, HotelStats>();

    bookings.forEach(booking => {
      if (booking.IsCanceled || !booking.HotelName) return;

      const hotelName = booking.HotelName;
      const revenue = booking.lastPrice || booking.pushPrice || 0;
      const cost = booking.price || 0;
      const profit = revenue - cost;

      if (!hotelStats.has(hotelName)) {
        hotelStats.set(hotelName, {
          hotelName,
          revenue: 0,
          profit: 0,
          profitMargin: 0,
          bookings: 0
        });
      }

      const stats = hotelStats.get(hotelName)!;
      stats.revenue += revenue;
      stats.profit += profit;
      stats.bookings++;
    });

    // Calculate profit margins and sort by profit
    this.topHotels = Array.from(hotelStats.values())
      .map(stats => ({
        ...stats,
        profitMargin: stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }

  getProfitColor(profitMargin: number): string {
    if (profitMargin >= 30) return 'high-profit';
    if (profitMargin >= 15) return 'medium-profit';
    return 'low-profit';
  }

  getRankClass(index: number): string {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return '';
  }
}
