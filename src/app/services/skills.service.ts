import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../environments/environment';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  parameters?: SkillParameter[];
  requiresAuth: boolean;
  requiresAdmin: boolean;
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  required: boolean;
  description: string;
  defaultValue?: unknown;
}

export type SkillCategory =
  | 'bookings'
  | 'opportunities'
  | 'hotels'
  | 'reservations'
  | 'search'
  | 'pricing'
  | 'analytics'
  | 'ai'
  | 'reports'
  | 'monitoring'
  | 'alerts'
  | 'data'
  | 'system';

@Injectable({
  providedIn: 'root'
})
export class SkillsService {
  private baseUrl = environment.baseUrl;

  // Complete skills registry - all 100+ endpoints mapped
  private skills: Skill[] = [
    // ============================================
    // BOOKING SKILLS
    // ============================================
    {
      id: 'get-bookings',
      name: 'Get All Bookings',
      description: 'Retrieve list of all bookings with pagination',
      category: 'bookings',
      endpoint: 'Book/Bookings',
      method: 'GET',
      parameters: [
        { name: 'limit', type: 'number', required: false, description: 'Max results', defaultValue: 50 },
        { name: 'offset', type: 'number', required: false, description: 'Skip results', defaultValue: 0 },
        { name: 'status', type: 'string', required: false, description: 'Filter by status' }
      ],
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-cancelled-bookings',
      name: 'Get Cancelled Bookings',
      description: 'Retrieve list of cancelled bookings',
      category: 'bookings',
      endpoint: 'Book/Canceled',
      method: 'GET',
      parameters: [{ name: 'limit', type: 'number', required: false, description: 'Max results' }],
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-archived-bookings',
      name: 'Get Archived Bookings',
      description: 'Retrieve historical bookings with advanced filtering',
      category: 'bookings',
      endpoint: 'Book/Archive',
      method: 'GET',
      parameters: [
        { name: 'dateFrom', type: 'date', required: false, description: 'Start date' },
        { name: 'dateTo', type: 'date', required: false, description: 'End date' },
        { name: 'hotelId', type: 'number', required: false, description: 'Filter by hotel' }
      ],
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'create-prebook',
      name: 'Create Pre-Booking',
      description: 'Create a pre-booking via supplier API',
      category: 'bookings',
      endpoint: 'Book/PreBook',
      method: 'POST',
      parameters: [
        { name: 'hotelId', type: 'number', required: true, description: 'Hotel ID' },
        { name: 'dateFrom', type: 'date', required: true, description: 'Check-in date' },
        { name: 'dateTo', type: 'date', required: true, description: 'Check-out date' },
        { name: 'adults', type: 'number', required: true, description: 'Number of adults' }
      ],
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'confirm-booking',
      name: 'Confirm Booking',
      description: 'Confirm a pre-booking with guest details',
      category: 'bookings',
      endpoint: 'Book/Confirm',
      method: 'POST',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'cancel-booking',
      name: 'Cancel Booking',
      description: 'Cancel an existing booking',
      category: 'bookings',
      endpoint: 'Book/CancelBooking',
      method: 'DELETE',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'update-price',
      name: 'Update Booking Price',
      description: 'Update the price of a booking',
      category: 'bookings',
      endpoint: 'Book/UpdatePrice',
      method: 'POST',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // OPPORTUNITY SKILLS
    // ============================================
    {
      id: 'get-opportunities',
      name: 'Get All Opportunities',
      description: 'Retrieve list of all opportunities',
      category: 'opportunities',
      endpoint: 'Opportunity/Opportunities',
      method: 'GET',
      parameters: [
        { name: 'limit', type: 'number', required: false, description: 'Max results' },
        { name: 'active', type: 'boolean', required: false, description: 'Filter active only' }
      ],
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'create-opportunity',
      name: 'Create Opportunity',
      description: 'Insert new opportunity with automatic pricing',
      category: 'opportunities',
      endpoint: 'Opportunity/InsertOpp',
      method: 'POST',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'search-opportunities',
      name: 'Search Opportunities',
      description: 'Advanced opportunity search with filters',
      category: 'opportunities',
      endpoint: 'Opportunity/HotelSearch',
      method: 'POST',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-opportunity-logs',
      name: 'Get Opportunity Logs',
      description: 'Get activity logs for opportunities',
      category: 'opportunities',
      endpoint: 'Opportunity/Log',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'cancel-opportunity',
      name: 'Cancel Opportunity',
      description: 'Cancel an existing opportunity',
      category: 'opportunities',
      endpoint: 'Opportunity/CancelOpp',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // HOTEL SKILLS
    // ============================================
    {
      id: 'get-hotels',
      name: 'Get Hotels',
      description: 'Retrieve list of all hotels',
      category: 'hotels',
      endpoint: 'Opportunity/Hotels',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-boards',
      name: 'Get Room Boards',
      description: 'Get available meal plans (BB, HB, FB, etc.)',
      category: 'hotels',
      endpoint: 'Opportunity/Boards',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-categories',
      name: 'Get Room Categories',
      description: 'Get room categories (Standard, Deluxe, etc.)',
      category: 'hotels',
      endpoint: 'Opportunity/Categories',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // RESERVATION SKILLS
    // ============================================
    {
      id: 'get-reservation-cancels',
      name: 'Get Reservation Cancellations',
      description: 'Get list of cancelled reservations',
      category: 'reservations',
      endpoint: 'Reservation/ReservationCancel',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-reservation-details',
      name: 'Get Reservation Details',
      description: 'Get detailed reservation information',
      category: 'reservations',
      endpoint: 'Reservation/GetDetails',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-reservation-modifications',
      name: 'Get Reservation Modifications',
      description: 'Get reservation modification history',
      category: 'reservations',
      endpoint: 'Reservation/ReservationModify',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // SEARCH SKILLS
    // ============================================
    {
      id: 'search-hotels-innstant',
      name: 'Search Hotels (Innstant)',
      description: 'Search hotels via Innstant supplier API',
      category: 'search',
      endpoint: 'Search/InnstantPrice',
      method: 'POST',
      parameters: [
        { name: 'city', type: 'string', required: false, description: 'City name' },
        { name: 'hotelId', type: 'number', required: false, description: 'Hotel ID' },
        { name: 'dateFrom', type: 'date', required: true, description: 'Check-in date' },
        { name: 'dateTo', type: 'date', required: true, description: 'Check-out date' },
        { name: 'adults', type: 'number', required: false, description: 'Adults', defaultValue: 2 }
      ],
      requiresAuth: false,
      requiresAdmin: false
    },
    {
      id: 'search-multi-supplier',
      name: 'Multi-Supplier Search',
      description: 'Search across multiple suppliers simultaneously',
      category: 'search',
      endpoint: 'Search/MultiSupplier',
      method: 'POST',
      requiresAuth: false,
      requiresAdmin: false
    },

    // ============================================
    // PRICING SKILLS
    // ============================================
    {
      id: 'calculate-price',
      name: 'Calculate Optimal Price',
      description: 'Calculate optimal price using AI pricing engine',
      category: 'pricing',
      endpoint: 'pricing/calculate',
      method: 'POST',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'compare-pricing-strategies',
      name: 'Compare Pricing Strategies',
      description: 'Compare aggressive, balanced, conservative strategies',
      category: 'pricing',
      endpoint: 'pricing/compare-strategies',
      method: 'POST',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-pricing-recommendation',
      name: 'Get Pricing Recommendation',
      description: 'Get AI-powered pricing recommendation',
      category: 'pricing',
      endpoint: 'pricing/recommendation/:opportunityId',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-pricing-performance',
      name: 'Get Pricing Performance',
      description: 'Get pricing performance metrics',
      category: 'pricing',
      endpoint: 'pricing/performance',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // DASHBOARD SKILLS
    // ============================================
    {
      id: 'get-dashboard-stats',
      name: 'Get Dashboard Stats',
      description: 'Get comprehensive dashboard statistics',
      category: 'analytics',
      endpoint: 'Dashboard/Stats',
      method: 'GET',
      parameters: [{ name: 'period', type: 'number', required: false, description: 'Days to look back', defaultValue: 30 }],
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-dashboard-alerts',
      name: 'Get Dashboard Alerts',
      description: 'Get real-time business alerts',
      category: 'alerts',
      endpoint: 'Dashboard/Alerts',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-hotel-performance',
      name: 'Get Hotel Performance',
      description: 'Get performance metrics by hotel',
      category: 'analytics',
      endpoint: 'Dashboard/HotelPerformance',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'get-forecast',
      name: 'Get Revenue Forecast',
      description: 'Get revenue forecast for upcoming days',
      category: 'analytics',
      endpoint: 'Dashboard/Forecast',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // AI SKILLS
    // ============================================
    {
      id: 'ai-chat-ask',
      name: 'AI Chat - Ask Question',
      description: 'Ask natural language questions about data',
      category: 'ai',
      endpoint: 'ai-chat/ask',
      method: 'POST',
      parameters: [{ name: 'question', type: 'string', required: true, description: 'Question in natural language' }],
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'ai-chat-suggestions',
      name: 'AI Chat - Get Suggestions',
      description: 'Get suggested questions for AI chat',
      category: 'ai',
      endpoint: 'ai-chat/suggestions',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'ai-status',
      name: 'Get AI Status',
      description: 'Get status of all AI agents',
      category: 'ai',
      endpoint: 'ai/status',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'ai-analyze',
      name: 'Run AI Analysis',
      description: 'Run full AI market analysis',
      category: 'ai',
      endpoint: 'ai/analyze',
      method: 'POST',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'ai-opportunities',
      name: 'Get AI Opportunities',
      description: 'Get AI-detected buy/sell opportunities',
      category: 'ai',
      endpoint: 'ai/opportunities',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'ai-market-overview',
      name: 'Get Market Overview',
      description: 'Get AI market analysis overview',
      category: 'ai',
      endpoint: 'ai/market/overview',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'ai-command-execute',
      name: 'Execute AI Command',
      description: 'Execute natural language command',
      category: 'ai',
      endpoint: 'ai-command/execute',
      method: 'POST',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'ai-rag-ask',
      name: 'AI RAG - Ask with Context',
      description: 'Ask questions using RAG (Retrieval Augmented Generation)',
      category: 'ai',
      endpoint: 'ai/rag/ask',
      method: 'POST',
      requiresAuth: true,
      requiresAdmin: true
    },

    // ============================================
    // REPORTS SKILLS
    // ============================================
    {
      id: 'report-profit-loss',
      name: 'Profit/Loss Report',
      description: 'Get profit and loss summary',
      category: 'reports',
      endpoint: 'reports/ProfitLoss',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'report-margin-by-hotel',
      name: 'Margin by Hotel Report',
      description: 'Get margin breakdown by hotel',
      category: 'reports',
      endpoint: 'reports/MarginByHotel',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'report-margin-by-date',
      name: 'Margin by Date Report',
      description: 'Get margin breakdown by date',
      category: 'reports',
      endpoint: 'reports/MarginByDate',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'report-top-hotels',
      name: 'Top Hotels Report',
      description: 'Get top performing hotels',
      category: 'reports',
      endpoint: 'reports/TopHotels',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'report-loss',
      name: 'Loss Report',
      description: 'Get report on cancelled/loss bookings',
      category: 'reports',
      endpoint: 'reports/LossReport',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // MONITORING SKILLS
    // ============================================
    {
      id: 'monitoring-health',
      name: 'System Health Check',
      description: 'Get overall system health status',
      category: 'monitoring',
      endpoint: 'monitoring/health',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: true
    },
    {
      id: 'monitoring-metrics',
      name: 'Get System Metrics',
      description: 'Get all current system metrics',
      category: 'monitoring',
      endpoint: 'monitoring/metrics',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: true
    },
    {
      id: 'monitoring-activity',
      name: 'Get Recent Activity',
      description: 'Get recent system activity',
      category: 'monitoring',
      endpoint: 'monitoring/activity',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: true
    },

    // ============================================
    // ALERTS SKILLS
    // ============================================
    {
      id: 'alerts-status',
      name: 'Get Alerts Status',
      description: 'Get alerts agent status',
      category: 'alerts',
      endpoint: 'alerts/status',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'alerts-history',
      name: 'Get Alerts History',
      description: 'Get historical alerts',
      category: 'alerts',
      endpoint: 'alerts/history',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'alerts-scan',
      name: 'Trigger Alert Scan',
      description: 'Manually trigger an alert scan',
      category: 'alerts',
      endpoint: 'alerts/scan',
      method: 'POST',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // DATA EXPLORER SKILLS
    // ============================================
    {
      id: 'data-all-tables',
      name: 'Get All Tables',
      description: 'List all database tables with row counts',
      category: 'data',
      endpoint: 'data-explorer/tables',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'data-comprehensive-stats',
      name: 'Get Comprehensive Stats',
      description: 'Get statistics from all major tables',
      category: 'data',
      endpoint: 'data-explorer/comprehensive-stats',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'data-destinations',
      name: 'Get Destinations',
      description: 'Get all destinations with hotel counts',
      category: 'data',
      endpoint: 'data-explorer/destinations',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'data-queue',
      name: 'Get Queue Status',
      description: 'Get queue items and statistics',
      category: 'data',
      endpoint: 'data-explorer/queue',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'data-lookups',
      name: 'Get All Lookups',
      description: 'Get all lookup table data (boards, categories, etc.)',
      category: 'data',
      endpoint: 'data-explorer/lookups',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'data-sales-office',
      name: 'Get Sales Office Summary',
      description: 'Get SalesOffice orders and bookings summary',
      category: 'data',
      endpoint: 'data-explorer/sales-office/summary',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'data-system-logs',
      name: 'Get System Logs',
      description: 'Get MED_Log entries',
      category: 'data',
      endpoint: 'data-explorer/system-logs',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // CANCELLATION SKILLS
    // ============================================
    {
      id: 'cancellation-stats',
      name: 'Get Cancellation Stats',
      description: 'Get overall cancellation statistics',
      category: 'bookings',
      endpoint: 'cancellations/stats',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'cancellation-recent',
      name: 'Get Recent Cancellations',
      description: 'Get recent cancellations (success and failure)',
      category: 'bookings',
      endpoint: 'cancellations/recent',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'cancellation-trends',
      name: 'Get Cancellation Trends',
      description: 'Get cancellation trends over time',
      category: 'bookings',
      endpoint: 'cancellations/trends',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // ANALYTICS SKILLS
    // ============================================
    {
      id: 'analytics-price-trends',
      name: 'Get Price Trends',
      description: 'Get price trends for hotels over time',
      category: 'analytics',
      endpoint: 'analytics/price-trends',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'analytics-search-demand',
      name: 'Get Search Demand',
      description: 'Get search demand patterns',
      category: 'analytics',
      endpoint: 'analytics/search-demand',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'analytics-performance',
      name: 'Get Performance Analytics',
      description: 'Get comprehensive performance metrics',
      category: 'analytics',
      endpoint: 'analytics/performance',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // WORKFLOW SKILLS
    // ============================================
    {
      id: 'workflow-rules',
      name: 'Get Decision Rules',
      description: 'Get all automated decision rules',
      category: 'system',
      endpoint: 'workflows/rules',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    },
    {
      id: 'workflow-process',
      name: 'Process Opportunity',
      description: 'Process opportunity through decision rules',
      category: 'system',
      endpoint: 'workflows/process/:id',
      method: 'POST',
      requiresAuth: true,
      requiresAdmin: false
    },

    // ============================================
    // SYSTEM SKILLS
    // ============================================
    {
      id: 'health-check',
      name: 'Basic Health Check',
      description: 'Check if system is running',
      category: 'system',
      endpoint: 'health',
      method: 'GET',
      requiresAuth: false,
      requiresAdmin: false
    },
    {
      id: 'health-deep',
      name: 'Deep Health Check',
      description: 'Check all system dependencies',
      category: 'system',
      endpoint: 'health/deep',
      method: 'GET',
      requiresAuth: false,
      requiresAdmin: false
    },
    {
      id: 'worker-status',
      name: 'Get Worker Status',
      description: 'Get status of automated workers',
      category: 'system',
      endpoint: 'Dashboard/WorkerStatus',
      method: 'GET',
      requiresAuth: true,
      requiresAdmin: false
    }
  ];

  constructor(private http: HttpClient) {}

  // Get all available skills
  getAllSkills(): Skill[] {
    return this.skills;
  }

  // Get skills by category
  getSkillsByCategory(category: SkillCategory): Skill[] {
    return this.skills.filter(s => s.category === category);
  }

  // Get a specific skill by ID
  getSkillById(id: string): Skill | undefined {
    return this.skills.find(s => s.id === id);
  }

  // Execute a skill
  executeSkill(skillId: string, params?: Record<string, unknown>): Observable<unknown> {
    const skill = this.getSkillById(skillId);
    if (!skill) {
      return of({ error: 'Skill not found' });
    }

    let url = `${this.baseUrl}${skill.endpoint}`;

    // Replace path parameters
    if (params) {
      Object.keys(params).forEach(key => {
        if (url.includes(`:${key}`)) {
          url = url.replace(`:${key}`, String(params[key]));
          delete params[key];
        }
      });
    }

    switch (skill.method) {
      case 'GET':
        const queryParams = new URLSearchParams();
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              queryParams.set(key, String(value));
            }
          });
        }
        const queryString = queryParams.toString();
        return this.http.get(`${url}${queryString ? '?' + queryString : ''}`);

      case 'POST':
        return this.http.post(url, params || {});

      case 'PUT':
        return this.http.put(url, params || {});

      case 'DELETE':
        return this.http.delete(url);

      default:
        return of({ error: 'Unsupported method' });
    }
  }

  // Get all categories
  getCategories(): SkillCategory[] {
    return [...new Set(this.skills.map(s => s.category))];
  }

  // Search skills by name or description
  searchSkills(query: string): Skill[] {
    const lowerQuery = query.toLowerCase();
    return this.skills.filter(
      s =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.description.toLowerCase().includes(lowerQuery)
    );
  }

  // Get skill count by category
  getSkillCountByCategory(): Record<SkillCategory, number> {
    const counts: Partial<Record<SkillCategory, number>> = {};
    this.skills.forEach(skill => {
      counts[skill.category] = (counts[skill.category] || 0) + 1;
    });
    return counts as Record<SkillCategory, number>;
  }
}
