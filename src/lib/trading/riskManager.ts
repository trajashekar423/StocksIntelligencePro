/**
 * Risk Management Gate
 * 11 Authoritative pre-trade validation checks.
 */

import type { RiskCheckResult, TradingConfig } from '../../types/trading.ts';
import { getStore } from './store.ts';
import { getMarketSessionStatus } from '../../services/stocksService.js';

export interface PreTradeCheckParams {
  symbol: string;
  side?: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  target: number;
  quantity: number;
  config: TradingConfig;
  bypassMarketHoursForPaper?: boolean;
  /**
   * Bullish score (0–100) for the setup, used by the Conviction Oversize Guard.
   * High-conviction trades (score ≥ 92) must still obey the same risk-per-trade cap.
   * Institutional principle: every trade is ONE sample in a probability distribution.
   */
  bullishScore?: number;
  /**
   * Requested risk % per trade. If provided and exceeds the conviction cap, it is blocked.
   * Defaults to config.riskPerTradePct if not provided.
   */
  requestedRiskPerTradePct?: number;
}

export function validatePreTrade(params: PreTradeCheckParams): RiskCheckResult {
  const {
    symbol,
    side = 'LONG',
    entryPrice,
    stopLoss,
    target,
    quantity,
    config,
    bypassMarketHoursForPaper = true,
    bullishScore,
    requestedRiskPerTradePct,
  } = params;


  const store = getStore();
  const cleanSymbol = symbol.trim().toUpperCase();

  // 1. Check Kill Switch
  if (!config.enabled) {
    return {
      allowed: false,
      code: 'KILL_SWITCH_ACTIVE',
      reason: 'Trading is currently disabled via Emergency Kill Switch (STOP NEW TRADES).',
    };
  }

  // 2. Check Market Session (For LIVE trading strictly enforce market hours)
  const session = getMarketSessionStatus();
  if (config.mode === 'LIVE' && !session.isMarketOpen) {
    return {
      allowed: false,
      code: 'MARKET_CLOSED',
      reason: `Cannot place live order: NSE market is currently ${session.status} (Open: 09:15 - 15:30 IST).`,
      details: { sessionStatus: session.status, istTime: session.istTime },
    };
  }

  // 3. Check Quantity
  if (!quantity || quantity <= 0) {
    return {
      allowed: false,
      code: 'INVALID_QUANTITY',
      reason: 'Quantity must be at least 1 share based on current risk sizing.',
    };
  }

  // 4. Check Position Value Limit
  const positionValue = entryPrice * quantity;
  if (positionValue > config.maxPositionValue * 1.05) {
    return {
      allowed: false,
      code: 'MAX_POSITION_VALUE_EXCEEDED',
      reason: `Total position value ₹${positionValue.toFixed(2)} exceeds maximum limit ₹${config.maxPositionValue}.`,
    };
  }

  // 5. Check Duplicate Existing Position
  const existingPos = store.positions.find((p) => p.symbol === cleanSymbol);
  if (existingPos) {
    return {
      allowed: false,
      code: 'POSITION_ALREADY_EXISTS',
      reason: `An open position for ${cleanSymbol} already exists at entry ₹${existingPos.entryPrice}.`,
    };
  }

  // 6. Check Max Open Positions
  if (store.positions.length >= config.maxOpenPositions) {
    return {
      allowed: false,
      code: 'MAX_OPEN_POSITIONS_REACHED',
      reason: `Maximum concurrent open positions (${config.maxOpenPositions}) reached. Close an active position first.`,
    };
  }

  // 7. Check Daily Max Trades
  if (store.stats.tradesToday >= config.maxTradesPerDay) {
    return {
      allowed: false,
      code: 'MAX_DAILY_TRADES_REACHED',
      reason: `Daily trade limit (${config.maxTradesPerDay} trades) reached for today.`,
    };
  }

  // 8. Check Daily Max Loss Limit
  if (store.stats.maxLossHit || store.stats.realizedPnL <= -config.maxDailyLoss) {
    return {
      allowed: false,
      code: 'MAX_DAILY_LOSS_HIT',
      reason: `Daily loss limit of ₹${config.maxDailyLoss} has been hit. Trading halted for today.`,
    };
  }

  // 9. Stop-Loss Validation
  if (side === 'LONG' && stopLoss >= entryPrice) {
    return {
      allowed: false,
      code: 'INVALID_STOP_LOSS',
      reason: `For LONG trades, stop-loss (₹${stopLoss}) must be below entry price (₹${entryPrice}).`,
    };
  }

  // 10. Target Validation
  if (side === 'LONG' && target <= entryPrice) {
    return {
      allowed: false,
      code: 'INVALID_TARGET',
      reason: `For LONG trades, target (₹${target}) must be above entry price (₹${entryPrice}).`,
    };
  }

  // 11. Risk/Reward Ratio Validation
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  const rewardPerShare = Math.abs(target - entryPrice);
  const rr = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;

  if (rr < 1.2) {
    return {
      allowed: false,
      code: 'POOR_RISK_REWARD',
      reason: `Risk/Reward ratio (${rr.toFixed(2)}) is below the required 1.20 minimum threshold.`,
    };
  }

  // 12. Conviction Oversize Guard
  //
  // Institutional Principle (Video Chapter: "The Psychological Trap of High Conviction"):
  //   A high bullish score does NOT mean the trade will win.
  //   Every trade is ONE sample from a probability distribution.
  //   Oversizing because "this one is a sure thing" is the #1 psychological trap.
  //
  //   Rule: Even a maximum-conviction trade (score = 100) cannot exceed
  //   1.5× the normal risk-per-trade cap. Period.
  {
    const effectiveRiskPct = requestedRiskPerTradePct ?? config.riskPerTradePct;
    const maxAllowedRiskPct = config.riskPerTradePct * 1.5; // Hard institutional cap

    if (effectiveRiskPct > maxAllowedRiskPct) {
      const convictionNote =
        bullishScore !== undefined && bullishScore >= 90
          ? ` Even with a high conviction score of ${bullishScore}/100, risk sizing limits must be obeyed — high conviction is a psychological feeling, not a statistical guarantee.`
          : '';
      return {
        allowed: false,
        code: 'CONVICTION_OVERSIZE_BLOCKED',
        reason: `Requested risk of ${effectiveRiskPct.toFixed(2)}% per trade exceeds the maximum allowed ${maxAllowedRiskPct.toFixed(2)}% (1.5× the base ${config.riskPerTradePct}% cap).${convictionNote}`,
      };
    }
  }

  return {
    allowed: true,
  };
}
