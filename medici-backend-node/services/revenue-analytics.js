/**
 * Revenue Analytics Service
 * Provides comprehensive revenue and profit analysis
 */

const { getPool } = require('../config/database');
const logger = require('../config/logger');

class RevenueAnalyticsService {
  
  /**
   * Get daily P&L summary
   */
  async getDailySummary(startDate, endDate) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input('startDate', startDate)
        .input('endDate', endDate)
        .query(`
          SELECT 
            CAST(DateCreate AS DATE) as date,
            COUNT(*) as bookings_count,
            SUM(PushPrice) as total_revenue,
            SUM(Price) as total_cost,
            SUM(PushPrice - Price) as total_profit,
            AVG(PushPrice - Price) as avg_profit_per_booking,
            CASE 
              WHEN SUM(PushPrice) > 0 
              THEN (SUM(PushPrice - Price) / SUM(PushPrice) * 100)
              ELSE 0 
            END as profit_margin_percent
          FROM [MED_ֹOֹֹpportunities]
          WHERE IsSale = 1 
          AND DateCreate >= @startDate 
          AND DateCreate < @endDate
          GROUP BY CAST(DateCreate AS DATE)
          ORDER BY date DESC
        `);

      return result.recordset.map(row => ({
        date: row.date,
        bookings_count: row.bookings_count,
        total_revenue: parseFloat(row.total_revenue || 0),
        total_cost: parseFloat(row.total_cost || 0),
        total_profit: parseFloat(row.total_profit || 0),
        avg_profit_per_booking: parseFloat(row.avg_profit_per_booking || 0),
        profit_margin_percent: parseFloat(row.profit_margin_percent || 0)
      }));
    } catch (error) {
      logger.error('Failed to get daily summary', { error: error.message });
      throw error;
    }
  }

  /**
   * Get revenue breakdown by city
   */
  async getRevenueByCity(days = 30) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input('days', days)
        .query(`
          SELECT 
            o.DestinationsId as city,
            h.name as city_name,
            COUNT(*) as bookings_count,
            SUM(o.PushPrice) as total_revenue,
            SUM(o.Price) as total_cost,
            SUM(o.PushPrice - o.Price) as total_profit,
            AVG(o.PushPrice - o.Price) as avg_profit,
            CASE 
              WHEN SUM(o.PushPrice) > 0 
              THEN (SUM(o.PushPrice - o.Price) / SUM(o.PushPrice) * 100)
              ELSE 0 
            END as profit_margin
          FROM [MED_ֹOֹֹpportunities] o
          LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
          WHERE o.IsSale = 1 
          AND o.DateCreate >= DATEADD(DAY, -@days, GETDATE())
          GROUP BY o.DestinationsId, h.name
          ORDER BY total_profit DESC
        `);

      return result.recordset.map(row => ({
        city: row.city,
        bookings_count: row.bookings_count,
        total_revenue: parseFloat(row.total_revenue || 0),
        total_cost: parseFloat(row.total_cost || 0),
        total_profit: parseFloat(row.total_profit || 0),
        avg_profit: parseFloat(row.avg_profit || 0),
        profit_margin: parseFloat(row.profit_margin || 0)
      }));
    } catch (error) {
      logger.error('Failed to get revenue by city', { error: error.message });
      throw error;
    }
  }

  /**
   * Get revenue breakdown by hotel
   */
  async getRevenueByHotel(days = 30) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input('days', days)
        .query(`
          SELECT TOP 20
            ISNULL(h.name, 'Unknown Hotel') as hotel,
            o.DestinationsId as hotel_id,
            COUNT(*) as bookings_count,
            SUM(o.PushPrice) as total_revenue,
            SUM(o.PushPrice - o.Price) as total_profit,
            AVG(o.PushPrice - o.Price) as avg_profit,
            CASE 
              WHEN SUM(o.PushPrice) > 0 
              THEN (SUM(o.PushPrice - o.Price) / SUM(o.PushPrice) * 100)
              ELSE 0 
            END as profit_margin
          FROM [MED_ֹOֹֹpportunities] o
          LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
          WHERE o.IsSale = 1 
          AND o.DateCreate >= DATEADD(DAY, -@days, GETDATE())
          GROUP BY h.name, o.DestinationsId
          ORDER BY total_profit DESC
        `);

      return result.recordset.map(row => ({
        hotel: row.hotel,
        hotel_id: row.hotel_id,
        bookings_count: row.bookings_count,
        total_revenue: parseFloat(row.total_revenue || 0),
        total_profit: parseFloat(row.total_profit || 0),
        avg_profit: parseFloat(row.avg_profit || 0),
        profit_margin: parseFloat(row.profit_margin || 0)
      }));
    } catch (error) {
      logger.error('Failed to get revenue by hotel', { error: error.message });
      throw error;
    }
  }

  /**
   * Get revenue breakdown by supplier
   */
  async getRevenueBySupplier(days = 30) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input('days', days)
        .query(`
          SELECT 
            ISNULL(Operator, 'Unknown') as supplier,
            COUNT(*) as bookings_count,
            SUM(PushPrice) as total_revenue,
            SUM(PushPrice - Price) as total_profit,
            AVG(PushPrice - Price) as avg_profit,
            CASE 
              WHEN SUM(PushPrice) > 0 
              THEN (SUM(PushPrice - Price) / SUM(PushPrice) * 100)
              ELSE 0 
            END as profit_margin
          FROM [MED_ֹOֹֹpportunities]
          WHERE IsSale = 1 
          AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
          GROUP BY Operator
          ORDER BY total_profit DESC
        `);

      return result.recordset.map(row => ({
        supplier: row.supplier,
        bookings_count: row.bookings_count,
        total_revenue: parseFloat(row.total_revenue || 0),
        total_profit: parseFloat(row.total_profit || 0),
        avg_profit: parseFloat(row.avg_profit || 0),
        profit_margin: parseFloat(row.profit_margin || 0)
      }));
    } catch (error) {
      logger.error('Failed to get revenue by supplier', { error: error.message });
      throw error;
    }
  }

  /**
   * Get overall KPIs
   */
  async getKPIs(days = 30) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input('days', days)
        .query(`
          WITH CurrentPeriod AS (
            SELECT 
              COUNT(*) as bookings,
              SUM(PushPrice) as revenue,
              SUM(Price) as cost,
              SUM(PushPrice - Price) as profit,
              AVG(PushPrice) as avg_booking_value,
              AVG(PushPrice - Price) as avg_profit_per_booking
            FROM [MED_ֹOֹֹpportunities]
            WHERE IsSale = 1 
            AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
          ),
          PreviousPeriod AS (
            SELECT 
              COUNT(*) as bookings,
              SUM(PushPrice) as revenue,
              SUM(PushPrice - Price) as profit
            FROM [MED_ֹOֹֹpportunities]
            WHERE IsSale = 1 
            AND DateCreate >= DATEADD(DAY, -@days * 2, GETDATE())
            AND DateCreate < DATEADD(DAY, -@days, GETDATE())
          )
          SELECT 
            c.bookings as current_bookings,
            c.revenue as current_revenue,
            c.cost as current_cost,
            c.profit as current_profit,
            c.avg_booking_value,
            c.avg_profit_per_booking,
            p.bookings as previous_bookings,
            p.revenue as previous_revenue,
            p.profit as previous_profit,
            CASE 
              WHEN c.revenue > 0 
              THEN (c.profit / c.revenue * 100)
              ELSE 0 
            END as profit_margin,
            CASE 
              WHEN p.bookings > 0 
              THEN ((c.bookings - p.bookings) * 100.0 / p.bookings)
              ELSE 0 
            END as bookings_growth,
            CASE 
              WHEN p.revenue > 0 
              THEN ((c.revenue - p.revenue) * 100.0 / p.revenue)
              ELSE 0 
            END as revenue_growth,
            CASE 
              WHEN p.profit > 0 
              THEN ((c.profit - p.profit) * 100.0 / p.profit)
              ELSE 0 
            END as profit_growth
          FROM CurrentPeriod c, PreviousPeriod p
        `);

      const row = result.recordset[0];
      
      return {
        current: {
          bookings: row.current_bookings,
          revenue: parseFloat(row.current_revenue || 0),
          cost: parseFloat(row.current_cost || 0),
          profit: parseFloat(row.current_profit || 0),
          avg_booking_value: parseFloat(row.avg_booking_value || 0),
          avg_profit_per_booking: parseFloat(row.avg_profit_per_booking || 0),
          profit_margin: parseFloat(row.profit_margin || 0)
        },
        previous: {
          bookings: row.previous_bookings,
          revenue: parseFloat(row.previous_revenue || 0),
          profit: parseFloat(row.previous_profit || 0)
        },
        growth: {
          bookings: parseFloat(row.bookings_growth || 0),
          revenue: parseFloat(row.revenue_growth || 0),
          profit: parseFloat(row.profit_growth || 0)
        }
      };
    } catch (error) {
      logger.error('Failed to get KPIs', { error: error.message });
      throw error;
    }
  }

  /**
   * Get simple forecast (based on recent trends)
   */
  async getForecast(days = 7) {
    try {
      const pool = await getPool();
      
      // Get last 30 days data for trend calculation
      const historicalResult = await pool.request().query(`
        SELECT 
          CAST(DateCreate AS DATE) as date,
          SUM(PushPrice) as revenue,
          SUM(PushPrice - Price) as profit,
          COUNT(*) as bookings
        FROM [MED_ֹOֹֹpportunities]
        WHERE IsSale = 1 
        AND DateCreate >= DATEADD(DAY, -30, GETDATE())
        GROUP BY CAST(DateCreate AS DATE)
        ORDER BY date DESC
      `);

      const historical = historicalResult.recordset;
      
      if (historical.length === 0) {
        return {
          forecast_days: days,
          forecasted_revenue: 0,
          forecasted_profit: 0,
          forecasted_bookings: 0,
          confidence: 'low',
          based_on_days: 0
        };
      }

      // Simple moving average forecast
      const avgDailyRevenue = historical.reduce((sum, day) => sum + parseFloat(day.revenue || 0), 0) / historical.length;
      const avgDailyProfit = historical.reduce((sum, day) => sum + parseFloat(day.profit || 0), 0) / historical.length;
      const avgDailyBookings = historical.reduce((sum, day) => sum + day.bookings, 0) / historical.length;

      return {
        forecast_days: days,
        forecasted_revenue: avgDailyRevenue * days,
        forecasted_profit: avgDailyProfit * days,
        forecasted_bookings: Math.round(avgDailyBookings * days),
        confidence: historical.length >= 30 ? 'high' : historical.length >= 14 ? 'medium' : 'low',
        based_on_days: historical.length,
        daily_averages: {
          revenue: avgDailyRevenue,
          profit: avgDailyProfit,
          bookings: avgDailyBookings
        }
      };
    } catch (error) {
      logger.error('Failed to get forecast', { error: error.message });
      throw error;
    }
  }

  /**
   * Get top performers (best hotels/cities)
   */
  async getTopPerformers(days = 30, limit = 5) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input('days', days)
        .input('limit', limit)
        .query(`
          WITH HotelPerformance AS (
            SELECT TOP (@limit)
              ISNULL(h.name, 'Unknown Hotel') as name,
              'hotel' as type,
              SUM(o.PushPrice - o.Price) as total_profit,
              COUNT(*) as bookings
            FROM [MED_ֹOֹֹpportunities] o
            LEFT JOIN Med_Hotels h ON o.DestinationsId = h.HotelId
            WHERE o.IsSale = 1 
            AND o.DateCreate >= DATEADD(DAY, -@days, GETDATE())
            GROUP BY h.name
            ORDER BY SUM(o.PushPrice - o.Price) DESC
          ),
          OperatorPerformance AS (
            SELECT TOP (@limit)
              ISNULL(Operator, 'Unknown') as name,
              'operator' as type,
              SUM(PushPrice - Price) as total_profit,
              COUNT(*) as bookings
            FROM [MED_ֹOֹֹpportunities]
            WHERE IsSale = 1 
            AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
            GROUP BY Operator
            ORDER BY SUM(PushPrice - Price) DESC
          )
          SELECT * FROM HotelPerformance
          UNION ALL
          SELECT * FROM OperatorPerformance
          ORDER BY total_profit DESC
        `);

      return result.recordset.map(row => ({
        name: row.name,
        type: row.type,
        total_profit: parseFloat(row.total_profit || 0),
        bookings: row.bookings
      }));
    } catch (error) {
      logger.error('Failed to get top performers', { error: error.message });
      throw error;
    }
  }

  /**
   * Get revenue trends (hourly/daily)
   */
  async getRevenueTrends(period = 'daily', days = 30) {
    try {
      const pool = await getPool();
      
      let groupByClause, dateFormat;
      
      if (period === 'hourly' && days <= 7) {
        groupByClause = 'DATEPART(YEAR, DateCreate), DATEPART(MONTH, DateCreate), DATEPART(DAY, DateCreate), DATEPART(HOUR, DateCreate)';
        dateFormat = `CAST(CAST(DateCreate AS DATE) AS VARCHAR) + ' ' + CAST(DATEPART(HOUR, DateCreate) AS VARCHAR) + ':00'`;
      } else {
        groupByClause = 'CAST(DateCreate AS DATE)';
        dateFormat = 'CAST(DateCreate AS DATE)';
      }
      
      const result = await pool.request()
        .input('days', days)
        .query(`
          SELECT 
            ${dateFormat} as period,
            SUM(PushPrice) as revenue,
            SUM(PushPrice - Price) as profit,
            COUNT(*) as bookings,
            AVG(PushPrice) as avg_booking_value
          FROM [MED_ֹOֹֹpportunities]
          WHERE IsSale = 1 
          AND DateCreate >= DATEADD(DAY, -@days, GETDATE())
          GROUP BY ${groupByClause}
          ORDER BY ${groupByClause}
        `);

      return result.recordset.map(row => ({
        period: row.period,
        revenue: parseFloat(row.revenue || 0),
        profit: parseFloat(row.profit || 0),
        bookings: row.bookings,
        avg_booking_value: parseFloat(row.avg_booking_value || 0)
      }));
    } catch (error) {
      logger.error('Failed to get revenue trends', { error: error.message });
      throw error;
    }
  }
}

// Singleton instance
const revenueAnalyticsService = new RevenueAnalyticsService();

module.exports = revenueAnalyticsService;
