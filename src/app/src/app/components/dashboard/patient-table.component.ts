/**
 * Patient Table Component for Medici Healthcare Dashboard
 * 
 * Requirements:
 * - Display a sortable table of patients from the API
 * - Connect to DashboardService.getPatients() to fetch patient data
 * - Columns: Avatar, Name, Age, Condition/Diagnosis, Last Visit, Status Badge, Actions
 * - Status badge colors: green (stable), red (critical), yellow (improving)
 * - Search/filter functionality by patient name or condition
 * - Pagination (10 patients per page)
 * - Click row to expand and show more details
 * - Action buttons: View Details, Edit Patient, View History
 * - Loading state skeleton when fetching data
 * - Empty state message when no patients found
 * - Error handling with user-friendly messages
 * 
 * API Integration:
 * - Use DashboardService from '../../services/dashboard.service'
 * - Patient interface: id, name, age, condition, lastVisit, status
 * - Use HttpClient for API calls
 * - Handle observables with async pipe or subscribe
 * 
 * Styling:
 * - Modern medical UI with clean table design
 * - Responsive layout that works on mobile
 * - Hover effects on rows
 * - Material Design or similar professional look
 * - Use Angular Material table or custom styled table
 */

import { Component, OnInit } from '@angular/core';
import { DashboardService, Patient } from '../../services/dashboard.service';

@Component({
  selector: 'app-patient-table',
  templateUrl: './patient-table.component.html',
  styleUrls: ['./patient-table.component.css']
})
export class PatientTableComponent implements OnInit {
  // Component implementation here

    patients: Patient[] = []; = [];
  filteredPatients: Patient[] = [];
  searchTerm = '';
  loading = true;
  error: string | null = null;
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadPatients();
  }

  loadPatients(): void {
    this.loading = true;
    this.error = null;
    
    this.dashboardService.getPatients().subscribe({
      next: (data: Patient[]) => {
        this.patients = data;
        this.filteredPatients = data;
        this.calculateTotalPages();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading patients:', err);
        this.error = 'Failed to load patients. Please try again.';
        this.loading = false;
      }
    });
  }

  searchPatients(): void {
    if (!this.searchTerm) {
      this.filteredPatients = this.patients;
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredPatients = this.patients.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.condition.toLowerCase().includes(term)
      );
    }
    this.currentPage = 1;
    this.calculateTotalPages();
  }

  calculateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredPatients.length / this.itemsPerPage);
  }

  get paginatedPatients(): Patient[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredPatients.slice(start, end);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  getStatusColor(status: string): string {
    switch(status) {
      case 'stable': return 'green';
      case 'critical': return 'red';
      case 'improving': return 'yellow';
      default: return 'gray';
    }
  }

  viewPatient(patient: Patient): void {
    console.log('View patient:', patient);
    // TODO: Navigate to patient details
  }

  editPatient(patient: Patient): void {
    console.log('Edit patient:', patient);
    // TODO: Open edit dialog
  }

  viewHistory(patient: Patient): void {
    console.log('View history:', patient);
    // TODO: Navigate to patient history
  }
}
