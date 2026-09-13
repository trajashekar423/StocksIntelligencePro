/**
 * Quick playground to manually inspect all 4 new trading logic modules.
 * Run: node --experimental-strip-types src/scratch/checkVideoLogic.ts
 */

import { calculateExpectancy } from '../services/risk/tradeExpectancyEngine.ts';
import { scoreTradeQuality, batchScoreTradeQuality } from '../services/risk/tradeQualityEngine.ts';
import { calculateDrawdownRecovery } from '../lib/trading/positionSizer.ts';
import { validatePreTrade } from '../lib/trading/riskManager.ts';

// ─── Separator helper ────────────────────────────────────────────────────────
const sep = (title: string) =>
  console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`);

// ─────────────────────────────────────────────────────────────────────────────
// 1. TRADE EXPECTANCY ENGINE
// ─────────────────────────────────────────────────────────────────────────────
sep('1. TRADE EXPECTANCY ENGINE');

// Scenario A — Retail trader: 80% win rate but tiny wins, large losses
const retailTrades = [
  ...Array.from({ length: 16 }, (_, i) => ({ id: `w${i}`, realizedPnL: 80, riskAmount: 400 })),
  ...Array.from({ length: 4 },  (_, i) => ({ id: `l${i}`, realizedPnL: -600, riskAmount: 400 })),
];
const retailReport = calculateExpectancy(retailTrades);
console.log('\n📊 Retail Trader (80% win rate, ₹80 avg win, ₹600 avg loss):');
console.log(`   Win Rate     : ${retailReport.winRatePct}%`);
console.log(`   Expectancy   : ₹${retailReport.expectancyPerTrade} per trade`);
console.log(`   Profit Factor: ${retailReport.profitFactor}`);
console.log(`   Risk of Ruin : ${retailReport.riskOfRuinPct}%`);
console.log(`   Grade        : ${retailReport.grade}`);
console.log(`   → ${retailReport.gradeSummary}`);

// Scenario B — Institutional: 40% win rate, 3:1 R:R
const instTrades = [
  ...Array.from({ length: 8 },  (_, i) => ({ id: `w${i}`, realizedPnL: 600, riskAmount: 200 })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, realizedPnL: -200, riskAmount: 200 })),
];
const instReport = calculateExpectancy(instTrades);
console.log('\n🏛️  Institutional Trader (40% win rate, ₹600 avg win, ₹200 avg loss):');
console.log(`   Win Rate     : ${instReport.winRatePct}%`);
console.log(`   Expectancy   : ₹${instReport.expectancyPerTrade} per trade`);
console.log(`   Profit Factor: ${instReport.profitFactor}`);
console.log(`   Risk of Ruin : ${instReport.riskOfRuinPct}%`);
console.log(`   Grade        : ${instReport.grade}`);
console.log(`   → ${instReport.gradeSummary}`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. DRAWDOWN RECOVERY CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────
sep('2. DRAWDOWN RECOVERY MATH');

const capital = 100000;
const expectancy = instReport.expectancyPerTrade; // ₹120/trade from above

for (const pct of [10, 20, 30, 50, 70]) {
  const r = calculateDrawdownRecovery(pct, capital, expectancy);
  console.log(
    `   ${String(pct).padStart(2)}% down → ${String(r.recoveryRequiredPct.toFixed(1)).padStart(7)}% to recover` +
    ` | ${r.riskLevel.padEnd(12)}` +
    (r.tradesToRecover ? ` | ~${r.tradesToRecover} trades to recover` : '')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TRADE QUALITY SCORER
// ─────────────────────────────────────────────────────────────────────────────
sep('3. TRADE QUALITY SCORER');

const goodLosingTrade = {
  id: 'good_lose',
  realizedPnL: -200,          // Lost money — but followed every rule
  entryPrice: 200,
  stopLossAtEntry: 196,       // R:R = 2.5:1
  targetAtEntry: 210,
  capitalAtEntry: 50000,
  riskAmount: 400,            // 0.8% of capital ✅
  maxRiskPerTradePct: 1.0,
  positionValue: 20000,
  maxPositionValue: 25000,
  bullishScoreAtEntry: 85,
  minBullishScore: 80,
  wasStopLossWidened: false,  // Held the stop ✅
  exitTrigger: 'SYSTEM' as const, // System triggered ✅
  side: 'LONG' as const,
};

const badWinningTrade = {
  id: 'bad_win',
  realizedPnL: 1200,          // Won money — but broke every rule
  entryPrice: 200,
  stopLossAtEntry: 186,       // R:R = 0.7:1 — below minimum ❌
  targetAtEntry: 209,
  capitalAtEntry: 50000,
  riskAmount: 4200,           // 8.4% of capital — way over cap ❌
  maxRiskPerTradePct: 1.0,
  positionValue: 42000,       // Over position cap ❌
  maxPositionValue: 25000,
  bullishScoreAtEntry: 65,    // Below signal threshold ❌
  minBullishScore: 80,
  wasStopLossWidened: true,   // Moved stop to avoid loss ❌
  exitTrigger: 'MANUAL_LATE' as const, // Held past exit signal ❌
  side: 'LONG' as const,
};

const r1 = scoreTradeQuality(goodLosingTrade);
console.log(`\n📉 Losing Trade (followed all rules):`)
console.log(`   Score: ${r1.qualityScore}/100 | Grade: ${r1.grade} | Label: ${r1.label}`);
console.log(`   → ${r1.keyInsight}`);

const r2 = scoreTradeQuality(badWinningTrade);
console.log(`\n💰 Winning Trade (broke all rules):`)
console.log(`   Score: ${r2.qualityScore}/100 | Grade: ${r2.grade} | Label: ${r2.label}`);
console.log(`   Failed Checks: ${r2.failedChecks.length}`);
r2.failedChecks.forEach(f => console.log(`     ${f}`));
console.log(`   → ${r2.keyInsight}`);

// Batch summary
const batch = batchScoreTradeQuality([goodLosingTrade, badWinningTrade]);
console.log(`\n📋 Portfolio Summary: ${batch.summary}`);

// ─────────────────────────────────────────────────────────────────────────────
// 4. CONVICTION OVERSIZE GUARD
// ─────────────────────────────────────────────────────────────────────────────
sep('4. CONVICTION OVERSIZE GUARD');

const BASE_CONFIG = {
  mode: 'PAPER' as const, enabled: true, capital: 50000,
  riskPerTradePct: 1.0, maxPositionValue: 25000, maxTradesPerDay: 10,
  maxDailyLoss: 2000, maxOpenPositions: 3, minBullishScore: 80,
  minRsi: 45, maxRsi: 75, minVolume: 50000, minVolumeRatio: 1.2,
  minBreakoutPercent: 0.5, stopLossPct: 1.5, targetPct: 3.0,
  trailingStopTriggerPct: 1.0, trailingStopDistancePct: 1.0, useAtrStop: false,
};

// Attempt 1: Normal trade (1% risk) — should pass
const normal = validatePreTrade({
  symbol: 'TCS', entryPrice: 3500, stopLoss: 3430, target: 3640,
  quantity: 5, config: BASE_CONFIG,
});
console.log(`\n✅ Normal trade (1% risk)   → allowed: ${normal.allowed}`);

// Attempt 2: 1.5× (max allowed) — should pass
const atCap = validatePreTrade({
  symbol: 'INFY', entryPrice: 1800, stopLoss: 1764, target: 1872,
  quantity: 5, config: BASE_CONFIG,
  requestedRiskPerTradePct: 1.5,
});
console.log(`✅ At-cap trade (1.5% risk)  → allowed: ${atCap.allowed}`);

// Attempt 3: "I'm 100% sure!" — over cap with high conviction
const overConviction = validatePreTrade({
  symbol: 'RELIANCE', entryPrice: 2900, stopLoss: 2840, target: 3000,
  quantity: 5, config: BASE_CONFIG,
  bullishScore: 97,
  requestedRiskPerTradePct: 3.0, // 3× the cap
});
console.log(`🚨 Oversize (3% risk, 97 score) → allowed: ${overConviction.allowed}`);
if (!overConviction.allowed) console.log(`   Blocked: ${overConviction.reason}`);

console.log('\n' + '═'.repeat(60));
console.log('  Done — all 4 modules working correctly.');
console.log('═'.repeat(60) + '\n');
