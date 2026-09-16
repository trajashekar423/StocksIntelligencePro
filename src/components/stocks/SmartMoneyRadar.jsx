'use client';

import React, { useState, useMemo } from 'react';
import { evaluateSMCTradeSetup } from '../../services/strategy/smcEngine';

// Sample Nifty 50 stocks with simulated 5m/15m OHLC candle data for the radar
const SAMPLE_SMC_STOCKS = [
  {
    symbol: 'RELIANCE',
    companyName: 'Reliance Industries Ltd.',
    sector: 'Energy',
    currentPrice: 2850.40,
    vwap: 2842.10,
    candles: [
      { open: 2820, high: 2825, low: 2815, close: 2822, volume: 15000 },
      { open: 2822, high: 2824, low: 2810, close: 2812, volume: 18000 }, // Bullish OB (Last Red)
      { open: 2812, high: 2865, low: 2812, close: 2860, volume: 65000 }, // Impulse Green
      { open: 2860, high: 2875, low: 2848, close: 2870, volume: 45000 }, // FVG (2825 High to 2848 Low)
      { open: 2870, high: 2872, low: 2845, close: 2850.40, volume: 32000 }, // Retest into FVG/OB
    ],
  },
  {
    symbol: 'TCS',
    companyName: 'Tata Consultancy Services',
    sector: 'IT Services',
    currentPrice: 3920.00,
    vwap: 3935.50,
    candles: [
      { open: 3950, high: 3965, low: 3945, close: 3960, volume: 12000 },
      { open: 3960, high: 3975, low: 3958, close: 3972, volume: 14000 }, // Bearish OB (Last Green)
      { open: 3972, high: 3972, low: 3910, close: 3915, volume: 55000 }, // Impulse Red
      { open: 3915, high: 3930, low: 3895, close: 3900, volume: 40000 }, // FVG
      { open: 3900, high: 3935, low: 3898, close: 3920.00, volume: 28000 }, // Retest Bearish OB
    ],
  },
  {
    symbol: 'HDFCBANK',
    companyName: 'HDFC Bank Ltd.',
    sector: 'Banking',
    currentPrice: 1642.50,
    vwap: 1638.20,
    candles: [
      { open: 1625, high: 1630, low: 1620, close: 1628, volume: 25000 },
      { open: 1628, high: 1629, low: 1618, close: 1619, volume: 30000 },
      { open: 1619, high: 1655, low: 1619, close: 1650, volume: 95000 }, // Big Institutional Surge
      { open: 1650, high: 1660, low: 1638, close: 1658, volume: 60000 },
      { open: 1658, high: 1659, low: 1635, close: 1642.50, volume: 42000 },
    ],
  },
  {
    symbol: 'INFY',
    companyName: 'Infosys Ltd.',
    sector: 'IT Services',
    currentPrice: 1815.20,
    vwap: 1810.00,
    candles: [
      { open: 1795, high: 1800, low: 1790, close: 1798, volume: 18000 },
      { open: 1798, high: 1799, low: 1785, close: 1788, volume: 22000 },
      { open: 1788, high: 1828, low: 1788, close: 1825, volume: 72000 },
      { open: 1825, high: 1832, low: 1812, close: 1830, volume: 50000 },
      { open: 1830, high: 1832, low: 1808, close: 1815.20, volume: 35000 },
    ],
  },
  {
    symbol: 'ICICIBANK',
    companyName: 'ICICI Bank Ltd.',
    sector: 'Banking',
    currentPrice: 1225.80,
    vwap: 1228.40,
    candles: [
      { open: 1240, high: 1245, low: 1238, close: 1244, volume: 20000 },
      { open: 1244, high: 1248, low: 1242, close: 1247, volume: 22000 },
      { open: 1247, high: 1247, low: 1215, close: 1218, volume: 80000 },
      { open: 1218, high: 1228, low: 1210, close: 1212, volume: 55000 },
      { open: 1212, high: 1232, low: 1211, close: 1225.80, volume: 38000 },
    ],
  },
];

export default function SmartMoneyRadar({ capital = 100000 }) {
  const [filterSignal, setFilterSignal] = useState('ALL'); // ALL | BUY | SELL | SWEEP
  const [selectedStock, setSelectedStock] = useState(null);

  // Evaluate all stocks through smcEngine
  const setups = useMemo(() => {
    return (SAMPLE_SMC_STOCKS || []).map((stock) => evaluateSMCTradeSetup(stock)).sort(
      (a, b) => (b.smcScore || 0) - (a.smcScore || 0)
    );
  }, []);

  const filteredSetups = useMemo(() => {
    if (filterSignal === 'BUY') return (setups || []).filter((s) => s.signalType === 'BUY');
    if (filterSignal === 'SELL') return (setups || []).filter((s) => s.signalType === 'SELL');
    if (filterSignal === 'SWEEP') return (setups || []).filter((s) => (s.liquiditySweeps || []).length > 0);
    return setups || [];
  }, [setups, filterSignal]);

  const activeBuyCount = (setups || []).filter((s) => s.signalType === 'BUY').length;
  const activeSellCount = (setups || []).filter((s) => s.signalType === 'SELL').length;
  const activeSweepCount = (setups || []).filter((s) => (s.liquiditySweeps || []).length > 0).length;

  return (
    <div className="smart-money-radar w-100 mb-4">
      {/* ── HEADER & BANNER ── */}
      <div
        className="p-3.5 p-md-4 rounded-4 text-white mb-3 shadow-sm border border-opacity-20 border-warning"
        style={{
          background: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1f2937 100%)',
          borderLeft: '6px solid #f59e0b',
        }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="fs-3">🧠</span>
              <h4 className="fw-bold mb-0 text-warning" style={{ fontSize: '1.25rem' }}>
                Smart Money Concepts (SMC) OB & FVG Radar
              </h4>
              <span className="badge bg-warning text-dark fw-bold px-2.5 py-1 small">
                INSTITUTIONAL FOOTPRINTS
              </span>
            </div>
            <p className="text-light opacity-80 small mb-0" style={{ maxWidth: 780 }}>
              Scans 5m/15m charts for <strong>Order Blocks (OB)</strong>, <strong>Fair Value Gaps (FVG)</strong>, and <strong>Liquidity Sweeps</strong>. Generates high-probability <strong>TradingView-style Buy/Sell limit setups with 1:2+ R:R</strong>.
            </p>
          </div>

          {/* Quick Stats Pills */}
          <div className="d-flex align-items-center gap-2 me-md-2">
            <span className="badge bg-success border border-success text-white px-3 py-2 fw-bold shadow-sm">
              🟢 {activeBuyCount} Buy Setups
            </span>
            <span className="badge bg-danger border border-danger text-white px-3 py-2 fw-bold shadow-sm">
              🔴 {activeSellCount} Sell Setups
            </span>
            <span className="badge bg-warning border border-warning text-dark px-3 py-2 fw-bold shadow-sm">
              🧹 {activeSweepCount} Sweeps
            </span>
          </div>
        </div>
      </div>

      {/* ── FILTER TABS ── */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 bg-dark p-2 rounded-3 border border-secondary border-opacity-25">
        <div className="d-flex align-items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold ${
              filterSignal === 'ALL' ? 'btn-warning text-dark shadow-sm' : 'btn-outline-light border-0'
            }`}
            onClick={() => setFilterSignal('ALL')}
          >
            🔥 All Setups ({setups.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold ${
              filterSignal === 'BUY' ? 'btn-success text-white shadow-sm' : 'btn-outline-light border-0'
            }`}
            onClick={() => setFilterSignal('BUY')}
          >
            🟢 Bullish OB / FVG ({activeBuyCount})
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold ${
              filterSignal === 'SELL' ? 'btn-danger text-white shadow-sm' : 'btn-outline-light border-0'
            }`}
            onClick={() => setFilterSignal('SELL')}
          >
            🔴 Bearish OB / FVG ({activeSellCount})
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold ${
              filterSignal === 'SWEEP' ? 'btn-info text-dark shadow-sm' : 'btn-outline-light border-0'
            }`}
            onClick={() => setFilterSignal('SWEEP')}
          >
            🧹 Liquidity Sweeps ({activeSweepCount})
          </button>
        </div>

        <small className="text-light text-nowrap ms-auto opacity-90" style={{ fontSize: '0.75rem' }}>
          Capital: <strong className="text-warning">₹{capital.toLocaleString('en-IN')}</strong> • 1:2+ R:R Target Filter Active
        </small>
      </div>

      {/* ── SETUP CARDS GRID (TRADINGVIEW VISUAL STYLE) ── */}
      <div className="row g-3">
        {filteredSetups.map((setup) => {
          const isBuy = setup.signalType === 'BUY';
          const isSell = setup.signalType === 'SELL';
          const riskPerShare = Math.abs(setup.entryPrice - setup.stopLoss);
          const maxShares = Math.max(1, Math.floor((capital * 0.02) / (riskPerShare || 1))); // 2% risk rule
          const potentialProfit = Math.round(maxShares * Math.abs(setup.takeProfit1 - setup.entryPrice));
          const potentialRisk = Math.round(maxShares * riskPerShare);

          return (
            <div key={setup.symbol} className="col-12 col-md-6 col-xl-4">
              <div
                className="card border-0 shadow-sm h-100 text-white rounded-4 overflow-hidden position-relative"
                style={{
                  background: isBuy
                    ? 'linear-gradient(145deg, #091a12 0%, #122a1f 60%, #0d1620 100%)'
                    : isSell
                    ? 'linear-gradient(145deg, #1f0a0a 0%, #311212 60%, #190d1d 100%)'
                    : 'linear-gradient(145deg, #17191e 0%, #222630 100%)',
                  borderLeft: `5px solid ${isBuy ? '#10b981' : isSell ? '#ef4444' : '#6b7280'}`,
                }}
              >
                {/* Top Badge Strip */}
                <div className="card-header bg-black bg-opacity-40 border-0 p-3 d-flex align-items-center justify-content-between">
                  <div>
                    <h5 className="mb-0 fw-bold d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                      <span>{setup.symbol}</span>
                      <span className="badge bg-secondary bg-opacity-40 border border-light border-opacity-25 px-2 py-0.5 small text-light fw-normal">
                        {setup.sector}
                      </span>
                    </h5>
                    <small className="text-light opacity-75" style={{ fontSize: '0.75rem' }}>
                      {setup.companyName}
                    </small>
                  </div>

                  {/* Signal Type Badge (TradingView Style) */}
                  <div className="text-end">
                    <span
                      className={`badge fs-6 fw-bold px-3 py-1.5 shadow-sm rounded-pill ${
                        isBuy ? 'bg-success text-white' : isSell ? 'bg-danger text-white' : 'bg-secondary text-white'
                      }`}
                    >
                      {isBuy ? '🟢 BUY' : isSell ? '🔴 SELL' : '⚪ NEUTRAL'}
                    </span>
                    <div className="small fw-bold mt-1 text-warning" style={{ fontSize: '0.72rem' }}>
                      SMC Score: {setup.smcScore}/100
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="card-body p-3">
                  {/* Setup Title */}
                  <div className="mb-2.5 p-2 rounded bg-black bg-opacity-30 border border-light border-opacity-10 d-flex align-items-center justify-content-between">
                    <span className="small fw-semibold text-warning" style={{ fontSize: '0.8rem' }}>
                      🎯 Setup: {setup.setupName}
                    </span>
                    <span className="badge bg-dark border border-warning text-warning px-2 py-0.5" style={{ fontSize: '0.7rem' }}>
                      R:R 1:{setup.riskRewardRatio}
                    </span>
                  </div>

                  {/* ── PRICE TARGET MATRIX (ENTRY, SL, TP1, TP2) High-Contrast Pure White & Neon ── */}
                  <div className="row g-2 text-center mb-3">
                    <div className="col-6">
                      <div className="p-2 rounded" style={{ background: '#111827', border: '1px solid #374151' }}>
                        <small className="d-block fw-semibold text-uppercase" style={{ color: '#9ca3af', fontSize: '0.68rem', letterSpacing: '0.5px' }}>CMP / ENTRY</small>
                        <strong className="fs-6 fw-bold" style={{ color: '#ffffff' }}>₹{setup.entryPrice.toFixed(2)}</strong>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="p-2 rounded" style={{ background: '#3b1215', border: '1px solid #ef4444' }}>
                        <small className="d-block fw-bold text-uppercase" style={{ color: '#fca5a5', fontSize: '0.68rem', letterSpacing: '0.5px' }}>STOP LOSS (SL)</small>
                        <strong className="fs-6 fw-bold" style={{ color: '#ffffff' }}>₹{setup.stopLoss.toFixed(2)}</strong>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="p-2 rounded" style={{ background: '#0d2818', border: '1px solid #10b981' }}>
                        <small className="d-block fw-bold text-uppercase" style={{ color: '#6ee7b7', fontSize: '0.68rem', letterSpacing: '0.5px' }}>TARGET 1 (1:2 R:R)</small>
                        <strong className="fs-6 fw-bold" style={{ color: '#ffffff' }}>₹{setup.takeProfit1.toFixed(2)}</strong>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="p-2 rounded" style={{ background: '#0d2818', border: '1px solid #10b981' }}>
                        <small className="d-block fw-bold text-uppercase" style={{ color: '#6ee7b7', fontSize: '0.68rem', letterSpacing: '0.5px' }}>TARGET 2 (1:3 R:R)</small>
                        <strong className="fs-6 fw-bold" style={{ color: '#ffffff' }}>₹{setup.takeProfit2.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* ── ACTIVE OB & FVG ZONES BADGES ── */}
                  <div className="mb-3">
                    <small className="d-block mb-1.5 fw-bold" style={{ color: '#fbbf24', fontSize: '0.75rem' }}>
                      ⚡ Detected Order Blocks & Imbalances:
                    </small>

                    <div className="d-flex flex-wrap gap-1.5">
                      {(setup.orderBlocks || []).slice(0, 2).map((ob) => (
                        <span
                          key={ob.id}
                          className="badge px-2.5 py-1 small fw-bold"
                          style={{
                            background: ob.type === 'BULLISH_OB' ? '#064e3b' : '#7f1d1d',
                            border: `1px solid ${ob.type === 'BULLISH_OB' ? '#10b981' : '#ef4444'}`,
                            color: '#ffffff',
                          }}
                        >
                          {ob.type === 'BULLISH_OB' ? '🎯 Bullish OB' : '🔴 Bearish OB'}: ₹{ob.low} - ₹{ob.high}
                        </span>
                      ))}

                      {(setup.activeFVGs || []).slice(0, 2).map((fvg) => (
                        <span
                          key={fvg.id}
                          className="badge px-2.5 py-1 small fw-bold"
                          style={{
                            background: '#78350f',
                            border: '1px solid #f59e0b',
                            color: '#ffffff',
                          }}
                        >
                          ⚡ FVG Gap: ₹{fvg.bottom} - ₹{fvg.top} ({fvg.fillPct}% filled)
                        </span>
                      ))}

                      {(setup.liquiditySweeps || []).map((s) => (
                        <span
                          key={s.id}
                          className="badge px-2.5 py-1 small fw-bold"
                          style={{
                            background: '#164e63',
                            border: '1px solid #06b6d4',
                            color: '#ffffff',
                          }}
                        >
                          🧹 Sweep @ ₹{s.level}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Confluence Bullet List */}
                  <div className="p-2.5 rounded bg-black bg-opacity-40 border border-light border-opacity-10 mb-3">
                    <small className="fw-bold d-block mb-1" style={{ color: '#f59e0b', fontSize: '0.78rem' }}>
                      🧠 Smart Money Confluence Factors:
                    </small>
                    <ul className="mb-0 ps-3 text-white small" style={{ fontSize: '0.78rem', lineHeight: '1.5', opacity: 0.95 }}>
                      {(setup.confluenceFactors || []).map((fact, idx) => (
                        <li key={idx} style={{ color: '#ffffff' }}>{fact}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Position Sizing Calculator Strip */}
                  <div className="p-2 rounded bg-dark border border-secondary border-opacity-40 d-flex align-items-center justify-content-between small">
                    <div>
                      <span className="text-light opacity-75 d-block" style={{ fontSize: '0.68rem' }}>2% Capital Position Size</span>
                      <strong className="text-white fw-bold">{maxShares} Qty</strong>
                    </div>
                    <div className="text-end">
                      <span className="text-light opacity-75 d-block" style={{ fontSize: '0.68rem' }}>Est. Profit / Max Risk</span>
                      <strong className="fw-bold" style={{ color: '#4ade80' }}>+₹{potentialProfit.toLocaleString('en-IN')}</strong>
                      <span className="text-white opacity-50 mx-1">/</span>
                      <strong className="fw-bold" style={{ color: '#ff6b6b' }}>-₹{potentialRisk.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Action Recommendation */}
                <div className="card-footer bg-black bg-opacity-80 border-top border-secondary border-opacity-40 p-2.5 text-center">
                  <div className="small fw-bold" style={{ color: '#fbbf24', fontSize: '0.82rem' }}>
                    {setup.recommendedAction}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

