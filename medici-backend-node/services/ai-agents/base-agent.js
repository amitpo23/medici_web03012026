/**
 * Base AI Agent Class
 * Foundation for all prediction agents
 */
const logger = require('../../config/logger');

class BaseAgent {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.confidence = 0;
        this.lastAnalysis = null;
    }

    /**
     * Analyze data - to be implemented by child classes
     */
    async analyze(data) {
        throw new Error('analyze() must be implemented by child class');
    }

    /**
     * Get agent status
     */
    getStatus() {
        return {
            name: this.name,
            description: this.description,
            confidence: this.confidence,
            lastAnalysis: this.lastAnalysis,
            isActive: true
        };
    }

    /**
     * Calculate statistical metrics
     */
    calculateStats(values) {
        if (!values || values.length === 0) return { avg: 0, min: 0, max: 0, std: 0 };
        
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
        const std = Math.sqrt(variance);
        
        return { avg, min, max, std };
    }

    /**
     * Calculate trend direction
     */
    calculateTrend(values) {
        if (!values || values.length < 2) return 'stable';
        
        const recent = values.slice(-Math.min(10, values.length));
        const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
        const secondHalf = recent.slice(Math.floor(recent.length / 2));
        
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        const change = ((avgSecond - avgFirst) / avgFirst) * 100;
        
        if (change > 5) return 'rising';
        if (change < -5) return 'falling';
        return 'stable';
    }

    /**
     * Log agent activity
     */
    log(message) {
        logger.info(`[${this.name}] ${message}`);
    }
}

module.exports = BaseAgent;
