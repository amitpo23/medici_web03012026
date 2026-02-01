#!/usr/bin/env node
/**
 * E2E Search & Buy CLI Script
 *
 * Usage:
 *   node scripts/search-and-buy.js --city Miami --stars 4 --min-profit 100 --refundable-only
 *   node scripts/search-and-buy.js --city Miami --stars 4 --min-profit 100 --refundable-only --dry-run
 *   node scripts/search-and-buy.js --city Miami --stars 4 --min-profit 100 --refundable-only --insert
 *
 * Options:
 *   --city <name>        City to search (required)
 *   --stars <n>          Minimum hotel stars (default: 3)
 *   --min-profit <n>     Minimum profit per room in EUR (default: 50)
 *   --refundable-only    Only show rooms with free cancellation
 *   --date-from <date>   Check-in date YYYY-MM-DD (default: +7 days)
 *   --date-to <date>     Check-out date YYYY-MM-DD (default: +10 days)
 *   --adults <n>         Number of adults (default: 2)
 *   --max-buy-price <n>  Maximum buy price (default: 500)
 *   --push-markup <n>    Markup percentage for push price (default: 20)
 *   --max-rooms <n>      Max rooms per opportunity (default: 3)
 *   --dry-run            Show results without inserting (default)
 *   --insert             Actually insert qualifying opportunities
 *   --json               Output as JSON
 */

require('dotenv').config();
const { getPool } = require('../config/database');
const InnstantClient = require('../services/innstant-client');

const innstantClient = new InnstantClient();

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    city: null,
    stars: 3,
    minProfit: 50,
    refundableOnly: false,
    dateFrom: null,
    dateTo: null,
    adults: 2,
    maxBuyPrice: 500,
    pushMarkup: 20,
    maxRooms: 3,
    dryRun: true,
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--city': opts.city = args[++i]; break;
      case '--stars': opts.stars = parseInt(args[++i], 10); break;
      case '--min-profit': opts.minProfit = parseFloat(args[++i]); break;
      case '--refundable-only': opts.refundableOnly = true; break;
      case '--date-from': opts.dateFrom = args[++i]; break;
      case '--date-to': opts.dateTo = args[++i]; break;
      case '--adults': opts.adults = parseInt(args[++i], 10); break;
      case '--max-buy-price': opts.maxBuyPrice = parseFloat(args[++i]); break;
      case '--push-markup': opts.pushMarkup = parseFloat(args[++i]); break;
      case '--max-rooms': opts.maxRooms = parseInt(args[++i], 10); break;
      case '--dry-run': opts.dryRun = true; break;
      case '--insert': opts.dryRun = false; break;
      case '--json': opts.json = true; break;
      case '--help':
        printUsage();
        process.exit(0);
    }
  }

  // Defaults for dates
  if (!opts.dateFrom) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    opts.dateFrom = d.toISOString().split('T')[0];
  }
  if (!opts.dateTo) {
    const d = new Date(opts.dateFrom);
    d.setDate(d.getDate() + 3);
    opts.dateTo = d.toISOString().split('T')[0];
  }

  return opts;
}

function printUsage() {
  process.stdout.write(`
Search & Buy CLI - Medici Hotels Booking Engine

Usage:
  node scripts/search-and-buy.js --city Miami --stars 4 --min-profit 100 --refundable-only
  node scripts/search-and-buy.js --city Miami --stars 4 --min-profit 100 --insert

Options:
  --city <name>        City to search (required)
  --stars <n>          Minimum hotel stars (default: 3)
  --min-profit <n>     Minimum profit per room in EUR (default: 50)
  --refundable-only    Only show rooms with free cancellation
  --date-from <date>   Check-in date YYYY-MM-DD (default: +7 days)
  --date-to <date>     Check-out date YYYY-MM-DD (default: +10 days)
  --adults <n>         Number of adults (default: 2)
  --max-buy-price <n>  Maximum buy price in EUR (default: 500)
  --push-markup <n>    Markup % for push price (default: 20)
  --max-rooms <n>      Max rooms per opportunity (default: 3)
  --dry-run            Show results only (default)
  --insert             Insert qualifying results as opportunities
  --json               Output as JSON
  --help               Show this help
`);
}

function log(msg) {
  process.stdout.write(msg + '\n');
}

async function main() {
  const opts = parseArgs();

  if (!opts.city) {
    log('ERROR: --city is required. Use --help for usage.');
    process.exit(1);
  }

  log('');
  log('==============================================================');
  log('  MEDICI HOTELS - Search & Buy CLI');
  log('==============================================================');
  log(`  City:            ${opts.city}`);
  log(`  Stars:           >= ${opts.stars}`);
  log(`  Dates:           ${opts.dateFrom} -> ${opts.dateTo}`);
  log(`  Adults:          ${opts.adults}`);
  log(`  Min Profit:      EUR ${opts.minProfit}`);
  log(`  Max Buy Price:   EUR ${opts.maxBuyPrice}`);
  log(`  Push Markup:     ${opts.pushMarkup}%`);
  log(`  Refundable Only: ${opts.refundableOnly ? 'YES' : 'NO'}`);
  log(`  Mode:            ${opts.dryRun ? 'DRY RUN (no inserts)' : 'INSERT MODE'}`);
  log('==============================================================');
  log('');

  // Step 1: Get hotels from database matching criteria
  log('[1/5] Fetching hotels from database...');
  const pool = await getPool();
  const hotelsResult = await pool.request()
    .input('city', `%${opts.city}%`)
    .input('stars', opts.stars)
    .query(`
      SELECT HotelId, InnstantId, Innstant_ZenithId, name, City, Stars,
             RatePlanCode, InvTypeCode, BoardId, CategoryId
      FROM Med_Hotels
      WHERE isActive = 1
        AND City LIKE @city
        AND Stars >= @stars
        AND InnstantId IS NOT NULL
        AND InnstantId > 0
      ORDER BY Stars DESC, name
    `);

  const hotels = hotelsResult.recordset;
  log(`   Found ${hotels.length} hotels matching criteria`);

  if (hotels.length === 0) {
    log('   No hotels found. Try a different city or lower star rating.');
    await pool.close();
    process.exit(0);
  }

  // Step 2: Search Innstant for prices
  log('[2/5] Searching Innstant API for available rooms...');
  const searchResults = [];
  let searchCount = 0;

  for (const hotel of hotels) {
    searchCount++;
    process.stdout.write(`   Searching ${searchCount}/${hotels.length}: ${hotel.name}...\r`);

    const result = await innstantClient.searchHotels({
      hotelId: hotel.InnstantId,
      dateFrom: opts.dateFrom,
      dateTo: opts.dateTo,
      adults: opts.adults
    });

    if (result.success && result.hotels && result.hotels.length > 0) {
      for (const h of result.hotels) {
        if (h.rooms) {
          for (const room of h.rooms) {
            searchResults.push({
              hotel,
              room,
              price: room.price || room.totalPrice || 0,
              currency: room.currency || 'EUR',
              cancellationType: room.cancellationPolicy?.type || room.cancellationType || 'unknown',
              cancellationDeadline: room.cancellationPolicy?.deadline || null,
              roomName: room.name || room.roomName || 'Standard',
              boardName: room.boardName || room.mealPlan || 'RO'
            });
          }
        }
      }
    }

    // Rate limit: small delay between requests
    await new Promise(r => setTimeout(r, 200));
  }

  log(`   Found ${searchResults.length} available rooms across all hotels`);
  log('');

  // Step 3: Filter results
  log('[3/5] Filtering results...');
  const qualifying = searchResults.filter(r => {
    // Price filter
    if (r.price <= 0 || r.price > opts.maxBuyPrice) return false;

    // Calculate profit
    const pushPrice = r.price * (1 + opts.pushMarkup / 100);
    const profit = pushPrice - r.price;
    if (profit < opts.minProfit) return false;

    // Refundable filter
    if (opts.refundableOnly) {
      const isFree = r.cancellationType === 'free' ||
                     r.cancellationType === 'FREE_CANCELLATION' ||
                     r.cancellationType === 'freeCancellation';
      if (!isFree) return false;
    }

    return true;
  }).map(r => {
    const pushPrice = Math.round(r.price * (1 + opts.pushMarkup / 100));
    return {
      ...r,
      pushPrice,
      profit: pushPrice - r.price,
      marginPercent: ((pushPrice - r.price) / pushPrice * 100).toFixed(1)
    };
  }).sort((a, b) => b.profit - a.profit);

  log(`   ${qualifying.length} rooms qualify (of ${searchResults.length} total)`);
  log('');

  // Step 4: Display results
  log('[4/5] Results:');
  log('--------------------------------------------------------------');

  if (qualifying.length === 0) {
    log('   No qualifying rooms found with current filters.');
    log('   Try: --min-profit 50 or remove --refundable-only');
  } else {
    if (opts.json) {
      log(JSON.stringify(qualifying.map(q => ({
        hotel: q.hotel.name,
        city: q.hotel.City,
        stars: q.hotel.Stars,
        room: q.roomName,
        board: q.boardName,
        buyPrice: q.price,
        pushPrice: q.pushPrice,
        profit: q.profit,
        margin: q.marginPercent + '%',
        cancellation: q.cancellationType,
        dates: `${opts.dateFrom} - ${opts.dateTo}`
      })), null, 2));
    } else {
      log(`   ${'Hotel'.padEnd(35)} ${'Room'.padEnd(15)} ${'Buy'.padStart(8)} ${'Push'.padStart(8)} ${'Profit'.padStart(8)} ${'Margin'.padStart(8)} ${'Cancel'.padEnd(12)}`);
      log(`   ${'-'.repeat(35)} ${'-'.repeat(15)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(12)}`);

      for (const q of qualifying.slice(0, 50)) {
        const name = q.hotel.name.substring(0, 33).padEnd(35);
        const room = q.roomName.substring(0, 13).padEnd(15);
        const buy = `${q.price}`.padStart(8);
        const push = `${q.pushPrice}`.padStart(8);
        const profit = `${q.profit}`.padStart(8);
        const margin = `${q.marginPercent}%`.padStart(8);
        const cancel = q.cancellationType.substring(0, 12).padEnd(12);
        log(`   ${name} ${room} ${buy} ${push} ${profit} ${margin} ${cancel}`);
      }

      if (qualifying.length > 50) {
        log(`   ... and ${qualifying.length - 50} more`);
      }
    }
  }
  log('');

  // Step 5: Insert as opportunities (if --insert flag)
  log('[5/5] Opportunity insertion...');

  if (opts.dryRun) {
    log(`   DRY RUN: ${qualifying.length} opportunities would be inserted.`);
    log('   Use --insert flag to actually create opportunities.');
  } else {
    let inserted = 0;
    let failed = 0;

    for (const q of qualifying) {
      try {
        await pool.request()
          .input('hotelId', q.hotel.HotelId)
          .input('dateFrom', opts.dateFrom)
          .input('dateTo', opts.dateTo)
          .input('boardId', q.hotel.BoardId || 1)
          .input('categoryId', q.hotel.CategoryId || 1)
          .input('price', q.price)
          .input('pushPrice', q.pushPrice)
          .input('maxRooms', opts.maxRooms)
          .execute('MED_InsertOpportunity');

        inserted++;
        log(`   [OK] ${q.hotel.name} - Buy: ${q.price} Push: ${q.pushPrice} Profit: ${q.profit}`);
      } catch (err) {
        failed++;
        log(`   [FAIL] ${q.hotel.name}: ${err.message}`);
      }
    }

    log('');
    log(`   Inserted: ${inserted}, Failed: ${failed}`);
  }

  log('');
  log('==============================================================');
  log('  Summary:');
  log(`  Hotels searched: ${hotels.length}`);
  log(`  Rooms found:     ${searchResults.length}`);
  log(`  Qualifying:      ${qualifying.length}`);
  log(`  Total profit potential: EUR ${qualifying.reduce((sum, q) => sum + q.profit, 0)}`);
  log('==============================================================');

  await pool.close();
  process.exit(0);
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
