import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluateScalpStock, runScalpingScanner } from './scalpingEngine.ts';

describe('⚡ Lightning Scalper Engine (1-Min / 3-Min Micro Momentum)', () => {
  it('correctly scores a high-conviction micro-momentum scalp setup', () => {
    const res = evaluateScalpStock({
      symbol: 'SWIGGY',
      companyName: 'Swiggy Limited',
      price: 450.0,
      vwap: 448.5, // +0.33% ideal proximity
      open: 446.0,
      high: 451.0,
      low: 445.0,
      volume: 150000,
      avgVolume: 1000000,
      ema9: 449.2,
      ema20: 447.8,
      rsi: 65,
      buyerDemandPct: 82,
      atr5: 2.1,
    });

    assert.ok(res.scalpScore >= 80, `Expected score >= 80, got ${res.scalpScore}`);
    assert.strictEqual(res.signal, 'STRONG_SCALP_BUY');
    assert.strictEqual(res.canScalp, true);
    assert.ok(res.stopLoss < 450.0);
    assert.ok(res.target1 > 450.0);
    assert.ok(res.riskRewardRatio >= 1.8);
  });

  it('rejects scalping when price is below VWAP', () => {
    const res = evaluateScalpStock({
      symbol: 'TATAMOTORS',
      price: 980.0,
      vwap: 985.0, // Below VWAP
      open: 984.0,
      high: 986.0,
      low: 978.0,
      volume: 80000,
      avgVolume: 1000000,
      buyerDemandPct: 40,
    });

    assert.strictEqual(res.canScalp, false);
    assert.notStrictEqual(res.signal, 'STRONG_SCALP_BUY');
    assert.ok(res.warnings.some((w) => w.includes('Below VWAP')));
  });

  it('warns when price is overextended (> 0.8% above VWAP)', () => {
    const res = evaluateScalpStock({
      symbol: 'RELIANCE',
      price: 3050.0,
      vwap: 3010.0, // +1.3% above VWAP
      open: 3015.0,
      high: 3055.0,
      low: 3008.0,
      volume: 300000,
      avgVolume: 2000000,
      buyerDemandPct: 78,
    });

    assert.ok(res.warnings.some((w) => w.includes('Overextended above VWAP')));
  });

  it('runs scalping scanner and ranks setups descending by scalpScore', () => {
    const list = runScalpingScanner([
      {
        symbol: 'WEAK',
        price: 100,
        vwap: 105,
        open: 104,
        high: 105,
        low: 99,
        volume: 1000,
        avgVolume: 100000,
        buyerDemandPct: 30,
      },
      {
        symbol: 'STRONG',
        price: 200,
        vwap: 199.2,
        open: 198,
        high: 201,
        low: 197,
        volume: 50000,
        avgVolume: 200000,
        buyerDemandPct: 85,
        rsi: 66,
      },
    ]);

    assert.ok(list.length >= 1);
    assert.strictEqual(list[0].symbol, 'STRONG');
    assert.ok(list[0].scalpScore >= 75);
  });
});
