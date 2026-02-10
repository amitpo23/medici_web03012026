const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./config/logger');
const { requestLogger, errorLogger } = require('./middleware/request-logger');
const { apiLimiter } = require('./middleware/rate-limiter');
const alertsAgent = require('./services/alerts-agent');
const healthMonitor = require('./services/health-monitor');
const { setupSwagger } = require('./config/swagger');

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow for Swagger UI
  crossOriginEmbedderPolicy: false
}));

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://admin.medicihotels.com', 'https://medici-web.vercel.app', 'https://medici-frontend.vercel.app']
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
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
const analyticsRoutes = require('./routes/analytics');
const cancellationsRoutes = require('./routes/cancellations');
const pricingRoutes = require('./routes/pricing');
const pricingAnalyticsRoutes = require('./routes/pricing-analytics');
const revenueAnalyticsRoutes = require('./routes/revenue-analytics');
const searchIntelligenceRoutes = require('./routes/search-intelligence');
const tradingRoutes = require('./routes/trading');
const tradingExchangeRoutes = require('./routes/trading-exchange');
const aiCommandRoutes = require('./routes/ai-command');
const aiOpportunitiesRoutes = require('./routes/ai-opportunities');
const realtimeDashboardRoutes = require('./routes/realtime-dashboard');
const workflowsRoutes = require('./routes/workflows');
const advancedPricingRoutes = require('./routes/advanced-pricing');
const monitoringRoutes = require('./routes/monitoring');
const diagnosticsRoutes = require('./routes/diagnostics');
const activityFeedRoutes = require('./routes/activity-feed');
const dataExplorerRoutes = require('./routes/data-explorer');
const dataSyncRoutes = require('./routes/data-sync');
const dotnetProxyRoutes = require('./routes/dotnet-proxy');
const documentsRoutes = require('./routes/documents');
const mlPredictionsRoutes = require('./routes/ml-predictions');
const opportunityFinderRoutes = require('./routes/opportunity-finder');
const alertManagementRoutes = require('./routes/alert-management');

app.use('/sign-in', authRoutes);
app.use('/Opportunity', opportunityRoutes);
app.use('/Book', bookingRoutes);
app.use('/Reservation', reservationRoutes);
app.use('/SalesRoom', salesRoomRoutes);
app.use('/Search', searchRoutes);
app.use('/Errors', errorsRoutes);
app.use('/hotels', hotelsRoutes);
app.use('/Misc', miscRoutes);
app.use('/ZenithApi', zenithRoutes);
app.use('/ai', aiPredictionRoutes);
app.use('/reports', reportsRoutes);
app.use('/Dashboard', dashboardRoutes);
app.use('/ai-chat', aiChatRoutes);
app.use('/ai/rag', aiRagRoutes);
app.use('/scraper', scraperRoutes);
app.use('/logs', logsRoutes);
app.use('/alerts', alertsRoutes);
app.use('/health', healthRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/cancellations', cancellationsRoutes);
app.use('/pricing', pricingRoutes);
app.use('/pricing-analytics', pricingAnalyticsRoutes);
app.use('/revenue-analytics', revenueAnalyticsRoutes);
app.use('/search-intelligence', searchIntelligenceRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/trading-exchange', tradingExchangeRoutes);
app.use('/ai-command', aiCommandRoutes);
app.use('/ai-opportunities', aiOpportunitiesRoutes);
app.use('/realtime-dashboard', realtimeDashboardRoutes);
app.use('/workflows', workflowsRoutes);
app.use('/advanced-pricing', advancedPricingRoutes);
app.use('/monitoring', monitoringRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);
app.use('/activity-feed', activityFeedRoutes);
app.use('/data-explorer', dataExplorerRoutes);
app.use('/data-sync', dataSyncRoutes);
app.use('/dotnet-proxy', dotnetProxyRoutes);
app.use('/Documents', documentsRoutes);
app.use('/ml', mlPredictionsRoutes);
app.use('/opportunity-finder', opportunityFinderRoutes);
app.use('/alert-management', alertManagementRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Medici Hotels API',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    documentation: '/api-docs',
    health: '/health',
    endpoints: {
      auth: '/sign-in',
      opportunity: '/Opportunity',
      book: '/Book',
      reservation: '/Reservation',
      salesRoom: '/SalesRoom',
      search: '/Search',
      errors: '/Errors',
      hotels: '/hotels',
      misc: '/Misc',
      zenith: '/ZenithApi',
      aiPrediction: '/ai',
      reports: '/reports',
      dashboard: '/Dashboard',
      aiChat: '/ai-chat',
      scraper: '/scraper',
      logs: '/logs',
      alerts: '/alerts',
      health: '/health',
      analytics: '/analytics',
      cancellations: '/cancellations',
      pricing: '/pricing',
      revenueAnalytics: '/revenue-analytics',
      searchIntelligence: '/search-intelligence',
      trading: '/api/trading',
      tradingExchange: '/api/trading-exchange',
      monitoring: '/monitoring',
      diagnostics: '/api/diagnostics',
      dataExplorer: '/data-explorer',
      documents: '/Documents',
      mlPredictions: '/ml',
      alertManagement: '/alert-management'
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

// Start server
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

module.exports = app;
