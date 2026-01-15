# 🤖 AI Database Chat - מדריך שימוש

## ✅ המערכת עכשיו מחוברת ל-SQL ורצה!

**Backend API רץ על:** http://localhost:8080

---

## 📊 טבלאות זמינות במסד הנתונים:

1. **MED_Book** - הזמנות (5,011 רשומות)
   - `id`, `price`, `HotelName`, `startDate`, `endDate`, `Status`, `IsActive`, `IsSold`
   
2. **Med_Hotels** - מלונות
   - `id`, `HotelName`, `isActive`
   
3. **Med_Reservation** - הזמנות מ-Zenith
   - הזמנות שהתקבלו מערוץ ההפצה
   
4. **MED_Board** - סוגי אירוח (BB, HB, FB)

5. **MED_RoomCategory** - קטגוריות חדרים

---

## 🎯 איך לשאול שאלות על הנתונים?

### דרך 1: API Endpoints (JSON)

#### 📌 סטטיסטיקות מהירות
```bash
curl http://localhost:8080/ai-chat/quick-stats
```

**תשובה:**
```json
{
  "success": true,
  "stats": {
    "TotalBookings": 4932,
    "ActiveOpportunities": 0,
    "ActiveHotels": 125,
    "TotalRevenue": 876775.02,
    "TotalProfit": 87234.15
  }
}
```

---

#### 🤔 שאל שאלה בשפה טבעית
```bash
curl -X POST http://localhost:8080/ai-chat/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "כמה הזמנות יש לי?"}'
```

**תשובה:**
```json
{
  "success": true,
  "question": "כמה הזמנות יש לי?",
  "sqlQuery": "SELECT COUNT(*) as Total FROM MED_Book WHERE Status = 'confirmed'",
  "results": [{"Total": 4932}],
  "explanation": "נמצאו 4932 רשומות."
}
```

---

#### 🏨 מלונות מובילים
```bash
curl "http://localhost:8080/ai-chat/ask" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"question": "אילו מלונות הכי רווחיים?"}'
```

---

#### 📊 שאילתת SQL מותאמת אישית
```bash
curl -X POST http://localhost:8080/ai-chat/custom-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT TOP 10 HotelName, COUNT(*) as Bookings, SUM(price) as Revenue FROM MED_Book WHERE IsActive = 1 GROUP BY HotelName ORDER BY Revenue DESC"
  }'
```

---

#### 🗂️ צפה בסכמה של הטבלאות
```bash
curl http://localhost:8080/ai-chat/schema
```

---

#### 💡 קבל הצעות לשאלות
```bash
curl http://localhost:8080/ai-chat/suggestions
```

**תשובה:**
```json
{
  "suggestions": [
    "כמה הזמנות יש לי?",
    "מה סכום ההכנסות החודש?",
    "מה הרווח הכולל?",
    "אילו מלונות הכי רווחיים?",
    "How many bookings today?",
    "Total revenue this month?",
    "Top 10 hotels by profit?"
  ]
}
```

---

## 🔥 דוגמאות שימוש ב-PowerShell

### שאלה 1: כמה הזמנות היום?
```powershell
$body = @{ question = "כמה הזמנות יש לי?" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8080/ai-chat/ask" -Method POST -Body $body -ContentType "application/json"
```

### שאלה 2: סכום ההכנסות
```powershell
$body = @{ question = "מה סכום ההכנסות?" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8080/ai-chat/ask" -Method POST -Body $body -ContentType "application/json"
```

### שאלה 3: שאילתה מותאמת אישית
```powershell
$body = @{ 
    query = "SELECT TOP 10 HotelName, price FROM MED_Book ORDER BY price DESC" 
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8080/ai-chat/custom-query" -Method POST -Body $body -ContentType "application/json"
```

---

## 📈 דוחות מתקדמים

### דוח רווחיות
```bash
curl "http://localhost:8080/reports/ProfitLoss?startDate=2026-01-01&endDate=2026-01-31"
```

### מרווח לפי מלון
```bash
curl "http://localhost:8080/reports/MarginByHotel?startDate=2026-01-01"
```

### 10 המלונות המובילים
```bash
curl "http://localhost:8080/reports/TopHotels?limit=10"
```

---

## 🎮 Dashboard עם KPIs

### סטטיסטיקות מקיפות
```bash
curl "http://localhost:8080/dashboard/Stats?period=30"
```

### התראות בזמן אמת
```bash
curl "http://localhost:8080/dashboard/Alerts"
```

### תחזית הכנסות
```bash
curl "http://localhost:8080/dashboard/Forecast?days=30"
```

### ביצועים לפי מלון
```bash
curl "http://localhost:8080/dashboard/HotelPerformance?limit=10"
```

---

## 🧠 שאלות שה-AI מבין

### בעברית:
- ✅ "כמה הזמנות יש לי?"
- ✅ "מה סכום ההכנסות?"
- ✅ "מה הרווח הכולל?"
- ✅ "אילו מלונות הכי רווחיים?"
- ✅ "כמה הזמנות היום?"
- ✅ "מה ההכנסות החודש?"

### באנגלית:
- ✅ "How many bookings?"
- ✅ "Total revenue?"
- ✅ "Show me profit"
- ✅ "Top hotels"
- ✅ "Bookings today"
- ✅ "Revenue this month"

---

## 🔧 Endpoints מלאים

| Endpoint | Method | תיאור |
|----------|--------|-------|
| `/ai-chat/ask` | POST | שאל שאלה בשפה טבעית |
| `/ai-chat/suggestions` | GET | קבל הצעות לשאלות |
| `/ai-chat/schema` | GET | צפה בסכמה של הטבלאות |
| `/ai-chat/custom-query` | POST | הרץ שאילתת SQL מותאמת |
| `/ai-chat/quick-stats` | GET | סטטיסטיקות מהירות |
| `/ai-chat/analyze` | POST | ניתוח מתקדם של נתונים |
| `/reports/ProfitLoss` | GET | דוח רווח והפסד |
| `/reports/MarginByHotel` | GET | מרווח לפי מלון |
| `/reports/TopHotels` | GET | מלונות מובילים |
| `/dashboard/Stats` | GET | סטטיסטיקות מקיפות |
| `/dashboard/Alerts` | GET | התראות בזמן אמת |
| `/dashboard/Forecast` | GET | תחזית הכנסות |

---

## 🚀 דוגמה מלאה: בדיקת מערכת

```powershell
# 1. בדוק שהשרת רץ
Invoke-RestMethod -Uri "http://localhost:8080"

# 2. קבל סטטיסטיקות מהירות
Invoke-RestMethod -Uri "http://localhost:8080/ai-chat/quick-stats"

# 3. שאל שאלה
$body = @{ question = "כמה הזמנות יש?" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8080/ai-chat/ask" -Method POST -Body $body -ContentType "application/json"

# 4. קבל רשימת מלונות מובילים
$query = @{ query = "SELECT TOP 5 HotelName, COUNT(*) as Total FROM MED_Book GROUP BY HotelName ORDER BY Total DESC" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8080/ai-chat/custom-query" -Method POST -Body $query -ContentType "application/json"
```

---

## ⚡ עכשיו תנסה!

פתח PowerShell והרץ:

```powershell
# סטטיסטיקות בסיסיות
Invoke-RestMethod "http://localhost:8080/ai-chat/quick-stats" | ConvertTo-Json -Depth 5

# שאל שאלה
$question = @{ question = "How many bookings?" } | ConvertTo-Json
Invoke-RestMethod "http://localhost:8080/ai-chat/ask" -Method POST -Body $question -ContentType "application/json" | ConvertTo-Json -Depth 5
```

---

## 🎉 זהו! המערכת עובדת!

- ✅ השרת רץ על http://localhost:8080
- ✅ מחובר ל-SQL Database
- ✅ 4,932 הזמנות זמינות
- ✅ AI מבין שאלות בעברית ואנגלית
- ✅ דוחות מתקדמים זמינים

**תהנה! 🚀**
