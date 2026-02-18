/**
 * Global Error Handler Middleware
 * Following nodejs-backend-patterns skill principles
 *
 * Catches all errors and returns sanitized responses
 * Logs unexpected errors for debugging
 */

const { AppError } = require('../utils/errors');
const logger = require('../config/logger');

/**
 * Development error response - includes stack trace
 */
function sendDevError(err, res) {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      details: err.details || null,
      stack: err.stack
    }
  });
}

/**
 * Production error response - sanitized
 */
function sendProdError(err, res) {
  // Operational errors: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: err.code,
        ...(err.details && { details: err.details })
      }
    });
  } else {
    // Programming/unknown errors: don't leak details
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      error: { code: 'INTERNAL_ERROR' }
    });
  }
}

/**
 * Handle specific error types
 */
function handleSpecificErrors(err) {
  // SQL Server errors
  if (err.code === 'EREQUEST' || err.code === 'ENOCONN') {
    const error = new AppError('Database connection error', 503, 'DATABASE_ERROR');
    error.isOperational = true;
    return error;
  }

  // SQL syntax/constraint errors
  if (err.number) {
    // Foreign key violation
    if (err.number === 547) {
      const error = new AppError('Operation violates data integrity constraints', 409, 'CONSTRAINT_VIOLATION');
      error.isOperational = true;
      return error;
    }
    // Duplicate key
    if (err.number === 2627 || err.number === 2601) {
      const error = new AppError('Duplicate entry exists', 409, 'DUPLICATE_ENTRY');
      error.isOperational = true;
      return error;
    }
  }

  // JSON parse errors
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    const error = new AppError('Invalid JSON in request body', 400, 'INVALID_JSON');
    error.isOperational = true;
    return error;
  }

  // Axios/HTTP errors from external services
  if (err.isAxiosError) {
    const service = err.config?.baseURL || 'External service';
    const error = new AppError(`${service} unavailable`, 503, 'EXTERNAL_SERVICE_ERROR');
    error.isOperational = true;
    return error;
  }

  return err;
}

/**
 * Main error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Set defaults
  err.statusCode = err.statusCode || 500;
  err.code = err.code || 'INTERNAL_ERROR';

  // Handle specific error types
  const processedError = handleSpecificErrors(err);

  // Log all errors
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    statusCode: processedError.statusCode,
    errorCode: processedError.code,
    message: processedError.message,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  };

  if (processedError.statusCode >= 500) {
    logger.error('Request error', logData);
    if (!processedError.isOperational) {
      logger.error('Stack trace', { stack: processedError.stack });
    }
  } else {
    logger.warn('Request warning', logData);
  }

  // Send appropriate response
  if (process.env.NODE_ENV === 'development') {
    sendDevError(processedError, res);
  } else {
    sendProdError(processedError, res);
  }
}

/**
 * Handle 404 for unmatched routes
 */
function notFoundHandler(req, res, next) {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404, 'ROUTE_NOT_FOUND');
  next(error);
}

/**
 * Handle uncaught exceptions
 */
function setupUncaughtHandlers() {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception - shutting down', { name: err.name, message: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled rejection - shutting down', { error: String(err) });
    process.exit(1);
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
  setupUncaughtHandlers
};
