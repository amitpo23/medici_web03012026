import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environments/environment';

export interface CommandResult {
  success: boolean;
  response?: string;
  action?: string;
  data?: Record<string, unknown>;
  history?: CommandMessage[];
}

export interface CommandMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface Capability {
  category: string;
  name: string;
  commands: string[];
  description: string;
  params?: string[];
}

export interface CommandHistory {
  userId: string;
  messages: CommandMessage[];
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class AICommandService {
  private apiUrl = `${environment.baseUrl}ai-command`;

  constructor(private http: HttpClient) {}

  executeCommand(command: string, context: Record<string, unknown> = {}): Observable<CommandResult> {
    return this.http.post<CommandResult>(`${this.apiUrl}/execute`, { command, context });
  }

  chat(message: string, sessionId?: string, includeHistory: boolean = false): Observable<CommandResult> {
    return this.http.post<CommandResult>(`${this.apiUrl}/chat`, { message, sessionId, includeHistory });
  }

  getStatus(): Observable<CommandResult> {
    return this.http.get<CommandResult>(`${this.apiUrl}/status`);
  }

  getRecommendations(): Observable<CommandResult> {
    return this.http.get<CommandResult>(`${this.apiUrl}/recommendations`);
  }

  executeAction(action: string, params: Record<string, unknown> = {}): Observable<CommandResult> {
    return this.http.post<CommandResult>(`${this.apiUrl}/action`, { action, params });
  }

  getHistory(limit: number = 20): Observable<CommandHistory> {
    return this.http.get<CommandHistory>(`${this.apiUrl}/history?limit=${limit}`);
  }

  clearHistory(): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/history`);
  }

  processVoice(text: string, confidence: number = 1.0, language: string = 'he'): Observable<CommandResult> {
    return this.http.post<CommandResult>(`${this.apiUrl}/voice`, { text, confidence, language });
  }

  getCapabilities(): Observable<{ capabilities: Capability[]; languages: string[]; voiceSupported: boolean }> {
    return this.http.get<{ capabilities: Capability[]; languages: string[]; voiceSupported: boolean }>(`${this.apiUrl}/capabilities`);
  }
}
