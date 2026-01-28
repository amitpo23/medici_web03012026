/**
 * Pinecone Vector Database Service
 * Manages vector storage and semantic search
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const logger = require('../config/logger');

class PineconeService {
  constructor() {
    this.apiKey = process.env.PINECONE_API_KEY;
    this.environment = process.env.PINECONE_ENVIRONMENT;
    this.indexName = process.env.PINECONE_INDEX || 'medici-hotels';
    this.client = null;
    this.index = null;
    this.initialized = false;
  }

  /**
   * Initialize Pinecone client
   */
  async initialize() {
    try {
      if (!this.apiKey) {
        throw new Error('Pinecone API key not configured');
      }

      this.client = new Pinecone({
        apiKey: this.apiKey
      });

      // Get or create index
      const indexList = await this.client.listIndexes();
      const indexExists = indexList.indexes?.some(idx => idx.name === this.indexName);

      if (!indexExists) {
        logger.warn(`Pinecone index '${this.indexName}' does not exist. Create it manually in Pinecone dashboard.`);
        // Note: Index creation requires dimension specification and is best done via dashboard
      } else {
        this.index = this.client.index(this.indexName);
      }

      this.initialized = true;
      logger.info('✅ Pinecone Service initialized', {
        indexName: this.indexName,
        indexExists
      });

    } catch (error) {
      logger.error('Failed to initialize Pinecone', { error: error.message });
      throw error;
    }
  }

  /**
   * Ensure client is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Upsert vectors to Pinecone
   * @param {Array} vectors - Array of {id, values, metadata}
   */
  async upsert(vectors) {
    await this.ensureInitialized();

    try {
      if (!this.index) {
        throw new Error('Pinecone index not available');
      }

      logger.debug('Upserting vectors to Pinecone', { count: vectors.length });

      const response = await this.index.upsert(vectors);

      logger.info('Vectors upserted successfully', {
        count: vectors.length,
        upsertedCount: response.upsertedCount
      });

      return response;

    } catch (error) {
      logger.error('Pinecone upsert error', { error: error.message });
      throw error;
    }
  }

  /**
   * Query vectors by similarity
   * @param {Array} queryVector - Vector to search for
   * @param {Number} topK - Number of results to return
   * @param {Object} filter - Metadata filter
   */
  async query(queryVector, topK = 10, filter = null) {
    await this.ensureInitialized();

    try {
      if (!this.index) {
        throw new Error('Pinecone index not available');
      }

      const queryOptions = {
        vector: queryVector,
        topK,
        includeMetadata: true,
        includeValues: false
      };

      if (filter) {
        queryOptions.filter = filter;
      }

      logger.debug('Querying Pinecone', { topK, hasFilter: !!filter });

      const response = await this.index.query(queryOptions);

      logger.info('Pinecone query completed', {
        matches: response.matches?.length || 0
      });

      return response.matches || [];

    } catch (error) {
      logger.error('Pinecone query error', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete vectors by ID
   * @param {Array} ids - Vector IDs to delete
   */
  async delete(ids) {
    await this.ensureInitialized();

    try {
      if (!this.index) {
        throw new Error('Pinecone index not available');
      }

      await this.index.deleteMany(ids);

      logger.info('Vectors deleted', { count: ids.length });

    } catch (error) {
      logger.error('Pinecone delete error', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete all vectors (use with caution!)
   */
  async deleteAll() {
    await this.ensureInitialized();

    try {
      if (!this.index) {
        throw new Error('Pinecone index not available');
      }

      await this.index.deleteAll();

      logger.warn('All vectors deleted from index', { indexName: this.indexName });

    } catch (error) {
      logger.error('Pinecone deleteAll error', { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch vectors by ID
   * @param {Array} ids - Vector IDs to fetch
   */
  async fetch(ids) {
    await this.ensureInitialized();

    try {
      if (!this.index) {
        throw new Error('Pinecone index not available');
      }

      const response = await this.index.fetch(ids);

      return response.records || {};

    } catch (error) {
      logger.error('Pinecone fetch error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getStats() {
    await this.ensureInitialized();

    try {
      if (!this.index) {
        throw new Error('Pinecone index not available');
      }

      const stats = await this.index.describeIndexStats();

      return {
        totalVectors: stats.totalRecordCount || 0,
        dimension: stats.dimension || 0,
        indexFullness: stats.indexFullness || 0,
        namespaces: stats.namespaces || {}
      };

    } catch (error) {
      logger.error('Pinecone stats error', { error: error.message });
      throw error;
    }
  }

  /**
   * Batch upsert with automatic chunking
   * @param {Array} vectors - Large array of vectors
   * @param {Number} batchSize - Vectors per batch
   */
  async batchUpsert(vectors, batchSize = 100) {
    await this.ensureInitialized();

    const batches = [];
    for (let i = 0; i < vectors.length; i += batchSize) {
      batches.push(vectors.slice(i, i + batchSize));
    }

    logger.info('Starting batch upsert', {
      totalVectors: vectors.length,
      batches: batches.length,
      batchSize
    });

    const results = [];
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const result = await this.upsert(batch);
      results.push(result);
      
      logger.debug(`Batch ${i + 1}/${batches.length} completed`);
    }

    logger.info('Batch upsert completed', {
      totalBatches: batches.length,
      totalVectors: vectors.length
    });

    return results;
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new PineconeService();
    }
    return instance;
  },
  PineconeService
};
