/**
 * AI Database Chat Service
 * Allows natural language queries to the database using Azure OpenAI
 */

const { getPool } = require('../config/database');
const { getInstance: getOpenAI } = require('./azure-openai-service');
const competitorScraper = require('./competitor-scraper');
const logger = require('../config/logger');

class AIDBChatService {
  constructor() {
    this.openai = null;
    this.schemaCache = null;
    this.schemaCacheTime = 0;
    this.SCHEMA_CACHE_TTL = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Get database schema information
   */
  async getDatabaseSchema() {
    // Return cached schema if fresh
    if (this.schemaCache && (Date.now() - this.schemaCacheTime) < this.SCHEMA_CACHE_TTL) {
      return this.schemaCache;
    }

    const pool = await getPool();

    const tables = await pool.request().query(`
      SELECT
        t.TABLE_NAME,
        STRING_AGG(
          CONCAT(c.COLUMN_NAME, ' (', c.DATA_TYPE,
                 CASE WHEN c.IS_NULLABLE = 'NO' THEN ', NOT NULL' ELSE '' END, ')'),
          ', '
        ) as COLUMNS
      FROM INFORMATION_SCHEMA.TABLES t
      LEFT JOIN INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME
      WHERE t.TABLE_SCHEMA = 'dbo'
      AND t.TABLE_TYPE = 'BASE TABLE'
      AND (t.TABLE_NAME LIKE 'Med_%' OR t.TABLE_NAME LIKE 'MED_%')
      GROUP BY t.TABLE_NAME
      ORDER BY t.TABLE_NAME
    `);

    this.schemaCache = tables.recordset;
    this.schemaCacheTime = Date.now();
    return tables.recordset;
  }

  /**
   * Initialize Azure OpenAI if available
   */
  async getOpenAIService() {
    if (this.openai) return this.openai;

    try {
      this.openai = getOpenAI();
      await this.openai.ensureInitialized();
      return this.openai;
    } catch (error) {
      logger.warn('Azure OpenAI not available, falling back to pattern matching', { error: error.message });
      this.openai = null;
      return null;
    }
  }

  /**
   * Convert natural language question to SQL using Azure OpenAI GPT-4
   */
  async convertQuestionToSQLWithAI(question, schema, conversationHistory = []) {
    const openai = await this.getOpenAIService();
    if (!openai) {
      // Fallback to pattern matching
      return this.convertQuestionToSQLFallback(question);
    }

    const schemaText = schema.map(t =>
      `${t.TABLE_NAME}: ${t.COLUMNS}`
    ).join('\n');

    const systemPrompt = `You are an expert SQL Server developer for a hotel booking system. Convert natural language questions to T-SQL queries.

Database Schema:
${schemaText}

Important table notes:
- MED_Book: Main bookings table. price = cost price, lastPrice = sell/push price. Profit = lastPrice - price. IsSold=1 means sold, IsActive=1 means active.
- Med_Reservation: Incoming reservations from Zenith OTA. AmountAfterTax = revenue. IsCanceled=0 means active.
- Med_Hotels: Hotel master data. HotelId links to MED_Book.HotelId and opportunities.DestinationsId.
- The opportunities table has Hebrew characters in its name, use: [MED_ֹOֹֹpportunities]. OpportunityId is the PK. IsActive=1 means active. Price = buy price, PushPrice = sell price.
- MED_Board: Meal plans (BoardId, BoardCode).
- MED_RoomCategory: Room types (CategoryId, Name, PMS_Code).
- Med_CustomersReservation: Customer details linked by ReservationId.
- AI_Search_HotelData: **SEARCH INTENT DATA (ACTIVE)** - Contains 8.3M search records showing what customers are searching for (NOT bookings). Columns: Id, HotelId, HotelName, CityName, StayFrom, StayTo, CountryCode, PriceAmount, PriceAmountCurrency, CancellationType, RoomType, UpdatedAt, PollLogId, Board, Stars. Use this for demand analysis, search volume trends, popular destinations, and price intelligence. Top cities: Amsterdam (41%), Dubai (26%). Top hotel: Kimpton De Witt Amsterdam (40% of all searches). Active data from Aug 2024 - Jan 2026.
- MED_SearchHotels: **HISTORICAL SEARCH DATA (ARCHIVE)** - Contains 6.9M search records from 2020-2023 showing customer behavior during COVID and post-pandemic periods. Columns: RequestTime, DateForm, DateTo, NumberOfNights, SourceHotelId, HotelId, CategoryId, BeddingId, BoardId, PaxAdultsCount, PaxChildrenCount, Price, CurrencyId, providerId, providerName, CancellationType (20 columns). Providers: InnstantTravel (97%), GoGlobal (2.5%). Use this for historical trend analysis, year-over-year comparisons, and learning from past customer behavior. Data period: Jan 2020 - Apr 2023.

Rules:
- Return ONLY the SQL query, no explanations or markdown
- Only SELECT queries are allowed (no INSERT/UPDATE/DELETE)
- Handle questions in both Hebrew and English
- Use proper JOINs when combining tables
- Add TOP 100 to prevent huge result sets unless specifically asked
- Use ISNULL for nullable columns in calculations
- Format dates with CONVERT for readable output
- Always use square brackets for the opportunities table: [MED_ֹOֹֹpportunities]
- When asked about "searches", "demand", "popular destinations", or "price trends" — use AI_Search_HotelData table`;

    // Build conversation context
    const messages = [];

    // Add recent conversation for context
    if (conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-4)) {
        if (msg.role === 'user') {
          messages.push({ role: 'user', content: msg.content });
        } else if (msg.sqlQuery) {
          messages.push({ role: 'assistant', content: `SQL: ${msg.sqlQuery}` });
        }
      }
    }

    const result = await openai.smartChat(question, systemPrompt, messages);

    // Clean the response — remove markdown code blocks if present
    let sql = result.message
      .replace(/```sql\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    logger.info('Azure OpenAI generated SQL', {
      question: question.substring(0, 100),
      sql: sql.substring(0, 200),
      tokens: result.usage?.totalTokens
    });

    return sql;
  }

  /**
   * Fallback: regex pattern matching when Azure OpenAI is unavailable
   */
  convertQuestionToSQLFallback(question) {
    const q = question.toLowerCase();

    const patterns = {
      count: /(?:כמה|how many|count|מספר)/i,
      sum: /(?:סכום|total|sum|סה"כ|סהכ|מה|what)/i,
      average: /(?:ממוצע|average|avg)/i,
      hotels: /(?:מלונות|hotels?|hotel)/i,
      bookings: /(?:הזמנות|bookings?|reservations?)/i,
      opportunities: /(?:הזדמנויות|opportunities)/i,
      searches: /(?:חיפושים|סריקות|searches?|search|demand|ביקוש)/i,
      price: /(?:מחיר|price|revenue|הכנסה|הכנסות)/i,
      profit: /(?:רווח|profit|margin)/i,
      today: /(?:היום|today)/i,
      month: /(?:חודש|month|חודשי)/i,
      top: /(?:מובילים|top|הכי|best)/i,
      cities: /(?:ערים|יעדים|cities|destinations)/i
    };

    if (patterns.count.test(q) && patterns.bookings.test(q)) {
      let sql = `SELECT COUNT(*) as Total FROM MED_Book WHERE IsActive = 1`;
      if (patterns.today.test(q)) {
        sql += ` AND CAST(DateInsert AS DATE) = CAST(GETDATE() AS DATE)`;
      } else if (patterns.month.test(q)) {
        sql += ` AND MONTH(DateInsert) = MONTH(GETDATE()) AND YEAR(DateInsert) = YEAR(GETDATE())`;
      }
      return sql;
    }

    if (patterns.sum.test(q) && patterns.profit.test(q)) {
      return `SELECT SUM(ISNULL(lastPrice, 0) - price) as TotalProfit, AVG(CASE WHEN lastPrice > 0 THEN ((lastPrice - price) / lastPrice * 100) END) as AvgMarginPercent FROM MED_Book WHERE IsActive = 1 AND price > 0`;
    }

    if (patterns.sum.test(q) && patterns.price.test(q)) {
      return `SELECT SUM(ISNULL(lastPrice, price)) as TotalRevenue, COUNT(*) as BookingCount, AVG(price) as AvgPrice FROM MED_Book WHERE IsActive = 1`;
    }

    if (patterns.top.test(q) && patterns.hotels.test(q)) {
      return `SELECT TOP 10 h.name as HotelName, COUNT(b.id) as BookingCount, SUM(b.price) as TotalCost, SUM(ISNULL(b.lastPrice, 0) - b.price) as Profit FROM MED_Book b LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId WHERE b.IsActive = 1 AND b.price > 0 GROUP BY h.name ORDER BY Profit DESC`;
    }

    if (patterns.count.test(q) && patterns.hotels.test(q)) {
      return `SELECT COUNT(*) as TotalHotels FROM Med_Hotels WHERE isActive = 1`;
    }

    if (patterns.count.test(q) && patterns.opportunities.test(q)) {
      return `SELECT COUNT(*) as Total, SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) as Active, SUM(CASE WHEN IsSale = 1 THEN 1 ELSE 0 END) as Sold FROM [MED_ֹOֹֹpportunities]`;
    }

    // Search data queries
    if (patterns.count.test(q) && patterns.searches.test(q)) {
      let sql = `SELECT COUNT(*) as TotalSearches FROM AI_Search_HotelData`;
      if (patterns.today.test(q)) {
        sql += ` WHERE CAST(UpdatedAt AS DATE) = CAST(GETDATE() AS DATE)`;
      } else if (patterns.month.test(q)) {
        sql += ` WHERE MONTH(UpdatedAt) = MONTH(GETDATE()) AND YEAR(UpdatedAt) = YEAR(GETDATE())`;
      }
      return sql;
    }

    if (patterns.top.test(q) && patterns.cities.test(q)) {
      return `SELECT TOP 10 CityName, CountryCode, COUNT(*) as SearchCount, AVG(PriceAmount) as AvgPrice FROM AI_Search_HotelData WHERE CityName IS NOT NULL GROUP BY CityName, CountryCode ORDER BY SearchCount DESC`;
    }

    if (patterns.top.test(q) && patterns.hotels.test(q) && patterns.searches.test(q)) {
      return `SELECT TOP 10 HotelName, CityName, COUNT(*) as SearchCount, AVG(PriceAmount) as AvgPrice FROM AI_Search_HotelData WHERE HotelName IS NOT NULL GROUP BY HotelName, CityName ORDER BY SearchCount DESC`;
    }

    // Historical search queries (MED_SearchHotels)
    if (patterns.searches.test(q) && /(?:2020|2021|2022|2023|עבר|היסטורי|history|historical)/i.test(q)) {
      return `SELECT TOP 10 h.name as HotelName, COUNT(*) as SearchCount, AVG(s.Price) as AvgPrice FROM MED_SearchHotels s LEFT JOIN Med_Hotels h ON s.HotelId = h.HotelId WHERE s.RequestTime >= '2020-01-01' AND s.RequestTime < '2024-01-01' GROUP BY h.name ORDER BY SearchCount DESC`;
    }

    // Default
    return `SELECT 'MED_Book' as TableName, COUNT(*) as RecordCount FROM MED_Book UNION ALL SELECT 'Med_Reservation', COUNT(*) FROM Med_Reservation UNION ALL SELECT 'Med_Hotels', COUNT(*) FROM Med_Hotels WHERE isActive = 1 UNION ALL SELECT 'MED_Board', COUNT(*) FROM MED_Board ORDER BY RecordCount DESC`;
  }

  /**
   * Execute query and return results with explanation
   */
  async askQuestion(question, conversationHistory = []) {
    const startTime = Date.now();
    logger.logAIActivity('question', question, true);

    try {
      // Check if question is about competitor prices (scraping)
      if (this.isCompetitorPriceQuestion(question)) {
        return await this.handleCompetitorPriceQuestion(question);
      }

      const pool = await getPool();

      // Get schema
      const schema = await this.getDatabaseSchema();

      // Convert question to SQL (try AI first, fallback to patterns)
      let sqlQuery;
      let usedAI = false;

      try {
        sqlQuery = await this.convertQuestionToSQLWithAI(question, schema, conversationHistory);
        usedAI = true;
      } catch (aiError) {
        logger.warn('AI SQL generation failed, using fallback', { error: aiError.message });
        sqlQuery = this.convertQuestionToSQLFallback(question);
      }

      // Safety check — only allow SELECT
      const normalized = sqlQuery.trim().toUpperCase();
      if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
        logger.warn('AI generated non-SELECT query, blocking', { sql: sqlQuery.substring(0, 200) });
        sqlQuery = this.convertQuestionToSQLFallback(question);
        usedAI = false;
      }

      // Execute query
      const result = await pool.request().query(sqlQuery);

      const duration = Date.now() - startTime;
      logger.logDBQuery(sqlQuery, duration, result.recordset.length);

      // Generate AI explanation if available
      let answer = this.explainResults(question, result.recordset);
      if (usedAI) {
        try {
          answer = await this.generateAIExplanation(question, result.recordset);
        } catch {
          // Fallback to basic explanation
        }
      }

      return {
        success: true,
        question,
        sqlQuery,
        results: result.recordset,
        rowCount: result.recordset.length,
        answer,
        explanation: answer,
        usedAzureOpenAI: usedAI,
        model: usedAI ? 'gpt-4' : 'pattern-matching'
      };

    } catch (error) {
      logger.error('AI Chat error', {
        question: question.substring(0, 100),
        error: error.message
      });
      return {
        success: false,
        question,
        error: error.message,
        suggestion: 'Try rephrasing your question, or ask "What can I ask?"'
      };
    }
  }

  /**
   * Generate a natural language explanation of query results using GPT-4
   */
  async generateAIExplanation(question, results) {
    const openai = await this.getOpenAIService();
    if (!openai || !results || results.length === 0) {
      return this.explainResults(question, results);
    }

    const dataSnippet = JSON.stringify(results.slice(0, 10), null, 2);

    const systemPrompt = `You are a helpful hotel business analyst. Given a question and SQL query results, provide a clear, concise answer. Use numbers, percentages, and currency (EUR) when relevant. Answer in the same language as the question (Hebrew or English). Keep it to 2-3 sentences.`;

    try {
      const response = await openai.smartChat(
        `Question: ${question}\n\nResults (${results.length} rows):\n${dataSnippet}`,
        systemPrompt
      );
      return response.message;
    } catch {
      return this.explainResults(question, results);
    }
  }

  /**
   * Check if question is about competitor prices
   */
  isCompetitorPriceQuestion(question) {
    const lowerQuestion = question.toLowerCase();
    const competitorKeywords = ['booking.com', 'מתחרה', 'competitor', 'מחיר ב', 'price at'];
    return competitorKeywords.some(keyword => lowerQuestion.includes(keyword));
  }

  /**
   * Handle competitor price scraping questions
   */
  async handleCompetitorPriceQuestion(question) {
    try {
      logger.info('AI Chat detected competitor price question', { question: question.substring(0, 100) });

      const hotelName = this.extractHotelName(question);

      if (!hotelName) {
        return {
          success: false,
          question,
          error: 'Could not identify which hotel to check',
          suggestion: 'Try: "What is the price at Booking.com for David Intercontinental?"'
        };
      }

      const { checkIn, checkOut } = this.extractDates(question);

      const result = await competitorScraper.scrapeBookingCom(hotelName, checkIn, checkOut, 2);

      if (result.success) {
        return {
          success: true,
          question,
          answer: `The price at Booking.com for ${hotelName} is ${result.price} ${result.currency} for ${checkIn} to ${checkOut}`,
          explanation: `The price at Booking.com for ${hotelName} is ${result.price} ${result.currency} for ${checkIn} to ${checkOut}`,
          type: 'competitor-price',
          hotelName,
          results: [{ Hotel: hotelName, Price: result.price, Currency: result.currency, CheckIn: checkIn, CheckOut: checkOut, Source: result.source }]
        };
      }

      return {
        success: false,
        question,
        error: `Could not find price for ${hotelName}`,
        details: result.error
      };

    } catch (error) {
      logger.error('Competitor price question error', { error: error.message });
      return { success: false, question, error: error.message };
    }
  }

  extractHotelName(question) {
    const patterns = [
      /(?:עבור|for|של)\s+([א-תa-z\s]+?)(?:\?|$|ב-|at|in)/i,
      /(דיוויד.*?אינטרקונטיננטל)/i,
      /(david.*?intercontinental)/i,
      /(הילטון)/i, /(hilton)/i,
      /(שרתון)/i, /(sheraton)/i,
      /(דן.*?תל.*?אביב)/i
    ];

    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    if (question.includes('דיוויד') || question.includes('david')) {
      return 'David Intercontinental Tel Aviv';
    }

    return null;
  }

  extractDates(question) {
    const dateMatch = question.match(/(\d{4}-\d{2}-\d{2})/);

    if (dateMatch) {
      const checkIn = dateMatch[1];
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2);
      return { checkIn, checkOut: checkOutDate.toISOString().split('T')[0] };
    }

    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(15);
    const checkOut = new Date(nextMonth);
    checkOut.setDate(checkOut.getDate() + 2);

    return {
      checkIn: nextMonth.toISOString().split('T')[0],
      checkOut: checkOut.toISOString().split('T')[0]
    };
  }

  /**
   * Generate human-readable explanation of results (fallback)
   */
  explainResults(question, results) {
    if (!results || results.length === 0) {
      return 'No results found for this query.';
    }

    const firstRow = results[0];

    if (firstRow.Total !== undefined) {
      return `Found ${firstRow.Total} records.`;
    }
    if (firstRow.TotalRevenue !== undefined) {
      return `Total revenue: EUR ${firstRow.TotalRevenue?.toLocaleString() || 0}, Average: EUR ${firstRow.AvgPrice?.toFixed(2) || 0}, Bookings: ${firstRow.BookingCount || 0}`;
    }
    if (firstRow.TotalProfit !== undefined) {
      return `Total profit: EUR ${firstRow.TotalProfit?.toLocaleString() || 0}, Average margin: ${firstRow.AvgMarginPercent?.toFixed(1) || 0}%`;
    }
    if (firstRow.HotelName !== undefined && results.length > 1) {
      return `Found ${results.length} hotels. Top: ${firstRow.HotelName} with EUR ${firstRow.Profit?.toLocaleString() || firstRow.TotalCost?.toLocaleString() || 0}`;
    }

    return `Found ${results.length} results.`;
  }

  getSuggestedQuestions() {
    return [
      'How many bookings do I have?',
      'What is the total revenue this month?',
      'What is the total profit?',
      'Which hotels are most profitable?',
      'How many opportunities are active?',
      'Show me bookings from the last 7 days',
      'What is the average booking cost?',
      'Top 10 hotels by number of bookings',
      'כמה הזמנות יש לי?',
      'מה סכום ההכנסות החודש?',
      'אילו מלונות הכי רווחיים?'
    ];
  }
}

module.exports = AIDBChatService;
