/**
 * RAG Service (Retrieval-Augmented Generation)
 * Combines vector search with GPT-4 for intelligent answers
 */

const { getInstance: getOpenAI } = require('./azure-openai-service');
const { getInstance: getPinecone } = require('./pinecone-service');
const { getPool } = require('../config/database');
const logger = require('../config/logger');

class RAGService {
  constructor() {
    this.openai = getOpenAI();
    this.pinecone = getPinecone();
    this.initialized = false;
  }

  /**
   * Initialize RAG service
   */
  async initialize() {
    try {
      await this.openai.initialize();
      await this.pinecone.initialize();
      
      this.initialized = true;
      logger.info('✅ RAG Service initialized');

    } catch (error) {
      logger.error('Failed to initialize RAG Service', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure service is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Index document/text into vector database
   * @param {String} id - Unique document ID
   * @param {String} text - Text to index
   * @param {Object} metadata - Additional metadata
   */
  async indexDocument(id, text, metadata = {}) {
    await this.ensureInitialized();

    try {
      // Generate embedding
      const embeddingResult = await this.openai.createEmbeddings(text);
      const embedding = embeddingResult.embedding;

      // Store in Pinecone
      await this.pinecone.upsert([{
        id,
        values: embedding,
        metadata: {
          text,
          ...metadata,
          indexedAt: new Date().toISOString()
        }
      }]);

      logger.info('Document indexed', { id, textLength: text.length });

      return { success: true, id };

    } catch (error) {
      logger.error('Document indexing error', { error: error.message });
      throw error;
    }
  }

  /**
   * Index multiple documents in batch
   * @param {Array} documents - Array of {id, text, metadata}
   */
  async indexDocuments(documents) {
    await this.ensureInitialized();

    try {
      logger.info('Batch indexing documents', { count: documents.length });

      // Generate embeddings for all documents
      const texts = documents.map(doc => doc.text);
      const embeddings = await this.openai.createEmbeddings(texts);

      // Prepare vectors for Pinecone
      const vectors = documents.map((doc, i) => ({
        id: doc.id,
        values: embeddings[i].embedding,
        metadata: {
          text: doc.text,
          ...doc.metadata,
          indexedAt: new Date().toISOString()
        }
      }));

      // Batch upsert to Pinecone
      await this.pinecone.batchUpsert(vectors, 100);

      logger.info('Batch indexing completed', { count: documents.length });

      return { success: true, count: documents.length };

    } catch (error) {
      logger.error('Batch indexing error', { error: error.message });
      throw error;
    }
  }

  /**
   * Search for relevant documents
   * @param {String} query - Search query
   * @param {Number} topK - Number of results
   * @param {Object} filter - Metadata filter
   */
  async search(query, topK = 5, filter = null) {
    await this.ensureInitialized();

    try {
      // Generate query embedding
      const embeddingResult = await this.openai.createEmbeddings(query);
      const queryVector = embeddingResult.embedding;

      // Search in Pinecone
      const results = await this.pinecone.query(queryVector, topK, filter);

      const documents = results.map(result => ({
        id: result.id,
        score: result.score,
        text: result.metadata?.text || '',
        metadata: result.metadata
      }));

      logger.info('Semantic search completed', {
        query: query.substring(0, 50),
        results: documents.length
      });

      return documents;

    } catch (error) {
      logger.error('Search error', { error: error.message });
      throw error;
    }
  }

  /**
   * Ask a question with RAG (main feature!)
   * @param {String} question - User question
   * @param {Object} options - Optional parameters
   */
  async ask(question, options = {}) {
    await this.ensureInitialized();

    try {
      const {
        topK = 5,
        filter = null,
        includeContext = true,
        conversationHistory = []
      } = options;

      logger.info('RAG question received', { question: question.substring(0, 50) });

      // 1. Find relevant documents
      const relevantDocs = await this.search(question, topK, filter);

      // 2. Build context from retrieved documents
      const context = relevantDocs
        .map((doc, i) => `[Document ${i + 1}] (Relevance: ${(doc.score * 100).toFixed(1)}%)\n${doc.text}`)
        .join('\n\n---\n\n');

      // 3. Build prompt with context
      const systemPrompt = `You are an intelligent assistant for Medici Hotels booking system.
Use the following context from the database to answer the user's question accurately.

Context:
${context}

Guidelines:
- Answer based on the provided context
- If the context doesn't contain relevant information, say so
- Be specific and cite information from the context
- Answer in the same language as the question (Hebrew or English)
- For booking-related questions, include relevant hotel names, prices, and dates`;

      // 4. Get GPT-4 answer
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: question }
      ];

      const response = await this.openai.chat(messages);

      // 5. Return comprehensive result
      const result = {
        answer: response.message,
        sources: relevantDocs.map(doc => ({
          id: doc.id,
          relevance: (doc.score * 100).toFixed(1) + '%',
          snippet: doc.text.substring(0, 200) + '...'
        })),
        usage: response.usage
      };

      if (includeContext) {
        result.context = context;
      }

      logger.info('RAG answer generated', {
        answerLength: response.message.length,
        sourcesUsed: relevantDocs.length,
        tokens: response.usage.totalTokens
      });

      return result;

    } catch (error) {
      logger.error('RAG ask error', { error: error.message });
      throw error;
    }
  }

  /**
   * Index hotel data for RAG
   */
  async indexHotelsData() {
    await this.ensureInitialized();

    try {
      const pool = await getPool();

      // Get top hotels with bookings
      const result = await pool.request().query(`
        SELECT TOP 100
          h.id,
          h.HotelName,
          h.Country,
          h.City,
          h.Address,
          COUNT(b.id) as BookingCount,
          AVG(b.price) as AvgPrice,
          MIN(b.startDate) as FirstBooking,
          MAX(b.startDate) as LastBooking
        FROM Med_Hotels h
        LEFT JOIN MED_Book b ON h.id = b.hotelId AND b.IsActive = 1
        WHERE h.isActive = 1
        GROUP BY h.id, h.HotelName, h.Country, h.City, h.Address
        ORDER BY COUNT(b.id) DESC
      `);

      const hotels = result.recordset;

      logger.info('Indexing hotels data', { count: hotels.length });

      // Create documents from hotels
      const documents = hotels.map(hotel => {
        const text = `Hotel: ${hotel.HotelName}
Location: ${hotel.City}, ${hotel.Country}
Address: ${hotel.Address || 'N/A'}
Total Bookings: ${hotel.BookingCount || 0}
Average Price: ${hotel.AvgPrice ? `$${hotel.AvgPrice.toFixed(2)}` : 'N/A'}
Booking Period: ${hotel.FirstBooking ? new Date(hotel.FirstBooking).toLocaleDateString() : 'N/A'} - ${hotel.LastBooking ? new Date(hotel.LastBooking).toLocaleDateString() : 'N/A'}`;

        return {
          id: `hotel-${hotel.id}`,
          text,
          metadata: {
            type: 'hotel',
            hotelId: hotel.id,
            hotelName: hotel.HotelName,
            city: hotel.City,
            country: hotel.Country,
            bookingCount: hotel.BookingCount || 0,
            avgPrice: hotel.AvgPrice || 0
          }
        };
      });

      // Index in batches
      await this.indexDocuments(documents);

      logger.info('Hotels data indexed successfully', { count: hotels.length });

      return { success: true, indexed: hotels.length };

    } catch (error) {
      logger.error('Hotel indexing error', { error: error.message });
      throw error;
    }
  }

  /**
   * Index booking insights for RAG
   */
  async indexBookingInsights() {
    await this.ensureInitialized();

    try {
      const pool = await getPool();

      // Get booking patterns
      const result = await pool.request().query(`
        SELECT TOP 50
          CAST(startDate AS DATE) as BookingDate,
          COUNT(*) as BookingCount,
          SUM(price) as TotalRevenue,
          AVG(price) as AvgPrice,
          COUNT(DISTINCT hotelId) as HotelCount
        FROM MED_Book
        WHERE IsActive = 1 AND Status = 'confirmed'
        GROUP BY CAST(startDate AS DATE)
        ORDER BY BookingDate DESC
      `);

      const insights = result.recordset;

      logger.info('Indexing booking insights', { count: insights.length });

      const documents = insights.map((insight, i) => {
        const text = `Date: ${new Date(insight.BookingDate).toLocaleDateString()}
Bookings: ${insight.BookingCount}
Revenue: $${insight.TotalRevenue.toFixed(2)}
Average Price: $${insight.AvgPrice.toFixed(2)}
Hotels: ${insight.HotelCount} different hotels`;

        return {
          id: `insight-${i}-${insight.BookingDate}`,
          text,
          metadata: {
            type: 'insight',
            date: insight.BookingDate,
            bookingCount: insight.BookingCount,
            revenue: insight.TotalRevenue
          }
        };
      });

      await this.indexDocuments(documents);

      logger.info('Booking insights indexed successfully', { count: insights.length });

      return { success: true, indexed: insights.length };

    } catch (error) {
      logger.error('Insights indexing error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get RAG statistics
   */
  async getStats() {
    await this.ensureInitialized();

    try {
      const pineconeStats = await this.pinecone.getStats();

      return {
        vectorDatabase: {
          totalVectors: pineconeStats.totalVectors,
          dimension: pineconeStats.dimension,
          indexFullness: `${(pineconeStats.indexFullness * 100).toFixed(2)}%`
        },
        services: {
          openai: this.openai.initialized,
          pinecone: this.pinecone.initialized,
          rag: this.initialized
        }
      };

    } catch (error) {
      logger.error('RAG stats error', { error: error.message });
      throw error;
    }
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new RAGService();
    }
    return instance;
  },
  RAGService
};
