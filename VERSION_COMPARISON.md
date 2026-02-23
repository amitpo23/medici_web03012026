# Medici Hotels - DEV vs Production Gap Analysis
**Generated: 2026-02-23**
**DEV: Node.js Express | Production: C# .NET ASP.NET Core**

---

## Executive Summary

| Metric | Production (C#) | DEV (Node.js) | Status |
|--------|-----------------|---------------|--------|
| API Endpoints | 34 (10 controllers) | 350+ (43 route files) | DEV >> Production |
| Background Services | 6 Windows Services | 0 (none implemented) | MISSING IN DEV |
| Database Tables Used | 40 EF-mapped | 70+ referenced | DEV > Production |
| External APIs | Innstant, GoGlobal, Zenith | Innstant, GoGlobal, Zenith + AI | DEV > Production |
| AI/ML Features | 0 | 7 modules | DEV ONLY |
| Analytics/Reports | Basic (via controllers) | Advanced (10+ modules) | DEV >> Production |

---

## 1. API ENDPOINTS - Detailed Comparison

### Production C# Controllers (10 controllers, 34 endpoints)

| Controller | Endpoints | DEV Equivalent | Status |
|------------|-----------|----------------|--------|
| BookController (3 GET, 1 POST, 2 DELETE) | GetBookings, GetCanceled, CancelBooking, UpdatePrice, PreBook, Confirm | `bookings.js` (11 endpoints) | COVERED + EXTENDED |
| OpportunityController (10 GET, 1 POST) | GetOpportunities, InsertOpp, GetHotels, GetBoards, GetCategories, CancelOpp, GetLog | `opportunities.js` (9 endpoints) | COVERED |
| SalesRoomController (5 GET, 1 POST) | GetAllSales, GetSalesRoomDetails, GetReservationDetails | `zenith.js` sales-overview, salesroom.js | COVERED |
| ReservationController (4 GET) | ReservationCancel, GetDetails, ReservationModify, Log | `reservations.js` (4 endpoints) | COVERED |
| ErrorsController (4 GET) | CancelBookErrors, BookErrors, GetCancelBookError | `errors.js` (3 endpoints) | COVERED |
| SearchController (1 POST) | SearchHotels | `search.js` (4 endpoints) | COVERED + EXTENDED |
| NotificationsController (1 POST) | SendNotification | `alert-management.js` | COVERED (different approach) |
| MiscController (1 GET) | HealthCheck | `health.js` (11 endpoints) | COVERED + EXTENDED |
| ZenithApiController (330 lines) | OTA_HotelResNotifRQ, Push/Receive | `zenith.js` (22 endpoints) | COVERED + EXTENDED |
| AuthController (0 - disabled) | - | `auth.js` (1 endpoint) | COVERED (JWT) |

**Result: ALL 34 production endpoints are covered in DEV, plus 316+ additional endpoints.**

---

## 2. BACKGROUND SERVICES - Gap Analysis

### CRITICAL: 6 Production Services NOT in DEV

| # | Service | Production (C#) | DEV Status | Priority |
|---|---------|-----------------|------------|----------|
| 1 | **MediciBuyRooms** | Infinite loop, polls opportunities, searches suppliers, buys rooms, pushes to Zenith | NOT IMPLEMENTED | CRITICAL |
| 2 | **MediciAutoCancellation** | Auto-cancels unsold rooms near deadline | NOT IMPLEMENTED | CRITICAL |
| 3 | **WebHotel** | Polls Queue every 3s, scrapes hotel.tools via Selenium, verifies prices | NOT IMPLEMENTED | HIGH |
| 4 | **WebHotelRevise** | Monthly batch audit of all bookings vs hotel.tools | NOT IMPLEMENTED | MEDIUM |
| 5 | **ProcessRevisedFile** | Reads problem CSV, pushes corrected availability | NOT IMPLEMENTED | MEDIUM |
| 6 | **WebInnstant** | Scrapes Innstant for cancelled bookings | NOT IMPLEMENTED | LOW |

### What DEV Has Instead (Partial Coverage)
- `zenith.js` has push-batch, process-queue, push-availability, push-rate endpoints (manual triggers, not automated loops)
- `search.js` has multi-supplier search (manual, not automated buying loop)
- `bookings.js` has CancelBooking endpoint (manual, not automated deadline checking)
- `alerts.js` has background scanning (but for alerts, not room purchasing)

### Gap Detail for Each Service:

#### MediciBuyRooms (CRITICAL)
**What Production Does:**
1. `while(true)` polls `MED_Opportunities` via `GetNextOpportunityToBuy()` (ordered by lastUpdate)
2. For each source (Innstant=1, GoGlobal=2), resolves hotel ID
3. Searches via `ApiInstant.SearchHotels()` or `ApiGoGlobal.SearchHotels()`
4. Filters by category/board/bedding via `BuyRoomControl.BookRooms()`
5. Validates free cancellation (penalty.amount == 0, start date <= today+1)
6. Sorts by price ascending, books cheapest
7. PreBook -> Book -> Insert MED_PreBook/MED_Book
8. Push rates + availability to Zenith
9. Add to Queue for verification
10. Sleep 2s between, 200s when idle

**What DEV Has:**
- Manual search via `search.js /MultiSupplier`
- Manual booking via `bookings.js /ManualBook`
- Manual push via `zenith.js /direct-push`
- NO automated loop, NO automated filtering/validation, NO automated buy flow

#### MediciAutoCancellation (CRITICAL)
**What Production Does:**
1. Calls `GetBookIdsToCancel()` - finds bookings near free-cancellation deadline
2. For each: `CancelBooking_v2(preBookId, false)` via Innstant/GoGlobal API
3. On failure: Slack + SendGrid email "Please cancel manually this rooms"

**What DEV Has:**
- Manual cancel via `bookings.js /CancelBooking` or `/CancelDirect`
- NO deadline monitoring, NO auto-cancellation loop, NO failure alerting

#### WebHotel (HIGH)
**What Production Does:**
1. Polls `Queue` every 3 seconds
2. Builds `HotelToolsSearchRequest` (hotel, category, board, month/year)
3. Scrapes hotel.tools via Selenium WebDriver
4. Compares expected vs actual price (truncated to 1 decimal)
5. Logs SUCCESS/error, sends notifications

**What DEV Has:**
- `zenith.js /queue-status` (read queue)
- `zenith.js /process-queue` (manual trigger)
- NO Selenium scraping, NO automated verification loop

#### WebHotelRevise (MEDIUM)
**What Production Does:**
1. Gets all bookings, groups by hotel->category->board
2. For each group/month: scrapes hotel.tools
3. Compares reservation counts
4. Outputs `problem_items.csv`

**What DEV Has:** Nothing equivalent

#### ProcessRevisedFile (MEDIUM)
**What Production Does:**
1. Reads `problem_items.csv`
2. For missing records: pushes zero availability to Zenith

**What DEV Has:** Nothing equivalent

#### WebInnstant (LOW)
**What Production Does:**
1. Scrapes Innstant for cancelled bookings
2. Exports CSV

**What DEV Has:** `cancellations.js` provides analytics on cancellations but no scraping

---

## 3. DATABASE OPERATIONS - Gap Analysis

### Repository Operations (Production C# - 60+ methods)

| Operation Category | Production Methods | DEV Coverage | Status |
|---|---|---|---|
| **Opportunity CRUD** | GetNextOpportunityToBuy, SearchOpportunity, InsertOpp, CancelOpportunity, UpdateOpportunityIdlastUpdate | opportunities.js: InsertOpp, CancelOpp, GetOpportunities | PARTIAL - missing GetNext auto-buy logic |
| **Booking Lifecycle** | InsertPreBook, InsertBook, GetAllBookings, CancelBooking, CancelBooking_v2, SetCancelStatus, GetBookIdsToCancel | bookings.js: PreBook, Confirm, ManualBook, CancelBooking, CancelDirect | COVERED |
| **Reservation Processing** | InsertReservation, InsertReservationCancel, InsertReservationModify, InsertReservationCustomerName/MoreInfo, GetMedReservationByUniqueId, SetMedReservationCancelStatus, UpdateBookApprovedReservation | zenith.js: receiveReservation, receiveCancellation, approveReservation | COVERED |
| **Zenith Push** | GetAllHotelsToPush, GetPushRoom, PushAvailabilityAndRestrictions, UpdatePushPrice | zenith.js: push-batch, push-availability, push-rate, direct-push | COVERED |
| **Queue Management** | AddToQueue, GetNextQueueItemToProcess, UpdateQueueItem | zenith.js: process-queue, queue-status | PARTIAL - no auto-processing |
| **Room Availability** | FindAvailableRoomCount, FindAvailableRoom | zenith.js: available-rooms | COVERED |
| **Back Office** | GetAllSales, GetAllReservations, GetAllPurchased, GetAllSold, GetSalesRoomDetails | zenith.js: sales-overview, salesroom.js | COVERED |
| **Lookup Data** | GetHotels, GetCategories, GetBoards, GetCategoriesAndBoards, GetAllSource | opportunities.js, data-explorer.js | COVERED |
| **Customer Creation** | Random first/last from MED_CustomerFNames/LNames, random birthdate 1975-1999, fixed address | search.js (creates customer for booking) | COVERED |
| **Error Handling** | InsertBookError, GetBookErrors, GetCancelBookErrors, SaveBookError | errors.js: CancelBookErrors, BookErrors | COVERED |
| **Health/Infra** | HealthCheck, PublishToSlack | health.js, alert-management.js | COVERED |

---

## 4. EXTERNAL API INTEGRATION - Gap Analysis

| API | Production (C#) | DEV (Node.js) | Status |
|-----|-----------------|---------------|--------|
| **Innstant Search** | JSON POST to connect.mishor5, poll until done | search.js: InnstantPrice, MultiSupplier | COVERED |
| **Innstant Book** | PreBook + Book via book.mishor5 | bookings.js: PreBook, Confirm | COVERED |
| **Innstant Cancel** | booking-cancel endpoint | bookings.js: CancelBooking | COVERED |
| **GoGlobal Search** | SOAP XML to xml.qa.goglobal | search.js: MultiSupplier | COVERED |
| **GoGlobal Book** | SOAP BOOKING_INSERT_REQUEST | bookings.js (partial) | PARTIAL |
| **GoGlobal Cancel** | SOAP BOOKING_CANCEL_REQUEST | bookings.js (partial) | PARTIAL |
| **Zenith PushRates** | OTA_HotelRateAmountNotifRQ | zenith.js: push-rate | COVERED |
| **Zenith PushAvailability** | OTA_HotelAvailNotifRQ | zenith.js: push-availability | COVERED |
| **Zenith Receive Reservations** | OTA_HotelResNotifRQ | zenith.js: receiveReservation | COVERED |
| **Zenith Receive Cancellations** | OTA_CancelRQ | zenith.js: receiveCancellation | COVERED |
| **Slack** | PublishToSlack webhook | alert-management.js, various | COVERED |
| **SendGrid Email** | BaseNotifications.SendEmail | Not directly (uses alerts) | PARTIAL |
| **Twilio SMS** | BaseNotifications.SendSms | Not implemented | MISSING |
| **Selenium/WebDriver** | Scrapes hotel.tools for verification | Not implemented | MISSING |

---

## 5. FEATURES ONLY IN DEV (Not in Production)

| Feature | Route File | Endpoints | Purpose |
|---------|-----------|-----------|---------|
| **AI Chat (NL-to-SQL)** | ai-chat.js | 6 | Natural language database queries via GPT-4 |
| **AI Predictions** | ai-prediction.js | 12 | ML demand/price forecasting |
| **AI RAG** | ai-rag.js | 11 | Semantic search via Pinecone vectors |
| **AI Commands** | ai-command.js | 9 | Voice/text AI command center |
| **AI Opportunities** | ai-opportunities.js | 6 | AI-discovered market opportunities |
| **Advanced Pricing** | advanced-pricing.js | 13 | ML pricing optimization, elasticity |
| **Pricing Strategies** | pricing.js | 7 | 5 dynamic pricing strategies |
| **Revenue Analytics** | revenue-analytics.js | ~10 | Revenue optimization insights |
| **Search Intelligence** | search-intelligence.js | ~8 | Search pattern analysis |
| **Trading Exchange** | trading-exchange.js | ~15 | Room trading marketplace |
| **Data Explorer** | data-explorer.js | 14 | Universal database browser (70 tables) |
| **Data Sync** | data-sync.js | 6 | External data synchronization |
| **Database Catalog** | (module) | ~5 | Database schema browser |
| **Documents** | documents.js | 3 | PDF confirmation generation |
| **Workflows** | workflows.js | ~8 | Business process automation |
| **Scraper** | scraper.js | ~5 | Web scraping tools |
| **Monitoring** | monitoring.js | ~8 | System performance monitoring |
| **Diagnostics** | diagnostics.js | 5 | Deep system health checks |
| **Azure Infrastructure** | azure-infrastructure.js | 13 | Azure cloud management |
| **Logs & Diagnostics** | (module) | ~6 | Log viewing and analysis |
| **Activity Feed** | activity-feed.js | 3 | Real-time activity stream |
| **Cancellation Analytics** | cancellations.js | 6 | Cancellation trend analysis |

**Total DEV-only features: 22 modules, 200+ endpoints**

---

## 6. PRIORITY ACTION ITEMS

### CRITICAL (Must implement for production parity)
1. **MediciBuyRooms Worker** - Automated room purchasing loop
   - Polling MED_Opportunities
   - Multi-supplier search (Innstant + GoGlobal)
   - Category/board/bedding filtering
   - Free cancellation validation
   - Cheapest room selection and booking
   - Auto-push to Zenith after booking
   - Queue for verification

2. **MediciAutoCancellation Worker** - Automated deadline cancellation
   - Monitor bookings near free-cancellation deadline
   - Cancel via supplier API
   - Slack + Email on failure

### HIGH PRIORITY
3. **WebHotel Verification Worker** - Snapshot price checking
   - Poll Queue every 3 seconds
   - Price comparison engine
   - (Can replace Selenium with API-based approach)

4. **GoGlobal Full Integration** - Complete SOAP support
   - Booking, cancellation, status check, amendment

5. **Email Notifications** - SendGrid integration for alerts
6. **SMS Notifications** - Twilio integration (optional)

### MEDIUM PRIORITY
7. **WebHotelRevise** - Monthly audit batch job
8. **ProcessRevisedFile** - Auto-fix availability discrepancies

### LOW PRIORITY
9. **WebInnstant** - Cancellation tracking scraper
10. **Selenium WebDriver** - hotel.tools scraping (consider API alternative)

---

## 7. ARCHITECTURE COMPARISON

```
PRODUCTION (C# .NET)                    DEV (Node.js)
===================                    ==============

ASP.NET Core Web API                   Express.js API Server
  10 Controllers                         43 Route Files
  34 Endpoints                           350+ Endpoints
  Entity Framework                       Direct SQL (mssql)

6 Windows Services                     NO Background Workers
  MediciBuyRooms                         (manual endpoints only)
  MediciAutoCancellation
  WebHotel
  WebHotelRevise
  ProcessRevisedFile
  WebInnstant

SharedLibrary (Repository)             Services (37 files)
  60+ DB operations                      100+ service functions
  BuyRoomControl                         (no equivalent)
  PushRoomControl                        zenith-push-service.js

External APIs                          External APIs + AI
  Innstant (REST)                        Innstant (REST)
  GoGlobal (SOAP)                        GoGlobal (partial SOAP)
  Zenith (SOAP OTA)                      Zenith (SOAP OTA)
  SendGrid, Twilio, Slack                Slack, Azure OpenAI, Pinecone

No AI/ML                               7 AI/ML Modules
No Analytics Dashboard                 10+ Analytics Modules
No Data Explorer                       Universal Data Explorer
No Document Generation                 PDF Generation
```

---

## 8. DATABASE TABLE COVERAGE

### Tables Used by BOTH Production & DEV
- MED_Book, MED_PreBook, MED_Opportunities, Med_Hotels
- Med_Reservation, Med_ReservationCancel, Med_ReservationModify
- MED_CancelBook, MED_CancelBookError, MED_BookError
- MED_Board, MED_RoomCategory, MED_Currency, Med_Source
- Med_HotelsToPush, Queue, BackOfficeOptLog
- MED_SearchHotels, Destinations, DestinationsHotels
- SalesOffice.Log, RoomPriceUpdateLog
- Med_Users, MED_ReservationNotificationLog

### Tables Used ONLY by Production
- BackOfficeOpt (monitoring config - used by WebHotel)
- MedHotelsRatebycat (Zenith rate mapping)
- MedHotelRate (rate lookup)
- MedHotelsInstant (Innstant hotel mapping)
- MedCustomerFname / MedCustomerLname (random customer generation)
- MedBookCustomerMoreInfo / MedBookCustomerName
- MedReservationCustomerMoreInfo / MedReservationCustomerName
- MedReservationModifyCustomerMoreInfo / MedReservationModifyCustomerName
- MedRoomBedding, MedRoomConfirmation
- MedLog, Tprice, Basic

### Tables Used ONLY by DEV
- AI_Search_HotelData (AI training)
- SearchResultsSessionPollLog (search analytics)
- MED_SearchPatterns (search intelligence)
- MED_PriceHistory (pricing analytics)
- MED_DashboardSnapshots (data sync)
- MED_RoomAvailability (availability tracking)
- MED_PushLog (Zenith push tracking)
- MED_OpportunityLogs (opportunity audit trail)
- MED_ReservationLogs (reservation audit trail)

---

## 9. VERSIONING

### Current Version: v1.0.0 (Initial Platform)
- Commit: `0c3efba` - "feat: comprehensive platform upgrade"
- 158 files, 25,665 insertions

### Version History
| Version | Date | Commit | Description |
|---------|------|--------|-------------|
| v0.1.0 | 2026-01 | Initial | Base Node.js backend + Angular frontend |
| v0.5.0 | 2026-02 | Various | Added AI, analytics, trading modules |
| v1.0.0 | 2026-02-22 | `0c3efba` | Full platform - 43 routes, 12 new modules |
| v1.1.0 | TBD | - | Background workers (MediciBuyRooms, AutoCancel) |
| v2.0.0 | TBD | - | Full production parity + AI enhancements |

---

## 10. CONCLUSION

**DEV surpasses Production in:**
- API surface area (350+ vs 34 endpoints)
- AI/ML capabilities (7 modules vs 0)
- Analytics and reporting
- Data exploration and admin tools
- Document generation

**Production has features DEV lacks:**
- 6 automated background workers (CRITICAL gap)
- Complete GoGlobal SOAP integration
- Selenium-based price verification
- Email (SendGrid) and SMS (Twilio) notifications
- Automated room purchasing pipeline

**Next Steps:**
1. Implement MediciBuyRooms worker in Node.js
2. Implement MediciAutoCancellation worker
3. Complete GoGlobal SOAP integration
4. Add WebHotel verification (API-based alternative)
5. Add email/SMS notification services
