# Week 3 Phase 3.1 - AI → Actions Integration

## ✅ Implementation Complete (4 hours)

### Overview
Connected AI prediction engine to business workflow. System now automatically discovers opportunities using AI, creates them in database, and enables approval workflow.

---

## 🎯 Components Created

### 1. AI Opportunity Discovery Service
**File:** `services/ai-opportunity-discovery.js` (450+ lines)

**Purpose:** Connect AI predictions to opportunity creation

**Key Features:**
- Market scanning using prediction engine
- Business rule validation
- Confidence scoring and risk assessment
- Priority calculation (0-100 scale)
- Auto-approval logic
- Batch creation with safety limits

**Core Methods:**

#### `scanMarket(options)`
Scans market for opportunities using AI predictions
```javascript
const result = await discovery.scanMarket({
  hotelId: 123,           // Optional: specific hotel
  city: 'Barcelona',      // Optional: specific city
  daysAhead: 90,          // Look ahead window
  riskTolerance: 'medium' // low | medium | high
});
// Returns: { success, opportunities[], total, scanTime }
```

#### `validateOpportunity(opp)`
Validates opportunity against business rules
- Requires pricing data (€ not null)
- Min 15% profit margin
- Min 70% AI confidence
- Valid dates (checkIn < checkOut)

#### `enrichOpportunity(opp, riskTolerance)`
Adds AI metadata and scoring
```javascript
{
  aiConfidence: 0.75,      // Risk-adjusted (LOW=+5%, HIGH=-10%)
  profit: 85.50,           // € PushPrice - Price
  profitMargin: 0.22,      // 22%
  priorityScore: 78,       // 0-100 weighted score
  riskLevel: 'MEDIUM',     // LOW | MEDIUM | HIGH
  autoApprove: false       // 85%+ conf, 20%+ margin, €50+ profit
}
```

#### `calculatePriorityScore(factors)`
Weighted priority calculation
```javascript
Score = (40% × confidence) + (30% × margin) + (20% × profit) + (10% × urgency)
```
- Prefers 7-30 days lead time
- Max scores: 95% confidence, 50% margin, €500 profit

#### `createOpportunity(opp, options)`
Inserts opportunity to database
- Checks for duplicates (same hotel + dates)
- Inserts to `MED_Opportunities` with AI fields
- Logs to `MED_OpportunityLogs`
- Returns: `{ success, opportunityId, created, message }`

#### `batchCreateOpportunities(opps, options)`
Creates multiple opportunities
- Safety limit: 20 max per run
- Auto-activates if confidence ≥85%
- Returns: `{ success, created, skipped, failed, details[] }`

#### `getAIOpportunities(filters)`
Fetches AI-generated opportunities
```javascript
const opps = await discovery.getAIOpportunities({
  minConfidence: 0.75,
  riskLevel: 'LOW',
  isActive: true,
  limit: 50
});
```

**Thresholds:**
```javascript
MIN_CONFIDENCE = 0.70      // 70% minimum
MIN_PROFIT_MARGIN = 0.15   // 15% minimum
AUTO_APPROVE_CONFIDENCE = 0.85
AUTO_APPROVE_MARGIN = 0.20
AUTO_APPROVE_MIN_PROFIT = 50  // €50
```

---

### 2. AI Opportunity Scanner Worker
**File:** `workers/ai-opportunity-scanner.js` (270+ lines)

**Purpose:** Continuous automated market scanning

**Schedule:** Every 4 hours (`0 */4 * * *`)

**Workflow:**
```
1. ensureAIColumns() - Add AI fields to MED_Opportunities (one-time)
2. getHotelsToScan() - Get top 20 hotels by activity
3. For each hotel:
   - scanHotel(hotel)
   - Filter: confidence ≥75%, priority ≥60
   - batchCreateOpportunities(max 10/hotel)
   - Auto-activate if confidence ≥85%
4. Send Slack notification with results
```

**Hotel Selection Logic:**
```sql
SELECT TOP 20 HotelId, HotelName
FROM [Med_Hotels]
WHERE IsActive = 1
ORDER BY
  (SELECT COUNT(*) FROM [MED_ֹOֹֹpportunities] WHERE HotelId = Med_Hotels.HotelId AND IsSale = 1) DESC,
  (SELECT COUNT(*) FROM [MED_ֹOֹֹpportunities] WHERE HotelId = Med_Hotels.HotelId AND IsActive = 1) DESC,
  LastActivityDate DESC
```

**Safety Limits:**
- Max 20 hotels per run
- Max 10 opportunities per hotel (200 total max)
- 2-second delay between hotels
- Confidence ≥75%, Priority ≥60

**Output Example:**
```
🤖 AI Market Scan Complete

📊 Results:
• Scanned 20 hotels
• Found 45 opportunities
• ✅ Created 12 new opportunities

🏨 Top Hotels:
• Hotel Barcelo Raval: 3 created (best: €85 profit, 82% confidence)
• Hotel Arts Barcelona: 2 created (best: €120 profit, 88% confidence)
• W Barcelona: 2 created (best: €95 profit, 79% confidence)

📈 Summary:
• Total expected profit: €890
• Average confidence: 81%
• Auto-activated: 4 opportunities (85%+ confidence)
```

**Migration Helper:**
```javascript
async function ensureAIColumns(pool) {
  // Adds these columns to MED_Opportunities:
  // - AIGenerated BIT
  // - AIConfidence DECIMAL(5,4)
  // - AIPriorityScore DECIMAL(5,2)
  // - AIRiskLevel NVARCHAR(20)
  // - CreatedBy NVARCHAR(100)
}
```

---

### 3. AI Opportunities Management API
**File:** `routes/ai-opportunities.js` (470+ lines)

**Purpose:** Full CRUD and approval workflow for AI opportunities

#### Endpoints:

##### 1. POST `/ai-opportunities/scan`
Manually trigger market scan
```javascript
POST /ai-opportunities/scan
{
  "hotelId": 123,           // Optional
  "city": "Barcelona",      // Optional
  "daysAhead": 90,
  "riskTolerance": "medium",
  "autoCreate": true,       // Auto-create high-confidence opps
  "maxCreate": 20
}

Response:
{
  "success": true,
  "scan": {
    "total": 45,
    "opportunities": [...],
    "scanTime": 2534
  },
  "created": {
    "success": true,
    "created": 12,
    "skipped": 8,
    "failed": 0
  }
}
```

##### 2. GET `/ai-opportunities`
List AI-generated opportunities
```javascript
GET /ai-opportunities?minConfidence=0.75&riskLevel=LOW&isActive=true&limit=50

Response:
{
  "success": true,
  "opportunities": [
    {
      "opportunityId": 12345,
      "hotelName": "Hotel Arts",
      "checkIn": "2025-06-15",
      "checkOut": "2025-06-17",
      "price": 380,
      "pushPrice": 550,
      "profit": 170,
      "profitMargin": 0.31,
      "aiConfidence": 0.88,
      "priorityScore": 85,
      "riskLevel": "LOW",
      "isActive": true,
      "aiGenerated": true
    }
  ],
  "total": 12
}
```

##### 3. POST `/ai-opportunities/:id/approve`
Approve and activate opportunity
```javascript
POST /ai-opportunities/12345/approve
{
  "userId": "admin@medici.com",
  "notes": "High confidence, good margin"
}

Response:
{
  "success": true,
  "message": "Opportunity approved and activated",
  "opportunityId": 12345
}
```

##### 4. POST `/ai-opportunities/:id/reject`
Reject opportunity
```javascript
POST /ai-opportunities/12345/reject
{
  "userId": "admin@medici.com",
  "reason": "Hotel policy changed"
}

Response:
{
  "success": true,
  "message": "Opportunity rejected",
  "opportunityId": 12345
}
```

##### 5. GET `/ai-opportunities/stats`
AI opportunity statistics
```javascript
GET /ai-opportunities/stats?days=30

Response:
{
  "success": true,
  "period": "Last 30 days",
  "summary": {
    "TotalCreated": 245,
    "AutoActivated": 89,
    "ManuallyApproved": 67,
    "Rejected": 12,
    "Sold": 134,
    "TotalRevenue": 73700,
    "TotalCost": 50960,
    "TotalProfit": 22740,
    "ProfitMargin": 30.85,
    "ConversionRate": 54.69
  },
  "confidenceDistribution": [
    { "ConfidenceRange": "90-100%", "Count": 45, "SoldCount": 38 },
    { "ConfidenceRange": "80-89%", "Count": 89, "SoldCount": 67 },
    { "ConfidenceRange": "70-79%", "Count": 111, "SoldCount": 29 }
  ],
  "riskDistribution": [
    { "RiskLevel": "LOW", "Count": 67, "SoldCount": 54, "AvgConfidence": 0.89 },
    { "RiskLevel": "MEDIUM", "Count": 145, "SoldCount": 68, "AvgConfidence": 0.78 },
    { "RiskLevel": "HIGH", "Count": 33, "SoldCount": 12, "AvgConfidence": 0.72 }
  ]
}
```

##### 6. POST `/ai-opportunities/batch-approve`
Batch approve multiple opportunities
```javascript
POST /ai-opportunities/batch-approve
{
  "opportunityIds": [12345, 12346, 12347],
  "userId": "admin@medici.com",
  "notes": "Batch approval - high confidence group"
}

Response:
{
  "success": true,
  "message": "Approved 3 out of 3 opportunities",
  "approved": 3,
  "total": 3
}
```

---

## 📊 AI Scoring System

### Priority Score Calculation (0-100)
```javascript
Priority = (40% × Confidence) + (30% × Margin) + (20% × Profit) + (10% × Urgency)

Example:
- Confidence: 85% → 34 points (40% weight)
- Margin: 25% → 15 points (30% weight, max 50%)
- Profit: €150 → 6 points (20% weight, max €500)
- Urgency: 14 days → 8 points (10% weight, sweet spot 7-30 days)
Total: 63/100
```

### Risk Assessment
```javascript
if (confidence >= 0.85 && margin >= 0.25) {
  risk = 'LOW'
  confidenceBoost = +5%
} else if (confidence < 0.75 || margin < 0.18) {
  risk = 'HIGH'
  confidencePenalty = -10%
} else {
  risk = 'MEDIUM'
  confidenceBoost = 0%
}
```

### Auto-Approval Logic
```javascript
if (confidence >= 0.85 && margin >= 0.20 && profit >= 50) {
  autoApprove = true
  autoActivate = true
  CreatedBy = 'AI_AUTO'
}
```

---

## 🗄️ Database Schema

### New Columns in MED_Opportunities
```sql
ALTER TABLE [MED_ֹOֹֹpportunities]
ADD
  AIGenerated BIT DEFAULT 0,
  AIConfidence DECIMAL(5,4) NULL,
  AIPriorityScore DECIMAL(5,2) NULL,
  AIRiskLevel NVARCHAR(20) NULL,
  CreatedBy NVARCHAR(100) DEFAULT 'MANUAL';

-- Example values:
-- AIGenerated: 1 (true)
-- AIConfidence: 0.8567 (85.67%)
-- AIPriorityScore: 78.50 (78.5/100)
-- AIRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
-- CreatedBy: 'AI_AUTO' | 'AI_MANUAL' | 'MANUAL' | 'admin@medici.com'
```

### MED_OpportunityLogs Actions
```sql
-- New action types:
'AI_CREATED'   -- Opportunity created by AI scanner
'AI_APPROVED'  -- Manually approved AI opportunity
'AI_REJECTED'  -- Rejected AI opportunity
'AI_SCANNED'   -- Market scan performed

-- Example log:
INSERT INTO MED_OpportunityLogs (OpportunityId, Action, Details, CreatedAt)
VALUES (12345, 'AI_CREATED', '{"confidence":0.85,"priority":78,"autoActivate":true}', GETDATE())
```

---

## 🔧 Configuration & Deployment

### PM2 Configuration
```javascript
// ecosystem.config.js - Added:
{
  name: 'ai-opportunity-scanner',
  script: './workers/ai-opportunity-scanner.js',
  cron_restart: '0 */4 * * *',  // Every 4 hours
  autorestart: false,
  max_memory_restart: '300M'
}
```

### NPM Scripts
```json
{
  "worker:aiscanner": "node workers/ai-opportunity-scanner.js"
}
```

### Server Routes
```javascript
// server.js - Added:
const aiOpportunitiesRoutes = require('./routes/ai-opportunities');
app.use('/ai-opportunities', aiOpportunitiesRoutes);
```

---

## 🚀 Usage Examples

### Example 1: Manual Market Scan
```bash
curl -X POST http://localhost:5000/ai-opportunities/scan \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Barcelona",
    "daysAhead": 60,
    "riskTolerance": "low",
    "autoCreate": true,
    "maxCreate": 10
  }'
```

### Example 2: View AI Opportunities
```bash
# Get high-confidence opportunities
curl "http://localhost:5000/ai-opportunities?minConfidence=0.80&riskLevel=LOW&limit=20"
```

### Example 3: Approve Opportunity
```bash
curl -X POST http://localhost:5000/ai-opportunities/12345/approve \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "admin@medici.com",
    "notes": "Excellent margin, trusted hotel"
  }'
```

### Example 4: Get AI Performance Stats
```bash
curl "http://localhost:5000/ai-opportunities/stats?days=30"
```

### Example 5: Run Worker Manually
```bash
npm run worker:aiscanner
```

---

## 📈 Expected Performance

### Opportunity Discovery
- **Scan Time:** ~2-4 seconds per hotel
- **Total Scan:** ~60-90 seconds for 20 hotels
- **Opportunities Found:** 30-60 per scan (avg 2-3 per hotel)
- **Auto-Created:** 10-20 per scan (high confidence only)

### Approval Rates
- **Auto-Approve:** ~30% (85%+ confidence)
- **Manual Review:** ~50% (75-84% confidence)
- **Auto-Reject:** ~20% (<75% confidence or business rules)

### Conversion Rates (Expected)
- **Low Risk (85%+):** 60-70% conversion to sales
- **Medium Risk (75-84%):** 40-50% conversion
- **High Risk (<75%):** 20-30% conversion

---

## ✅ Testing Checklist

### Unit Tests
- [x] AI Discovery Service - scanMarket()
- [x] AI Discovery Service - validateOpportunity()
- [x] AI Discovery Service - enrichOpportunity()
- [x] AI Discovery Service - createOpportunity()
- [x] AI Discovery Service - batchCreateOpportunities()

### Integration Tests
- [x] Scanner Worker - getHotelsToScan()
- [x] Scanner Worker - scanHotel()
- [x] Scanner Worker - ensureAIColumns()
- [x] Scanner Worker - runWorker()

### API Tests
- [x] POST /ai-opportunities/scan
- [x] GET /ai-opportunities
- [x] POST /ai-opportunities/:id/approve
- [x] POST /ai-opportunities/:id/reject
- [x] GET /ai-opportunities/stats
- [x] POST /ai-opportunities/batch-approve

### End-to-End Tests
- [x] AI scanner discovers opportunities
- [x] High-confidence opportunities auto-activated
- [x] Manual approval workflow
- [x] Slack notifications sent
- [x] Stats reflect real data

---

## 🔍 Monitoring & Alerts

### Worker Logs
```bash
# View AI scanner logs
pm2 logs ai-opportunity-scanner

# View last run
tail -f logs/ai-scanner-out.log

# View errors
tail -f logs/ai-scanner-error.log
```

### Health Monitoring
```bash
# Check worker status
curl http://localhost:5000/health/workers

# Check AI discovery service health
curl http://localhost:5000/health/services
```

### Slack Notifications
Every successful scan sends notification to `#medici-opportunities`:
```
🤖 AI Market Scan Complete

📊 Results:
• Scanned 20 hotels
• Found 45 opportunities
• ✅ Created 12 new opportunities

🏨 Top 5 Hotels: ...
```

---

## 🎯 Next Steps (Phase 3.2)

### Smart Price Calculation Engine
1. **Dynamic Pricing Service**
   - Historical price analysis
   - Competitor price monitoring
   - Demand-based pricing
   - Margin optimization

2. **Integration with AI Discovery**
   - Auto-calculate optimal buy/sell prices
   - Real-time price adjustments
   - Risk-adjusted pricing

3. **Price Strategy API**
   - Multiple pricing strategies (aggressive, balanced, conservative)
   - A/B testing framework
   - Performance tracking

### Estimated Time: 6 hours

---

## 📝 Documentation Updates

### API Documentation
- Added AI Opportunities endpoints to Swagger
- Updated opportunity model with AI fields
- Added examples for all new endpoints

### System Architecture
- Updated architecture diagram with AI → Actions flow
- Documented scoring algorithms
- Added decision trees for auto-approval

### User Guide
- How to review AI opportunities
- Understanding confidence scores
- Approval workflow best practices

---

## ✨ Key Achievements

1. ✅ **Automated Discovery:** System now finds opportunities automatically every 4 hours
2. ✅ **Intelligent Scoring:** 4-factor weighted priority system (confidence, margin, profit, urgency)
3. ✅ **Risk Assessment:** LOW/MEDIUM/HIGH risk classification with confidence adjustments
4. ✅ **Auto-Approval:** High-confidence opportunities (85%+) auto-activate
5. ✅ **Full API:** Complete CRUD + approval workflow
6. ✅ **Statistics:** Real-time performance tracking and reporting
7. ✅ **Safety Limits:** Max 200 opportunities per scan (20 hotels × 10 each)
8. ✅ **Migration Safe:** Auto-adds database columns if missing

---

## 🔐 Security & Safety

### Rate Limiting
- Scan endpoint: 10 requests per hour
- Approval endpoint: 100 requests per hour
- Batch operations: 20 opportunities max

### Validation
- All inputs sanitized
- SQL injection protection
- Duplicate detection
- Business rule enforcement

### Audit Trail
- All AI actions logged to MED_OpportunityLogs
- Includes userId, timestamp, confidence, priority
- Full traceability for compliance

---

## 📊 Performance Metrics

### Target KPIs
- **Discovery Rate:** 30+ opportunities per scan
- **Creation Rate:** 10-20 auto-created per scan
- **False Positive Rate:** <20%
- **Conversion Rate:** >50% for high-confidence opportunities
- **System Load:** <300MB memory, <5% CPU during scan
- **API Response Time:** <500ms for all endpoints

### Monitoring Dashboard
Available at: `/ai-opportunities/stats`
- Total created vs sold
- Confidence distribution
- Risk level performance
- Revenue and profit tracking
- Conversion rates by confidence tier

---

**Phase 3.1 Status:** ✅ COMPLETE (4 hours actual vs 8 hours estimated)

**Ready for Phase 3.2:** Smart Price Calculation Engine
