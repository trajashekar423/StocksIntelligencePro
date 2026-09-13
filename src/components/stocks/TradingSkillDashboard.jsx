'use client';

import React, { useState, useMemo } from 'react';
import { calculateExpectancy } from '../../services/risk/tradeExpectancyEngine';
import { calculateDrawdownRecovery } from '../../lib/trading/positionSizer';
import { scoreTradeQuality } from '../../services/risk/tradeQualityEngine';
import { validatePreTrade } from '../../lib/trading/riskManager';

// Default sample trades demonstrating Institutional Model vs Retail Trap
const SAMPLE_INSTITUTIONAL_TRADES = [
  { id: 't1', realizedPnL: 600, riskAmount: 200, side: 'LONG', closedAt: '2026-09-01' },
  { id: 't2', realizedPnL: -200, riskAmount: 200, side: 'LONG', closedAt: '2026-09-02' },
  { id: 't3', realizedPnL: -200, riskAmount: 200, side: 'LONG', closedAt: '2026-09-02' },
  { id: 't4', realizedPnL: 750, riskAmount: 250, side: 'SHORT', closedAt: '2026-09-03' },
  { id: 't5', realizedPnL: -200, riskAmount: 200, side: 'LONG', closedAt: '2026-09-03' },
  { id: 't6', realizedPnL: 600, riskAmount: 200, side: 'LONG', closedAt: '2026-09-04' },
  { id: 't7', realizedPnL: -200, riskAmount: 200, side: 'SHORT', closedAt: '2026-09-04' },
  { id: 't8', realizedPnL: -200, riskAmount: 200, side: 'LONG', closedAt: '2026-09-05' },
  { id: 't9', realizedPnL: 800, riskAmount: 200, side: 'LONG', closedAt: '2026-09-06' },
  { id: 't10', realizedPnL: -200, riskAmount: 200, side: 'SHORT', closedAt: '2026-09-07' },
];

const SAMPLE_RETAIL_TRAP_TRADES = [
  { id: 'r1', realizedPnL: 50, riskAmount: 300, side: 'LONG' },
  { id: 'r2', realizedPnL: 45, riskAmount: 300, side: 'LONG' },
  { id: 'r3', realizedPnL: 60, riskAmount: 300, side: 'LONG' },
  { id: 'r4', realizedPnL: 40, riskAmount: 300, side: 'LONG' },
  { id: 'r5', realizedPnL: -550, riskAmount: 300, side: 'LONG' }, // 1 big loser wipes out 10 wins
  { id: 'r6', realizedPnL: 50, riskAmount: 300, side: 'SHORT' },
  { id: 'r7', realizedPnL: 55, riskAmount: 300, side: 'LONG' },
  { id: 'r8', realizedPnL: 40, riskAmount: 300, side: 'LONG' },
  { id: 'r9', realizedPnL: -600, riskAmount: 300, side: 'SHORT' },
  { id: 'r10', realizedPnL: 50, riskAmount: 300, side: 'LONG' },
];

export default function TradingSkillDashboard() {
  const [selectedDataset, setSelectedDataset] = useState('INSTITUTIONAL');
  const [drawdownInput, setDrawdownInput] = useState(25);
  const [capitalInput, setCapitalInput] = useState(100000);
  const [tradeForm, setTradeForm] = useState({
    realizedPnL: -200,
    riskAmount: 200,
    wasStopLossWidened: false,
    riskPercent: 0.8,
    entryScore: 85,
    side: 'LONG',
  });

  // Calculate expectancy report based on selected dataset
  const trades = selectedDataset === 'INSTITUTIONAL' ? SAMPLE_INSTITUTIONAL_TRADES : SAMPLE_RETAIL_TRAP_TRADES;
  const expectancyReport = useMemo(() => calculateExpectancy(trades), [trades]);

  // Calculate drawdown recovery math
  const recoveryReport = useMemo(
    () => calculateDrawdownRecovery(Number(drawdownInput), Number(capitalInput), expectancyReport.expectancyPerTrade),
    [drawdownInput, capitalInput, expectancyReport.expectancyPerTrade]
  );

  // Evaluate interactive trade quality
  const singleTradeReport = useMemo(() => {
    return scoreTradeQuality({
      id: 'interactive_trade_1',
      realizedPnL: Number(tradeForm.realizedPnL),
      riskAmount: Number(tradeForm.riskAmount),
      wasStopLossWidened: tradeForm.wasStopLossWidened,
      entryPrice: 200,
      stopLossAtEntry: tradeForm.side === 'LONG' ? 196 : 204,
      targetAtEntry: tradeForm.side === 'LONG' ? 210 : 190,
      capitalAtEntry: Number(capitalInput),
      maxRiskPerTradePct: 1.0,
      positionValue: 15000,
      maxPositionValue: 25000,
      bullishScoreAtEntry: Number(tradeForm.entryScore),
      minBullishScore: 80,
      exitTrigger: tradeForm.wasStopLossWidened ? 'MANUAL_LATE' : 'SYSTEM',
      side: tradeForm.side,
    });
  }, [tradeForm, capitalInput]);

  // Test Conviction Oversize Guard (Check #12)
  const convictionCheckResult = useMemo(() => {
    return validatePreTrade({
      symbol: 'SAMPLE_STOCK',
      entryPrice: 500,
      stopLoss: 490,
      target: 530,
      quantity: 50,
      bullishScore: 97, // High conviction
      requestedRiskPerTradePct: 3.0, // Attempting 3% risk
      config: {
        mode: 'PAPER',
        enabled: true,
        capital: Number(capitalInput),
        riskPerTradePct: 1.0,
        maxPositionValue: 50000,
        maxTradesPerDay: 10,
        maxDailyLoss: 2000,
        maxOpenPositions: 3,
        minBullishScore: 80,
        minRsi: 40,
        maxRsi: 75,
        minVolume: 50000,
        minVolumeRatio: 1.2,
        minBreakoutPercent: 0.5,
        stopLossPct: 2.0,
        targetPct: 5.0,
        trailingStopTriggerPct: 1.5,
        trailingStopDistancePct: 1.0,
        useAtrStop: false,
      },
    });
  }, [capitalInput]);

  return (
    <div className="container-fluid py-4 bg-dark text-light min-vh-100 font-sans">
      {/* Header Banner */}
      <div className="card bg-gradient text-white border-secondary mb-4 shadow-lg" style={{ background: 'linear-gradient(135deg, #0d1b2a 0%, #1b263b 100%)' }}>
        <div className="card-body p-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <span className="badge bg-warning text-dark px-3 py-1.5 fs-6 mb-2">INSTITUTIONAL RISK MANAGEMENT</span>
              <h2 className="card-title fw-bold mb-1">🛡️ Trading Skill & Risk Expectancy Dashboard</h2>
              <p className="text-light-50 mb-0">
                Win Rate is meaningless without Expectancy. True trading edge comes from R:R discipline, non-linear drawdown recovery math, and strict rules compliance.
              </p>
            </div>
            <div className="d-flex gap-2">
              <button
                className={`btn btn-sm ${selectedDataset === 'INSTITUTIONAL' ? 'btn-success fw-bold' : 'btn-outline-secondary text-light'}`}
                onClick={() => setSelectedDataset('INSTITUTIONAL')}
              >
                🏛️ Institutional Setup (35% Win, 3:1 R:R)
              </button>
              <button
                className={`btn btn-sm ${selectedDataset === 'RETAIL' ? 'btn-danger fw-bold' : 'btn-outline-secondary text-light'}`}
                onClick={() => setSelectedDataset('RETAIL')}
              >
                🚨 Retail Trap (80% Win, 0.1:1 R:R)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Row 1: Expectancy & Trader Tier Grade */}
      <div className="row g-4 mb-4">
        {/* Card 1: Trader Grade & Summary */}
        <div className="col-lg-4">
          <div className="card h-100 bg-secondary bg-opacity-10 border-secondary">
            <div className="card-header bg-dark text-warning fw-semibold d-flex justify-content-between align-items-center">
              <span>📊 TRADER TIER GRADE</span>
              <span className="badge bg-primary fs-6">{expectancyReport.grade}</span>
            </div>
            <div className="card-body">
              <div className="text-center my-3">
                <span className="display-6 fw-bold text-info">
                  {expectancyReport.grade === 'INSTITUTIONAL' ? '🏛️ A+' : expectancyReport.grade === 'DEVELOPING' ? '📈 B' : '🚨 F'}
                </span>
                <h5 className="mt-2 text-light">{expectancyReport.gradeSummary}</h5>
              </div>
              <hr className="border-secondary" />
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Total Trades Analyzed:</span>
                <span className="fw-bold">{expectancyReport.totalTrades}</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Win / Loss Count:</span>
                <span className="fw-bold text-success">{expectancyReport.winCount}W</span> / <span className="fw-bold text-danger">{expectancyReport.lossCount}L</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Max Consecutive Losses:</span>
                <span className="fw-bold text-warning">{expectancyReport.maxConsecutiveLosses} streak</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Expectancy & Profit Factor */}
        <div className="col-lg-4">
          <div className="card h-100 bg-secondary bg-opacity-10 border-secondary">
            <div className="card-header bg-dark text-success fw-semibold">
              📈 EXPECTANCY & PROFIT FACTOR
            </div>
            <div className="card-body">
              <div className="row text-center g-3 my-2">
                <div className="col-6">
                  <div className="p-3 bg-dark rounded border border-secondary">
                    <span className="text-muted fs-7 d-block">Expectancy / Trade</span>
                    <span className={`fs-4 fw-bold ${expectancyReport.expectancyPerTrade >= 0 ? 'text-success' : 'text-danger'}`}>
                      {expectancyReport.expectancyPerTrade >= 0 ? '+' : ''}₹{expectancyReport.expectancyPerTrade}
                    </span>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-3 bg-dark rounded border border-secondary">
                    <span className="text-muted fs-7 d-block">Profit Factor</span>
                    <span className={`fs-4 fw-bold ${expectancyReport.profitFactor >= 1.5 ? 'text-success' : expectancyReport.profitFactor >= 1.0 ? 'text-warning' : 'text-danger'}`}>
                      {expectancyReport.profitFactor}x
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="d-flex justify-content-between mb-1 fs-7">
                  <span>Win Rate ({expectancyReport.winRatePct}%)</span>
                  <span>Avg Win (₹{expectancyReport.avgWin}) vs Avg Loss (₹{expectancyReport.avgLoss})</span>
                </div>
                <div className="progress bg-dark" style={{ height: '10px' }}>
                  <div className="progress-bar bg-success" style={{ width: `${expectancyReport.winRatePct}%` }}></div>
                  <div className="progress-bar bg-danger" style={{ width: `${100 - expectancyReport.winRatePct}%` }}></div>
                </div>
              </div>
              <div className="mt-3 small text-muted">
                {expectancyReport.expectancyPerTrade >= 0
                  ? '✅ Positive Edge: Over 100 trades, this system generates ₹' + (expectancyReport.expectancyPerTrade * 100).toFixed(0)
                  : '🚨 Negative Edge: System loses money over time despite high win rate.'}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Risk of Ruin & Safety */}
        <div className="col-lg-4">
          <div className="card h-100 bg-secondary bg-opacity-10 border-secondary">
            <div className="card-header bg-dark text-info fw-semibold">
              ⚠️ RISK OF RUIN & CAPITAL SAFETY
            </div>
            <div className="card-body">
              <div className="text-center my-2">
                <span className="text-muted fs-7 d-block">Estimated Risk of Ruin</span>
                <span className={`display-6 fw-bold ${expectancyReport.riskOfRuinPct <= 10 ? 'text-success' : expectancyReport.riskOfRuinPct <= 30 ? 'text-warning' : 'text-danger'}`}>
                  {expectancyReport.riskOfRuinPct}%
                </span>
              </div>
              <div className="alert bg-dark border-secondary p-2.5 small mb-0 mt-3">
                {expectancyReport.insights.map((insight, idx) => (
                  <div key={idx} className="mb-1 text-light fs-7">
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Row 2: Drawdown Recovery Math Calculator */}
      <div className="card bg-secondary bg-opacity-10 border-secondary mb-4 shadow">
        <div className="card-header bg-dark text-warning fw-semibold d-flex justify-content-between align-items-center">
          <span>📉 DRAWDOWN RECOVERY CALCULATOR (DANGEROUS MATH CHAPTER)</span>
          <span className={`badge ${recoveryReport.riskLevel === 'MANAGEABLE' ? 'bg-success' : recoveryReport.riskLevel === 'SEVERE' ? 'bg-warning text-dark' : 'bg-danger'}`}>
            {recoveryReport.riskLevel} RECOVERY
          </span>
        </div>
        <div className="card-body">
          <div className="row g-4 align-items-center">
            <div className="col-lg-4">
              <label className="form-label text-muted fs-7">Account Capital (₹)</label>
              <input
                type="number"
                className="form-control bg-dark text-light border-secondary mb-3"
                value={capitalInput}
                onChange={(e) => setCapitalInput(Number(e.target.value))}
              />

              <label className="form-label text-muted fs-7">Current Drawdown: <span className="fw-bold text-danger">{drawdownInput}%</span></label>
              <input
                type="range"
                className="form-range"
                min="1"
                max="80"
                step="1"
                value={drawdownInput}
                onChange={(e) => setDrawdownInput(Number(e.target.value))}
              />
              <div className="d-flex justify-content-between text-muted fs-7">
                <span>1% (Minor)</span>
                <span>25% (Severe)</span>
                <span>50% (Critical)</span>
              </div>
            </div>

            <div className="col-lg-8">
              <div className="row g-3 text-center">
                <div className="col-md-4">
                  <div className="p-3 bg-dark rounded border border-secondary">
                    <span className="text-muted fs-7 d-block">Capital Remaining</span>
                    <span className="fs-4 fw-bold text-light">
                      ₹{(recoveryReport.capitalRemaining ?? 0).toLocaleString()}
                    </span>
                    <span className="text-danger fs-7 d-block">
                      (-₹{(recoveryReport.drawdownAmount ?? (capitalInput - (recoveryReport.capitalRemaining || 0))).toLocaleString()})
                    </span>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="p-3 bg-dark rounded border border-danger">
                    <span className="text-muted fs-7 d-block">Required Gain to Breakeven</span>
                    <span className="fs-3 fw-bold text-warning">+{recoveryReport.recoveryRequiredPct}%</span>
                    <span className="text-muted fs-7 d-block">
                      {recoveryReport.drawdownPct === 50 ? '🚨 50% loss needs 100% gain!' : 'Compounding math against you'}
                    </span>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="p-3 bg-dark rounded border border-secondary">
                    <span className="text-muted fs-7 d-block">Est. Trades to Recover</span>
                    <span className="fs-4 fw-bold text-info">
                      {recoveryReport.tradesToRecover !== null ? `${recoveryReport.tradesToRecover} trades` : 'N/A (Negative Edge)'}
                    </span>
                    <span className="text-muted fs-7 d-block">at ₹{expectancyReport.expectancyPerTrade}/trade</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Row 3: Trade Quality Scorer & Conviction Guard */}
      <div className="row g-4">
        {/* Trade Quality Interactive Scorer */}
        <div className="col-lg-7">
          <div className="card h-100 bg-secondary bg-opacity-10 border-secondary">
            <div className="card-header bg-dark text-info fw-semibold">
              🎯 TRADE QUALITY EVALUATOR (GOOD TRADE VS BAD TRADE)
            </div>
            <div className="card-body">
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label text-muted fs-7">Realized P&L (₹)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm bg-dark text-light border-secondary"
                    value={tradeForm.realizedPnL}
                    onChange={(e) => setTradeForm({ ...tradeForm, realizedPnL: Number(e.target.value) })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted fs-7">Risk Amount (₹)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm bg-dark text-light border-secondary"
                    value={tradeForm.riskAmount}
                    onChange={(e) => setTradeForm({ ...tradeForm, riskAmount: Number(e.target.value) })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted fs-7">Stop Loss Widened?</label>
                  <select
                    className="form-select form-select-sm bg-dark text-light border-secondary"
                    value={tradeForm.wasStopLossWidened ? 'true' : 'false'}
                    onChange={(e) => setTradeForm({ ...tradeForm, wasStopLossWidened: e.target.value === 'true' })}
                  >
                    <option value="false">No (Honored Stop)</option>
                    <option value="true">Yes (Violated Stop Rule)</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-dark rounded border border-secondary mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fs-6 fw-bold">
                    Quality Grade: <span className={`badge ${singleTradeReport.grade === 'A' ? 'bg-success' : singleTradeReport.grade === 'B' ? 'bg-info text-dark' : 'bg-danger'}`}>Grade {singleTradeReport.grade}</span>
                  </span>
                  <span className={`badge ${singleTradeReport.label === 'GOOD_TRADE' ? 'bg-success' : 'bg-danger'}`}>
                    {singleTradeReport.label} ({singleTradeReport.qualityScore}/100)
                  </span>
                </div>
                <p className="text-light-50 small mb-0">{singleTradeReport.keyInsight}</p>
              </div>

              <div className="fs-7">
                <span className="text-muted d-block mb-1 fw-bold">7 Rules Compliance Checks:</span>
                <div className="d-flex flex-wrap gap-2">
                  {singleTradeReport.passedChecks.map((chk, i) => (
                    <span key={i} className="badge bg-success bg-opacity-20 text-success border border-success">
                      ✓ {chk}
                    </span>
                  ))}
                  {singleTradeReport.failedChecks.map((chk, i) => (
                    <span key={i} className="badge bg-danger bg-opacity-20 text-danger border border-danger">
                      ✗ {chk}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conviction Oversize Guard */}
        <div className="col-lg-5">
          <div className="card h-100 bg-secondary bg-opacity-10 border-secondary">
            <div className="card-header bg-dark text-warning fw-semibold">
              🔒 CONVICTION OVERSIZE GUARD (CHECK #12)
            </div>
            <div className="card-body d-flex flex-column justify-content-between">
              <div>
                <div className="alert bg-dark border-warning p-3 mb-3">
                  <div className="d-flex align-items-center gap-2 text-warning fw-bold mb-1">
                    <span>⚡ Institutional Rule #12 Active</span>
                  </div>
                  <p className="small text-light-50 mb-0">
                    High conviction setup detected (Score 97/100). The user attempted 3.0% risk on a "sure thing".
                  </p>
                </div>

                <div className="p-3 bg-dark rounded border border-danger mb-3">
                  <span className="text-danger fw-bold d-block mb-1">Execution Guard Status:</span>
                  <span className="badge bg-danger text-white mb-2">{convictionCheckResult.code}</span>
                  <p className="small text-light mb-0">{convictionCheckResult.reason}</p>
                </div>
              </div>

              <div className="p-2.5 bg-dark rounded border border-secondary text-center">
                <span className="text-warning fs-7 fw-semibold">
                  "High conviction is a psychological feeling, not a statistical guarantee."
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

