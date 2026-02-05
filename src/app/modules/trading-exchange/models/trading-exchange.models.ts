// ========================================
// Trading Exchange Models
// ========================================

// Price Chart Models
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  avgProfit?: number;
  avgMargin?: number;
}

export interface PriceHistoryResponse {
  success: boolean;
  symbol: string;
  name: string;
  timeframe: string;
  candles: Candle[];
  count: number;
}

// Order Book Models
export interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
  value?: number;
}

export interface OrderBook {
  success: boolean;
  hotelId: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  summary: {
    bestBid: number;
    bestAsk: number;
    spread: number;
    spreadPercent: number;
    midPrice: number;
    totalBidQuantity: number;
    totalAskQuantity: number;
  };
  timestamp: string;
}

// Portfolio Models
export interface Holding {
  bookingId: number;
  HotelId: number;
  hotelName: string;
  buyPrice: number;
  sellPrice: number;
  marketPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  checkIn: string;
  checkOut: string;
  daysToCheckIn: number;
  CancellationType: string;
  purchaseDate: string;
  holdingPeriod: number;
}

export interface HoldingByHotel {
  hotelId: number;
  hotelName: string;
  positions: Holding[];
  totalValue: number;
  totalPnL: number;
}

export interface PortfolioPerformance {
  totalTrades: number;
  winRate: number;
  wins: number;
  losses: number;
  avgProfit: number;
  avgMargin: number;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number;
}

export interface Portfolio {
  success: boolean;
  portfolio: {
    holdings: Holding[];
    holdingsByHotel: HoldingByHotel[];
    summary: {
      totalPositions: number;
      totalCostBasis: number;
      totalMarketValue: number;
      totalUnrealizedPnL: number;
      totalRealizedPnL: number;
      totalPnL: number;
      unrealizedPnLPercent: string;
    };
    performance: PortfolioPerformance;
  };
  timestamp: string;
}

// Market Data Models
export interface MarketTicker {
  symbol: string;
  hotelId: number;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume: number;
  avgProfit: number;
  avgMargin: number;
  activeInventory: number;
  soldCount: number;
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'WATCH';
}

export interface MarketDataResponse {
  success: boolean;
  tickers: MarketTicker[];
  count: number;
  timestamp: string;
}

// AI Signals Models
export interface SignalReason {
  category: string;
  text: string;
  weight: number;
}

export interface TradingSignal {
  id: string;
  type: 'BUY' | 'CONSIDER' | 'WATCH';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  asset: {
    hotelId: number;
    hotelName: string;
    checkIn: string;
    checkOut: string;
    daysToCheckIn: number;
  };
  pricing: {
    buyPrice: number;
    targetPrice: number;
    expectedProfit: number;
    expectedMargin: number;
    roi: number;
  };
  confidence: number;
  riskLevel: string;
  priorityScore: number;
  reasons: SignalReason[];
  timestamp: string;
  expiresIn: string;
  action: {
    primary: string;
    opportunityId: number;
  };
}

export interface AISignalsResponse {
  success: boolean;
  signals: TradingSignal[];
  consensus: {
    direction: string;
    buySignals: number;
    totalSignals: number;
    avgConfidence: number;
    marketCondition: string;
  };
  historicalPerformance: {
    winRate: string;
    avgMargin: string;
  };
  timestamp: string;
}

// Performance Metrics Models
export interface EquityCurvePoint {
  date: string;
  dailyPnL: number;
  cumulativePnL: number;
  trades: number;
  winRate: string;
}

export interface RiskLevelPerformance {
  riskLevel: string;
  trades: number;
  avgProfit: number;
  winRate: number;
}

export interface PerformanceMetrics {
  success: boolean;
  period: string;
  metrics: {
    totalTrades: number;
    soldTrades: number;
    activeTrades: number;
    totalInvested: number;
    totalRevenue: number;
    realizedProfit: number;
    unrealizedProfit: number;
    totalPnL: number;
    avgProfit: number;
    avgROI: number;
    winRate: number;
    winningTrades: number;
    losingTrades: number;
    profitFactor: string;
    maxDrawdown: number;
    maxDrawdownPercent: string;
  };
  equityCurve: EquityCurvePoint[];
  byRiskLevel: RiskLevelPerformance[];
  timestamp: string;
}

// Market Overview Models
export interface RecentTrade {
  tradeId: number;
  hotelName: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  IsSold: boolean;
  timestamp: string;
}

export interface MarketOverview {
  success: boolean;
  overview: {
    inventory: {
      active: number;
      unrealizedValue: number;
    };
    opportunities: {
      open: number;
      highConfidence: number;
    };
    performance: {
      weeklyProfit: number;
      weeklySales: number;
      avgProfitPerSale: string;
    };
  };
  recentTrades: RecentTrade[];
  marketStatus: 'ACTIVE' | 'NORMAL' | 'QUIET';
  timestamp: string;
}
