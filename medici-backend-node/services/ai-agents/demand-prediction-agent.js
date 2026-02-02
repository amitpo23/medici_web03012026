/**
 * Agent 2: Demand Prediction Agent
 * Predicts demand patterns based on historical booking data AND search intent data
 */
const BaseAgent = require('./base-agent');
const { getPool } = require('../../config/database');

class DemandPredictionAgent extends BaseAgent {
    constructor() {
        super('DemandPredictionAgent', 'Predicts demand patterns based on historical booking data and search intent');
    }

    /**
     * Fetch search intent data from AI_Search_HotelData table
     */
    async fetchSearchData(filters = {}) {
        const pool = await getPool();
        const { hotelId, city, days = 90 } = filters;

        let query = `
            SELECT 
                HotelId,
                HotelName,
                CityName,
                CountryCode,
                StayFrom,
                StayTo,
                PriceAmount,
                PriceAmountCurrency,
                UpdatedAt,
                RoomType,
                Board,
                CancellationType,
                Stars
            FROM AI_Search_HotelData
            WHERE UpdatedAt >= DATEADD(day, -${days}, GETDATE())
        `;

        if (hotelId) {
            query += ` AND HotelId = ${parseInt(hotelId)}`;
        }
        if (city) {
            query += ` AND CityName = '${city.replace(/'/g, "''")}'`;
        }

        query += ` ORDER BY UpdatedAt DESC`;

        const result = await pool.request().query(query);
        this.log(`Fetched ${result.recordset.length} search records`);
        return result.recordset;
    }

    /**
     * Calculate search velocity (searches per day)
     */
    calculateSearchVelocity(searches) {
        if (searches.length < 2) return { daily: 0, weekly: 0, trend: 'unknown' };

        const sortedSearches = [...searches].sort((a, b) => 
            new Date(a.UpdatedAt) - new Date(b.UpdatedAt)
        );

        const firstDate = new Date(sortedSearches[0].UpdatedAt);
        const lastDate = new Date(sortedSearches[sortedSearches.length - 1].UpdatedAt);
        const totalDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));

        const dailyVelocity = searches.length / totalDays;
        const weeklyVelocity = dailyVelocity * 7;

        // Calculate recent velocity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentSearches = searches.filter(s => new Date(s.UpdatedAt) >= sevenDaysAgo);
        const recentVelocity = recentSearches.length / 7;

        // Determine trend
        let trend = 'stable';
        if (recentVelocity > dailyVelocity * 1.3) trend = 'surging';
        else if (recentVelocity > dailyVelocity * 1.1) trend = 'accelerating';
        else if (recentVelocity < dailyVelocity * 0.7) trend = 'declining';
        else if (recentVelocity < dailyVelocity * 0.9) trend = 'decelerating';

        return {
            daily: dailyVelocity.toFixed(2),
            weekly: weeklyVelocity.toFixed(2),
            recentDaily: recentVelocity.toFixed(2),
            trend
        };
    }

    /**
     * Analyze search-to-booking conversion rate
     */
    calculateConversionMetrics(searches, bookings) {
        if (searches.length === 0) {
            return { conversionRate: 0, searchToBookRatio: 'N/A' };
        }

        const conversionRate = ((bookings.length / searches.length) * 100).toFixed(2);
        const searchToBookRatio = (searches.length / Math.max(1, bookings.length)).toFixed(1);

        return {
            conversionRate: `${conversionRate}%`,
            searchToBookRatio: `${searchToBookRatio}:1`,
            totalSearches: searches.length,
            totalBookings: bookings.length
        };
    }

    /**
     * Analyze demand patterns - NOW WITH SEARCH DATA!
     */
    async analyze(data) {
        const { bookings, hotelId, city, futureDays = 30 } = data;
        
        this.log(`Predicting demand for next ${futureDays} days (with search intent data)`);

        // Filter relevant bookings
        let relevantBookings = bookings;
        if (hotelId) {
            relevantBookings = bookings.filter(b => b.HotelId === hotelId);
        } else if (city) {
            relevantBookings = bookings.filter(b => 
                b.HotelName?.toLowerCase().includes(city.toLowerCase())
            );
        }

        // **NEW: Fetch search intent data**
        let searchData = [];
        try {
            searchData = await this.fetchSearchData({ hotelId, city, days: 90 });
            this.log(`Integrated ${searchData.length} search records into analysis`);
        } catch (error) {
            this.log(`Warning: Could not fetch search data - ${error.message}`);
        }

        if (relevantBookings.length < 10 && searchData.length < 100) {
            return {
                agent: this.name,
                success: false,
                message: 'Insufficient data for demand prediction (need bookings or search data)',
                confidence: 0
            };
        }

        // Analyze booking patterns
        const bookingVelocity = this.calculateBookingVelocity(relevantBookings);
        const demandByPeriod = this.analyzeDemandByPeriod(relevantBookings);
        const leadTimeAnalysis = this.analyzeLeadTime(relevantBookings);
        const demandForecast = this.forecastDemand(relevantBookings, futureDays);
        const hotPeriods = this.identifyHotPeriods(relevantBookings);

        // **NEW: Analyze search patterns**
        const searchVelocity = this.calculateSearchVelocity(searchData);
        const conversionMetrics = this.calculateConversionMetrics(searchData, relevantBookings);

        // **NEW: Combined confidence with search signals**
        this.confidence = this.calculateConfidence(relevantBookings.length, searchData.length);
        this.lastAnalysis = new Date();

        return {
            agent: this.name,
            success: true,
            confidence: this.confidence,
            analysis: {
                bookingVelocity,
                searchVelocity,  // **NEW**
                conversionMetrics,  // **NEW**
                demandByPeriod,
                leadTimeAnalysis,
                demandForecast,
                hotPeriods,
                sampleSize: relevantBookings.length,
                searchSampleSize: searchData.length,  // **NEW**
                recommendation: this.generateDemandRecommendation(
                    demandForecast, 
                    hotPeriods, 
                    searchVelocity  // **NEW: Pass search signals**
                )
            }
        };
    }

    /**
     * Calculate booking velocity (bookings per day)
     */
    calculateBookingVelocity(bookings) {
        if (bookings.length < 2) return { daily: 0, weekly: 0, trend: 'unknown' };

        const sortedBookings = [...bookings].sort((a, b) => 
            new Date(a.DateInsert) - new Date(b.DateInsert)
        );

        const firstDate = new Date(sortedBookings[0].DateInsert);
        const lastDate = new Date(sortedBookings[sortedBookings.length - 1].DateInsert);
        const totalDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));

        const dailyVelocity = bookings.length / totalDays;
        const weeklyVelocity = dailyVelocity * 7;

        // Calculate recent velocity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentBookings = bookings.filter(b => new Date(b.DateInsert) >= thirtyDaysAgo);
        const recentVelocity = recentBookings.length / 30;

        // Determine trend
        let trend = 'stable';
        if (recentVelocity > dailyVelocity * 1.2) trend = 'accelerating';
        else if (recentVelocity < dailyVelocity * 0.8) trend = 'decelerating';

        return {
            daily: dailyVelocity.toFixed(2),
            weekly: weeklyVelocity.toFixed(2),
            recentDaily: recentVelocity.toFixed(2),
            trend
        };
    }

    /**
     * Analyze demand by time period
     */
    analyzeDemandByPeriod(bookings) {
        const periods = {
            morning: { hours: [6, 12], bookings: 0 },
            afternoon: { hours: [12, 18], bookings: 0 },
            evening: { hours: [18, 24], bookings: 0 },
            night: { hours: [0, 6], bookings: 0 }
        };

        bookings.forEach(b => {
            const hour = new Date(b.DateInsert).getHours();
            if (hour >= 6 && hour < 12) periods.morning.bookings++;
            else if (hour >= 12 && hour < 18) periods.afternoon.bookings++;
            else if (hour >= 18) periods.evening.bookings++;
            else periods.night.bookings++;
        });

        const total = bookings.length;
        Object.keys(periods).forEach(p => {
            periods[p].percentage = ((periods[p].bookings / total) * 100).toFixed(1);
        });

        // Find peak booking period
        const peak = Object.entries(periods)
            .sort((a, b) => b[1].bookings - a[1].bookings)[0];

        return {
            ...periods,
            peakPeriod: peak[0],
            peakPercentage: peak[1].percentage
        };
    }

    /**
     * Analyze lead time (days between booking and check-in)
     */
    analyzeLeadTime(bookings) {
        const leadTimes = [];

        bookings.forEach(b => {
            if (b.DateInsert && b.startDate) {
                const bookingDate = new Date(b.DateInsert);
                const checkInDate = new Date(b.startDate);
                const leadTime = (checkInDate - bookingDate) / (1000 * 60 * 60 * 24);
                if (leadTime >= 0 && leadTime < 365) {
                    leadTimes.push(leadTime);
                }
            }
        });

        if (leadTimes.length === 0) {
            return { avg: 0, min: 0, max: 0, buckets: {} };
        }

        const stats = this.calculateStats(leadTimes);

        // Bucket lead times
        const buckets = {
            sameDay: leadTimes.filter(l => l < 1).length,
            oneToThreeDays: leadTimes.filter(l => l >= 1 && l < 3).length,
            fourToSevenDays: leadTimes.filter(l => l >= 3 && l < 7).length,
            oneToTwoWeeks: leadTimes.filter(l => l >= 7 && l < 14).length,
            twoToFourWeeks: leadTimes.filter(l => l >= 14 && l < 28).length,
            overOneMonth: leadTimes.filter(l => l >= 28).length
        };

        const total = leadTimes.length;
        Object.keys(buckets).forEach(k => {
            buckets[k] = {
                count: buckets[k],
                percentage: ((buckets[k] / total) * 100).toFixed(1)
            };
        });

        return {
            avgLeadTime: stats.avg.toFixed(1),
            minLeadTime: stats.min.toFixed(0),
            maxLeadTime: stats.max.toFixed(0),
            buckets
        };
    }

    /**
     * Forecast demand for future periods
     */
    forecastDemand(bookings, futureDays) {
        // Group bookings by day of year
        const dayOfYearCounts = {};
        bookings.forEach(b => {
            if (b.startDate) {
                const date = new Date(b.startDate);
                const dayOfYear = this.getDayOfYear(date);
                dayOfYearCounts[dayOfYear] = (dayOfYearCounts[dayOfYear] || 0) + 1;
            }
        });

        // Generate forecast for next N days
        const forecast = [];
        const today = new Date();

        for (let i = 0; i < futureDays; i++) {
            const forecastDate = new Date(today);
            forecastDate.setDate(today.getDate() + i);
            const dayOfYear = this.getDayOfYear(forecastDate);
            
            // Historical demand for this day
            const historicalDemand = dayOfYearCounts[dayOfYear] || 0;
            
            // Apply day-of-week factor
            const dayOfWeekFactor = this.getDayOfWeekFactor(forecastDate.getDay());
            
            // Calculate predicted demand
            const predictedDemand = Math.round(historicalDemand * dayOfWeekFactor);

            forecast.push({
                date: forecastDate.toISOString().split('T')[0],
                dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][forecastDate.getDay()],
                predictedDemand,
                demandLevel: this.getDemandLevel(predictedDemand, bookings.length / 365)
            });
        }

        return forecast;
    }

    /**
     * Get day of year (1-366)
     */
    getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    }

    /**
     * Get day of week demand factor
     */
    getDayOfWeekFactor(dayOfWeek) {
        const factors = {
            0: 1.2,  // Sunday
            1: 0.8,  // Monday
            2: 0.9,  // Tuesday
            3: 0.9,  // Wednesday
            4: 1.0,  // Thursday
            5: 1.3,  // Friday
            6: 1.4   // Saturday
        };
        return factors[dayOfWeek] || 1.0;
    }

    /**
     * Get demand level label
     */
    getDemandLevel(demand, avgDaily) {
        if (demand < avgDaily * 0.5) return 'low';
        if (demand < avgDaily * 1.0) return 'medium';
        if (demand < avgDaily * 1.5) return 'high';
        return 'very_high';
    }

    /**
     * Identify hot booking periods
     */
    identifyHotPeriods(bookings) {
        const periodCounts = {};

        bookings.forEach(b => {
            if (b.startDate) {
                const date = new Date(b.startDate);
                const weekKey = `${date.getFullYear()}-W${Math.ceil((date.getMonth() * 30 + date.getDate()) / 7)}`;
                periodCounts[weekKey] = (periodCounts[weekKey] || 0) + 1;
            }
        });

        const avgCount = Object.values(periodCounts).reduce((a, b) => a + b, 0) / Object.keys(periodCounts).length;
        
        const hotPeriods = Object.entries(periodCounts)
            .filter(([_, count]) => count > avgCount * 1.5)
            .map(([period, count]) => ({
                period,
                bookings: count,
                intensity: (count / avgCount).toFixed(2)
            }))
            .sort((a, b) => b.bookings - a.bookings)
            .slice(0, 10);

        return hotPeriods;
    }

    /**
     * Calculate confidence (now considers both booking and search data)
     */
    calculateConfidence(bookingSampleSize, searchSampleSize = 0) {
        // Combined confidence based on both signals
        const totalSignals = bookingSampleSize + (searchSampleSize / 10); // Searches weighted 10:1
        
        if (totalSignals < 20) return 0.2;
        if (totalSignals < 50) return 0.4;
        if (totalSignals < 100) return 0.6;
        if (totalSignals < 500) return 0.8;
        return 0.9;
    }

    /**
     * Generate demand-based recommendations (now includes search signals)
     */
    generateDemandRecommendation(forecast, hotPeriods, searchVelocity = null) {
        const recommendations = [];

        // **NEW: Search trend signals**
        if (searchVelocity) {
            if (searchVelocity.trend === 'surging' || searchVelocity.trend === 'accelerating') {
                recommendations.push({
                    action: 'HIGH_DEMAND_ALERT',
                    reason: `Search volume is ${searchVelocity.trend} (${searchVelocity.recentDaily} searches/day)`,
                    urgency: 'critical',
                    signal: 'SEARCH_INTENT',
                    metric: `Recent: ${searchVelocity.recentDaily}/day vs avg ${searchVelocity.daily}/day`
                });
            } else if (searchVelocity.trend === 'declining') {
                recommendations.push({
                    action: 'DEMAND_COOLING',
                    reason: `Search volume declining (${searchVelocity.recentDaily} vs ${searchVelocity.daily}/day avg)`,
                    urgency: 'medium',
                    signal: 'SEARCH_INTENT'
                });
            }
        }

        // Find upcoming high demand periods
        const highDemandDays = forecast.filter(f => 
            f.demandLevel === 'high' || f.demandLevel === 'very_high'
        );

        if (highDemandDays.length > 0) {
            recommendations.push({
                action: 'PREPARE_INVENTORY',
                reason: `${highDemandDays.length} high-demand days in forecast period`,
                urgency: 'high',
                signal: 'BOOKING_HISTORY',
                dates: highDemandDays.slice(0, 5).map(d => d.date)
            });
        }

        // Find low demand periods for buying opportunities
        const lowDemandDays = forecast.filter(f => f.demandLevel === 'low');
        if (lowDemandDays.length > 0) {
            recommendations.push({
                action: 'BUY_OPPORTUNITY',
                reason: `${lowDemandDays.length} low-demand days - potential for lower prices`,
                urgency: 'medium',
                signal: 'BOOKING_HISTORY',
                dates: lowDemandDays.slice(0, 5).map(d => d.date)
            });
        }

        return recommendations;
    }
}

module.exports = DemandPredictionAgent;
