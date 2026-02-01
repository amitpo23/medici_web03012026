/**
 * Logs Management Routes
 * View, search, and manage application logs
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');
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

    // Security: Strip directory traversal and only allow .log files
    const safeName = path.basename(filename);
    if (!safeName.endsWith('.log') || safeName !== filename) {
      return res.status(400).json({ error: 'Invalid log file' });
    }

    const filepath = path.join(logsDir, safeName);
    
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
 * GET /logs/tail/:filename - Stream last N lines using readline (memory-efficient)
 */
router.get('/tail/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const maxLines = parseInt(req.query.lines, 10) || 50;

    const safeName = path.basename(filename);
    if (!safeName.endsWith('.log') || safeName !== filename) {
      return res.status(400).json({ error: 'Invalid log file' });
    }

    const filepath = path.join(logsDir, safeName);

    // Check file exists
    try {
      await fs.access(filepath);
    } catch {
      return res.status(404).json({ error: 'Log file not found' });
    }

    // Use readline stream to read lines without loading entire file into memory
    const buffer = [];
    const rl = readline.createInterface({
      input: fsSync.createReadStream(filepath, { encoding: 'utf-8' }),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (line.trim()) {
        buffer.push(line);
        if (buffer.length > maxLines) {
          buffer.shift();
        }
      }
    }

    res.json({
      filename,
      lines: buffer.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      })
    });

  } catch (error) {
    logger.error('Failed to tail log file', { error: error.message });
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
      if (results.length >= limit) break;

      const filepath = path.join(logsDir, file);
      const rl = readline.createInterface({
        input: fsSync.createReadStream(filepath, { encoding: 'utf-8' }),
        crlfDelay: Infinity
      });

      for await (const line of rl) {
        if (!line.trim()) continue;
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

          if (results.length >= limit) {
            rl.close();
            break;
          }

        } catch {
          // Skip invalid JSON lines
        }
      }
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

    // Security: Strip directory traversal and only allow .log files
    const safeName = path.basename(filename);
    if (!safeName.endsWith('.log') || safeName !== filename) {
      return res.status(400).json({ error: 'Invalid log file' });
    }

    // Don't delete today's logs
    const today = new Date().toISOString().split('T')[0];
    if (safeName.includes(today)) {
      return res.status(403).json({ error: 'Cannot delete current day logs' });
    }

    const filepath = path.join(logsDir, safeName);
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
