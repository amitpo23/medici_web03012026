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

// Public routes (no auth required)
app.use('/sign-in', authLimiter, authRoutes);
app.use('/health', healthRoutes);

// Protected routes (JWT auth required + operational mode enforcement)
app.use('/Opportunity', verifyToken, enforceMode, opportunityRoutes);
app.use('/Book', verifyToken, enforceMode, bookingRoutes);
app.use('/Reservation', verifyToken, enforceMode, reservationRoutes);
app.use('/SalesRoom', verifyToken, enforceMode, salesRoomRoutes);
app.use('/Search', verifyToken, enforceMode, searchRoutes);
app.use('/Errors', verifyToken, errorsRoutes);
app.use('/hotels', verifyToken, hotelsRoutes);
app.use('/Misc', verifyToken, miscRoutes);
app.use('/ZenithApi', verifyToken, enforceMode, zenithRoutes);
app.use('/ai', verifyToken, aiPredictionRoutes);
app.use('/reports', verifyToken, reportsRoutes);
app.use('/dashboard', verifyToken, dashboardRoutes);
app.use('/ai-chat', verifyToken, aiChatRoutes);
app.use('/scraper', verifyToken, heavyLimiter, scraperRoutes);

// Admin-only routes
app.use('/ai/rag', verifyToken, requireAdmin, aiRagRoutes);
app.use('/logs', verifyToken, logsRoutes);
app.use('/alerts', verifyToken, alertsRoutes);

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
      dashboard: '/dashboard',
      aiChat: '/ai-chat (שאל שאלות על הנתונים בשפה טבעית)',
      scraper: '/scraper (בדיקת מחירי מתחרים)',
      logs: '/logs (ניהול וצפייה בלוגים)',
      alerts: '/alerts (מערכת התראות ומעקב)',
      health: '/health (בדיקת תקינות מערכת)'
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
  } catch (err) {
    logger.error('Failed to connect to database at startup', { error: err.message });
    console.error('WARNING: Database connection failed at startup. Server will start but DB operations may fail.');
  }
}
startServer();

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
