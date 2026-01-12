# 🚀 Quick Start - Medici Hotels Dashboard

## הרצה מהירה

```bash
# 1. התקנת תלויות
npm install --legacy-peer-deps

# 2. הרצה מקומית
npm start

# 3. פתח בדפדפן
# http://localhost:4200
```

## Deploy ל-Vercel (מהיר)

```bash
# אופציה 1: עם הסקריפט
./deploy-vercel.sh

# אופציה 2: ידני
npm run vercel-build
vercel --prod
```

## תכונות מרכזיות שנוספו

### ✅ UI מקצועי
- כרטיסי KPI עם אנימציות וגרדיאנטים
- תרשימים אינטראקטיביים (Line & Bar)
- בחירת תקופות זמן (3/6/12 חודשים)
- Hover effects מתקדמים

### ✅ Dark Mode
- מעבר חלק בין מצבים
- שמירת העדפות
- תמיכה ב-system preferences
- עיצוב מותאם לכל רכיב

### ✅ Responsive Design
- תמיכה מלאה במובייל
- Grid אדפטיבי
- תפריטים נגישים

### ✅ Vercel Ready
- הגדרות מותאמות
- Build optimization
- Security headers
- Caching מתקדם

## המבנה החדש

```
src/
├── app/
│   ├── services/
│   │   └── theme.service.ts          ← חדש! שירות Dark Mode
│   ├── modules/
│   │   └── dashboard/
│   │       ├── components/
│   │       │   ├── kpi-cards/        ← משודרג!
│   │       │   ├── revenue-chart/    ← משודרג!
│   │       │   └── ...
│   │       ├── dashboard.component.* ← משודרג!
│   └── ...
├── styles.scss                        ← משודרג! (Dark Mode)
└── ...

├── tailwind.config.js                 ← משודרג! (Colors, Animations)
├── vercel.json                        ← משודרג! (Routes, Headers)
├── deploy-vercel.sh                   ← חדש! (Auto Deployment)
└── DEPLOYMENT_GUIDE.md                ← חדש! (הנחיות מפורטות)
```

## טיפים מהירים

### שינוי צבעים
ערוך את `tailwind.config.js`:
```javascript
colors: {
  primary: { ... }  // שנה כאן
}
```

### כיבוי Dark Mode
ב-`dashboard.component.html` הסר את כפתור ה-theme toggle.

### שינוי תקופת ברירת מחדל
ב-`revenue-chart.component.ts`:
```typescript
selectedPeriod: number = 12;  // שנה ל-3 או 6
```

## פתרון בעיות מהיר

### Build נכשל?
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install --legacy-peer-deps
npm run build
```

### Vercel לא מזהה את הפרויקט?
ודא ש-`vercel-build` מוגדר ב-`package.json`:
```json
"scripts": {
  "vercel-build": "ng build --configuration production"
}
```

### Dark Mode לא עובד?
1. בדוק שהשירות מוזרק בקומפוננטה
2. ודא ש-`styles.scss` נטען
3. נקה cache הדפדפן

## עזרה נוספת

📖 מדריך מלא: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
🐛 תיעוד בעיות: פתח Issue בגיטהאב
💬 תמיכה: צור קשר עם צוות הפיתוח

---

**זמן טעינה משוער:**
- התקנה: 2-3 דקות
- Build: 1-2 דקות
- Deployment: 1-2 דקות

**סה"כ: ~5-7 דקות** ⚡
