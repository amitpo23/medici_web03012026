import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HotelSearchData, SearchIntelligenceService } from '../../../../services/search-intelligence.service';

@Component({
  selector: 'app-search-top-hotels',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './search-top-hotels.component.html',
  styleUrls: ['./search-top-hotels.component.scss']
})
export class SearchTopHotelsComponent implements OnInit {
  hotels: HotelSearchData[] = [];
  loading = true;
  error: string | null = null;

  constructor(private searchIntelligenceService: SearchIntelligenceService) {}

  ngOnInit(): void {
    this.loadHotels();
  }

  loadHotels(): void {
    this.loading = true;
    this.searchIntelligenceService.getTopHotels(10).subscribe({
      next: (response) => {
        if (response.success) {
          this.hotels = response.data;
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Error loading top hotels:', err);
        this.error = 'Failed to load top hotels data';
        this.loading = false;
      }
    });
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  getStarRating(stars: number): string {
    return '⭐'.repeat(Math.round(stars));
  }

  getDemandLevel(percentage: number): { label: string; color: string } {
    if (percentage >= 30) return { label: 'EXTREME', color: '#f44336' };
    if (percentage >= 10) return { label: 'HIGH', color: '#ff9800' };
    if (percentage >= 5) return { label: 'MEDIUM', color: '#2196F3' };
    return { label: 'LOW', color: '#4CAF50' };
  }
}
