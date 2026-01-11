# Medici Backend - Node.js Setup Guide

## 🏗️ Backend Structure (Node.js + Express + SQL Server)

This guide will help you create a Node.js backend API that connects to Azure SQL.

---

## 📁 Backend Project Structure

```
medici-backend-node/
├── package.json
├── server.js                  # Main entry point
├── config/
│   └── database.js           # SQL connection config
├── routes/
│   ├── auth.js               # Authentication routes
│   ├── opportunities.js      # Opportunity endpoints
│   ├── bookings.js           # Booking endpoints
│   └── reservations.js       # Reservation endpoints
├── middleware/
│   └── auth.js               # JWT verification
├── controllers/
│   ├── opportunityController.js
│   ├── bookingController.js
│   └── reservationController.js
└── .env                      # Environment variables (local only)
```

---

## 🚀 Quick Start (Step-by-step)

### Step 1: Create Backend Folder

```bash
# In your local machine (not in this workspace)
mkdir medici-backend-node
cd medici-backend-node

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express mssql dotenv cors body-parser jsonwebtoken bcryptjs
npm install --save-dev nodemon
```

### Step 2: Create package.json Scripts

```json
{
  "name": "medici-backend-node",
  "version": "1.0.0",
  "description": "Medici Hotels Backend API",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mssql": "^10.0.1",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### Step 3: Create .env File (Local Development)

```env
# Database Configuration
DB_SERVER=medici-sql-dev.database.windows.net
DB_DATABASE=medici-db-dev
DB_USER=medici_dev_admin
DB_PASSWORD=YourDevPassword
DB_PORT=1433

# JWT Secret
JWT_SECRET=O2R_SECRET_FOR_SIGNING_JWT_TOKENS!!!

# Server Configuration
PORT=8080
NODE_ENV=development

```

### Step 4: Create config/database.js

```javascript
const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool = null;

async function getPool() {
  if (pool) {
    return pool;
  }
  
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to Azure SQL Database');
    return pool;
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    throw err;
  }
}

module.exports = { sql, getPool };
```

### Step 5: Create server.js

```javascript
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./routes/auth');
const opportunityRoutes = require('./routes/opportunities');
const bookingRoutes = require('./routes/bookings');

app.use('/sign-in', authRoutes);
app.use('/Opportunity', opportunityRoutes);
app.use('/Book', bookingRoutes);

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
```

### Step 6: Create routes/auth.js

```javascript
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getPool } = require('../config/database');

// Sign-in endpoint
router.post('/', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('email', email)
      .query('SELECT * FROM Users WHERE Email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.recordset[0];
    
    // Compare password (assuming hashed in DB)
    const validPassword = await bcrypt.compare(password, user.Password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.Id, email: user.Email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      user: {
        id: user.Id,
        name: user.Name,
        email: user.Email
      },
      authorization: `Bearer ${token}`
    });

  } catch (err) {
    console.error('Sign-in error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

### Step 7: Create routes/opportunities.js

```javascript
const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

// Get all opportunities
router.get('/Opportunities', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM MED_Opportunities ORDER BY DateInsert DESC');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching opportunities:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Insert opportunity
router.post('/InsertOpp', async (req, res) => {
  try {
    const {
      hotelId, startDateStr, endDateStr,
      boardlId, categorylId,
      buyPrice, pushPrice, maxRooms
    } = req.body;

    const pool = await getPool();
    
    // Call stored procedure
    const result = await pool.request()
      .input('hotelId', hotelId)
      .input('dateFrom', startDateStr)
      .input('dateTo', endDateStr)
      .input('boardId', boardlId)
      .input('categoryId', categorylId)
      .input('price', buyPrice)
      .input('pushPrice', pushPrice)
      .input('maxRooms', maxRooms)
      .execute('MED_InsertOpportunity');

    res.json({
      success: true,
      opportunityId: result.recordset[0]?.OpportunityId
    });

  } catch (err) {
    console.error('Error inserting opportunity:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get hotels
router.get('/Hotels', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM Med_Hotels WHERE isActive = 1');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching hotels:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get boards
router.get('/Boards', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM MED_Board');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching boards:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get categories
router.get('/Categories', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query('SELECT * FROM MED_RoomCategory');

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
```

### Step 8: Create routes/bookings.js

```javascript
const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');

// Get all bookings
router.get('/Bookings', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query(`
        SELECT 
          b.id, b.PreBookId, b.contentBookingID,
          h.name as HotelName,
          b.startDate, b.endDate,
          b.price, b.pushPrice, b.lastPrice,
          b.IsSold, b.IsCanceled,
          b.dateInsert
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.IsActive = 1
        ORDER BY b.dateInsert DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Cancel booking
router.delete('/CancelBooking', async (req, res) => {
  try {
    const { id } = req.query;

    const pool = await getPool();
    await pool.request()
      .input('bookId', id)
      .execute('MED_InsertCancelBook');

    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    console.error('Error cancelling booking:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
```

---

## 📤 Deploy to Azure

### Option 1: Deploy via VS Code

```bash
1. Install Azure App Service extension in VS Code
2. Right-click on folder → Deploy to Web App
3. Select: medici-backend-dev
4. Confirm deployment
```

### Option 2: Deploy via Azure CLI

```bash
# Login
az login

# Create deployment package
zip -r deploy.zip . -x "node_modules/*" ".env"

# Deploy
az webapp deployment source config-zip \
  --resource-group Medici-RG-Dev \
  --name medici-backend-dev \
  --src deploy.zip
```

### Option 3: GitHub Actions (Recommended)

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy Node.js to Azure

on:
  push:
    branches: [ main, dev ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Deploy to Azure
      uses: azure/webapps-deploy@v2
      with:
        app-name: 'medici-backend-dev'
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
        package: .
```

---

## ⚙️ Configure Environment Variables in Azure

```bash
# Via Azure Portal:
App Service → Configuration → Application settings

Add:
┌────────────────────────────────────────────────┐
│ DB_SERVER = medici-sql-dev.database.windows... │
│ DB_DATABASE = medici-db-dev                    │
│ DB_USER = medici_dev_admin                     │
│ DB_PASSWORD = [your password]                  │
│ DB_PORT = 1433                                 │
│ JWT_SECRET = O2R_SECRET_FOR_SIGNING_JWT...     │
│ NODE_ENV = production                          │
└────────────────────────────────────────────────┘

Save
```

---

## ✅ Testing

```bash
# Test locally first
npm run dev

# Test endpoints
curl http://localhost:8080/
curl http://localhost:8080/Opportunity/Hotels

# After deploying:
curl https://medici-backend-dev.azurewebsites.net/
```

---

## 🎯 Next Steps

1. ✅ Create backend folder locally
2. ✅ Install dependencies
3. ✅ Create all files above
4. ✅ Test locally
5. ✅ Deploy to Azure
6. ✅ Configure environment variables
7. ✅ Test frontend connection

---

**Backend ready for development!** 🚀
