const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./config/logger');
const requestId = require('./middleware/request-id');
const { requestLogger, errorLogger } = require('./middleware/request-logger');
const { apiLimiter, authLimiter, heavyLimiter } = require('./middleware/rate-limiter');
const { verifyToken, requireAdmin } = require('./middleware/auth');
const { enforceMode, getMode, setMode, MODES } = require('./middleware/operational-mode');
const alertsAgent = require('./services/alerts-agent');
const healthMonitor = require('./services/health-monitor');
const { setupSwagger } = require('./config/swagger');

const app = express();
const PORT = process.env.PORT || 8080; // Azure deployment fix

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow for Swagger UI
  crossOriginEmbedderPolicy: false
}));

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://admin.medicihotels.com',
        'https://medici-web03012026.vercel.app',
        'https://medici-web.vercel.app',
        'https://medici-frontend.vercel.app'
      ]
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(requestId);
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text({ type: 'application/xml', limit: '10mb' }));
app.use(bodyParser.text({ type: 'text/xml', limit: '10mb' }));

// HTTP Request Logging with metrics
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const isError = res.statusCode >= 400;
    healthMonitor.trackRequest(responseTime, isError);
  });
  next();
});
app.use(requestLogger);

// API Rate Limiting
app.use('/api', apiLimiter);

// Swagger API Documentation
setupSwagger(app);

// Validate required environment variables at startup
const requiredEnvVars = ['DB_SERVER', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  logger.error('Missing required environment variables', { missing: missingVars });
  console.error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Routes
const authRoutes = require('./routes/auth');
const opportunityRoutes = require('./routes/opportunities');
const bookingRoutes = require('./routes/bookings');
const reservationRoutes = require('./routes/reservations');
const salesRoomRoutes = require('./routes/salesroom');
const searchRoutes = require('./routes/search');
const errorsRoutes = require('./routes/errors');
const hotelsRoutes = require('./routes/hotels');
const miscRoutes = require('./routes/misc');
const zenithRoutes = require('./routes/zenith');
const aiPredictionRoutes = require('./routes/ai-prediction');
const reportsRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');
const aiChatRoutes = require('./routes/ai-chat');
const scraperRoutes = require('./routes/scraper');
const logsRoutes = require('./routes/logs');
const alertsRoutes = require('./routes/alerts');
const healthRoutes = require('./routes/health');
const aiRagRoutes = require('./routes/ai-rag');
const searchIntelligenceRoutes = require('./routes/search-intelligence');
const cancellationsRoutes = require('./routes/cancellations');
const monitoringRoutes = require('./routes/monitoring');
const alertManagementRoutes = require('./routes/alert-management');
const revenueAnalyticsRoutes = require('./routes/revenue-analytics');

// NEW ROUTES - Enhanced Features (Added Feb 2026)
const diagnosticsRoutes = require('./routes/diagnostics');
const tradingRoutes = require('./routes/trading');
const analyticsRoutes = require('./routes/analytics');
const aiOpportunitiesRoutes = require('./routes/ai-opportunities');
const pricingRoutes = require('./routes/pricing');
const pricingAnalyticsRoutes = require('./routes/pricing-analytics');

// WEEK 4 ROUTES - Unified AI Command Center (Added Feb 2026)
const aiCommandRoutes = require('./routes/ai-command');
const realtimeDashboardRoutes = require('./routes/realtime-dashboard');
const workflowsRoutes = require('./routes/workflows');

// WEEK 5 ROUTES - Smart Pricing v2 with ML (Added Feb 2026)
const advancedPricingRoutes = require('./routes/advanced-pricing');

// Public routes (no auth required)
app.use('/sign-in', authLimiter, authRoutes);
app.use('/health', healthRoutes);
app.use('/Search', searchRoutes);
app.use('/hotels', hotelsRoutes);

// Protected routes (require authentication)
app.use('/Dashboard', verifyToken, dashboardRoutes);
app.use('/Opportunity', verifyToken, opportunityRoutes);
app.use('/Book', verifyToken, bookingRoutes);
app.use('/Reservation', verifyToken, reservationRoutes);
app.use('/SalesRoom', verifyToken, salesRoomRoutes);
app.use('/Errors', verifyToken, errorsRoutes);
app.use('/Misc', verifyToken, miscRoutes);
app.use('/ZenithApi', verifyToken, zenithRoutes);
app.use('/ai', verifyToken, aiPredictionRoutes);
app.use('/reports', verifyToken, reportsRoutes);
app.use('/ai-chat', verifyToken, aiChatRoutes);
app.use('/scraper', verifyToken, scraperRoutes);
app.use('/alerts', verifyToken, alertsRoutes);
app.use('/search-intelligence', verifyToken, searchIntelligenceRoutes);
app.use('/cancellations', verifyToken, cancellationsRoutes);
app.use('/alert-management', verifyToken, alertManagementRoutes);
app.use('/revenue-analytics', verifyToken, revenueAnalyticsRoutes);

// Admin-only routes
app.use('/logs', verifyToken, requireAdmin, logsRoutes);
app.use('/monitoring', verifyToken, requireAdmin, monitoringRoutes);

// Protected Enhanced Routes - Diagnostics & Trading (Added Feb 2026)
app.use('/api/diagnostics', verifyToken, requireAdmin, diagnosticsRoutes);
app.use('/api/trading', verifyToken, tradingRoutes);
app.use('/analytics', verifyToken, analyticsRoutes);
app.use('/ai-opportunities', verifyToken, aiOpportunitiesRoutes);
app.use('/pricing', verifyToken, pricingRoutes);
app.use('/pricing', verifyToken, pricingAnalyticsRoutes);

// Protected WEEK 4 Routes - Unified AI Command Center (Added Feb 2026)
app.use('/ai-command', verifyToken, aiCommandRoutes);
app.use('/realtime', verifyToken, realtimeDashboardRoutes);
app.use('/workflows', verifyToken, workflowsRoutes);

// Protected WEEK 5 Routes - Smart Pricing v2 with ML (Added Feb 2026)
app.use('/pricing', verifyToken, advancedPricingRoutes);

// Admin-only routes (keeping RAG protected for now)
app.use('/ai/rag', verifyToken, requireAdmin, aiRagRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Medici Hotels API',
    version: '2.0.0',
    environment: process.env.NODE_ENV,
    documentation: '/api-docs',
    health: '/health',
    endpoints: {
      auth: '/sign-in',
      opportunity: '/Opportunity (GET /Opportunities, POST /InsertOpp with auto-pricing)',
      book: '/Book (GET /Bookings, POST /PreBook, POST /Confirm, POST /ManualBook, DELETE /CancelDirect)',
      reservation: '/Reservation',
      salesRoom: '/SalesRoom',
      search: '/Search (POST /InnstantPrice with smart defaults, POST /Search legacy)',
      errors: '/Errors',
      hotels: '/hotels',
      misc: '/Misc',
      zenith: '/ZenithApi',
      aiPrediction: '/ai',
      reports: '/reports',
      dashboard: '/dashboard',
      aiChat: '/ai-chat (שאל שאלות על הנתונים בשפה טבעית)',
      scraper: '/scraper (בדיקת מחירי מתחרים)',
      logs: '/logs (ניהול וצפייה בלוגים)',
      alerts: '/alerts (מערכת התראות ומעקב)',
      health: '/health (בדיקת תקינות מערכת)',
      searchIntelligence: '/search-intelligence (ניתוח מגמות חיפוש ו-8.3M search records)',
      cancellations: '/cancellations (ניתוח מקיף של כל הביטולים במערכת)'
    },
    newFeatures: {
      searchInnstant: 'POST /Search/InnstantPrice - GPT-style search with smart defaults',
      preBook: 'POST /Book/PreBook - Hold room with supplier',
      confirmBooking: 'POST /Book/Confirm - Confirm pre-booked room',
      manualBook: 'POST /Book/ManualBook - Manual booking entry',
      cancelDirect: 'DELETE /Book/CancelDirect - Cancel with optional supplier cancellation',
      autoPricing: 'POST /Opportunity/InsertOpp - Automatic pricing: BuyPrice=source+$10, PushPrice=source+$50'
    }
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Medici Hotels API',
    version: '1.0.0',
    documentation: '/docs',
    health: '/ZenithApi/health'
  });
});

// Error handling middleware
app.use(errorLogger);
app.use((err, req, res, next) => {
  logger.error('Server error', {
    error: err.message,
    stack: err.stack,
    url: req.url
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Verify database connection before starting
const { getPool } = require('./config/database');

async function startServer() {
  try {
    await getPool();
    logger.info('Database connection verified');
    
    // Start server only after DB check
    app.listen(PORT, () => {
      logger.info('🚀 Medici Hotels Server Started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        database: process.env.DB_DATABASE || 'not configured',
        nodeVersion: process.version
      });
      
      // Start Alerts Agent
      logger.info('Starting Alerts Agent...');
      alertsAgent.start(5); // Scan every 5 minutes
      
      console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
      console.log(`║  🚀 MEDICI HOTELS API - RUNNING                          ║`);
      console.log(`╚═══════════════════════════════════════════════════════════╝\n`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🚀 Server: http://localhost:${PORT}`);
      console.log(`🗄️  Database: ${process.env.DB_DATABASE || 'not configured'}`);
      console.log(`📝 Logs: ./logs/`);
      console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      console.log(`💚 Health: http://localhost:${PORT}/health`);
      console.log(`📊 Metrics: http://localhost:${PORT}/health/metrics\n`);
      console.log(`🌐 Main Endpoints:`);
      console.log(`   • Auth: /sign-in`);
      console.log(`   • Opportunities: /Opportunity`);
      console.log(`   • Bookings: /Book`);
      console.log(`   • Reservations: /Reservation`);
      console.log(`   • AI Chat: /ai-chat`);
      console.log(`   • AI Predictions: /ai`);
      console.log(`   • Scraper: /scraper`);
      console.log(`   • Logs: /logs`);
      console.log(`   • Alerts: /alerts\n`);
    });
  } catch (err) {
    logger.error('Failed to connect to database at startup', { error: err.message });
    console.error('\n❌ FATAL ERROR: Database connection failed at startup.');
    console.error(`Error: ${err.message}\n`);
    process.exit(1);
  }
}

startServer();

module.exports = app;
