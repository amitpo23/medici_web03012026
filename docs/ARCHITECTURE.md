# Medici Hotels - System Architecture

## 📋 Overview

Medici Hotels is a booking engine system that manages hotel room inventory, pricing, and reservations.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Angular 16)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Dashboard│  │  Options │  │  Rooms   │  │  Sales   │  │ Analytics│      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │Reservation│ │  Hotels  │  │ Search   │  │   Auth   │                    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                    │
│                           AG Grid Enterprise                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Node.js + Express)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Routes:                                                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ /sign-in   │ │/Opportunity│ │   /Book    │ │/Reservation│               │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘               │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐               │
│  │ /SalesRoom │ │  /Search   │ │  /Errors   │ │  /hotels   │               │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘               │
│  ┌────────────┐ ┌────────────┐                                              │
│  │ /ZenithApi │ │   /Misc    │  ⚠️ ZenithApi - NOT YET IMPLEMENTED         │
│  └────────────┘ └────────────┘                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (SQL Server)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Tables:                                                                    │
│  • MedOPportunity    • MedBook         • MedPreBook      • MedReservation  │
│  • Med_Hotels        • MED_Board       • MED_RoomCategory                  │
│  • MED_SalesRoom     • MED_BookError   • MED_CancelBookError               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Background Services (Original .NET)

> ⚠️ **NOT YET IMPLEMENTED IN NODE.JS REPLICA**

| Service | Description | Interval |
|---------|-------------|----------|
| **MediciBuyRooms** | Automatically buys rooms from opportunities | Every 2 seconds |
| **MediciAutoCancellation** | Auto-cancels unsold rooms | Scheduled |
| **MediciUpdatePrices** | Updates prices to Zenith | Continuous |

---

## 🌐 External APIs

| API | Purpose | Status |
|-----|---------|--------|
| **Innstant API** | Hotel search, PreBook, Book | ⚠️ Not implemented |
| **GoGlobal API** | Alternative hotel supplier | ⚠️ Not implemented |
| **Zenith OTA** | Push rates/availability, receive reservations | ⚠️ Not implemented |
| **Slack** | Notifications | ⚠️ Not implemented |

---

## 📊 Database Schema

### Core Tables

```
┌─────────────────────┐       ┌─────────────────────┐
│   MedOPportunity    │       │      MedBook        │
├─────────────────────┤       ├─────────────────────┤
│ OpportunityId (PK)  │──────▶│ BookId (PK)         │
│ DestinationsId (FK) │       │ OpportunityId (FK)  │
│ DateFrom            │       │ PreBookId (FK)      │
│ DateTo              │       │ ContentBookingId    │
│ BoardId (FK)        │       │ DateFrom            │
│ CategoryId (FK)     │       │ DateTo              │
│ BuyPrice            │       │ Price               │
│ PushPrice           │       │ PushPrice           │
│ MaxRooms            │       │ IsCanceled          │
│ RoomsBought         │       │ IsSold              │
│ Status              │       │ DateInsert          │
│ DateInsert          │       └─────────────────────┘
└─────────────────────┘                │
                                       ▼
                       ┌─────────────────────┐
                       │   MedReservation    │
                       ├─────────────────────┤
                       │ UniqueId (PK)       │
                       │ BookId (FK)         │
                       │ CustomerName        │
                       │ ConfirmationId      │
                       │ CheckIn             │
                       │ CheckOut            │
                       │ TotalPrice          │
                       │ IsCanceled          │
                       └─────────────────────┘
```

### Reference Tables

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│     Med_Hotels      │  │      MED_Board      │  │  MED_RoomCategory   │
├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤
│ HotelId (PK)        │  │ BoardId (PK)        │  │ CategoryId (PK)     │
│ Name                │  │ BoardCode           │  │ Name                │
│ InnstantId          │  │ Name                │  └─────────────────────┘
│ ZenithId            │  │ (RO, BB, HB, FB, AI)│
│ City                │  └─────────────────────┘
│ Country             │
│ Stars               │
└─────────────────────┘
```

---

## 🔀 Data Flow

### 1. Room Purchase Flow

```
User creates Opportunity
         │
         ▼
┌─────────────────────┐
│ POST /InsertOpp     │──▶ Database: MedOPportunity
└─────────────────────┘
         │
         ▼ (Background Service - every 2 sec)
┌─────────────────────┐
│ MediciBuyRooms      │
│  1. Get opportunity │
│  2. Search Innstant │
│  3. PreBook         │
│  4. Book            │
│  5. Insert MedBook  │
│  6. Push to Zenith  │
└─────────────────────┘
```

### 2. Reservation Flow (from Zenith)

```
┌─────────────────────┐
│ Zenith sends        │
│ OTA_HotelResNotifRQ │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ POST /ZenithApi/    │
│ OTA_HotelResNotifRQ │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ 1. Parse XML        │
│ 2. Insert Reservat. │
│ 3. Link to MedBook  │
│ 4. Send Slack notif │
│ 5. Return XML resp  │
└─────────────────────┘
```

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/sign-in` | User authentication | ✅ |

### Opportunities
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/Opportunity/Opportunities` | Get all opportunities | ✅ |
| POST | `/Opportunity/InsertOpp` | Create new opportunity | ✅ |
| GET | `/Opportunity/CancelOpp` | Cancel opportunity | ⚠️ Partial |
| GET | `/Opportunity/Hotels` | List hotels | ✅ |
| GET | `/Opportunity/Boards` | List board types | ✅ |
| GET | `/Opportunity/Categories` | List room categories | ✅ |

### Bookings
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/Book/Bookings` | Get all bookings | ✅ |
| GET | `/Book/Canceled` | Get canceled bookings | ✅ |
| DELETE | `/Book/SetCancelStatus` | Set cancel status | ✅ |
| DELETE | `/Book/CancelBooking` | Cancel booking | ✅ |
| POST | `/Book/UpdatePrice` | Update push price | ✅ |

### Reservations
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/Reservation/ReservationCancel` | Get reservation cancellations | ✅ |
| GET | `/Reservation/GetDetails` | Get reservation details | ✅ |
| GET | `/Reservation/ReservationModify` | Get modifications | ✅ |
| GET | `/Reservation/Log` | Get reservation log | ✅ |

### Sales Room
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/SalesRoom/Sales` | Get sales data | ✅ |
| GET | `/SalesRoom/GetDetails` | Get sale details | ✅ |
| POST | `/SalesRoom/UpdateNameSuccess` | Update customer name | ✅ |
| GET | `/SalesRoom/Reservations` | Get sold reservations | ✅ |

### Search
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/Search/Search` | Search hotel prices | ✅ |

### Errors
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| GET | `/Errors/BookErrors` | Get booking errors | ✅ |
| GET | `/Errors/CancelBookErrors` | Get cancellation errors | ✅ |

### Zenith API (OTA Integration)
| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/ZenithApi/OTA_HotelResNotifRQ` | Receive reservation (XML) | ❌ Missing |
| POST | `/ZenithApi/OTA_CancelRQ` | Receive cancellation (XML) | ❌ Missing |

---

## 🔧 Configuration

### Backend Environment Variables

```env
# Database
DB_SERVER=medici-sql-dev.database.windows.net
DB_DATABASE=medici-db-dev
DB_USER=medici_dev_admin
DB_PASSWORD=********
DB_PORT=1433

# JWT
JWT_SECRET=********

# Server
PORT=8080
NODE_ENV=development

# External APIs (Not yet implemented)
INNSTANT_API_KEY=********
INNSTANT_API_URL=https://api.innstant.travel
GOGLOBAL_API_KEY=********
ZENITH_API_URL=https://api.zenith.travel
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

### Frontend Environment

```typescript
// environment.ts
export const environment = {
  production: false,
  baseUrl: 'https://medici-backend-dev.azurewebsites.net/'
};
```

---

## ⚠️ Missing Components (To Be Implemented)

### Priority 1 - Critical
1. **ZenithApi Routes** - Receive reservations/cancellations from Zenith OTA
2. **Slack Integration** - Notifications for new reservations

### Priority 2 - Background Services
3. **MediciBuyRooms** - Auto-buy rooms from opportunities
4. **MediciAutoCancellation** - Auto-cancel unsold rooms
5. **MediciUpdatePrices** - Sync prices to Zenith

### Priority 3 - External APIs
6. **Innstant API Client** - Hotel search and booking
7. **GoGlobal API Client** - Alternative supplier
8. **Zenith Push Client** - Push rates and availability

### Priority 4 - Real-time
9. **WebSocket/SSE** - Replace SignalR for real-time updates

---

## 📁 Project Structure

```
medici_web03012026/
├── src/                          # Angular Frontend
│   ├── app/
│   │   ├── core/
│   │   │   ├── auth/            # Authentication
│   │   │   └── models/          # Data models
│   │   ├── modules/
│   │   │   ├── analytics/       # Analytics & predictions
│   │   │   ├── dashboard/       # Dashboard & stats
│   │   │   ├── hotels/          # Hotel management
│   │   │   ├── options/         # Opportunities management
│   │   │   ├── reservation/     # Reservations
│   │   │   ├── rooms/           # Room management
│   │   │   ├── sales-room/      # Sales room
│   │   │   ├── search-price/    # Price search
│   │   │   └── shared/          # Shared components
│   │   └── services/            # Global services
│   └── environments/            # Environment configs
│
├── medici-backend-node/          # Node.js Backend
│   ├── config/
│   │   └── database.js          # SQL Server connection
│   ├── routes/
│   │   ├── auth.js              # Authentication
│   │   ├── bookings.js          # Bookings CRUD
│   │   ├── errors.js            # Error logs
│   │   ├── hotels.js            # Hotels CRUD
│   │   ├── misc.js              # Miscellaneous
│   │   ├── opportunities.js     # Opportunities CRUD
│   │   ├── reservations.js      # Reservations
│   │   ├── salesroom.js         # Sales room
│   │   └── search.js            # Search functionality
│   └── server.js                # Express server
│
└── docs/                         # Documentation
    └── ARCHITECTURE.md          # This file
```

---

## 🚀 Deployment

### Frontend (Vercel)
- **Production**: https://admin.medicihotels.com
- **Build Command**: `npm run vercel-build`
- **Output**: `dist/only-night-app/`

### Backend (Azure App Service)
- **Production**: https://medici-backend.azurewebsites.net
- **Development**: https://medici-backend-dev.azurewebsites.net

### Database (Azure SQL)
- **Production**: medici-sql-server.database.windows.net
- **Development**: medici-sql-dev.database.windows.net

---

*Last Updated: January 13, 2026*
