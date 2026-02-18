import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

export interface SyncStatus {
  status: string;
  message?: string;
  isRunning?: boolean;
  lastSync?: string;
  nextSync?: string;
}

export interface SyncHistoryItem {
  Id: number;
  SnapshotDate: string;
  TotalBookings: number;
  TotalRevenue: number;
  TotalProfit: number;
  ActiveRooms: number;
  OccupancyRate: number;
}

export interface ActiveRoom {
  HotelId: number;
  HotelName: string;
  RoomId: number;
  RoomType: string;
  Available: number;
  Price: number;
  LastUpdate: string;
}

export interface DashboardInfo {
  snapshotDate: string;
  totalBookings: number;
  totalRevenue: number;
  totalProfit: number;
  activeRooms: number;
  occupancyRate: number;
  rawData: Record<string, unknown> | null;
}

export interface SyncEndpointConfig {
  name: string;
  enabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DataSyncService {
  private apiUrl = `${environment.baseUrl}data-sync`;

  constructor(private http: HttpClient) {}

  getStatus(): Observable<SyncStatus> {
    return this.http.get<SyncStatus>(`${this.apiUrl}/status`);
  }

  triggerSync(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/trigger`, {});
  }

  getHistory(limit: number = 20): Observable<{ history: SyncHistoryItem[]; count: number }> {
    return this.http.get<{ history: SyncHistoryItem[]; count: number }>(`${this.apiUrl}/history?limit=${limit}`);
  }

  getActiveRooms(): Observable<{ rooms: ActiveRoom[]; count: number; lastUpdate: string }> {
    return this.http.get<{ rooms: ActiveRoom[]; count: number; lastUpdate: string }>(`${this.apiUrl}/rooms-active`);
  }

  getDashboardInfo(): Observable<DashboardInfo> {
    return this.http.get<DashboardInfo>(`${this.apiUrl}/dashboard-info`);
  }

  updateConfig(endpoints: SyncEndpointConfig[]): Observable<{ success: boolean; endpoints: SyncEndpointConfig[] }> {
    return this.http.put<{ success: boolean; endpoints: SyncEndpointConfig[] }>(`${this.apiUrl}/config`, { endpoints });
  }
}
