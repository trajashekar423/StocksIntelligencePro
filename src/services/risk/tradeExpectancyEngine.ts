/**
 * Trade Expectancy Engine
 *
 * Core insight from institutional risk management:
 *   Win Rate alone is MEANINGLESS. A 30% win rate with a 4:1 R:R outperforms
 *   a 90% win rate with a 0.5:1 R:R every single time.
 *
 * This engine computes:
 *   - Win Rate, Avg Win, Avg Loss
 *   - Expectancy per trade (₹ and R-multiple)
 *   - Profit Factor (gross wins / gross losses)
 *   - Max Consecutive Losses
 *   - Risk of Ruin estimate
 *   - Trader Grade: INSTITUTIONAL / DEVELOPING / RETAIL_BEHAVIOR
 */

export interface ClosedTrade {
  /** Unique trade identifier */
  id: string;
  /** Realised P&L in ₹ (positive = win, negative = loss) */
  realizedPnL: number;
  /** Amount risked on entry (always positive, in ₹) */
  riskAmount: number;
  /** Side of the trade */
  side?: 'LONG' | 'SHORT';
  /** ISO timestamp of trade close */
  closedAt?: string;
}

export interface ExpectancyReport {
  /** Total trades analysed */
  totalTrades: number;
  /** Number of winning trades */
  winCount: number;
  /** Number of losing trades */
  lossCount: number;
  /** Win rate as a percentage (0–100) */
  winRatePct: number;
  /** Average profit on winning trades (₹) */
  avgWin: number;
  /** Average loss on losing trades (₹, always positive) */
  avgLoss: number;
  /**
   * Expectancy per trade (₹).
   * E = (winRate × avgWin) − (lossRate × avgLoss)
   * Positive = system has statistical edge.
   */
  expectancyPerTrade: number;
  /**
   * Expectancy Ratio (R-multiple).
   * How many R-units of reward you earn per trade on average.
   * Positive expectancy ratio means the system beats the market.
   */
  expectancyRatio: number;
  /**
   * Profit Factor = Gross Wins / Gross Losses.
   * > 1.5 = good. > 2.0 = excellent. < 1.0 = losing system.
   */
  profitFactor: number;
  /** Maximum consecutive losses observed in this trade sequence */
  maxConsecutiveLosses: number;
  /**
   * Estimated Risk of Ruin percentage (0–100).
   * Approximation: how likely is it that a drawdown wipes out the account?
   * Based on win rate and avg R:R ratio.
   */
  riskOfRuinPct: number;
  /** Total realised P&L across all trades */
  totalPnL: number;
  /** Trader skill grade based on expectancy and profit factor */
  grade: 'INSTITUTIONAL' | 'DEVELOPING' | 'RETAIL_BEHAVIOR' | 'INSUFFICIENT_DATA';
  /** Human-readable summary of the grade */
  gradeSummary: string;
  /** Key insights and actionable messages */
  insights: string[];
}

/**
 * Computes the maximum consecutive losses in a sequence of trades.
 */
function computeMaxConsecutiveLosses(trades: ClosedTrade[]): number {
  let max = 0;
  let current = 0;
  for (const t of trades) {
    if (t.realizedPnL < 0) {
      current++;
      max = Math.max(max, current);
    } else {
      current = 0;
    }
  }
  return max;
}

/**
 * Estimates Risk of Ruin using the Kelly-derived approximation.
 * Formula: RoR ≈ ((1 - edge) / (1 + edge)) ^ (capital / avgLoss)
 * Simplified to a 0-100 pct score for display.
 *
 * A high RoR (> 15%) means the current risk % per trade is dangerous
 * given this win rate and R:R profile.
 */
function estimateRiskOfRuin(winRatePct: number, avgWin: number, avgLoss: number): number {
  const w = winRatePct / 100;
  const l = 1 - w;
  if (avgLoss <= 0 || avgWin <= 0) return 0;

  const rrRatio = avgWin / avgLoss;
  // Edge = (w * rrRatio) - l  (Kelly numerator)
  const edge = w * rrRatio - l;

  if (edge <= 0) {
    // Negative edge: ruin is near-certain over long run
    return 95;
  }

  // Conservative RoR estimate: decreases as edge increases
  // Calibrated so edge of 0 → ~95%, edge of 0.5 → ~15%, edge of 1.0 → ~5%
  const ror = Math.max(0, Math.min(95, Math.round(95 * Math.exp(-edge * 4.5))));
  return ror;
}

/**
 * Classifies the trader's grade from expectancy and profit factor metrics.
 */
function classifyGrade(
  expectancyRatio: number,
  profitFactor: number,
  winRatePct: number
): { grade: ExpectancyReport['grade']; gradeSummary: string } {
  if (expectancyRatio >= 0.4 && profitFactor >= 1.8) {
    return {
      grade: 'INSTITUTIONAL',
      gradeSummary:
        '🏛️ INSTITUTIONAL — Your edge is statistically robust. Positive expectancy with strong profit factor mirrors how professional desks manage capital.',
    };
  }
  if (expectancyRatio >= 0.1 && profitFactor >= 1.2) {
    return {
      grade: 'DEVELOPING',
      gradeSummary:
        '📈 DEVELOPING — Positive expectancy exists but edge is thin. Focus on cutting losers faster and letting winners run to move into Institutional tier.',
    };
  }
  if (expectancyRatio < 0 || profitFactor < 1.0) {
    return {
      grade: 'RETAIL_BEHAVIOR',
      gradeSummary:
        '🚨 RETAIL_BEHAVIOR — Negative expectancy detected. The system is losing money on average per trade regardless of win rate. Review R:R discipline immediately.',
    };
  }
  // Near breakeven
  return {
    grade: 'DEVELOPING',
    gradeSummary:
      `📊 DEVELOPING — Near breakeven expectancy (Win Rate: ${winRatePct.toFixed(1)}%). Trades are risk-controlled but edge needs refinement. Focus on improving average winner vs average loser ratio.`,
  };
}

/**
 * Generates actionable insights based on the statistical report.
 */
function generateInsights(report: Partial<ExpectancyReport>): string[] {
  const insights: string[] = [];

  const {
    winRatePct = 0,
    avgWin = 0,
    avgLoss = 0,
    expectancyPerTrade = 0,
    profitFactor = 0,
    maxConsecutiveLosses = 0,
    riskOfRuinPct = 0,
  } = report;

  // Win Rate sanity check
  if (winRatePct > 80) {
    insights.push(
      `⚠️ Win rate of ${winRatePct.toFixed(1)}% is very high — verify that stops are not being moved to avoid losses. High win rate + poor expectancy = hidden account bleed.`
    );
  }

  if (winRatePct < 35 && expectancyPerTrade > 0) {
    insights.push(
      `✅ Win rate is only ${winRatePct.toFixed(1)}% but expectancy is positive — this is the correct institutional model. Your winners are large enough to cover your losers.`
    );
  }

  // R:R insight
  const rrRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  if (rrRatio < 1.5) {
    insights.push(
      `🔴 Average R:R ratio is ${rrRatio.toFixed(2)}:1 — below the 1.5:1 minimum for long-term profitability. Consider tightening stops or using wider targets.`
    );
  } else if (rrRatio >= 2.0) {
    insights.push(
      `✅ Average R:R ratio is ${rrRatio.toFixed(2)}:1 — excellent. Your winners pay significantly more than your losers cost.`
    );
  }

  // Profit Factor
  if (profitFactor < 1.0) {
    insights.push(
      `🚨 Profit Factor is ${profitFactor.toFixed(2)} — below 1.0 means losses outweigh all gains. Immediate review of entry quality and position sizing required.`
    );
  } else if (profitFactor >= 2.0) {
    insights.push(
      `✅ Profit Factor ${profitFactor.toFixed(2)} — for every ₹1 lost, the system generates ₹${profitFactor.toFixed(2)} in wins. Strong institutional-grade edge.`
    );
  }

  // Consecutive loss streak
  if (maxConsecutiveLosses >= 5) {
    insights.push(
      `⚠️ Max ${maxConsecutiveLosses} consecutive losses observed. With 1% risk per trade, a ${maxConsecutiveLosses}-loss streak costs ${maxConsecutiveLosses}% of capital. Ensure drawdown recovery math is understood.`
    );
  }

  // Risk of Ruin
  if (riskOfRuinPct > 20) {
    insights.push(
      `🚨 Estimated Risk of Ruin: ${riskOfRuinPct}% — reduce risk per trade to below 1% or improve the win/R:R profile immediately.`
    );
  } else if (riskOfRuinPct <= 5) {
    insights.push(
      `✅ Risk of Ruin estimated at only ${riskOfRuinPct}% — capital is well-protected at current risk levels.`
    );
  }

  // Expectancy per trade
  if (expectancyPerTrade > 0) {
    insights.push(
      `📊 Expectancy: +₹${expectancyPerTrade.toFixed(2)} per trade. Over 100 trades this system statistically generates +₹${(expectancyPerTrade * 100).toFixed(0)}.`
    );
  } else {
    insights.push(
      `📊 Expectancy: ₹${expectancyPerTrade.toFixed(2)} per trade — negative. This system loses money in expectation even when win rate looks acceptable.`
    );
  }

  return insights;
}

/**
 * Main function: computes the full expectancy report from a list of closed trades.
 *
 * @param trades  Array of closed trades (wins and losses)
 * @returns       Full ExpectancyReport with grade and insights
 */
export function calculateExpectancy(trades: ClosedTrade[]): ExpectancyReport {
  const MIN_TRADES_FOR_GRADING = 10;

  if (!trades || trades.length === 0) {
    return {
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      winRatePct: 0,
      avgWin: 0,
      avgLoss: 0,
      expectancyPerTrade: 0,
      expectancyRatio: 0,
      profitFactor: 0,
      maxConsecutiveLosses: 0,
      riskOfRuinPct: 0,
      totalPnL: 0,
      grade: 'INSUFFICIENT_DATA',
      gradeSummary: '📋 INSUFFICIENT_DATA — Need at least 10 closed trades to compute a meaningful expectancy report.',
      insights: ['Record more trades to generate a statistically meaningful expectancy analysis.'],
    };
  }

  const wins = trades.filter((t) => t.realizedPnL > 0);
  const losses = trades.filter((t) => t.realizedPnL < 0);

  const winCount = wins.length;
  const lossCount = losses.length;
  const totalTrades = trades.length;
  const winRatePct = Number(((winCount / totalTrades) * 100).toFixed(2));

  const grossWins = wins.reduce((sum, t) => sum + t.realizedPnL, 0);
  const grossLosses = Math.abs(losses.reduce((sum, t) => sum + t.realizedPnL, 0));

  const avgWin = winCount > 0 ? Number((grossWins / winCount).toFixed(2)) : 0;
  const avgLoss = lossCount > 0 ? Number((grossLosses / lossCount).toFixed(2)) : 0;

  // E = (winRate × avgWin) - (lossRate × avgLoss)
  const winRate = winCount / totalTrades;
  const lossRate = lossCount / totalTrades;
  const expectancyPerTrade = Number((winRate * avgWin - lossRate * avgLoss).toFixed(2));

  // Expectancy Ratio in R-multiples (uses average riskAmount if available)
  const avgRisk =
    trades.filter((t) => t.riskAmount > 0).length > 0
      ? trades.filter((t) => t.riskAmount > 0).reduce((sum, t) => sum + t.riskAmount, 0) /
        trades.filter((t) => t.riskAmount > 0).length
      : avgLoss || 1;
  const expectancyRatio = Number((expectancyPerTrade / Math.max(avgRisk, 1)).toFixed(3));

  const profitFactor =
    grossLosses > 0 ? Number((grossWins / grossLosses).toFixed(2)) : grossWins > 0 ? 99 : 0;

  const maxConsecutiveLosses = computeMaxConsecutiveLosses(trades);
  const riskOfRuinPct = estimateRiskOfRuin(winRatePct, avgWin, avgLoss);
  const totalPnL = Number(trades.reduce((sum, t) => sum + t.realizedPnL, 0).toFixed(2));

  const { grade, gradeSummary } =
    totalTrades >= MIN_TRADES_FOR_GRADING
      ? classifyGrade(expectancyRatio, profitFactor, winRatePct)
      : {
          grade: 'INSUFFICIENT_DATA' as const,
          gradeSummary: `📋 INSUFFICIENT_DATA — Need at least ${MIN_TRADES_FOR_GRADING} trades for grading. Currently have ${totalTrades}.`,
        };

  const partialReport: Partial<ExpectancyReport> = {
    winRatePct,
    avgWin,
    avgLoss,
    expectancyPerTrade,
    profitFactor,
    maxConsecutiveLosses,
    riskOfRuinPct,
  };

  return {
    totalTrades,
    winCount,
    lossCount,
    winRatePct,
    avgWin,
    avgLoss,
    expectancyPerTrade,
    expectancyRatio,
    profitFactor,
    maxConsecutiveLosses,
    riskOfRuinPct,
    totalPnL,
    grade,
    gradeSummary,
    insights: generateInsights(partialReport),
  };
}
