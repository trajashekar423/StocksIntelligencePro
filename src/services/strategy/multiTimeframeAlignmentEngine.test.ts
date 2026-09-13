import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateMultiTimeframeAlignment,
  runMultiTimeframeScan,
  classifyTimeframeTrend,
  type MultiTimeframeInput,
} from './multiTimeframeAlignmentEngine.ts';

describe('🚥 Multi-Timeframe 4-Light Alignment Radar Engine Suite', () => {
  it('1. Calculates 100/100 Perfect 4/4 All Green Alignment correctly', () => {
    const input: MultiTimeframeInput = {
      symbol: 'RAYMOND',
      companyName: 'Raymond Limited',
      currentPrice: 2480.0,
      vwap: 2465.0,
      trend1m: 'BULLISH',
      trend5m: 'BULLISH',
      trend15m: 'BULLISH',
      trendDaily: 'BULLISH',
    };

    const res = calculateMultiTimeframeAlignment(input);
    assert.strictEqual(res.symbol, 'RAYMOND');
    assert.strictEqual(res.alignmentScore, 100);
    assert.strictEqual(res.greenCount, 4);
    assert.strictEqual(res.statusTier, 'PERFECT_4_GREEN');
    assert.strictEqual(res.canTrade, true);
    assert.ok(res.statusLabel.includes('PERFECT 4/4 ALL GREEN'));
  });

  it('2. Warns on Conflicting Mixed Trends (DO NOT ENTER for Beginners)', () => {
    const input: MultiTimeframeInput = {
      symbol: 'INFY',
      companyName: 'Infosys Limited',
      currentPrice: 1820.0,
      vwap: 1814.0,
      trend1m: 'BULLISH',
      trend5m: 'BEARISH',
      trend15m: 'NEUTRAL',
      trendDaily: 'BULLISH',
    };

    const res = calculateMultiTimeframeAlignment(input);
    assert.strictEqual(res.greenCount, 2);
    assert.strictEqual(res.statusTier, 'CONFLICT_MIXED');
    assert.strictEqual(res.canTrade, false);
    assert.ok(res.actionAdvice.includes('DO NOT ENTER'));
  });

  it('3. Detects Perfect 4/4 All Red Bearish Alignment (Short Sell Alert)', () => {
    const input: MultiTimeframeInput = {
      symbol: 'SWIGGY',
      companyName: 'Swiggy Limited',
      currentPrice: 410.0,
      vwap: 425.0,
      trend1m: 'BEARISH',
      trend5m: 'BEARISH',
      trend15m: 'BEARISH',
      trendDaily: 'BEARISH',
    };

    const res = calculateMultiTimeframeAlignment(input);
    assert.strictEqual(res.alignmentScore, 0);
    assert.strictEqual(res.redCount, 4);
    assert.strictEqual(res.statusTier, 'PERFECT_4_RED');
    assert.strictEqual(res.canTrade, false);
  });

  it('4. Classifies trend correctly from raw candle OHLC data', () => {
    const candles = [
      { open: 100, high: 105, low: 99, close: 104 }, // Green candle
    ];
    const tf = classifyTimeframeTrend('5m', 104, undefined, candles, 102);
    assert.strictEqual(tf.trend, 'BULLISH');
    assert.strictEqual(tf.icon, '🟢');
  });

  it('5. Ranks candidate pool descending by Alignment Score', () => {
    const pool: MultiTimeframeInput[] = [
      { symbol: 'WEAK', currentPrice: 100, trend1m: 'BEARISH', trend5m: 'BEARISH', trend15m: 'NEUTRAL', trendDaily: 'NEUTRAL' },
      { symbol: 'PERFECT', currentPrice: 200, trend1m: 'BULLISH', trend5m: 'BULLISH', trend15m: 'BULLISH', trendDaily: 'BULLISH' },
      { symbol: 'STRONG', currentPrice: 150, trend1m: 'BULLISH', trend5m: 'BULLISH', trend15m: 'BULLISH', trendDaily: 'NEUTRAL' },
    ];

    const results = runMultiTimeframeScan(pool);
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].symbol, 'PERFECT');
    assert.strictEqual(results[0].alignmentScore, 100);
    assert.strictEqual(results[1].symbol, 'STRONG');
    assert.strictEqual(results[1].alignmentScore, 75);
  });
});

