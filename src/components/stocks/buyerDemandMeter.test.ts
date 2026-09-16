import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBuyerDemandPct } from './BuyerDemandMeter.jsx';

describe('📊 Buyer Demand Meter Algorithm', () => {
  it('calculates exact buyer percentage when order depth buy/sell quantity is present', () => {
    const stock = { totalBuyQty: 80000, totalSellQty: 20000 };
    assert.strictEqual(calculateBuyerDemandPct(stock), 80);
  });

  it('returns 100% when locked in upper circuit', () => {
    const stock = { isUpperCircuit: true };
    assert.strictEqual(calculateBuyerDemandPct(stock), 100);
  });

  it('calculates realistic buyer demand from changePercent / pChange', () => {
    // Active Gainer (+6.81%) -> ~84%
    assert.ok(calculateBuyerDemandPct({ changePercent: 6.81 }) >= 80);
    // Moderate Gainer (+3.33%) -> ~73%
    assert.ok(calculateBuyerDemandPct({ pChange: 3.33 }) >= 70);
    // Slight Gainer (+1.38%) -> ~61%
    assert.ok(calculateBuyerDemandPct({ perChange: 1.38 }) >= 58);
    // Negative Stock (-2.94%) -> ~32%
    assert.ok(calculateBuyerDemandPct({ changePercent: -2.94 }) <= 40);
  });

  it('computes changePercent dynamically from price vs previousClose when changePercent is missing', () => {
    const stock = { price: 368.5, previousClose: 345.0 }; // +6.81%
    const demandPct = calculateBuyerDemandPct(stock);
    assert.ok(demandPct >= 80, `Expected >= 80, got ${demandPct}`);
  });

  it('computes demand from VWAP and signal bias when price change is 0', () => {
    const longAboveVwap = { price: 1000, vwap: 990, signal: 'LONG' };
    assert.ok(calculateBuyerDemandPct(longAboveVwap) >= 60);

    const shortBelowVwap = { price: 1000, vwap: 1010, signal: 'SHORT' };
    assert.ok(calculateBuyerDemandPct(shortBelowVwap) <= 45);
  });
});

