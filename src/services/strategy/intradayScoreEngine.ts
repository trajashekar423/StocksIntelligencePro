/**
 * Standardized 100-Point Intraday Score Engine
 *
 * Mathematical Formula:
 * Intraday Score = (20 × V) + (15 × L) + (15 × M) + (15 × W) + (10 × B) + (10 × T) + (10 × R) + (5 × S)
 *
 * Factor Weights:
 * - V (Volume strength): 20
 * - L (Liquidity): 15
 * - M (Price momentum): 15
 * - W (VWAP strength): 15
 * - B (Breakout quality): 10
 * - T (Trend quality): 10
 * - R (Risk/Reward): 10
 * - S (Sector/Nifty support): 5
 * Total: 100 Points
 */

import { getQuickSMCStatus } from './smcEngine.ts';

export interface IntradayScoreInput {
  price: number;
  open?: number;
  previousClose?: number;
  vwap?: number;
  volume?: number;
  averageVolume?: number;
  relativeVolume?: number; // RVOL = currentVolume / avgVolume
  previousDayHigh?: number;
  previousDayLow?: number;
  dayHigh?: number;
  dayLow?: number;
  target?: number;
  stopLoss?: number;
  entry?: number;
  bullishTrend?: boolean;
  breakout?: boolean;
  niftyBullish?: boolean;
  sectorBullish?: boolean;
  changePercent?: number;
}

export interface IntradayScoreResult {
  score: number; // 0 - 100
  signal: 'STRONG' | 'WATCH' | 'WEAK' | 'AVOID';
  signalText: string;
  badgeClass: string;
  canTrade: boolean; // Institutional entry gate confirmation
  breakdown: {
    volumeFactor: number;      // 0 - 1
    volumeScore: number;       // 0 - 20
    liquidityFactor: number;   // 0 - 1
    liquidityScore: number;    // 0 - 15
    momentumFactor: number;    // 0 - 1
    momentumScore: number;     // 0 - 15
    vwapFactor: number;        // 0 - 1
    vwapScore: number;         // 0 - 15
    breakoutFactor: number;    // 0 - 1
    breakoutScore: number;     // 0 - 10
    trendFactor: number;       // 0 - 1
    trendScore: number;        // 0 - 10
    riskRewardFactor: number;  // 0 - 1
    riskRewardScore: number;   // 0 - 10
    sectorFactor: number;      // 0 - 1
    sectorScore: number;       // 0 - 5
  };
  metrics: {
    relativeVolume: number;
    changePercent: number;
    vwapDistancePct: number;
    riskReward: number;
    isAboveVwap: boolean;
    isBreakoutConfirmed: boolean;
  };
  gateReasons: string[];
}

export function calculateIntradayScore(input: IntradayScoreInput): IntradayScoreResult {
  const price = Number(input.price || 0);
  const open = Number(input.open || price);
  const prevClose = Number(input.previousClose || price);
  const vwap = Number(input.vwap || price);
  const volume = Number(input.volume || 0);
  const avgVolume = Math.max(Number(input.averageVolume || (volume > 0 ? volume / 1.5 : 100000)), 1);

  // 1. Relative Volume (RVOL)
  const relativeVolume = Number(
    (input.relativeVolume ?? (volume > 0 ? volume / avgVolume : 1.0)).toFixed(2)
  );

  // 2. Change Percent
  const changePercent = Number(
    (
      input.changePercent ??
      (prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : open > 0 ? ((price - open) / open) * 100 : 0)
    ).toFixed(2)
  );

  // -------------------------------------------------------------
  // FACTOR 1: V - Volume Strength (Weight = 20)
  // Formula: V = min(relativeVolume / 2, 1)
  // At 2x normal volume, stock receives max 1.0 (20 pts)
  // -------------------------------------------------------------
  const volumeFactor = Math.min(Math.max(relativeVolume / 2, 0), 1);
  const volumeScore = Number((volumeFactor * 20).toFixed(2));

  // -------------------------------------------------------------
  // FACTOR 2: L - Liquidity (Weight = 15)
  // Formula: High volume & turnover avoids slippage
  // -------------------------------------------------------------
  const tradedValue = price * volume;
  let liquidityFactor = 0;
  if (tradedValue >= 50000000 || volume >= 500000) {
    liquidityFactor = 1.0; // ₹5 Cr traded value or 500k shares
  } else if (tradedValue >= 20000000 || volume >= 200000) {
    liquidityFactor = 0.8; // ₹2 Cr traded value or 200k shares
  } else if (tradedValue >= 5000000 || volume >= 50000) {
    liquidityFactor = 0.5; // ₹50 L traded value
  } else if (volume >= 25000) {
    liquidityFactor = 0.3;
  } else {
    liquidityFactor = 0.1; // Illiquid penalty
  }
  const liquidityScore = Number((liquidityFactor * 15).toFixed(2));

  // -------------------------------------------------------------
  // FACTOR 3: M - Price Momentum (Weight = 15)
  // Formula: momentumScore = min(changePercent / 3, 1)
  // 3% move = 1.0 (15 pts). Red stocks receive 0. Overextended >8% penalized.
  // -------------------------------------------------------------
  let momentumFactor = 0;
  if (changePercent > 0) {
    if (changePercent >= 8.0) {
      // Overextended risk reduction
      momentumFactor = 0.7;
    } else {
      momentumFactor = Math.min(changePercent / 3, 1);
    }
  } else {
    momentumFactor = 0;
  }
  const momentumScore = Number((momentumFactor * 15).toFixed(2));

  // -------------------------------------------------------------
  // FACTOR 4: W - VWAP Strength (Weight = 15)
  // Formula: vwapDistance = ((price - vwap) / vwap) * 100
  // vwapScore = min(max(vwapDistance / 1, 0), 1)
  // Price below VWAP receives 0!
  // -------------------------------------------------------------
  const isAboveVwap = vwap > 0 && price >= vwap;
  const vwapDistancePct = vwap > 0 ? Number((((price - vwap) / vwap) * 100).toFixed(2)) : 0;
  let vwapFactor = 0;
  if (isAboveVwap) {
    vwapFactor = Math.min(Math.max(vwapDistancePct / 1.0, 0.4), 1);
  } else {
    vwapFactor = 0; // Strict 0 below VWAP
  }
  const vwapScore = Number((vwapFactor * 15).toFixed(2));

  // -------------------------------------------------------------
  // FACTOR 5: B - Breakout Quality (Weight = 10)
  // Formula: currentPrice > PDH && relativeVolume >= 1.5 ? 1 : 0
  // -------------------------------------------------------------
  const pdh = Number(input.previousDayHigh || 0);
  const isAbovePdh = pdh > 0 ? price >= pdh : false;
  const isBreakoutConfirmed =
    input.breakout !== undefined
      ? Boolean(input.breakout)
      : isAbovePdh && relativeVolume >= 1.5;

  let breakoutFactor = 0;
  if (isBreakoutConfirmed) {
    breakoutFactor = 1.0;
  } else if (isAbovePdh) {
    breakoutFactor = 0.6; // Broken PDH but volume still building
  } else if (pdh > 0 && price >= pdh * 0.99) {
    breakoutFactor = 0.4; // Within 1% of PDH
  } else {
    breakoutFactor = 0;
  }
  const breakoutScore = Number((breakoutFactor * 10).toFixed(2));

  // -------------------------------------------------------------
  // FACTOR 6: T - Trend Quality (Weight = 10)
  // Formula: Higher highs/lows or price > open in green trend
  // -------------------------------------------------------------
  const isBullishTrend =
    input.bullishTrend !== undefined
      ? Boolean(input.bullishTrend)
      : price > open && changePercent > 0;

  const trendFactor = isBullishTrend ? 1.0 : 0;
  const trendScore = Number((trendFactor * 10).toFixed(2));

  // -------------------------------------------------------------
  // FACTOR 7: R - Risk / Reward (Weight = 10)
  // Formula: RR = (Target - Entry) / (Entry - StopLoss)
  // rr >= 3 -> 1.0; rr >= 2 -> 0.8; rr >= 1.5 -> 0.4; else 0
  // -------------------------------------------------------------
  const entry = Number(input.entry || price);
  const target = Number(input.target || entry * 1.025);
  const stopLoss = Number(input.stopLoss || entry * 0.985);
  const risk = Math.max(entry - stopLoss, 0.01);
  const reward = Math.max(target - entry, 0);
  const calculatedRr = Number((reward / risk).toFixed(2));

  let riskRewardFactor = 0;
  if (calculatedRr >= 3.0) {
    riskRewardFactor = 1.0;
  } else if (calculatedRr >= 2.0) {
    riskRewardFactor = 0.8;
  } else if (calculatedRr >= 1.5) {
    riskRewardFactor = 0.4;
  } else {
    riskRewardFactor = 0;
  }
  const riskRewardScore = Number((riskRewardFactor * 10).toFixed(2));

  // -------------------------------------------------------------
  // FACTOR 8: S - Sector / Nifty Support (Weight = 5)
  // Formula: (niftyBullish || sectorBullish) ? 1.0 : 0
  // -------------------------------------------------------------
  const hasSectorSupport =
    input.niftyBullish !== undefined || input.sectorBullish !== undefined
      ? Boolean(input.niftyBullish || input.sectorBullish)
      : true; // Default neutral/supportive

  const sectorFactor = hasSectorSupport ? 1.0 : 0.2;
  const sectorScore = Number((sectorFactor * 5).toFixed(2));

  // -------------------------------------------------------------
  // FACTOR 9: SMC - Smart Money Order Block & FVG Bonus
  // -------------------------------------------------------------
  const smcStatus = getQuickSMCStatus({
    price,
    vwap,
    changePercent,
    relativeVolume,
  });

  // -------------------------------------------------------------
  // TOTAL COMPOSITE INTRADAY SCORE (0 - 100)
  // -------------------------------------------------------------
  const rawTotal =
    volumeScore +
    liquidityScore +
    momentumScore +
    vwapScore +
    breakoutScore +
    trendScore +
    riskRewardScore +
    sectorScore +
    smcStatus.smcBonusScore;

  const finalScore = Math.min(Math.max(Math.round(rawTotal), 0), 100);

  // -------------------------------------------------------------
  // CLASSIFICATION TIERS
  // -------------------------------------------------------------
  let signal: 'STRONG' | 'WATCH' | 'WEAK' | 'AVOID' = 'AVOID';
  let signalText = '🔴 AVOID';
  let badgeClass = 'bg-danger text-white';

  if (finalScore >= 80) {
    signal = 'STRONG';
    signalText = '🟢 STRONG';
    badgeClass = 'bg-success text-white';
  } else if (finalScore >= 70) {
    signal = 'WATCH';
    signalText = '🟡 WATCH';
    badgeClass = 'bg-warning text-dark';
  } else if (finalScore >= 60) {
    signal = 'WEAK';
    signalText = '⚪ WEAK';
    badgeClass = 'bg-secondary text-white';
  } else {
    signal = 'AVOID';
    signalText = '🔴 AVOID';
    badgeClass = 'bg-danger text-white';
  }

  // -------------------------------------------------------------
  // INSTITUTIONAL EXECUTION CONFIRMATION GATE (canTrade)
  // Rule:
  // canTrade = score >= 80 && price > vwap && relativeVolume >= 1.5 && breakout === true && riskReward >= 2
  // -------------------------------------------------------------
  const gateReasons: string[] = [];
  if (finalScore < 80) gateReasons.push(`Score ${finalScore} < 80`);
  if (!isAboveVwap) gateReasons.push(`Price ₹${price} <= VWAP ₹${vwap}`);
  if (relativeVolume < 1.5) gateReasons.push(`RVOL ${relativeVolume}x < 1.5x`);
  if (!isBreakoutConfirmed) gateReasons.push('Breakout unconfirmed');
  if (calculatedRr < 2.0) gateReasons.push(`R:R ${calculatedRr} < 2:1`);

  const canTrade =
    finalScore >= 80 &&
    isAboveVwap &&
    relativeVolume >= 1.5 &&
    isBreakoutConfirmed &&
    calculatedRr >= 2.0;

  return {
    score: finalScore,
    signal,
    signalText,
    badgeClass,
    canTrade,
    breakdown: {
      volumeFactor,
      volumeScore,
      liquidityFactor,
      liquidityScore,
      momentumFactor,
      momentumScore,
      vwapFactor,
      vwapScore,
      breakoutFactor,
      breakoutScore,
      trendFactor,
      trendScore,
      riskRewardFactor,
      riskRewardScore,
      sectorFactor,
      sectorScore,
    },
    metrics: {
      relativeVolume,
      changePercent,
      vwapDistancePct,
      riskReward: calculatedRr,
      isAboveVwap,
      isBreakoutConfirmed,
    },
    gateReasons,
  };
}

