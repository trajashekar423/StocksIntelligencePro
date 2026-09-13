/**
 * Trade Quality Engine
 *
 * Core insight from the video: A "good trade" is one that follows the plan
 * correctly — even if it results in a loss. A "bad trade" breaks risk rules —
 * even if it accidentally wins.
 *
 * This engine rates each closed trade against 7 compliance checks and
 * returns an A/B/C/F grade with a GOOD_TRADE / BAD_TRADE label.
 *
 * Institutional principle: Judge your trades on PROCESS, not outcomes.
 */

export interface TradeForQualityCheck {
  /** Unique trade identifier */
  id: string;
  /** P&L result in ₹ */
  realizedPnL: number;
  /** Entry price */
  entryPrice: number;
  /** Stop loss price at time of entry */
  stopLossAtEntry: number;
  /** Target price at time of entry */
  targetAtEntry: number;
  /** Total account capital at time of trade */
  capitalAtEntry: number;
  /** Amount risked (entryPrice - stopLoss) × quantity in ₹ */
  riskAmount: number;
  /** Max allowed risk % of capital (from config) */
  maxRiskPerTradePct: number;
  /** Actual position size value (entryPrice × quantity) */
  positionValue: number;
  /** Max allowed position value (from config) */
  maxPositionValue: number;
  /** Bullish score at entry (0–100). null if not available. */
  bullishScoreAtEntry: number | null;
  /** Minimum bullish score required for a qualified signal */
  minBullishScore: number;
  /**
   * Was the stop loss ever moved AWAY from the entry price to avoid a loss?
   * true = stop was widened (rule break), false = stop was held or tightened (fine).
   */
  wasStopLossWidened: boolean;
  /**
   * How was the exit triggered?
   * SYSTEM = rule-based exit (trailing stop, target, risk rule)
   * MANUAL_EARLY = exited before any rule triggered (panic or greed)
   * MANUAL_LATE = held past exit signal (hope)
   */
  exitTrigger: 'SYSTEM' | 'MANUAL_EARLY' | 'MANUAL_LATE';
  /** Side of the trade */
  side?: 'LONG' | 'SHORT';
}

export interface TradeQualityReport {
  tradeId: string;
  /** Compliance score 0–100 */
  qualityScore: number;
  /** Letter grade */
  grade: 'A' | 'B' | 'C' | 'F';
  /** Institutional label */
  label: 'GOOD_TRADE' | 'ACCEPTABLE' | 'RULE_BREAK' | 'BAD_TRADE';
  /** Description of the label */
  labelDescription: string;
  /** Checks that passed */
  passedChecks: string[];
  /** Checks that failed */
  failedChecks: string[];
  /** Was this a profitable trade? */
  wasWin: boolean;
  /**
   * Key insight: a profitable BAD_TRADE is as dangerous as a losing BAD_TRADE
   * because it reinforces rule-breaking behaviour.
   */
  keyInsight: string;
}

interface QualityCheck {
  name: string;
  weight: number; // Points awarded on pass
  passed: boolean;
  passMessage: string;
  failMessage: string;
}

function computeRR(entryPrice: number, stopLoss: number, target: number, side: 'LONG' | 'SHORT'): number {
  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(target - entryPrice);
  if (risk <= 0) return 0;
  // For SHORT: stopLoss > entryPrice, target < entryPrice
  if (side === 'SHORT') {
    return Math.abs(entryPrice - target) / Math.abs(stopLoss - entryPrice);
  }
  return reward / risk;
}

/**
 * Evaluates a closed trade's quality against 7 institutional compliance checks.
 */
export function scoreTradeQuality(trade: TradeForQualityCheck): TradeQualityReport {
  const side = trade.side ?? 'LONG';
  const actualRiskPct =
    trade.capitalAtEntry > 0
      ? (trade.riskAmount / trade.capitalAtEntry) * 100
      : 0;
  const rrRatio = computeRR(trade.entryPrice, trade.stopLossAtEntry, trade.targetAtEntry, side);

  const checks: QualityCheck[] = [
    // Check 1: Risk per trade was within the allowed cap
    {
      name: 'Risk Per Trade ≤ Cap',
      weight: 20,
      passed: actualRiskPct <= trade.maxRiskPerTradePct * 1.05, // Allow 5% tolerance
      passMessage: `✅ Risk was ${actualRiskPct.toFixed(2)}% — within the ${trade.maxRiskPerTradePct}% cap`,
      failMessage: `❌ Risk was ${actualRiskPct.toFixed(2)}% — exceeded the ${trade.maxRiskPerTradePct}% cap. Oversized position.`,
    },

    // Check 2: Stop loss was set at a structural level (not tight enough to be random)
    {
      name: 'Hard Stop Loss Set Before Entry',
      weight: 15,
      passed: trade.stopLossAtEntry > 0 && trade.stopLossAtEntry !== trade.entryPrice,
      passMessage: `✅ Hard stop loss was set at ₹${trade.stopLossAtEntry.toFixed(2)} before entry`,
      failMessage: `❌ No hard stop loss was defined. This violates the fundamental rule of defined risk before entry.`,
    },

    // Check 3: R:R ratio was at least 1.5:1 at entry
    {
      name: 'R:R ≥ 1.5:1 at Entry',
      weight: 15,
      passed: rrRatio >= 1.5,
      passMessage: `✅ R:R at entry was ${rrRatio.toFixed(2)}:1 — reward exceeds risk by the required margin`,
      failMessage: `❌ R:R was only ${rrRatio.toFixed(2)}:1 at entry — below the 1.5:1 minimum. Trade lacked structural edge.`,
    },

    // Check 4: Entry was based on a qualified signal
    {
      name: 'Qualified Entry Signal',
      weight: 15,
      passed:
        trade.bullishScoreAtEntry === null ||
        trade.bullishScoreAtEntry >= trade.minBullishScore,
      passMessage:
        trade.bullishScoreAtEntry !== null
          ? `✅ Bullish score was ${trade.bullishScoreAtEntry}/100 at entry — met the ≥${trade.minBullishScore} threshold`
          : `✅ Entry signal data not recorded (score check skipped)`,
      failMessage: `❌ Bullish score was ${trade.bullishScoreAtEntry}/100 — below the ${trade.minBullishScore} minimum. FOMO or unqualified entry.`,
    },

    // Check 5: Position value did not exceed the max position cap
    {
      name: 'Position Value ≤ Max Cap',
      weight: 10,
      passed: trade.positionValue <= trade.maxPositionValue * 1.05,
      passMessage: `✅ Position value ₹${trade.positionValue.toFixed(0)} was within the ₹${trade.maxPositionValue.toFixed(0)} cap`,
      failMessage: `❌ Position value ₹${trade.positionValue.toFixed(0)} exceeded the ₹${trade.maxPositionValue.toFixed(0)} cap. Concentration risk.`,
    },

    // Check 6: Stop loss was NOT widened to avoid taking the loss
    {
      name: 'Stop Loss Was Not Widened',
      weight: 15,
      passed: !trade.wasStopLossWidened,
      passMessage: `✅ Stop loss was honoured and not moved to avoid a loss`,
      failMessage: `❌ Stop loss was widened to avoid a loss. This is the #1 retail mistake — turns small losses into catastrophic ones.`,
    },

    // Check 7: Exit was triggered by a system rule (not panic / hope)
    {
      name: 'Rule-Based Exit',
      weight: 10,
      passed: trade.exitTrigger === 'SYSTEM',
      passMessage: `✅ Exit was triggered by a system rule (trailing stop, target, or risk signal)`,
      failMessage:
        trade.exitTrigger === 'MANUAL_EARLY'
          ? `❌ Exit was premature (panic sell before any rule triggered). Let the system manage the trade.`
          : `❌ Exit was delayed past an exit signal (holding in hope). This converts manageable losses into large ones.`,
    },
  ];

  const passedChecks = checks.filter((c) => c.passed).map((c) => c.passMessage);
  const failedChecks = checks.filter((c) => !c.passed).map((c) => c.failMessage);
  const qualityScore = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);

  // Grade
  let grade: TradeQualityReport['grade'];
  if (qualityScore >= 85) grade = 'A';
  else if (qualityScore >= 65) grade = 'B';
  else if (qualityScore >= 45) grade = 'C';
  else grade = 'F';

  // Label
  let label: TradeQualityReport['label'];
  let labelDescription: string;
  if (qualityScore >= 85) {
    label = 'GOOD_TRADE';
    labelDescription = '🏛️ GOOD TRADE — Executed with full institutional discipline. Win or loss, this is the correct process.';
  } else if (qualityScore >= 65) {
    label = 'ACCEPTABLE';
    labelDescription = '📊 ACCEPTABLE — Minor deviations from the plan. Review failed checks to tighten process.';
  } else if (qualityScore >= 45) {
    label = 'RULE_BREAK';
    labelDescription = '⚠️ RULE BREAK — Significant process violations. These habits compound into account damage over time.';
  } else {
    label = 'BAD_TRADE';
    labelDescription = '🚨 BAD TRADE — Multiple critical rule violations. Profitable outcomes from bad trades are the most dangerous because they reinforce wrong behaviour.';
  }

  const wasWin = trade.realizedPnL > 0;

  // Key insight: highlight the paradox of profitable bad trades
  let keyInsight: string;
  if (!wasWin && label === 'GOOD_TRADE') {
    keyInsight = `✅ This was a losing trade — but it was executed correctly. A good trade that loses is exactly what institutional risk management looks like. The process was right; this is simply probability playing out.`;
  } else if (wasWin && label === 'BAD_TRADE') {
    keyInsight = `⚠️ This trade was profitable — but it broke critical rules. A bad trade that wins is the most dangerous outcome: it reinforces rule-breaking and will eventually cause large losses.`;
  } else if (!wasWin && label === 'BAD_TRADE') {
    keyInsight = `🚨 This was a losing bad trade — double damage. Not only did the account lose money, but the process violations mean there was no edge to begin with.`;
  } else if (wasWin && label === 'GOOD_TRADE') {
    keyInsight = `✅ Winning trade with institutional-grade execution. This is the target: positive expectancy through disciplined process, not high conviction.`;
  } else {
    keyInsight = `📊 Review failed checks to improve process discipline over time.`;
  }

  return {
    tradeId: trade.id,
    qualityScore,
    grade,
    label,
    labelDescription,
    passedChecks,
    failedChecks,
    wasWin,
    keyInsight,
  };
}

/**
 * Batch-scores a list of closed trades and returns a portfolio-level summary.
 */
export function batchScoreTradeQuality(trades: TradeForQualityCheck[]): {
  reports: TradeQualityReport[];
  avgQualityScore: number;
  goodTradeCount: number;
  badTradeCount: number;
  ruleBreakCount: number;
  profitableButBadCount: number;
  portfolioGrade: 'A' | 'B' | 'C' | 'F';
  summary: string;
} {
  if (trades.length === 0) {
    return {
      reports: [],
      avgQualityScore: 0,
      goodTradeCount: 0,
      badTradeCount: 0,
      ruleBreakCount: 0,
      profitableButBadCount: 0,
      portfolioGrade: 'F',
      summary: 'No trades to evaluate.',
    };
  }

  const reports = trades.map(scoreTradeQuality);
  const avgQualityScore = Number(
    (reports.reduce((sum, r) => sum + r.qualityScore, 0) / reports.length).toFixed(1)
  );

  const goodTradeCount = reports.filter((r) => r.label === 'GOOD_TRADE').length;
  const badTradeCount = reports.filter((r) => r.label === 'BAD_TRADE').length;
  const ruleBreakCount = reports.filter((r) => r.label === 'RULE_BREAK').length;
  const profitableButBadCount = reports.filter((r) => r.wasWin && r.label === 'BAD_TRADE').length;

  let portfolioGrade: 'A' | 'B' | 'C' | 'F';
  if (avgQualityScore >= 85) portfolioGrade = 'A';
  else if (avgQualityScore >= 65) portfolioGrade = 'B';
  else if (avgQualityScore >= 45) portfolioGrade = 'C';
  else portfolioGrade = 'F';

  const summary =
    `Portfolio Quality: Grade ${portfolioGrade} (Avg Score: ${avgQualityScore}/100) | ` +
    `Good: ${goodTradeCount} | Rule Breaks: ${ruleBreakCount} | Bad: ${badTradeCount}` +
    (profitableButBadCount > 0
      ? ` | ⚠️ ${profitableButBadCount} profitable-but-bad trade(s) detected — review urgently`
      : '');

  return {
    reports,
    avgQualityScore,
    goodTradeCount,
    badTradeCount,
    ruleBreakCount,
    profitableButBadCount,
    portfolioGrade,
    summary,
  };
}
