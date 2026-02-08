import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment.prod';

interface HotSaleHotel {
  id: number;
  hotelName: string;
  city: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  discount?: number;
  checkIn?: string;
  checkOut?: string;
}

interface SearchFilters {
  hotel: string;
  city: string;
  minPrice: number;
  maxPrice: number;
}

@Component({
  selector: 'app-hot-sale-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatSliderModule],
  template: `
    <div class="hot-sale-sidebar">
      <!-- Search Panel -->
      <div class="search-panel">
        <h3>Search</h3>

        <input
          type="text"
          class="search-input"
          placeholder="Hotel"
          [(ngModel)]="filters.hotel"
          (input)="onFiltersChange()"
        />

        <input
          type="text"
          class="search-input"
          placeholder="City"
          [(ngModel)]="filters.city"
          (input)="onFiltersChange()"
        />

        <div class="price-range">
          <div class="price-labels">
            <span>{{ filters.minPrice }}$</span>
            <span>{{ filters.maxPrice }}$</span>
          </div>
          <mat-slider
            [min]="1"
            [max]="500"
            [step]="10"
            discrete
            showTickMarks
            class="price-slider"
          >
            <input matSliderStartThumb [(ngModel)]="filters.minPrice" (valueChange)="onFiltersChange()">
            <input matSliderEndThumb [(ngModel)]="filters.maxPrice" (valueChange)="onFiltersChange()">
          </mat-slider>
        </div>

        <button class="search-btn" (click)="onSearch()">
          <mat-icon>search</mat-icon>
        </button>
      </div>

      <!-- Hot Sale Section -->
      <div class="hot-sale-section">
        <h3>
          <mat-icon class="fire-icon">local_fire_department</mat-icon>
          HOT SALE
        </h3>

        <div class="hotel-cards" *ngIf="hotSaleHotels.length > 0; else noHotels">
          <div
            class="hot-sale-card"
            *ngFor="let hotel of hotSaleHotels"
            (click)="onHotelSelect(hotel)"
          >
            <img
              [src]="hotel.imageUrl || getDefaultImage(hotel.city)"
              [alt]="hotel.hotelName"
              loading="lazy"
            />
            <div class="price-tag">
              {{ hotel.city }} {{ hotel.price | number:'1.0-0' }}$
            </div>
            <div class="discount-badge" *ngIf="hotel.discount">
              -{{ hotel.discount }}%
            </div>
          </div>
        </div>

        <ng-template #noHotels>
          <div class="no-hotels">
            <mat-icon>hotel</mat-icon>
            <p>No hot deals available</p>
          </div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .hot-sale-sidebar {
      width: 280px;
      min-width: 280px;
      background: var(--bg-secondary, #12171f);
      border-left: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .search-panel {
      padding: 20px;
      border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));

      h3 {
        color: var(--accent-primary, #D4AF37);
        font-size: 14px;
        font-weight: 500;
        margin: 0 0 16px 0;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .search-input {
        width: 100%;
        padding: 10px 12px;
        background: var(--bg-tertiary, #1a2029);
        border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
        border-radius: 6px;
        color: var(--text-primary, #f1f5f9);
        font-size: 13px;
        margin-bottom: 12px;
        box-sizing: border-box;

        &::placeholder {
          color: var(--text-muted, #64748b);
        }

        &:focus {
          outline: none;
          border-color: var(--accent-primary, #D4AF37);
        }
      }

      .price-range {
        margin: 16px 0;

        .price-labels {
          display: flex;
          justify-content: space-between;
          color: var(--text-secondary, #94a3b8);
          font-size: 12px;
          margin-bottom: 8px;
        }

        .price-slider {
          width: 100%;
        }
      }

      .search-btn {
        width: 100%;
        padding: 10px;
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        justify-content: flex-end;

        mat-icon {
          color: var(--accent-primary, #D4AF37);
          transition: color 0.2s ease;
        }

        &:hover mat-icon {
          color: var(--accent-light, #E5C158);
        }
      }
    }

    .hot-sale-section {
      flex: 1;
      overflow-y: auto;
      padding: 20px;

      h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--accent-primary, #D4AF37);
        font-size: 14px;
        font-weight: 500;
        margin: 0 0 16px 0;
        text-transform: uppercase;
        letter-spacing: 1px;

        .fire-icon {
          color: #f59e0b;
          animation: flicker 1.5s ease-in-out infinite;
        }
      }

      .hotel-cards {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .no-hotels {
        text-align: center;
        color: var(--text-muted);
        padding: 40px 20px;

        mat-icon {
          font-size: 48px;
          width: 48px;
          height: 48px;
          margin-bottom: 12px;
        }

        p {
          margin: 0;
          font-size: 13px;
        }
      }
    }

    .hot-sale-card {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));

      &:hover {
        transform: scale(1.02);
        box-shadow: 0 4px 20px rgba(212, 175, 55, 0.15);
      }

      img {
        width: 100%;
        height: 100px;
        object-fit: cover;
      }

      .price-tag {
        position: absolute;
        bottom: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.8);
        color: var(--accent-primary, #D4AF37);
        padding: 4px 12px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 14px;
        border: 1px solid var(--accent-primary, #D4AF37);
      }

      .discount-badge {
        position: absolute;
        top: 8px;
        left: 8px;
        background: #ef4444;
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
        font-size: 11px;
      }
    }

    @keyframes flicker {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.7;
      }
    }

    /* Scrollbar styling */
    .hot-sale-section::-webkit-scrollbar {
      width: 6px;
    }

    .hot-sale-section::-webkit-scrollbar-track {
      background: var(--bg-tertiary);
    }

    .hot-sale-section::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 3px;

      &:hover {
        background: var(--accent-primary);
      }
    }

    /* Material slider customization */
    ::ng-deep {
      .mat-mdc-slider {
        --mdc-slider-active-track-color: var(--accent-primary, #D4AF37);
        --mdc-slider-inactive-track-color: var(--bg-tertiary);
        --mdc-slider-handle-color: var(--accent-primary, #D4AF37);
      }
    }
  `]
})
export class HotSaleSidebarComponent implements OnInit {
  @Output() hotelSelected = new EventEmitter<HotSaleHotel>();
  @Output() searchRequested = new EventEmitter<SearchFilters>();

  hotSaleHotels: HotSaleHotel[] = [];

  filters: SearchFilters = {
    hotel: '',
    city: '',
    minPrice: 10,
    maxPrice: 100
  };

  private defaultImages: Record<string, string> = {
    'TLV': 'https://images.unsplash.com/photo-1544132500-7e42e0fa0e27?w=400&h=200&fit=crop',
    'Tel-Aviv': 'https://images.unsplash.com/photo-1544132500-7e42e0fa0e27?w=400&h=200&fit=crop',
    'default': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=200&fit=crop'
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadHotSaleHotels();
  }

  loadHotSaleHotels(): void {
    this.http.get<{ data: HotSaleHotel[] }>(`${environment.apiUrl}/api/trading-exchange/HotDeals`).subscribe({
      next: (response) => {
        this.hotSaleHotels = response.data || [];
      },
      error: () => {
        // Fallback to mock data if API fails
        this.hotSaleHotels = [
          { id: 1, hotelName: 'TLV88', city: 'TLV', price: 80, imageUrl: this.defaultImages['TLV'], discount: 15 },
          { id: 2, hotelName: 'Delamar', city: 'TLV', price: 80, imageUrl: this.defaultImages['TLV'] },
          { id: 3, hotelName: 'WhiteHouse', city: 'TLV', price: 80, imageUrl: this.defaultImages['default'] }
        ];
      }
    });
  }

  getDefaultImage(city: string): string {
    return this.defaultImages[city] || this.defaultImages['default'];
  }

  onFiltersChange(): void {
    // Debounced search would go here
  }

  onSearch(): void {
    this.searchRequested.emit(this.filters);
  }

  onHotelSelect(hotel: HotSaleHotel): void {
    this.hotelSelected.emit(hotel);
  }
}
