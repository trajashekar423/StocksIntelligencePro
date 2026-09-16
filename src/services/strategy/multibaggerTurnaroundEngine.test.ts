import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMultibaggerStock,
  runMultibaggerScan,
  type RawMultibaggerCandidate,
} from './multibaggerTurnaroundEngine.ts';

describe('🚀 High-Growth Multibagger & Corporate Turnaround Engine Suite', () => {
  it('1. Accurately scores Cupid-like multibagger setup with B2C pivot and profit growth', () => {
    const mockCupid: RawMultibaggerCandidate = {
      symbol: 'CUPID',
      companyName: 'Cupid Limited',
      price: 92.5,
      open: 88.0,
      previousClose: 87.0,
      volume: 8500000,
      relativeVolume: 2.8,
      vwap: 90.2,
      ema20: 84.5,
      ema50: 72.0,
      rsi: 69,
      quarterlyProfitGrowthPct: 195, // Q1 +195% YoY net profit!
      rocePct: 28,                  // 28.12% margin / ROCE
      roePct: 24,
      businessPivotDescription: 'B2B Tenders to B2C FMCG & Personal Care Pivot',
      capacityExpansionDetails: '1.25 Billion Condoms & 4 Lakh IVD Kits/Day Plant Expansion',
    };

    const evaluated = evaluateMultibaggerStock(mockCupid);

    assert.ok(evaluated.multibaggerScore >= 85, `Expected score >= 85, got ${evaluated.multibaggerScore}`);
    assert.strictEqual(evaluated.signal, 'HIGH_CONVICTION_MULTIBAGGER');
    assert.strictEqual(evaluated.earningsGrowthScore, 100);
    assert.strictEqual(evaluated.capitalEfficiencyScore, 100);
    assert.ok(evaluated.target2 > evaluated.target1, 'Target 2 should be higher than Target 1');
    assert.ok(evaluated.target2GainPct >= 40.0, `Expected Target 2 gain >= 40%, got ${evaluated.target2GainPct}%`);
    assert.ok(evaluated.investmentThesis.includes('CUPID'));
  });

  it('2. Evaluates peer multibagger candidates and ranks descending by Multibagger Score', () => {
    const candidates: RawMultibaggerCandidate[] = [
      {
        symbol: 'WEAK_CO',
        price: 100,
        volume: 500000,
        relativeVolume: 0.8,
        ema20: 105, // Below 20-EMA!
        ema50: 110,
        quarterlyProfitGrowthPct: 5,
        rocePct: 10,
      },
      {
        symbol: 'KAYNES',
        companyName: 'Kaynes Technology Limited',
        price: 4800,
        open: 4650,
        previousClose: 4600,
        volume: 2200000,
        relativeVolume: 2.1,
        vwap: 4720,
        ema20: 4550,
        ema50: 4200,
        rsi: 68,
        quarterlyProfitGrowthPct: 62,
        rocePct: 22,
        roePct: 19,
        businessPivotDescription: 'EMS & Semiconductor OSAT Mega Plant Expansion',
      },
    ];

    const scan = runMultibaggerScan(candidates);

    assert.strictEqual(scan.topSetups.length, 1);
    assert.strictEqual(scan.topSetups[0].symbol, 'KAYNES');
    assert.ok(scan.allCandidates[0].multibaggerScore > scan.allCandidates[1].multibaggerScore);
  });
});
