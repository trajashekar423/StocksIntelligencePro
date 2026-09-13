/**
 * Overbought Safe Exit Detector Engine
 * Evaluates real-time candlestick data, RSI(14/9), VWAP deviation, and Upper-Wick rejections
 * to generate actionable intraday safe exit alerts and dynamic trailing stop-loss levels.
 */

/**
 * Calculates Wilder's RSI series for an array of closing prices.
 * Returns an array of RSI values aligned with candles (or null for warmup bars).
 */
export function calcRSIseries(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length === 0) return [];
  const rsiValues = Array(closes.length).fill(null);
  if (closes.length <= period) {
    if (closes.length >= 7) {
      return calcRSIseries(closes, 6);
    }
    return rsiValues;
  }

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  rsiValues[period] = avgLoss === 0 ? 100 : Number((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;

    if (avgLoss === 0) {
      rsiValues[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsiValues[i] = Number((100 - 100 / (1 + rs)).toFixed(2));
    }
  }

  return rsiValues;
}

/**
 * Evaluates whether a single candle exhibits a long upper wick rejection / Shooting Star pattern.
 */
export function detectUpperWickRejection(candle) {
  if (!candle || typeof candle.open !== 'number') return false;
  const open = Number(candle.open);
  const high = Number(candle.high);
  const low = Number(candle.low);
  const close = Number(candle.close);

  const bodyTop = Math.max(open, close);
  const bodyBottom = Math.min(open, close);
  const bodyLength = Math.max(0.01, bodyTop - bodyBottom);
  const upperWick = high - bodyTop;
  const lowerWick = bodyBottom - low;
  const totalRange = Math.max(0.01, high - low);

  // Upper wick constitutes > 45% of total range and is at least 1.8x larger than body
  const isUpperWickDominant = upperWick / totalRange >= 0.45 && upperWick >= bodyLength * 1.8;
  const isSmallLowerWick = lowerWick / totalRange <= 0.25;

  return isUpperWickDominant && isSmallLowerWick;
}

/**
 * Calculates optimal Trailing Stop-Loss for intraday profit locking
 */
export function calculateDynamicExitStopLoss({ entryPrice, currentPrice, peakPrice, vwap = null }) {
  const effectiveEntry = Number(entryPrice || 0);
  const effectiveCurrent = Number(currentPrice || 0);
  const effectivePeak = Math.max(effectiveCurrent, Number(peakPrice || effectiveCurrent));

  if (effectiveEntry <= 0) {
    if (vwap && vwap > 0) return Number((vwap * 0.996).toFixed(2));
    return Number((effectiveCurrent * 0.988).toFixed(2));
  }

  const gainFromEntry = effectivePeak - effectiveEntry;
  const gainPct = (gainFromEntry / effectiveEntry) * 100;

  // Case 1: High Profit (> +2.0% e.g. 278 -> 283.50) => Lock in at least 65% of profit (Stop at ~₹281.50)
  if (gainPct >= 2.0) {
    const lockedStop = effectiveEntry + gainFromEntry * 0.65;
    return Number(lockedStop.toFixed(2));
  }

  // Case 2: Good Profit (+1.0% to +2.0%) => Lock in 50% of profit
  if (gainPct >= 1.0) {
    const lockedStop = effectiveEntry + gainFromEntry * 0.5;
    return Number(lockedStop.toFixed(2));
  }

  // Case 3: Minor Profit (+0.5% to +1.0%) => Move to Breakeven (+0.2% buffer)
  if (gainPct >= 0.5) {
    return Number((effectiveEntry * 1.002).toFixed(2));
  }

  // Case 4: Not in profit yet => Standard 1.2% initial risk stop
  return Number((effectiveEntry * 0.988).toFixed(2));
}

/**
 * Main Evaluation Engine for Overbought & Safe Exit
 */
export function evaluateOverboughtStatus({
  currentPrice,
  entryPrice = null,
  peakPrice = null,
  vwap = null,
  rsi = null,
  candle = null,
  timeStr = null, // e.g. "14:35"
}) {
  const price = Number(currentPrice || 0);
  const entry = entryPrice ? Number(entryPrice) : null;
  const vwapVal = vwap ? Number(vwap) : null;
  const rsiVal = rsi !== null && rsi !== undefined ? Number(rsi) : 50;

  // 1. VWAP Deviation
  const vwapDeviationPct = vwapVal && vwapVal > 0 ? Number((((price - vwapVal) / vwapVal) * 100).toFixed(2)) : 0;

  // 2. Candlestick Upper Wick Rejection
  const hasUpperWickRejection = candle ? detectUpperWickRejection(candle) : false;

  // 3. Check time for 2:15 PM - 3:15 PM squaring rush
  let isLateDaySession = false;
  if (timeStr) {
    if (typeof timeStr === 'string' && timeStr.includes(':')) {
      const parts = timeStr.split(':');
      const hour = parseInt(parts[0], 10);
      const min = parseInt(parts[1], 10);
      if (hour === 14 && min >= 15) isLateDaySession = true;
      if (hour === 15 && min <= 20) isLateDaySession = true;
    }
  }

  // 4. Determine Overbought Risk Level
  let level = 'NORMAL'; // 'NORMAL' | 'OVERBOUGHT_WARN' | 'OVERBOUGHT_CRITICAL' | 'BEARISH_REVERSAL_EXIT'
  let isOverbought = false;
  let actionAdvice = '🟢 HEALTHY MOMENTUM: Hold position with trailing stop.';
  let badgeColor = 'success';
  let badgeText = 'HEALTHY';

  const isExtremeRSI = rsiVal >= 78;
  const isModerateRSI = rsiVal >= 70;
  const isSevereVwapStretch = vwapDeviationPct >= 4.0;
  const isModerateVwapStretch = vwapDeviationPct >= 2.0;

  if (hasUpperWickRejection && (isModerateRSI || isModerateVwapStretch)) {
    level = 'BEARISH_REVERSAL_EXIT';
    isOverbought = true;
    badgeColor = 'danger';
    badgeText = '🚨 BEARISH REVERSAL (UPPER WICK)';
    actionAdvice = '🚨 FULL EXIT 100% IMMEDIATELY: Severe buyer rejection / shooting star at top. High risk of sudden dump.';
  } else if (isExtremeRSI || isSevereVwapStretch || (isModerateRSI && vwapDeviationPct >= 2.8) || (isModerateRSI && isLateDaySession)) {
    level = 'OVERBOUGHT_CRITICAL';
    isOverbought = true;
    badgeColor = 'danger';
    badgeText = '🚨 CRITICAL OVERBOUGHT';
    actionAdvice = isLateDaySession
      ? '🚨 SAFE EXIT NOW (2:30 PM Window): Stock is overbought during institutional squaring hour. Take full profits.'
      : '🚨 SAFE EXIT / BOOK FULL PROFITS: Extreme overbought exhaustion detected. High probability of violent mean-reversion to VWAP.';
  } else if (isModerateRSI || isModerateVwapStretch) {
    level = 'OVERBOUGHT_WARN';
    isOverbought = true;
    badgeColor = 'warning';
    badgeText = '⚠️ OVERBOUGHT (ZONE)';
    actionAdvice = '⭐ BOOK 50% - 70% PROFIT: Lock in majority gains and trail stop-loss tightly on remaining balance.';
  }

  // 5. P&L and Trailing Stop Computation
  const pnlAmount = entry ? Number((price - entry).toFixed(2)) : null;
  const pnlPct = entry ? Number((((price - entry) / entry) * 100).toFixed(2)) : null;
  const trailingStopPrice = calculateDynamicExitStopLoss({
    entryPrice: entry,
    currentPrice: price,
    peakPrice: peakPrice || price,
    vwap: vwapVal,
  });

  return {
    isOverbought,
    level,
    rsi: rsiVal,
    vwapDeviationPct,
    hasUpperWickRejection,
    isLateDaySession,
    entryPrice: entry,
    currentPrice: price,
    trailingStopPrice,
    pnlAmount,
    pnlPct,
    badgeColor,
    badgeText,
    actionAdvice,
  };
}
