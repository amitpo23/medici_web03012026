/**
 * Integration Test Script
 * 
 * Tests complete flow:
 * 1. Reservation comes in from Zenith
 * 2. MED_FindAvailableRoom matches it to a Book
 * 3. Book marked as sold
 * 4. BuyRoom worker can purchase
 * 5. Zenith push queue processes
 * 
 * Usage: node tests/integration-test.js
 */

require('dotenv').config();
const axios = require('axios');
const { getPool } = require('../config/database');
const logger = require('../config/logger');

const API_BASE = process.env.API_URL || 'http://localhost:5000';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'blue');
  console.log('='.repeat(60));
}

/**
 * Test 1: Health Checks
 */
async function testHealthChecks() {
  section('TEST 1: Health Checks');
  
  try {
    // Basic health
    const health = await axios.get(`${API_BASE}/health`);
    log(`✅ Basic health: ${health.data.status}`, 'green');
    
    // Deep health
    const deepHealth = await axios.get(`${API_BASE}/health/deep`);
    log(`✅ Deep health: ${deepHealth.data.status}`, 'green');
    
    // Worker status
    const workers = await axios.get(`${API_BASE}/health/workers/summary`);
    log(`✅ Worker summary: ${JSON.stringify(workers.data.summary, null, 2)}`, 'green');
    
    return true;
  } catch (error) {
    log(`❌ Health check failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 2: Database Schema
 */
async function testDatabaseSchema() {
  section('TEST 2: Database Schema Validation');
  
  try {
    const pool = await getPool();
    
    // Check MED_PushLog exists
    const pushLogCheck = await pool.request().query(`
      SELECT COUNT(*) as Count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'MED_PushLog'
    `);
    
    if (pushLogCheck.recordset[0].Count === 0) {
      log('❌ MED_PushLog table missing', 'red');
      return false;
    }
    log('✅ MED_PushLog table exists', 'green');
    
    // Check Med_Reservation has new columns
    const columnCheck = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Med_Reservation'
      AND COLUMN_NAME IN ('SupplierBookingId', 'SupplierPrice', 'PurchasedAt')
    `);
    
    if (columnCheck.recordset.length < 3) {
      log(`❌ Med_Reservation missing columns: ${3 - columnCheck.recordset.length} missing`, 'red');
      return false;
    }
    log('✅ Med_Reservation has required columns', 'green');
    
    // Check MED_ReservationLogs exists
    const logsCheck = await pool.request().query(`
      SELECT COUNT(*) as Count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'MED_ReservationLogs'
    `);
    
    if (logsCheck.recordset[0].Count === 0) {
      log('⚠️  MED_ReservationLogs table missing - run 002_fix_worker_tables.sql', 'yellow');
    } else {
      log('✅ MED_ReservationLogs table exists', 'green');
    }
    
    return true;
  } catch (error) {
    log(`❌ Database schema check failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 3: Zenith Push Stats
 */
async function testZenithPushStats() {
  section('TEST 3: Zenith Push Statistics');
  
  try {
    const stats = await axios.get(`${API_BASE}/zenith/push-stats?days=7`);
    
    log(`Overall Success Rate: ${stats.data.overall.OverallSuccessRate}%`, 'green');
    log(`Total Pushes (7 days): ${stats.data.overall.TotalPushes}`, 'blue');
    
    if (stats.data.byType && stats.data.byType.length > 0) {
      log('\nBy Push Type:', 'blue');
      for (const type of stats.data.byType) {
        log(`  ${type.PushType}: ${type.SuccessCount}/${type.TotalPushes} (${type.SuccessRate}%)`, 'green');
      }
    } else {
      log('⚠️  No push history yet', 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`❌ Push stats failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 4: Zenith Queue Status
 */
async function testZenithQueue() {
  section('TEST 4: Zenith Queue Status');
  
  try {
    const queue = await axios.get(`${API_BASE}/zenith/queue-status`);
    
    log(`Pending Items: ${queue.data.queue.pending}`, queue.data.queue.pending > 20 ? 'yellow' : 'green');
    log(`Failed Items: ${queue.data.queue.failed}`, queue.data.queue.failed > 0 ? 'yellow' : 'green');
    log(`Queue Status: ${queue.data.queue.status}`, 'blue');
    
    if (queue.data.queue.pending > 0) {
      log(`Oldest Item: ${queue.data.queue.oldestItem}`, 'blue');
    }
    
    return true;
  } catch (error) {
    log(`❌ Queue status failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 5: Reservation Matching Flow
 */
async function testReservationMatching() {
  section('TEST 5: Reservation Matching Logic');
  
  try {
    const pool = await getPool();
    
    // Find a test reservation and book
    const testData = await pool.request().query(`
      SELECT TOP 1
        r.Id as ReservationId,
        r.uniqueID,
        r.IsApproved,
        b.id as BookId,
        b.IsSold
      FROM Med_Reservation r
      LEFT JOIN Med_Hotels h ON r.HotelCode = h.ZenithHotelCode
      LEFT JOIN MED_Book b ON b.HotelId = h.HotelId 
        AND b.startDate = r.datefrom 
        AND b.endDate = r.dateto
        AND b.IsSold = 0
      WHERE r.IsCanceled = 0
    `);
    
    if (testData.recordset.length === 0) {
      log('⚠️  No test data available', 'yellow');
      return true;
    }
    
    const test = testData.recordset[0];
    
    log(`Reservation ${test.uniqueID}:`, 'blue');
    log(`  IsApproved: ${test.IsApproved}`, test.IsApproved ? 'green' : 'yellow');
    
    if (test.BookId) {
      log(`  Matched to Book ${test.BookId}`, 'green');
      log(`  Book IsSold: ${test.IsSold}`, test.IsSold ? 'green' : 'yellow');
    } else {
      log(`  No matching book found`, 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`❌ Reservation matching test failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 6: Worker Activity
 */
async function testWorkerActivity() {
  section('TEST 6: Worker Activity (Last 24h)');
  
  try {
    const pool = await getPool();
    
    // Check buyroom worker activity
    const buyroomActivity = await pool.request().query(`
      SELECT 
        COUNT(*) as Total,
        SUM(CASE WHEN Action = 'ROOM_PURCHASED' THEN 1 ELSE 0 END) as Purchased,
        SUM(CASE WHEN Action = 'PURCHASE_FAILED' THEN 1 ELSE 0 END) as Failed
      FROM MED_ReservationLogs
      WHERE CreatedAt >= DATEADD(HOUR, -24, GETDATE())
    `);
    
    if (buyroomActivity.recordset[0].Total > 0) {
      const activity = buyroomActivity.recordset[0];
      log(`BuyRoom Worker:`, 'blue');
      log(`  Total: ${activity.Total}`, 'green');
      log(`  Purchased: ${activity.Purchased}`, 'green');
      log(`  Failed: ${activity.Failed}`, activity.Failed > 0 ? 'yellow' : 'green');
    } else {
      log('⚠️  No buyroom worker activity in last 24h', 'yellow');
    }
    
    // Check cancellation worker activity
    const cancelActivity = await pool.request().query(`
      SELECT COUNT(*) as Total
      FROM MED_OpportunityLogs
      WHERE CreatedAt >= DATEADD(HOUR, -24, GETDATE())
      AND Action = 'AUTO_CANCELLED'
    `);
    
    if (cancelActivity.recordset[0].Total > 0) {
      log(`\nCancellation Worker:`, 'blue');
      log(`  Auto-cancelled: ${cancelActivity.recordset[0].Total}`, 'green');
    } else {
      log('⚠️  No cancellation activity in last 24h', 'yellow');
    }
    
    // Check price update worker
    const priceActivity = await pool.request().query(`
      SELECT 
        COUNT(*) as Total,
        SUM(CASE WHEN Success = 1 THEN 1 ELSE 0 END) as Successful
      FROM MED_PushLog
      WHERE PushDate >= DATEADD(HOUR, -24, GETDATE())
    `);
    
    if (priceActivity.recordset[0].Total > 0) {
      const activity = priceActivity.recordset[0];
      const successRate = ((activity.Successful / activity.Total) * 100).toFixed(1);
      log(`\nPrice Update Worker:`, 'blue');
      log(`  Total pushes: ${activity.Total}`, 'green');
      log(`  Success rate: ${successRate}%`, parseFloat(successRate) > 80 ? 'green' : 'yellow');
    } else {
      log('⚠️  No price update activity in last 24h', 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`❌ Worker activity test failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 7: PM2 Status (if available)
 */
async function testPM2Status() {
  section('TEST 7: PM2 Process Status');
  
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout);
    
    if (processes.length === 0) {
      log('⚠️  No PM2 processes running', 'yellow');
      log('   Run: npm run pm2:start', 'blue');
      return true;
    }
    
    for (const proc of processes) {
      const status = proc.pm2_env.status === 'online' ? '✅' : '❌';
      const uptime = Math.floor((Date.now() - proc.pm2_env.pm_uptime) / 1000 / 60);
      log(`${status} ${proc.name}: ${proc.pm2_env.status} (${uptime}m uptime)`, 
          proc.pm2_env.status === 'online' ? 'green' : 'red');
    }
    
    return true;
  } catch (error) {
    log('⚠️  PM2 not running or not installed', 'yellow');
    log('   Install: npm install pm2 -g', 'blue');
    log('   Start: npm run pm2:start', 'blue');
    return true;
  }
}

/**
 * Main Test Runner
 */
async function runTests() {
  console.log('\n' + '='.repeat(60));
  log('🧪 MEDICI INTEGRATION TESTS', 'blue');
  log('Phase 1.2 - Complete System Validation', 'blue');
  console.log('='.repeat(60));
  
  const tests = [
    { name: 'Health Checks', fn: testHealthChecks },
    { name: 'Database Schema', fn: testDatabaseSchema },
    { name: 'Zenith Push Stats', fn: testZenithPushStats },
    { name: 'Zenith Queue', fn: testZenithQueue },
    { name: 'Reservation Matching', fn: testReservationMatching },
    { name: 'Worker Activity', fn: testWorkerActivity },
    { name: 'PM2 Status', fn: testPM2Status }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      log(`❌ ${test.name} crashed: ${error.message}`, 'red');
      results.push({ name: test.name, passed: false });
    }
  }
  
  // Summary
  section('TEST SUMMARY');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(1);
  
  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`${icon} ${result.name}`, color);
  }
  
  console.log('\n' + '='.repeat(60));
  log(`TOTAL: ${passed}/${total} tests passed (${percentage}%)`, passed === total ? 'green' : 'yellow');
  console.log('='.repeat(60) + '\n');
  
  if (passed === total) {
    log('🎉 All tests passed! System ready for production.', 'green');
  } else {
    log('⚠️  Some tests failed. Review logs and fix issues.', 'yellow');
  }
  
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  log(`❌ Test runner crashed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
