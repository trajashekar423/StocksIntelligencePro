/**
 * Risk-Based Position Sizing Calculator
 * Ensures positions strictly adhere to account risk limits and capital constraints.
 */

export interface PositionSizingResult {
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  target: number;
  riskPerShare: number;
  totalRiskAmount: number;
  totalPositionValue: number;
  potentialProfit: number;
  potentialLoss: number;
  riskReward: number;
  constrainedBy: 'RISK_PER_TRADE' | 'MAX_POSITION_VALUE' | 'AVAILABLE_CAPITAL' | 'MIN_QUANTITY';
}

export interface PositionSizingInput {
  capital: number;
  riskPerTradePct: number;
  maxPositionValue: number;
  entryPrice: number;
  stopLoss: number;
  target: number;
  availableFunds?: number;
}

export function calculatePositionSize(input: PositionSizingInput): PositionSizingResult {
  const {
    capital,
    riskPerTradePct,
    maxPositionValue,
    entryPrice,
    stopLoss,
    target,
    availableFunds = capital,
  } = input;

  if (entryPrice <= 0) {
    throw new Error('Entry price must be greater than zero.');
  }

  // Calculate maximum cash risk allowed for this trade
  const maxRiskAmount = Math.max(1, capital * (riskPerTradePct / 100));

  // Risk per share = Entry - StopLoss (enforce minimum 0.5% buffer to avoid zero division)
  const actualRiskPerShare = Math.abs(entryPrice - stopLoss);
  const minRiskPerShare = entryPrice * 0.005; // 0.5% min
  const riskPerShare = Math.max(actualRiskPerShare, minRiskPerShare);

  // Raw quantities by each constraint
  const qtyByRisk = Math.floor(maxRiskAmount / riskPerShare);
  const qtyByMaxValue = Math.floor(maxPositionValue / entryPrice);
  const qtyByCapital = Math.floor(availableFunds / entryPrice);

  let quantity = Math.min(qtyByRisk, qtyByMaxValue, qtyByCapital);
  let constrainedBy: PositionSizingResult['constrainedBy'] = 'RISK_PER_TRADE';

  if (quantity === qtyByMaxValue && qtyByMaxValue < qtyByRisk) {
    constrainedBy = 'MAX_POSITION_VALUE';
  } else if (quantity === qtyByCapital && qtyByCapital < qtyByRisk) {
    constrainedBy = 'AVAILABLE_CAPITAL';
  }

  // Ensure at least 1 share if affordable
  if (quantity < 1 && availableFunds >= entryPrice) {
    quantity = 1;
    constrainedBy = 'MIN_QUANTITY';
  } else if (quantity < 1) {
    quantity = 0;
  }

  const totalPositionValue = Number((quantity * entryPrice).toFixed(2));
  const potentialLoss = Number((quantity * riskPerShare).toFixed(2));
  const potentialProfit = Number((quantity * Math.abs(target - entryPrice)).toFixed(2));
  const riskReward = riskPerShare > 0 ? Number((Math.abs(target - entryPrice) / riskPerShare).toFixed(2)) : 1.5;

  return {
    quantity,
    entryPrice,
    stopLoss,
    target,
    riskPerShare: Number(riskPerShare.toFixed(2)),
    totalRiskAmount: potentialLoss,
    totalPositionValue,
    potentialProfit,
    potentialLoss,
    riskReward,
    constrainedBy,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAWDOWN RECOVERY CALCULATOR
// Video Chapter: "The Dangerous Math of Risking Too Much Per Trade"
//
// As losses compound, the gain required to return to break-even grows
// exponentially — NOT linearly. This is the most misunderstood math in trading.
//
//   10% down  → need 11.1% gain
//   20% down  → need 25.0% gain
//   50% down  → need 100% gain
//   70% down  → need 233.3% gain
//
// ─────────────────────────────────────────────────────────────────────────────

export interface DrawdownRecoveryResult {
  /** Input drawdown percentage (e.g. 30 for 30%) */
  drawdownPct: number;
  /** Amount lost in ₹ on the given capitalBase */
  drawdownAmount: number;
  /** % gain needed to return to break-even from this drawdown */
  recoveryRequiredPct: number;
  /** Capital remaining after drawdown (in ₹ on the given capitalBase) */
  capitalRemaining: number;
  /** How many winning trades at the given expectancy ₹ are needed to recover */
  tradesToRecover: number | null;
  /**
   * Risk classification of the drawdown:
   *   MANAGEABLE  — drawdown < 15% (recovery is realistic)
   *   SEVERE      — 15–35% drawdown (requires sustained effort)
   *   CRITICAL    — > 35% drawdown (extremely difficult to recover from)
   */
  riskLevel: 'MANAGEABLE' | 'SEVERE' | 'CRITICAL';
  /** Plain-English recovery message */
  recoveryMessage: string;
}

/**
 * Calculates the exact gain % required to recover from a drawdown,
 * and estimates how many trades at the given expectancy it would take.
 *
 * @param drawdownPct         The percentage drawdown (e.g. 25 for 25% down)
 * @param capitalBase         Starting capital for reference (default ₹100,000)
 * @param expectancyPerTrade  Average ₹ profit per trade (from ExpectancyEngine). null = skip estimate.
 */
export function calculateDrawdownRecovery(
  drawdownPct: number,
  capitalBase = 100000,
  expectancyPerTrade: number | null = null
): DrawdownRecoveryResult {
  const clampedDrawdown = Math.min(Math.max(drawdownPct, 0), 99.9);

  // Recovery required = (1 / (1 - drawdown/100)) - 1
  const capitalRemaining = capitalBase * (1 - clampedDrawdown / 100);
  const drawdownAmount = capitalBase - capitalRemaining;
  const recoveryRequiredPct = Number(
    (((capitalBase - capitalRemaining) / capitalRemaining) * 100).toFixed(2)
  );

  // Classify risk tier
  let riskLevel: DrawdownRecoveryResult['riskLevel'];
  if (clampedDrawdown < 15) riskLevel = 'MANAGEABLE';
  else if (clampedDrawdown <= 35) riskLevel = 'SEVERE';
  else riskLevel = 'CRITICAL';

  // Estimate trades to recover
  let tradesToRecover: number | null = null;
  if (expectancyPerTrade !== null && expectancyPerTrade > 0) {
    const lostAmount = capitalBase - capitalRemaining;
    tradesToRecover = Math.ceil(lostAmount / expectancyPerTrade);
  }

  // Recovery message
  let recoveryMessage: string;
  if (riskLevel === 'MANAGEABLE') {
    recoveryMessage = `A ${clampedDrawdown.toFixed(1)}% drawdown requires a ${recoveryRequiredPct.toFixed(1)}% gain to recover — manageable with disciplined trading.`;
  } else if (riskLevel === 'SEVERE') {
    recoveryMessage = `⚠️ A ${clampedDrawdown.toFixed(1)}% drawdown requires a ${recoveryRequiredPct.toFixed(1)}% gain. This is why institutional desks cap per-trade risk at 1–2%: a streak of 5 × 2% losses = 10% down, needing 11.1% to recover.`;
  } else {
    recoveryMessage = `🚨 A ${clampedDrawdown.toFixed(1)}% drawdown requires a ${recoveryRequiredPct.toFixed(1)}% recovery gain — mathematically very difficult. At this level, reducing position size is more important than any entry signal.`;
  }

  if (tradesToRecover !== null) {
    recoveryMessage += ` At your current expectancy, approximately ${tradesToRecover} trades are needed to return to break-even.`;
  }

  return {
    drawdownPct: clampedDrawdown,
    drawdownAmount: Number(drawdownAmount.toFixed(2)),
    recoveryRequiredPct,
    capitalRemaining: Number(capitalRemaining.toFixed(2)),
    tradesToRecover,
    riskLevel,
    recoveryMessage,
  };
}
