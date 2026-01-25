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
