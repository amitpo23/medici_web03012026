/**
 * Operational Mode Middleware
 *
 * Gates actions based on current operational mode:
 * - READ_ONLY: Only GET requests and SELECT queries allowed
 * - WRITE_ENABLED: GET + POST/PUT/PATCH allowed (insert/update)
 * - PURCHASE_ENABLED: All operations including booking/purchase actions
 */

const logger = require('../config/logger');

// Valid operational modes
const MODES = {
  READ_ONLY: 'READ_ONLY',
  WRITE_ENABLED: 'WRITE_ENABLED',
  PURCHASE_ENABLED: 'PURCHASE_ENABLED'
};

// Current operational mode (defaults to WRITE_ENABLED)
let currentMode = process.env.OPERATIONAL_MODE || MODES.WRITE_ENABLED;

// Routes that require PURCHASE_ENABLED mode
const PURCHASE_ROUTES = [
  { method: 'POST', path: '/Book/PreBook' },
  { method: 'POST', path: '/Book/Confirm' },
  { method: 'POST', path: '/Book/ManualBook' },
  { method: 'DELETE', path: '/Book/CancelDirect' },
  { method: 'DELETE', path: '/Book/CancelBooking' },
  { method: 'POST', path: '/Search/Search' }
];

// Routes that require at least WRITE_ENABLED mode
const WRITE_ROUTES_PATTERNS = [
  'POST', 'PUT', 'PATCH', 'DELETE'
];

// Routes exempt from mode checking (always allowed)
const EXEMPT_ROUTES = [
  '/health',
  '/sign-in',
  '/health/deep',
  '/health/metrics'
];

/**
 * Get the current operational mode
 */
function getMode() {
  return currentMode;
}

/**
 * Set the operational mode
 * @param {string} mode - One of READ_ONLY, WRITE_ENABLED, PURCHASE_ENABLED
 */
function setMode(mode) {
  if (!MODES[mode]) {
    throw new Error(`Invalid mode: ${mode}. Valid modes: ${Object.keys(MODES).join(', ')}`);
  }
  const previousMode = currentMode;
  currentMode = mode;
  logger.info('Operational mode changed', { from: previousMode, to: mode });
  return currentMode;
}

/**
 * Check if a route requires purchase mode
 */
function isPurchaseRoute(method, path) {
  return PURCHASE_ROUTES.some(r =>
    r.method === method && path.includes(r.path)
  );
}

/**
 * Middleware that enforces operational mode restrictions
 */
function enforceMode(req, res, next) {
  const method = req.method;
  const path = req.originalUrl || req.url;

  // Exempt routes are always allowed
  if (EXEMPT_ROUTES.some(exempt => path.startsWith(exempt))) {
    return next();
  }

  // GET requests are always allowed in any mode
  if (method === 'GET') {
    return next();
  }

  // Check if purchase route
  if (isPurchaseRoute(method, path)) {
    if (currentMode !== MODES.PURCHASE_ENABLED) {
      logger.warn('Purchase operation blocked by operational mode', {
        mode: currentMode,
        method,
        path,
        requiredMode: MODES.PURCHASE_ENABLED
      });
      return res.status(403).json({
        error: 'Operation not permitted',
        message: `Current mode is ${currentMode}. This operation requires ${MODES.PURCHASE_ENABLED} mode.`,
        currentMode,
        requiredMode: MODES.PURCHASE_ENABLED
      });
    }
    return next();
  }

  // Check write operations
  if (WRITE_ROUTES_PATTERNS.includes(method)) {
    if (currentMode === MODES.READ_ONLY) {
      logger.warn('Write operation blocked by operational mode', {
        mode: currentMode,
        method,
        path
      });
      return res.status(403).json({
        error: 'Operation not permitted',
        message: `Current mode is ${currentMode}. Write operations are not allowed.`,
        currentMode,
        requiredMode: MODES.WRITE_ENABLED
      });
    }
    return next();
  }

  next();
}

module.exports = { enforceMode, getMode, setMode, MODES };
