import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/app/environments/environment';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

interface WorkerStatus {
  name: string;
  status: 'running' | 'idle' | 'error' | 'disabled';
  lastRun: string | null;
  nextRun: string | null;
  processedToday: number;
  errors: number;
  enabled: boolean;
}

@Component({
  selector: 'app-worker-status',
  templateUrl: './worker-status.component.html',
  styleUrls: ['./worker-status.component.scss']
})
export class WorkerStatusComponent implements OnInit, OnDestroy {
  workers: WorkerStatus[] = [];
  isLoading = true;
  private refreshSubscription?: Subscription;
  private readonly REFRESH_INTERVAL = 30000; // 30 seconds

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadWorkerStatus();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
  }

  loadWorkerStatus(): void {
    this.http.get<any>(`${environment.baseUrl}health`).subscribe({
      next: (response) => {
        this.workers = this.parseWorkerStatus(response);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading worker status:', error);
        this.isLoading = false;
        // Show default workers with error status
        this.workers = [
          { name: 'BuyRoom Worker', status: 'error', lastRun: null, nextRun: null, processedToday: 0, errors: 0, enabled: true },
          { name: 'Auto-Cancel Worker', status: 'error', lastRun: null, nextRun: null, processedToday: 0, errors: 0, enabled: true },
          { name: 'Price Update Worker', status: 'error', lastRun: null, nextRun: null, processedToday: 0, errors: 0, enabled: true }
        ];
      }
    });
  }

  private parseWorkerStatus(response: any): WorkerStatus[] {
    const workers: WorkerStatus[] = [];
    
    // BuyRoom Worker
    workers.push({
      name: 'BuyRoom Worker',
      status: this.getWorkerStatus('buyroom', response),
      lastRun: response.workers?.buyroom?.lastRun || null,
      nextRun: response.workers?.buyroom?.nextRun || null,
      processedToday: response.workers?.buyroom?.processedToday || 0,
      errors: response.workers?.buyroom?.errors || 0,
      enabled: response.workers?.buyroom?.enabled !== false
    });

    // Auto-Cancel Worker
    workers.push({
      name: 'Auto-Cancel Worker',
      status: this.getWorkerStatus('autoCancel', response),
      lastRun: response.workers?.autoCancel?.lastRun || null,
      nextRun: response.workers?.autoCancel?.nextRun || null,
      processedToday: response.workers?.autoCancel?.processedToday || 0,
      errors: response.workers?.autoCancel?.errors || 0,
      enabled: response.workers?.autoCancel?.enabled !== false
    });

    // Price Update Worker
    workers.push({
      name: 'Price Update Worker',
      status: this.getWorkerStatus('priceUpdate', response),
      lastRun: response.workers?.priceUpdate?.lastRun || null,
      nextRun: response.workers?.priceUpdate?.nextRun || null,
      processedToday: response.workers?.priceUpdate?.processedToday || 0,
      errors: response.workers?.priceUpdate?.errors || 0,
      enabled: response.workers?.priceUpdate?.enabled !== false
    });

    return workers;
  }

  private getWorkerStatus(workerName: string, response: any): 'running' | 'idle' | 'error' | 'disabled' {
    const worker = response.workers?.[workerName];
    
    if (!worker || worker.enabled === false) {
      return 'disabled';
    }
    
    if (worker.status === 'running') {
      return 'running';
    }
    
    if (worker.errors > 0) {
      return 'error';
    }
    
    // Check if worker hasn't run in expected timeframe (e.g., > 1 hour)
    if (worker.lastRun) {
      const lastRun = new Date(worker.lastRun);
      const now = new Date();
      const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastRun > 1) {
        return 'error';
      }
    }
    
    return 'idle';
  }

  private startAutoRefresh(): void {
    this.refreshSubscription = interval(this.REFRESH_INTERVAL)
      .pipe(switchMap(() => this.http.get(`${environment.baseUrl}health`)))
      .subscribe({
        next: (response: any) => {
          this.workers = this.parseWorkerStatus(response);
        },
        error: (error) => {
          console.error('Auto-refresh error:', error);
        }
      });
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'running': return 'play_circle';
      case 'idle': return 'pause_circle';
      case 'error': return 'error';
      case 'disabled': return 'stop_circle';
      default: return 'help';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'running': return 'success';
      case 'idle': return 'info';
      case 'error': return 'error';
      case 'disabled': return 'disabled';
      default: return 'default';
    }
  }

  getTimeSince(dateString: string | null): string {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds} sec ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }

  refreshNow(): void {
    this.isLoading = true;
    this.loadWorkerStatus();
  }
}
