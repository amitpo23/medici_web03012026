const express = require('express');
const router = express.Router();
const competitorScraper = require('../services/competitor-scraper');
const { getPool } = require('../config/database');
const logger = require('../config/logger');
const { validate, schemas } = require('../middleware/validate');

/**
 * POST /scraper/competitor-prices
 * Scrape competitor prices for a hotel
 * 
 * Request body:
 * {
 *   "hotelName": "David Intercontinental Tel Aviv",
 *   "checkIn": "2026-02-01",
 *   "checkOut": "2026-02-03",
 *   "guests": 2,
 *   "sources": ["booking.com"] // Optional, defaults to all
 * }
 */
router.post('/competitor-prices', validate({ body: schemas.scraperRequest }), async (req, res) => {
  try {
    const { hotelName, checkIn, checkOut, guests = 2, sources } = req.body;
    
    logger.info('Scraping request', { hotelName, checkIn, checkOut });
    
    let result;
    
    if (!sources || sources.includes('booking.com')) {
      // Single source scraping
      result = await competitorScraper.scrapeBookingCom(hotelName, checkIn, checkOut, guests);
    } else {
      // Multi-source comparison
      result = await competitorScraper.comparePrices(hotelName, checkIn, checkOut, guests);
    }
    
    // Save to database
    if (result.success || result.prices?.length > 0) {
      await saveCompetitorPrice(result);
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Scraper endpoint error', { error: error.message });
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * POST /scraper/compare-prices
 * Compare prices across multiple platforms
 */
router.post('/compare-prices', async (req, res) => {
  try {
    const { hotelName, checkIn, checkOut, guests = 2 } = req.body;
    
    if (!hotelName || !checkIn || !checkOut) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }
    
    const result = await competitorScraper.comparePrices(hotelName, checkIn, checkOut, guests);
    
    // Save all prices to database
    if (result.prices?.length > 0) {
      for (const price of result.prices) {
        await saveCompetitorPrice(price);
      }
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Compare prices error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /scraper/sessions
 * Get active browser sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await competitorScraper.getActiveSessions();
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /scraper/test
 * Test scraper with a known hotel
 */
router.post('/test', async (req, res) => {
  try {
    logger.info('Testing scraper');
    
    const result = await competitorScraper.scrapeBookingCom(
      'David Intercontinental Tel Aviv',
      '2026-02-15',
      '2026-02-17',
      2
    );
    
    res.json({
      test: 'completed',
      result,
      timestamp: new Date()
    });
    
  } catch (error) {
    res.status(500).json({
      test: 'failed',
      error: error.message
    });
  }
});

/**
 * Save competitor price to database
 */
async function saveCompetitorPrice(priceData) {
  try {
    const pool = await getPool();

    await pool.request()
      .input('hotelName', priceData.hotel)
      .input('source', priceData.source)
      .input('checkIn', priceData.checkIn)
      .input('checkOut', priceData.checkOut)
      .input('price', priceData.price)
      .input('currency', priceData.currency)
      .input('scrapedAt', priceData.scrapedAt)
      .input('raw', priceData.raw)
      .query(`
        INSERT INTO CompetitorPrices 
        (HotelName, Source, CheckIn, CheckOut, Price, Currency, ScrapedAt, RawData)
        VALUES 
        (@hotelName, @source, @checkIn, @checkOut, @price, @currency, @scrapedAt, @raw)
      `);
    
    logger.info('Saved competitor price', { source: priceData.source, price: priceData.price, currency: priceData.currency });
    
  } catch (error) {
    // Don't fail the request if DB save fails
    logger.warn('Failed to save competitor price to DB', { error: error.message });
  }
}

module.exports = router;
