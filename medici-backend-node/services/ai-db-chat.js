/**
 * AI Database Chat Service
 * Allows natural language queries to the database using AI
 */

const { getPool } = require('../config/database');
const competitorScraper = require('./competitor-scraper');
const logger = require('../config/logger');

class AIDBChatService {
  constructor() {
    this.conversationHistory = [];
  }

  /**
   * Get database schema information
   */
  async getDatabaseSchema() {
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
      AND t.TABLE_NAME LIKE 'Med_%' OR t.TABLE_NAME LIKE 'MED_%'
      GROUP BY t.TABLE_NAME
      ORDER BY t.TABLE_NAME
    `);

    return tables.recordset;
  }

  /**
   * Convert natural language question to SQL query
   */
  convertQuestionToSQL(question, schema) {
    const questionLower = question.toLowerCase();
    
    // Common patterns in Hebrew and English
    const patterns = {
      // כמה, how many, count
      count: /(?:כמה|how many|count|מספר)/i,
      // סכום, total, sum
      sum: /(?:סכום|total|sum|סה"כ|סהכ|מה|what)/i,
      // ממוצע, average
      average: /(?:ממוצע|average|avg)/i,
      // מלונות, hotels
      hotels: /(?:מלונות|hotels?|hotel)/i,
      // הזמנות, bookings, reservations
      bookings: /(?:הזמנות|bookings?|reservations?)/i,
      // הזדמנויות, opportunities
      opportunities: /(?:הזדמנויות|opportunities)/i,
      // מחיר, price, revenue
      price: /(?:מחיר|price|revenue|הכנסה|הכנסות)/i,
      // רווח, profit
      profit: /(?:רווח|profit|margin)/i,
      // היום, today
      today: /(?:היום|today)/i,
      // חודש, month
      month: /(?:חודש|month|חודשי)/i,
      // שנה, year
      year: /(?:שנה|year)/i,
      // מובילים, top
      top: /(?:מובילים|top|הכי|best)/i
    };

    let query = '';

    // Pattern: How many bookings/reservations
    if (patterns.count.test(questionLower) && patterns.bookings.test(questionLower)) {
      query = `
        SELECT COUNT(*) as Total
        FROM MED_Book
        WHERE Status = 'confirmed' AND IsActive = 1
      `;
      if (patterns.today.test(questionLower)) {
        query += ` AND CAST(DateInsert AS DATE) = CAST(GETDATE() AS DATE)`;
      } else if (patterns.month.test(questionLower)) {
        query += ` AND MONTH(DateInsert) = MONTH(GETDATE()) AND YEAR(DateInsert) = YEAR(GETDATE())`;
      }
    }
    
    // Pattern: Total revenue/price
    else if (patterns.sum.test(questionLower) && patterns.price.test(questionLower)) {
      query = `
        SELECT 
          SUM(price) as TotalRevenue,
          COUNT(*) as BookingCount,
          AVG(price) as AvgPrice
        FROM MED_Book
        WHERE Status = 'confirmed' AND IsActive = 1
      `;
      if (patterns.month.test(questionLower)) {
        query += ` AND MONTH(startDate) = MONTH(GETDATE()) AND YEAR(startDate) = YEAR(GETDATE())`;
      }
    }
    
    // Pattern: Total profit
    else if (patterns.sum.test(questionLower) && patterns.profit.test(questionLower)) {
      query = `
        SELECT 
          SUM(price - ISNULL(lastPrice, price)) as TotalProfit,
          AVG((price - ISNULL(lastPrice, price)) / NULLIF(price, 0) * 100) as AvgMarginPercent
        FROM MED_Book
        WHERE Status = 'confirmed' AND IsActive = 1
      `;
      if (patterns.month.test(questionLower)) {
        query += ` AND MONTH(startDate) = MONTH(GETDATE()) AND YEAR(startDate) = YEAR(GETDATE())`;
      }
    }
    
    // Pattern: Top hotels
    else if (patterns.top.test(questionLower) && patterns.hotels.test(questionLower)) {
      query = `
        SELECT TOP 10
          b.HotelId,
          h.name as HotelName,
          COUNT(b.id) as BookingCount,
          SUM(b.price) as Revenue,
          SUM(b.price - ISNULL(b.lastPrice, b.price)) as Profit
        FROM MED_Book b
        LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
        WHERE b.Status = 'confirmed' AND b.IsActive = 1
        AND b.startDate >= DATEADD(DAY, -30, GETDATE())
        GROUP BY b.HotelId, h.name
        ORDER BY Profit DESC
      `;
    }
    
    // Pattern: How many hotels
    else if (patterns.count.test(questionLower) && patterns.hotels.test(questionLower)) {
      query = `
        SELECT COUNT(*) as TotalHotels
        FROM Med_Hotels
        WHERE isActive = 1
      `;
    }
    
    // Pattern: How many reservations (from Zenith)
    else if (patterns.count.test(questionLower) && patterns.opportunities.test(questionLower)) {
      query = `
        SELECT 
          COUNT(*) as TotalReservations
        FROM Med_Reservation
      `;
    }
    
    // Default: Show available tables and columns
    else {
      query = `
        SELECT TOP 100 * FROM (
          SELECT 'MED_Book' as TableName, COUNT(*) as RecordCount FROM MED_Book WHERE IsActive = 1
          UNION ALL
          SELECT 'Med_Reservation', COUNT(*) FROM Med_Reservation
          UNION ALL
          SELECT 'Med_Hotels', COUNT(*) FROM Med_Hotels WHERE isActive = 1
          UNION ALL
          SELECT 'MED_Board', COUNT(*) FROM MED_Board
        ) t
        ORDER BY RecordCount DESC
      `;
    }

    return query.trim();
  }

  /**
   * Execute query and return results with explanation
   */
  async askQuestion(question) {
    const startTime = Date.now();
    logger.logAIActivity('question', question, true);
    
    try {
      // Check if question is about competitor prices (scraping)
      if (this.isCompetitorPriceQuestion(question)) {
        return await this.handleCompetitorPriceQuestion(question);
      }
      
      const pool = await getPool();
      
      // Get schema if needed
      const schema = await this.getDatabaseSchema();
      
      // Convert question to SQL
      const sqlQuery = this.convertQuestionToSQL(question, schema);
      
      // Execute query
      const result = await pool.request().query(sqlQuery);
      
      const duration = Date.now() - startTime;
      logger.logDBQuery(sqlQuery, duration, result.recordset.length);
      
      // Format response
      return {
        success: true,
        question: question,
        sqlQuery: sqlQuery,
        results: result.recordset,
        rowCount: result.recordset.length,
        explanation: this.explainResults(question, result.recordset)
      };
      
    } catch (error) {
      logger.error('AI Chat error', { 
        question: question.substring(0, 100),
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        question: question,
        error: error.message,
        suggestion: 'נסה לנסח את השאלה אחרת, או שאל "מה אני יכול לשאול?"'
      };
    }
  }

  /**
   * Check if question is about competitor prices
   */
  isCompetitorPriceQuestion(question) {
    const lowerQuestion = question.toLowerCase();
    const competitorKeywords = ['booking.com', 'booking', 'מתחרה', 'competitor', 'מחיר ב', 'price at'];
    return competitorKeywords.some(keyword => lowerQuestion.includes(keyword));
  }

  /**
   * Hlogger.info('AI Chat detected competitor price question', { question: question.substring(0, 100) }
   */
  async handleCompetitorPriceQuestion(question) {
    try {
      console.log(`🔍 AI Chat detected competitor price question: ${question}`);
      
      // Extract hotel name from question
      const hotelName = this.extractHotelName(question);
      
      if (!hotelName) {
        return {
          success: false,
          question,
          error: 'לא הצלחתי לזהות איזה מלון לבדוק',
          suggestion: 'נסה לשאול: "מה המחיר ב-Booking.com עבור דיוויד אינטרקונטיננטל?"'
        };
      }
      
      // Use dates from question or default to next weekend
      const { checkIn, checkOut } = this.extractDates(question);
      
      logger.info('Triggering scraper from AI Chat', { hotelName, checkIn, checkOut });
      
      // Scrape Booking.com
      const result = await competitorScraper.scrapeBookingCom(hotelName, checkIn, checkOut, 2);
      
      if (result.success) {
        return {
          success: true,
          question,
          type: 'competitor-price',
          hotelName,
          checkIn,
          checkOut,
          price: result.price,
          currency: result.currency,
          source: result.source,
          scrapedAt: result.scrapedAt,
          url: result.url,
          explanation: `המחיר ב-Booking.com עבור ${hotelName} הוא ${result.price} ${result.currency} לתאריכים ${checkIn} עד ${checkOut}`,
          screenshot: result.screenshot
        };
      } else {
        return {
          success: false,
          question,
          error: `לא הצלחתי למצוא מחיר עבור ${hotelName}`,
          details: result.error
        };
      }
      
    } catch (error) {
      logger.error('Competitor price question error', { 
        question: question.substring(0, 100),
        error: error.message 
      });
      return {
        success: false,
        question,
        error: error.message
      };
    }
  }

  /**
   * Extract hotel name from question
   */
  extractHotelName(question) {
    // Common hotel name patterns
    const patterns = [
      /(?:עבור|for|של)\s+([א-תa-z\s]+?)(?:\?|$|ב-|at|in)/i,
      /(דיוויד.*?אינטרקונטיננטל)/i,
      /(david.*?intercontinental)/i,
      /(הילטון)/i,
      /(hilton)/i,
      /(שרתון)/i,
      /(sheraton)/i,
      /(דן.*?תל.*?אביב)/i
    ];
    
    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Default to David Intercontinental if mentioned
    if (question.includes('דיוויד') || question.includes('david')) {
      return 'David Intercontinental Tel Aviv';
    }
    
    return null;
  }

  /**
   * Extract dates from question or use defaults
   */
  extractDates(question) {
    // Try to find specific dates in question
    const dateMatch = question.match(/(\d{4}-\d{2}-\d{2})/);
    
    if (dateMatch) {
      const checkIn = dateMatch[1];
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkInDate);
      checkOutDate.setDate(checkOutDate.getDate() + 2); // 2 nights
      
      return {
        checkIn,
        checkOut: checkOutDate.toISOString().split('T')[0]
      };
    }
    
    // Default: Next month, 2 nights
    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(15); // Mid-month
    
    const checkOut = new Date(nextMonth);
    checkOut.setDate(checkOut.getDate() + 2);
    
    return {
      checkIn: nextMonth.toISOString().split('T')[0],
      checkOut: checkOut.toISOString().split('T')[0]
    };
  }

  /**
   * Generate human-readable explanation of results
   */
  explainResults(question, results) {
    if (!results || results.length === 0) {
      return 'לא נמצאו תוצאות לשאלה זו.';
    }

    const firstRow = results[0];
    
    // Count queries
    if (firstRow.Total !== undefined) {
      return `נמצאו ${firstRow.Total} רשומות.`;
    }
    
    // Revenue queries
    if (firstRow.TotalRevenue !== undefined) {
      return `סך ההכנסות: €${firstRow.TotalRevenue?.toLocaleString() || 0}, ` +
             `ממוצע: €${firstRow.AvgPrice?.toFixed(2) || 0}, ` +
             `מספר הזמנות: ${firstRow.BookingCount || 0}`;
    }
    
    // Profit queries
    if (firstRow.TotalProfit !== undefined) {
      return `סך הרווח: €${firstRow.TotalProfit?.toLocaleString() || 0}, ` +
             `מרווח ממוצע: ${firstRow.AvgMarginPercent?.toFixed(1) || 0}%`;
    }
    
    // Top hotels
    if (firstRow.HotelName !== undefined && firstRow.Revenue !== undefined) {
      return `נמצאו ${results.length} מלונות. המלון המוביל: ${firstRow.HotelName} ` +
             `עם הכנסה של €${firstRow.Revenue?.toLocaleString() || 0}`;
    }
    
    // Opportunities
    if (firstRow.TotalOpportunities !== undefined) {
      return `סה"כ ${firstRow.TotalOpportunities} הזדמנויות: ` +
             `${firstRow.Active || 0} פעילות, ` +
             `${firstRow.Sold || 0} נמכרו, ` +
             `${firstRow.Cancelled || 0} בוטלו`;
    }
    
    // Generic
    return `נמצאו ${results.length} תוצאות.`;
  }

  /**
   * Get suggested questions
   */
  getSuggestedQuestions() {
    return [
      'כמה הזמנות יש לי?',
      'מה סכום ההכנסות החודש?',
      'מה הרווח הכולל?',
      'אילו מלונות הכי רווחיים?',
      'כמה הזדמנויות יש?',
      'מה המחיר ב-Booking.com עבור דיוויד אינטרקונטיננטל?',
      'How many bookings today?',
      'Total revenue this month?',
      'Top 10 hotels by profit?',
      'What is the price at Booking.com for Hilton Tel Aviv?'
    ];
  }
}

module.exports = AIDBChatService;
