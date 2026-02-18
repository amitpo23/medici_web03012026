const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../config/logger');

/**
 * Competitor Scraper Service
 * Scrapes hotel prices from competitor websites using Playwright
 */
class CompetitorScraper {
  constructor() {
    this.browser = null;
    this.screenshots = path.join(__dirname, '../screenshots');
  }

  /**
   * Initialize browser
   */
  async getBrowser() {
    if (!this.browser) {
      logger.info('Launching browser for scraping');
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      logger.info('Browser launched successfully');
    }
    return this.browser;
  }

  /**
   * Close browser
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
  }

  /**
   * Scrape hotel price from Booking.com
   */
  async scrapeBookingCom(hotelName, checkIn, checkOut, guests = 2) {
    const startTime = Date.now();
    logger.info('Starting Booking.com scrape', { hotelName, checkIn, checkOut, guests });
    
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'he-IL'
    });
    const page = await context.newPage();
    
    try {
      // 1. Build search URL
      const searchUrl = this.buildBookingUrl(hotelName, checkIn, checkOut, guests);
      logger.debug('Scraping Booking.com', { hotelName, url: searchUrl });
      
      // 2. Navigate to search page
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000); // Wait for dynamic content
      
      // 3. Try to find price elements
      const priceSelectors = [
        '[data-testid="price-and-discounted-price"]',
        '.prco-valign-middle-helper',
        '[data-testid="property-card-price"]',
        '.bui-price-display__value',
        '.sr_price_wrap',
        'span.prco-text-nowrap-helper'
      ];
      
      let price = null;
      let currency = 'ILS';
      let rawText = '';
      
      // Try each selector
      for (const selector of priceSelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible({ timeout: 3000 })) {
            const text = await element.textContent();
            rawText += `${selector}: ${text}\n`;
            
            const extracted = this.extractPriceFromText(text);
            if (extracted.price) {
              price = extracted.price;
              currency = extracted.currency;
              console.log(`✅ Found price with selector ${selector}: ${price} ${currency}`);
              logger.info('Price found', { selector, price, currency });
            }
          }
        } catch (e) {
          // Selector not found, try next
        }
      }
      
      // 4. If no price found, try text search
      if (!price) {
        const bodyText = await page.textContent('body');
        const extracted = this.extractPriceFromText(bodyText);
        price = extracted.price;
        currency = extracted.currency;
        rawText = bodyText.substring(0, 1000);
      }
      
      // 5. Take screenshot
      await this.saveScreenshot(page, `booking-${hotelName}-${Date.now()}.png`);
      
      await context.close();
      
      const duration = Date.now() - startTime;
      logger.logScraperActivity(hotelName, 'booking.com', !!price, price);
      logger.info('Scraping completed', { hotelName, duration: `${duration}ms`, success: !!price });
      
      return {
        success: !!price,
        source: 'booking.com',
        hotel: hotelName,
        checkIn,
        checkOut,
        price,
        currency,
        scrapedAt: new Date(),
        raw: rawText
      };
      
    } catch (error) {
      console.error('❌ Scraping failed:', error.message);
      logger.error('Scraping failed', { 
        hotelName, 
        error: error.message,
        stack: error.stack 
      });
      await context.close();
      
      return {
        success: false,
        source: 'booking.com',
        hotel: hotelName,
        error: error.message,
        scrapedAt: new Date()
      };
    }
  }

  /**
   * Scrape hotel price from Hotels.com
   */
  async scrapeHotelsCom(hotelName, checkIn, checkOut, guests = 2) {
    const browser = await this.getBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      console.log(`🔍 Scraping Hotels.com for: ${hotelName}`);
      
      const searchUrl = `https://www.hotels.com/search.do?q-destination=${encodeURIComponent(hotelName)}&q-check-in=${checkIn}&q-check-out=${checkOut}&q-rooms=1&q-room-0-adults=${guests}`;
      
      await page.goto(searchUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      const bodyText = await page.textContent('body');
      const extracted = this.extractPriceFromText(bodyText);
      
      await this.saveScreenshot(page, `hotels-${hotelName}-${Date.now()}.png`);
      await context.close();
      
      return {
        success: !!extracted.price,
        source: 'hotels.com',
        hotel: hotelName,
        checkIn,
        checkOut,
        price: extracted.price,
        currency: extracted.currency || 'USD',
        scrapedAt: new Date()
      };
      
    } catch (error) {
      await context.close();
      return {
        success: false,
        source: 'hotels.com',
        error: error.message
      };
    }
  }

  /**
   * Compare prices across multiple platforms
   */
  async comparePrices(hotelName, checkIn, checkOut, guests = 2) {
    console.log(`💰 Comparing prices for: ${hotelName}`);
    
    const results = await Promise.allSettled([
      this.scrapeBookingCom(hotelName, checkIn, checkOut, guests),
      // this.scrapeHotelsCom(hotelName, checkIn, checkOut, guests) // Uncomment when ready
    ]);
    
    const prices = results
      .filter(r => r.status === 'fulfilled' && r.value.success)
      .map(r => r.value);
    
    const failed = results
      .filter(r => r.status === 'rejected' || !r.value.success)
      .map(r => r.status === 'rejected' ? r.reason : r.value);
    
    // Find best price
    const bestPrice = prices.length > 0 
      ? prices.reduce((min, p) => p.price < min.price ? p : min)
      : null;
    
    return {
      hotel: hotelName,
      checkIn,
      checkOut,
      guests,
      prices,
      failed,
      bestPrice,
      comparedAt: new Date()
    };
  }

  /**
   * Build Booking.com search URL
   */
  buildBookingUrl(hotelName, checkIn, checkOut, guests) {
    return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotelName)}&checkin=${checkIn}&checkout=${checkOut}&group_adults=${guests}&no_rooms=1`;
  }

  /**
   * Extract price from text
   */
  extractPriceFromText(text) {
    const pricePatterns = [
      /ILS?\s*[\u20aa₪]?\s*([0-9,]+(?:\.[0-9]{2})?)/i,  // ILS ₪123.45
      /[\u20aa₪]\s*([0-9,]+(?:\.[0-9]{2})?)/i,          // ₪123.45
      /\$\s*([0-9,]+(?:\.[0-9]{2})?)/i,                  // $123.45
      /([0-9,]+(?:\.[0-9]{2})?)\s*[\u20aa₪]/i,          // 123.45₪
      /price["\s:]+([0-9,]+(?:\.[0-9]{2})?)/i            // "price": "123.45"
    ];
    
    for (const pattern of pricePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (price > 0) {
          const currency = text.includes('$') ? 'USD' : 'ILS';
          logger.debug('Price extracted', { price, currency });
          
          return { price, currency };
        }
      }
    }
    
    logger.warn('No valid price found in text');
    return { price: null, currency: null };
  }

  /**
   * Save screenshot
   */
  async saveScreenshot(page, filename) {
    try {
      const filepath = path.join(__dirname, '../screenshots', filename);
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await page.screenshot({ path: filepath, fullPage: false });
      logger.debug('Screenshot saved', { filename });
    } catch (error) {
      logger.error('Screenshot failed', { error: error.message });
    }
  }

  /**
   * Wait for milliseconds
   */
  async waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get active sessions (legacy method for compatibility)
   */
  async getActiveSessions() {
    return 'Using Playwright - no sessions';
  }
}

module.exports = new CompetitorScraper();
