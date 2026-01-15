const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

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
app.use('/dashboard', dashboardRoutes);
app.use('/ai-chat', aiChatRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Medici Hotels API',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
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
      aiChat: '/ai-chat (שאל שאלות על הנתונים בשפה טבעית)'
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
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DB_DATABASE || 'not configured'}`);
  console.log(`🌐 Endpoints:`);
  console.log(`   - Auth: /sign-in`);
  console.log(`   - Opportunities: /Opportunity`);
  console.log(`   - Bookings: /Book`);
  console.log(`   - Reservations: /Reservation`);
  console.log(`   - Sales Room: /SalesRoom`);
  console.log(`   - Search: /Search`);
  console.log(`   - Errors: /Errors`);
  console.log(`   - Hotels: /hotels`);
  console.log(`   - Zenith API: /ZenithApi`);
});

module.exports = app;
