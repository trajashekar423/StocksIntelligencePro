/**
 * Unit tests for Global Risk Alert Engine
 *
 * Tests all 7 risk scenario detectors + overall evaluation logic.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGlobalRiskAlerts,
  isHighRiskEnvironment,
} from './globalRiskAlertEngine.ts';
import type { GlobalRiskInput } from './globalRiskAlertEngine.ts';

describe('globalRiskAlertEngine', () => {
  // ── 1. GREEN: No risks → clean state ──
  it('returns GREEN with no alerts when all inputs are normal', () => {
    const input: GlobalRiskInput = {
      brentCrudePrice: 78.0,
      brentCrudeChangePct: -0.5,
      sp500ChangePct: 0.3,
      nasdaqChangePct: 0.5,
      usdInrChangePct: 0.05,
      indiaVix: 13.0,
      indiaVixChangePct: -1.5,
      nikkeiChangePct: 0.2,
      hangSengChangePct: 0.1,
      fiiNetCrores: 500,
      newsHeadlines: ['Markets rally on strong earnings', 'RBI holds rates steady'],
    };

    const result = evaluateGlobalRiskAlerts(input);
    assert.equal(result.overallRiskLevel, 'GREEN');
    assert.equal(result.overallRiskScore, 0);
    assert.equal(result.alerts.length, 0);
    assert.ok(result.riskSummary.includes('No global risk alerts'));
  });

  // ── 2. Crude Oil Shock detector ──
  it('detects crude oil shock when Brent > $90', () => {
    const result = evaluateGlobalRiskAlerts({
      brentCrudePrice: 92.4,
      brentCrudeChangePct: 3.8,
    });

    const crudeAlert = result.alerts.find(a => a.id === 'CRUDE_OIL_SHOCK');
    assert.ok(crudeAlert, 'Should detect crude oil shock');
    assert.equal(crudeAlert.severity, 'CRITICAL'); // Both price > 90 AND change > 3%
    assert.ok(crudeAlert.sectorsToAvoid.length > 0);
    assert.ok(crudeAlert.sectorsToTry.length > 0);
    assert.ok(crudeAlert.sectorsToAvoid.some(s => s.name.includes('Paints')));
    assert.ok(crudeAlert.sectorsToTry.some(s => s.name.includes('Upstream Oil')));
  });

  // ── 3. Geopolitical Crisis detector ──
  it('detects geopolitical crisis from war-related news headlines', () => {
    const result = evaluateGlobalRiskAlerts({
      newsHeadlines: [
        'USA launches military strike on Iran nuclear facilities',
        'Iran threatens missile retaliation against US bases',
        'Crude oil surges on Middle East crisis fears',
        'Sanctions imposed on Iranian oil exports',
      ],
    });

    const geoAlert = result.alerts.find(a => a.id === 'GEOPOLITICAL_CRISIS');
    assert.ok(geoAlert, 'Should detect geopolitical crisis');
    assert.ok(['RED', 'CRITICAL'].includes(geoAlert.severity));
    assert.ok(geoAlert.sectorsToTry.some(s => s.name.includes('Defence')));
    assert.ok(geoAlert.sectorsToTry.some(s => s.name.includes('Gold')));
  });

  // ── 4. FII Selling detector ──
  it('detects FII selling stampede when outflow exceeds -2000 Cr', () => {
    const result = evaluateGlobalRiskAlerts({
      fiiNetCrores: -2800,
    });

    const fiiAlert = result.alerts.find(a => a.id === 'FII_SELLING');
    assert.ok(fiiAlert, 'Should detect FII selling');
    assert.equal(fiiAlert.severity, 'RED');
    assert.ok(fiiAlert.sectorsToAvoid.some(s => s.name.includes('Banking')));
    assert.ok(fiiAlert.sectorsToTry.some(s => s.name.includes('PSU Banks')));
  });

  // ── 5. US Market Crash detector ──
  it('detects US market crash when S&P and Nasdaq fall sharply', () => {
    const result = evaluateGlobalRiskAlerts({
      sp500ChangePct: -2.5,
      nasdaqChangePct: -3.1,
    });

    const usAlert = result.alerts.find(a => a.id === 'US_MARKET_CRASH');
    assert.ok(usAlert, 'Should detect US market crash');
    assert.equal(usAlert.severity, 'RED');
    assert.ok(usAlert.sectorsToAvoid.some(s => s.name.includes('IT Services')));
  });

  // ── 6. VIX Explosion detector ──
  it('detects VIX explosion when India VIX > 22 with surge', () => {
    const result = evaluateGlobalRiskAlerts({
      indiaVix: 24.5,
      indiaVixChangePct: 18.0,
    });

    const vixAlert = result.alerts.find(a => a.id === 'VIX_EXPLOSION');
    assert.ok(vixAlert, 'Should detect VIX explosion');
    assert.equal(vixAlert.severity, 'CRITICAL'); // High VIX + surge
    assert.ok(vixAlert.sectorsToAvoid.some(s => s.name.includes('Small & Mid-caps')));
  });

  // ── 7. Rupee Panic detector ──
  it('detects rupee depreciation panic', () => {
    const result = evaluateGlobalRiskAlerts({
      usdInrChangePct: 0.6,
    });

    const rupeeAlert = result.alerts.find(a => a.id === 'RUPEE_PANIC');
    assert.ok(rupeeAlert, 'Should detect rupee panic');
    assert.equal(rupeeAlert.severity, 'RED');
    assert.ok(rupeeAlert.sectorsToTry.some(s => s.name.includes('IT Services')));
  });

  // ── 8. Asia Selloff detector ──
  it('detects Asia morning selloff from Nikkei crash', () => {
    const result = evaluateGlobalRiskAlerts({
      nikkeiChangePct: -2.5,
      hangSengChangePct: -2.1,
    });

    const asiaAlert = result.alerts.find(a => a.id === 'ASIA_SELLOFF');
    assert.ok(asiaAlert, 'Should detect Asia selloff');
    assert.equal(asiaAlert.severity, 'RED'); // Both crashing
    assert.ok(asiaAlert.sectorsToAvoid.some(s => s.name.includes('Metal')));
  });

  // ── 9. Multiple alerts stack correctly ──
  it('produces RED/CRITICAL when multiple risk scenarios fire', () => {
    const input: GlobalRiskInput = {
      brentCrudePrice: 93.0,
      brentCrudeChangePct: 4.0,
      sp500ChangePct: -2.2,
      nasdaqChangePct: -2.8,
      fiiNetCrores: -3200,
      newsHeadlines: [
        'USA Iran war escalation — military strikes continue',
        'Global markets plunge on geopolitical fears',
      ],
    };

    const result = evaluateGlobalRiskAlerts(input);
    assert.ok(result.alerts.length >= 3, `Expected >=3 alerts, got ${result.alerts.length}`);
    assert.ok(['RED', 'CRITICAL'].includes(result.overallRiskLevel));
    assert.ok(result.overallRiskScore >= 51);
    assert.ok(result.tradingAction.includes('Defensive') || result.tradingAction.includes('STOP'));
  });

  // ── 10. isHighRiskEnvironment helper ──
  it('isHighRiskEnvironment returns true for dangerous inputs', () => {
    assert.equal(isHighRiskEnvironment({
      brentCrudePrice: 95.0,
      brentCrudeChangePct: 5.0,
      fiiNetCrores: -3500,
    }), true);

    assert.equal(isHighRiskEnvironment({
      brentCrudePrice: 75.0,
      sp500ChangePct: 0.5,
    }), false);
  });

  // ── 11. Empty input returns GREEN ──
  it('returns GREEN with empty input (defaults)', () => {
    const result = evaluateGlobalRiskAlerts({});
    assert.equal(result.overallRiskLevel, 'GREEN');
    assert.equal(result.alerts.length, 0);
  });

  // ── 12. Alerts are sorted by severity ──
  it('sorts alerts with highest severity first', () => {
    const result = evaluateGlobalRiskAlerts({
      brentCrudePrice: 93.0,
      brentCrudeChangePct: 4.0, // CRITICAL
      nikkeiChangePct: -1.6,    // AMBER
    });

    if (result.alerts.length >= 2) {
      const severityOrder = { CRITICAL: 4, RED: 3, AMBER: 2, GREEN: 1 };
      for (let i = 1; i < result.alerts.length; i++) {
        assert.ok(
          severityOrder[result.alerts[i - 1].severity] >= severityOrder[result.alerts[i].severity],
          'Alerts should be sorted by severity descending'
        );
      }
    }
  });
});

