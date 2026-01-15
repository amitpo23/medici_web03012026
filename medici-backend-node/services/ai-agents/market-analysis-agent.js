/**
 * Agent 1: Market Analysis Agent
 * Analyzes historical price trends and market patterns
 */
const BaseAgent = require('./base-agent');

class MarketAnalysisAgent extends BaseAgent {
    constructor() {
        super('MarketAnalysisAgent', 'Analyzes historical price trends and market patterns');
    }

    /**
     * Analyze market data for a specific hotel/city
     */
    async analyze(data) {
        const { bookings, hotelId, city, dateRange } = data;
        
        this.log(`Analyzing market for ${hotelId || city || 'all locations'}`);
        
        // Filter relevant bookings
        let relevantBookings = bookings;
        if (hotelId) {
            relevantBookings = bookings.filter(b => b.HotelId === hotelId);
        } else if (city) {
            relevantBookings = bookings.filter(b => 
                b.HotelName?.toLowerCase().includes(city.toLowerCase()) ||
                b.city?.toLowerCase() === city.toLowerCase()
            );
        }

        if (relevantBookings.length === 0) {
            return {
                agent: this.name,
                success: false,
                message: 'No data available for analysis',
                confidence: 0
            };
        }

        // Extract prices
        const prices = relevantBookings.map(b => b.price).filter(p => p > 0);
        const stats = this.calculateStats(prices);
        const trend = this.calculateTrend(prices);

        // Analyze by day of week
        const dayOfWeekPrices = this.analyzeDayOfWeek(relevantBookings);
        
        // Analyze seasonality
        const seasonality = this.analyzeSeasonality(relevantBookings);

        // Calculate market indicators
        const marketIndicators = this.calculateMarketIndicators(prices, stats);

        this.confidence = this.calculateConfidence(relevantBookings.length);
        this.lastAnalysis = new Date();

        return {
            agent: this.name,
            success: true,
            confidence: this.confidence,
            analysis: {
                priceStats: stats,
                trend,
                dayOfWeekPatterns: dayOfWeekPrices,
                seasonality,
                marketIndicators,
                sampleSize: relevantBookings.length,
                recommendation: this.generateRecommendation(trend, stats, marketIndicators)
            }
        };
    }

    /**
     * Analyze prices by day of week
     */
    analyzeDayOfWeek(bookings) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayPrices = {};
        
        days.forEach(day => dayPrices[day] = []);
        
        bookings.forEach(b => {
            if (b.startDate) {
                const day = days[new Date(b.startDate).getDay()];
                if (b.price > 0) dayPrices[day].push(b.price);
            }
        });

        const result = {};
        days.forEach(day => {
            const prices = dayPrices[day];
            result[day] = {
                avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
                bookings: prices.length
            };
        });

        // Find best and worst days
        const avgByDay = Object.entries(result).map(([day, data]) => ({ day, ...data }));
        avgByDay.sort((a, b) => a.avgPrice - b.avgPrice);
        
        result.bestDayToBuy = avgByDay.find(d => d.avgPrice > 0)?.day || 'N/A';
        result.worstDayToBuy = avgByDay.filter(d => d.avgPrice > 0).pop()?.day || 'N/A';

        return result;
    }

    /**
     * Analyze seasonality patterns
     */
    analyzeSeasonality(bookings) {
        const months = {};
        
        bookings.forEach(b => {
            if (b.startDate && b.price > 0) {
                const month = new Date(b.startDate).getMonth();
                if (!months[month]) months[month] = [];
                months[month].push(b.price);
            }
        });

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const result = {};
        
        Object.keys(months).forEach(m => {
            const prices = months[m];
            result[monthNames[m]] = {
                avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
                bookings: prices.length
            };
        });

        // Find peak and low seasons
        const sorted = Object.entries(result)
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => b.avgPrice - a.avgPrice);

        return {
            byMonth: result,
            peakSeason: sorted.slice(0, 3).map(s => s.month),
            lowSeason: sorted.slice(-3).map(s => s.month)
        };
    }

    /**
     * Calculate market indicators
     */
    calculateMarketIndicators(prices, stats) {
        const currentPrice = prices[prices.length - 1] || 0;
        const avgPrice = stats.avg;
        
        // Price position relative to average
        const pricePosition = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
        
        // Volatility index (coefficient of variation)
        const volatility = avgPrice > 0 ? (stats.std / avgPrice) * 100 : 0;
        
        // Price momentum (recent trend strength)
        const recentPrices = prices.slice(-20);
        let momentum = 0;
        if (recentPrices.length > 1) {
            const changes = [];
            for (let i = 1; i < recentPrices.length; i++) {
                changes.push(recentPrices[i] - recentPrices[i-1]);
            }
            momentum = changes.reduce((a, b) => a + b, 0) / changes.length;
        }

        return {
            currentPrice,
            pricePosition: pricePosition.toFixed(2),
            volatility: volatility.toFixed(2),
            momentum: momentum.toFixed(2),
            isUndervalued: pricePosition < -10,
            isOvervalued: pricePosition > 10,
            isVolatile: volatility > 20
        };
    }

    /**
     * Calculate confidence based on sample size
     */
    calculateConfidence(sampleSize) {
        if (sampleSize < 10) return 0.3;
        if (sampleSize < 50) return 0.5;
        if (sampleSize < 100) return 0.7;
        if (sampleSize < 500) return 0.85;
        return 0.95;
    }

    /**
     * Generate recommendation
     */
    generateRecommendation(trend, stats, indicators) {
        const recommendations = [];
        
        if (indicators.isUndervalued) {
            recommendations.push({
                action: 'BUY',
                reason: `Price is ${Math.abs(indicators.pricePosition)}% below average`,
                urgency: 'high'
            });
        }
        
        if (trend === 'falling') {
            recommendations.push({
                action: 'WAIT',
                reason: 'Prices are trending downward',
                urgency: 'medium'
            });
        }
        
        if (trend === 'rising' && !indicators.isOvervalued) {
            recommendations.push({
                action: 'BUY_SOON',
                reason: 'Prices are rising but still reasonable',
                urgency: 'medium'
            });
        }

        if (indicators.isOvervalued) {
            recommendations.push({
                action: 'SELL',
                reason: `Price is ${indicators.pricePosition}% above average`,
                urgency: 'high'
            });
        }

        if (indicators.isVolatile) {
            recommendations.push({
                action: 'CAUTION',
                reason: `High volatility (${indicators.volatility}%)`,
                urgency: 'low'
            });
        }

        return recommendations.length > 0 ? recommendations : [{
            action: 'HOLD',
            reason: 'Market conditions are stable',
            urgency: 'low'
        }];
    }
}

module.exports = MarketAnalysisAgent;
