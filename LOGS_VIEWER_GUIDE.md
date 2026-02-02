# 📋 מערכת צפייה בלוגים - מדריך שימוש מקיף

## 🎯 סקירה כללית

מערכת מקיפה לצפייה, חיפוש וניתוח לוגים של כל קריאות ה-API ופעולות המערכת.

---

## 📦 מה נוצר?

### **Backend API - 7 Endpoints:**
✅ [routes/logs.js](../medici-backend-node/routes/logs.js) (367 שורות)

### **Frontend Components:**
1. ✅ [services/logs.service.ts](../src/app/services/logs.service.ts) (180 שורות)
2. ✅ [components/logs-viewer/logs-viewer.component.ts](../src/app/components/logs-viewer/logs-viewer.component.ts) (300 שורות)
3. ✅ [components/logs-viewer/logs-viewer.component.html](../src/app/components/logs-viewer/logs-viewer.component.html) (350 שורות)
4. ✅ [components/logs-viewer/logs-viewer.component.scss](../src/app/components/logs-viewer/logs-viewer.component.scss) (500 שורות)

**סה"כ:** 4 קבצים חדשים, **~1,330 שורות קוד** 🎉

---

## 🚀 תכונות עיקריות

### 1️⃣ **צפייה בלוגים (Viewer Tab)**

#### קבצי לוג זמינים:
- **http-{date}.log** - כל קריאות ה-HTTP ✅
- **error-{date}.log** - רק שגיאות ❌
- **application-{date}.log** - לוגים כלליים 📝
- **debug-{date}.log** - debug מפורט 🔍

#### תכונות:
- ✅ בחירת קובץ לוג מרשימה נפתחת
- ✅ בחירת מספר שורות (50/100/200/500/1000)
- ✅ רענון אוטומטי כל 10 שניות
- ✅ חיפוש בזמן אמת בתוך הלוג
- ✅ סינון לפי:
  - **Level** (info/warn/error)
  - **Method** (GET/POST/PUT/DELETE)
  - **Status Code** (2xx/3xx/4xx/5xx)
- ✅ צבעים דינמיים לפי סטטוס:
  - 🟢 ירוק - 2xx Success
  - 🔵 כחול - 3xx Redirect
  - 🟠 כתום - 4xx Client Error
  - 🔴 אדום - 5xx Server Error
- ✅ הדגשת קריאות איטיות (>2s)
- ✅ אייקונים אינטואיטיביים (✓ / ⚠ / ✗)

#### דוגמה לטבלת לוגים:
```
| Icon | Time            | Level | Method | URL                  | Status | Response Time |
|------|-----------------|-------|--------|----------------------|--------|---------------|
| ✓    | 02/02 13:11:55 | info  | GET    | /cancellations/stats | 200    | 558ms         |
| ✗    | 02/02 13:15:30 | error | POST   | /Book/PreBook        | 400    | 125ms         |
| ⚠    | 02/02 13:20:45 | warn  | GET    | /Search/InnstantPrice| 404    | 89ms          |
```

---

### 2️⃣ **חיפוש מתקדם (Search Tab)**

#### פרמטרי חיפוש:
- **שאילתת חיפוש** - טקסט חופשי (URL, שגיאה, הודעה)
- **רמת לוג** - info/warn/error
- **תאריך התחלה** - מתאריך
- **תאריך סיום** - עד תאריך
- **שם מלון** - חיפוש לפי מלון ספציפי
- **מזהה הזמנה** - חיפוש לפי booking ID
- **מקסימום תוצאות** - 50/100/200/500

#### תוצאות חיפוש:
- כרטיסיות צבעוניות לכל תוצאה
- הדגשת שגיאות ואזהרות
- פרטים מלאים: זמן, level, method, status, URL, הודעה
- מיון אוטומטי לפי רלוונטיות

#### דוגמאות שימוש:

**חיפוש כל ביטולים כושלים:**
```
שאילתה: "PreBook"
Level: error
תאריך: 01/02/2026 - 02/02/2026
```

**חיפוש בעיות במלון ספציפי:**
```
שאילתה: "timeout"
שם מלון: "Radisson"
```

**חיפוש לפי booking ID:**
```
מזהה הזמנה: "INN123456"
```

---

### 3️⃣ **סטטיסטיקות (Stats Tab)**

#### KPI Cards:
1. **📊 סה"כ קריאות** - מספר כל הקריאות למערכת
2. **❌ שגיאות** - מספר השגיאות הכולל
3. **📈 שיעור שגיאות** - אחוז השגיאות (צבע דינמי)
4. **⏱️ זמן תגובה ממוצע** - Avg response time

#### 🐌 הקריאה האיטית ביותר:
- מציג את ה-URL האיטי ביותר
- זמן התגובה שלו

#### פילוח לפי Status Code:
```
200: 1,243 פעמים
400: 87 פעמים
404: 23 פעמים
500: 12 פעמים
```

---

## 🎨 פעולות נוספות

### **רענון אוטומטי:**
- לחץ על "▶ רענון אוטומטי"
- מתעדכן כל 10 שניות
- מושלם למעקב בזמן אמת

### **הורדה:**
- **💾 הורד JSON** - מוריד את כל הלוגים המסוננים כקובץ JSON
- **📊 ייצא CSV** - מייצא לאקסל עם כל העמודות

### **ניקוי סינונים:**
- **🗑️ נקה סינונים** - מאפס את כל הסינונים בקליק אחד

---

## 💻 שימוש דרך API

### **1. רשימת קבצי לוג:**
```bash
GET http://localhost:3000/logs
```

**תשובה:**
```json
{
  "success": true,
  "logsDirectory": "/path/to/logs",
  "files": [
    {
      "name": "http-2026-02-02.log",
      "size": "15.34 KB",
      "modified": "2026-02-02T13:12:06.000Z",
      "type": "http"
    }
  ],
  "count": 17
}
```

---

### **2. צפייה בלוג ספציפי:**
```bash
GET http://localhost:3000/logs/http-2026-02-02.log?lines=100
```

**תשובה:**
```json
{
  "success": true,
  "filename": "http-2026-02-02.log",
  "totalLines": 1243,
  "filteredLines": 1243,
  "returnedLines": 100,
  "lines": [
    {
      "level": "info",
      "message": "HTTP Request",
      "method": "GET",
      "url": "/cancellations/stats?days=30",
      "status": 200,
      "responseTime": "558ms",
      "ip": "::1",
      "requestId": "5aafc782...",
      "timestamp": "2026-02-02 13:11:55"
    }
  ]
}
```

---

### **3. חיפוש בלוג:**
```bash
GET http://localhost:3000/logs/http-2026-02-02.log?search=PreBook&lines=50
```

---

### **4. Tail (20 שורות אחרונות):**
```bash
GET http://localhost:3000/logs/tail/http-2026-02-02.log?lines=20
```

---

### **5. חיפוש מתקדם:**
```bash
POST http://localhost:3000/logs/search
Content-Type: application/json

{
  "query": "PreBook",
  "level": "error",
  "startDate": "2026-02-01",
  "endDate": "2026-02-02",
  "hotelName": "Radisson",
  "bookingId": "INN123456",
  "limit": 50
}
```

**תשובה:**
```json
{
  "success": true,
  "results": [
    {
      "level": "error",
      "message": "PreBook failed",
      "timestamp": "2026-02-02 13:15:30",
      "url": "/Book/PreBook",
      "status": 400
    }
  ],
  "count": 15
}
```

---

### **6. סטטיסטיקות:**
```bash
GET http://localhost:3000/logs/stats
```

**תשובה:**
```json
{
  "success": true,
  "stats": {
    "totalRequests": 1243,
    "errorCount": 87,
    "errorRate": "7.00%",
    "avgResponseTime": "425ms",
    "slowestRequest": {
      "url": "/Search/InnstantPrice",
      "responseTime": "3456ms"
    },
    "statusCodes": {
      "200": 1050,
      "400": 87,
      "404": 23,
      "500": 12
    }
  }
}
```

---

### **7. ניקוי לוגים ישנים:**
```bash
DELETE http://localhost:3000/logs/cleanup?days=30
```

מוחק לוגים ישנים מ-30 ימים ומעלה.

---

## 🔧 התקנה בפרויקט

### **1. הוסף לדשבורד:**

עדכן את [dashboard.component.html](../src/app/components/dashboard/dashboard.component.html):

```html
<!-- Logs Section -->
<div class="section">
  <div class="section-header">
    <h2>📋 לוגים ומעקב</h2>
    <p>צפייה וחיפוש בלוגים של המערכת</p>
  </div>
  <app-logs-viewer></app-logs-viewer>
</div>
```

### **2. רישום ב-Module:**

עדכן את [dashboard.module.ts](../src/app/components/dashboard/dashboard.module.ts):

```typescript
import { LogsViewerComponent } from '../logs-viewer/logs-viewer.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    LogsViewerComponent  // Standalone component
  ]
})
export class DashboardModule { }
```

---

## 📊 דוגמאות שימוש מעשיות

### **Scenario 1: בדיקת שגיאות בשעה אחרונה**

1. פתח את ה-**Logs Viewer**
2. בחר **error-2026-02-02.log**
3. הגדר **Lines: 100**
4. לחץ **רענן**
5. סנן לפי **Level: error**

→ תראה את כל השגיאות מהשעה אחרונה

---

### **Scenario 2: מעקב אחר PreBook כושל**

1. עבור ל-**Search Tab**
2. הזן **שאילתה: "PreBook"**
3. בחר **Level: error**
4. הגדר **תאריך: היום**
5. לחץ **חפש**

→ תראה את כל ה-PreBook requests שנכשלו היום

---

### **Scenario 3: ניתוח ביצועים**

1. עבור ל-**Stats Tab**
2. בדוק את **זמן תגובה ממוצע**
3. ראה את **הקריאה האיטית ביותר**
4. חזור ל-**Viewer Tab**
5. חפש את ה-URL האיטי
6. נתח מדוע הוא איטי

---

### **Scenario 4: ייצוא לוגים לניתוח Excel**

1. ב-**Viewer Tab**
2. סנן לפי **Status: 5xx** (שגיאות שרת)
3. לחץ **📊 ייצא CSV**
4. פתח ב-Excel
5. צור Pivot Table לניתוח

---

## 🎯 טיפים ושיטות עבודה

### **מעקב בזמן אמת:**
```
1. בחר http-{today}.log
2. הפעל "רענון אוטומטי"
3. השאר את החלון פתוח
4. המערכת תתעדכן כל 10 שניות אוטומטית
```

### **חיפוש מהיר:**
```
- חיפוש בURL: הזן חלק מה-URL (לדוגמה: "Book")
- חיפוש שגיאות: בחר Level: error
- חיפוש קריאות איטיות: חפש "responseTime":"[2-9]"
```

### **סינון יעיל:**
```
- רק POST requests: Method: POST
- רק שגיאות לקוח: Status: 4xx
- רק שגיאות שרת: Status: 5xx
```

---

## 🚨 פתרון בעיות נפוצות

### **בעיה: "Failed to load log files"**
**פתרון:**
1. בדוק שהשרת רץ
2. בדוק שהתיקייה `logs/` קיימת
3. בדוק הרשאות קריאה לתיקייה

---

### **בעיה: "No results found"**
**פתרון:**
1. בדוק שהתאריכים נכונים
2. נסה להרחיב את הטווח
3. הסר סינונים מיותרים
4. נסה חיפוש רחב יותר

---

### **בעיה: "Log file too large"**
**פתרון:**
1. הקטן את מספר השורות (50 במקום 1000)
2. השתמש בסינון לפני הטעינה
3. השתמש ב-Tail במקום Get
4. בצע Cleanup ללוגים ישנים

---

## 📈 שילוב עם מערכות אחרות

### **שילוב עם Cancellations Dashboard:**
```typescript
// בתוך CancellationsOverviewComponent
viewLogs(opportunityId: number): void {
  // Navigate to logs viewer with search
  this.router.navigate(['/logs'], {
    queryParams: {
      search: opportunityId.toString(),
      type: 'cancellation'
    }
  });
}
```

### **שילוב עם Alerts System:**
```typescript
// כאשר יש alert חדש
this.alertsService.newAlert$.subscribe(alert => {
  // פתח את הלוגים עם החיפוש הרלוונטי
  this.logsService.searchLogs({
    query: alert.message,
    level: 'error',
    limit: 10
  }).subscribe(results => {
    console.log('Related logs:', results);
  });
});
```

---

## 🔐 אבטחה והרשאות

### **Backend:**
```javascript
// routes/logs.js - Security measures
const safeName = path.basename(filename);  // Prevent directory traversal
if (!safeName.endsWith('.log')) {
  return res.status(400).json({ error: 'Invalid log file' });
}
```

### **Frontend:**
```typescript
// Only allow specific file types
const validTypes = ['http', 'error', 'application', 'debug'];
const fileType = file.type;
if (!validTypes.includes(fileType)) {
  console.warn('Invalid log type:', fileType);
}
```

---

## 📝 המלצות נוספות

### **1. הוסף Webhooks לעדכונים:**
```typescript
// Real-time updates via WebSocket
const ws = new WebSocket('ws://localhost:3000/logs/stream');
ws.onmessage = (event) => {
  const logEntry = JSON.parse(event.data);
  this.logEntries.unshift(logEntry);  // Add to top
};
```

### **2. הוסף Alerting:**
```typescript
// Alert on critical errors
if (entry.level === 'error' && entry.status >= 500) {
  this.alertsService.sendAlert({
    title: 'Critical Error',
    message: entry.message,
    severity: 'high'
  });
}
```

### **3. הוסף Export לפורמטים נוספים:**
```typescript
// Export to JSON, CSV, PDF
exportToPDF(): void {
  // Use jsPDF or similar library
}
```

---

## ✅ סיכום

מערכת Logs Viewer מספקת:
- ✅ צפייה קלה וידידותית בלוגים
- ✅ חיפוש מתקדם עם 7 פרמטרים
- ✅ סטטיסטיקות ו-KPIs
- ✅ רענון אוטומטי בזמן אמת
- ✅ ייצוא ל-JSON ו-CSV
- ✅ סינון דינמי רב-רמות
- ✅ צבעים אינטואיטיביים
- ✅ אבטחה מובנית

**כל זה ב-4 קבצים, 1,330 שורות קוד!** 🎉

---

## 🔗 קישורים רלוונטיים

- [Backend API Documentation](../medici-backend-node/routes/logs.js)
- [Logs Service](../src/app/services/logs.service.ts)
- [Logs Viewer Component](../src/app/components/logs-viewer/logs-viewer.component.ts)
- [Cancellations System](./CANCELLATIONS_SYSTEM_DOCUMENTATION.md)
- [Logging Infrastructure](./LOGGING_SYSTEM_DOCUMENTATION.md)

---

**תאריך יצירה:** 2 בפברואר 2026  
**גרסה:** 1.0  
**מחבר:** GitHub Copilot
