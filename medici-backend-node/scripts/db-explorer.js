/**
 * Database Explorer - Check existing data in SQL tables
 * 
 * Run: node scripts/db-explorer.js
 * 
 * Note: Make sure your IP is whitelisted in Azure SQL firewall
 */

require('dotenv').config();
const sql = require('mssql');

const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

async function exploreDatabase() {
    let pool;
    
    try {
        console.log('🔌 Connecting to database...');
        console.log(`   Server: ${config.server}`);
        console.log(`   Database: ${config.database}`);
        console.log('');
        
        pool = await sql.connect(config);
        console.log('✅ Connected successfully!\n');
        
        // Get all tables with row counts
        console.log('📊 TABLES AND ROW COUNTS');
        console.log('='.repeat(60));
        
        const tables = await pool.request().query(`
            SELECT 
                t.TABLE_NAME,
                p.rows as ROW_COUNT
            FROM INFORMATION_SCHEMA.TABLES t
            LEFT JOIN sys.partitions p ON p.object_id = OBJECT_ID(t.TABLE_SCHEMA + '.' + t.TABLE_NAME)
            WHERE t.TABLE_TYPE = 'BASE TABLE' AND p.index_id IN (0,1)
            ORDER BY p.rows DESC
        `);
        
        let totalRows = 0;
        let tablesWithData = [];
        let emptyTables = [];
        
        for (const t of tables.recordset) {
            if (t.ROW_COUNT > 0) {
                tablesWithData.push(t);
                totalRows += t.ROW_COUNT;
            } else {
                emptyTables.push(t.TABLE_NAME);
            }
        }
        
        console.log('\n📦 Tables WITH data:');
        console.log('-'.repeat(40));
        for (const t of tablesWithData) {
            const padding = ' '.repeat(Math.max(0, 35 - t.TABLE_NAME.length));
            console.log(`  ${t.TABLE_NAME}${padding}${t.ROW_COUNT.toLocaleString()} rows`);
        }
        
        console.log('\n📭 Empty tables:');
        console.log('-'.repeat(40));
        for (const name of emptyTables) {
            console.log(`  ${name}`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`📈 Summary: ${tables.recordset.length} tables, ${totalRows.toLocaleString()} total rows`);
        console.log(`   ${tablesWithData.length} tables with data`);
        console.log(`   ${emptyTables.length} empty tables`);
        
        // Show sample data from key tables
        console.log('\n\n📝 SAMPLE DATA FROM KEY TABLES');
        console.log('='.repeat(60));
        
        const keyTables = ['Hotels', 'Users', 'RoomCategories', 'Reservations', 'Rates', 'Opportunities'];
        
        for (const tableName of keyTables) {
            try {
                const exists = tablesWithData.find(t => t.TABLE_NAME.toLowerCase() === tableName.toLowerCase());
                if (exists) {
                    console.log(`\n📋 ${tableName} (showing up to 5 rows):`);
                    console.log('-'.repeat(50));
                    
                    const sample = await pool.request().query(`SELECT TOP 5 * FROM [${tableName}]`);
                    
                    if (sample.recordset.length > 0) {
                        // Get column names
                        const columns = Object.keys(sample.recordset[0]);
                        console.log(`   Columns: ${columns.join(', ')}`);
                        console.log('');
                        
                        for (let i = 0; i < sample.recordset.length; i++) {
                            const row = sample.recordset[i];
                            console.log(`   Row ${i + 1}:`);
                            for (const col of columns.slice(0, 8)) { // Show first 8 columns
                                let value = row[col];
                                if (value instanceof Date) {
                                    value = value.toISOString();
                                } else if (typeof value === 'string' && value.length > 50) {
                                    value = value.substring(0, 50) + '...';
                                }
                                console.log(`     ${col}: ${value}`);
                            }
                            if (columns.length > 8) {
                                console.log(`     ... and ${columns.length - 8} more columns`);
                            }
                            console.log('');
                        }
                    }
                }
            } catch (err) {
                console.log(`   ⚠️ Could not read ${tableName}: ${err.message}`);
            }
        }
        
        // Get stored procedures count
        console.log('\n\n🔧 STORED PROCEDURES');
        console.log('='.repeat(60));
        
        const procs = await pool.request().query(`
            SELECT name, create_date, modify_date
            FROM sys.procedures
            ORDER BY name
        `);
        
        console.log(`Found ${procs.recordset.length} stored procedures:\n`);
        for (const p of procs.recordset) {
            console.log(`  ${p.name}`);
        }
        
    } catch (err) {
        console.error('❌ Error:', err.message);
        
        if (err.message.includes('not allowed to access')) {
            console.log('\n💡 Your IP is not whitelisted in Azure SQL firewall.');
            console.log('   Go to Azure Portal > SQL Server > Networking');
            console.log('   Add your IP address to the firewall rules.');
        }
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

// Run
exploreDatabase();
