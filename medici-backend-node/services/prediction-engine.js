/**
 * AI Prediction Engine
 * Orchestrates all 5 AI agents for comprehensive market analysis
 */
const MarketAnalysisAgent = require('./ai-agents/market-analysis-agent');
const DemandPredictionAgent = require('./ai-agents/demand-prediction-agent');
const CompetitionMonitorAgent = require('./ai-agents/competition-monitor-agent');
const OpportunityDetectorAgent = require('./ai-agents/opportunity-detector-agent');
const DecisionMakerAgent = require('./ai-agents/decision-maker-agent');
const { getPool } = require('../config/database');

class PredictionEngine {
    constructor() {
        // Initialize all 5 agents
        this.agents = {
            marketAnalysis: new MarketAnalysisAgent(),
            demandPrediction: new DemandPredictionAgent(),
            competitionMonitor: new CompetitionMonitorAgent(),
            opportunityDetector: new OpportunityDetectorAgent(),
            decisionMaker: new DecisionMakerAgent()
        };

        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get all agents status
     */
    getAgentStatus() {
        return Object.keys(this.agents).map(key => ({
            id: key,
            ...this.agents[key].getStatus()
        }));
    }

    /**
     * Fetch booking data from database
     */
    async fetchBookingData(filters = {}) {
        const cacheKey = `bookings_${JSON.stringify(filters)}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            const pool = await getPool();
            
            let query = `
                SELECT TOP 5000
                    b.id,
                    b.PreBookId,
                    b.HotelId,
                    h.Name as HotelName,
                    b.startDate,
                    b.endDate,
                    b.price,
                    b.lastPrice,
                    b.IsSold,
                    b.IsActive,
                    b.Status,
                    b.DateInsert,
                    b.providers,
                    b.supplierReference
                FROM MED_Book b
                LEFT JOIN Med_Hotels h ON b.HotelId = h.HotelId
                WHERE b.price > 0
            `;

            const params = [];

            if (filters.hotelId) {
                query += ` AND b.HotelId = @hotelId`;
                params.push({ name: 'hotelId', value: filters.hotelId });
            }

            if (filters.startDate) {
                query += ` AND b.startDate >= @startDate`;
                params.push({ name: 'startDate', value: filters.startDate });
            }

            if (filters.endDate) {
                query += ` AND b.startDate <= @endDate`;
                params.push({ name: 'endDate', value: filters.endDate });
            }

            query += ` ORDER BY b.DateInsert DESC`;

            const request = pool.request();
            params.forEach(p => request.input(p.name, p.value));
            
            const result = await request.query(query);
            
            this.cache.set(cacheKey, {
                data: result.recordset,
                timestamp: Date.now()
            });

            return result.recordset;
        } catch (error) {
            console.error('Error fetching booking data:', error);
            throw error;
        }
    }

    /**
     * Fetch available cities
     */
    async fetchCities() {
        try {
            const pool = await getPool();
            const result = await pool.request().query(`
                SELECT Name as cityName, Id, CountryId
                FROM Destinations
                WHERE Type = 'city'
                ORDER BY Name
            `);
            return result.recordset;
        } catch (error) {
            console.error('Error fetching cities:', error);
            return [];
        }
    }

    /**
     * Fetch available hotels
     */
    async fetchHotels(city = null) {
        try {
            const pool = await getPool();
            let query = `
                SELECT DISTINCT TOP 100
                    h.HotelId as hotelId, 
                    h.Name as hotelName,
                    COUNT(b.id) as bookingCount,
                    AVG(b.price) as avgPrice
                FROM Med_Hotels h
                LEFT JOIN MED_Book b ON h.HotelId = b.HotelId
                WHERE h.Name IS NOT NULL
                GROUP BY h.HotelId, h.Name 
                ORDER BY bookingCount DESC
            `;

            const result = await pool.request().query(query);
            return result.recordset;
        } catch (error) {
            console.error('Error fetching hotels:', error);
            return [];
        }
    }

    /**
     * Run full prediction analysis
     */
    async runFullAnalysis(options = {}) {
        const { 
            hotelId, 
            city, 
            userInstructions,
            riskTolerance = 'medium',
            futureDays = 30 
        } = options;

        console.log('🤖 Starting AI Prediction Engine...');
        console.log(`   Filters: hotel=${hotelId}, city=${city}`);
        console.log(`   Instructions: ${userInstructions || 'none'}`);

        // Fetch data
        const bookings = await this.fetchBookingData({ hotelId, city });
        console.log(`   Loaded ${bookings.length} bookings for analysis`);

        if (bookings.length === 0) {
            return {
                success: false,
                message: 'No booking data available for analysis',
                agents: this.getAgentStatus()
            };
        }

        const analysisData = {
            bookings,
            hotelId,
            city,
            userInstructions,
            futureDays
        };

        // Run all agents in parallel
        console.log('   Running 5 AI agents...');
        
        const [
            marketAnalysis,
            demandPrediction,
            competitionMonitor,
            opportunityDetector
        ] = await Promise.all([
            this.agents.marketAnalysis.analyze(analysisData),
            this.agents.demandPrediction.analyze(analysisData),
            this.agents.competitionMonitor.analyze(analysisData),
            this.agents.opportunityDetector.analyze(analysisData)
        ]);

        // Run decision maker with all results
        const agentResults = {
            MarketAnalysisAgent: marketAnalysis,
            DemandPredictionAgent: demandPrediction,
            CompetitionMonitorAgent: competitionMonitor,
            OpportunityDetectorAgent: opportunityDetector
        };

        const finalDecision = await this.agents.decisionMaker.analyze({
            agentResults,
            userInstructions,
            riskTolerance
        });

        console.log('   ✅ Analysis complete!');

        return {
            success: true,
            timestamp: new Date().toISOString(),
            filters: { hotelId, city, userInstructions },
            dataPoints: bookings.length,
            agentResults: {
                marketAnalysis,
                demandPrediction,
                competitionMonitor,
                opportunityDetector
            },
            finalDecision,
            summary: finalDecision.success ? finalDecision.analysis.executiveSummary : null
        };
    }

    /**
     * Get opportunities only (faster query)
     */
    async getOpportunities(options = {}) {
        const { hotelId, city, userInstructions, filters, limit = 50 } = options;

        const bookings = await this.fetchBookingData({ hotelId, city });
        
        if (bookings.length === 0) {
            return {
                success: false,
                message: 'No data available',
                opportunities: []
            };
        }

        const result = await this.agents.opportunityDetector.analyze({
            bookings,
            hotelId,
            city,
            userInstructions,
            filters // Pass filters to agent
        });

        if (!result.success) {
            return result;
        }

        // Format opportunities for frontend
        const opportunities = result.analysis.opportunities
            .slice(0, limit)
            .map((opp, index) => ({
                rank: index + 1,
                ...opp,
                formattedDate: opp.startDate ? new Date(opp.startDate).toLocaleDateString() : null
            }));

        return {
            success: true,
            total: result.analysis.summary.totalOpportunities,
            buyCount: result.analysis.summary.buyOpportunities,
            sellCount: result.analysis.summary.sellOpportunities,
            highPriority: result.analysis.summary.highPriorityCount,
            opportunities,
            filters: { hotelId, city, userInstructions, ...filters }
        };
    }

    /**
     * Get market analysis for specific hotel/city
     */
    async getMarketAnalysis(options = {}) {
        const { hotelId, city } = options;

        const bookings = await this.fetchBookingData({ hotelId, city });
        
        if (bookings.length === 0) {
            return {
                success: false,
                message: 'No data available'
            };
        }

        return await this.agents.marketAnalysis.analyze({
            bookings,
            hotelId,
            city
        });
    }

    /**
     * Get demand forecast
     */
    async getDemandForecast(options = {}) {
        const { hotelId, city, futureDays = 30 } = options;

        const bookings = await this.fetchBookingData({ hotelId, city });
        
        if (bookings.length === 0) {
            return {
                success: false,
                message: 'No data available'
            };
        }

        return await this.agents.demandPrediction.analyze({
            bookings,
            hotelId,
            city,
            futureDays
        });
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Prediction engine cache cleared');
    }
}

// Singleton instance
let engineInstance = null;

function getPredictionEngine() {
    if (!engineInstance) {
        engineInstance = new PredictionEngine();
    }
    return engineInstance;
}

module.exports = { PredictionEngine, getPredictionEngine };
