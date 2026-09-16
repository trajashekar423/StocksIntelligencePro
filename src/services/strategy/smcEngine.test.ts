/**
 * Unit tests for Smart Money Concepts (SMC) OB & FVG Radar Engine
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectOrderBlocks,
  detectFairValueGaps,
  detectLiquiditySweeps,
  evaluateSMCTradeSetup,
  type CandleData,
} from './smcEngine.ts';

// Helper to generate simulated candles
function generateMockCandles(basePrice = 100): CandleData[] {
  const candles: CandleData[] = [];
  let price = basePrice;

  for (let i = 0; i < 20; i++) {
    const isUp = i % 2 === 0;
    const change = (i + 1) * 0.5;
    const open = price;
    const close = isUp ? open + change : open - change;
    const high = Math.max(open, close) + 0.3;
    const low = Math.min(open, close) - 0.3;

    candles.push({
      timestamp: Date.now() + i * 300000,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 10000 + i * 500,
    });

    price = close;
  }

  return candles;
}

describe('🧠 Smart Money Concepts (SMC) Engine', () => {
  it('1. Detects Bullish Order Block (Red candle before strong green surge)', () => {
    const candles: CandleData[] = [
      { open: 100, high: 102, low: 99, close: 101, volume: 5000 },
      { open: 101, high: 102, low: 98, close: 98.5, volume: 6000 }, // Candle 2: Red OB candidate
      { open: 98.5, high: 104, low: 98.5, close: 103.5, volume: 20000 }, // Candle 3: Green surge
      { open: 103.5, high: 108, low: 103, close: 107.5, volume: 25000 }, // Candle 4: Green surge breaking high
      { open: 107.5, high: 109, low: 106, close: 108, volume: 15000 },
    ];

    const obs = detectOrderBlocks(candles);
    assert.ok(obs.length > 0, 'Should detect at least 1 Order Block');
    const bullOB = obs.find((ob) => ob.type === 'BULLISH_OB');
    assert.ok(bullOB, 'Should detect a Bullish OB');
    assert.equal(bullOB.low, 98);
    assert.equal(bullOB.high, 102);
  });

  it('2. Detects Bullish Fair Value Gap (Imbalance between Candle 1 High and Candle 3 Low)', () => {
    const candles: CandleData[] = [
      { open: 100, high: 102, low: 99, close: 101, volume: 5000 }, // Candle 1: High = 102
      { open: 101, high: 109, low: 101, close: 108.5, volume: 30000 }, // Candle 2: Big Impulse
      { open: 108.5, high: 112, low: 105, close: 111, volume: 20000 }, // Candle 3: Low = 105 (> 102 High of C1)
      { open: 111, high: 113, low: 110, close: 112, volume: 15000 },
    ];

    const fvgs = detectFairValueGaps(candles);
    assert.ok(fvgs.length > 0, 'Should detect FVG');
    const bullFVG = fvgs.find((fvg) => fvg.type === 'BULLISH_FVG' && fvg.bottom === 102);
    assert.ok(bullFVG, 'Should detect Bullish FVG');
    assert.equal(bullFVG.bottom, 102);
    assert.equal(bullFVG.top, 105);
    assert.equal(bullFVG.filled, false);
  });

  it('3. Detects Bullish Liquidity Sweep (Lower wick piercing support with close inside range)', () => {
    const mockCandles = generateMockCandles(100);
    // Add a lower wick liquidity sweep at the end
    mockCandles.push({
      open: 102,
      high: 103,
      low: 85, // Sharp lower wick piercing past previous lows
      close: 101.5, // Closes well back inside range
      volume: 40000,
    });

    const sweeps = detectLiquiditySweeps(mockCandles);
    assert.ok(sweeps.length > 0, 'Should detect liquidity sweep');
    const bullSweep = sweeps.find((s) => s.type === 'BULLISH_SWEEP');
    assert.ok(bullSweep, 'Should detect Bullish Liquidity Sweep');
    assert.equal(bullSweep.wickExtreme, 85);
  });

  it('4. Evaluates complete SMC Buy setup with OB, FVG, entry, SL, and TP', () => {
    const candles: CandleData[] = [
      { open: 100, high: 102, low: 99, close: 101, volume: 5000 },
      { open: 101, high: 102, low: 98, close: 98.5, volume: 6000 }, // OB
      { open: 98.5, high: 107, low: 98.5, close: 106.5, volume: 30000 }, // FVG
      { open: 106.5, high: 112, low: 104, close: 111, volume: 25000 },
      { open: 111, high: 112, low: 100, close: 101, volume: 15000 }, // Price retests OB/FVG zone
    ];

    const result = evaluateSMCTradeSetup({
      symbol: 'RELIANCE',
      companyName: 'Reliance Industries',
      sector: 'Energy',
      candles,
      vwap: 101,
      currentPrice: 101,
    });

    assert.equal(result.symbol, 'RELIANCE');
    assert.equal(result.signalType, 'BUY');
    assert.ok(result.smcScore >= 70, 'Score should be high conviction (>= 70)');
    assert.ok(result.stopLoss < result.entryPrice, 'Stop Loss must be below Entry Price');
    assert.ok(result.takeProfit1 > result.entryPrice, 'Take Profit 1 must be above Entry Price');
    assert.ok(result.takeProfit2 > result.takeProfit1, 'Take Profit 2 must be above Take Profit 1');
    assert.ok(result.riskRewardRatio >= 1.5, 'Risk-to-Reward should be at least 1.5');
  });

  it('5. Handles fallback cleanly with minimal candle input', () => {
    const result = evaluateSMCTradeSetup({
      symbol: 'TCS',
      candles: [],
      currentPrice: 3800,
    });

    assert.equal(result.symbol, 'TCS');
    assert.equal(result.signalType, 'NEUTRAL');
    assert.equal(result.smcScore, 50);
    assert.ok(result.recommendedAction.includes('Standby'));
  });
});
