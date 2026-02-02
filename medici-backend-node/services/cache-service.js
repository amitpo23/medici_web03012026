/**
 * Redis Cache Service
 * Provides caching layer for search results and frequent queries
 * Improves performance and reduces API calls to suppliers
 */

const redis = require('redis');
const logger = require('../config/logger');

class CacheService {
  constructor() {
    this.enabled = process.env.REDIS_ENABLED === 'true';
    this.client = null;
    this.connected = false;
    this.defaultTTL = parseInt(process.env.REDIS_TTL || '300'); // 5 minutes default

    if (this.enabled) {
      this.init();
    } else {
      logger.info('[Cache] Redis disabled - using in-memory fallback');
      this.memoryCache = new Map();
    }
  }

  /**
   * Initialize Redis connection
   */
  async init() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('[Cache] Redis reconnection attempts exhausted');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('[Cache] Redis error:', { error: err.message });
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('[Cache] Redis connected');
        this.connected = true;
      });

      this.client.on('ready', () => {
        logger.info('[Cache] Redis ready');
      });

      this.client.on('reconnecting', () => {
        logger.warn('[Cache] Redis reconnecting...');
      });

      await this.client.connect();
    } catch (error) {
      logger.error('[Cache] Failed to initialize Redis:', { error: error.message });
      this.enabled = false;
      this.memoryCache = new Map();
    }
  }

  /**
   * Generate cache key
   */
  generateKey(prefix, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      if (this.enabled && this.connected) {
        const value = await this.client.get(key);
        if (value) {
          logger.debug('[Cache] Hit:', { key });
          return JSON.parse(value);
        }
        logger.debug('[Cache] Miss:', { key });
        return null;
      } else {
        // Fallback to memory cache
        const cached = this.memoryCache.get(key);
        if (cached && cached.expiry > Date.now()) {
          logger.debug('[Cache] Memory hit:', { key });
          return cached.value;
        }
        logger.debug('[Cache] Memory miss:', { key });
        return null;
      }
    } catch (error) {
      logger.error('[Cache] Get error:', { error: error.message, key });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      if (this.enabled && this.connected) {
        await this.client.setEx(key, ttl, JSON.stringify(value));
        logger.debug('[Cache] Set:', { key, ttl });
      } else {
        // Fallback to memory cache
        this.memoryCache.set(key, {
          value,
          expiry: Date.now() + (ttl * 1000)
        });
        logger.debug('[Cache] Memory set:', { key, ttl });
      }
      return true;
    } catch (error) {
      logger.error('[Cache] Set error:', { error: error.message, key });
      return false;
    }
  }

  /**
   * Delete from cache
   */
  async delete(key) {
    try {
      if (this.enabled && this.connected) {
        await this.client.del(key);
        logger.debug('[Cache] Deleted:', { key });
      } else {
        this.memoryCache.delete(key);
        logger.debug('[Cache] Memory deleted:', { key });
      }
      return true;
    } catch (error) {
      logger.error('[Cache] Delete error:', { error: error.message, key });
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern) {
    try {
      if (this.enabled && this.connected) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
          logger.info('[Cache] Deleted pattern:', { pattern, count: keys.length });
        }
      } else {
        // Memory cache pattern deletion
        const keysToDelete = [];
        for (const [key] of this.memoryCache) {
          if (key.includes(pattern.replace('*', ''))) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => this.memoryCache.delete(key));
        logger.info('[Cache] Memory deleted pattern:', { pattern, count: keysToDelete.length });
      }
      return true;
    } catch (error) {
      logger.error('[Cache] Delete pattern error:', { error: error.message, pattern });
      return false;
    }
  }

  /**
   * Cache search results
   */
  async cacheSearch(params, results, ttl = 300) {
    const key = this.generateKey('search', params);
    return await this.set(key, results, ttl);
  }

  /**
   * Get cached search results
   */
  async getCachedSearch(params) {
    const key = this.generateKey('search', params);
    return await this.get(key);
  }

  /**
   * Invalidate search cache for a hotel
   */
  async invalidateHotelSearches(hotelId) {
    const pattern = `search:*hotelId:${hotelId}*`;
    return await this.deletePattern(pattern);
  }

  /**
   * Cache hotel details
   */
  async cacheHotel(hotelId, data, ttl = 3600) {
    const key = `hotel:${hotelId}`;
    return await this.set(key, data, ttl);
  }

  /**
   * Get cached hotel details
   */
  async getCachedHotel(hotelId) {
    const key = `hotel:${hotelId}`;
    return await this.get(key);
  }

  /**
   * Clear all cache
   */
  async clear() {
    try {
      if (this.enabled && this.connected) {
        await this.client.flushDb();
        logger.info('[Cache] All cache cleared (Redis)');
      } else {
        this.memoryCache.clear();
        logger.info('[Cache] All cache cleared (Memory)');
      }
      return true;
    } catch (error) {
      logger.error('[Cache] Clear error:', { error: error.message });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      if (this.enabled && this.connected) {
        const info = await this.client.info('stats');
        return {
          enabled: true,
          type: 'redis',
          connected: this.connected,
          info: info
        };
      } else {
        return {
          enabled: false,
          type: 'memory',
          size: this.memoryCache.size,
          keys: Array.from(this.memoryCache.keys())
        };
      }
    } catch (error) {
      logger.error('[Cache] Stats error:', { error: error.message });
      return {
        enabled: this.enabled,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Close connection
   */
  async close() {
    if (this.client && this.connected) {
      await this.client.quit();
      logger.info('[Cache] Redis connection closed');
    }
  }

  /**
   * Clean up expired memory cache entries
   */
  cleanupMemoryCache() {
    if (!this.enabled) {
      const now = Date.now();
      for (const [key, cached] of this.memoryCache) {
        if (cached.expiry <= now) {
          this.memoryCache.delete(key);
        }
      }
    }
  }
}

// Singleton instance
let cacheInstance = null;

module.exports = {
  getCacheService: () => {
    if (!cacheInstance) {
      cacheInstance = new CacheService();
      
      // Cleanup memory cache every 5 minutes
      setInterval(() => {
        cacheInstance.cleanupMemoryCache();
      }, 5 * 60 * 1000);
    }
    return cacheInstance;
  },
  CacheService
};
