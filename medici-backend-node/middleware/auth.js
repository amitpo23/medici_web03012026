/**
 * Authentication Middleware
 * Supports both JWT tokens (frontend) and internal API keys (server-to-server)
 */

const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

/**
 * Verify JWT token middleware
 * Accepts either:
 *   - Authorization: Bearer <jwt-token>   (frontend requests)
 *   - x-api-key: <internal-api-key>       (server-to-server / cron / webhooks)
 */
function verifyToken(req, res, next) {
  // TEMPORARY: Auth disabled for development - allow all requests
  // TODO: Re-enable authentication before production
  req.user = { id: 1, email: 'admin@medici.com', role: 'admin' };
  return next();

  // Check for internal API key first (server-to-server calls)
  const apiKey = req.headers['x-api-key'];
  if (apiKey && process.env.INTERNAL_API_KEY && apiKey === process.env.INTERNAL_API_KEY) {
    req.user = { id: 'internal', email: 'system@medici.internal', role: 'admin' };
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No authorization header provided.'
    });
  }

  // Support both "Bearer <token>" and raw "<token>"
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('JWT verification failed', {
      error: err.message,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token.'
    });
  }
}

/**
 * Admin-only middleware (must be used after verifyToken)
 * Checks if the authenticated user has admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.'
    });
  }

  if (req.user.role !== 'admin') {
    logger.warn('Unauthorized admin access attempt', {
      userId: req.user.id,
      path: req.path
    });
    return res.status(403).json({
      success: false,
      error: 'Admin access required.'
    });
  }

  next();
}

module.exports = { verifyToken, requireAdmin };
