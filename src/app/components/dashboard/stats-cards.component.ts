import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';

export interface StatCard {
  title: string;
  value: string;
  change: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-stats-cards',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats-cards.component.html',
  styleUrls: ['./stats-cards.component.css']
})
export class StatsCardsComponent implements OnInit {
  stats: StatCard[] = [];
  loading = true;
  error: string | null = null;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.dashboardService.getStats().subscribe({
      next: (data: DashboardStats) => {
        this.stats = [
          {
            title: 'Total Patients',
            value: data.totalPatients.toString(),
            change: '+12.5%',
            icon: 'users',
            description: 'Active patients'
          },
          {
            title: 'Appointments Today',
            value: data.todayAppointments.toString(),
            change: '+3',
            icon: 'calendar',
            description: 'Scheduled for today'
          },
          {
            title: 'Pending Consultations',
            value: data.pendingConsultations.toString(),
            change: '-2',
            icon: 'clock',
            description: 'Awaiting review'
          }
        ];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading stats:', err);
        this.error = 'Failed to load statistics';
        this.loading = false;
        // Fallback to static data
        this.stats = [
          {
            title: 'Total Patients',
            value: '1,284',
            change: '+12.5%',
            icon: 'users',
            description: 'Active patients'
          },
          {
            title: 'Appointments Today',
            value: '24',
            change: '+3',
            icon: 'calendar',
            description: 'Scheduled for today'
          },
          {
            title: 'Pending Consultations',
            value: '8',
            change: '-2',
            icon: 'clock',
            description: 'Awaiting review'
          }
        ];
      }
    });
  }
}