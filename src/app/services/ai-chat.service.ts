import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sqlQuery?: string;
  results?: Record<string, unknown>[];
  error?: string;
}

export interface QuickStatsResponse {
  success: boolean;
  stats: {
    TotalBookings: number;
    ActiveOpportunities: number;
    ActiveHotels: number;
    TotalRevenue: number;
    TotalProfit: number;
  };
  timestamp: string;
}

export interface AskQuestionRequest {
  question: string;
  conversationHistory?: ChatMessage[];
}

export interface AskQuestionResponse {
  success: boolean;
  question: string;
  answer?: string;
  explanation?: string;
  sqlQuery?: string;
  results?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
  suggestion?: string;
  usedAzureOpenAI?: boolean;
  model?: string;
}

export interface CustomQueryRequest {
  query: string;
}

export interface CustomQueryResponse {
  success: boolean;
  results: Record<string, unknown>[];
  rowCount: number;
  error?: string;
}

export interface SchemaTable {
  TABLE_NAME: string;
  COLUMNS: string;
}

export interface SchemaResponse {
  success: boolean;
  schema: SchemaTable[];
  tables: SchemaTable[];
  count: number;
}

export interface SuggestionsResponse {
  success: boolean;
  suggestions: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AIChatService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getQuickStats(): Observable<QuickStatsResponse> {
    return this.http.get<QuickStatsResponse>(`${this.baseUrl}ai-chat/quick-stats`);
  }

  askQuestion(request: AskQuestionRequest): Observable<AskQuestionResponse> {
    return this.http.post<AskQuestionResponse>(`${this.baseUrl}ai-chat/ask`, request);
  }

  executeCustomQuery(request: CustomQueryRequest): Observable<CustomQueryResponse> {
    return this.http.post<CustomQueryResponse>(`${this.baseUrl}ai-chat/custom-query`, request);
  }

  getDatabaseSchema(): Observable<SchemaResponse> {
    return this.http.get<SchemaResponse>(`${this.baseUrl}ai-chat/schema`);
  }

  getQuerySuggestions(): Observable<SuggestionsResponse> {
    return this.http.get<SuggestionsResponse>(`${this.baseUrl}ai-chat/suggestions`);
  }

  generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
