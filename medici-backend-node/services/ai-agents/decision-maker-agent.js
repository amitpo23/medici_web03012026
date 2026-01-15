/**
 * Agent 5: Decision Maker Agent
 * Synthesizes all agent outputs and makes final recommendations
 */
const BaseAgent = require('./base-agent');

class DecisionMakerAgent extends BaseAgent {
    constructor() {
        super('DecisionMakerAgent', 'Synthesizes all agents and makes final recommendations');
        this.agentWeights = {
            MarketAnalysisAgent: 0.25,
            DemandPredictionAgent: 0.25,
            CompetitionMonitorAgent: 0.20,
            OpportunityDetectorAgent: 0.30
        };
    }

    /**
     * Synthesize all agent analyses
     */
    async analyze(data) {
        const { agentResults, userInstructions, riskTolerance = 'medium' } = data;
        
        this.log(`Synthesizing ${Object.keys(agentResults).length} agent results`);

        // Validate agent results
        const validResults = this.validateAgentResults(agentResults);
        
        if (Object.keys(validResults).length < 2) {
            return {
                agent: this.name,
                success: false,
                message: 'Insufficient agent data for decision making',
                confidence: 0
            };
        }

        // Calculate consensus
        const consensus = this.calculateConsensus(validResults);
        
        // Generate action plan
        const actionPlan = this.generateActionPlan(validResults, consensus, riskTolerance);
        
        // Create prioritized recommendations
        const recommendations = this.prioritizeRecommendations(validResults, actionPlan);
        
        // Calculate risk assessment
        const riskAssessment = this.assessRisk(validResults, actionPlan);
        
        // Generate executive summary
        const executiveSummary = this.generateExecutiveSummary(consensus, actionPlan, recommendations);

        // Overall confidence (weighted average of agent confidences)
        this.confidence = this.calculateOverallConfidence(validResults);
        this.lastAnalysis = new Date();

        return {
            agent: this.name,
            success: true,
            confidence: this.confidence,
            analysis: {
                consensus,
                actionPlan,
                recommendations: recommendations.slice(0, 20),
                riskAssessment,
                executiveSummary,
                agentAgreement: this.calculateAgentAgreement(validResults),
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Validate agent results
     */
    validateAgentResults(agentResults) {
        const valid = {};
        
        Object.keys(agentResults).forEach(agentName => {
            const result = agentResults[agentName];
            if (result && result.success && result.analysis) {
                valid[agentName] = result;
            }
        });

        return valid;
    }

    /**
     * Calculate consensus from all agents
     */
    calculateConsensus(results) {
        const signals = {
            buy: { count: 0, totalStrength: 0, agents: [] },
            sell: { count: 0, totalStrength: 0, agents: [] },
            hold: { count: 0, totalStrength: 0, agents: [] },
            caution: { count: 0, totalStrength: 0, agents: [] }
        };

        // Extract signals from each agent
        Object.keys(results).forEach(agentName => {
            const result = results[agentName];
            const weight = this.agentWeights[agentName] || 0.2;
            
            // Market Analysis signals
            if (result.analysis.recommendation) {
                const recs = Array.isArray(result.analysis.recommendation) 
                    ? result.analysis.recommendation 
                    : [result.analysis.recommendation];
                
                recs.forEach(rec => {
                    const action = rec.action?.toUpperCase();
                    const strength = rec.urgency === 'high' ? 1.0 : rec.urgency === 'medium' ? 0.7 : 0.4;
                    
                    if (action?.includes('BUY')) {
                        signals.buy.count++;
                        signals.buy.totalStrength += strength * weight;
                        signals.buy.agents.push(agentName);
                    } else if (action?.includes('SELL')) {
                        signals.sell.count++;
                        signals.sell.totalStrength += strength * weight;
                        signals.sell.agents.push(agentName);
                    } else if (action?.includes('HOLD') || action?.includes('WAIT')) {
                        signals.hold.count++;
                        signals.hold.totalStrength += strength * weight;
                        signals.hold.agents.push(agentName);
                    } else if (action?.includes('CAUTION')) {
                        signals.caution.count++;
                        signals.caution.totalStrength += strength * weight;
                        signals.caution.agents.push(agentName);
                    }
                });
            }

            // Opportunity Detector signals
            if (result.analysis.summary) {
                const summary = result.analysis.summary;
                if (summary.buyOpportunities > 0) {
                    signals.buy.count++;
                    signals.buy.totalStrength += (summary.buyOpportunities / 10) * weight;
                    if (!signals.buy.agents.includes(agentName)) signals.buy.agents.push(agentName);
                }
                if (summary.sellOpportunities > 0) {
                    signals.sell.count++;
                    signals.sell.totalStrength += (summary.sellOpportunities / 10) * weight;
                    if (!signals.sell.agents.includes(agentName)) signals.sell.agents.push(agentName);
                }
            }
        });

        // Determine consensus signal
        const sortedSignals = Object.entries(signals)
            .map(([signal, data]) => ({ signal, ...data }))
            .sort((a, b) => b.totalStrength - a.totalStrength);

        const primarySignal = sortedSignals[0];
        const secondarySignal = sortedSignals[1];

        return {
            primarySignal: primarySignal.signal.toUpperCase(),
            primaryStrength: primarySignal.totalStrength.toFixed(2),
            primaryAgents: primarySignal.agents,
            secondarySignal: secondarySignal.signal.toUpperCase(),
            secondaryStrength: secondarySignal.totalStrength.toFixed(2),
            allSignals: signals,
            consensusStrength: this.getConsensusStrength(primarySignal, sortedSignals)
        };
    }

    /**
     * Get consensus strength label
     */
    getConsensusStrength(primary, allSorted) {
        const totalStrength = allSorted.reduce((sum, s) => sum + s.totalStrength, 0);
        const primaryShare = totalStrength > 0 ? primary.totalStrength / totalStrength : 0;
        
        if (primaryShare > 0.7) return 'strong';
        if (primaryShare > 0.5) return 'moderate';
        if (primaryShare > 0.3) return 'weak';
        return 'mixed';
    }

    /**
     * Generate action plan
     */
    generateActionPlan(results, consensus, riskTolerance) {
        const actions = [];

        // Immediate actions based on consensus
        if (consensus.consensusStrength === 'strong' || consensus.consensusStrength === 'moderate') {
            if (consensus.primarySignal === 'BUY') {
                actions.push({
                    priority: 1,
                    action: 'EXECUTE_BUY',
                    description: 'Market conditions favor buying',
                    timing: 'immediate',
                    riskLevel: riskTolerance === 'high' ? 'acceptable' : 'monitor_closely'
                });
            } else if (consensus.primarySignal === 'SELL') {
                actions.push({
                    priority: 1,
                    action: 'EXECUTE_SELL',
                    description: 'Market conditions favor selling',
                    timing: 'immediate',
                    riskLevel: 'low'
                });
            }
        }

        // Add opportunity-specific actions
        const opportunityResult = results['OpportunityDetectorAgent'];
        if (opportunityResult?.analysis?.opportunities) {
            const topOpps = opportunityResult.analysis.opportunities.slice(0, 5);
            topOpps.forEach((opp, index) => {
                actions.push({
                    priority: index + 2,
                    action: opp.type,
                    description: opp.reason,
                    timing: opp.priority === 'high' ? 'immediate' : 'within_24h',
                    target: opp.hotelName,
                    potentialValue: opp.potentialProfit || opp.discount,
                    riskLevel: this.mapPriorityToRisk(opp.priority, riskTolerance)
                });
            });
        }

        // Add monitoring actions
        if (consensus.consensusStrength === 'weak' || consensus.consensusStrength === 'mixed') {
            actions.push({
                priority: 10,
                action: 'MONITOR',
                description: 'Mixed signals - continue monitoring market',
                timing: 'ongoing',
                riskLevel: 'low'
            });
        }

        return actions.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Map priority to risk level
     */
    mapPriorityToRisk(priority, tolerance) {
        const riskMap = {
            high: tolerance === 'high' ? 'acceptable' : 'elevated',
            medium: tolerance === 'low' ? 'elevated' : 'acceptable',
            low: 'low'
        };
        return riskMap[priority] || 'unknown';
    }

    /**
     * Prioritize and consolidate recommendations
     */
    prioritizeRecommendations(results, actionPlan) {
        const allRecommendations = [];

        // Collect all recommendations from agents
        Object.keys(results).forEach(agentName => {
            const result = results[agentName];
            const weight = this.agentWeights[agentName] || 0.2;
            
            if (result.analysis.recommendation) {
                const recs = Array.isArray(result.analysis.recommendation) 
                    ? result.analysis.recommendation 
                    : [result.analysis.recommendation];
                
                recs.forEach(rec => {
                    allRecommendations.push({
                        ...rec,
                        source: agentName,
                        weight,
                        combinedScore: this.calculateRecScore(rec, weight)
                    });
                });
            }
        });

        // Add opportunity-based recommendations
        const opportunityResult = results['OpportunityDetectorAgent'];
        if (opportunityResult?.analysis?.opportunities) {
            opportunityResult.analysis.opportunities.slice(0, 10).forEach(opp => {
                allRecommendations.push({
                    action: opp.type,
                    reason: opp.reason,
                    urgency: opp.priority,
                    target: opp.hotelName,
                    value: opp.potentialProfit || opp.discount,
                    source: 'OpportunityDetectorAgent',
                    weight: 0.3,
                    combinedScore: opp.finalScore || opp.score
                });
            });
        }

        // Sort by combined score and deduplicate
        return allRecommendations
            .sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0))
            .filter((rec, index, arr) => 
                index === arr.findIndex(r => 
                    r.action === rec.action && r.target === rec.target
                )
            );
    }

    /**
     * Calculate recommendation score
     */
    calculateRecScore(rec, weight) {
        let score = weight * 10;
        
        if (rec.urgency === 'high') score *= 1.5;
        if (rec.urgency === 'medium') score *= 1.2;
        
        return score;
    }

    /**
     * Assess overall risk
     */
    assessRisk(results, actionPlan) {
        const riskFactors = [];
        let overallRiskScore = 0;

        // Check market volatility
        const marketResult = results['MarketAnalysisAgent'];
        if (marketResult?.analysis?.marketIndicators?.isVolatile) {
            riskFactors.push({
                factor: 'High Market Volatility',
                impact: 'high',
                mitigation: 'Use smaller position sizes'
            });
            overallRiskScore += 3;
        }

        // Check consensus strength
        if (actionPlan.some(a => a.riskLevel === 'elevated')) {
            riskFactors.push({
                factor: 'Mixed Agent Signals',
                impact: 'medium',
                mitigation: 'Wait for clearer signals'
            });
            overallRiskScore += 2;
        }

        // Check competition intensity
        const competitionResult = results['CompetitionMonitorAgent'];
        if (competitionResult?.analysis?.totalHotels > 50) {
            riskFactors.push({
                factor: 'High Competition',
                impact: 'medium',
                mitigation: 'Focus on niche opportunities'
            });
            overallRiskScore += 1;
        }

        // Determine overall risk level
        let overallRiskLevel = 'low';
        if (overallRiskScore > 4) overallRiskLevel = 'high';
        else if (overallRiskScore > 2) overallRiskLevel = 'medium';

        return {
            overallRiskLevel,
            overallRiskScore,
            riskFactors,
            recommendation: overallRiskLevel === 'high' 
                ? 'Proceed with caution, reduce position sizes'
                : overallRiskLevel === 'medium'
                ? 'Normal operations, monitor closely'
                : 'Conditions are favorable for trading'
        };
    }

    /**
     * Generate executive summary
     */
    generateExecutiveSummary(consensus, actionPlan, recommendations) {
        const topActions = actionPlan.slice(0, 3);
        const topRecs = recommendations.slice(0, 3);

        return {
            headline: `${consensus.consensusStrength.toUpperCase()} ${consensus.primarySignal} SIGNAL`,
            summary: this.generateSummaryText(consensus, topActions),
            keyPoints: [
                `Primary signal: ${consensus.primarySignal} (strength: ${consensus.primaryStrength})`,
                `Agents in agreement: ${consensus.primaryAgents.length}`,
                `Top action: ${topActions[0]?.action || 'Monitor'}`,
                `Total recommendations: ${recommendations.length}`
            ],
            immediateActions: topActions.filter(a => a.timing === 'immediate'),
            topOpportunities: topRecs.slice(0, 5)
        };
    }

    /**
     * Generate summary text
     */
    generateSummaryText(consensus, actions) {
        const signal = consensus.primarySignal.toLowerCase();
        const strength = consensus.consensusStrength;
        
        if (strength === 'strong') {
            return `Strong ${signal} signal detected. ${consensus.primaryAgents.length} agents agree. Consider executing ${signal} strategy with confidence.`;
        } else if (strength === 'moderate') {
            return `Moderate ${signal} signal. Most indicators point to ${signal}ing opportunities. Proceed with normal position sizes.`;
        } else if (strength === 'weak') {
            return `Weak ${signal} signal. Mixed indicators suggest caution. Consider waiting for clearer direction.`;
        } else {
            return `Mixed signals from agents. No clear consensus. Recommend monitoring and waiting for better opportunities.`;
        }
    }

    /**
     * Calculate agent agreement
     */
    calculateAgentAgreement(results) {
        const agentSignals = [];
        
        Object.keys(results).forEach(agentName => {
            const result = results[agentName];
            if (result.analysis.recommendation) {
                const recs = Array.isArray(result.analysis.recommendation) 
                    ? result.analysis.recommendation 
                    : [result.analysis.recommendation];
                
                const primaryAction = recs[0]?.action?.toUpperCase() || 'HOLD';
                agentSignals.push({ agent: agentName, signal: primaryAction });
            }
        });

        // Count matching signals
        const signalCounts = {};
        agentSignals.forEach(as => {
            const normalized = as.signal.includes('BUY') ? 'BUY' 
                : as.signal.includes('SELL') ? 'SELL' 
                : 'HOLD';
            signalCounts[normalized] = (signalCounts[normalized] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(signalCounts));
        const agreementPercent = agentSignals.length > 0 
            ? (maxCount / agentSignals.length) * 100 
            : 0;

        return {
            percentage: agreementPercent.toFixed(0),
            agentSignals,
            signalCounts
        };
    }

    /**
     * Calculate overall confidence
     */
    calculateOverallConfidence(results) {
        let totalWeight = 0;
        let weightedConfidence = 0;

        Object.keys(results).forEach(agentName => {
            const weight = this.agentWeights[agentName] || 0.2;
            const confidence = results[agentName].confidence || 0.5;
            
            totalWeight += weight;
            weightedConfidence += confidence * weight;
        });

        return totalWeight > 0 ? weightedConfidence / totalWeight : 0;
    }
}

module.exports = DecisionMakerAgent;
