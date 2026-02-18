/**
 * Activity Feed API - Real-time activity stream
 * Standalone add-on - no core changes required
 */

const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const logger = require('../config/logger');

// In-memory activity cache for fast access
let activityCache = [];
const MAX_CACHE_SIZE = 100;

/**
 * Add activity to cache (called from other services)
 */
function addActivity(activity) {
  const entry = {
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...activity
  };

  activityCache.unshift(entry);
  if (activityCache.length > MAX_CACHE_SIZE) {
    activityCache = activityCache.slice(0, MAX_CACHE_SIZE);
  }

  return entry;
}

/**
 * GET /activity-feed - Get recent activity
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 20, type } = req.query;
    const pool = await getPool();

    // Combine multiple activity sources
    const [bookings, opportunities, searches] = await Promise.all([
      // Recent bookings
      pool.request().query(`
        SELECT TOP 10
          'booking' as type,
          id,
          HotelName as title,
          CONCAT('Booked for ', FORMAT(price, 'C', 'en-US')) as description,
          DateInsert as timestamp,
          CASE WHEN IsSold = 1 THEN 'success' WHEN IsActive = 0 THEN 'warning' ELSE 'info' END as status
        FROM MED_Book
        WHERE DateInsert >= DATEADD(HOUR, -24, GETDATE())
        ORDER BY DateInsert DESC
      `),

      // Recent opportunities
      pool.request().query(`
        SELECT TOP 10
          'opportunity' as type,
          Id as id,
          HotelName as title,
          CONCAT(
            'Profit potential: ',
            FORMAT(ISNULL(SuggestedSellPrice, 0) - ISNULL(SuggestedBuyPrice, 0), 'C', 'en-US')
          ) as description,
          DateCreate as timestamp,
          CASE
            WHEN IsSale = 1 THEN 'success'
            WHEN IsActive = 1 THEN 'info'
            ELSE 'muted'
          END as status
        FROM [MED_Opportunities]
        WHERE DateCreate >= DATEADD(HOUR, -24, GETDATE())
        ORDER BY DateCreate DESC
      `),

      // Recent searches (from logs if available)
      pool.request().query(`
        SELECT TOP 10
          'search' as type,
          id,
          CONCAT(Destination, ' - ', FORMAT(CheckIn, 'MMM dd')) as title,
          CONCAT(ResultCount, ' results found') as description,
          CreatedAt as timestamp,
          'info' as status
        FROM MED_SearchLog
        WHERE CreatedAt >= DATEADD(HOUR, -24, GETDATE())
        ORDER BY CreatedAt DESC
      `).catch(() => ({ recordset: [] })) // Table might not exist
    ]);

    // Merge and sort all activities
    let activities = [
      ...bookings.recordset,
      ...opportunities.recordset,
      ...searches.recordset,
      ...activityCache
    ];

    // Filter by type if specified
    if (type) {
      activities = activities.filter(a => a.type === type);
    }

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Limit results
    activities = activities.slice(0, parseInt(limit));

    res.json({
      success: true,
      count: activities.length,
      activities: activities.map(a => ({
        id: a.id,
        type: a.type,
        title: a.title,
        description: a.description,
        timestamp: a.timestamp,
        status: a.status,
        icon: getIconForType(a.type)
      }))
    });

  } catch (error) {
    logger.error('Failed to get activity feed', { error: error.message });
    res.status(500).json({ error: 'Failed to get activity feed' });
  }
});

/**
 * GET /activity-feed/stats - Get activity statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const pool = await getPool();

    const [todayStats, weekStats] = await Promise.all([
      pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM MED_Book WHERE DateInsert >= CAST(GETDATE() AS DATE)) as TodayBookings,
          (SELECT COUNT(*) FROM [MED_Opportunities] WHERE DateCreate >= CAST(GETDATE() AS DATE)) as TodayOpportunities,
          (SELECT SUM(price) FROM MED_Book WHERE DateInsert >= CAST(GETDATE() AS DATE) AND IsSold = 1) as TodayRevenue
      `),
      pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM MED_Book WHERE DateInsert >= DATEADD(DAY, -7, GETDATE())) as WeekBookings,
          (SELECT COUNT(*) FROM [MED_Opportunities] WHERE DateCreate >= DATEADD(DAY, -7, GETDATE())) as WeekOpportunities
      `)
    ]);

    res.json({
      success: true,
      today: todayStats.recordset[0],
      week: weekStats.recordset[0]
    });

  } catch (error) {
    logger.error('Failed to get activity stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get activity stats' });
  }
});

/**
 * POST /activity-feed - Add custom activity
 */
router.post('/', (req, res) => {
  try {
    const { type, title, description, status = 'info' } = req.body;

    if (!type || !title) {
      return res.status(400).json({ error: 'type and title required' });
    }

    const activity = addActivity({ type, title, description, status });

    res.json({
      success: true,
      activity
    });

  } catch (error) {
    logger.error('Failed to add activity', { error: error.message });
    res.status(500).json({ error: 'Failed to add activity' });
  }
});

function getIconForType(type) {
  const icons = {
    booking: 'hotel',
    opportunity: 'trending_up',
    search: 'search',
    alert: 'warning',
    system: 'settings',
    user: 'person'
  };
  return icons[type] || 'info';
}

// Export for use by other services
router.addActivity = addActivity;

module.exports = router;
