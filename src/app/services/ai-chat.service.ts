import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sqlQuery?: string;
  results?: any[];
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
}

export interface AskQuestionRequest {
  question: string;
  conversationHistory?: ChatMessage[];
}

export interface AskQuestionResponse {
  success: boolean;
  question: string;
  answer?: string;
  sqlQuery?: string;
  results?: any[];
  explanation?: string;
  error?: string;
  usedAzureOpenAI?: boolean;
  model?: string;
}

export interface CustomQueryRequest {
  query: string;
}

export interface CustomQueryResponse {
  success: boolean;
  results: any[];
  rowCount: number;
  error?: string;
}

export interface SchemaResponse {
  success: boolean;
  schema: {
    TABLE_NAME: string;
    COLUMNS: string;
  }[];
  tables?: {
    TABLE_NAME: string;
    COLUMNS: string;
  }[];
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

  /**
   * Get quick database statistics
   */
  getQuickStats(): Observable<QuickStatsResponse> {
    return this.http.get<QuickStatsResponse>(`${this.baseUrl}ai-chat/quick-stats`);
  }

  /**
   * Ask a natural language question
   */
  askQuestion(request: AskQuestionRequest): Observable<AskQuestionResponse> {
    return this.http.post<AskQuestionResponse>(`${this.baseUrl}ai-chat/ask`, request);
  }

  /**
   * Execute a custom SQL query
   */
  executeCustomQuery(request: CustomQueryRequest): Observable<CustomQueryResponse> {
    return this.http.post<CustomQueryResponse>(`${this.baseUrl}ai-chat/custom-query`, request);
  }

  /**
   * Get database schema
   */
  getDatabaseSchema(): Observable<SchemaResponse> {
    return this.http.get<SchemaResponse>(`${this.baseUrl}ai-chat/schema`);
  }

  /**
   * Get query suggestions
   */
  getQuerySuggestions(): Observable<SuggestionsResponse> {
    return this.http.get<SuggestionsResponse>(`${this.baseUrl}ai-chat/suggestions`);
  }

  /**
   * Generate a unique message ID
   */
  generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
