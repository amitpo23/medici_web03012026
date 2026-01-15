# Medici Hotels Backend - Node.js API

## Overview

This is the Node.js backend API for the Medici Hotels booking engine. It replaces the original .NET Core 7 backend while maintaining API compatibility.

## Features

- **Authentication** - JWT-based authentication
- **Hotels Management** - CRUD operations for hotels
- **Room Management** - Room categories and availability
- **Reservations** - Booking management with Zenith integration
- **Search** - Room search and pricing
- **Analytics** - Dashboard data and reporting
- **External Integrations**:
  - **Innstant API** - Room supplier for purchasing
  - **Zenith API** - Distribution channel (OTA)
  - **Slack** - Real-time notifications
  - **SendGrid** - Email notifications

## Project Structure

```
medici-backend-node/
├── server.js           # Main Express server
├── package.json        # Dependencies
├── .env.example        # Environment variables template
├── config/
│   └── database.js     # Database configuration
├── routes/
│   ├── auth.js         # Authentication routes
│   ├── hotels.js       # Hotel management
│   ├── bookings.js     # Booking operations
│   ├── reservations.js # Reservation management
│   ├── search.js       # Room search
│   ├── salesroom.js    # Sales room operations
│   ├── opportunities.js # Opportunities
│   ├── zenith.js       # Zenith OTA endpoints
│   └── errors.js       # Error logging
├── services/
│   ├── innstant-client.js    # Innstant API client
│   ├── zenith-push-service.js # Zenith SOAP push
│   ├── slack-service.js      # Slack notifications
│   └── email-service.js      # SendGrid emails
└── workers/
    ├── buyroom-worker.js           # Auto room purchase
    ├── auto-cancellation-worker.js # Auto cancel unsold
    └── price-update-worker.js      # Sync prices to Zenith
```

## Setup

### 1. Install Dependencies

```bash
cd medici-backend-node
npm install
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with your values
notepad .env
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Run Production Server

```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Hotels
- `GET /api/hotels` - List all hotels
- `GET /api/hotels/:id` - Get hotel details
- `POST /api/hotels` - Create hotel
- `PUT /api/hotels/:id` - Update hotel
- `DELETE /api/hotels/:id` - Delete hotel

### Reservations
- `GET /api/reservations` - List reservations
- `GET /api/reservations/:id` - Get reservation
- `POST /api/reservations` - Create reservation
- `PUT /api/reservations/:id` - Update reservation
- `DELETE /api/reservations/:id` - Cancel reservation

### Search
- `POST /api/search` - Search available rooms
- `POST /api/search/prebook` - Pre-book a room
- `POST /api/search/book` - Complete booking

### Zenith Integration
- `POST /ZenithApi/OTA_HotelResNotifRQ` - Receive reservations from Zenith
- `POST /ZenithApi/OTA_CancelRQ` - Receive cancellations from Zenith

### Health Check
- `GET /health` - Server health status
- `GET /api` - API information

## Background Workers

### BuyRoom Worker
Automatically purchases rooms from Innstant when reservations are confirmed.

```bash
# Run once
node workers/buyroom-worker.js --once

# Run on schedule (every 5 minutes)
npm run worker:buyroom
```

### Auto-Cancellation Worker
Cancels unsold rooms before the deadline.

```bash
# Run once
node workers/auto-cancellation-worker.js --once

# Run on schedule (every hour)
npm run worker:cancellation
```

### Price Update Worker
Syncs rates and availability to Zenith.

```bash
# Run once
node workers/price-update-worker.js --once

# Run on schedule (every 30 minutes)
npm run worker:priceupdate
```

## Database

The backend connects to Azure SQL Server:
- Server: `medici-sql-server.database.windows.net`
- Database: `medici-db`
- Tables: 64 tables
- Stored Procedures: 85 procedures

See `docs/DATABASE_SCHEMA.md` for full schema documentation.

## External APIs

### Innstant API
Room supplier for searching and booking rooms.
- Search URL: `https://connect.mishor5.innstant-servers.com`
- Booking URL: `https://book.mishor5.innstant-servers.com`

### Zenith API
Distribution channel for receiving reservations.
- Service URL: `https://hotel.tools/service/Medici%20new`
- Uses SOAP/XML OTA standard

## Deployment

### Azure App Service
```bash
# Deploy to Azure
./deploy-azure.sh
```

### Vercel
```bash
# Deploy to Vercel
./deploy-vercel.sh
```

## Troubleshooting

### Database Connection Issues
1. Check firewall rules on Azure SQL
2. Verify credentials in `.env`
3. Ensure your IP is whitelisted

### Zenith Integration Issues
1. Check XML format matches OTA standard
2. Verify credentials in `.env`
3. Check Zenith service status

### Worker Not Running
1. Check environment variables are set
2. Verify database connection
3. Check logs for errors

## License

ISC
