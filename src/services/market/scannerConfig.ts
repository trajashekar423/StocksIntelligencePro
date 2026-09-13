/**
 * Centralized Configuration for the NSE Intraday Low-Risk Confluence Quant Scanner
 * Zero magic numbers: all weights, thresholds, limits, and regime rules configured here.
 */

export const SCANNER_CONFIG = {
  // ── 1. HIGH-LEVEL COMPONENT WEIGHTS (Total = 1.00 / 100%) ──
  WEIGHTS: {
    GLOBAL_MARKET: 0.15,      // 15% (was 20%)
    INDIAN_MARKET: 0.25,      // 25% (was 30%)
    STOCK_TECHNICAL: 0.30,    // 30% (was 35%)
    NEWS_SENTIMENT: 0.15,     // 15% (NEW — live news sentiment)
    LIQUIDITY_VOLUME: 0.10,   // 10%
    RISK_FILTER: 0.05,        // 5%
  },

  // ── 2. GLOBAL MARKET COMPONENT WEIGHTS (Total = 1.00 / 100%) ──
  GLOBAL_WEIGHTS: {
    GIFT_NIFTY: 0.25,         // 25% (Leading early indicator for India)
    SP500: 0.15,              // 15% (US benchmark)
    NASDAQ: 0.10,             // 10% (Tech & growth sentiment)
    US_10Y_YIELD: 0.10,       // 10% (Bond yields inverted)
    US_VIX: 0.10,             // 10% (US volatility inverted)
    NIKKEI: 0.05,             // 5% (Asian morning session)
    HANG_SENG: 0.05,          // 5% (Hong Kong / China sentiment)
    SHANGHAI: 0.05,           // 5% (Chinese mainland)
    USD_INR: 0.05,            // 5% (Currency stability inverted)
    BRENT_CRUDE: 0.05,        // 5% (Oil shock indicator inverted)
  },

  // ── 3. INDIAN MARKET COMPONENT WEIGHTS (Total = 1.00 / 100%) ──
  INDIAN_WEIGHTS: {
    NIFTY_TREND: 0.20,        // 20% (Primary equity benchmark)
    BANK_NIFTY_TREND: 0.10,   // 10% (Heavyweight banking sector)
    INDIA_VIX: 0.15,          // 15% (Domestic fear index inverted)
    ADVANCE_DECLINE: 0.15,    // 15% (Market breadth ratio)
    FII_FLOW: 0.15,           // 15% (Foreign institutional net inflow)
    NIFTY_VWAP: 0.10,         // 10% (Index price vs intraday VWAP)
    DII_FLOW: 0.05,           // 5% (Domestic institutional support)
    NIFTY_EMA_ALIGNMENT: 0.05,// 5% (EMA20 vs EMA50 trend alignment)
    MARKET_VOLUME: 0.05,      // 5% (Participation intensity)
  },

  // ── 4. STOCK TECHNICAL SCORE WEIGHTS (Total = 1.00 / 100%) ──
  TECHNICAL_WEIGHTS: {
    TREND: 0.20,              // 20%
    VWAP_PROXIMITY: 0.15,     // 15%
    RELATIVE_VOLUME: 0.15,    // 15%
    MOMENTUM: 0.10,           // 10%
    RSI: 0.10,                // 10%
    RELATIVE_STRENGTH_NIFTY: 0.10, // 10%
    MULTI_TIMEFRAME: 0.10,    // 10%
    VOLATILITY_RISK: 0.10,    // 10%
  },

  // ── 5. MARKET REGIME THRESHOLDS (Indian Market Score 0 - 100) ──
  REGIMES: {
    STRONG_BULL_MIN: 80,
    BULL_MIN: 65,
    NEUTRAL_MIN: 50,
    BEAR_MIN: 35,
    // Below 35 = STRONG_BEAR
  },

  // ── 6. MANDATORY TRADING EXECUTION THRESHOLDS ──
  GATES: {
    MIN_LONG_MARKET_SCORE: 55,   // Cannot buy long when broader market < 55
    MAX_SHORT_MARKET_SCORE: 45,  // Cannot short when broader market > 45
    MIN_RVOL: 1.2,               // Minimum 1.2x relative volume required
    STRONG_RVOL: 1.5,            // Ideal institutional surge >= 1.5x
    LONG_RSI_MIN: 50,
    LONG_RSI_MAX: 70,
    SHORT_RSI_MIN: 30,
    SHORT_RSI_MAX: 50,
    MIN_RISK_REWARD: 2.0,        // 2:1 Minimum Target to Risk Ratio
  },

  // ── 7. RISK & INVALIDATION FILTERS ──
  RISK_FILTERS: {
    MIN_TURNOVER: 50000000,      // ₹5 Crore minimum daily traded value
    MIN_VOLUME: 100000,          // 1,00,000 minimum intraday shares
    MAX_SPREAD_PCT: 0.25,        // 0.25% maximum bid-ask spread
    MAX_GAP_PCT: 4.5,            // 4.5% maximum opening gap (avoid gap exhaustion)
    MAX_ATR_PCT: 3.5,            // 3.5% maximum ATR risk (volatility limit)
    CIRCUIT_BUFFER_PCT: 1.5,     // Stock must be at least 1.5% away from Upper/Lower circuits
  },
};

export type MarketRegimeType = 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR';
export type CandidateSignalType = 'LONG' | 'SHORT' | 'WATCH' | 'AVOID';
export type RiskLevelType = 'LOW' | 'MEDIUM' | 'HIGH';

