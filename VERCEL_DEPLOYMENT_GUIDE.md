# 🚀 העלאה ל-Vercel - מדריך מלא

## 📋 הכנה להעלאה

### 1. התחברות ל-Vercel

```powershell
cd "c:\Users\97250\Desktop\booking engine\medici_web03012026"
vercel login
```

**או דרך דפדפן:**
1. לך ל: https://vercel.com/login
2. התחבר עם GitHub / Email
3. אשר את הקישור

---

## 🎯 העלאת Frontend (Angular)

### שלב 1: Build הפרויקט

```powershell
cd "c:\Users\97250\Desktop\booking engine\medici_web03012026"
npm run vercel-build
```

זה יריץ:
```bash
ng build --configuration production
```

### שלב 2: Deploy ל-Vercel

```powershell
# Preview Deployment (לבדיקה)
vercel

# Production Deployment (לפרודקשיין)
vercel --prod
```

**מה יקרה:**
1. Vercel ישאל כמה שאלות:
   - Set up and deploy? **Yes**
   - Which scope? בחר את החשבון שלך
   - Link to existing project? **No** (בפעם הראשונה)
   - What's your project's name? **medici-frontend** (או שם אחר)
   - In which directory is your code located? **./** (Enter)
   - Override settings? **No**

2. הפרויקט יועלה ותקבל URL:
   ```
   ✅ https://medici-frontend-xxx.vercel.app
   ```

---

## 🔧 העלאת Backend (Node.js)

### שלב 1: עבור לתיקיית Backend

```powershell
cd "c:\Users\97250\Desktop\booking engine\medici_web03012026\medici-backend-node"
```

### שלב 2: Deploy ל-Vercel

```powershell
# Preview
vercel

# Production
vercel --prod
```

**הגדרות:**
- Project name: **medici-backend**
- Directory: **./**
- Override settings? **No**

תקבל URL:
```
✅ https://medici-backend-xxx.vercel.app
```

---

## 🔐 הגדרת משתני סביבה (Environment Variables)

### דרך CLI:

```powershell
cd "c:\Users\97250\Desktop\booking engine\medici_web03012026\medici-backend-node"

# הוסף משתני סביבה
vercel env add DB_SERVER production
vercel env add DB_DATABASE production
vercel env add DB_USER production
vercel env add DB_PASSWORD production
vercel env add JWT_SECRET production
```

### דרך Dashboard:

1. לך ל: https://vercel.com/dashboard
2. בחר את הפרויקט **medici-backend**
3. לחץ על **Settings** → **Environment Variables**
4. הוסף:
   - `DB_SERVER` = your-sql-server.database.windows.net
   - `DB_DATABASE` = medici-db-dev-copy
   - `DB_USER` = medici-admin
   - `DB_PASSWORD` = ********
   - `DB_PORT` = 1433
   - `JWT_SECRET` = your-secret-key
   - `NODE_ENV` = production

5. Save ו-Redeploy

---

## 🔗 חיבור Frontend ל-Backend

### עדכן את ה-Environment ב-Frontend:

```typescript
// src/app/environments/environment.prod.ts
export const environment = {
  production: true,
  baseUrl: 'https://medici-backend-xxx.vercel.app',
  apiUrl: 'https://medici-backend-xxx.vercel.app/api'
};
```

### Deploy מחדש:

```powershell
cd "c:\Users\97250\Desktop\booking engine\medici_web03012026"
npm run vercel-build
vercel --prod
```

---

## 📦 פקודות שימושיות

```powershell
# רשימת כל הפרויקטים
vercel list

# מידע על פרויקט
vercel inspect medici-frontend

# הסרת פרויקט
vercel remove medici-frontend

# רשימת deployments
vercel ls

# לוגים של deployment ספציפי
vercel logs <deployment-url>

# Alias (URL מותאם אישית)
vercel alias set medici-frontend-xxx.vercel.app medici.vercel.app
```

---

## 🎛️ תצורת vercel.json

### Frontend (כבר קיים):
```json
{
  "version": 2,
  "name": "medici-frontend",
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist/only-night-app"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### Backend (כבר קיים):
```json
{
  "version": 2,
  "name": "medici-backend",
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ]
}
```

---

## ✅ בדיקת הפריסה

### Frontend:
```powershell
# פתח בדפדפן
Start-Process "https://medici-frontend-xxx.vercel.app"

# בדיקה
Invoke-RestMethod "https://medici-frontend-xxx.vercel.app"
```

### Backend:
```powershell
# בדיקת Health
Invoke-RestMethod "https://medici-backend-xxx.vercel.app"

# בדיקת AI Chat
$body = @{ question = "How many bookings?" } | ConvertTo-Json
Invoke-RestMethod "https://medici-backend-xxx.vercel.app/ai-chat/ask" -Method POST -Body $body -ContentType "application/json"
```

---

## 🔄 עדכון אוטומטי (CI/CD)

### חיבור ל-GitHub:

1. לך ל-Vercel Dashboard
2. Import Project → Select Git Repository
3. בחר: **amitpo23/medici_web03012026**
4. הגדר:
   - Framework Preset: **Angular**
   - Root Directory: **./`** (לfrontend) או **medici-backend-node/** (לbackend)
   - Build Command: `npm run vercel-build`
   - Output Directory: `dist/only-night-app`

**עכשיו כל push ל-master יעלה אוטומטית!**

---

## 🎯 תרחישים נפוצים

### 1. שגיאת Build

```powershell
# בדוק לוגים
vercel logs <url>

# נסה build מקומי
npm run vercel-build
```

### 2. שגיאת Runtime

```powershell
# לוגים בזמן אמת
vercel logs --follow

# בדוק משתני סביבה
vercel env ls
```

### 3. CORS Error

הוסף ב-`server.js`:
```javascript
app.use(cors({
  origin: [
    'https://medici-frontend-xxx.vercel.app',
    'http://localhost:4200'
  ],
  credentials: true
}));
```

---

## 📊 סיכום URLs

| שירות | URL | סטטוס |
|-------|-----|-------|
| Frontend | https://medici-frontend.vercel.app | ⏳ |
| Backend API | https://medici-backend.vercel.app | ⏳ |
| Sales Room | https://medici-frontend.vercel.app/sales-room | ⏳ |
| AI Chat | https://medici-backend.vercel.app/ai-chat/ask | ⏳ |

---

## 🚀 סקריפט מהיר (PowerShell)

```powershell
# העלאה מלאה של הכל
cd "c:\Users\97250\Desktop\booking engine\medici_web03012026"

# 1. Build Frontend
npm run vercel-build

# 2. Deploy Frontend
vercel --prod

# 3. Deploy Backend
cd medici-backend-node
vercel --prod

Write-Host "✅ Deployment Complete!" -ForegroundColor Green
```

---

## 📝 Checklist לפני העלאה

- [ ] Vercel CLI מותקן (`vercel --version`)
- [ ] מחובר ל-Vercel (`vercel whoami`)
- [ ] Build עובד מקומית (`npm run vercel-build`)
- [ ] משתני סביבה מוכנים
- [ ] Database נגיש מ-Internet (SQL Azure)
- [ ] CORS מוגדר נכון
- [ ] Environment files עודכנו

---

## 🎉 זהו!

אחרי ההעלאה תקבל:
- ✅ Frontend זמין ב: https://medici-frontend-xxx.vercel.app
- ✅ Backend API ב: https://medici-backend-xxx.vercel.app
- ✅ SSL חינם
- ✅ CDN גלובלי
- ✅ Auto-scaling
- ✅ CI/CD אוטומטי (אם מחובר ל-GitHub)

**Version:** 2.0.0 🚀
