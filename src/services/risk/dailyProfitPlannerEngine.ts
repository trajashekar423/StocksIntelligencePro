/**
 * Daily Profit Planner & Position Sizing Engine
 * 
 * Calculates exact share quantity, margin requirements (5x leverage), target price levels,
 * stop loss, and trade breakdown required to achieve a daily profit target (e.g., ₹1,000 - ₹10,000).
 */

export interface ProfitPlannerInput {
  /** Target daily net profit in INR (e.g. 1000 to 10000) */
  targetProfit: number;
  /** Stock entry price in INR (e.g. 450) */
  stockPrice: number;
  /** Optional custom stop loss price per share (if omitted, calculated via risk % or R:R) */
  stopLossPrice?: number;
  /** Optional custom target price per share (if omitted, calculated via expected move %) */
  targetPrice?: number;
  /** Expected price move percentage (default 1.5% for intraday) */
  expectedMovePct?: number;
  /** Intraday leverage multiplier (default 5 for 5x MIS margin) */
  leverageMultiplier?: number;
  /** Number of trades to split daily target across (1, 2, or 3 trades, default 1) */
  tradesPerDay?: number;
  /** Risk-to-reward ratio for auto-calculated Stop Loss (default 2 for 1:2 R:R) */
  riskRewardRatio?: number;
}

export interface TradeBreakdown {
  tradeNumber: number;
  targetProfitThisTrade: number;
  quantity: number;
  capitalRequired: number;
  marginRequired5x: number;
  maxRiskThisTrade: number;
}

export interface ProfitPlannerResult {
  targetProfitTotal: number;
  stockPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  requiredMovePerShare: number;
  requiredMovePct: number;
  riskPerShare: number;
  riskRewardRatio: number;
  requiredQuantityTotal: number;
  totalCapitalRequired: number;
  marginRequired5x: number;
  maxLossTotal: number;
  tradesPerDay: number;
  targetProfitPerTrade: number;
  quantityPerTrade: number;
  marginPerTrade5x: number;
  feasibilityRating: 'REALISTIC' | 'MODERATE' | 'CHALLENGING';
  feasibilityReason: string;
  tradeBreakdown: TradeBreakdown[];
}

/**
 * Calculates position size, required margin, target exit prices, and risk-reward metrics
 * to achieve a specific daily profit target.
 */
export function calculateDailyProfitPlan(input: ProfitPlannerInput): ProfitPlannerResult {
  const targetProfitTotal = Math.max(1, input.targetProfit || 1000);
  const stockPrice = Math.max(0.01, input.stockPrice || 100);
  const expectedMovePct = Math.max(0.1, input.expectedMovePct || 1.5);
  const leverageMultiplier = Math.max(1, input.leverageMultiplier || 5);
  const tradesPerDay = Math.min(5, Math.max(1, input.tradesPerDay || 1));
  const rrRatio = Math.max(1, input.riskRewardRatio || 2);

  // Target Profit per trade
  const targetProfitPerTrade = targetProfitTotal / tradesPerDay;

  // Determine Target Price & Required Price Move
  let targetPrice = input.targetPrice || 0;
  if (targetPrice <= stockPrice) {
    // Auto-calculate target price based on expected move %
    targetPrice = stockPrice * (1 + expectedMovePct / 100);
  }

  const requiredMovePerShare = Math.max(0.01, targetPrice - stockPrice);
  const requiredMovePct = (requiredMovePerShare / stockPrice) * 100;

  // Determine Stop Loss Price
  let stopLossPrice = input.stopLossPrice || 0;
  if (stopLossPrice <= 0 || stopLossPrice >= stockPrice) {
    // Auto-calculate SL based on Risk:Reward ratio (SL distance = requiredMovePerShare / R:R)
    const riskPerShareCalc = requiredMovePerShare / rrRatio;
    stopLossPrice = Math.max(0.01, stockPrice - riskPerShareCalc);
  }

  const riskPerShare = Math.max(0.01, stockPrice - stopLossPrice);
  const actualRR = Number((requiredMovePerShare / riskPerShare).toFixed(2));

  // Required Quantity for single trade
  const quantityPerTrade = Math.ceil(targetProfitPerTrade / requiredMovePerShare);
  const requiredQuantityTotal = quantityPerTrade * tradesPerDay;

  // Capital & Margin Requirements
  const marginPerTrade5x = Math.ceil((quantityPerTrade * stockPrice) / leverageMultiplier);
  const totalCapitalRequired = Math.ceil(requiredQuantityTotal * stockPrice);
  const marginRequired5x = Math.ceil(totalCapitalRequired / leverageMultiplier);

  // Maximum Risk / Loss
  const maxLossPerTrade = Number((quantityPerTrade * riskPerShare).toFixed(2));
  const maxLossTotal = Number((maxLossPerTrade * tradesPerDay).toFixed(2));

  // Feasibility Rating
  let feasibilityRating: 'REALISTIC' | 'MODERATE' | 'CHALLENGING' = 'REALISTIC';
  let feasibilityReason = '1.5% target move is well within normal intraday volatility.';

  if (requiredMovePct > 4.0) {
    feasibilityRating = 'CHALLENGING';
    feasibilityReason = `A ${requiredMovePct.toFixed(1)}% move in a single session is rare. Consider splitting across 2-3 trades or targeting high-beta stocks.`;
  } else if (requiredMovePct > 2.5) {
    feasibilityRating = 'MODERATE';
    feasibilityReason = `A ${requiredMovePct.toFixed(1)}% move requires strong 4-TF alignment momentum.`;
  }

  // Trade breakdown
  const tradeBreakdown: TradeBreakdown[] = [];
  for (let i = 1; i <= tradesPerDay; i++) {
    tradeBreakdown.push({
      tradeNumber: i,
      targetProfitThisTrade: Number(targetProfitPerTrade.toFixed(2)),
      quantity: quantityPerTrade,
      capitalRequired: Math.ceil(quantityPerTrade * stockPrice),
      marginRequired5x: marginPerTrade5x,
      maxRiskThisTrade: maxLossPerTrade
    });
  }

  return {
    targetProfitTotal,
    stockPrice: Number(stockPrice.toFixed(2)),
    targetPrice: Number(targetPrice.toFixed(2)),
    stopLossPrice: Number(stopLossPrice.toFixed(2)),
    requiredMovePerShare: Number(requiredMovePerShare.toFixed(2)),
    requiredMovePct: Number(requiredMovePct.toFixed(2)),
    riskPerShare: Number(riskPerShare.toFixed(2)),
    riskRewardRatio: actualRR,
    requiredQuantityTotal,
    totalCapitalRequired,
    marginRequired5x,
    maxLossTotal,
    tradesPerDay,
    targetProfitPerTrade: Number(targetProfitPerTrade.toFixed(2)),
    quantityPerTrade,
    marginPerTrade5x,
    feasibilityRating,
    feasibilityReason,
    tradeBreakdown
  };
}

/**
 * Convenience helper to calculate quick position sizes for common daily profit targets:
 * ₹1,000, ₹2,500, ₹5,000, ₹10,000
 */
export function getDailyProfitPresetOptions(stockPrice: number, expectedMovePct = 1.5) {
  const targets = [1000, 2500, 5000, 10000];
  return targets.map(targetProfit => calculateDailyProfitPlan({
    targetProfit,
    stockPrice,
    expectedMovePct,
    leverageMultiplier: 5,
    tradesPerDay: 1,
    riskRewardRatio: 2
  }));
}

