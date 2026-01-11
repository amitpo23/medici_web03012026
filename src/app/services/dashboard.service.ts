import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Temporary interfaces - will move to models later
export interface Patient {
  id: string;
  name: string;
  age: number;
  condition: string;
  lastVisit: string;
  status: 'stable' | 'critical' | 'improving';
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  dateTime: string;
  type: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  pendingConsultations: number;
  criticalCases: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = 'https://medici-backend-dev.azurewebsites.net/api';

  constructor(private http: HttpClient) {}

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/dashboard/stats`);
  }

  getPatients(): Observable<Patient[]> {
    return this.http.get<Patient[]>(`${this.apiUrl}/patients`);
  }

  getTodayAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.apiUrl}/appointments/today`);
  }
}