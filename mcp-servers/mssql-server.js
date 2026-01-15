#!/usr/bin/env node
/**
 * 🗄️ MSSQL MCP Server for Medici Booking Engine
 * 
 * יכולות:
 * - שאילתות SQL (SELECT, INSERT, UPDATE, DELETE)
 * - ניתוח נתונים וסטטיסטיקות
 * - תובנות עסקיות אוטומטיות
 * - RAG על סכמת הדאטאבייס
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const sql = require('mssql');
const path = require('path');

// Load environment variables
const envPath = process.env.DOTENV_PATH || path.join(__dirname, '../medici-backend-node/.env');
require('dotenv').config({ path: envPath });

// Database configuration
const dbConfig = {
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
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool = null;

// Get database connection
async function getPool() {
  if (pool) return pool;
  pool = await sql.connect(dbConfig);
  return pool;
}

// Schema cache for RAG
let schemaCache = null;

// Get database schema for RAG
async function getDatabaseSchema() {
  if (schemaCache) return schemaCache;
  
  const pool = await getPool();
  
  // Get all tables
  const tables = await pool.request().query(`
    SELECT 
      t.TABLE_NAME,
      t.TABLE_TYPE,
      (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_NAME = t.TABLE_NAME) as column_count
    FROM INFORMATION_SCHEMA.TABLES t
    WHERE t.TABLE_SCHEMA = 'dbo'
    ORDER BY t.TABLE_NAME
  `);
  
  // Get all columns with types
  const columns = await pool.request().query(`
    SELECT 
      TABLE_NAME,
      COLUMN_NAME,
      DATA_TYPE,
      CHARACTER_MAXIMUM_LENGTH,
      IS_NULLABLE,
      COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  
  // Build schema object
  const schema = {};
  for (const table of tables.recordset) {
    schema[table.TABLE_NAME] = {
      type: table.TABLE_TYPE,
      columns: columns.recordset
        .filter(c => c.TABLE_NAME === table.TABLE_NAME)
        .map(c => ({
          name: c.COLUMN_NAME,
          type: c.DATA_TYPE,
          maxLength: c.CHARACTER_MAXIMUM_LENGTH,
          nullable: c.IS_NULLABLE === 'YES',
          default: c.COLUMN_DEFAULT
        }))
    };
  }
  
  schemaCache = schema;
  return schema;
}

// Execute SQL query safely
async function executeQuery(query, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  
  // Add parameters
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  
  const result = await request.query(query);
  return {
    recordset: result.recordset,
    rowsAffected: result.rowsAffected,
    columns: result.recordset.columns
  };
}

// Business insights generator
async function generateInsights(category = 'all') {
  const pool = await getPool();
  const insights = [];
  
  if (category === 'all' || category === 'bookings') {
    // Booking statistics
    const bookingStats = await pool.request().query(`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        AVG(CAST(price as FLOAT)) as avg_price,
        SUM(CAST(price as FLOAT)) as total_revenue
      FROM MED_Book
      WHERE startDate >= DATEADD(month, -1, GETDATE())
    `);
    
    if (bookingStats.recordset[0]) {
      insights.push({
        category: 'bookings',
        title: 'סטטיסטיקות הזמנות (30 יום אחרונים)',
        data: bookingStats.recordset[0]
      });
    }
  }
  
  if (category === 'all' || category === 'hotels') {
    // Top hotels
    const topHotels = await pool.request().query(`
      SELECT TOP 10
        HotelName,
        COUNT(*) as booking_count,
        AVG(CAST(price as FLOAT)) as avg_price
      FROM MED_Book
      WHERE startDate >= DATEADD(month, -3, GETDATE())
      GROUP BY HotelName
      ORDER BY booking_count DESC
    `);
    
    insights.push({
      category: 'hotels',
      title: 'מלונות מובילים (3 חודשים אחרונים)',
      data: topHotels.recordset
    });
  }
  
  if (category === 'all' || category === 'trends') {
    // Monthly trends
    const trends = await pool.request().query(`
      SELECT 
        YEAR(startDate) as year,
        MONTH(startDate) as month,
        COUNT(*) as bookings,
        SUM(CAST(price as FLOAT)) as revenue
      FROM MED_Book
      WHERE startDate >= DATEADD(month, -6, GETDATE())
      GROUP BY YEAR(startDate), MONTH(startDate)
      ORDER BY year, month
    `);
    
    insights.push({
      category: 'trends',
      title: 'מגמות חודשיות (6 חודשים)',
      data: trends.recordset
    });
  }
  
  return insights;
}

// Create MCP Server
const server = new Server(
  {
    name: 'medici-mssql-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'sql_query',
        description: 'הרצת שאילתת SQL על בסיס הנתונים. תומך ב-SELECT, INSERT, UPDATE, DELETE.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'שאילתת SQL להרצה'
            },
            params: {
              type: 'object',
              description: 'פרמטרים לשאילתה (למניעת SQL injection)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_schema',
        description: 'קבלת סכמת הדאטאבייס - כל הטבלאות והעמודות',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'שם טבלה ספציפית (אופציונלי)'
            }
          }
        }
      },
      {
        name: 'analyze_table',
        description: 'ניתוח מעמיק של טבלה - סטטיסטיקות, התפלגויות, ערכים חסרים',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'שם הטבלה לניתוח'
            },
            columns: {
              type: 'array',
              items: { type: 'string' },
              description: 'עמודות ספציפיות לניתוח (אופציונלי)'
            }
          },
          required: ['table']
        }
      },
      {
        name: 'business_insights',
        description: 'תובנות עסקיות אוטומטיות - הזמנות, מלונות, מגמות',
        inputSchema: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: ['all', 'bookings', 'hotels', 'trends'],
              description: 'קטגוריית תובנות'
            }
          }
        }
      },
      {
        name: 'search_data',
        description: 'חיפוש חכם בנתונים לפי מילות מפתח',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: 'מילת חיפוש'
            },
            tables: {
              type: 'array',
              items: { type: 'string' },
              description: 'טבלאות לחיפוש (אופציונלי - ברירת מחדל: כל הטבלאות)'
            },
            limit: {
              type: 'number',
              description: 'מספר תוצאות מקסימלי'
            }
          },
          required: ['keyword']
        }
      },
      {
        name: 'compare_periods',
        description: 'השוואה בין תקופות - מכירות, הזמנות, ביצועים',
        inputSchema: {
          type: 'object',
          properties: {
            metric: {
              type: 'string',
              enum: ['bookings', 'revenue', 'avg_price'],
              description: 'מדד להשוואה'
            },
            period1_start: {
              type: 'string',
              description: 'תחילת תקופה ראשונה (YYYY-MM-DD)'
            },
            period1_end: {
              type: 'string',
              description: 'סוף תקופה ראשונה'
            },
            period2_start: {
              type: 'string',
              description: 'תחילת תקופה שניה'
            },
            period2_end: {
              type: 'string',
              description: 'סוף תקופה שניה'
            }
          },
          required: ['metric', 'period1_start', 'period1_end', 'period2_start', 'period2_end']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'sql_query': {
        const result = await executeQuery(args.query, args.params || {});
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              rowCount: result.recordset?.length || 0,
              rowsAffected: result.rowsAffected,
              data: result.recordset
            }, null, 2)
          }]
        };
      }
      
      case 'get_schema': {
        const schema = await getDatabaseSchema();
        if (args.table) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                table: args.table,
                schema: schema[args.table] || 'Table not found'
              }, null, 2)
            }]
          };
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              tables: Object.keys(schema),
              tableCount: Object.keys(schema).length,
              schema
            }, null, 2)
          }]
        };
      }
      
      case 'analyze_table': {
        const pool = await getPool();
        const table = args.table;
        
        // Get row count
        const countResult = await pool.request().query(
          `SELECT COUNT(*) as row_count FROM [${table}]`
        );
        
        // Get column stats
        const schema = await getDatabaseSchema();
        const tableSchema = schema[table];
        
        if (!tableSchema) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: `Table '${table}' not found` })
            }]
          };
        }
        
        // Sample data
        const sampleResult = await pool.request().query(
          `SELECT TOP 5 * FROM [${table}]`
        );
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              table,
              rowCount: countResult.recordset[0].row_count,
              columns: tableSchema.columns,
              columnCount: tableSchema.columns.length,
              sampleData: sampleResult.recordset
            }, null, 2)
          }]
        };
      }
      
      case 'business_insights': {
        const insights = await generateInsights(args.category || 'all');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              generated_at: new Date().toISOString(),
              insights
            }, null, 2)
          }]
        };
      }
      
      case 'search_data': {
        const pool = await getPool();
        const keyword = args.keyword;
        const limit = args.limit || 20;
        const results = [];
        
        // Search in main tables
        const searchTables = args.tables || ['MED_Book', 'MED_Hotel', 'MED_User'];
        
        for (const table of searchTables) {
          try {
            const schema = await getDatabaseSchema();
            const tableSchema = schema[table];
            if (!tableSchema) continue;
            
            // Find text columns
            const textColumns = tableSchema.columns
              .filter(c => ['varchar', 'nvarchar', 'text', 'ntext'].includes(c.type))
              .map(c => c.name);
            
            if (textColumns.length === 0) continue;
            
            // Build search query
            const conditions = textColumns.map(col => `[${col}] LIKE @keyword`).join(' OR ');
            const query = `SELECT TOP ${limit} * FROM [${table}] WHERE ${conditions}`;
            
            const result = await pool.request()
              .input('keyword', `%${keyword}%`)
              .query(query);
            
            if (result.recordset.length > 0) {
              results.push({
                table,
                matchCount: result.recordset.length,
                data: result.recordset
              });
            }
          } catch (e) {
            // Skip tables with errors
          }
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              keyword,
              totalMatches: results.reduce((sum, r) => sum + r.matchCount, 0),
              results
            }, null, 2)
          }]
        };
      }
      
      case 'compare_periods': {
        const pool = await getPool();
        const { metric, period1_start, period1_end, period2_start, period2_end } = args;
        
        let selectClause;
        switch (metric) {
          case 'bookings':
            selectClause = 'COUNT(*) as value';
            break;
          case 'revenue':
            selectClause = 'SUM(CAST(price as FLOAT)) as value';
            break;
          case 'avg_price':
            selectClause = 'AVG(CAST(price as FLOAT)) as value';
            break;
          default:
            selectClause = 'COUNT(*) as value';
        }
        
        const period1 = await pool.request()
          .input('start', period1_start)
          .input('end', period1_end)
          .query(`SELECT ${selectClause} FROM MED_Book WHERE startDate BETWEEN @start AND @end`);
        
        const period2 = await pool.request()
          .input('start', period2_start)
          .input('end', period2_end)
          .query(`SELECT ${selectClause} FROM MED_Book WHERE startDate BETWEEN @start AND @end`);
        
        const val1 = period1.recordset[0]?.value || 0;
        const val2 = period2.recordset[0]?.value || 0;
        const change = val1 ? ((val2 - val1) / val1 * 100).toFixed(2) : 0;
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              metric,
              period1: {
                range: `${period1_start} to ${period1_end}`,
                value: val1
              },
              period2: {
                range: `${period2_start} to ${period2_end}`,
                value: val2
              },
              change: `${change}%`,
              trend: val2 > val1 ? '📈 עלייה' : val2 < val1 ? '📉 ירידה' : '➡️ ללא שינוי'
            }, null, 2)
          }]
        };
      }
      
      default:
        return {
          content: [{
            type: 'text',
            text: `Unknown tool: ${name}`
          }],
          isError: true
        };
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error.message,
          stack: error.stack
        })
      }],
      isError: true
    };
  }
});

// List resources (database tables)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const schema = await getDatabaseSchema();
    return {
      resources: Object.keys(schema).map(table => ({
        uri: `mssql://table/${table}`,
        name: table,
        description: `Database table: ${table} (${schema[table].columns.length} columns)`,
        mimeType: 'application/json'
      }))
    };
  } catch (error) {
    return { resources: [] };
  }
});

// Read resource (table schema)
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const match = uri.match(/^mssql:\/\/table\/(.+)$/);
  
  if (!match) {
    throw new Error(`Invalid resource URI: ${uri}`);
  }
  
  const tableName = match[1];
  const schema = await getDatabaseSchema();
  const tableSchema = schema[tableName];
  
  if (!tableSchema) {
    throw new Error(`Table not found: ${tableName}`);
  }
  
  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(tableSchema, null, 2)
    }]
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🗄️ Medici MSSQL MCP Server running...');
}

main().catch(console.error);
