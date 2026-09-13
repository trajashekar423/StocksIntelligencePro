import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDailyProfitPlan,
  getDailyProfitPresetOptions
} from './dailyProfitPlannerEngine.ts';

describe('🎯 Daily Profit Planner & Position Sizing Engine', () => {
  it('calculates correct quantity and 5x margin for ₹1,000 target on ₹500 stock with 1.5% move', () => {
    const res = calculateDailyProfitPlan({
      targetProfit: 1000,
      stockPrice: 500,
      expectedMovePct: 1.5,
      leverageMultiplier: 5,
      tradesPerDay: 1,
      riskRewardRatio: 2
    });

    // 1.5% of ₹500 is ₹7.50 move per share
    assert.equal(res.stockPrice, 500);
    assert.equal(res.targetPrice, 507.5);
    assert.equal(res.requiredMovePerShare, 7.5);
    // Quantity = 1000 / 7.5 = 133.33 → Math.ceil = 134 shares
    assert.equal(res.quantityPerTrade, 134);
    assert.equal(res.requiredQuantityTotal, 134);
    // Total capital = 134 * 500 = ₹67,000
    assert.equal(res.totalCapitalRequired, 67000);
    // 5x Intraday margin = 67000 / 5 = ₹13,400
    assert.equal(res.marginRequired5x, 13400);
    // SL with R:R 1:2 → risk per share = 7.5 / 2 = 3.75 → SL = 496.25
    assert.equal(res.stopLossPrice, 496.25);
    assert.equal(res.riskPerShare, 3.75);
    assert.equal(res.riskRewardRatio, 2);
    // Max loss = 134 * 3.75 = ₹502.50
    assert.equal(res.maxLossTotal, 502.5);
    assert.equal(res.feasibilityRating, 'REALISTIC');
  });

  it('calculates correct metrics for ₹10,000 daily target split across 2 trades', () => {
    const res = calculateDailyProfitPlan({
      targetProfit: 10000,
      stockPrice: 1000,
      expectedMovePct: 2.0,
      leverageMultiplier: 5,
      tradesPerDay: 2,
      riskRewardRatio: 2
    });

    assert.equal(res.targetProfitTotal, 10000);
    assert.equal(res.targetProfitPerTrade, 5000);
    // 2% move on ₹1000 = ₹20 per share
    assert.equal(res.requiredMovePerShare, 20);
    // Quantity per trade = 5000 / 20 = 250 shares
    assert.equal(res.quantityPerTrade, 250);
    assert.equal(res.requiredQuantityTotal, 500);
    // Margin per trade = (250 * 1000) / 5 = ₹50,000
    assert.equal(res.marginPerTrade5x, 50000);
    assert.equal(res.tradeBreakdown.length, 2);
    assert.equal(res.tradeBreakdown[0].targetProfitThisTrade, 5000);
    assert.equal(res.tradeBreakdown[0].quantity, 250);
    assert.equal(res.feasibilityRating, 'REALISTIC');
  });

  it('handles custom target and stop loss price inputs', () => {
    const res = calculateDailyProfitPlan({
      targetProfit: 3000,
      stockPrice: 200,
      targetPrice: 206, // ₹6 move (+3%)
      stopLossPrice: 197, // ₹3 risk
      leverageMultiplier: 5,
      tradesPerDay: 1
    });

    assert.equal(res.requiredMovePerShare, 6);
    assert.equal(res.requiredMovePct, 3);
    assert.equal(res.riskPerShare, 3);
    assert.equal(res.riskRewardRatio, 2);
    // Quantity = 3000 / 6 = 500 shares
    assert.equal(res.quantityPerTrade, 500);
    // Margin = (500 * 200) / 5 = ₹20,000
    assert.equal(res.marginRequired5x, 20000);
    assert.equal(res.feasibilityRating, 'MODERATE');
  });

  it('generates preset options for ₹1k, ₹2.5k, ₹5k, ₹10k', () => {
    const presets = getDailyProfitPresetOptions(400);
    assert.equal(presets.length, 4);
    assert.equal(presets[0].targetProfitTotal, 1000);
    assert.equal(presets[1].targetProfitTotal, 2500);
    assert.equal(presets[2].targetProfitTotal, 5000);
    assert.equal(presets[3].targetProfitTotal, 10000);

    // Higher target → higher required quantity and margin
    assert.ok(presets[3].requiredQuantityTotal > presets[0].requiredQuantityTotal);
    assert.ok(presets[3].marginRequired5x > presets[0].marginRequired5x);
  });
});

