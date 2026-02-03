import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { CitySearchData, SearchIntelligenceService } from '../../../../services/search-intelligence.service';

@Component({
  selector: 'app-search-top-cities',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './search-top-cities.component.html',
  styleUrls: ['./search-top-cities.component.scss']
})
export class SearchTopCitiesComponent implements OnInit {
  cities: CitySearchData[] = [];
  loading = true;
  error: string | null = null;

  constructor(private searchIntelligenceService: SearchIntelligenceService) {}

  ngOnInit(): void {
    this.loadCities();
  }

  loadCities(): void {
    this.loading = true;
    this.searchIntelligenceService.getTopCities(10).subscribe({
      next: (response) => {
        if (response.success) {
          this.cities = response.data;
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Error loading top cities:', err);
        this.error = 'Failed to load top cities data';
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

  getCityFlag(countryCode: string): string {
    // Map country codes to flag emojis
    const flags: { [key: string]: string } = {
      'NL': '🇳🇱',
      'AE': '🇦🇪',
      'GB': '🇬🇧',
      'FR': '🇫🇷',
      'US': '🇺🇸',
      'IL': '🇮🇱',
      'ES': '🇪🇸',
      'IT': '🇮🇹',
      'DE': '🇩🇪',
      'AT': '🇦🇹'
    };
    return flags[countryCode] || '🌍';
  }

  getBarWidth(percentage: number): string {
    return `${Math.min(percentage, 100)}%`;
  }

  getBarColor(index: number): string {
    const colors = [
      '#4CAF50', // Green
      '#2196F3', // Blue
      '#FF9800', // Orange
      '#9C27B0', // Purple
      '#F44336', // Red
      '#00BCD4', // Cyan
      '#FFEB3B', // Yellow
      '#795548', // Brown
      '#607D8B', // Blue Grey
      '#E91E63'  // Pink
    ];
    return colors[index % colors.length];
  }
}
