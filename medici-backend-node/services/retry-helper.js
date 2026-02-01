/**
 * Retry Helper - Exponential backoff retry logic
 */

const logger = require('../config/logger');

/**
 * Execute a function with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {string} options.operationName - Name for logging
 * @returns {Promise} - Result of the function
 */
async function withRetry(fn, options = {}) {
  const { maxRetries = 3, baseDelay = 1000, operationName = 'operation' } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(`${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`, {
          error: error.message,
          attempt: attempt + 1
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(`${operationName} failed after ${maxRetries + 1} attempts`, {
    error: lastError.message
  });
  throw lastError;
}

/**
 * Run async tasks with a concurrency limit
 * @param {Array} items - Items to process
 * @param {Function} fn - Async function to run for each item
 * @param {number} concurrency - Max concurrent operations (default: 5)
 * @returns {Promise<Array>} - Results
 */
async function withConcurrencyLimit(items, fn, concurrency = 5) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const p = fn(item).then(result => {
      executing.delete(p);
      return result;
    }).catch(err => {
      executing.delete(p);
      return { error: err.message };
    });

    executing.add(p);
    results.push(p);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.all(results);
}

module.exports = { withRetry, withConcurrencyLimit };
