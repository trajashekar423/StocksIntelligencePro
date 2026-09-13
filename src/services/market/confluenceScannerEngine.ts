/**
 * Comprehensive Confluence Quant Scanner Engine
 *
 * Implements the 3-Tier Quantitative Hierarchy:
 * FINAL SCORE = (Global Market × 20%) + (Indian Market × 30%) + (Stock Technical × 35%) + (Liquidity × 10%) + (Risk × 5%)
 *
 * Features:
 * - Multi-level Confluence Gate (Global Macro + Indian Regime + Sector Tailwinds + Stock Technicals)
 * - Strict Long & Short Candidate Validation
 * - Automated False Breakout Suppression in Bear Regimes
 * - Hard Risk Invalidation Filters (Circuits, Spread, Gap, Liquidity)
 * - Full Explainability (Checkmarks ✓ & Warnings ⚠)
 * - Outputs: Top 10 LONG, Top 10 SHORT, and Top 10 WATCH
 */

import {
  SCANNER_CONFIG,
  type MarketRegimeType,
  type CandidateSignalType,
  type RiskLevelType,
} from './scannerConfig.ts';
import { computeGlobalMarketScore, type GlobalMarketResult, type GlobalMarketInput } from './globalMarketEngine.ts';
import { computeIndiaMarketScore, type IndiaMarketResult, type IndiaMarketInput } from './indiaMarketEngine.ts';
import { computeSectorStrength, type SectorStrengthResult } from './sectorStrengthEngine.ts';

export interface RawStockCandidate {
  symbol: string;
  companyName?: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  previousDayHigh?: number;
  previousDayLow?: number;
  volume: number;
  averageVolume?: number;
  relativeVolume?: number;
  vwap?: number;
  ema9?: number;
  ema20?: number;
  ema50?: number;
  rsi?: number;
  atr?: number;
  sector?: string;
  trend5m?: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  trend15m?: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  trend1h?: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  bidPrice?: number;
  askPrice?: number;
  upperCircuit?: number;
  lowerCircuit?: number;
  isHalted?: boolean;
  // Live News Sentiment (optional — injected from news API)
  newsSentimentScore?: number;  // -1.0 to +1.0 from newsSentimentEngine
  newsSentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  newsHeadline?: string;
}

export interface EvaluatedCandidate {
  symbol: string;
  companyName: string;
  price: number;
  finalScore: number;          // 0 - 100
  marketScore: number;         // 0 - 100 (Indian Market Score)
  globalScore: number;         // 0 - 100 (Global Macro Score)
  technicalScore: number;      // 0 - 100 (Stock Technical Score)
  newsScore: number;           // 0 - 100 (Live News Sentiment Score)
  volumeScore: number;         // 0 - 100 (Liquidity & Volume Score)
  riskScore: number;           // 0 - 100 (Risk Safety Score)

  vwap: number;
  ema20: number;
  ema50: number;
  rsi: number;
  atrPercent: number;
  relativeVolume: number;

  sector: string;
  sectorScore: number;

  marketRegime: MarketRegimeType;
  signal: CandidateSignalType;
  riskLevel: RiskLevelType;

  // Execution & Invalidation
  isPassingAllFilters: boolean;
  canTrade: boolean;
  targetPrice: number;
  stopLossPrice: number;
  riskRewardRatio: number;

  // Explainability
  reasons: string[];
  warnings: string[];
}

export interface ConfluenceScanResult {
  timestamp: string;
  globalMarket: GlobalMarketResult;
  indianMarket: IndiaMarketResult;
  sectorStrength: SectorStrengthResult;
  totalEvaluated: number;
  qualifiedCount: number;
  top10Long: EvaluatedCandidate[];
  top10Short: EvaluatedCandidate[];
  top10Watch: EvaluatedCandidate[];
  allCandidates: EvaluatedCandidate[];
}

/**
 * Computes the 0 - 100 Stock Technical Score based on:
 * Trend (20%), VWAP (15%), RVOL (15%), Momentum (10%), RSI (10%), RS vs NIFTY (10%), MTF Confirmation (10%), ATR Risk (10%)
 */
function computeStockTechnicalScore(
  stock: RawStockCandidate,
  niftyChgPct: number,
  isLong: boolean
): { score: number; reasons: string[]; warnings: string[] } {
  const w = SCANNER_CONFIG.TECHNICAL_WEIGHTS;
  const reasons: string[] = [];
  const warnings: string[] = [];

  const price = Number(stock.price || 0);
  const open = Number(stock.open || price);
  const prevClose = Number(stock.previousClose || price);
  const vwap = Number(stock.vwap || price);
  const rvol = Number(stock.relativeVolume || 1.2);
  const rsi = Number(stock.rsi ?? 56);
  const ema9 = Number(stock.ema9 || price);
  const ema20 = Number(stock.ema20 || price * 0.99);
  const ema50 = Number(stock.ema50 || price * 0.98);
  const atr = Number(stock.atr || price * 0.015);

  const chgPct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
  const rsVsNifty = chgPct - niftyChgPct;
  const atrPct = price > 0 ? (atr / price) * 100 : 1.5;

  // 1. Trend Component (0 - 100, weight 20%)
  let trendScore = 50;
  const isEmaBullish = ema20 >= ema50;
  const isPriceAboveEma9 = price >= ema9;
  const isPriceAboveOpen = price >= open;

  if (isLong) {
    if (isEmaBullish && isPriceAboveEma9 && isPriceAboveOpen) {
      trendScore = 100;
      reasons.push('EMA20 > EMA50 bullish trend confirmed');
    } else if (isEmaBullish) {
      trendScore = 75;
    } else {
      trendScore = 20;
      warnings.push('EMA20 below EMA50 (Counter-trend setup)');
    }
  } else {
    // Short
    if (!isEmaBullish && !isPriceAboveEma9 && !isPriceAboveOpen) {
      trendScore = 100;
      reasons.push('EMA20 < EMA50 clear downtrend');
    } else if (!isEmaBullish) {
      trendScore = 75;
    } else {
      trendScore = 20;
      warnings.push('EMA20 above EMA50 (Bullish moving averages on short)');
    }
  }

  // 2. VWAP Component (0 - 100, weight 15%)
  let vwapScore = 0;
  if (isLong) {
    if (price >= vwap) {
      const vwapDist = vwap > 0 ? ((price - vwap) / vwap) * 100 : 0;
      vwapScore = Math.min(Math.max(vwapDist / 1.0, 0.5), 1.0) * 100;
      reasons.push(`Price holding above ₹${vwap.toFixed(2)} VWAP`);
    } else {
      vwapScore = 0; // Strict 0 below VWAP
      warnings.push(`Price trapped below ₹${vwap.toFixed(2)} VWAP`);
    }
  } else {
    // Short
    if (price <= vwap) {
      const vwapDist = vwap > 0 ? ((vwap - price) / vwap) * 100 : 0;
      vwapScore = Math.min(Math.max(vwapDist / 1.0, 0.5), 1.0) * 100;
      reasons.push(`Price rejecting below ₹${vwap.toFixed(2)} VWAP`);
    } else {
      vwapScore = 0;
      warnings.push(`Price is above VWAP (risky for short)`);
    }
  }

  // 3. Relative Volume (0 - 100, weight 15%)
  const rvolScore = Math.min(Math.max(rvol / 2.0, 0), 1.0) * 100;
  if (rvol >= 1.5) {
    reasons.push(`High Institutional Volume (${rvol.toFixed(1)}x RVOL)`);
  } else if (rvol >= 1.2) {
    reasons.push(`Above Average Volume (${rvol.toFixed(1)}x RVOL)`);
  } else {
    warnings.push(`Low volume participation (${rvol.toFixed(1)}x RVOL)`);
  }

  // 4. Momentum (0 - 100, weight 10%)
  let momentumScore = 50;
  if (isLong) {
    if (chgPct > 0 && chgPct <= 6.0) {
      momentumScore = Math.min(chgPct / 3.0, 1.0) * 100;
      reasons.push(`Intraday gain +${chgPct.toFixed(2)}%`);
    } else if (chgPct > 6.0) {
      momentumScore = 70; // Extended cap
      warnings.push(`Stock gained +${chgPct.toFixed(2)}% (Do not chase tops)`);
    } else {
      momentumScore = 10;
      warnings.push(`Negative intraday return (${chgPct.toFixed(2)}%)`);
    }
  } else {
    if (chgPct < 0 && chgPct >= -6.0) {
      momentumScore = Math.min(Math.abs(chgPct) / 3.0, 1.0) * 100;
      reasons.push(`Intraday drop ${chgPct.toFixed(2)}%`);
    } else {
      momentumScore = 15;
    }
  }

  // 5. RSI 14 (0 - 100, weight 10%)
  let rsiScore = 50;
  if (isLong) {
    if (rsi >= 55 && rsi <= 70) {
      rsiScore = 100;
      reasons.push(`Healthy Bullish RSI (${Math.round(rsi)})`);
    } else if (rsi >= 50 && rsi < 55) {
      rsiScore = 75;
    } else if (rsi > 70) {
      rsiScore = 40;
      warnings.push(`RSI ${Math.round(rsi)} overbought`);
    } else {
      rsiScore = 15;
      warnings.push(`RSI ${Math.round(rsi)} weak (< 50)`);
    }
  } else {
    if (rsi >= 30 && rsi <= 45) {
      rsiScore = 100;
      reasons.push(`Bearish Momentum RSI (${Math.round(rsi)})`);
    } else if (rsi < 30) {
      rsiScore = 45;
      warnings.push(`RSI ${Math.round(rsi)} oversold`);
    } else {
      rsiScore = 15;
    }
  }

  // 6. Relative Strength vs Nifty (0 - 100, weight 10%)
  let rsScore = 50;
  if (isLong) {
    if (rsVsNifty >= 1.0) {
      rsScore = 100;
      reasons.push(`Strong Outperformance vs NIFTY (+${rsVsNifty.toFixed(1)}% RS)`);
    } else if (rsVsNifty > 0) {
      rsScore = 75;
      reasons.push('Outperforming NIFTY index');
    } else {
      rsScore = 20;
      warnings.push('Underperforming NIFTY index');
    }
  } else {
    if (rsVsNifty <= -1.0) {
      rsScore = 100;
      reasons.push(`Heavy Underperformance vs NIFTY (${rsVsNifty.toFixed(1)}% RS)`);
    } else if (rsVsNifty < 0) {
      rsScore = 75;
    } else {
      rsScore = 20;
    }
  }

  // 7. Multi-Timeframe Confirmation (0 - 100, weight 10%)
  let mtfScore = 50;
  const t5 = stock.trend5m || (price > open ? 'BULLISH' : 'BEARISH');
  const t15 = stock.trend15m || (isEmaBullish ? 'BULLISH' : 'BEARISH');
  const t1h = stock.trend1h || 'BULLISH';

  if (isLong) {
    if (t5 === 'BULLISH' && t15 === 'BULLISH' && t1h === 'BULLISH') {
      mtfScore = 100;
      reasons.push('Multi-timeframe trend alignment (5m, 15m, 1h Bullish)');
    } else if (t15 === 'BULLISH') {
      mtfScore = 70;
      reasons.push('15-minute trend bullish');
    } else {
      mtfScore = 20;
      warnings.push('Higher timeframes conflicting');
    }
  } else {
    if (t5 === 'BEARISH' && t15 === 'BEARISH' && t1h === 'BEARISH') {
      mtfScore = 100;
      reasons.push('Multi-timeframe downtrend (5m, 15m, 1h Bearish)');
    } else if (t15 === 'BEARISH') {
      mtfScore = 70;
    } else {
      mtfScore = 20;
    }
  }

  // 8. Volatility & ATR Risk (0 - 100, weight 10%)
  let atrScore = 50;
  if (atrPct <= 2.2) {
    atrScore = 95;
    reasons.push(`Controlled Volatility (ATR ${atrPct.toFixed(1)}%)`);
  } else if (atrPct <= 3.2) {
    atrScore = 70;
  } else {
    atrScore = 30;
    warnings.push(`High intraday ATR risk (${atrPct.toFixed(1)}%)`);
  }

  const rawTech =
    (trendScore * w.TREND) +
    (vwapScore * w.VWAP_PROXIMITY) +
    (rvolScore * w.RELATIVE_VOLUME) +
    (momentumScore * w.MOMENTUM) +
    (rsiScore * w.RSI) +
    (rsScore * w.RELATIVE_STRENGTH_NIFTY) +
    (mtfScore * w.MULTI_TIMEFRAME) +
    (atrScore * w.VOLATILITY_RISK);

  const finalTechScore = Math.max(Math.min(Math.round(rawTech), 100), 0);
  return { score: finalTechScore, reasons, warnings };
}

/**
 * Runs the complete 3-tier Confluence Quant Scanner on the candidate universe.
 */
export function runConfluenceQuantScan(
  candidates: RawStockCandidate[],
  globalInputs: GlobalMarketInput = {},
  indiaInputs: IndiaMarketInput = {}
): ConfluenceScanResult {
  // 1. Calculate Tier 1 & Tier 2 Macro Scores
  const globalResult = computeGlobalMarketScore(globalInputs);
  const indiaResult = computeIndiaMarketScore(indiaInputs);
  const sectorResult = computeSectorStrength({}, indiaInputs.niftyChangePct ?? 0.35);

  const evaluatedList: EvaluatedCandidate[] = [];

  candidates.forEach((stock) => {
    const price = Number(stock.price || 0);
    const volume = Number(stock.volume || 0);
    const prevClose = Number(stock.previousClose || price);
    const vwap = Number(stock.vwap || price);
    const rvol = Number(stock.relativeVolume || 1.2);
    const rsi = Number(stock.rsi ?? 55);
    const ema20 = Number(stock.ema20 || price * 0.99);
    const ema50 = Number(stock.ema50 || price * 0.98);
    const atr = Number(stock.atr || price * 0.015);
    const sector = stock.sector || 'Equities';

    const tradedValue = price * volume;
    const atrPct = price > 0 ? Number(((atr / price) * 100).toFixed(2)) : 1.5;

    // ── HARD RISK INVALIDATION FILTERS ──
    const filterFailures: string[] = [];
    if (stock.isHalted) filterFailures.push('Trading Halted / Suspended');
    if (tradedValue < SCANNER_CONFIG.RISK_FILTERS.MIN_TURNOVER) {
      filterFailures.push(`Turnover ₹${(tradedValue / 10000000).toFixed(2)} Cr < ₹5 Cr limit`);
    }
    if (volume < SCANNER_CONFIG.RISK_FILTERS.MIN_VOLUME) {
      filterFailures.push(`Volume ${volume.toLocaleString()} < 100,000 shares`);
    }
    if (atrPct > SCANNER_CONFIG.RISK_FILTERS.MAX_ATR_PCT) {
      filterFailures.push(`ATR ${atrPct}% exceeds 3.5% safe boundary`);
    }

    // Circuit Proximity Check (1.5% buffer)
    if (stock.upperCircuit && stock.upperCircuit > 0) {
      const distUcPct = ((stock.upperCircuit - price) / price) * 100;
      if (distUcPct < SCANNER_CONFIG.RISK_FILTERS.CIRCUIT_BUFFER_PCT) {
        filterFailures.push(`Only ${distUcPct.toFixed(1)}% away from Upper Circuit`);
      }
    }
    if (stock.lowerCircuit && stock.lowerCircuit > 0) {
      const distLcPct = ((price - stock.lowerCircuit) / price) * 100;
      if (distLcPct < SCANNER_CONFIG.RISK_FILTERS.CIRCUIT_BUFFER_PCT) {
        filterFailures.push(`Only ${distLcPct.toFixed(1)}% away from Lower Circuit`);
      }
    }

    // Bid-Ask Spread Check (if available)
    if (stock.bidPrice && stock.askPrice && stock.bidPrice > 0) {
      const spreadPct = ((stock.askPrice - stock.bidPrice) / stock.bidPrice) * 100;
      if (spreadPct > SCANNER_CONFIG.RISK_FILTERS.MAX_SPREAD_PCT) {
        filterFailures.push(`Bid-Ask spread ${spreadPct.toFixed(2)}% > 0.25% safe limit`);
      }
    }

    const isPassingAllFilters = filterFailures.length === 0;

    // Determine candidate bias (Long vs Short)
    const isPotentiallyLong = price >= vwap && ema20 >= ema50;

    // Calculate Stock Technical Score
    const techResult = computeStockTechnicalScore(
      stock,
      indiaInputs.niftyChangePct ?? 0.35,
      isPotentiallyLong
    );

    // Calculate Volume & Liquidity Score (0 - 100)
    let volumeScore = 50;
    if (tradedValue >= 100000000) volumeScore = 100; // > ₹10 Cr
    else if (tradedValue >= 50000000) volumeScore = 85; // > ₹5 Cr
    else if (tradedValue >= 20000000) volumeScore = 65;
    else volumeScore = 30;

    // Calculate Risk Safety Score (0 - 100)
    let riskScore = isPassingAllFilters ? 85 : 20;
    if (atrPct <= 2.0) riskScore += 15;
    else if (atrPct >= 3.0) riskScore -= 20;
    riskScore = Math.max(Math.min(riskScore, 100), 0);

    // Sector Tailwinds Adjustment
    const sectorAdj = sectorResult.getSectorAdjustment(sector, isPotentiallyLong);

    // ── FINAL COMPOSITE SCORE (0 - 100) ──
    const w = SCANNER_CONFIG.WEIGHTS;
    // Direction-aware Market & Global alignment:
    // For Long: Higher market score = bullish tailwind
    // For Short: Lower market score = bearish tailwind (short confluence = 100 - marketScore)
    const effectiveGlobalScore = isPotentiallyLong
      ? globalResult.globalScore
      : 100 - globalResult.globalScore;

    const effectiveIndianScore = isPotentiallyLong
      ? indiaResult.marketScore
      : 100 - indiaResult.marketScore;

    // Calculate News Sentiment Score (0 - 100)
    // For Long: Positive sentiment (+1.0) → 100, Negative (-1.0) → 0
    // For Short: Negative sentiment (-1.0) → 100, Positive (+1.0) → 0
    let newsScore = 50; // default neutral
    if (stock.newsSentimentScore !== undefined && stock.newsSentimentScore !== null) {
      const rawSentiment = stock.newsSentimentScore;
      if (isPotentiallyLong) {
        newsScore = Math.round(((rawSentiment + 1) / 2) * 100);
      } else {
        newsScore = 100 - Math.round(((rawSentiment + 1) / 2) * 100);
      }
      newsScore = Math.max(0, Math.min(100, newsScore));
    }

    const rawFinalScore =
      (effectiveGlobalScore * w.GLOBAL_MARKET) +
      (effectiveIndianScore * w.INDIAN_MARKET) +
      (techResult.score * w.STOCK_TECHNICAL) +
      (newsScore * (w.NEWS_SENTIMENT || 0.15)) +
      (volumeScore * w.LIQUIDITY_VOLUME) +
      (riskScore * w.RISK_FILTER) +
      sectorAdj.adjustmentScore;

    const finalScore = Math.max(Math.min(Math.round(rawFinalScore), 100), 0);

    // ── TARGET & STOP-LOSS CONFLUENCE ──
    const riskPerShare = Math.max(atr * 1.0, price * 0.01);
    let targetPrice = price;
    let stopLossPrice = price;
    if (isPotentiallyLong) {
      stopLossPrice = Number((Math.max(price - riskPerShare, vwap * 0.995)).toFixed(2));
      targetPrice = Number((price + (price - stopLossPrice) * 2.2).toFixed(2));
    } else {
      stopLossPrice = Number((Math.min(price + riskPerShare, vwap * 1.005)).toFixed(2));
      targetPrice = Number((price - (stopLossPrice - price) * 2.2).toFixed(2));
    }
    const reward = Math.abs(targetPrice - price);
    const risk = Math.max(Math.abs(price - stopLossPrice), 0.01);
    const riskRewardRatio = Number((reward / risk).toFixed(2));

    // ── MANDATORY TRADING CONDITIONS ──
    // Long Conditions:
    const isLongConditionPassed =
      price > vwap &&
      ema20 > ema50 &&
      rvol >= SCANNER_CONFIG.GATES.MIN_RVOL &&
      rsi >= SCANNER_CONFIG.GATES.LONG_RSI_MIN &&
      rsi <= SCANNER_CONFIG.GATES.LONG_RSI_MAX &&
      indiaResult.marketScore >= SCANNER_CONFIG.GATES.MIN_LONG_MARKET_SCORE &&
      indiaResult.details.allowLongBreakouts &&
      isPassingAllFilters &&
      riskRewardRatio >= SCANNER_CONFIG.GATES.MIN_RISK_REWARD;

    // Short Conditions:
    const isShortConditionPassed =
      price < vwap &&
      ema20 < ema50 &&
      rvol >= SCANNER_CONFIG.GATES.MIN_RVOL &&
      rsi >= SCANNER_CONFIG.GATES.SHORT_RSI_MIN &&
      rsi <= SCANNER_CONFIG.GATES.SHORT_RSI_MAX &&
      indiaResult.marketScore <= SCANNER_CONFIG.GATES.MAX_SHORT_MARKET_SCORE &&
      indiaResult.details.allowIntradayShorts &&
      isPassingAllFilters &&
      riskRewardRatio >= SCANNER_CONFIG.GATES.MIN_RISK_REWARD;

    // Assign Signal
    let signal: CandidateSignalType = 'AVOID';
    if (isLongConditionPassed && finalScore >= 75) {
      signal = 'LONG';
    } else if (isShortConditionPassed && finalScore >= 75) {
      signal = 'SHORT';
    } else if (finalScore >= 65 && isPassingAllFilters) {
      signal = 'WATCH';
    } else {
      signal = 'AVOID';
    }

    // Risk Level Assignment
    let riskLevel: RiskLevelType = 'LOW';
    if (!isPassingAllFilters || atrPct >= 3.0 || finalScore < 60) {
      riskLevel = 'HIGH';
    } else if (atrPct >= 2.0 || finalScore < 75) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    // Collect all explainability
    const allReasons = [...techResult.reasons];
    if (sectorAdj.reason) allReasons.push(sectorAdj.reason);
    if (globalResult.macroFactors.isGiftNiftyPositive && isPotentiallyLong) {
      allReasons.push('GIFT Nifty positive opening tailwind');
    }
    if (indiaResult.details.isNiftyAboveVwap && isPotentiallyLong) {
      allReasons.push('NIFTY benchmark trading above VWAP');
    }
    if (riskRewardRatio >= 2.0) {
      allReasons.push(`Favorable Risk:Reward ratio (${riskRewardRatio}:1)`);
    }
    if (stock.newsHeadline) {
      allReasons.push(`📰 News: ${stock.newsHeadline}`);
    } else if (stock.newsSentiment === 'POSITIVE' && isPotentiallyLong) {
      allReasons.push('📰 Positive live news sentiment tailwind');
    } else if (stock.newsSentiment === 'NEGATIVE' && !isPotentiallyLong) {
      allReasons.push('📰 Negative live news catalyst supporting short setup');
    }

    const allWarnings = [...techResult.warnings, ...filterFailures];
    if (indiaResult.regime === 'BEAR' && isPotentiallyLong) {
      allWarnings.push('Market Regime is BEAR: Long breakouts frequently fail');
    }
    if (!sectorAdj.isTailwind) {
      allWarnings.push(sectorAdj.reason);
    }
    if (stock.newsSentiment === 'NEGATIVE' && isPotentiallyLong) {
      allWarnings.push('⚠️ Negative live news sentiment creates headwind for long setup');
    } else if (stock.newsSentiment === 'POSITIVE' && !isPotentiallyLong) {
      allWarnings.push('⚠️ Positive live news sentiment creates risk for short setup');
    }

    evaluatedList.push({
      symbol: stock.symbol,
      companyName: stock.companyName || `${stock.symbol} Limited`,
      price,
      finalScore,
      marketScore: indiaResult.marketScore,
      globalScore: globalResult.globalScore,
      technicalScore: techResult.score,
      newsScore,
      volumeScore,
      riskScore,
      vwap,
      ema20,
      ema50,
      rsi,
      atrPercent: atrPct,
      relativeVolume: rvol,
      sector,
      sectorScore: sectorResult.sectors[sector]?.sectorScore || 50,
      marketRegime: indiaResult.regime,
      signal,
      riskLevel,
      isPassingAllFilters,
      canTrade: signal === 'LONG' || signal === 'SHORT',
      targetPrice,
      stopLossPrice,
      riskRewardRatio,
      reasons: allReasons,
      warnings: allWarnings,
    });
  });

  // Extract Top 10 Lists
  const top10Long = evaluatedList
    .filter((s) => s.signal === 'LONG')
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 10);

  const top10Short = evaluatedList
    .filter((s) => s.signal === 'SHORT')
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 10);

  const top10Watch = evaluatedList
    .filter((s) => s.signal === 'WATCH')
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 10);

  return {
    timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
    globalMarket: globalResult,
    indianMarket: indiaResult,
    sectorStrength: sectorResult,
    totalEvaluated: candidates.length,
    qualifiedCount: top10Long.length + top10Short.length,
    top10Long,
    top10Short,
    top10Watch,
    allCandidates: evaluatedList,
  };
}
