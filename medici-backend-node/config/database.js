const sql = require('mssql');
require('dotenv').config();
const logger = require('./logger');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  connectionTimeout: 10000,
  requestTimeout: 30000
};

let pool = null;
let poolPromise = null;

/**
 * Get database connection pool using singleton promise pattern.
 * Prevents race condition where multiple concurrent calls could create duplicate pools.
 */
async function getPool() {
  if (pool && pool.connected) {
    return pool;
  }

  // If a connection is already in progress, wait for it
  if (poolPromise) {
    return poolPromise;
  }

  poolPromise = sql.connect(config)
    .then((connectedPool) => {
      pool = connectedPool;
      logger.info('Connected to Azure SQL Database');

      // Handle pool errors to allow reconnection
      pool.on('error', (err) => {
        logger.error('Database pool error', { error: err.message });
        pool = null;
        poolPromise = null;
      });

      return pool;
    })
    .catch((err) => {
      logger.error('Database connection failed', { error: err.message });
      poolPromise = null;
      throw err;
    });

  return poolPromise;
}

module.exports = { sql, getPool, config };
