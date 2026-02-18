/**
 * Agent 4: Opportunity Detector Agent
 * Identifies buy/sell opportunities based on price anomalies and patterns
 */
const BaseAgent = require('./base-agent');

class OpportunityDetectorAgent extends BaseAgent {
    constructor() {
        super('OpportunityDetectorAgent', 'Identifies buy/sell opportunities based on price anomalies');
    }

    /**
     * Detect opportunities
     */
    async analyze(data) {
        const { bookings, hotelId, city, userInstructions, filters } = data;
        
        this.log(`Detecting opportunities with instructions: ${userInstructions || 'default'}`);
        this.log(`Applied filters: ${JSON.stringify(filters || {})}`);

        // Filter bookings
        let relevantBookings = bookings;
        if (hotelId) {
            relevantBookings = bookings.filter(b => b.HotelId === hotelId);
        } else if (city) {
            relevantBookings = bookings.filter(b => 
                b.HotelName?.toLowerCase().includes(city.toLowerCase())
            );
        }

        if (relevantBookings.length < 5) {
            return {
                agent: this.name,
                success: false,
                message: 'Insufficient data for opportunity detection',
                confidence: 0
            };
        }

        // Detect various opportunity types
        const priceAnomalies = this.detectPriceAnomalies(relevantBookings);
        const buyOpportunities = this.findBuyOpportunities(relevantBookings);
        const sellOpportunities = this.findSellOpportunities(relevantBookings);
        const arbitrageOpportunities = this.findArbitrageOpportunities(relevantBookings);
        const timingOpportunities = this.findTimingOpportunities(relevantBookings);

        // Apply user instructions if provided
        let filteredOpportunities = {
            priceAnomalies,
            buyOpportunities,
            sellOpportunities,
            arbitrageOpportunities,
            timingOpportunities
        };

        if (userInstructions) {
            filteredOpportunities = this.applyUserInstructions(filteredOpportunities, userInstructions);
        }

        // Apply advanced filters if provided
        if (filters) {
            filteredOpportunities = this.applyAdvancedFilters(filteredOpportunities, filters);
        }

        // Score and rank all opportunities
        const rankedOpportunities = this.rankOpportunities(filteredOpportunities);

        this.confidence = this.calculateConfidence(relevantBookings.length, rankedOpportunities.length);
        this.lastAnalysis = new Date();

        return {
            agent: this.name,
            success: true,
            confidence: this.confidence,
            analysis: {
                summary: {
                    totalOpportunities: rankedOpportunities.length,
                    buyOpportunities: buyOpportunities.length,
                    sellOpportunities: sellOpportunities.length,
                    highPriorityCount: rankedOpportunities.filter(o => o.priority === 'high').length
                },
                opportunities: rankedOpportunities.slice(0, 50),
                ...filteredOpportunities,
                userInstructionsApplied: !!userInstructions
            }
        };
    }

    /**
     * Detect price anomalies
     */
    detectPriceAnomalies(bookings) {
        const hotelPrices = {};
        
        // Group prices by hotel
        bookings.forEach(b => {
            const key = b.HotelName || b.HotelId;
            if (!hotelPrices[key]) hotelPrices[key] = [];
            if (b.price > 0) hotelPrices[key].push({ ...b });
        });

        const anomalies = [];

        Object.keys(hotelPrices).forEach(hotel => {
            const prices = hotelPrices[hotel].map(b => b.price);
            if (prices.length < 3) return;

            const stats = this.calculateStats(prices);
            const threshold = stats.std * 2;

            hotelPrices[hotel].forEach(booking => {
                const deviation = Math.abs(booking.price - stats.avg);
                if (deviation > threshold) {
                    const isLow = booking.price < stats.avg;
                    anomalies.push({
                        type: isLow ? 'BELOW_AVERAGE' : 'ABOVE_AVERAGE',
                        hotelName: hotel,
                        hotelId: booking.HotelId,
                        cityName: booking.CityName || null,
                        bookingId: booking.id,
                        price: booking.price,
                        avgPrice: stats.avg,
                        deviation: deviation.toFixed(2),
                        deviationPercent: ((deviation / stats.avg) * 100).toFixed(1),
                        startDate: booking.startDate,
                        endDate: booking.endDate,
                        opportunity: isLow ? 'BUY' : 'SELL',
                        score: (deviation / stats.avg) * 100
                    });
                }
            });
        });

        return anomalies.sort((a, b) => b.score - a.score);
    }

    /**
     * Find buy opportunities
     */
    findBuyOpportunities(bookings) {
        const opportunities = [];
        const hotelData = {};

        // Calculate baseline metrics per hotel
        bookings.forEach(b => {
            const key = b.HotelName || b.HotelId;
            if (!hotelData[key]) {
                hotelData[key] = { prices: [], bookings: [] };
            }
            if (b.price > 0) {
                hotelData[key].prices.push(b.price);
                hotelData[key].bookings.push(b);
            }
        });

        Object.keys(hotelData).forEach(hotel => {
            const data = hotelData[hotel];
            if (data.prices.length < 3) return;

            const stats = this.calculateStats(data.prices);
            
            // Find bookings priced below average
            data.bookings.forEach(b => {
                if (b.price < stats.avg * 0.85 && b.IsActive) {
                    const discount = ((stats.avg - b.price) / stats.avg) * 100;
                    const buyPrice = b.price;
                    const estimatedSellPrice = stats.avg * 1.05; // Conservative sell estimate
                    const expectedProfit = estimatedSellPrice - buyPrice;
                    const profitMargin = (expectedProfit / estimatedSellPrice) * 100;
                    const roi = (expectedProfit / buyPrice) * 100;
                    
                    opportunities.push({
                        type: 'BUY',
                        reason: 'Price below market average',
                        hotelName: hotel,
                        hotelId: b.HotelId,
                        cityName: b.CityName || null,
                        bookingId: b.id,
                        currentPrice: b.price,
                        buyPrice: buyPrice,
                        estimatedSellPrice: parseFloat(estimatedSellPrice.toFixed(2)),
                        marketAvg: stats.avg,
                        discount: discount.toFixed(1),
                        expectedProfit: parseFloat(expectedProfit.toFixed(2)),
                        profitMargin: parseFloat(profitMargin.toFixed(2)),
                        roi: parseFloat(roi.toFixed(2)),
                        potentialProfit: (stats.avg - b.price).toFixed(2), // Keep for backward compatibility
                        startDate: b.startDate,
                        endDate: b.endDate,
                        provider: b.providers,
                        score: discount,
                        priority: discount > 20 ? 'high' : discount > 10 ? 'medium' : 'low',
                        isActive: b.IsActive,
                        status: b.Status,
                        confidence: this.calculateOpportunityConfidence(discount, data.prices.length)
                    });
                }
            });
        });

        return opportunities.sort((a, b) => b.score - a.score);
    }

    /**
     * Find sell opportunities
     */
    findSellOpportunities(bookings) {
        const opportunities = [];
        const hotelData = {};

        bookings.forEach(b => {
            const key = b.HotelName || b.HotelId;
            if (!hotelData[key]) {
                hotelData[key] = { prices: [], bookings: [] };
            }
            if (b.price > 0) {
                hotelData[key].prices.push(b.price);
                hotelData[key].bookings.push(b);
            }
        });

        Object.keys(hotelData).forEach(hotel => {
            const data = hotelData[hotel];
            if (data.prices.length < 3) return;

            const stats = this.calculateStats(data.prices);
            
            // Find owned bookings priced at or above average
            data.bookings.forEach(b => {
                if (b.price > stats.avg * 1.1 && !b.IsSold && b.IsActive) {
                    const premium = ((b.price - stats.avg) / stats.avg) * 100;
                    opportunities.push({
                        type: 'SELL',
                        reason: 'Price above market average',
                        hotelName: hotel,
                        hotelId: b.HotelId,
                        cityName: b.CityName || null,
                        bookingId: b.id,
                        currentPrice: b.price,
                        marketAvg: stats.avg,
                        premium: premium.toFixed(1),
                        startDate: b.startDate,
                        endDate: b.endDate,
                        score: premium,
                        priority: premium > 20 ? 'high' : premium > 10 ? 'medium' : 'low'
                    });
                }
            });
        });

        return opportunities.sort((a, b) => b.score - a.score);
    }

    /**
     * Find arbitrage opportunities
     */
    findArbitrageOpportunities(bookings) {
        const opportunities = [];
        const hotelDatePrices = {};

        // Group by hotel and date
        bookings.forEach(b => {
            const hotel = b.HotelName || b.HotelId;
            // Handle Date object or string
            let date = null;
            if (b.startDate) {
                if (b.startDate instanceof Date) {
                    date = b.startDate.toISOString().split('T')[0];
                } else if (typeof b.startDate === 'string') {
                    date = b.startDate.split('T')[0];
                }
            }
            if (!date || b.price <= 0) return;

            const key = `${hotel}_${date}`;
            if (!hotelDatePrices[key]) {
                hotelDatePrices[key] = { hotel, date, hotelId: b.HotelId, cityName: b.CityName || null, startDate: b.startDate, endDate: b.endDate, prices: [] };
            }
            hotelDatePrices[key].prices.push({ price: b.price, provider: b.providers, id: b.id });
        });

        // Find date/hotel combos with price differences
        Object.values(hotelDatePrices).forEach(data => {
            if (data.prices.length < 2) return;

            const prices = data.prices.map(p => p.price);
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            const spread = ((max - min) / min) * 100;

            if (spread > 15) {
                const cheapest = data.prices.find(p => p.price === min);
                const mostExpensive = data.prices.find(p => p.price === max);

                opportunities.push({
                    type: 'ARBITRAGE',
                    reason: 'Same hotel/date with significant price difference',
                    hotelName: data.hotel,
                    hotelId: data.hotelId,
                    cityName: data.cityName,
                    date: data.date,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    lowPrice: min,
                    highPrice: max,
                    spread: spread.toFixed(1),
                    potentialProfit: (max - min).toFixed(2),
                    buyFrom: cheapest.provider,
                    sellTo: mostExpensive.provider,
                    score: spread,
                    priority: spread > 30 ? 'high' : spread > 20 ? 'medium' : 'low'
                });
            }
        });

        return opportunities.sort((a, b) => b.score - a.score);
    }

    /**
     * Find timing-based opportunities
     */
    findTimingOpportunities(bookings) {
        const opportunities = [];
        const now = new Date();

        // Find last-minute opportunities
        bookings.forEach(b => {
            if (!b.startDate || b.price <= 0 || !b.IsActive || b.IsSold) return;

            const checkIn = new Date(b.startDate);
            const daysUntilCheckIn = (checkIn - now) / (1000 * 60 * 60 * 24);

            if (daysUntilCheckIn > 0 && daysUntilCheckIn < 7) {
                opportunities.push({
                    type: 'LAST_MINUTE',
                    reason: 'Approaching check-in date - potential price flexibility',
                    hotelName: b.HotelName,
                    hotelId: b.HotelId,
                    cityName: b.CityName || null,
                    bookingId: b.id,
                    price: b.price,
                    startDate: b.startDate,
                    endDate: b.endDate,
                    daysUntilCheckIn: Math.floor(daysUntilCheckIn),
                    score: 7 - daysUntilCheckIn,
                    priority: daysUntilCheckIn < 3 ? 'high' : 'medium',
                    action: daysUntilCheckIn < 3 ? 'SELL_URGENTLY' : 'MONITOR'
                });
            }
        });

        return opportunities.sort((a, b) => b.score - a.score);
    }

    /**
     * Apply user instructions to filter opportunities
     */
    applyUserInstructions(opportunities, instructions) {
        const instructionsLower = instructions.toLowerCase();
        
        // Parse common instruction patterns
        const filters = {
            onlyBuy: instructionsLower.includes('only buy') || instructionsLower.includes('רק קנ'),
            onlySell: instructionsLower.includes('only sell') || instructionsLower.includes('רק מכ'),
            highDiscount: instructionsLower.includes('high discount') || instructionsLower.includes('הנחה גבוהה'),
            minDiscount: this.extractNumber(instructions, 'discount over', 'הנחה מעל'),
            minProfit: this.extractNumber(instructions, 'profit over', 'רווח מעל'),
            maxPrice: this.extractNumber(instructions, 'max price', 'מחיר מקסימלי'),
            minPrice: this.extractNumber(instructions, 'min price', 'מחיר מינימלי'),
            urgent: instructionsLower.includes('urgent') || instructionsLower.includes('דחוף'),
            hotel: this.extractHotelName(instructions),
            city: this.extractCity(instructions)
        };

        // Apply filters
        if (filters.onlyBuy) {
            opportunities.sellOpportunities = [];
        }
        if (filters.onlySell) {
            opportunities.buyOpportunities = [];
        }
        if (filters.minDiscount) {
            opportunities.buyOpportunities = opportunities.buyOpportunities
                .filter(o => parseFloat(o.discount) >= filters.minDiscount);
        }
        if (filters.minProfit) {
            opportunities.buyOpportunities = opportunities.buyOpportunities
                .filter(o => parseFloat(o.potentialProfit) >= filters.minProfit);
            opportunities.arbitrageOpportunities = opportunities.arbitrageOpportunities
                .filter(o => parseFloat(o.potentialProfit) >= filters.minProfit);
        }
        if (filters.maxPrice) {
            opportunities.buyOpportunities = opportunities.buyOpportunities
                .filter(o => o.currentPrice <= filters.maxPrice);
        }
        if (filters.urgent) {
            opportunities.buyOpportunities = opportunities.buyOpportunities
                .filter(o => o.priority === 'high');
            opportunities.sellOpportunities = opportunities.sellOpportunities
                .filter(o => o.priority === 'high');
        }
        if (filters.hotel) {
            const hotelLower = filters.hotel.toLowerCase();
            opportunities.buyOpportunities = opportunities.buyOpportunities
                .filter(o => o.hotelName?.toLowerCase().includes(hotelLower));
            opportunities.sellOpportunities = opportunities.sellOpportunities
                .filter(o => o.hotelName?.toLowerCase().includes(hotelLower));
        }

        return opportunities;
    }

    /**
     * Extract number from instructions
     */
    extractNumber(text, ...patterns) {
        for (const pattern of patterns) {
            const regex = new RegExp(`${pattern}\\s*(\\d+)`, 'i');
            const match = text.match(regex);
            if (match) return parseFloat(match[1]);
        }
        return null;
    }

    /**
     * Extract hotel name from instructions
     */
    extractHotelName(text) {
        const patterns = [/hotel\s+(\w+)/i, /מלון\s+(\w+)/];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    /**
     * Extract city from instructions
     */
    extractCity(text) {
        const patterns = [/city\s+(\w+)/i, /in\s+(\w+)/i, /עיר\s+(\w+)/, /ב(\w+)/];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    /**
     * Rank all opportunities
     */
    rankOpportunities(filteredOpportunities) {
        const allOpportunities = [
            ...filteredOpportunities.buyOpportunities.map(o => ({ ...o, category: 'buy' })),
            ...filteredOpportunities.sellOpportunities.map(o => ({ ...o, category: 'sell' })),
            ...filteredOpportunities.arbitrageOpportunities.map(o => ({ ...o, category: 'arbitrage' })),
            ...filteredOpportunities.timingOpportunities.map(o => ({ ...o, category: 'timing' }))
        ];

        // Normalize and combine scores
        allOpportunities.forEach(o => {
            let finalScore = o.score || 0;
            
            if (o.priority === 'high') finalScore *= 1.5;
            if (o.priority === 'low') finalScore *= 0.7;
            if (o.category === 'arbitrage') finalScore *= 1.2;
            
            o.finalScore = Math.round(finalScore * 100) / 100;
        });

        return allOpportunities.sort((a, b) => b.finalScore - a.finalScore);
    }

    /**
     * Calculate confidence
     */
    calculateConfidence(sampleSize, opportunityCount) {
        let confidence = 0.5;
        
        if (sampleSize > 100) confidence += 0.2;
        if (sampleSize > 500) confidence += 0.1;
        if (opportunityCount > 10) confidence += 0.1;
        
        return Math.min(0.95, confidence);
    }

    /**
     * Calculate opportunity confidence score
     */
    calculateOpportunityConfidence(discountOrPremium, sampleSize) {
        let confidence = 0.6;
        
        // Higher discount/premium = higher confidence
        if (discountOrPremium > 25) confidence += 0.2;
        else if (discountOrPremium > 15) confidence += 0.1;
        
        // More data = higher confidence
        if (sampleSize > 20) confidence += 0.1;
        if (sampleSize > 50) confidence += 0.1;
        
        return Math.min(0.95, confidence);
    }

    /**
     * Apply advanced filters to opportunities
     */
    applyAdvancedFilters(opportunities, filters) {
        const {
            minProfit,
            minMarginPercent,
            minROI,
            profitRange,
            daysToCheckIn,
            season,
            weekendOnly,
            freeCancellationOnly,
            isPushed,
            isSold
        } = filters;

        // Helper function to filter opportunities array
        const filterOpportunities = (opps) => {
            let filtered = [...opps];

            // Profit filters
            if (minProfit !== undefined && minProfit > 0) {
                filtered = filtered.filter(o => 
                    (o.expectedProfit || o.potentialProfit || 0) >= minProfit
                );
            }

            if (minMarginPercent !== undefined && minMarginPercent > 0) {
                filtered = filtered.filter(o => 
                    (o.profitMargin || 0) >= minMarginPercent
                );
            }

            if (minROI !== undefined && minROI > 0) {
                filtered = filtered.filter(o => (o.roi || 0) >= minROI);
            }

            if (profitRange && Array.isArray(profitRange) && profitRange.length === 2) {
                const [min, max] = profitRange;
                filtered = filtered.filter(o => {
                    const profit = o.expectedProfit || o.potentialProfit || 0;
                    return profit >= min && profit <= max;
                });
            }

            // Time-based filters
            if (daysToCheckIn !== undefined) {
                const now = new Date();
                filtered = filtered.filter(o => {
                    if (!o.startDate) return true;
                    const checkIn = new Date(o.startDate);
                    const daysUntil = Math.ceil((checkIn - now) / (1000 * 60 * 60 * 24));
                    return daysUntil <= daysToCheckIn;
                });
            }

            if (season) {
                filtered = filtered.filter(o => {
                    if (!o.startDate) return true;
                    const date = new Date(o.startDate);
                    const month = date.getMonth() + 1;
                    
                    if (season === 'summer') return month >= 6 && month <= 8;
                    if (season === 'winter') return month === 12 || month <= 2;
                    if (season === 'spring') return month >= 3 && month <= 5;
                    if (season === 'fall') return month >= 9 && month <= 11;
                    return true;
                });
            }

            if (weekendOnly) {
                filtered = filtered.filter(o => {
                    if (!o.startDate) return false;
                    const date = new Date(o.startDate);
                    const day = date.getDay();
                    return day === 5 || day === 6; // Friday or Saturday
                });
            }

            // Status filters
            if (freeCancellationOnly) {
                filtered = filtered.filter(o => o.freeCancellation === true);
            }

            if (isPushed !== undefined) {
                filtered = filtered.filter(o => o.isPushed === isPushed);
            }

            if (isSold !== undefined) {
                filtered = filtered.filter(o => o.isSold === isSold);
            }

            return filtered;
        };

        // Apply filters to all opportunity types
        return {
            priceAnomalies: filterOpportunities(opportunities.priceAnomalies || []),
            buyOpportunities: filterOpportunities(opportunities.buyOpportunities || []),
            sellOpportunities: filterOpportunities(opportunities.sellOpportunities || []),
            arbitrageOpportunities: filterOpportunities(opportunities.arbitrageOpportunities || []),
            timingOpportunities: filterOpportunities(opportunities.timingOpportunities || [])
        };
    }
}

module.exports = OpportunityDetectorAgent;
