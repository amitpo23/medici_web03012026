/**
 * Logs Management Routes
 * View, search, and manage application logs
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');

const logsDir = path.join(__dirname, '../logs');

/**
 * GET /logs - List available log files
 */
router.get('/', async (req, res) => {
  try {
    const files = await fs.readdir(logsDir);
    
    const logFiles = await Promise.all(
      files.map(async (file) => {
        const stats = await fs.stat(path.join(logsDir, file));
        return {
          name: file,
          size: `${(stats.size / 1024).toFixed(2)} KB`,
          modified: stats.mtime,
          type: file.includes('error') ? 'error' : 
                file.includes('http') ? 'http' : 
                file.includes('debug') ? 'debug' : 'application'
        };
      })
    );
    
    // Sort by modified date (newest first)
    logFiles.sort((a, b) => b.modified - a.modified);
    
    res.json({
      success: true,
      logsDirectory: logsDir,
      files: logFiles,
      count: logFiles.length
    });
    
  } catch (error) {
    logger.error('Failed to list log files', { error: error.message });
    res.status(500).json({ error: 'Failed to list log files' });
  }
});

/**
 * GET /logs/:filename - View specific log file
 */
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { lines = 100, search } = req.query;
    
    // Security: Only allow log files
    if (!filename.endsWith('.log')) {
      return res.status(400).json({ error: 'Invalid log file' });
    }
    
    const filepath = path.join(logsDir, filename);
    
    // Check if file exists
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Log file not found' });
    }
    
    // Read file
    const content = await fs.readFile(filepath, 'utf-8');
    const allLines = content.split('\n').filter(line => line.trim());
    
    // Search filter
    let filteredLines = allLines;
    if (search) {
      filteredLines = allLines.filter(line => 
        line.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    // Get last N lines
    const lastLines = filteredLines.slice(-parseInt(lines));
    
    res.json({
      success: true,
      filename,
      totalLines: allLines.length,
      filteredLines: filteredLines.length,
      returnedLines: lastLines.length,
      lines: lastLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      })
    });
    
  } catch (error) {
    logger.error('Failed to read log file', { error: error.message });
    res.status(500).json({ error: 'Failed to read log file' });
  }
});

/**
 * GET /logs/tail/:filename - Stream log file (last N lines, real-time)
 */
router.get('/tail/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const lines = parseInt(req.query.lines) || 50;
    
    if (!filename.endsWith('.log')) {
      return res.status(400).json({ error: 'Invalid log file' });
    }
    
    const filepath = path.join(logsDir, filename);
    const content = await fs.readFile(filepath, 'utf-8');
    const lastLines = content.split('\n').filter(line => line.trim()).slice(-lines);
    
    res.json({
      filename,
      lines: lastLines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      })
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /logs/search - Search across all log files
 */
router.post('/search', async (req, res) => {
  try {
    const { 
      query, 
      level, 
      startDate, 
      endDate, 
      hotelName,
      bookingId,
      source,
      limit = 100 
    } = req.body;
    
    logger.info('Log search', { query, level, startDate, endDate, hotelName, bookingId });
    
    const files = await fs.readdir(logsDir);
    const logFiles = files.filter(f => f.endsWith('.log'));
    
    const results = [];
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    for (const file of logFiles) {
      const content = await fs.readFile(path.join(logsDir, file), 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const logEntry = JSON.parse(line);
          
          // Filter by text query
          if (query) {
            const lineStr = JSON.stringify(logEntry).toLowerCase();
            if (!lineStr.includes(query.toLowerCase())) continue;
          }
          
          // Filter by level
          if (level && logEntry.level !== level) continue;
          
          // Filter by date range
          if (start && new Date(logEntry.timestamp) < start) continue;
          if (end && new Date(logEntry.timestamp) > end) continue;
          
          // Filter by hotel name
          if (hotelName) {
            const lineStr = JSON.stringify(logEntry).toLowerCase();
            if (!lineStr.includes(hotelName.toLowerCase())) continue;
          }
          
          // Filter by booking ID
          if (bookingId) {
            const lineStr = JSON.stringify(logEntry);
            if (!lineStr.includes(bookingId.toString())) continue;
          }
          
          // Filter by source (scraper, zenith, etc.)
          if (source) {
            const lineStr = JSON.stringify(logEntry).toLowerCase();
            if (!lineStr.includes(source.toLowerCase())) continue;
          }
          
          results.push({
            file,
            ...logEntry
          });
          
          if (results.length >= limit) break;
          
        } catch {
          // Skip invalid JSON lines
        }
      }
      
      if (results.length >= limit) break;
    }
    
    res.json({
      success: true,
      query: { query, level, startDate, endDate, hotelName, bookingId, source },
      results,
      count: results.length
    });
    
  } catch (error) {
    logger.error('Log search failed', { error: error.message });
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /logs/stats/summary - Get log statistics
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const files = await fs.readdir(logsDir);
    const logFiles = files.filter(f => f.endsWith('.log'));
    
    const stats = {
      totalFiles: logFiles.length,
      totalSize: 0,
      byType: {},
      recentErrors: []
    };
    
    // Calculate total size and breakdown
    for (const file of logFiles) {
      const filePath = path.join(logsDir, file);
      const stat = await fs.stat(filePath);
      stats.totalSize += stat.size;
      
      const type = file.includes('error') ? 'errors' :
                   file.includes('http') ? 'http' :
                   file.includes('debug') ? 'debug' : 'application';
      
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, size: 0 };
      }
      stats.byType[type].count++;
      stats.byType[type].size += stat.size;
      
      // Get recent errors
      if (type === 'errors') {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim()).slice(-10);
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.level === 'error') {
              stats.recentErrors.push({
                timestamp: entry.timestamp,
                message: entry.message,
                file
              });
            }
          } catch {}
        }
      }
    }
    
    stats.totalSize = `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`;
    stats.recentErrors = stats.recentErrors.slice(-5);
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    logger.error('Failed to get log stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * GET /logs/analytics/charts - Get chart data for log visualization
 */
router.get('/analytics/charts', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const hoursNum = Math.min(72, Math.max(1, parseInt(hours) || 24));

    const files = await fs.readdir(logsDir);
    const logFiles = files.filter(f => f.endsWith('.log') && (f.includes('http') || f.includes('application')));

    const now = new Date();
    const cutoff = new Date(now.getTime() - hoursNum * 60 * 60 * 1000);

    // Initialize hourly buckets
    const hourlyData = {};
    const statusCodes = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
    const levelCounts = { info: 0, warn: 0, error: 0 };
    const methodCounts = { GET: 0, POST: 0, PUT: 0, DELETE: 0, OTHER: 0 };
    const responseTimeBuckets = { '<100ms': 0, '100-500ms': 0, '500ms-1s': 0, '1-2s': 0, '>2s': 0 };

    for (let i = 0; i < hoursNum; i++) {
      const hourKey = new Date(now.getTime() - i * 60 * 60 * 1000).toISOString().slice(0, 13);
      hourlyData[hourKey] = { requests: 0, errors: 0, avgResponseTime: 0, responseTimes: [] };
    }

    // Process log files
    for (const file of logFiles) {
      try {
        const content = await fs.readFile(path.join(logsDir, file), 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            const logTime = new Date(entry.timestamp);

            if (logTime < cutoff) continue;

            const hourKey = logTime.toISOString().slice(0, 13);
            if (hourlyData[hourKey]) {
              hourlyData[hourKey].requests++;

              // Track response time
              if (entry.responseTime) {
                const ms = parseInt(entry.responseTime.replace('ms', ''));
                if (!isNaN(ms)) {
                  hourlyData[hourKey].responseTimes.push(ms);

                  // Response time distribution
                  if (ms < 100) responseTimeBuckets['<100ms']++;
                  else if (ms < 500) responseTimeBuckets['100-500ms']++;
                  else if (ms < 1000) responseTimeBuckets['500ms-1s']++;
                  else if (ms < 2000) responseTimeBuckets['1-2s']++;
                  else responseTimeBuckets['>2s']++;
                }
              }

              // Track errors
              if (entry.level === 'error' || (entry.status && entry.status >= 400)) {
                hourlyData[hourKey].errors++;
              }
            }

            // Status code distribution
            if (entry.status) {
              const statusGroup = `${Math.floor(entry.status / 100)}xx`;
              if (statusCodes[statusGroup] !== undefined) {
                statusCodes[statusGroup]++;
              }
            }

            // Level distribution
            if (entry.level && levelCounts[entry.level] !== undefined) {
              levelCounts[entry.level]++;
            }

            // Method distribution
            if (entry.method) {
              const method = entry.method.toUpperCase();
              if (methodCounts[method] !== undefined) {
                methodCounts[method]++;
              } else {
                methodCounts.OTHER++;
              }
            }
          } catch {
            // Skip invalid JSON
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Calculate averages
    const timeSeriesData = Object.entries(hourlyData)
      .map(([hour, data]) => ({
        hour,
        requests: data.requests,
        errors: data.errors,
        avgResponseTime: data.responseTimes.length > 0
          ? Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length)
          : 0
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    res.json({
      success: true,
      period: `${hoursNum} hours`,
      charts: {
        timeSeries: timeSeriesData,
        statusDistribution: statusCodes,
        levelDistribution: levelCounts,
        methodDistribution: methodCounts,
        responseTimeDistribution: responseTimeBuckets
      }
    });

  } catch (error) {
    logger.error('Failed to get chart data', { error: error.message });
    res.status(500).json({ error: 'Failed to get chart data' });
  }
});

/**
 * DELETE /logs/:filename - Delete old log file (admin only)
 */
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Security checks
    if (!filename.endsWith('.log')) {
      return res.status(400).json({ error: 'Invalid log file' });
    }
    
    // Don't delete today's logs
    const today = new Date().toISOString().split('T')[0];
    if (filename.includes(today)) {
      return res.status(403).json({ error: 'Cannot delete current day logs' });
    }
    
    const filepath = path.join(logsDir, filename);
    await fs.unlink(filepath);
    
    logger.warn('Log file deleted', { filename, deletedBy: 'admin' });
    
    res.json({
      success: true,
      message: `Log file ${filename} deleted`
    });
    
  } catch (error) {
    logger.error('Failed to delete log file', { error: error.message });
    res.status(500).json({ error: 'Failed to delete log file' });
  }
});

module.exports = router;
