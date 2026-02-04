import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

export interface DashboardOverview {
  TotalBookings: number;
  TotalCost: number;
  TotalPushPrice: number;
  TotalExpectedProfit: number;
  AvgMargin: number;
  AvgBookingCost: number;
  SoldCount: number;
  ActiveCount: number;
  CancelledCount: number;
  ConversionRate: string;
}

export interface DashboardReservations {
  TotalReservations: number;
  TotalRevenue: number;
  CancelledReservations: number;
}

export interface DailyTrend {
  Date: string;
  Bookings: number;
  Cost: number;
  PushPrice: number;
}

export interface DashboardStats {
  overview: DashboardOverview;
  reservations: DashboardReservations;
  dailyTrend: DailyTrend[];
}

export interface DashboardAlert {
  type: 'warning' | 'info' | 'error';
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface HotelPerformance {
  HotelName: string;
  HotelId: number;
  TotalBookings: number;
  TotalCost: number;
  Profit: number;
  MarginPercent: number;
  SoldCount: number;
}

export interface ForecastDay {
  Date: string;
  BookingCount: number;
  ExpectedRevenue: number;
  ExpectedProfit: number;
}

export interface ForecastResponse {
  summary: {
    TotalExpectedRevenue: number;
    TotalExpectedProfit: number;
    TotalBookings: number;
  };
  daily: ForecastDay[];
}

export interface WorkerStatus {
  buyroom: { enabled: boolean; status: string };
  cancellation: { enabled: boolean; status: string };
  priceUpdate: { enabled: boolean; status: string };
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getStats(period: number = 30): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.baseUrl}dashboard/Stats?period=${period}`);
  }

  getAlerts(): Observable<DashboardAlert[]> {
    return this.http.get<DashboardAlert[]>(`${this.baseUrl}dashboard/Alerts`);
  }

  getHotelPerformance(limit: number = 10): Observable<HotelPerformance[]> {
    return this.http.get<HotelPerformance[]>(`${this.baseUrl}dashboard/HotelPerformance?limit=${limit}`);
  }

  getForecast(days: number = 30): Observable<ForecastResponse> {
    return this.http.get<ForecastResponse>(`${this.baseUrl}dashboard/Forecast?days=${days}`);
  }

  getWorkerStatus(): Observable<WorkerStatus> {
    return this.http.get<WorkerStatus>(`${this.baseUrl}dashboard/WorkerStatus`);
  }
}
