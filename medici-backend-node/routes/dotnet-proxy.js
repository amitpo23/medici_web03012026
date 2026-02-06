/**
 * .NET Backend Proxy Routes
 *
 * Proxies requests to the production Medici .NET backend
 * Base URL: https://medici-backend.azurewebsites.net
 *
 * This allows the dev Node.js backend to call the production .NET API
 * for real operations like InsertOpportunity, PreBook, Book, etc.
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../config/logger');

// .NET API configuration
const DOTNET_API_URL = process.env.MEDICI_DOTNET_API_URL || 'https://medici-backend.azurewebsites.net';
const CLIENT_SECRET = process.env.MEDICI_API_CLIENT_SECRET || '';

// Token cache
let authToken = null;
let tokenExpiry = null;

/**
 * Authenticate with .NET API
 */
async function authenticate() {
  if (authToken && tokenExpiry && new Date() < tokenExpiry) {
    return authToken;
  }

  try {
    const formData = new FormData();
    formData.append('client_secret', CLIENT_SECRET);

    const response = await axios.post(
      `${DOTNET_API_URL}/api/auth/OnlyNightUsersTokenAPI`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000
      }
    );

    authToken = response.data.token || response.data.access_token || response.data;
    tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);

    logger.info('[DotNetProxy] Authentication successful');
    return authToken;
  } catch (error) {
    logger.error('[DotNetProxy] Authentication failed:', { error: error.message });
    throw error;
  }
}

/**
 * Proxy middleware
 */
async function proxyRequest(req, res, endpoint, method = 'POST') {
  try {
    const token = await authenticate();

    const response = await axios({
      method,
      url: `${DOTNET_API_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: req.body,
      params: req.query,
      timeout: 60000
    });

    res.json(response.data);
  } catch (error) {
    logger.error(`[DotNetProxy] Error calling ${endpoint}:`, {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    res.status(error.response?.status || 500).json({
      error: error.message,
      details: error.response?.data
    });
  }
}

// ==================== Room Management ====================

/**
 * GET /rooms/active - Get active rooms (proxies to GetRoomsActive)
 */
router.post('/rooms/active', (req, res) => {
  proxyRequest(req, res, '/api/hotels/GetRoomsActive');
});

/**
 * GET /rooms/sales - Get sold rooms (proxies to GetRoomsSales)
 */
router.post('/rooms/sales', (req, res) => {
  proxyRequest(req, res, '/api/hotels/GetRoomsSales');
});

/**
 * GET /rooms/cancelled - Get cancelled rooms (proxies to GetRoomsCancel)
 */
router.post('/rooms/cancelled', (req, res) => {
  proxyRequest(req, res, '/api/hotels/GetRoomsCancel');
});

/**
 * DELETE /rooms/cancel - Cancel active room
 */
router.delete('/rooms/cancel', (req, res) => {
  proxyRequest(req, res, `/api/hotels/CancelRoomActive?prebookId=${req.query.prebookId}`, 'DELETE');
});

/**
 * POST /rooms/archive - Get archive data
 */
router.post('/rooms/archive', (req, res) => {
  proxyRequest(req, res, '/api/hotels/GetRoomArchiveData');
});

// ==================== Opportunity Management ====================

/**
 * POST /opportunities - Get opportunities
 */
router.post('/opportunities', (req, res) => {
  proxyRequest(req, res, '/api/hotels/GetOpportunities');
});

/**
 * POST /opportunities/insert - Insert new opportunity (REAL ACTION)
 * Body: InsertOpp schema
 */
router.post('/opportunities/insert', (req, res) => {
  logger.info('[DotNetProxy] Inserting opportunity via .NET API', { body: req.body });
  proxyRequest(req, res, '/api/hotels/InsertOpportunity');
});

/**
 * POST /opportunities/by-backoffice - Get by BackOffice ID
 */
router.post('/opportunities/by-backoffice', (req, res) => {
  proxyRequest(req, res, '/api/hotels/GetOpportiunitiesByBackOfficeId');
});

/**
 * POST /opportunities/search - Search opportunities by hotel
 */
router.post('/opportunities/search', (req, res) => {
  proxyRequest(req, res, '/api/hotels/GetOpportiunitiesHotelSearch');
});

// ==================== Booking Operations ====================

/**
 * POST /booking/prebook - Create pre-booking (REAL ACTION)
 */
router.post('/booking/prebook', (req, res) => {
  logger.info('[DotNetProxy] Creating prebook via .NET API');
  proxyRequest(req, res, '/api/hotels/PreBook');
});

/**
 * POST /booking/confirm - Confirm booking (REAL ACTION)
 */
router.post('/booking/confirm', (req, res) => {
  logger.info('[DotNetProxy] Confirming booking via .NET API');
  proxyRequest(req, res, '/api/hotels/Book');
});

/**
 * POST /booking/manual - Manual booking (REAL ACTION)
 */
router.post('/booking/manual', (req, res) => {
  logger.info('[DotNetProxy] Creating manual booking via .NET API', { body: req.body });
  proxyRequest(req, res, '/api/hotels/ManualBook');
});

/**
 * DELETE /booking/cancel - Cancel room with JSON (REAL ACTION)
 */
router.delete('/booking/cancel', (req, res) => {
  logger.info('[DotNetProxy] Cancelling booking via .NET API');
  proxyRequest(req, res, '/api/hotels/CancelRoomDirectJson', 'DELETE');
});

// ==================== Price & Search ====================

/**
 * POST /search/innstant - Search Innstant prices
 */
router.post('/search/innstant', (req, res) => {
  proxyRequest(req, res, '/api/hotels/GetInnstantSearchPrice');
});

/**
 * POST /rooms/update-price - Update push price (REAL ACTION)
 */
router.post('/rooms/update-price', (req, res) => {
  logger.info('[DotNetProxy] Updating push price via .NET API', { body: req.body });
  proxyRequest(req, res, '/api/hotels/UpdateRoomsActivePushPrice');
});

/**
 * POST /dashboard - Get dashboard info
 */
router.post('/dashboard', (req, res) => {
  proxyRequest(req, res, '/api/hotels/GetDashboardInfo');
});

// ==================== Status ====================

/**
 * GET /status - Check proxy status and .NET API connectivity
 */
router.get('/status', async (req, res) => {
  try {
    const token = await authenticate();
    res.json({
      status: 'connected',
      dotnetApiUrl: DOTNET_API_URL,
      authenticated: !!token,
      tokenValid: tokenExpiry ? new Date() < tokenExpiry : false
    });
  } catch (error) {
    res.json({
      status: 'error',
      dotnetApiUrl: DOTNET_API_URL,
      authenticated: false,
      error: error.message
    });
  }
});

module.exports = router;
