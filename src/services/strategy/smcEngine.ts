/**
 * Smart Money Concepts (SMC): Order Block (OB), Fair Value Gap (FVG) & Range Liquidity Sweep Engine
 *
 * Scans 5m & 15m intraday OHLCV candles for:
 * 1. Order Blocks (OB): Last opposite-color candle before a Break of Structure (BOS)
 * 2. Fair Value Gaps (FVG): 3-candle price imbalance zones
 * 3. Range Liquidity Sweeps: Wicks piercing support/resistance but closing back inside range
 * 4. Automated Buy / Sell Signal Setup with Entry, Stop Loss, and Take Profit targets (1:2 & 1:3 R:R)
 */

export interface CandleData {
  timestamp?: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBlock {
  id: string;
  type: 'BULLISH_OB' | 'BEARISH_OB';
  high: number;
  low: number;
  open: number;
  close: number;
  candleIndex: number;
  mitigated: boolean; // True if price has already re-entered and broken through
  strength: number; // 1-100 based on volume surge of the subsequent move
}

export interface FairValueGap {
  id: string;
  type: 'BULLISH_FVG' | 'BEARISH_FVG';
  top: number; // Upper boundary of gap
  bottom: number; // Lower boundary of gap
  middle: number; // 50% Equilibrium level
  candleIndex: number; // Index of the middle (impulse) candle
  filled: boolean; // True if price has fully re-entered and covered the gap
  fillPct: number; // 0% to 100% fill status
}

export interface LiquiditySweep {
  id: string;
  type: 'BULLISH_SWEEP' | 'BEARISH_SWEEP';
  level: number; // Swept support/resistance level
  wickExtreme: number; // Low of lower wick or High of upper wick
  closePrice: number;
  candleIndex: number;
  description: string;
}

export interface SMCTradeSetup {
  symbol: string;
  companyName: string;
  sector: string;
  currentPrice: number;
  vwap?: number;
  signalType: 'BUY' | 'SELL' | 'NEUTRAL';
  smcScore: number; // 0 - 100
  setupName: string; // e.g., "Bullish OB Retest + FVG Confluence"
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number; // 1:2 R:R
  takeProfit2: number; // 1:3 R:R
  riskRewardRatio: number; // e.g., 2.2
  orderBlocks: OrderBlock[];
  activeFVGs: FairValueGap[];
  liquiditySweeps: LiquiditySweep[];
  confluenceFactors: string[];
  recommendedAction: string;
}

/**
 * 1. Detects Bullish and Bearish Order Blocks (OB) in a candle series
 */
export function detectOrderBlocks(candles: CandleData[]): OrderBlock[] {
  if (!Array.isArray(candles) || candles.length < 5) return [];

  const obs: OrderBlock[] = [];
  const total = candles.length;

  for (let i = 1; i < total - 2; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    const currentVolume = curr.volume || 1;
    const avgVolume = (prev.volume + currentVolume + next1.volume) / 3 || 1;
    const volumeMultiplier = (next1.volume + next2.volume) / (2 * avgVolume);

    // Bullish OB: Last Red Candle before a strong green impulse that breaks previous high (BOS)
    const isRedCandle = curr.close < curr.open;
    const nextIsStrongGreen = next1.close > next1.open && next2.close > next2.open;
    const breaksHigh = next2.close > Math.max(curr.high, prev.high);

    if (isRedCandle && nextIsStrongGreen && breaksHigh) {
      // Check if price later mitigated (broke below OB low)
      let mitigated = false;
      for (let j = i + 3; j < total; j++) {
        if (candles[j].close < curr.low) {
          mitigated = true;
          break;
        }
      }

      obs.push({
        id: `OB_BULL_${i}`,
        type: 'BULLISH_OB',
        high: curr.high,
        low: curr.low,
        open: curr.open,
        close: curr.close,
        candleIndex: i,
        mitigated,
        strength: Math.min(100, Math.round(volumeMultiplier * 35 + 50)),
      });
    }

    // Bearish OB: Last Green Candle before a strong red drop that breaks previous low
    const isGreenCandle = curr.close > curr.open;
    const nextIsStrongRed = next1.close < next1.open && next2.close < next2.open;
    const breaksLow = next2.close < Math.min(curr.low, prev.low);

    if (isGreenCandle && nextIsStrongRed && breaksLow) {
      let mitigated = false;
      for (let j = i + 3; j < total; j++) {
        if (candles[j].close > curr.high) {
          mitigated = true;
          break;
        }
      }

      obs.push({
        id: `OB_BEAR_${i}`,
        type: 'BEARISH_OB',
        high: curr.high,
        low: curr.low,
        open: curr.open,
        close: curr.close,
        candleIndex: i,
        mitigated,
        strength: Math.min(100, Math.round(volumeMultiplier * 35 + 50)),
      });
    }
  }

  // Return unmitigated OBs first, sorted by index descending (most recent first)
  return obs.sort((a, b) => (a.mitigated === b.mitigated ? b.candleIndex - a.candleIndex : a.mitigated ? 1 : -1));
}

/**
 * 2. Detects Fair Value Gaps (FVG / Price Imbalance) in 3-candle windows
 */
export function detectFairValueGaps(candles: CandleData[]): FairValueGap[] {
  if (!Array.isArray(candles) || candles.length < 3) return [];

  const fvgs: FairValueGap[] = [];
  const total = candles.length;
  const currentPrice = candles[total - 1]?.close || 0;

  for (let i = 1; i < total - 1; i++) {
    const c1 = candles[i - 1]; // First candle
    const c2 = candles[i];     // Middle (impulse) candle
    const c3 = candles[i + 1]; // Third candle

    // Bullish FVG: Low of Candle 3 is HIGHER than High of Candle 1
    if (c3.low > c1.high) {
      const bottom = c1.high;
      const top = c3.low;
      const middle = Number(((top + bottom) / 2).toFixed(2));
      const gapSize = top - bottom;

      if (gapSize > 0) {
        // Calculate fill status
        let maxDepth = top;
        let filled = false;

        for (let j = i + 2; j < total; j++) {
          if (candles[j].low <= bottom) {
            filled = true;
            maxDepth = bottom;
            break;
          } else if (candles[j].low < maxDepth) {
            maxDepth = candles[j].low;
          }
        }

        const filledAmount = Math.max(0, top - maxDepth);
        const fillPct = filled ? 100 : Math.min(100, Math.round((filledAmount / gapSize) * 100));

        fvgs.push({
          id: `FVG_BULL_${i}`,
          type: 'BULLISH_FVG',
          top: Number(top.toFixed(2)),
          bottom: Number(bottom.toFixed(2)),
          middle,
          candleIndex: i,
          filled,
          fillPct,
        });
      }
    }

    // Bearish FVG: High of Candle 3 is LOWER than Low of Candle 1
    if (c3.high < c1.low) {
      const top = c1.low;
      const bottom = c3.high;
      const middle = Number(((top + bottom) / 2).toFixed(2));
      const gapSize = top - bottom;

      if (gapSize > 0) {
        let maxDepth = bottom;
        let filled = false;

        for (let j = i + 2; j < total; j++) {
          if (candles[j].high >= top) {
            filled = true;
            maxDepth = top;
            break;
          } else if (candles[j].high > maxDepth) {
            maxDepth = candles[j].high;
          }
        }

        const filledAmount = Math.max(0, maxDepth - bottom);
        const fillPct = filled ? 100 : Math.min(100, Math.round((filledAmount / gapSize) * 100));

        fvgs.push({
          id: `FVG_BEAR_${i}`,
          type: 'BEARISH_FVG',
          top: Number(top.toFixed(2)),
          bottom: Number(bottom.toFixed(2)),
          middle,
          candleIndex: i,
          filled,
          fillPct,
        });
      }
    }
  }

  // Filter unfilled / active FVGs first, sorted by index descending
  return fvgs.sort((a, b) => (a.filled === b.filled ? b.candleIndex - a.candleIndex : a.filled ? 1 : -1));
}

/**
 * 3. Detects Range Liquidity Sweeps (Wick Rejection at Key Levels)
 */
export function detectLiquiditySweeps(candles: CandleData[]): LiquiditySweep[] {
  if (!Array.isArray(candles) || candles.length < 15) return [];

  const sweeps: LiquiditySweep[] = [];
  const total = candles.length;
  const recentWindow = candles.slice(-20); // Last 20 candles

  // Compute 20-candle high and low
  const recentHigh = Math.max(...recentWindow.map((c) => c.high));
  const recentLow = Math.min(...recentWindow.map((c) => c.low));

  for (let i = total - 5; i < total; i++) {
    const c = candles[i];
    const bodyTop = Math.max(c.open, c.close);
    const bodyBottom = Math.min(c.open, c.close);
    const totalRange = c.high - c.low || 0.01;

    // Bullish Liquidity Sweep: Lower wick pierces recent Low, but body closes well above
    const lowerWick = bodyBottom - c.low;
    const lowerWickRatio = lowerWick / totalRange;

    if (c.low <= recentLow && lowerWickRatio >= 0.45 && c.close > c.low) {
      sweeps.push({
        id: `SWEEP_BULL_${i}`,
        type: 'BULLISH_SWEEP',
        level: Number(recentLow.toFixed(2)),
        wickExtreme: Number(c.low.toFixed(2)),
        closePrice: Number(c.close.toFixed(2)),
        candleIndex: i,
        description: `Bullish Liquidity Sweep below ₹${recentLow.toFixed(2)} support — Buyers absorbed trapped sellers!`,
      });
    }

    // Bearish Liquidity Sweep: Upper wick pierces recent High, but body closes well below
    const upperWick = c.high - bodyTop;
    const upperWickRatio = upperWick / totalRange;

    if (c.high >= recentHigh && upperWickRatio >= 0.45 && c.close < c.high) {
      sweeps.push({
        id: `SWEEP_BEAR_${i}`,
        type: 'BEARISH_SWEEP',
        level: Number(recentHigh.toFixed(2)),
        wickExtreme: Number(c.high.toFixed(2)),
        closePrice: Number(c.close.toFixed(2)),
        candleIndex: i,
        description: `Bearish Liquidity Sweep above ₹${recentHigh.toFixed(2)} resistance — Sellers rejected buyers!`,
      });
    }
  }

  return sweeps;
}

/**
 * 4. Combines OB + FVG + Liquidity Sweep into a complete SMC Trade Setup & Score
 */
export function evaluateSMCTradeSetup(input: {
  symbol: string;
  companyName?: string;
  sector?: string;
  candles: CandleData[];
  vwap?: number;
  currentPrice?: number;
}): SMCTradeSetup {
  const symbol = input.symbol || 'UNKNOWN';
  const companyName = input.companyName || symbol;
  const sector = input.sector || 'NSE Equities';
  const candles = input.candles || [];
  const currentPrice = input.currentPrice || (candles.length > 0 ? candles[candles.length - 1].close : 100);
  const vwap = input.vwap || currentPrice;

  // Run detectors
  const obs = detectOrderBlocks(candles);
  const fvgs = detectFairValueGaps(candles);
  const sweeps = detectLiquiditySweeps(candles);

  const activeOBs = obs.filter((ob) => !ob.mitigated);
  const activeFVGs = fvgs.filter((fvg) => !fvg.filled && fvg.fillPct < 90);

  // Check Bullish vs Bearish Confluence
  const nearestBullishOB = activeOBs.find((ob) => ob.type === 'BULLISH_OB' && currentPrice >= ob.low && currentPrice <= ob.high * 1.02);
  const nearestBearishOB = activeOBs.find((ob) => ob.type === 'BEARISH_OB' && currentPrice <= ob.high && currentPrice >= ob.low * 0.98);

  const nearestBullishFVG = activeFVGs.find((fvg) => fvg.type === 'BULLISH_FVG' && currentPrice >= fvg.bottom * 0.99 && currentPrice <= fvg.top * 1.01);
  const nearestBearishFVG = activeFVGs.find((fvg) => fvg.type === 'BEARISH_FVG' && currentPrice <= fvg.top * 1.01 && currentPrice >= fvg.bottom * 0.99);

  const recentBullishSweep = sweeps.find((s) => s.type === 'BULLISH_SWEEP');
  const recentBearishSweep = sweeps.find((s) => s.type === 'BEARISH_SWEEP');

  let smcScore = 50;
  let signalType: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let setupName = 'Awaiting SMC Confluence';
  const confluenceFactors: string[] = [];

  // --- BULLISH SETUP EVALUATION ---
  if (nearestBullishOB || nearestBullishFVG || recentBullishSweep) {
    let score = 60;

    if (nearestBullishOB) {
      score += 20;
      confluenceFactors.push(`🎯 Price inside Bullish Order Block (₹${nearestBullishOB.low} - ₹${nearestBullishOB.high})`);
    }
    if (nearestBullishFVG) {
      score += 15;
      confluenceFactors.push(`⚡ Unfilled Bullish FVG Imbalance (₹${nearestBullishFVG.bottom} - ₹${nearestBullishFVG.top})`);
    }
    if (recentBullishSweep) {
      score += 15;
      confluenceFactors.push(`🧹 ${recentBullishSweep.description}`);
    }
    if (currentPrice >= vwap) {
      score += 10;
      confluenceFactors.push(`🟢 Price trading above VWAP (₹${vwap.toFixed(2)})`);
    }

    if (score >= 70) {
      smcScore = Math.min(100, score);
      signalType = 'BUY';
      setupName = nearestBullishOB && nearestBullishFVG ? 'Bullish OB + FVG Confluence Setup' : 'Bullish Smart Money Retest';
    }
  }

  // --- BEARISH SETUP EVALUATION ---
  if (signalType === 'NEUTRAL' && (nearestBearishOB || nearestBearishFVG || recentBearishSweep)) {
    let score = 60;

    if (nearestBearishOB) {
      score += 20;
      confluenceFactors.push(`🔴 Price inside Bearish Order Block (₹${nearestBearishOB.low} - ₹${nearestBearishOB.high})`);
    }
    if (nearestBearishFVG) {
      score += 15;
      confluenceFactors.push(`⚡ Unfilled Bearish FVG Imbalance (₹${nearestBearishFVG.bottom} - ₹${nearestBearishFVG.top})`);
    }
    if (recentBearishSweep) {
      score += 15;
      confluenceFactors.push(`🧹 ${recentBearishSweep.description}`);
    }
    if (currentPrice < vwap) {
      score += 10;
      confluenceFactors.push(`🔴 Price trading below VWAP (₹${vwap.toFixed(2)})`);
    }

    if (score >= 70) {
      smcScore = Math.min(100, score);
      signalType = 'SELL';
      setupName = nearestBearishOB && nearestBearishFVG ? 'Bearish OB + FVG Confluence Setup' : 'Bearish Smart Money Rejection';
    }
  }

  // Default fallback if no OB/FVG hit
  if (confluenceFactors.length === 0) {
    if (activeOBs.length > 0) confluenceFactors.push(`Nearest Bullish OB at ₹${activeOBs[0].low} - ₹${activeOBs[0].high}`);
    if (activeFVGs.length > 0) confluenceFactors.push(`Unfilled FVG at ₹${activeFVGs[0].bottom} - ₹${activeFVGs[0].top}`);
    if (confluenceFactors.length === 0) confluenceFactors.push('Consolidating — waiting for institutional OB / FVG formation');
  }

  // Calculate Entry, SL & TP
  let entryPrice = currentPrice;
  let stopLoss = currentPrice * 0.98;
  let takeProfit1 = currentPrice * 1.02;
  let takeProfit2 = currentPrice * 1.04;

  if (signalType === 'BUY') {
    entryPrice = nearestBullishOB ? nearestBullishOB.high : currentPrice;
    const obLow = nearestBullishOB ? nearestBullishOB.low : currentPrice * 0.985;
    stopLoss = Number((obLow * 0.997).toFixed(2)); // SL 0.3% below OB low
    const riskPerShare = Math.max(0.5, entryPrice - stopLoss);

    takeProfit1 = Number((entryPrice + riskPerShare * 2.0).toFixed(2)); // 1:2 R:R
    takeProfit2 = Number((entryPrice + riskPerShare * 3.0).toFixed(2)); // 1:3 R:R
  } else if (signalType === 'SELL') {
    entryPrice = nearestBearishOB ? nearestBearishOB.low : currentPrice;
    const obHigh = nearestBearishOB ? nearestBearishOB.high : currentPrice * 1.015;
    stopLoss = Number((obHigh * 1.003).toFixed(2)); // SL 0.3% above OB high
    const riskPerShare = Math.max(0.5, stopLoss - entryPrice);

    takeProfit1 = Number((entryPrice - riskPerShare * 2.0).toFixed(2)); // 1:2 R:R
    takeProfit2 = Number((entryPrice - riskPerShare * 3.0).toFixed(2)); // 1:3 R:R
  }

  const riskPerShare = Math.abs(entryPrice - stopLoss) || 1;
  const rewardPerShare = Math.abs(takeProfit1 - entryPrice) || 2;
  const riskRewardRatio = Number((rewardPerShare / riskPerShare).toFixed(2));

  let recommendedAction = '⏸️ Standby — Wait for price to enter Order Block or FVG zone.';
  if (signalType === 'BUY') {
    recommendedAction = `🟢 BUY LIMIT at ₹${entryPrice.toFixed(2)} | SL: ₹${stopLoss.toFixed(2)} | TP: ₹${takeProfit1.toFixed(2)} (R:R 1:${riskRewardRatio})`;
  } else if (signalType === 'SELL') {
    recommendedAction = `🔴 SELL LIMIT at ₹${entryPrice.toFixed(2)} | SL: ₹${stopLoss.toFixed(2)} | TP: ₹${takeProfit1.toFixed(2)} (R:R 1:${riskRewardRatio})`;
  }

  return {
    symbol,
    companyName,
    sector,
    currentPrice: Number(currentPrice.toFixed(2)),
    vwap: Number(vwap.toFixed(2)),
    signalType,
    smcScore,
    setupName,
    entryPrice: Number(entryPrice.toFixed(2)),
    stopLoss,
    takeProfit1,
    takeProfit2,
    riskRewardRatio,
    orderBlocks: obs,
    activeFVGs: fvgs,
    liquiditySweeps: sweeps,
    recommendedAction,
  };
}

/**
 * 5. Universal Quick SMC Status Evaluator for ANY stock row in the app tables
 */
export function getQuickSMCStatus(stock: any): {
  obStatus: 'BULLISH_OB' | 'BEARISH_OB' | 'FVG_GAP' | 'SWEEP' | 'NEUTRAL';
  badgeText: string;
  badgeClass: string;
  smcBonusScore: number;
} {
  if (!stock) {
    return { obStatus: 'NEUTRAL', badgeText: '⚪ No Zone', badgeClass: 'bg-secondary text-white', smcBonusScore: 0 };
  }

  const ltp = Number(stock.price || stock.ltp || stock.close || 0);
  const vwap = Number(stock.vwap || stock.VWAP || 0);
  const changePct = Number(stock.changePercent || stock.dayGainPct || stock.pChange || 0);
  const rvol = Number(stock.volumeRatio || stock.rvol || stock.relativeVolume || 1);

  // If candles are available, evaluate full SMC setup
  if (Array.isArray(stock.candles) && stock.candles.length >= 5) {
    const smc = evaluateSMCTradeSetup({
      symbol: stock.symbol || 'STOCK',
      candles: stock.candles,
      vwap,
      currentPrice: ltp,
    });

    if (smc.signalType === 'BUY') {
      const ob = smc.orderBlocks.find((b) => b.type === 'BULLISH_OB' && !b.mitigated);
      return {
        obStatus: 'BULLISH_OB',
        badgeText: ob ? `🎯 Bullish OB (₹${ob.low})` : '🎯 Bullish OB Retest',
        badgeClass: 'bg-success text-white fw-bold',
        smcBonusScore: 15,
      };
    } else if (smc.signalType === 'SELL') {
      const ob = smc.orderBlocks.find((b) => b.type === 'BEARISH_OB' && !b.mitigated);
      return {
        obStatus: 'BEARISH_OB',
        badgeText: ob ? `🔴 Bearish OB (₹${ob.high})` : '🔴 Bearish OB Trap',
        badgeClass: 'bg-danger text-white fw-bold',
        smcBonusScore: -15,
      };
    } else if (smc.activeFVGs.length > 0) {
      return {
        obStatus: 'FVG_GAP',
        badgeText: `⚡ FVG Zone (₹${smc.activeFVGs[0].bottom})`,
        badgeClass: 'bg-warning text-dark fw-bold',
        smcBonusScore: 10,
      };
    } else if (smc.liquiditySweeps.length > 0) {
      return {
        obStatus: 'SWEEP',
        badgeText: `🧹 Sweep @ ₹${smc.liquiditySweeps[0].level}`,
        badgeClass: 'bg-info text-dark fw-bold',
        smcBonusScore: 10,
      };
    }
  }

  // Heuristic SMC Status fallback for scanner rows without full OHLC candles
  const isAboveVwap = vwap > 0 && ltp >= vwap;
  const isBreakout = changePct >= 1.5 && rvol >= 1.5;

  if (isAboveVwap && isBreakout) {
    return {
      obStatus: 'BULLISH_OB',
      badgeText: '🎯 Bullish OB Retest',
      badgeClass: 'bg-success text-white fw-bold',
      smcBonusScore: 12,
    };
  } else if (vwap > 0 && ltp < vwap * 0.985) {
    return {
      obStatus: 'BEARISH_OB',
      badgeText: '🔴 Bearish OB Trap',
      badgeClass: 'bg-danger text-white fw-bold',
      smcBonusScore: -10,
    };
  } else if (isAboveVwap) {
    return {
      obStatus: 'FVG_GAP',
      badgeText: '⚡ FVG Zone',
      badgeClass: 'bg-warning text-dark fw-bold',
      smcBonusScore: 5,
    };
  }

  return { obStatus: 'NEUTRAL', badgeText: '⚪ No Zone', badgeClass: 'bg-secondary text-white', smcBonusScore: 0 };
}

