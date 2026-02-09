const logger = require('../config/logger');

// Request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress
    });
  });
  
  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.error('HTTP Error', {
    method: req.method,
    url: req.url,
    error: err.message,
    stack: err.stack,
    ip: req.ip || req.connection.remoteAddress
  });
  
  next(err);
};

module.exports = { requestLogger, errorLogger };
