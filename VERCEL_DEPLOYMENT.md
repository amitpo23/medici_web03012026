# 🚀 Medici Hotels - Vercel Deployment Guide

## 📋 סקירה כללית

הפרויקט מורכב משני חלקים:
1. **Frontend** - Angular Application (Dashboard + Analytics)
2. **Backend** - Node.js + Express API

---

## 🎯 Deploy Frontend (Angular)

### שלב 1: התקן Vercel CLI

```bash
npm install -g vercel
```

### שלב 2: התחבר ל-Vercel

```bash
vercel login
```

### שלב 3: Deploy Frontend

```bash
# מהתיקייה הראשית
vercel

# או ישירות ל-production
vercel --prod
```

### הגדרות Environment Variables בפרונט:

לאחר ה-Deploy, הגדר ב-Vercel Dashboard:

```
PRODUCTION_API_URL=https://your-backend-url.vercel.app
```

---

## 🔧 Deploy Backend (Node.js API)

### שלב 1: נווט לתיקיית Backend

```bash
cd medici-backend-node
```

### שלב 2: Deploy Backend

```bash
vercel

# או ישירות ל-production
vercel --prod
```

### שלב 3: הגדר Environment Variables

**חשוב:** הגדר את המשתנים הבאים ב-Vercel Dashboard:

```bash
# Database Configuration
DB_SERVER=medici-sql-server.database.windows.net
DB_DATABASE=medici-db-dev
DB_USER=medici_dev_admin
DB_PASSWORD=YourDevPassword123!
DB_PORT=1433

# JWT Secret
JWT_SECRET=O2R_SECRET_FOR_SIGNING_JWT_TOKENS!!

# Environment
NODE_ENV=production
```

#### איך להגדיר ב-Vercel:

1. לך ל-Vercel Dashboard
2. בחר את הפרויקט Backend
3. Settings → Environment Variables
4. הוסף כל משתנה בנפרד
5. שמור ו-Redeploy

---

## 🔗 עדכון כתובת Backend בפרונט

לאחר ש-Backend עלה, עדכן את `environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  baseUrl: 'https://your-backend-name.vercel.app/'
};
```

ואז עשה deploy מחדש לפרונט:

```bash
vercel --prod
```

---

## 📦 אופציה 2: Deploy דרך GitHub

### Frontend

1. Push הקוד ל-GitHub
2. לך ל-Vercel Dashboard → New Project
3. Import מ-GitHub Repository
4. Vercel יזהה אוטומטית Angular
5. הגדר Environment Variables
6. Deploy!

### Backend

1. צור repository נפרד ל-Backend או שים את הקוד בתיקייה `medici-backend-node`
2. Import ל-Vercel
3. הגדר Root Directory ל-`medici-backend-node`
4. הגדר Environment Variables
5. Deploy!

---

## ⚙️ הגדרות מומלצות ב-Vercel

### Frontend (Angular):

- **Framework Preset**: Other
- **Build Command**: `npm run vercel-build`
- **Output Directory**: `dist/only-night-app`
- **Install Command**: `npm install`

### Backend (Node.js):

- **Framework Preset**: Other
- **Build Command**: (leave empty)
- **Output Directory**: (leave empty)
- **Install Command**: `npm install`

---

## 🔒 אבטחה

### חשוב:
1. **אל תשתף** את ה-`.env` file
2. השתמש ב-Environment Variables של Vercel
3. הגדר CORS בבקאנד:

```javascript
app.use(cors({
  origin: ['https://your-frontend.vercel.app'],
  credentials: true
}));
```

---

## 🧪 בדיקה לאחר Deploy

### בדוק Frontend:
```bash
curl https://your-frontend.vercel.app
```

### בדוק Backend:
```bash
curl https://your-backend.vercel.app/
curl https://your-backend.vercel.app/Opportunity/Hotels
```

---

## 🐛 פתרון בעיות

### בעיה: Backend לא מתחבר ל-Database

**פתרון:**
1. בדוק ש-Azure SQL מאפשר חיבורים מ-IPs חיצוניים
2. הוסף `0.0.0.0/0` ל-Firewall Rules (זמנית)
3. וודא ש-Environment Variables נכונים

### בעיה: Frontend לא מתחבר ל-Backend

**פתרון:**
1. בדוק את `environment.prod.ts`
2. ודא ש-CORS מוגדר נכון בבקאנד
3. בדוק Network tab בדפדפן

### בעיה: Build נכשל

**פתרון:**
```bash
# נקה cache
rm -rf node_modules
rm -rf .angular
npm install

# נסה build מקומי
npm run build
```

---

## 📊 ניטור והרצה

- **Frontend URL**: `https://medici-frontend.vercel.app`
- **Backend URL**: `https://medici-backend.vercel.app`
- **Vercel Dashboard**: https://vercel.com/dashboard

---

## 🎉 סיימת!

האפליקציה שלך אמורה להיות LIVE ב:
- Dashboard: `https://your-app.vercel.app/dashboard`
- Analytics: `https://your-app.vercel.app/analytics`

**תהנה! 🚀**
