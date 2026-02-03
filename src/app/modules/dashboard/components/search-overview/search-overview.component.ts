import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { SearchIntelligenceService, SearchOverview } from '../../../../services/search-intelligence.service';

@Component({
  selector: 'app-search-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './search-overview.component.html',
  styleUrls: ['./search-overview.component.scss']
})
export class SearchOverviewComponent implements OnInit {
  overview: SearchOverview | null = null;
  loading = true;
  error: string | null = null;

  constructor(private searchIntelligenceService: SearchIntelligenceService) {}

  ngOnInit(): void {
    this.loadOverview();
  }

  loadOverview(): void {
    this.loading = true;
    this.searchIntelligenceService.getOverview().subscribe({
      next: (response) => {
        if (response.success) {
          this.overview = response.data;
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Error loading overview:', err);
        this.error = 'Failed to load search overview';
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
    return num?.toString() || '0';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  }

  getGrowthPercent(last7Days: number, last30Days: number): string {
    const weeklyAvg = last7Days / 7;
    const monthlyAvg = last30Days / 30;
    const growth = ((weeklyAvg - monthlyAvg) / monthlyAvg) * 100;
    return growth > 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
  }

  isGrowing(last7Days: number, last30Days: number): boolean {
    return (last7Days / 7) > (last30Days / 30);
  }
}
