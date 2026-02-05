/**
 * Winston Logger Configuration
 * Comprehensive logging system with rotation, levels, and formats
 * Includes real-time Socket.IO push for error notifications
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Socket.IO reference (set after server starts)
let socketService = null;

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    
    return msg;
  })
);

// Custom format for file output (JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Transport: Console (for development)
const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
  level: process.env.LOG_LEVEL || 'info'
});

// Transport: All logs (daily rotation)
const allLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'application-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: fileFormat,
  level: 'info'
});

// Transport: Error logs only (daily rotation)
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: fileFormat,
  level: 'error'
});

// Transport: HTTP logs (daily rotation)
const httpLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '7d',
  format: fileFormat,
  level: 'http'
});

// Transport: Debug logs (daily rotation, only in development)
const debugLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'debug-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '3d',
  format: fileFormat,
  level: 'debug'
});

// Custom Transport: Socket.IO real-time push for errors and warnings
class SocketIOTransport extends winston.Transport {
  constructor(opts) {
    super(opts);
    this.name = 'socketio';
    this.level = opts.level || 'error';
  }

  log(info, callback) {
    setImmediate(() => {
      if (socketService && socketService.isInitialized()) {
        // Only push errors and warnings to avoid flooding
        if (info.level === 'error' || info.level === 'warn') {
          socketService.emit('log-entry', {
            level: info.level,
            message: info.message,
            timestamp: info.timestamp || new Date().toISOString(),
            meta: { ...info, level: undefined, message: undefined, timestamp: undefined }
          });
        }
      }
    });
    callback();
  }
}

const socketTransport = new SocketIOTransport({ level: 'warn' });

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: winston.config.npm.levels,
  transports: [
    consoleTransport,
    allLogsTransport,
    errorLogsTransport,
    httpLogsTransport,
    socketTransport
  ],
  exitOnError: false
});

// Set Socket.IO service reference (called from server.js after socket init)
logger.setSocketService = (service) => {
  socketService = service;
  logger.info('[Logger] Socket.IO transport connected');
};

// Add debug logs only in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(debugLogsTransport);
}

// Log uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({ 
    filename: path.join(logsDir, 'exceptions.log'),
    format: fileFormat
  })
);

// Log unhandled promise rejections
logger.rejections.handle(
  new winston.transports.File({ 
    filename: path.join(logsDir, 'rejections.log'),
    format: fileFormat
  })
);

// Helper methods for structured logging
logger.logRequest = (req, statusCode, duration) => {
  const logData = {
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode,
    duration: `${duration}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent')
  };
  
  if (statusCode >= 500) {
    logger.error('HTTP Request Failed', logData);
  } else if (statusCode >= 400) {
    logger.warn('HTTP Request Error', logData);
  } else {
    logger.http('HTTP Request', logData);
  }
};

logger.logDBQuery = (query, duration, rowCount) => {
  logger.debug('Database Query', {
    query: query.substring(0, 200),
    duration: `${duration}ms`,
    rowCount
  });
};

logger.logScraperActivity = (hotel, source, success, price) => {
  logger.info('Scraper Activity', {
    hotel,
    source,
    success,
    price: price || 'N/A'
  });
};

logger.logAIActivity = (type, question, success) => {
  logger.info('AI Activity', {
    type,
    question: question.substring(0, 100),
    success
  });
};

logger.logZenithPush = (opportunityId, success, error) => {
  if (success) {
    logger.info('Zenith Push Success', { opportunityId });
  } else {
    logger.error('Zenith Push Failed', { opportunityId, error });
  }
};

logger.logEmailSent = (to, subject, success) => {
  if (success) {
    logger.info('Email Sent', { to, subject });
  } else {
    logger.error('Email Failed', { to, subject });
  }
};

// Log rotation events
allLogsTransport.on('rotate', (oldFilename, newFilename) => {
  logger.info('Log file rotated', { oldFilename, newFilename });
});

// Log startup
logger.info('Logger initialized', {
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  logsDirectory: logsDir
});

module.exports = logger;
