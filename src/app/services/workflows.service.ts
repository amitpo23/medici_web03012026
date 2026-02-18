import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

export interface DecisionRule {
  id: string;
  name: string;
  action: string;
  enabled: boolean;
}

export interface RulesResponse {
  total: number;
  rules: DecisionRule[];
}

export interface RuleUpdateResponse {
  success: boolean;
  ruleId: string;
  enabled: boolean;
}

export interface ProcessResult {
  opportunityId: number;
  action: string;
  ruleName: string;
  details: string;
  timestamp: string;
}

export interface BatchProcessResult {
  processed: number;
  results: ProcessResult[];
  errors: string[];
}

export interface DecisionHistoryItem {
  opportunityId: number;
  action: string;
  ruleName: string;
  details: string;
  timestamp: string;
}

export interface HistoryResponse {
  total: number;
  history: DecisionHistoryItem[];
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowsService {
  private apiUrl = `${environment.baseUrl}workflows`;

  constructor(private http: HttpClient) {}

  /**
   * Process a single opportunity through decision rules
   */
  processOpportunity(id: number): Observable<ProcessResult> {
    return this.http.post<ProcessResult>(`${this.apiUrl}/process/${id}`, {});
  }

  /**
   * Batch process multiple opportunities
   */
  batchProcess(opportunityIds: number[]): Observable<BatchProcessResult> {
    return this.http.post<BatchProcessResult>(`${this.apiUrl}/batch-process`, { opportunityIds });
  }

  /**
   * Get all decision rules
   */
  getRules(): Observable<RulesResponse> {
    return this.http.get<RulesResponse>(`${this.apiUrl}/rules`);
  }

  /**
   * Enable or disable a specific rule
   */
  updateRule(ruleId: string, enabled: boolean): Observable<RuleUpdateResponse> {
    return this.http.put<RuleUpdateResponse>(`${this.apiUrl}/rules/${ruleId}`, { enabled });
  }

  /**
   * Get decision history with optional limit
   */
  getHistory(limit: number = 100): Observable<HistoryResponse> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<HistoryResponse>(`${this.apiUrl}/history`, { params });
  }
}
