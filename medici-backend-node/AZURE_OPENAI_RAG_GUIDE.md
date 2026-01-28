# 🤖 Azure OpenAI + Pinecone + RAG Integration

## ✅ מה הוספנו?

הפרויקט כעת כולל:
1. **Azure OpenAI** - GPT-4 לשיחות חכמות
2. **Pinecone** - Vector database לחיפוש סמנטי
3. **RAG** - Retrieval-Augmented Generation

---

## 📦 Packages שהותקנו

```json
{
  "@azure/openai": "^1.x",
  "@pinecone-database/pinecone": "^2.x",
  "langchain": "^0.x"
}
```

---

## 🔑 הגדרות נדרשות

### 1. Azure OpenAI Setup

1. **צור Azure OpenAI Resource:**
   - לך ל-[Azure Portal](https://portal.azure.com)
   - צור **Azure OpenAI** resource
   - Deploy models:
     - `gpt-4` (או `gpt-35-turbo`)
     - `text-embedding-ada-002`

2. **הגדר משתנים ב-.env:**
```bash
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE-NAME.openai.azure.com/
AZURE_OPENAI_KEY=YOUR_API_KEY_HERE
AZURE_OPENAI_DEPLOYMENT=gpt-4
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
```

### 2. Pinecone Setup

1. **צור חשבון Pinecone:**
   - לך ל-[Pinecone](https://www.pinecone.io/)
   - צור חשבון חינם
   - צור Index חדש:
     - Name: `medici-hotels`
     - Dimensions: `1536` (למודל text-embedding-ada-002)
     - Metric: `cosine`

2. **הגדר משתנים ב-.env:**
```bash
PINECONE_API_KEY=YOUR_PINECONE_API_KEY
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX=medici-hotels
```

---

## 🚀 API Endpoints

### 1. **RAG Chat** - שאל שאלה חכמה
```bash
POST /ai/rag/ask
Content-Type: application/json

{
  "question": "איזה מלונות הכי פופולריים?",
  "topK": 5,
  "includeContext": false
}
```

**תשובה:**
```json
{
  "success": true,
  "question": "איזה מלונות הכי פופולריים?",
  "answer": "המלונות הפופולריים ביותר הם...",
  "sources": [
    {
      "id": "hotel-123",
      "relevance": "95.3%",
      "snippet": "Hotel: Hilton Tel Aviv..."
    }
  ],
  "usage": {
    "promptTokens": 150,
    "completionTokens": 80,
    "totalTokens": 230
  }
}
```

---

### 2. **GPT-4 Chat** - שיחה עם GPT-4
```bash
POST /ai/rag/chat
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "מה המחיר הממוצע לחדר במלון?"}
  ],
  "temperature": 0.7,
  "maxTokens": 2000
}
```

---

### 3. **Semantic Search** - חיפוש סמנטי
```bash
POST /ai/rag/search
Content-Type: application/json

{
  "query": "מלונות יוקרה בתל אביב",
  "topK": 10,
  "filter": {
    "city": "Tel Aviv"
  }
}
```

**תשובה:**
```json
{
  "success": true,
  "query": "מלונות יוקרה בתל אביב",
  "results": [
    {
      "id": "hotel-456",
      "score": 0.95,
      "text": "Hotel: Hilton Tel Aviv...",
      "metadata": {
        "hotelName": "Hilton Tel Aviv",
        "city": "Tel Aviv",
        "avgPrice": 350
      }
    }
  ],
  "count": 10
}
```

---

### 4. **Create Embeddings** - צור embeddings
```bash
POST /ai/rag/embed
Content-Type: application/json

{
  "text": "מלון מעולה עם שירות מצוין"
}
```

---

### 5. **Index Hotels** - אינדקס מלונות ל-Vector DB
```bash
POST /ai/rag/index/hotels
```

**תהליך:**
1. שולף top 100 מלונות מה-DB
2. יוצר תיאור טקסטואלי לכל מלון
3. מייצר embeddings עם Azure OpenAI
4. שומר ב-Pinecone

---

### 6. **Index Insights** - אינדקס תובנות
```bash
POST /ai/rag/index/insights
```

---

### 7. **Analyze Text** - ניתוח טקסט
```bash
POST /ai/rag/analyze
Content-Type: application/json

{
  "text": "המלון היה נהדר! ממליץ בחום"
}
```

**תשובה:**
```json
{
  "success": true,
  "analysis": {
    "sentiment": "positive",
    "intent": "feedback",
    "keywords": ["מלון", "נהדר", "ממליץ"],
    "summary": "ביקורת חיובית על מלון",
    "language": "he"
  }
}
```

---

### 8. **Summarize** - סיכום טקסט
```bash
POST /ai/rag/summarize
Content-Type: application/json

{
  "text": "טקסט ארוך מאוד...",
  "maxLength": 200
}
```

---

### 9. **Health Check** - בדיקת תקינות
```bash
GET /ai/rag/health
```

**תשובה:**
```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "openai": {
      "configured": true,
      "initialized": true
    },
    "pinecone": {
      "configured": true,
      "initialized": true
    },
    "rag": {
      "initialized": true
    }
  }
}
```

---

### 10. **Stats** - סטטיסטיקות
```bash
GET /ai/rag/stats
```

**תשובה:**
```json
{
  "success": true,
  "stats": {
    "vectorDatabase": {
      "totalVectors": 150,
      "dimension": 1536,
      "indexFullness": "0.15%"
    },
    "services": {
      "openai": true,
      "pinecone": true,
      "rag": true
    }
  }
}
```

---

## 🎯 שימוש מומלץ

### תרחיש 1: בוט שירות לקוחות
```javascript
// Frontend code
const response = await fetch('http://localhost:3000/ai/rag/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'יש לי הזמנה למלון X, איך אני מבטל?'
  })
});

const data = await response.json();
console.log(data.answer); // תשובה חכמה מבוססת על מידע אמיתי
```

### תרחיש 2: המלצות מלונות
```javascript
const response = await fetch('http://localhost:3000/ai/rag/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'מלון רומנטי לזוג',
    topK: 5
  })
});

const data = await response.json();
// data.results - רשימת מלונות רלוונטיים
```

### תרחיש 3: ניתוח ביקורות
```javascript
const response = await fetch('http://localhost:3000/ai/rag/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'המלון היה נקי אבל השירות איטי'
  })
});

const data = await response.json();
console.log(data.analysis.sentiment); // "neutral" או "negative"
```

---

## 📁 קבצים שנוצרו

```
medici-backend-node/
├── services/
│   ├── azure-openai-service.js    # Azure OpenAI client
│   ├── pinecone-service.js        # Pinecone vector DB
│   └── rag-service.js              # RAG orchestration
├── routes/
│   └── ai-rag.js                   # API endpoints
├── .env                            # API keys (DON'T COMMIT!)
└── .env.example                    # Template
```

---

## 🔐 אבטחה

**⚠️ חשוב מאוד:**

1. **אף פעם** אל תעשה commit ל-`.env` file!
2. השתמש ב-Azure Key Vault לפרודקשן
3. הגדר rate limiting על endpoints יקרים
4. הוסף authentication לendpoints של indexing

---

## 💰 עלויות

### Azure OpenAI
- **GPT-4**: ~$0.03 per 1K tokens
- **text-embedding-ada-002**: ~$0.0001 per 1K tokens

### Pinecone
- **Free Tier**: 1 pod, 100K vectors
- **Starter**: $70/month

**💡 טיפ:** התחל עם Free tier ועבור לשלם רק כשצריך scale

---

## 🧪 בדיקה

### 1. בדוק health:
```bash
curl http://localhost:3000/ai/rag/health
```

### 2. אינדקס מלונות:
```bash
curl -X POST http://localhost:3000/ai/rag/index/hotels
```

### 3. שאל שאלה:
```bash
curl -X POST http://localhost:3000/ai/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "מה המלון הכי זול?"}'
```

---

## 🐛 Troubleshooting

### בעיה: "Azure OpenAI credentials not configured"
**פתרון:** בדוק ש-`.env` מכיל:
```
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_KEY=...
```

### בעיה: "Pinecone index not available"
**פתרון:** צור index ב-Pinecone dashboard עם:
- Dimensions: 1536
- Metric: cosine

### בעיה: "Too many requests"
**פתרון:** הוסף rate limiting או שדרג את ה-quota ב-Azure

---

## 📚 משאבים נוספים

- [Azure OpenAI Docs](https://learn.microsoft.com/azure/ai-services/openai/)
- [Pinecone Docs](https://docs.pinecone.io/)
- [RAG Tutorial](https://www.pinecone.io/learn/retrieval-augmented-generation/)

---

## 🎉 מה הלאה?

1. ✅ הגדר Azure OpenAI + Pinecone
2. ✅ רוץ `/ai/rag/index/hotels` לאינדקס מלונות
3. ✅ נסה `/ai/rag/ask` עם שאלות
4. 🚀 שלב בפרונט (Angular component)
5. 📊 הוסף analytics על שימוש
6. 🔧 Fine-tune prompts

**🎊 מזל טוב! יש לך RAG מלא!** 🎊
