import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePositionalStock,
  runPositionalSwingScan,
  type RawPositionalCandidate,
} from './positionalSwingEngine.ts';

describe('📅 3-to-4 Week Positional Business Swing Engine Suite', () => {
  it('1. Correctly scores a high-conviction Stage-2 positional setup', () => {
    const mockStock: RawPositionalCandidate = {
      symbol: 'MONQ50',
      companyName: 'Monq50 Limited',
      price: 230.0,
      open: 224.0,
      previousClose: 222.0,
      volume: 4500000,
      relativeVolume: 2.2,
      vwap: 226.5,
      ema20: 224.0,
      ema50: 212.0,
      rsi: 65,
      atr: 6.5,
      sector: 'CAPITAL GOODS',
      quarterlyProfitGrowthPct: 24,
      rocePct: 21,
    };

    const evaluated = evaluatePositionalStock(mockStock);

    assert.ok(evaluated.swingScore >= 80, `Expected score >= 80, got ${evaluated.swingScore}`);
    assert.strictEqual(evaluated.signal, 'HIGH_CONVICTION_SWING');
    assert.strictEqual(evaluated.stage2TrendScore, 100);
    assert.ok(evaluated.target1 > evaluated.price, 'Target 1 should be higher than price');
    assert.ok(evaluated.target2 > evaluated.target1, 'Target 2 (3-4 wk expansion) should be higher than Target 1');
    assert.ok(evaluated.target2GainPct >= 15.0, `Expected T2 gain >= 15%, got ${evaluated.target2GainPct}%`);
    assert.ok(evaluated.partialLockAdvice.includes('Book 50% Qty'));
  });

  it('2. Correctly calculates Target 1 (+4.5% 50% lock) and Target 2 (+18% positional hold)', () => {
    const stock: RawPositionalCandidate = {
      symbol: 'RAYMOND',
      companyName: 'Raymond Limited',
      price: 2400.0,
      open: 2350.0,
      previousClose: 2340.0,
      volume: 2500000,
      relativeVolume: 1.8,
      vwap: 2375.0,
      ema20: 2360.0,
      ema50: 2250.0,
      rsi: 64,
      atr: 55.0,
    };

    const res = evaluatePositionalStock(stock);

    assert.strictEqual(res.recommendedEntry, 2400);
    assert.ok(res.target1 >= 2500, `Expected Target 1 >= 2500, got ${res.target1}`);
    assert.ok(res.target2 >= 2700, `Expected Target 2 >= 2700, got ${res.target2}`);
    assert.ok(res.stopLoss < res.recommendedEntry, 'Stop Loss must be below entry price');
  });

  it('3. Ranks candidates descending by Positional Swing Score', () => {
    const pool: RawPositionalCandidate[] = [
      {
        symbol: 'WEAK_STOCK',
        price: 150.0,
        previousClose: 155.0,
        volume: 200000,
        relativeVolume: 0.7,
        ema20: 158.0, // Below 20-EMA!
        ema50: 165.0,
        rsi: 42,
      },
      {
        symbol: 'STRONG_SWING',
        price: 500.0,
        previousClose: 480.0,
        volume: 3500000,
        relativeVolume: 2.1,
        ema20: 485.0, // Above 20-EMA!
        ema50: 450.0,
        rsi: 66,
      },
    ];

    const scanResult = runPositionalSwingScan(pool);

    assert.strictEqual(scanResult.topSetups.length, 1);
    assert.strictEqual(scanResult.topSetups[0].symbol, 'STRONG_SWING');
    assert.ok(scanResult.allCandidates[0].swingScore > scanResult.allCandidates[1].swingScore);
  });
});
