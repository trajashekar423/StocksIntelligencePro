import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { RealtimeVwapSurgeMonitor, type LiveTick, type AlertPayload } from './realtimeVwapSurgeMonitor.ts';

describe('⚡ Real-Time 5-Minute VWAP Crossover & Volume Surge (3x SMA20) Monitor', () => {
  let monitor: RealtimeVwapSurgeMonitor;
  // Exact 5-minute boundary baseline: 1700000100000 / 300000 = 5666667
  const BASE_TIME = 1700000100000;
  const FIVE_MIN = 5 * 60 * 1000;

  beforeEach(() => {
    monitor = new RealtimeVwapSurgeMonitor({
      smaPeriod: 20,
      volumeSurgeThreshold: 3.0,
      candleIntervalMs: FIVE_MIN,
    });
  });

  afterEach(() => {
    monitor.clear();
  });

  it('1. Aggregates live high-frequency ticks into 5-minute OHLCV candles accurately', () => {
    const symbol = 'RELIANCE';
    const t0 = BASE_TIME;

    // Send 3 ticks within the same 5-minute bucket (t0, t0+60s, t0+120s)
    monitor.processTick({ symbol, price: 2900, volume: 100, timestamp: t0 });
    monitor.processTick({ symbol, price: 2920, volume: 200, timestamp: t0 + 60000 });
    monitor.processTick({ symbol, price: 2890, volume: 300, timestamp: t0 + 120000 });

    const state = monitor.getSymbolState(symbol);
    assert.ok(state, 'Symbol state should exist');
    assert.ok(state?.currentCandle, 'Current candle should exist');
    assert.strictEqual(state?.currentCandle?.open, 2900);
    assert.strictEqual(state?.currentCandle?.high, 2920);
    assert.strictEqual(state?.currentCandle?.low, 2890);
    assert.strictEqual(state?.currentCandle?.close, 2890);
    assert.strictEqual(state?.currentCandle?.volume, 600); // 100 + 200 + 300
  });

  it('2. Maintains sliding window 20-candle Volume SMA correctly in O(1) time', () => {
    const symbol = 'TATAMOTORS';

    // Populate 20 completed candles with volume = 1,000 each
    for (let i = 0; i < 20; i++) {
      const bucketTime = BASE_TIME + i * FIVE_MIN;
      monitor.processTick({ symbol, price: 1000, volume: 1000, timestamp: bucketTime });
    }

    // Trigger end of 20th candle by sending tick in 21st candle
    monitor.processTick({ symbol, price: 1005, volume: 500, timestamp: BASE_TIME + 20 * FIVE_MIN });

    const state = monitor.getSymbolState(symbol);
    assert.strictEqual(state?.historyCandleVolumes.length, 20);
    assert.strictEqual(state?.runningVolumeSum, 20000); // 20 * 1000
  });

  it('3. Triggers alert ONLY when all 3 conditions are met simultaneously', () => {
    const symbol = 'ORIENTTECH';
    const alerts: AlertPayload[] = [];
    monitor.subscribeAlert((alert) => alerts.push(alert));

    // Seed 20 historical completed candles with baseline volume = 1,000 and price above VWAP
    for (let i = 0; i < 20; i++) {
      const bucketTime = BASE_TIME + i * FIVE_MIN;
      monitor.processTick({ symbol, price: 350, volume: 500, timestamp: bucketTime });
      monitor.processTick({ symbol, price: 352, volume: 500, timestamp: bucketTime + 60000 });
    }

    // Candle 21: Price drops below VWAP (Open 350, Close 330 vs VWAP ~351)
    const candle21Time = BASE_TIME + 20 * FIVE_MIN;
    monitor.processTick({ symbol, price: 350, volume: 500, timestamp: candle21Time });
    monitor.processTick({ symbol, price: 330, volume: 500, timestamp: candle21Time + 60000 });

    assert.strictEqual(alerts.length, 0, 'No alert before condition met');

    // Candle 22: VWAP Crossover + 3.5x Volume Surge + Bullish Candle (Open 330, High 370, Close 370, Vol 3500)
    const candle22Time = BASE_TIME + 21 * FIVE_MIN;
    monitor.processTick({ symbol, price: 330, volume: 500, timestamp: candle22Time });
    monitor.processTick({ symbol, price: 370, volume: 3000, timestamp: candle22Time + 60000 }); // Total vol = 3500 (3.5x SMA)

    // Close candle 22 by starting candle 23
    const candle23Time = BASE_TIME + 22 * FIVE_MIN;
    monitor.processTick({ symbol, price: 371, volume: 100, timestamp: candle23Time });

    assert.strictEqual(alerts.length, 1, 'Expected exactly 1 alert fired');
    const alert = alerts[0];
    assert.strictEqual(alert.symbol, 'ORIENTTECH');
    assert.strictEqual(alert.conditionsMet.vwapBullishCross, true);
    assert.strictEqual(alert.conditionsMet.volumeSurge3x, true);
    assert.strictEqual(alert.conditionsMet.bullishCandle, true);
    assert.ok(alert.volumeSurgeRatio >= 3.0, `Surge ratio should be >= 3.0, got ${alert.volumeSurgeRatio}`);
    assert.ok(alert.candle.close > alert.candle.open, 'Candle must be bullish (Close > Open)');
  });

  it('4. Rejects alert if candle is bearish (Close < Open) despite VWAP crossover and volume surge', () => {
    const symbol = 'AWFIS';
    const alerts: AlertPayload[] = [];
    monitor.subscribeAlert((alert) => alerts.push(alert));

    // Seed 20 historical candles with volume = 1000
    for (let i = 0; i < 20; i++) {
      const bucketTime = BASE_TIME + i * FIVE_MIN;
      monitor.processTick({ symbol, price: 280, volume: 1000, timestamp: bucketTime });
    }

    // Candle 21: Open 295, Close 285 (Bearish red candle: Close < Open)
    const candle21Time = BASE_TIME + 20 * FIVE_MIN;
    monitor.processTick({ symbol, price: 295, volume: 1000, timestamp: candle21Time });
    monitor.processTick({ symbol, price: 285, volume: 4000, timestamp: candle21Time + 60000 }); // 4x surge

    // Close candle 21 by starting candle 22
    monitor.processTick({ symbol, price: 286, volume: 100, timestamp: BASE_TIME + 21 * FIVE_MIN });

    // Must NOT fire alert because candle was bearish (Close < Open)
    assert.strictEqual(alerts.length, 0, 'Should not fire alert for bearish candle');
  });

  it('5. Rejects alert if volume surge is less than 3x SMA20', () => {
    const symbol = 'POLYCAB';
    const alerts: AlertPayload[] = [];
    monitor.subscribeAlert((alert) => alerts.push(alert));

    // Seed 20 historical candles with volume = 1000
    for (let i = 0; i < 20; i++) {
      const bucketTime = BASE_TIME + i * FIVE_MIN;
      monitor.processTick({ symbol, price: 6000, volume: 1000, timestamp: bucketTime });
    }

    // Candle 21: Bullish VWAP crossover, but volume is only 1.8x SMA20 (1,800 vs 1,000 avg)
    const candle21Time = BASE_TIME + 20 * FIVE_MIN;
    monitor.processTick({ symbol, price: 5950, volume: 800, timestamp: candle21Time });
    monitor.processTick({ symbol, price: 6050, volume: 1000, timestamp: candle21Time + 60000 }); // Total vol = 1800 (1.8x)

    // Start candle 22
    monitor.processTick({ symbol, price: 6055, volume: 100, timestamp: BASE_TIME + 21 * FIVE_MIN });

    assert.strictEqual(alerts.length, 0, 'Should not fire alert if volume surge < 3x');
  });

  it('6. High-Frequency Benchmark: processes 100,000 ticks in < 1000ms without execution lag', () => {
    const symbols = ['RELIANCE', 'INFY', 'TCS', 'HDFCBANK', 'ICICIBANK'];
    const startTime = Date.now();

    for (let i = 0; i < 100000; i++) {
      const sym = symbols[i % symbols.length];
      monitor.processTick({
        symbol: sym,
        price: 1000 + (i % 50),
        volume: 10 + (i % 100),
        timestamp: BASE_TIME + i * 100, // 100ms ticks
      });
    }

    const elapsedMs = Date.now() - startTime;
    assert.strictEqual(monitor.getProcessedTickCount(), 100000);
    assert.ok(elapsedMs < 1000, `Expected < 1000ms execution time, took ${elapsedMs}ms`);
  });
});

