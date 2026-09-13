import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calculateExpectancy } from '../../services/risk/tradeExpectancyEngine.ts';
import { scoreTradeQuality, batchScoreTradeQuality } from '../../services/risk/tradeQualityEngine.ts';
import { calculateDrawdownRecovery } from './positionSizer.ts';
import { validatePreTrade } from './riskManager.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 1. TRADE EXPECTANCY ENGINE TESTS
// ─────────────────────────────────────────────────────────────────────────────

test('calculateExpectancy: positive expectancy with low win rate (institutional model)', () => {
  // 35% win rate but 3:1 R:R — should have strong positive expectancy
  const trades = [
    // 7 wins at ₹600 each
    ...Array.from({ length: 7 }, (_, i) => ({ id: `w${i}`, realizedPnL: 600, riskAmount: 200 })),
    // 13 losses at ₹200 each
    ...Array.from({ length: 13 }, (_, i) => ({ id: `l${i}`, realizedPnL: -200, riskAmount: 200 })),
  ];

  const report = calculateExpectancy(trades);

  assert.equal(report.totalTrades, 20);
  assert.equal(report.winCount, 7);
  assert.equal(report.lossCount, 13);
  assert.equal(report.winRatePct, 35);
  assert.equal(report.avgWin, 600);
  assert.equal(report.avgLoss, 200);
  // E = (0.35 × 600) − (0.65 × 200) = 210 − 130 = 80
  assert.equal(report.expectancyPerTrade, 80);
  assert.ok(report.profitFactor > 1.5, `Expected profit factor > 1.5, got ${report.profitFactor}`);
  assert.ok(report.totalPnL > 0, 'Total PnL should be positive');
  assert.ok(['INSTITUTIONAL', 'DEVELOPING'].includes(report.grade));
});

test('calculateExpectancy: high win rate with negative expectancy (retail trap)', () => {
  // 80% win rate but tiny wins, huge losses
  const trades = [
    // 16 wins at ₹50 each
    ...Array.from({ length: 16 }, (_, i) => ({ id: `w${i}`, realizedPnL: 50, riskAmount: 300 })),
    // 4 losses at ₹500 each
    ...Array.from({ length: 4 }, (_, i) => ({ id: `l${i}`, realizedPnL: -500, riskAmount: 300 })),
  ];

  const report = calculateExpectancy(trades);

  assert.equal(report.winRatePct, 80);
  // E = (0.80 × 50) − (0.20 × 500) = 40 − 100 = -60
  assert.equal(report.expectancyPerTrade, -60);
  assert.ok(report.profitFactor < 1.0, 'Profit factor should be < 1 (losing system)');
  assert.equal(report.grade, 'RETAIL_BEHAVIOR');
  assert.ok(report.riskOfRuinPct > 50, 'Risk of ruin should be high for a losing system');
});

test('calculateExpectancy: insufficient data returns INSUFFICIENT_DATA grade', () => {
  const trades = [
    { id: 't1', realizedPnL: 300, riskAmount: 100 },
    { id: 't2', realizedPnL: -100, riskAmount: 100 },
  ];
  const report = calculateExpectancy(trades);
  assert.equal(report.grade, 'INSUFFICIENT_DATA');
});

test('calculateExpectancy: empty trades array returns zero report', () => {
  const report = calculateExpectancy([]);
  assert.equal(report.totalTrades, 0);
  assert.equal(report.grade, 'INSUFFICIENT_DATA');
});

test('calculateExpectancy: computes max consecutive losses correctly', () => {
  const trades = [
    { id: 'w1', realizedPnL: 400, riskAmount: 100 },
    { id: 'l1', realizedPnL: -100, riskAmount: 100 },
    { id: 'l2', realizedPnL: -100, riskAmount: 100 },
    { id: 'l3', realizedPnL: -100, riskAmount: 100 },
    { id: 'l4', realizedPnL: -100, riskAmount: 100 }, // 4 consecutive
    { id: 'w2', realizedPnL: 400, riskAmount: 100 },
    { id: 'l5', realizedPnL: -100, riskAmount: 100 }, // streak reset to 1
    { id: 'w3', realizedPnL: 400, riskAmount: 100 },
    { id: 'w4', realizedPnL: 400, riskAmount: 100 },
    { id: 'w5', realizedPnL: 400, riskAmount: 100 },
    { id: 'w6', realizedPnL: 400, riskAmount: 100 },
    { id: 'w7', realizedPnL: 400, riskAmount: 100 },
  ];
  const report = calculateExpectancy(trades);
  assert.equal(report.maxConsecutiveLosses, 4);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. DRAWDOWN RECOVERY CALCULATOR TESTS
// ─────────────────────────────────────────────────────────────────────────────

test('calculateDrawdownRecovery: 10% drawdown needs 11.11% to recover (MANAGEABLE)', () => {
  const result = calculateDrawdownRecovery(10, 100000);
  assert.equal(result.drawdownPct, 10);
  assert.equal(result.recoveryRequiredPct, 11.11);
  assert.equal(result.capitalRemaining, 90000);
  assert.equal(result.riskLevel, 'MANAGEABLE');
});

test('calculateDrawdownRecovery: 50% drawdown needs 100% to recover (CRITICAL)', () => {
  const result = calculateDrawdownRecovery(50, 100000);
  assert.equal(result.drawdownPct, 50);
  assert.equal(result.recoveryRequiredPct, 100);
  assert.equal(result.capitalRemaining, 50000);
  assert.equal(result.riskLevel, 'CRITICAL');
});

test('calculateDrawdownRecovery: 25% drawdown is SEVERE', () => {
  const result = calculateDrawdownRecovery(25, 100000);
  assert.equal(result.riskLevel, 'SEVERE');
  assert.ok(result.recoveryRequiredPct > 25, 'Recovery must be greater than the drawdown');
});

test('calculateDrawdownRecovery: estimates trades to recover when expectancy is given', () => {
  // 20% drawdown on ₹100,000 = ₹20,000 lost. At ₹200 expectancy/trade → 100 trades
  const result = calculateDrawdownRecovery(20, 100000, 200);
  assert.equal(result.tradesToRecover, 100);
});

test('calculateDrawdownRecovery: tradesToRecover is null when expectancy not provided', () => {
  const result = calculateDrawdownRecovery(20, 100000, null);
  assert.equal(result.tradesToRecover, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. TRADE QUALITY ENGINE TESTS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_TRADE = {
  id: 'trade_001',
  realizedPnL: 500,
  entryPrice: 200,
  stopLossAtEntry: 196,  // 2% stop → risk = ₹4/share
  targetAtEntry: 210,    // 5% target → R:R = 2.5:1
  capitalAtEntry: 50000,
  riskAmount: 400,       // 100 shares × ₹4 risk/share = ₹400 (0.8% of capital)
  maxRiskPerTradePct: 1.0,
  positionValue: 20000,
  maxPositionValue: 25000,
  bullishScoreAtEntry: 85,
  minBullishScore: 80,
  wasStopLossWidened: false,
  exitTrigger: 'SYSTEM' as const,
  side: 'LONG' as const,
};

test('scoreTradeQuality: perfect execution receives grade A and GOOD_TRADE label', () => {
  const report = scoreTradeQuality(BASE_TRADE);
  assert.ok(report.qualityScore >= 85, `Expected score ≥ 85, got ${report.qualityScore}`);
  assert.equal(report.grade, 'A');
  assert.equal(report.label, 'GOOD_TRADE');
  assert.equal(report.wasWin, true);
  assert.ok(report.failedChecks.length === 0, 'Should have no failed checks');
});

test('scoreTradeQuality: oversized risk and widened stop gives grade F and BAD_TRADE', () => {
  const badTrade = {
    ...BASE_TRADE,
    id: 'bad_trade_001',
    riskAmount: 3000,        // 6% risk — way over 1% cap
    wasStopLossWidened: true, // Moved stop to avoid loss
    exitTrigger: 'MANUAL_LATE' as const, // Held past exit signal
    bullishScoreAtEntry: 60,  // Below min signal threshold
  };
  const report = scoreTradeQuality(badTrade);
  assert.ok(report.qualityScore < 45, `Expected score < 45, got ${report.qualityScore}`);
  assert.equal(report.grade, 'F');
  assert.equal(report.label, 'BAD_TRADE');
  assert.ok(report.failedChecks.length >= 3, 'Should have multiple failed checks');
});

test('scoreTradeQuality: losing trade with perfect process is still GOOD_TRADE', () => {
  const losingGoodTrade = {
    ...BASE_TRADE,
    id: 'losing_good_001',
    realizedPnL: -400, // Loss — stop was hit
  };
  const report = scoreTradeQuality(losingGoodTrade);
  assert.equal(report.wasWin, false);
  assert.equal(report.label, 'GOOD_TRADE');
  assert.ok(report.keyInsight.includes('losing trade') && report.keyInsight.includes('correctly'),
    'Key insight should explain that a losing-but-correct trade is good process');
});

test('scoreTradeQuality: profitable trade with rule breaks is flagged correctly', () => {
  const profitableButBad = {
    ...BASE_TRADE,
    id: 'profitable_bad_001',
    realizedPnL: 800, // Won!
    wasStopLossWidened: true, // Broke rules
    exitTrigger: 'MANUAL_LATE' as const,
    riskAmount: 2500, // Over-risked (5% of ₹50k capital — well above 1% cap)
  };
  const report = scoreTradeQuality(profitableButBad);
  assert.equal(report.wasWin, true);
  assert.ok(
    ['RULE_BREAK', 'BAD_TRADE'].includes(report.label),
    `Expected RULE_BREAK or BAD_TRADE, got ${report.label}`
  );
  assert.ok(report.failedChecks.length >= 2, 'Should have multiple failed checks');
  assert.ok(report.qualityScore < 85, 'Score should not be A-grade when rules are broken');
});

test('batchScoreTradeQuality: summarises portfolio-level quality across multiple trades', () => {
  const trades = [
    BASE_TRADE,
    { ...BASE_TRADE, id: 't2', wasStopLossWidened: true, exitTrigger: 'MANUAL_LATE' as const, riskAmount: 2000 },
    { ...BASE_TRADE, id: 't3', realizedPnL: -400 }, // losing but good
  ];
  const result = batchScoreTradeQuality(trades);
  assert.equal(result.reports.length, 3);
  assert.ok(result.goodTradeCount >= 1);
  assert.ok(result.avgQualityScore > 0);
  assert.ok(['A', 'B', 'C', 'F'].includes(result.portfolioGrade));
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CONVICTION OVERSIZE GUARD TESTS
// ─────────────────────────────────────────────────────────────────────────────

const BASE_CONFIG = {
  mode: 'PAPER' as const,
  enabled: true,
  capital: 50000,
  riskPerTradePct: 1.0,  // Base: 1% per trade
  maxPositionValue: 25000,
  maxTradesPerDay: 10,
  maxDailyLoss: 2000,
  maxOpenPositions: 3,
  minBullishScore: 80,
  minRsi: 45,
  maxRsi: 75,
  minVolume: 50000,
  minVolumeRatio: 1.2,
  minBreakoutPercent: 0.5,
  stopLossPct: 1.5,
  targetPct: 3.0,
  trailingStopTriggerPct: 1.0,
  trailingStopDistancePct: 1.0,
  useAtrStop: false,
};

test('validatePreTrade: allows trade at exactly 1.5× cap (institutional limit)', () => {
  // requestedRiskPerTradePct = 1.5% = exactly 1.5× the base 1.0%
  const check = validatePreTrade({
    symbol: 'TATASTEEL',
    entryPrice: 180,
    stopLoss: 177.3,
    target: 185.4,
    quantity: 50,
    config: BASE_CONFIG,
    requestedRiskPerTradePct: 1.5, // At the cap — should be allowed
  });
  assert.equal(check.allowed, true);
});

test('validatePreTrade: blocks trade when conviction causes oversizing beyond 1.5× cap', () => {
  // requestedRiskPerTradePct = 3.0% — "I'm 100% sure this will win"
  const check = validatePreTrade({
    symbol: 'RELIANCE',
    entryPrice: 2900,
    stopLoss: 2840,
    target: 3000,
    quantity: 5,
    config: BASE_CONFIG,
    bullishScore: 97, // Very high conviction
    requestedRiskPerTradePct: 3.0, // 3× the base cap — blocked
  });
  assert.equal(check.allowed, false);
  assert.equal(check.code, 'CONVICTION_OVERSIZE_BLOCKED');
  assert.ok(check.reason?.includes('97/100'), 'Reason should mention the conviction score');
  assert.ok(check.reason?.includes('psychological feeling'), 'Reason should mention the psychological trap');
});

test('validatePreTrade: without requestedRiskPerTradePct, uses config default (always passes conviction check)', () => {
  // When no override is requested, the default config.riskPerTradePct is used and is always ≤ 1.5× itself
  const check = validatePreTrade({
    symbol: 'INFY',
    entryPrice: 1800,
    stopLoss: 1773,
    target: 1854,
    quantity: 10,
    config: BASE_CONFIG,
    bullishScore: 99,
    // requestedRiskPerTradePct NOT set → falls back to config.riskPerTradePct (1.0%)
  });
  // Should not be blocked by conviction guard (may still fail other checks)
  assert.notEqual(check.code, 'CONVICTION_OVERSIZE_BLOCKED');
});
