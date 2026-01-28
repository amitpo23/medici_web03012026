# OnlyNightApp - Medici Hotels Development

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 16.1.4.

## 🚀 Development Environments

### Production Environment
- **Frontend**: https://admin.medicihotels.com (Vercel)
- **Backend**: https://medici-backend.azurewebsites.net (Azure App Service)
- **Database**: medici-sql-server.database.windows.net (Azure SQL)

### Development Environment (This Repo)
- **Frontend**: localhost:4200 or Vercel Dev
- **Backend**: https://medici-backend-dev.azurewebsites.net (Azure App Service - Dev)
- **Database**: medici-sql-dev.database.windows.net (Azure SQL - Dev)

---

## 🛠️ Setup Instructions

### Prerequisites
```bash
# Install Node.js 18+ and npm
node --version  # Should be 18.x or higher
npm --version

# Install Angular CLI
npm install -g @angular/cli@16
```

### Installation
```bash
# Clone the repository
git clone https://github.com/amitpo23/medici_web03012026.git
cd medici_web03012026

# Install dependencies
npm install
```

---

## 🏃 Running the Application

### Development Mode (connects to Azure Dev)
```bash
npm run dev
# Opens at http://localhost:4200
# Connects to: medici-backend-dev.azurewebsites.net
```

### Standard Development Server
```bash
npm start
# Opens at http://localhost:4200
```

### Build for Development
```bash
npm run build:dev
# Output: dist/only-night-app/
```

### Build for Production
```bash
npm run prod
# Output: dist/only-night-app/
# Optimized and minified
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── core/
│   │   ├── auth/              # Authentication module
│   │   └── models/            # Data models
│   ├── modules/
│   │   ├── options/           # Opportunities management
│   │   ├── rooms/             # Bookings management
│   │   ├── reservation/       # Reservations
│   │   ├── sales-room/        # Sales tracking
│   │   ├── search-price/      # Price search
│   │   └── hotels/            # Hotel management
│   ├── services/              # Shared services
│   └── environments/          # Environment configs
│       ├── environment.ts     # Default (development)
│       ├── environment.dev.ts # Azure Dev
│       └── environment.prod.ts # Production
```

---

## 🔧 Configuration Files

### Environment Files
- `environment.ts` - Default development settings
- `environment.dev.ts` - Azure Dev environment
- `environment.prod.ts` - Production environment

### Proxy Configuration
- `proxy.conf.json` - Default proxy (local backend)
- `proxy.conf.dev.json` - Azure Dev backend proxy

---

## 🧪 Testing

### Unit Tests
```bash
npm test
# Runs tests via Karma
```

### End-to-End Tests
```bash
npm run e2e
# Requires e2e testing package installation
```

---

## 📦 Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Standard dev server |
| `npm run dev` | Dev server with Azure Dev backend |
| `npm run build` | Build project |
| `npm run build:dev` | Build for development |
| `npm run prod` | Build optimized for production |
| `npm run watch` | Build and watch for changes |
| `npm test` | Run unit tests |

---

## 🌐 Azure Development Environment Setup

### Step 1: Create Azure Resources
```bash
# Resource Group
az group create --name Medici-RG-Dev --location eastus2

# SQL Server
az sql server create \
  --name medici-sql-dev \
  --resource-group Medici-RG-Dev \
  --admin-user medici_dev_admin \
  --admin-password [YourPassword]

# SQL Database
az sql db create \
  --name medici-db-dev \
  --server medici-sql-dev \
  --resource-group Medici-RG-Dev \
  --service-objective Basic

# App Service (Free Tier)
az appservice plan create \
  --name MediciDevPlan \
  --resource-group Medici-RG-Dev \
  --sku F1

az webapp create \
  --name medici-backend-dev \
  --resource-group Medici-RG-Dev \
  --plan MediciDevPlan \
  --runtime "DOTNET:7.0"
```

### Step 2: Update Frontend Configuration
After creating Azure resources, update:
- `src/app/environments/environment.dev.ts` - Set correct backend URL
- `proxy.conf.dev.json` - Update target URL

### Step 3: Deploy Backend
1. Clone backend repo: `amitpo23/medici-hotels03012026`
2. Update connection strings in Azure App Service
3. Deploy via Visual Studio or GitHub Actions

---

## 🔐 Authentication

The application uses JWT token-based authentication:
- Tokens stored in localStorage (`auth`, `accessToken`)
- Auto-logout on 401/400 responses
- Sign-in endpoint: `POST /sign-in`

---

## 🎨 UI Framework

- **Angular Material 16.2.11** - Material Design components
- **AG-Grid Enterprise 30.2.1** - Advanced data tables
- **Tailwind CSS 3.3.5** - Utility-first CSS

---

## 📊 Key Features

1. **Opportunity Management** - Create and track room purchase opportunities
2. **Booking Management** - Manage active and canceled bookings
3. **Reservation Handling** - Process incoming reservations from Zenith
4. **Sales Tracking** - Monitor sales and revenue
5. **Price Search** - Search and compare hotel prices
6. **Real-time Updates** - Version polling every 60 seconds

---

## 🚨 Important Notes

### Production Safety
⚠️ This development environment is completely isolated from production:
- Separate Azure resources
- Separate database
- No risk to live system

### Environment Variables
Never commit sensitive data! Use environment files properly:
- Development: `environment.dev.ts` (can commit)
- Production: `environment.prod.ts` (can commit URLs only)
- Secrets: Should be in Azure App Service Configuration

### Database
The development database should be a copy of production schema with test data only.

---

## 📞 Support & Documentation

- **Frontend Repo**: https://github.com/amitpo23/medici_web03012026
- **Backend Repo**: https://github.com/amitpo23/medici-hotels03012026
- **Production Frontend**: https://github.com/OnlyNight-LTD/medici_web
- **Production Backend**: https://github.com/OnlyNight-LTD/medici-hotels

---

## 📝 License

Private - OnlyNight LTD

---

## 👨‍💻 Development Workflow

1. Create feature branch: `git checkout -b feature/new-feature`
2. Make changes
3. Test locally: `npm run dev`
4. Commit: `git commit -m "Description"`
5. Push: `git push origin feature/new-feature`
6. Deploy to dev environment
7. Test in dev
8. Merge to master when ready

---

**Happy Coding! 🚀**

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
# Auto re-deploy trigger 01/28/2026 13:36:22
