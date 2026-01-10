const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool = null;

async function getPool() {
  if (pool) {
    return pool;
  }
  
  try {
    pool = await sql.connect(config);
    console.log('✅ Connected to Azure SQL Database');
    return pool;
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    throw err;
  }
}

module.exports = { sql, getPool };
