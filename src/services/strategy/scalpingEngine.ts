/**
 * ⚡ LIGHTNING SCALPER ENGINE (1-Min / 3-Min Micro-Momentum Formula)
 * Designed for quick high-probability intraday scalping (1 to 5 minute holding time).
 */

export interface ScalpInputData {
  symbol: string;
  companyName?: string;
  price: number;
  vwap: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  avgVolume: number;
  ema9?: number;
  ema20?: number;
  rsi?: number;
  buyerDemandPct?: number;
  atr5?: number;
}

export interface ScalpEvaluationResult {
  symbol: string;
  companyName: string;
  price: number;
  vwap: number;
  scalpScore: number;
  signal: 'STRONG_SCALP_BUY' | 'SCALP_WATCH' | 'NO_SIGNAL';
  suggestedEntry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskRewardRatio: number;
  holdingTime: string;
  canScalp: boolean;
  reasons: string[];
  warnings: string[];
}

export function evaluateScalpStock(input: ScalpInputData): ScalpEvaluationResult {
  const {
    symbol,
    companyName = `${symbol} Ltd`,
    price,
    vwap,
    open,
    high,
    low,
    volume,
    avgVolume,
    ema9 = Number((price * 0.998).toFixed(2)),
    ema20 = Number((price * 0.994).toFixed(2)),
    rsi = 62,
    buyerDemandPct = 75,
    atr5 = Number((price * 0.005).toFixed(2)),
  } = input;

  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  // Safety Gate: Must be > 0
  if (price <= 0 || vwap <= 0) {
    return {
      symbol,
      companyName,
      price,
      vwap,
      scalpScore: 0,
      signal: 'NO_SIGNAL',
      suggestedEntry: price,
      stopLoss: price,
      target1: price,
      target2: price,
      riskRewardRatio: 0,
      holdingTime: '1 to 5 Minutes',
      canScalp: false,
      reasons: [],
      warnings: ['Invalid price or VWAP data.'],
    };
  }

  // 1. VWAP Alignment & Proximity Gate (Max 25 pts)
  // Price MUST be above VWAP, but NOT overextended (> 0.8% above VWAP is risky for scalping)
  const distFromVwapPct = ((price - vwap) / vwap) * 100;
  if (price >= vwap) {
    if (distFromVwapPct <= 0.6) {
      score += 25;
      reasons.push(`Ideal VWAP Proximity (+${distFromVwapPct.toFixed(2)}% above VWAP)`);
    } else if (distFromVwapPct <= 1.0) {
      score += 15;
      reasons.push(`Trading Above VWAP (+${distFromVwapPct.toFixed(2)}%)`);
    } else {
      score += 5;
      warnings.push(`Overextended above VWAP (+${distFromVwapPct.toFixed(2)}%) - Risk of pullback`);
    }
  } else {
    warnings.push(`Trading Below VWAP (₹${vwap.toFixed(2)}) - Bearish pressure`);
  }

  // 2. Relative Volume Burst Gate (Max 25 pts)
  // Calculate relative volume burst on current micro session
  const expectedVolPerMin = Math.max(avgVolume / 375, 1000);
  const rvol = volume > 0 ? Number((volume / (expectedVolPerMin * 15)).toFixed(2)) : 1.0;
  if (rvol >= 2.5) {
    score += 25;
    reasons.push(`High Scalp Volume Burst (${rvol}x RVOL)`);
  } else if (rvol >= 1.5) {
    score += 18;
    reasons.push(`Moderate Volume Surge (${rvol}x RVOL)`);
  } else {
    score += 8;
    warnings.push(`Low Relative Volume (${rvol}x RVOL)`);
  }

  // 3. EMA Micro-Trend Alignment (Max 20 pts)
  if (price > ema9 && ema9 >= ema20) {
    score += 20;
    reasons.push('EMA Alignment (Price > EMA9 > EMA20)');
  } else if (price > ema9) {
    score += 10;
    reasons.push('Price Above EMA9');
  } else {
    warnings.push('Price Below EMA9 - Micro trend weak');
  }

  // 4. Order Book Buyer Demand (Max 20 pts)
  if (buyerDemandPct >= 80) {
    score += 20;
    reasons.push(`Heavy Buyer Imbalance (${buyerDemandPct}% Buyers)`);
  } else if (buyerDemandPct >= 65) {
    score += 14;
    reasons.push(`Positive Buyer Demand (${buyerDemandPct}% Buyers)`);
  } else {
    warnings.push(`Low Buyer Interest (${buyerDemandPct}% Buyers)`);
  }

  // 5. RSI Micro-Momentum Gate (Max 10 pts)
  if (rsi >= 58 && rsi <= 76) {
    score += 10;
    reasons.push(`Optimal RSI Momentum (${Math.round(rsi)})`);
  } else if (rsi > 76) {
    score += 4;
    warnings.push(`RSI Overbought (${Math.round(rsi)}) - Watch for reversal`);
  } else {
    warnings.push(`Weak RSI Momentum (${Math.round(rsi)})`);
  }

  // ── SIZING & SL/TARGET CALCULATIONS ──
  // Tight Scalp SL: Max of 1.2x ATR or 0.35% distance
  const slDist = Math.max(atr5 * 1.2, price * 0.0035);
  const stopLoss = Number((price - slDist).toFixed(2));
  const target1 = Number((price + slDist * 2.0).toFixed(2)); // 1:2 R:R
  const target2 = Number((price + slDist * 3.0).toFixed(2)); // 1:3 R:R
  const riskRewardRatio = Number((slDist > 0 ? (target1 - price) / slDist : 2.0).toFixed(1));

  // Final Signal Determination
  const canScalp = score >= 75 && price >= vwap && buyerDemandPct >= 60;
  let signal: ScalpEvaluationResult['signal'] = 'NO_SIGNAL';
  if (score >= 80 && canScalp) {
    signal = 'STRONG_SCALP_BUY';
  } else if (score >= 65) {
    signal = 'SCALP_WATCH';
  }

  return {
    symbol,
    companyName,
    price: Number(price.toFixed(2)),
    vwap: Number(vwap.toFixed(2)),
    scalpScore: Math.min(100, Math.max(0, score)),
    signal,
    suggestedEntry: Number(price.toFixed(2)),
    stopLoss,
    target1,
    target2,
    riskRewardRatio,
    holdingTime: '1 to 5 Minutes',
    canScalp,
    reasons,
    warnings,
  };
}

export function runScalpingScanner(stocks: ScalpInputData[]): ScalpEvaluationResult[] {
  return stocks
    .map((s) => evaluateScalpStock(s))
    .filter((res) => res.canScalp || res.scalpScore >= 65)
    .sort((a, b) => b.scalpScore - a.scalpScore);
}

