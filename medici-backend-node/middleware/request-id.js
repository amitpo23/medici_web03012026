/**
 * Request ID Middleware
 * Assigns a unique ID to each request for cross-service log correlation.
 * The ID is available as req.requestId and returned in the X-Request-ID response header.
 */

const crypto = require('crypto');

function requestId(req, res, next) {
  // Use incoming request ID if provided (for distributed tracing), otherwise generate one
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

module.exports = requestId;
