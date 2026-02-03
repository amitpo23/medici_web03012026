/**
 * AI Command Center
 * 
 * Unified AI interface for complete system control:
 * - Natural language commands
 * - System status monitoring
 * - Automated decision making
 * - Multi-agent orchestration
 * - Real-time insights
 * - Proactive recommendations
 */

const { getPredictionEngine } = require('./prediction-engine');
const { getAIDiscoveryService } = require('./ai-opportunity-discovery');
const { getSmartPricingService, STRATEGIES } = require('./smart-pricing-service');
const { getPool } = require('../config/database');
const logger = require('../config/logger');
const SlackService = require('./slack-service');

// Command types
const COMMAND_TYPES = {
  QUERY: 'query',           // Information requests
  ACTION: 'action',         // Execute actions
  ANALYSIS: 'analysis',     // Deep analysis
  RECOMMENDATION: 'recommendation', // Get recommendations
  AUTOMATION: 'automation'  // Set up automation
};

// Action types
const ACTIONS = {
  SCAN_MARKET: 'scan_market',
  CREATE_OPPORTUNITY: 'create_opportunity',
  CALCULATE_PRICE: 'calculate_price',
  OPTIMIZE_PRICES: 'optimize_prices',
  APPROVE_OPPORTUNITY: 'approve_opportunity',
  REJECT_OPPORTUNITY: 'reject_opportunity',
  RUN_AB_TEST: 'run_ab_test',
  ANALYZE_PERFORMANCE: 'analyze_performance'
};

class AICommandCenter {
  constructor() {
    this.predictionEngine = getPredictionEngine();
    this.discoveryService = getAIDiscoveryService();
    this.pricingService = getSmartPricingService();
    this.conversationHistory = new Map(); // userId -> messages[]
  }

  /**
   * Process natural language command
   */
  async processCommand(command, context = {}) {
    const { userId = 'system', sessionId = null } = context;

    logger.info('[AI Command Center] Processing command', { 
      command: command.substring(0, 100),
      userId 
    });

    try {
      // Parse command intent
      const intent = await this.parseIntent(command, context);

      // Route to appropriate handler
      let response;
      switch (intent.type) {
        case COMMAND_TYPES.QUERY:
          response = await this.handleQuery(intent, context);
          break;
        case COMMAND_TYPES.ACTION:
          response = await this.handleAction(intent, context);
          break;
        case COMMAND_TYPES.ANALYSIS:
          response = await this.handleAnalysis(intent, context);
          break;
        case COMMAND_TYPES.RECOMMENDATION:
          response = await this.handleRecommendation(intent, context);
          break;
        case COMMAND_TYPES.AUTOMATION:
          response = await this.handleAutomation(intent, context);
          break;
        default:
          response = await this.handleGeneral(command, context);
      }

      // Store in conversation history
      this.addToHistory(userId, { role: 'user', content: command });
      this.addToHistory(userId, { role: 'assistant', content: response });

      return {
        success: true,
        response,
        intent,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[AI Command Center] Command processing error', {
        error: error.message,
        command
      });

      return {
        success: false,
        error: error.message,
        response: 'מצטער, נתקלתי בבעיה בעיבוד הפקודה. אנא נסה שוב.',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Parse user intent from natural language
   */
  async parseIntent(command, context) {
    const lowerCommand = command.toLowerCase();

    // Action detection
    if (this.matchesPattern(lowerCommand, ['סרוק', 'scan', 'חפש הזדמנויות', 'find opportunities'])) {
      return { type: COMMAND_TYPES.ACTION, action: ACTIONS.SCAN_MARKET };
    }

    if (this.matchesPattern(lowerCommand, ['צור הזדמנות', 'create opportunity', 'הוסף הזדמנות'])) {
      return { type: COMMAND_TYPES.ACTION, action: ACTIONS.CREATE_OPPORTUNITY };
    }

    if (this.matchesPattern(lowerCommand, ['חשב מחיר', 'calculate price', 'מה המחיר'])) {
      return { type: COMMAND_TYPES.ACTION, action: ACTIONS.CALCULATE_PRICE };
    }

    if (this.matchesPattern(lowerCommand, ['אופטימיזציה', 'optimize', 'שפר מחירים'])) {
      return { type: COMMAND_TYPES.ACTION, action: ACTIONS.OPTIMIZE_PRICES };
    }

    if (this.matchesPattern(lowerCommand, ['אשר', 'approve', 'אישור'])) {
      return { type: COMMAND_TYPES.ACTION, action: ACTIONS.APPROVE_OPPORTUNITY };
    }

    if (this.matchesPattern(lowerCommand, ['דחה', 'reject', 'ביטול'])) {
      return { type: COMMAND_TYPES.ACTION, action: ACTIONS.REJECT_OPPORTUNITY };
    }

    // Analysis detection
    if (this.matchesPattern(lowerCommand, ['נתח', 'analyze', 'ביצועים', 'performance'])) {
      return { type: COMMAND_TYPES.ANALYSIS, action: ACTIONS.ANALYZE_PERFORMANCE };
    }

    // Query detection
    if (this.matchesPattern(lowerCommand, ['מה', 'what', 'כמה', 'how many', 'show', 'הצג'])) {
      return { type: COMMAND_TYPES.QUERY };
    }

    // Recommendation detection
    if (this.matchesPattern(lowerCommand, ['המלץ', 'recommend', 'מה כדאי', 'what should'])) {
      return { type: COMMAND_TYPES.RECOMMENDATION };
    }

    // Automation detection
    if (this.matchesPattern(lowerCommand, ['הגדר אוטומציה', 'automate', 'כשיהיה', 'when'])) {
      return { type: COMMAND_TYPES.AUTOMATION };
    }

    return { type: COMMAND_TYPES.QUERY };
  }

  /**
   * Handle query commands
   */
  async handleQuery(intent, context) {
    const pool = await getPool();

    // Get system status
    const status = await this.getSystemStatus(pool);

    // Format response
    return this.formatSystemStatus(status);
  }

  /**
   * Handle action commands
   */
  async handleAction(intent, context) {
    switch (intent.action) {
      case ACTIONS.SCAN_MARKET:
        return await this.executeScanMarket(context);

      case ACTIONS.CREATE_OPPORTUNITY:
        return await this.executeCreateOpportunity(context);

      case ACTIONS.CALCULATE_PRICE:
        return await this.executeCalculatePrice(context);

      case ACTIONS.OPTIMIZE_PRICES:
        return await this.executeOptimizePrices(context);

      case ACTIONS.APPROVE_OPPORTUNITY:
        return await this.executeApproveOpportunity(context);

      case ACTIONS.REJECT_OPPORTUNITY:
        return await this.executeRejectOpportunity(context);

      default:
        return 'פעולה לא נתמכת. אנא נסה פקודה אחרת.';
    }
  }

  /**
   * Handle analysis commands
   */
  async handleAnalysis(intent, context) {
    const pool = await getPool();

    // Get comprehensive analysis
    const analysis = await this.performSystemAnalysis(pool);

    return this.formatAnalysis(analysis);
  }

  /**
   * Handle recommendation commands
   */
  async handleRecommendation(intent, context) {
    const pool = await getPool();

    // Get AI recommendations
    const recommendations = await this.generateRecommendations(pool);

    return this.formatRecommendations(recommendations);
  }

  /**
   * Handle automation commands
   */
  async handleAutomation(intent, context) {
    return 'אוטומציות יוגדרו בקרוב. נא לציין את התנאים והפעולות הרצויות.';
  }

  /**
   * Handle general conversation
   */
  async handleGeneral(command, context) {
    // Use conversation history for context
    const history = this.getHistory(context.userId || 'system');

    return 'אני כאן לעזור! אני יכול לסרוק שוק, ליצור הזדמנויות, לחשב מחירים, לנתח ביצועים ועוד. מה תרצה לעשות?';
  }

  /**
   * Execute market scan
   */
  async executeScanMarket(context) {
    try {
      const { hotelId, city, daysAhead = 90 } = context.params || {};

      const result = await this.discoveryService.scanMarket({
        hotelId,
        city,
        daysAhead,
        riskTolerance: 'medium'
      });

      if (!result.success) {
        return `⚠️ סריקת השוק נכשלה: ${result.message}`;
      }

      const highPriority = result.opportunities.filter(o => o.priorityScore >= 80).length;
      const mediumPriority = result.opportunities.filter(o => o.priorityScore >= 60 && o.priorityScore < 80).length;

      return `✅ **סריקת שוק הושלמה**

📊 **תוצאות:**
• סה"כ הזדמנויות: ${result.total}
• עדיפות גבוהה (80+): ${highPriority}
• עדיפות בינונית (60-79): ${mediumPriority}

💰 **הזדמנויות מובילות:**
${result.opportunities.slice(0, 5).map((o, i) => 
  `${i + 1}. ${o.hotelName} | ${o.startDate} | €${o.profit.toFixed(2)} | ${(o.aiConfidence * 100).toFixed(0)}%`
).join('\n')}

רוצה ליצור את ההזדמנויות האלה?`;

    } catch (error) {
      logger.error('[AI Command Center] Market scan error', { error: error.message });
      return `❌ שגיאה בסריקת שוק: ${error.message}`;
    }
  }

  /**
   * Execute create opportunity
   */
  async executeCreateOpportunity(context) {
    try {
      const { opportunityData } = context.params || {};

      if (!opportunityData) {
        return 'אנא ספק פרטי הזדמנות (מלון, תאריכים, מחירים).';
      }

      const result = await this.discoveryService.createOpportunity(opportunityData, {
        autoActivate: opportunityData.autoActivate !== false,
        createdBy: context.userId || 'AI_COMMAND_CENTER'
      });

      if (result.success) {
        return `✅ הזדמנות נוצרה בהצלחה!

📋 **פרטים:**
• ID: ${result.opportunityId}
• מלון: ${opportunityData.hotelName}
• תאריכים: ${opportunityData.startDate} - ${opportunityData.endDate}
• מחיר קנייה: €${opportunityData.suggestedBuyPrice}
• מחיר מכירה: €${opportunityData.suggestedSellPrice}
• רווח צפוי: €${(opportunityData.suggestedSellPrice - opportunityData.suggestedBuyPrice).toFixed(2)}

${result.autoActivated ? '✨ הופעלה אוטומטית!' : '⏳ ממתינה לאישור'}`;
      } else {
        return `⚠️ לא ניתן ליצור הזדמנות: ${result.message}`;
      }

    } catch (error) {
      return `❌ שגיאה ביצירת הזדמנות: ${error.message}`;
    }
  }

  /**
   * Execute price calculation
   */
  async executeCalculatePrice(context) {
    try {
      const { hotelId, checkIn, checkOut, buyPrice, strategy = 'balanced' } = context.params || {};

      if (!hotelId || !checkIn || !checkOut || !buyPrice) {
        return 'אנא ספק: מלון, תאריכי כניסה/יציאה, מחיר קנייה.';
      }

      const pricing = await this.pricingService.calculateOptimalPrice({
        hotelId,
        checkIn,
        checkOut,
        buyPrice
      }, strategy);

      if (!pricing.success) {
        return `⚠️ חישוב מחיר נכשל: ${pricing.error}`;
      }

      return `💰 **מחיר אופטימלי מחושב**

📊 **תוצאות:**
• מחיר קנייה: €${pricing.buyPrice}
• מחיר מכירה מומלץ: €${pricing.recommendedSellPrice}
• רווח: €${pricing.profit.toFixed(2)} (${(pricing.profitMargin * 100).toFixed(1)}%)
• ביטחון: ${(pricing.confidence * 100).toFixed(0)}%
• סיכון: ${pricing.risk}

🏪 **מצב שוק:**
• ביקוש: ${pricing.market.demand.level}
• מתחרים: €${pricing.market.competitors.avg || 0} ממוצע
• עונה: ${pricing.market.seasonal.season}

אסטרטגיה: **${strategy}**`;

    } catch (error) {
      return `❌ שגיאה בחישוב מחיר: ${error.message}`;
    }
  }

  /**
   * Execute price optimization
   */
  async executeOptimizePrices(context) {
    return `🔄 אופטימיזציית מחירים מופעלת...

Worker יפעל אוטומטית כל 2 שעות.
לביצוע מיידי: \`npm run worker:priceoptimization\`

רוצה לראות תוצאות אופטימיזציה אחרונה?`;
  }

  /**
   * Get system status
   */
  async getSystemStatus(pool) {
    try {
      const [opportunities, workers, recent] = await Promise.all([
        // Active opportunities
        pool.request().query(`
          SELECT
            COUNT(*) as Total,
            SUM(CASE WHEN AIGenerated = 1 THEN 1 ELSE 0 END) as AIGenerated,
            SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as Sold,
            AVG(AIConfidence) as AvgConfidence
          FROM [MED_ֹOֹֹpportunities]
          WHERE IsActive = 1
        `),

        // Worker status
        pool.request().query(`
          SELECT TOP 5
            Action,
            CreatedAt,
            Details
          FROM MED_OpportunityLogs
          WHERE Action IN ('AI_CREATED', 'PRICE_OPTIMIZED', 'AI_SCANNED')
          ORDER BY CreatedAt DESC
        `),

        // Recent performance
        pool.request().query(`
          SELECT TOP 1
            ConversionRate,
            AvgMargin,
            TotalProfit,
            AvgConfidence
          FROM MED_PricingPerformance
          WHERE PeriodType = 'DAILY'
          ORDER BY PeriodDate DESC
        `)
      ]);

      return {
        opportunities: opportunities.recordset[0],
        recentActivity: workers.recordset,
        performance: recent.recordset[0] || {}
      };

    } catch (error) {
      logger.error('[AI Command Center] Status error', { error: error.message });
      return { opportunities: {}, recentActivity: [], performance: {} };
    }
  }

  /**
   * Format system status for user
   */
  formatSystemStatus(status) {
    const { opportunities, performance } = status;

    return `📊 **מצב המערכת**

🎯 **הזדמנויות פעילות:**
• סה"כ: ${opportunities.Total || 0}
• נוצרו ע"י AI: ${opportunities.AIGenerated || 0}
• נמכרו: ${opportunities.Sold || 0}
• ביטחון ממוצע: ${((opportunities.AvgConfidence || 0) * 100).toFixed(0)}%

📈 **ביצועים (היום):**
• שיעור המרה: ${((performance.ConversionRate || 0) * 100).toFixed(1)}%
• מרווח ממוצע: ${((performance.AvgMargin || 0) * 100).toFixed(1)}%
• רווח כולל: €${(performance.TotalProfit || 0).toFixed(2)}

✅ המערכת פועלת תקין`;
  }

  /**
   * Perform comprehensive system analysis
   */
  async performSystemAnalysis(pool) {
    try {
      const [strategies, abTests, adjustments] = await Promise.all([
        // Strategy performance
        pool.request().query(`
          SELECT TOP 3
            Strategy,
            AVG(ConversionRate) as AvgConversion,
            SUM(TotalProfit) as TotalProfit
          FROM MED_PricingPerformance
          WHERE Strategy IS NOT NULL
          AND PeriodDate >= DATEADD(DAY, -30, GETDATE())
          GROUP BY Strategy
          ORDER BY TotalProfit DESC
        `),

        // A/B test results
        pool.request().query(`
          SELECT
            COUNT(*) as TotalTests,
            AVG(CAST(DidConvert as FLOAT)) as AvgConversion
          FROM MED_ABTests
          WHERE EndDate >= DATEADD(DAY, -30, GETDATE())
        `),

        // Price adjustments
        pool.request().query(`
          SELECT
            COUNT(*) as TotalAdjustments,
            AVG(ChangePercent) as AvgChange,
            SUM(CASE WHEN IsAutomatic = 1 THEN 1 ELSE 0 END) as Automatic
          FROM MED_PriceAdjustments
          WHERE CreatedAt >= DATEADD(DAY, -30, GETDATE())
        `)
      ]);

      return {
        strategies: strategies.recordset,
        abTests: abTests.recordset[0],
        adjustments: adjustments.recordset[0]
      };

    } catch (error) {
      logger.error('[AI Command Center] Analysis error', { error: error.message });
      return { strategies: [], abTests: {}, adjustments: {} };
    }
  }

  /**
   * Format analysis for user
   */
  formatAnalysis(analysis) {
    const { strategies, abTests, adjustments } = analysis;

    let response = `🔍 **ניתוח מערכת (30 יום אחרונים)**\n\n`;

    response += `💰 **ביצועי אסטרטגיות:**\n`;
    strategies.forEach((s, i) => {
      response += `${i + 1}. ${s.Strategy}: ${(s.AvgConversion * 100).toFixed(1)}% המרה | €${s.TotalProfit.toFixed(0)} רווח\n`;
    });

    response += `\n🧪 **A/B Tests:**\n`;
    response += `• סה"כ: ${abTests.TotalTests || 0}\n`;
    response += `• המרה ממוצעת: ${((abTests.AvgConversion || 0) * 100).toFixed(1)}%\n`;

    response += `\n⚙️ **התאמות מחיר:**\n`;
    response += `• סה"כ: ${adjustments.TotalAdjustments || 0}\n`;
    response += `• אוטומטיות: ${adjustments.Automatic || 0}\n`;
    response += `• שינוי ממוצע: ${((adjustments.AvgChange || 0) * 100).toFixed(1)}%\n`;

    return response;
  }

  /**
   * Generate AI recommendations
   */
  async generateRecommendations(pool) {
    try {
      const recommendations = [];

      // Check for high-confidence opportunities not activated
      const inactive = await pool.request().query(`
        SELECT COUNT(*) as Count
        FROM [MED_ֹOֹֹpportunities]
        WHERE AIGenerated = 1
        AND IsActive = 0
        AND AIConfidence >= 0.85
      `);

      if (inactive.recordset[0].Count > 0) {
        recommendations.push({
          priority: 'HIGH',
          action: 'ACTIVATE_OPPORTUNITIES',
          message: `יש ${inactive.recordset[0].Count} הזדמנויות עם ביטחון גבוה (85%+) שלא הופעלו`,
          command: 'הפעל הזדמנויות בעלות ביטחון גבוה'
        });
      }

      // Check for stale prices
      const stale = await pool.request().query(`
        SELECT COUNT(*) as Count
        FROM [MED_ֹOֹֹpportunities]
        WHERE IsActive = 1
        AND IsSale = 0
        AND Lastupdate < DATEADD(DAY, -7, GETDATE())
      `);

      if (stale.recordset[0].Count > 0) {
        recommendations.push({
          priority: 'MEDIUM',
          action: 'UPDATE_PRICES',
          message: `יש ${stale.recordset[0].Count} הזדמנויות עם מחירים לא מעודכנים (7+ ימים)`,
          command: 'עדכן מחירים ישנים'
        });
      }

      // Check for low conversion opportunities
      const lowConversion = await pool.request().query(`
        SELECT COUNT(*) as Count
        FROM [MED_ֹOֹֹpportunities]
        WHERE AIGenerated = 1
        AND IsActive = 1
        AND IsSale = 0
        AND DATEDIFF(DAY, DateCreate, GETDATE()) > 7
        AND AIConfidence < 0.75
      `);

      if (lowConversion.recordset[0].Count > 0) {
        recommendations.push({
          priority: 'LOW',
          action: 'REVIEW_LOW_CONFIDENCE',
          message: `יש ${lowConversion.recordset[0].Count} הזדמנויות עם ביטחון נמוך שלא נמכרו`,
          command: 'סקור הזדמנויות בעלות ביטחון נמוך'
        });
      }

      return recommendations;

    } catch (error) {
      logger.error('[AI Command Center] Recommendations error', { error: error.message });
      return [];
    }
  }

  /**
   * Format recommendations for user
   */
  formatRecommendations(recommendations) {
    if (recommendations.length === 0) {
      return '✅ אין המלצות כרגע. המערכת פועלת אופטימלית!';
    }

    let response = `💡 **המלצות AI**\n\n`;

    recommendations.forEach((rec, i) => {
      const icon = rec.priority === 'HIGH' ? '🔴' : rec.priority === 'MEDIUM' ? '🟡' : '🟢';
      response += `${icon} **${rec.action}**\n`;
      response += `   ${rec.message}\n`;
      response += `   📝 פקודה: "${rec.command}"\n\n`;
    });

    return response;
  }

  /**
   * Helper: Match command pattern
   */
  matchesPattern(command, patterns) {
    return patterns.some(pattern => command.includes(pattern));
  }

  /**
   * Conversation history management
   */
  addToHistory(userId, message) {
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }
    const history = this.conversationHistory.get(userId);
    history.push({ ...message, timestamp: new Date().toISOString() });
    
    // Keep last 50 messages
    if (history.length > 50) {
      history.shift();
    }
  }

  getHistory(userId) {
    return this.conversationHistory.get(userId) || [];
  }

  clearHistory(userId) {
    this.conversationHistory.delete(userId);
  }
}

// Singleton instance
let instance = null;

function getAICommandCenter() {
  if (!instance) {
    instance = new AICommandCenter();
  }
  return instance;
}

module.exports = {
  getAICommandCenter,
  AICommandCenter,
  COMMAND_TYPES,
  ACTIONS
};
