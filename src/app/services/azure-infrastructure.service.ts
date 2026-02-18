import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, interval } from 'rxjs';
import { shareReplay, startWith, switchMap } from 'rxjs/operators';
import { environment } from '../environments/environment';

// App Service
export interface AppServiceOverview {
  name: string;
  state: string;
  defaultHostName: string;
  location: string;
  kind: string;
  httpsOnly: boolean;
  enabled: boolean;
  availabilityState: string;
  identity: { type: string; principalId: string } | null;
  hostNames: string[];
  resourceGroup: string;
  appServicePlan: string;
  lastModified: string;
  outboundIpAddresses: string;
  possibleOutboundIpAddresses: string;
}

export interface SecurityFinding {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  finding: string;
  recommendation: string;
}

export interface AppServiceConfig {
  alwaysOn: boolean;
  autoHealEnabled: boolean;
  ftpsState: string;
  healthCheckPath: string;
  http20Enabled: boolean;
  httpLoggingEnabled: boolean;
  detailedErrorLoggingEnabled: boolean;
  linuxFxVersion: string;
  windowsFxVersion: string;
  minTlsVersion: string;
  numberOfWorkers: number;
  use32BitWorkerProcess: boolean;
  webSocketsEnabled: boolean;
  nodeVersion: string;
  remoteDebuggingEnabled: boolean;
  scmType: string;
  cors: { allowedOrigins: string[] };
  ipSecurityRestrictions: unknown[];
  securityFindings: SecurityFinding[];
}

export interface AppSetting {
  name: string;
  value: string;
  slotSetting: boolean;
}

// SQL Database
export interface SqlOverview {
  name: string;
  status: string;
  location: string;
  edition: string;
  sku: { name: string; tier: string; capacity: number };
  maxSizeBytes: number;
  maxSizeGB: string;
  currentServiceObjectiveName: string;
  collation: string;
  creationDate: string;
  earliestRestoreDate: string;
  zoneRedundant: boolean;
}

export interface SqlServer {
  name: string;
  fullyQualifiedDomainName: string;
  state: string;
  version: string;
  location: string;
  administratorLogin: string;
  publicNetworkAccess: string;
  minimalTlsVersion: string;
}

export interface FirewallRule {
  name: string;
  startIpAddress: string;
  endIpAddress: string;
  isOpenToAll: boolean;
  isAzureServices: boolean;
}

// Monitor
export interface MetricDataPoint {
  timestamp: string;
  total: number;
  average: number;
  maximum: number;
  minimum: number;
}

export interface MonitorMetrics {
  Requests: MetricDataPoint[];
  AverageResponseTime: MetricDataPoint[];
  CpuTime: MetricDataPoint[];
  MemoryWorkingSet: MetricDataPoint[];
  Http5xx: MetricDataPoint[];
  Http4xx: MetricDataPoint[];
  Http2xx: MetricDataPoint[];
}

// Health
export interface ResourceHealth {
  resource: string;
  resourceName: string;
  availabilityState: string;
  summary: string;
  reasonType: string;
  occurredTime: string;
  reportedTime: string;
}

// Advisor
export interface AdvisorRecommendation {
  id: string;
  category: string;
  impact: string;
  impactedField: string;
  impactedValue: string;
  problem: string;
  solution: string;
  resourceType: string;
  lastUpdated: string;
}

export interface AdvisorData {
  total: number;
  grouped: {
    Security: AdvisorRecommendation[];
    HighAvailability: AdvisorRecommendation[];
    Cost: AdvisorRecommendation[];
    Performance: AdvisorRecommendation[];
    OperationalExcellence: AdvisorRecommendation[];
  };
  summary: Record<string, number>;
}

// Architecture
export interface ArchitectureResource {
  name: string;
  type: string;
  tier: string;
  region: string;
  os?: string;
  maxSize?: string;
}

export interface ArchitectureDiagram {
  mermaid: string;
  resources: ArchitectureResource[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AzureInfrastructureService {
  private baseUrl = environment.baseUrl + 'Azure';

  constructor(private http: HttpClient) {}

  // App Service
  getAppServiceOverview(): Observable<ApiResponse<AppServiceOverview>> {
    return this.http.get<ApiResponse<AppServiceOverview>>(`${this.baseUrl}/AppService/overview`);
  }

  getAppServiceConfig(): Observable<ApiResponse<AppServiceConfig>> {
    return this.http.get<ApiResponse<AppServiceConfig>>(`${this.baseUrl}/AppService/config`);
  }

  getAppServiceSettings(): Observable<ApiResponse<AppSetting[]>> {
    return this.http.get<ApiResponse<AppSetting[]>>(`${this.baseUrl}/AppService/settings`);
  }

  // SQL Database
  getSqlOverview(): Observable<ApiResponse<SqlOverview>> {
    return this.http.get<ApiResponse<SqlOverview>>(`${this.baseUrl}/SQL/overview`);
  }

  getSqlServer(): Observable<ApiResponse<SqlServer>> {
    return this.http.get<ApiResponse<SqlServer>>(`${this.baseUrl}/SQL/server`);
  }

  getFirewallRules(): Observable<ApiResponse<FirewallRule[]>> {
    return this.http.get<ApiResponse<FirewallRule[]>>(`${this.baseUrl}/SQL/firewall`);
  }

  addFirewallRule(name: string, startIpAddress: string, endIpAddress: string): Observable<ApiResponse<FirewallRule>> {
    return this.http.post<ApiResponse<FirewallRule>>(`${this.baseUrl}/SQL/firewall`, { name, startIpAddress, endIpAddress });
  }

  deleteFirewallRule(name: string): Observable<ApiResponse<{ message: string }>> {
    return this.http.delete<ApiResponse<{ message: string }>>(`${this.baseUrl}/SQL/firewall/${encodeURIComponent(name)}`);
  }

  // Monitor
  getMetrics(timeRange: string = 'PT1H', metricsInterval: string = 'PT5M'): Observable<ApiResponse<MonitorMetrics>> {
    return this.http.get<ApiResponse<MonitorMetrics>>(`${this.baseUrl}/Monitor/metrics`, {
      params: { timeRange, interval: metricsInterval }
    });
  }

  getMetricsAutoRefresh(refreshInterval: number = 30000): Observable<ApiResponse<MonitorMetrics>> {
    return interval(refreshInterval).pipe(
      startWith(0),
      switchMap(() => this.getMetrics()),
      shareReplay(1)
    );
  }

  // Health
  getHealthStatus(): Observable<ApiResponse<ResourceHealth[]>> {
    return this.http.get<ApiResponse<ResourceHealth[]>>(`${this.baseUrl}/Health/status`);
  }

  // Advisor
  getAdvisorRecommendations(): Observable<ApiResponse<AdvisorData>> {
    return this.http.get<ApiResponse<AdvisorData>>(`${this.baseUrl}/Advisor/recommendations`);
  }

  // Architecture
  getArchitectureDiagram(): Observable<ApiResponse<ArchitectureDiagram>> {
    return this.http.get<ApiResponse<ArchitectureDiagram>>(`${this.baseUrl}/Architecture/diagram`);
  }

  // Cache
  clearCache(): Observable<ApiResponse<{ message: string }>> {
    return this.http.post<ApiResponse<{ message: string }>>(`${this.baseUrl}/cache/clear`, {});
  }
}
