const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend.vercel.app', 'https://medici-frontend.vercel.app']
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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

app.use('/sign-in', authRoutes);
app.use('/Opportunity', opportunityRoutes);
app.use('/Book', bookingRoutes);
app.use('/Reservation', reservationRoutes);
app.use('/SalesRoom', salesRoomRoutes);
app.use('/Search', searchRoutes);
app.use('/Errors', errorsRoutes);
app.use('/hotels', hotelsRoutes);
app.use('/Misc', miscRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Medici Hotels Dev API',
    version: '1.0.0',
    environment: process.env.NODE_ENV
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🗄️  Database: ${process.env.DB_DATABASE}`);
});

module.exports = app;
