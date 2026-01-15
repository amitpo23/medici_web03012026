/**
 * Agent 3: Competition Monitor Agent
 * Monitors and analyzes competitor pricing and availability
 */
const BaseAgent = require('./base-agent');

class CompetitionMonitorAgent extends BaseAgent {
    constructor() {
        super('CompetitionMonitorAgent', 'Monitors competitor pricing and market positioning');
    }

    /**
     * Analyze competition landscape
     */
    async analyze(data) {
        const { bookings, hotelId, city, targetHotelName } = data;
        
        this.log(`Analyzing competition for ${targetHotelName || city || 'market'}`);

        // Group bookings by hotel
        const hotelGroups = this.groupByHotel(bookings);
        
        if (Object.keys(hotelGroups).length < 2) {
            return {
                agent: this.name,
                success: false,
                message: 'Insufficient competitor data',
                confidence: 0
            };
        }

        // Analyze each hotel's metrics
        const hotelMetrics = this.calculateHotelMetrics(hotelGroups);
        
        // Rank hotels
        const rankings = this.rankHotels(hotelMetrics);
        
        // Find direct competitors for target hotel
        const competitors = targetHotelName 
            ? this.findCompetitors(targetHotelName, hotelMetrics)
            : this.getTopCompetitors(hotelMetrics);
        
        // Calculate market share
        const marketShare = this.calculateMarketShare(hotelGroups);
        
        // Identify pricing gaps
        const pricingGaps = this.identifyPricingGaps(hotelMetrics);
        
        // Competitive opportunities
        const opportunities = this.findCompetitiveOpportunities(hotelMetrics, targetHotelName);

        this.confidence = Math.min(0.9, Object.keys(hotelGroups).length / 20);
        this.lastAnalysis = new Date();

        return {
            agent: this.name,
            success: true,
            confidence: this.confidence,
            analysis: {
                totalHotels: Object.keys(hotelGroups).length,
                rankings: rankings.slice(0, 20),
                competitors,
                marketShare: marketShare.slice(0, 10),
                pricingGaps,
                opportunities,
                recommendation: this.generateCompetitiveRecommendation(opportunities, pricingGaps)
            }
        };
    }

    /**
     * Group bookings by hotel
     */
    groupByHotel(bookings) {
        const groups = {};
        
        bookings.forEach(b => {
            const hotelKey = b.HotelName || `Hotel_${b.HotelId}`;
            if (!groups[hotelKey]) {
                groups[hotelKey] = {
                    hotelId: b.HotelId,
                    hotelName: hotelKey,
                    bookings: []
                };
            }
            groups[hotelKey].bookings.push(b);
        });

        return groups;
    }

    /**
     * Calculate metrics for each hotel
     */
    calculateHotelMetrics(hotelGroups) {
        const metrics = {};

        Object.keys(hotelGroups).forEach(hotelName => {
            const group = hotelGroups[hotelName];
            const prices = group.bookings.map(b => b.price).filter(p => p > 0);
            
            if (prices.length === 0) {
                metrics[hotelName] = null;
                return;
            }

            const stats = this.calculateStats(prices);
            const soldCount = group.bookings.filter(b => b.IsSold).length;
            const activeCount = group.bookings.filter(b => b.IsActive).length;

            metrics[hotelName] = {
                hotelId: group.hotelId,
                hotelName,
                totalBookings: group.bookings.length,
                avgPrice: stats.avg,
                minPrice: stats.min,
                maxPrice: stats.max,
                priceRange: stats.max - stats.min,
                priceVolatility: stats.avg > 0 ? (stats.std / stats.avg) * 100 : 0,
                soldCount,
                activeCount,
                conversionRate: group.bookings.length > 0 
                    ? (soldCount / group.bookings.length) * 100 
                    : 0
            };
        });

        return metrics;
    }

    /**
     * Rank hotels by various metrics
     */
    rankHotels(hotelMetrics) {
        const rankings = Object.values(hotelMetrics)
            .filter(m => m !== null)
            .map(m => ({
                ...m,
                score: this.calculateCompetitiveScore(m)
            }))
            .sort((a, b) => b.score - a.score);

        rankings.forEach((hotel, index) => {
            hotel.rank = index + 1;
        });

        return rankings;
    }

    /**
     * Calculate competitive score
     */
    calculateCompetitiveScore(metrics) {
        // Weighted scoring
        let score = 0;
        
        // Volume score (more bookings = higher score)
        score += Math.min(40, metrics.totalBookings / 10);
        
        // Conversion rate score
        score += metrics.conversionRate * 0.3;
        
        // Price competitiveness (lower avg price = potentially more competitive)
        // Normalize: if avg price is low relative to others, add points
        score += Math.max(0, 20 - (metrics.avgPrice / 50));
        
        // Active inventory score
        score += Math.min(10, metrics.activeCount / 5);

        return Math.round(score * 100) / 100;
    }

    /**
     * Find competitors for a target hotel
     */
    findCompetitors(targetHotelName, hotelMetrics) {
        const targetMetrics = hotelMetrics[targetHotelName];
        
        if (!targetMetrics) {
            return [];
        }

        // Find hotels with similar price range
        const competitors = Object.values(hotelMetrics)
            .filter(m => m !== null && m.hotelName !== targetHotelName)
            .map(m => ({
                ...m,
                priceDifference: Math.abs(m.avgPrice - targetMetrics.avgPrice),
                pricePosition: ((m.avgPrice - targetMetrics.avgPrice) / targetMetrics.avgPrice) * 100,
                similarity: this.calculateSimilarity(m, targetMetrics)
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 10);

        return competitors;
    }

    /**
     * Calculate similarity between two hotels
     */
    calculateSimilarity(hotel1, hotel2) {
        const priceDiff = Math.abs(hotel1.avgPrice - hotel2.avgPrice) / Math.max(hotel1.avgPrice, hotel2.avgPrice);
        const volumeDiff = Math.abs(hotel1.totalBookings - hotel2.totalBookings) / Math.max(hotel1.totalBookings, hotel2.totalBookings);
        
        // Lower difference = higher similarity
        return Math.round((1 - (priceDiff * 0.6 + volumeDiff * 0.4)) * 100);
    }

    /**
     * Get top competitors in market
     */
    getTopCompetitors(hotelMetrics) {
        return Object.values(hotelMetrics)
            .filter(m => m !== null)
            .sort((a, b) => b.totalBookings - a.totalBookings)
            .slice(0, 10);
    }

    /**
     * Calculate market share
     */
    calculateMarketShare(hotelGroups) {
        const totalBookings = Object.values(hotelGroups)
            .reduce((sum, g) => sum + g.bookings.length, 0);

        return Object.entries(hotelGroups)
            .map(([hotelName, group]) => ({
                hotelName,
                bookings: group.bookings.length,
                marketShare: ((group.bookings.length / totalBookings) * 100).toFixed(2)
            }))
            .sort((a, b) => b.bookings - a.bookings);
    }

    /**
     * Identify pricing gaps in the market
     */
    identifyPricingGaps(hotelMetrics) {
        const prices = Object.values(hotelMetrics)
            .filter(m => m !== null)
            .map(m => m.avgPrice)
            .sort((a, b) => a - b);

        const gaps = [];
        for (let i = 1; i < prices.length; i++) {
            const gap = prices[i] - prices[i-1];
            const gapPercentage = (gap / prices[i-1]) * 100;
            
            if (gapPercentage > 20) {
                gaps.push({
                    lowerPrice: prices[i-1].toFixed(2),
                    upperPrice: prices[i].toFixed(2),
                    gap: gap.toFixed(2),
                    gapPercentage: gapPercentage.toFixed(1),
                    opportunity: `Price gap between $${prices[i-1].toFixed(0)} and $${prices[i].toFixed(0)}`
                });
            }
        }

        return gaps;
    }

    /**
     * Find competitive opportunities
     */
    findCompetitiveOpportunities(hotelMetrics, targetHotelName) {
        const opportunities = [];
        const metricsArray = Object.values(hotelMetrics).filter(m => m !== null);
        
        // Find underperforming hotels (high volume, low conversion)
        const underperformers = metricsArray
            .filter(m => m.totalBookings > 10 && m.conversionRate < 20)
            .sort((a, b) => b.totalBookings - a.totalBookings);

        if (underperformers.length > 0) {
            opportunities.push({
                type: 'UNDERPERFORMING_INVENTORY',
                description: 'Hotels with high inventory but low sales',
                hotels: underperformers.slice(0, 5).map(h => ({
                    name: h.hotelName,
                    bookings: h.totalBookings,
                    conversionRate: h.conversionRate.toFixed(1) + '%'
                })),
                action: 'Consider acquiring inventory at lower prices'
            });
        }

        // Find volatile pricing opportunities
        const volatileHotels = metricsArray
            .filter(m => m.priceVolatility > 25)
            .sort((a, b) => b.priceVolatility - a.priceVolatility);

        if (volatileHotels.length > 0) {
            opportunities.push({
                type: 'PRICE_VOLATILITY',
                description: 'Hotels with high price volatility - timing opportunities',
                hotels: volatileHotels.slice(0, 5).map(h => ({
                    name: h.hotelName,
                    volatility: h.priceVolatility.toFixed(1) + '%',
                    priceRange: `$${h.minPrice.toFixed(0)} - $${h.maxPrice.toFixed(0)}`
                })),
                action: 'Buy during price dips, sell during peaks'
            });
        }

        // Find market leaders to watch
        const leaders = metricsArray
            .filter(m => m.conversionRate > 50)
            .sort((a, b) => b.conversionRate - a.conversionRate);

        if (leaders.length > 0) {
            opportunities.push({
                type: 'MARKET_LEADERS',
                description: 'Top performing hotels to benchmark against',
                hotels: leaders.slice(0, 5).map(h => ({
                    name: h.hotelName,
                    conversionRate: h.conversionRate.toFixed(1) + '%',
                    avgPrice: '$' + h.avgPrice.toFixed(2)
                })),
                action: 'Study pricing strategies of these hotels'
            });
        }

        return opportunities;
    }

    /**
     * Generate competitive recommendations
     */
    generateCompetitiveRecommendation(opportunities, pricingGaps) {
        const recommendations = [];

        opportunities.forEach(opp => {
            if (opp.type === 'UNDERPERFORMING_INVENTORY') {
                recommendations.push({
                    action: 'NEGOTIATE_BULK',
                    reason: 'Hotels with excess inventory may offer discounts',
                    urgency: 'medium',
                    targets: opp.hotels.slice(0, 3).map(h => h.name)
                });
            }

            if (opp.type === 'PRICE_VOLATILITY') {
                recommendations.push({
                    action: 'SET_PRICE_ALERTS',
                    reason: 'Monitor volatile hotels for buying opportunities',
                    urgency: 'high',
                    targets: opp.hotels.slice(0, 3).map(h => h.name)
                });
            }
        });

        if (pricingGaps.length > 0) {
            recommendations.push({
                action: 'FILL_PRICE_GAP',
                reason: `${pricingGaps.length} pricing gaps identified in market`,
                urgency: 'medium',
                details: pricingGaps.slice(0, 3)
            });
        }

        return recommendations;
    }
}

module.exports = CompetitionMonitorAgent;
