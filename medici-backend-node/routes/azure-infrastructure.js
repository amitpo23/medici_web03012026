const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');
const logger = require('../config/logger');

// Azure resource constants
const SUBSCRIPTION = '2da025cc-dfe5-450f-a18f-10549a3907e3';
const RESOURCE_GROUP = 'medici-hotels-rg';
const APP_NAME = 'medici-backend';
const SQL_SERVER = 'medici-sql-server';
const SQL_DB = 'medici-db';

// Simple in-memory cache (60s TTL)
const cache = new Map();
const CACHE_TTL = 60000;

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

function runAzCmd(cmd) {
  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 30000,
      windowsHide: true
    });
    return JSON.parse(result);
  } catch (err) {
    logger.error('Azure CLI command failed', { cmd: cmd.substring(0, 100), error: err.message });
    throw new Error(`Azure CLI error: ${err.message}`);
  }
}

// =============================================
// APP SERVICE ENDPOINTS
// =============================================

// GET /Azure/AppService/overview
router.get('/AppService/overview', (req, res) => {
  try {
    const cacheKey = 'appservice-overview';
    let data = getCached(cacheKey);
    if (!data) {
      const raw = runAzCmd(
        `az webapp show --name ${APP_NAME} --resource-group ${RESOURCE_GROUP} --subscription ${SUBSCRIPTION} --output json`
      );
      data = {
        name: raw.name,
        state: raw.state,
        defaultHostName: raw.defaultHostName,
        location: raw.location,
        kind: raw.kind,
        httpsOnly: raw.httpsOnly,
        enabled: raw.enabled,
        availabilityState: raw.availabilityState,
        identity: raw.identity ? { type: raw.identity.type, principalId: raw.identity.principalId } : null,
        hostNames: raw.hostNames,
        resourceGroup: raw.resourceGroup,
        appServicePlan: raw.appServicePlanId ? raw.appServicePlanId.split('/').pop() : null,
        lastModified: raw.lastModifiedTimeUtc,
        outboundIpAddresses: raw.outboundIpAddresses,
        possibleOutboundIpAddresses: raw.possibleOutboundIpAddresses
      };
      setCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /Azure/AppService/config
router.get('/AppService/config', (req, res) => {
  try {
    const cacheKey = 'appservice-config';
    let data = getCached(cacheKey);
    if (!data) {
      const raw = runAzCmd(
        `az webapp config show --name ${APP_NAME} --resource-group ${RESOURCE_GROUP} --subscription ${SUBSCRIPTION} --output json`
      );
      data = {
        alwaysOn: raw.alwaysOn,
        autoHealEnabled: raw.autoHealEnabled,
        ftpsState: raw.ftpsState,
        healthCheckPath: raw.healthCheckPath,
        http20Enabled: raw.http20Enabled,
        httpLoggingEnabled: raw.httpLoggingEnabled,
        detailedErrorLoggingEnabled: raw.detailedErrorLoggingEnabled,
        linuxFxVersion: raw.linuxFxVersion,
        windowsFxVersion: raw.windowsFxVersion,
        minTlsVersion: raw.minTlsVersion,
        numberOfWorkers: raw.numberOfWorkers,
        use32BitWorkerProcess: raw.use32BitWorkerProcess,
        webSocketsEnabled: raw.webSocketsEnabled,
        nodeVersion: raw.nodeVersion,
        phpVersion: raw.phpVersion,
        pythonVersion: raw.pythonVersion,
        remoteDebuggingEnabled: raw.remoteDebuggingEnabled,
        scmType: raw.scmType,
        cors: raw.cors,
        ipSecurityRestrictions: raw.ipSecurityRestrictions,
        virtualApplications: raw.virtualApplications,
        // Security findings
        securityFindings: []
      };
      // Analyze security
      if (raw.ftpsState === 'AllAllowed') {
        data.securityFindings.push({ severity: 'HIGH', finding: 'FTPS allows unencrypted connections', recommendation: 'Set ftpsState to FtpsOnly or Disabled' });
      }
      if (!raw.healthCheckPath) {
        data.securityFindings.push({ severity: 'MEDIUM', finding: 'No health check path configured', recommendation: 'Set health check path to /health' });
      }
      if (!raw.httpLoggingEnabled) {
        data.securityFindings.push({ severity: 'MEDIUM', finding: 'HTTP logging is disabled', recommendation: 'Enable HTTP logging for audit trail' });
      }
      if (raw.use32BitWorkerProcess) {
        data.securityFindings.push({ severity: 'LOW', finding: 'Using 32-bit worker process', recommendation: 'Switch to 64-bit for better performance' });
      }
      if (raw.minTlsVersion !== '1.2' && raw.minTlsVersion !== '1.3') {
        data.securityFindings.push({ severity: 'HIGH', finding: `Minimum TLS version is ${raw.minTlsVersion}`, recommendation: 'Set minimum TLS to 1.2 or higher' });
      }
      if (!raw.http20Enabled) {
        data.securityFindings.push({ severity: 'LOW', finding: 'HTTP/2 is not enabled', recommendation: 'Enable HTTP/2 for performance' });
      }
      setCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /Azure/AppService/settings
router.get('/AppService/settings', (req, res) => {
  try {
    const cacheKey = 'appservice-settings';
    let data = getCached(cacheKey);
    if (!data) {
      const raw = runAzCmd(
        `az webapp config appsettings list --name ${APP_NAME} --resource-group ${RESOURCE_GROUP} --subscription ${SUBSCRIPTION} --output json`
      );
      // Filter out sensitive values
      data = raw.map(s => ({
        name: s.name,
        value: s.name.toLowerCase().includes('password') || s.name.toLowerCase().includes('secret') || s.name.toLowerCase().includes('key')
          ? '***REDACTED***' : s.value,
        slotSetting: s.slotSetting
      }));
      setCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================
// SQL DATABASE ENDPOINTS
// =============================================

// GET /Azure/SQL/overview
router.get('/SQL/overview', (req, res) => {
  try {
    const cacheKey = 'sql-overview';
    let data = getCached(cacheKey);
    if (!data) {
      const raw = runAzCmd(
        `az sql db show --name ${SQL_DB} --server ${SQL_SERVER} --resource-group ${RESOURCE_GROUP} --subscription ${SUBSCRIPTION} --output json`
      );
      data = {
        name: raw.name,
        status: raw.status,
        location: raw.location,
        edition: raw.edition || raw.sku?.tier,
        sku: raw.sku,
        maxSizeBytes: raw.maxSizeBytes,
        maxSizeGB: raw.maxSizeBytes ? (raw.maxSizeBytes / (1024 * 1024 * 1024)).toFixed(1) : null,
        currentServiceObjectiveName: raw.currentServiceObjectiveName,
        requestedServiceObjectiveName: raw.requestedServiceObjectiveName,
        collation: raw.collation,
        creationDate: raw.creationDate,
        earliestRestoreDate: raw.earliestRestoreDate,
        zoneRedundant: raw.zoneRedundant,
        readScale: raw.readScale,
        catalogCollation: raw.catalogCollation,
        currentSku: raw.currentSku
      };
      setCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /Azure/SQL/server
router.get('/SQL/server', (req, res) => {
  try {
    const cacheKey = 'sql-server';
    let data = getCached(cacheKey);
    if (!data) {
      const raw = runAzCmd(
        `az sql server show --name ${SQL_SERVER} --resource-group ${RESOURCE_GROUP} --subscription ${SUBSCRIPTION} --output json`
      );
      data = {
        name: raw.name,
        fullyQualifiedDomainName: raw.fullyQualifiedDomainName,
        state: raw.state,
        version: raw.version,
        location: raw.location,
        administratorLogin: raw.administratorLogin,
        publicNetworkAccess: raw.publicNetworkAccess,
        minimalTlsVersion: raw.minimalTlsVersion,
        identity: raw.identity ? { type: raw.identity.type } : null
      };
      setCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /Azure/SQL/firewall
router.get('/SQL/firewall', (req, res) => {
  try {
    const cacheKey = 'sql-firewall';
    let data = getCached(cacheKey);
    if (!data) {
      data = runAzCmd(
        `az sql server firewall-rule list --server ${SQL_SERVER} --resource-group ${RESOURCE_GROUP} --subscription ${SUBSCRIPTION} --output json`
      );
      // Add security findings
      data = data.map(rule => ({
        ...rule,
        isOpenToAll: rule.startIpAddress === '0.0.0.0' && rule.endIpAddress === '255.255.255.255',
        isAzureServices: rule.startIpAddress === '0.0.0.0' && rule.endIpAddress === '0.0.0.0'
      }));
      setCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /Azure/SQL/firewall
router.post('/SQL/firewall', (req, res) => {
  try {
    const { name, startIpAddress, endIpAddress } = req.body;
    if (!name || !startIpAddress || !endIpAddress) {
      return res.status(400).json({ success: false, error: 'name, startIpAddress, and endIpAddress are required' });
    }
    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(startIpAddress) || !ipRegex.test(endIpAddress)) {
      return res.status(400).json({ success: false, error: 'Invalid IP address format' });
    }
    const data = runAzCmd(
      `az sql server firewall-rule create --name "${name}" --server ${SQL_SERVER} --resource-group ${RESOURCE_GROUP} --subscription ${SUBSCRIPTION} --start-ip-address ${startIpAddress} --end-ip-address ${endIpAddress} --output json`
    );
    cache.delete('sql-firewall');
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /Azure/SQL/firewall/:name
router.delete('/SQL/firewall/:name', (req, res) => {
  try {
    const ruleName = req.params.name;
    if (!ruleName) {
      return res.status(400).json({ success: false, error: 'Firewall rule name is required' });
    }
    runAzCmd(
      `az sql server firewall-rule delete --name "${ruleName}" --server ${SQL_SERVER} --resource-group ${RESOURCE_GROUP} --subscription ${SUBSCRIPTION} --output json`
    );
    cache.delete('sql-firewall');
    res.json({ success: true, message: `Firewall rule '${ruleName}' deleted` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================
// MONITOR ENDPOINTS
// =============================================

// GET /Azure/Monitor/metrics
router.get('/Monitor/metrics', (req, res) => {
  try {
    const timeRange = req.query.timeRange || 'PT1H';
    const interval = req.query.interval || 'PT5M';
    const cacheKey = `monitor-metrics-${timeRange}-${interval}`;
    let data = getCached(cacheKey);
    if (!data) {
      const resourceId = `/subscriptions/${SUBSCRIPTION}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Web/sites/${APP_NAME}`;
      const metrics = ['Requests', 'AverageResponseTime', 'CpuTime', 'MemoryWorkingSet', 'Http5xx', 'Http4xx', 'Http2xx'];
      data = {};
      for (const metric of metrics) {
        try {
          const raw = runAzCmd(
            `az monitor metrics list --resource "${resourceId}" --metric "${metric}" --interval ${interval} --start-time "${getStartTime(timeRange)}" --output json`
          );
          if (raw.value && raw.value.length > 0) {
            const timeseries = raw.value[0].timeseries;
            if (timeseries && timeseries.length > 0) {
              data[metric] = timeseries[0].data.map(d => ({
                timestamp: d.timeStamp,
                total: d.total || 0,
                average: d.average || 0,
                maximum: d.maximum || 0,
                minimum: d.minimum || 0
              }));
            } else {
              data[metric] = [];
            }
          } else {
            data[metric] = [];
          }
        } catch {
          data[metric] = [];
        }
      }
      setCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function getStartTime(timeRange) {
  const now = new Date();
  const map = {
    'PT1H': 1 * 60 * 60 * 1000,
    'PT6H': 6 * 60 * 60 * 1000,
    'PT24H': 24 * 60 * 60 * 1000,
    'P7D': 7 * 24 * 60 * 60 * 1000
  };
  const ms = map[timeRange] || map['PT1H'];
  return new Date(now.getTime() - ms).toISOString();
}

// =============================================
// HEALTH ENDPOINTS
// =============================================

// GET /Azure/Health/status
router.get('/Health/status', (req, res) => {
  try {
    const cacheKey = 'health-status';
    let data = getCached(cacheKey);
    if (!data) {
      const resources = [
        { name: APP_NAME, type: 'Microsoft.Web/sites', display: 'App Service' },
        { name: SQL_SERVER, type: 'Microsoft.Sql/servers', display: 'SQL Server' },
        { name: SQL_DB, type: 'Microsoft.Sql/servers/databases', display: 'SQL Database', parent: SQL_SERVER }
      ];
      data = [];
      for (const resource of resources) {
        try {
          let resourceId;
          if (resource.parent) {
            resourceId = `/subscriptions/${SUBSCRIPTION}/resourceGroups/${RESOURCE_GROUP}/providers/${resource.type}/${resource.parent}/${resource.name}`;
          } else {
            resourceId = `/subscriptions/${SUBSCRIPTION}/resourceGroups/${RESOURCE_GROUP}/providers/${resource.type}/${resource.name}`;
          }
          const raw = runAzCmd(
            `az rest --method get --url "https://management.azure.com${resourceId}/providers/Microsoft.ResourceHealth/availabilityStatuses/current?api-version=2022-10-01" --output json`
          );
          data.push({
            resource: resource.display,
            resourceName: resource.name,
            availabilityState: raw.properties?.availabilityState || 'Unknown',
            summary: raw.properties?.summary || '',
            reasonType: raw.properties?.reasonType || '',
            occurredTime: raw.properties?.occurredTime || '',
            reportedTime: raw.properties?.reportedTime || ''
          });
        } catch {
          data.push({
            resource: resource.display,
            resourceName: resource.name,
            availabilityState: 'Unknown',
            summary: 'Unable to fetch health status',
            reasonType: '',
            occurredTime: '',
            reportedTime: ''
          });
        }
      }
      setCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================
// ADVISOR ENDPOINTS
// =============================================

// GET /Azure/Advisor/recommendations
router.get('/Advisor/recommendations', (req, res) => {
  try {
    const cacheKey = 'advisor-recommendations';
    let data = getCached(cacheKey);
    if (!data) {
      const raw = runAzCmd(
        `az advisor recommendation list --resource-group ${RESOURCE_GROUP} --subscription ${SUBSCRIPTION} --output json`
      );
      const grouped = {
        Security: [],
        HighAvailability: [],
        Cost: [],
        Performance: [],
        OperationalExcellence: []
      };
      for (const rec of raw) {
        const category = rec.category || 'OperationalExcellence';
        const item = {
          id: rec.id,
          category: rec.category,
          impact: rec.impact,
          impactedField: rec.impactedField,
          impactedValue: rec.impactedValue,
          problem: rec.shortDescription?.problem || '',
          solution: rec.shortDescription?.solution || '',
          resourceType: rec.resourceMetadata?.resourceId?.split('/providers/').pop()?.split('/')[0] || '',
          lastUpdated: rec.lastUpdated
        };
        if (grouped[category]) {
          grouped[category].push(item);
        } else {
          grouped.OperationalExcellence.push(item);
        }
      }
      data = {
        total: raw.length,
        grouped,
        summary: {
          Security: grouped.Security.length,
          HighAvailability: grouped.HighAvailability.length,
          Cost: grouped.Cost.length,
          Performance: grouped.Performance.length,
          OperationalExcellence: grouped.OperationalExcellence.length
        }
      };
      setCache(cacheKey, data);
    }
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================
// ARCHITECTURE ENDPOINT
// =============================================

// GET /Azure/Architecture/diagram
router.get('/Architecture/diagram', (req, res) => {
  const diagram = {
    mermaid: `graph TB
      subgraph "Azure Cloud - East US 2"
        subgraph "Production"
          FE["medici-frontend<br/>Static Web Apps"]
          BE["medici-backend<br/>App Service S1<br/>Windows / .NET"]
          SQL["medici-db<br/>SQL Database S3<br/>100 DTU"]
          STORE["medicibackupstorage<br/>Storage Account"]
        end
        subgraph "External Services"
          OAI["Azure OpenAI<br/>GPT-4"]
          REDIS["medici-redis-dev<br/>Redis Cache"]
        end
        subgraph "Dev Environment"
          BEDEV["medici-backend-dev<br/>App Service Basic<br/>Linux / Node 20"]
          SQLDEV["medici-db-dev-copy<br/>SQL Database"]
        end
      end
      subgraph "External APIs"
        INN["Innstant API<br/>Hotel Supplier"]
        GOG["GoGlobal API<br/>Hotel Supplier"]
        ZEN["Zenith<br/>Push Service"]
        SLACK["Slack<br/>Notifications"]
      end
      FE -->|HTTP/HTTPS| BE
      BE -->|TDS| SQL
      BE -->|Blob| STORE
      BE -->|REST| OAI
      BE -->|TCP| REDIS
      BE -->|REST| INN
      BE -->|REST| GOG
      BE -->|REST| ZEN
      BE -->|Webhook| SLACK
      BEDEV -->|TDS| SQLDEV`,
    resources: [
      { name: 'medici-backend', type: 'App Service', tier: 'Standard S1', region: 'East US 2', os: 'Windows' },
      { name: 'medici-sql-server/medici-db', type: 'SQL Database', tier: 'Standard S3 (100 DTU)', region: 'East US', maxSize: '250 GB' },
      { name: 'medicibackupstorage', type: 'Storage Account', tier: 'Standard', region: 'East US 2' },
      { name: 'medici-backend-dev', type: 'App Service', tier: 'Basic', region: 'East US 2', os: 'Linux' },
      { name: 'medici-redis-dev', type: 'Redis Cache', tier: 'Basic', region: 'East US 2' }
    ]
  };
  res.json({ success: true, data: diagram });
});

// =============================================
// CACHE MANAGEMENT
// =============================================

// POST /Azure/cache/clear
router.post('/cache/clear', (req, res) => {
  cache.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

module.exports = router;
