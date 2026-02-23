/**
 * Buy Rooms Worker (MediciBuyRooms equivalent)
 * Core automated room purchasing engine.
 * Polls MED_Opportunities for unpurchased items, searches suppliers,
 * validates cancellation policy, books cheapest valid room, pushes to Zenith.
 *
 * SAFETY: DRY_RUN=true by default - logs actions without executing purchases.
 */

const logger = require('../../config/logger');
const { sql, getPool } = require('../../config/database');
const MultiSupplierAggregator = require('../multi-supplier-aggregator');
const InnstantClient = require('../innstant-client');
const GoGlobalClient = require('../goglobal-client');
const zenithPushService = require('../zenith-push-service');
const slackService = require('../slack-service');

class BuyRoomsWorker {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.processing = false;
    this.aggregator = new MultiSupplierAggregator();
    this.innstantClient = new InnstantClient();
    this.goGlobalClient = new GoGlobalClient();
    this.lastBuyTime = 0;
    this.stats = {
      runs: 0,
      searched: 0,
      purchased: 0,
      skipped: 0,
      failures: 0,
      dryRunActions: 0,
      lastRun: null,
      lastSuccess: null,
      lastError: null,
      lastPurchase: null
    };
    this.config = {
      intervalMinutes: parseFloat(process.env.BUYROOMS_WORKER_INTERVAL || '0.5'),
      enabled: process.env.BUYROOMS_WORKER_ENABLED === 'true',
      dryRun: process.env.BUYROOMS_DRY_RUN !== 'false', // default TRUE for safety
      maxBuysPerMinute: parseInt(process.env.BUYROOMS_MAX_PER_MINUTE || '1', 10)
    };
  }

  start(intervalMinutes) {
    if (this.isRunning) {
      logger.warn('[BuyRooms] Already running');
      return;
    }
    const interval = intervalMinutes || this.config.intervalMinutes;
    this.isRunning = true;
    logger.info('[BuyRooms] Started', {
      interval: `${interval} minutes`,
      dryRun: this.config.dryRun,
      maxBuysPerMinute: this.config.maxBuysPerMinute
    });
    this.process();
    this.intervalId = setInterval(() => this.process(), interval * 60 * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('[BuyRooms] Stopped');
  }

  async process() {
    if (this.processing) return;
    this.processing = true;
    this.stats.runs++;
    this.stats.lastRun = new Date();
    const startTime = Date.now();

    try {
      // Rate limit check
      const timeSinceLastBuy = Date.now() - this.lastBuyTime;
      const minInterval = 60000 / this.config.maxBuysPerMinute;
      if (timeSinceLastBuy < minInterval && this.lastBuyTime > 0) {
        return;
      }

      const pool = await getPool();

      // Get next opportunity to buy
      const result = await pool.request().query(`
        SELECT TOP 1
          o.OpportunityId, o.DestinationsId AS HotelId,
          o.CategoryId, o.BoardId,
          o.DateForm AS DateFrom, o.DateTo,
          o.Price AS BuyPrice, o.PushPrice, o.MaxRooms,
          o.Operator, o.FreeCancelation,
          h.Name AS HotelName, h.InnstantId, h.ZenithHotelCode,
          rc.Name AS CategoryName, rc.ZenithRoomCode,
          bd.Description AS BoardName
        FROM MED_Opportunities o
        INNER JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
        LEFT JOIN MED_RoomCategory rc ON o.CategoryId = rc.CategoryId
        LEFT JOIN MED_Board bd ON o.BoardId = bd.BoardId
        WHERE o.IsPurchased = 0 AND o.IsActive = 1
        ORDER BY o.DateUpdate ASC
      `);

      if (result.recordset.length === 0) {
        return; // No opportunities - silent return
      }

      const opp = result.recordset[0];
      this.stats.searched++;

      logger.info('[BuyRooms] Processing opportunity', {
        oppId: opp.OpportunityId,
        hotel: opp.HotelName,
        dates: `${this.formatDate(opp.DateFrom)} - ${this.formatDate(opp.DateTo)}`,
        buyPrice: opp.BuyPrice,
        pushPrice: opp.PushPrice,
        dryRun: this.config.dryRun
      });

      // Search suppliers
      if (!opp.InnstantId) {
        logger.warn('[BuyRooms] Hotel has no InnstantId, skipping', { hotel: opp.HotelName });
        this.stats.skipped++;
        await this.updateOpportunityTimestamp(pool, opp.OpportunityId);
        return;
      }

      const searchResult = await this.aggregator.searchAllSuppliers({
        hotelId: opp.InnstantId,
        dateFrom: this.formatDate(opp.DateFrom),
        dateTo: this.formatDate(opp.DateTo),
        adults: 2,
        children: []
      });

      if (!searchResult.success || !searchResult.hotels || searchResult.hotels.length === 0) {
        logger.info('[BuyRooms] No search results for opportunity', { oppId: opp.OpportunityId });
        this.stats.skipped++;
        await this.updateOpportunityTimestamp(pool, opp.OpportunityId);
        return;
      }

      // Find valid rooms: filter by category/board, validate cancellation, sort by price
      const validRoom = this.findBestRoom(searchResult.hotels, opp);

      if (!validRoom) {
        logger.info('[BuyRooms] No valid rooms found after filtering', { oppId: opp.OpportunityId });
        this.stats.skipped++;
        await this.updateOpportunityTimestamp(pool, opp.OpportunityId);
        return;
      }

      logger.info('[BuyRooms] Found valid room', {
        oppId: opp.OpportunityId,
        price: validRoom.price,
        supplier: validRoom.supplier,
        cancellation: validRoom.cancellationType
      });

      // DRY RUN - log but don't execute
      if (this.config.dryRun) {
        this.stats.dryRunActions++;
        logger.info('[BuyRooms] DRY RUN - Would purchase', {
          oppId: opp.OpportunityId,
          hotel: opp.HotelName,
          roomPrice: validRoom.price,
          buyTarget: opp.BuyPrice,
          pushPrice: opp.PushPrice,
          supplier: validRoom.supplier,
          margin: opp.PushPrice - validRoom.price
        });
        await this.updateOpportunityTimestamp(pool, opp.OpportunityId);
        return;
      }

      // LIVE PURCHASE FLOW
      await this.executePurchase(pool, opp, validRoom);

    } catch (error) {
      this.stats.failures++;
      this.stats.lastError = { message: error.message, time: new Date() };
      logger.error('[BuyRooms] Process error', { error: error.message, stack: error.stack });
    } finally {
      this.processing = false;
      const duration = Date.now() - startTime;
      if (duration > 2000) {
        logger.info('[BuyRooms] Cycle complete', { duration: `${duration}ms` });
      }
    }
  }

  findBestRoom(hotels, opportunity) {
    const validRooms = [];

    for (const hotel of hotels) {
      if (!hotel.rooms) continue;

      for (const room of hotel.rooms) {
        // Filter by category if specified
        if (opportunity.CategoryName && room.categoryName) {
          if (!room.categoryName.toLowerCase().includes(opportunity.CategoryName.toLowerCase())) {
            continue;
          }
        }

        // Filter by board if specified
        if (opportunity.BoardName && room.boardName) {
          if (!room.boardName.toLowerCase().includes(opportunity.BoardName.toLowerCase())) {
            continue;
          }
        }

        // Validate cancellation policy
        if (!this.isValidCancellation(room)) {
          continue;
        }

        // Check price is within buy target
        const roomPrice = room.price || room.totalPrice;
        if (roomPrice && roomPrice <= opportunity.BuyPrice) {
          validRooms.push({
            ...room,
            price: roomPrice,
            supplier: room.supplier || hotel.supplier || 'Unknown',
            hotelId: hotel.hotelId,
            searchToken: hotel.searchToken || room.searchToken
          });
        }
      }
    }

    // Sort by price ascending, return cheapest
    validRooms.sort((a, b) => a.price - b.price);
    return validRooms[0] || null;
  }

  isValidCancellation(room) {
    if (!room.cancellationPolicy) return true; // Allow if no policy info

    const policy = room.cancellationPolicy;

    // Check for free cancellation
    if (policy.frames && policy.frames.length > 0) {
      const firstFrame = policy.frames[0];
      if (firstFrame.penalty && firstFrame.penalty.amount > 0) {
        return false; // Has cancellation penalty
      }
    }

    // Check cancellation deadline is at least 1 day from now
    if (policy.deadline || room.cancellationDeadline) {
      const deadline = new Date(policy.deadline || room.cancellationDeadline);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (deadline < tomorrow) {
        return false; // Deadline too soon
      }
    }

    return true;
  }

  async executePurchase(pool, opportunity, room) {
    try {
      // Step 1: PreBook
      logger.info('[BuyRooms] Executing PreBook', { oppId: opportunity.OpportunityId, supplier: room.supplier });

      const preBookResult = await this.innstantClient.preBook({
        token: room.searchToken,
        room: room.roomId || room.id,
        hotelId: opportunity.InnstantId,
        checkIn: this.formatDate(opportunity.DateFrom),
        checkOut: this.formatDate(opportunity.DateTo),
        adults: 2,
        children: []
      });

      if (!preBookResult.success) {
        throw new Error(`PreBook failed: ${preBookResult.error}`);
      }

      // Insert MED_PreBook
      const preBookInsert = await pool.request()
        .input('oppId', sql.Int, opportunity.OpportunityId)
        .input('hotelId', sql.Int, opportunity.HotelId)
        .input('dateFrom', sql.DateTime, opportunity.DateFrom)
        .input('dateTo', sql.DateTime, opportunity.DateTo)
        .input('categoryId', sql.Int, opportunity.CategoryId)
        .input('boardId', sql.Int, opportunity.BoardId)
        .input('price', sql.Decimal(18, 2), room.price)
        .input('token', sql.NVarChar(sql.MAX), preBookResult.token || preBookResult.preBookId)
        .input('cancelType', sql.NVarChar(100), preBookResult.cancellationType || 'Free')
        .input('cancelTo', sql.DateTime, preBookResult.cancellationDeadline ? new Date(preBookResult.cancellationDeadline) : null)
        .input('providerId', sql.Int, 1) // Innstant
        .input('source', sql.Int, 2) // adults count
        .query(`
          INSERT INTO MED_PreBook
            (OpportunityId, HotelId, DateForm, DateTo, CategoryId, BoardId, Price, Token, CancellationType, CancellationTo, ProviderId, source, DateInsert)
          VALUES
            (@oppId, @hotelId, @dateFrom, @dateTo, @categoryId, @boardId, @price, @token, @cancelType, @cancelTo, @providerId, @source, GETDATE());
          SELECT SCOPE_IDENTITY() AS PreBookId;
        `);

      const preBookId = preBookInsert.recordset[0].PreBookId;

      // Step 2: Book (Confirm)
      logger.info('[BuyRooms] Executing Book', { preBookId, oppId: opportunity.OpportunityId });

      const bookResult = await this.innstantClient.book({
        preBookToken: preBookResult.token || preBookResult.preBookId,
        guest: {
          firstName: 'Medici',
          lastName: 'Hotels',
          email: 'order@medicihotels.com',
          phone: '050-9013028'
        }
      });

      if (!bookResult.success) {
        throw new Error(`Book failed: ${bookResult.error}`);
      }

      // Insert MED_Book
      const bookInsert = await pool.request()
        .input('preBookId', sql.Int, preBookId)
        .input('contentBookingId', sql.NVarChar(100), bookResult.bookingId || bookResult.confirmationNumber)
        .input('hotelId', sql.Int, opportunity.HotelId)
        .input('startDate', sql.DateTime, opportunity.DateFrom)
        .input('endDate', sql.DateTime, opportunity.DateTo)
        .input('price', sql.Decimal(18, 2), room.price)
        .input('pushPrice', sql.Decimal(18, 2), opportunity.PushPrice)
        .input('supplierRef', sql.NVarChar(100), bookResult.supplierReference || '')
        .input('cancelType', sql.NVarChar(100), preBookResult.cancellationType || 'Free')
        .input('cancelTo', sql.DateTime, preBookResult.cancellationDeadline ? new Date(preBookResult.cancellationDeadline) : null)
        .input('oppId', sql.Int, opportunity.OpportunityId)
        .query(`
          INSERT INTO MED_Book
            (PreBookId, contentBookingID, HotelId, startDate, endDate, price, lastPrice, pushPrice,
             IsSold, IsActive, Status, providers, supplierReference, CancellationType, CancellationTo,
             OpportunityId, DateInsert)
          VALUES
            (@preBookId, @contentBookingId, @hotelId, @startDate, @endDate, @price, @price, @pushPrice,
             0, 1, 'Confirmed', 'Innstant', @supplierRef, @cancelType, @cancelTo,
             @oppId, GETDATE());
          SELECT SCOPE_IDENTITY() AS BookId;
        `);

      const bookId = bookInsert.recordset[0].BookId;

      // Step 3: Update opportunity
      await pool.request()
        .input('oppId', sql.Int, opportunity.OpportunityId)
        .input('bookId', sql.Int, bookId)
        .query(`
          UPDATE MED_Opportunities
          SET IsPurchased = 1, BookId = @bookId, DateUpdate = GETDATE()
          WHERE OpportunityId = @oppId
        `);

      // Step 4: Queue for Zenith push
      await pool.request()
        .input('bookId', sql.Int, bookId)
        .input('oppId', sql.Int, opportunity.OpportunityId)
        .query(`
          INSERT INTO Med_HotelsToPush (BookId, OpportunityId, IsActive, DateInsert)
          VALUES (@bookId, @oppId, 1, GETDATE())
        `);

      // Step 5: Push to Zenith immediately
      if (opportunity.ZenithHotelCode && opportunity.ZenithRoomCode) {
        try {
          await zenithPushService.pushAvailability({
            hotelCode: opportunity.ZenithHotelCode,
            invTypeCode: opportunity.ZenithRoomCode,
            startDate: this.formatDate(opportunity.DateFrom),
            endDate: this.formatDate(opportunity.DateTo),
            available: 1
          });
          await zenithPushService.pushRate({
            hotelCode: opportunity.ZenithHotelCode,
            invTypeCode: opportunity.ZenithRoomCode,
            startDate: this.formatDate(opportunity.DateFrom),
            endDate: this.formatDate(opportunity.DateTo),
            amount: opportunity.PushPrice,
            currency: 'EUR'
          });
        } catch (zenithErr) {
          logger.error('[BuyRooms] Zenith push failed (non-blocking)', { error: zenithErr.message });
        }
      }

      // Step 6: Record and notify
      this.lastBuyTime = Date.now();
      this.stats.purchased++;
      this.stats.lastPurchase = {
        oppId: opportunity.OpportunityId,
        bookId,
        hotel: opportunity.HotelName,
        price: room.price,
        pushPrice: opportunity.PushPrice,
        margin: opportunity.PushPrice - room.price,
        time: new Date()
      };
      this.stats.lastSuccess = new Date();

      logger.info('[BuyRooms] Purchase complete', {
        oppId: opportunity.OpportunityId,
        bookId,
        hotel: opportunity.HotelName,
        buyPrice: room.price,
        pushPrice: opportunity.PushPrice,
        margin: (opportunity.PushPrice - room.price).toFixed(2)
      });

      try {
        await slackService.sendMessage(
          `*Room Purchased*\nHotel: ${opportunity.HotelName}\nOppId: ${opportunity.OpportunityId}\nBookId: ${bookId}\nBuy: ${room.price}\nPush: ${opportunity.PushPrice}\nMargin: ${(opportunity.PushPrice - room.price).toFixed(2)}\nDates: ${this.formatDate(opportunity.DateFrom)} - ${this.formatDate(opportunity.DateTo)}`
        );
      } catch (slackErr) { /* non-blocking */ }

    } catch (error) {
      this.stats.failures++;
      logger.error('[BuyRooms] Purchase failed', {
        oppId: opportunity.OpportunityId,
        hotel: opportunity.HotelName,
        error: error.message
      });

      try {
        await slackService.sendMessage(
          `*Room Purchase Failed*\nHotel: ${opportunity.HotelName}\nOppId: ${opportunity.OpportunityId}\nError: ${error.message}`
        );
      } catch (slackErr) { /* non-blocking */ }

      // Update opportunity timestamp so it doesn't retry immediately
      await this.updateOpportunityTimestamp(pool, opportunity.OpportunityId);
    }
  }

  async updateOpportunityTimestamp(pool, oppId) {
    try {
      await pool.request()
        .input('oppId', sql.Int, oppId)
        .query(`UPDATE MED_Opportunities SET DateUpdate = GETDATE() WHERE OpportunityId = @oppId`);
    } catch (err) {
      logger.error('[BuyRooms] Failed to update timestamp', { oppId, error: err.message });
    }
  }

  formatDate(date) {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // yyyy-mm-dd
  }

  getStatus() {
    return {
      name: 'buy-rooms',
      description: 'MediciBuyRooms - Automated room purchasing from suppliers',
      isRunning: this.isRunning,
      processing: this.processing,
      config: this.config,
      stats: this.stats
    };
  }
}

module.exports = new BuyRoomsWorker();
