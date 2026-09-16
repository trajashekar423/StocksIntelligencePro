'use client';

import React, { useState, useMemo } from 'react';
import {
  getTodayActiveExpiry,
  getExpirySessionZone,
  evaluateExpirySurge,
} from '../../services/strategy/expirySurgeEngine';
import DailyProfitCalculatorModal from './DailyProfitCalculatorModal';

export default function ExpirySurgeRadar({ symbol = 'NIFTY', currentPrice = 24120 }) {
  const [selectedSymbol, setSelectedSymbol] = useState(symbol || 'NIFTY');
  const [selectedFilter, setSelectedFilter] = useState('ALL'); // 'ALL' | 'SURGE' | 'SAFETY'
  const [showProfitModal, setShowProfitModal] = useState(false);
  const [activeStockForModal, setActiveStockForModal] = useState(null);

  const activeExpiry = useMemo(() => getTodayActiveExpiry(), []);
  const sessionZoneInfo = useMemo(() => getExpirySessionZone(), []);

  // Demo Index / High Beta Expiry Candidate Pool
  const candidatePool = useMemo(() => {
    return [
      {
        symbol: 'NIFTY',
        companyName: 'Nifty 50 Benchmark Index',
        spotPrice: selectedSymbol === 'NIFTY' ? Number(currentPrice || 24120) : 24120,
        vwap: 24080,
        morningHigh: 24100,
        morningLow: 24020,
        currentVolume: 8500000,
        avgVolume: 4200000,
        rsi: 66,
        trend4TfAlignment: 'PERFECT_4_GREEN',
      },
      {
        symbol: 'BANKNIFTY',
        companyName: 'Nifty Bank Index',
        spotPrice: selectedSymbol === 'BANKNIFTY' ? Number(currentPrice || 52140) : 52140,
        vwap: 51980,
        morningHigh: 52100,
        morningLow: 51850,
        currentVolume: 6200000,
        avgVolume: 3100000,
        rsi: 64,
        trend4TfAlignment: 'PERFECT_4_GREEN',
      },
      {
        symbol: 'FINNIFTY',
        companyName: 'Nifty Financial Services',
        spotPrice: selectedSymbol === 'FINNIFTY' ? Number(currentPrice || 23550) : 23550,
        vwap: 23490,
        morningHigh: 23520,
        morningLow: 23410,
        currentVolume: 4100000,
        avgVolume: 2200000,
        rsi: 62,
        trend4TfAlignment: 'STRONG_3_GREEN',
      },
      {
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Ltd',
        spotPrice: 2980.5,
        vwap: 2965.0,
        morningHigh: 2975.0,
        morningLow: 2940.0,
        currentVolume: 9200000,
        avgVolume: 4500000,
        rsi: 65,
        trend4TfAlignment: 'PERFECT_4_GREEN',
      },
      {
        symbol: 'HDFCBANK',
        companyName: 'HDFC Bank Ltd',
        spotPrice: 1650.0,
        vwap: 1642.0,
        morningHigh: 1645.0,
        morningLow: 1630.0,
        currentVolume: 11000000,
        avgVolume: 6500000,
        rsi: 61,
        trend4TfAlignment: 'STRONG_3_GREEN',
      },
      {
        symbol: 'SWIGGY',
        companyName: 'Swiggy Limited',
        spotPrice: 520.4,
        vwap: 512.0,
        morningHigh: 518.0,
        morningLow: 502.0,
        currentVolume: 28000000,
        avgVolume: 12000000,
        rsi: 68,
        trend4TfAlignment: 'PERFECT_4_GREEN',
      },
    ];
  }, [selectedSymbol, currentPrice]);

  const evaluatedSetups = useMemo(() => {
    return candidatePool.map((c) => evaluateExpirySurge(c));
  }, [candidatePool]);

  const filteredSetups = useMemo(() => {
    if (selectedFilter === 'SURGE') {
      return evaluatedSetups.filter((s) => s.surgeScore >= 75);
    }
    if (selectedFilter === 'SAFETY') {
      return evaluatedSetups.filter((s) => s.warnings.length > 0 || !s.canTradeExpiry);
    }
    return evaluatedSetups;
  }, [evaluatedSetups, selectedFilter]);

  const handleOpenCalculator = (setup) => {
    setActiveStockForModal({
      symbol: setup.symbol,
      companyName: setup.companyName,
      price: setup.spotPrice,
      vwap: setup.vwap,
    });
    setShowProfitModal(true);
  };

  return (
    <div className="card shadow-sm border-0 rounded-4 overflow-hidden mb-4 bg-white">
      {/* ── TOP EXPIRY HEADER BANNER ── */}
      <div className="card-header bg-dark text-white p-3 p-md-4 border-bottom border-secondary">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
              <span className="badge bg-warning text-dark font-mono fw-bold px-2.5 py-1">
                ⚡ EXPIRY DAY RADAR
              </span>
              <span className="badge bg-success text-white font-mono px-2.5 py-1">
                📅 {activeExpiry.dayOfWeek.toUpperCase()}: {activeExpiry.name.toUpperCase()}
              </span>
            </div>
            <h4 className="fw-bold mb-1 text-white">
              Expiry Day Gamma Surge & Risk Safety Radar
            </h4>
            <p className="small text-light opacity-75 mb-0">
              Quantitative 1:30 PM short-covering breakout detector, ATM strike recommender, and 2:45 PM theta-exit shield.
            </p>
          </div>

          {/* Realtime Session Zone Badge */}
          <div className="text-end">
            <span
              className={`badge fs-6 px-3 py-2 fw-bold shadow-sm ${
                sessionZoneInfo.zone === 'GAMMA_WINDOW_130'
                  ? 'bg-danger text-white animate-pulse'
                  : sessionZoneInfo.zone === 'HARD_EXIT_ZONE_245'
                  ? 'bg-warning text-dark'
                  : 'bg-primary text-white'
              }`}
            >
              {sessionZoneInfo.zone === 'GAMMA_WINDOW_130'
                ? '⚡ 1:30 PM GAMMA WINDOW ACTIVE'
                : sessionZoneInfo.zone === 'HARD_EXIT_ZONE_245'
                ? '🚨 2:45 PM HARD EXIT ZONE'
                : '⏳ MORNING THETA DECAY ZONE'}
            </span>
            <small className="d-block text-light opacity-75 mt-1 font-mono">
              IST Session Clock
            </small>
          </div>
        </div>
      </div>

      {/* ── SESSION ZONE INSTRUCTIONAL ALERT ── */}
      <div
        className={`px-3 py-2 border-bottom ${
          sessionZoneInfo.zone === 'GAMMA_WINDOW_130'
            ? 'bg-danger bg-opacity-10 border-danger text-danger'
            : sessionZoneInfo.zone === 'HARD_EXIT_ZONE_245'
            ? 'bg-warning bg-opacity-10 border-warning text-dark'
            : 'bg-light text-dark'
        }`}
      >
        <div className="d-flex align-items-center gap-2 text-sm fw-semibold">
          <span>💡</span>
          <span>{sessionZoneInfo.message}</span>
        </div>
      </div>

      {/* ── INDEX SELECTOR & FILTER TOOLBAR ── */}
      <div className="p-3 bg-light bg-opacity-50 border-bottom d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="small text-muted fw-bold">Active Index:</span>
          {['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX'].map((idx) => (
            <button
              key={idx}
              type="button"
              className={`btn btn-sm fw-bold rounded-pill px-3 ${
                selectedSymbol === idx ? 'btn-primary text-white shadow-sm' : 'btn-outline-secondary'
              }`}
              onClick={() => setSelectedSymbol(idx)}
            >
              {idx}
            </button>
          ))}
        </div>

        {/* Setup Filters */}
        <div className="btn-group btn-group-sm shadow-sm rounded-pill overflow-hidden">
          <button
            type="button"
            className={`btn fw-semibold ${selectedFilter === 'ALL' ? 'btn-dark text-white' : 'btn-outline-secondary'}`}
            onClick={() => setSelectedFilter('ALL')}
          >
            All Candidates ({evaluatedSetups.length})
          </button>
          <button
            type="button"
            className={`btn fw-semibold ${selectedFilter === 'SURGE' ? 'btn-success text-white' : 'btn-outline-success'}`}
            onClick={() => setSelectedFilter('SURGE')}
          >
            🟢 Gamma Bursts (75+)
          </button>
          <button
            type="button"
            className={`btn fw-semibold ${selectedFilter === 'SAFETY' ? 'btn-warning text-dark' : 'btn-outline-warning'}`}
            onClick={() => setSelectedFilter('SAFETY')}
          >
            🛡️ Safety Warnings
          </button>
        </div>
      </div>

      {/* ── EXPIRY SURGE CARDS GRID ── */}
      <div className="p-3">
        <div className="row g-3">
          {filteredSetups.map((setup) => (
            <div key={setup.symbol} className="col-12 col-md-6 col-xl-4">
              <div
                className={`card h-100 rounded-3 border-2 shadow-sm transition-all ${
                  setup.surgeScore >= 80
                    ? 'border-success bg-success bg-opacity-10'
                    : setup.canTradeExpiry
                    ? 'border-primary'
                    : 'border-secondary bg-light bg-opacity-50'
                }`}
              >
                <div className="card-body p-3 d-flex flex-column justify-content-between">
                  <div>
                    {/* Symbol & Surge Score Header */}
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div>
                        <span className="badge bg-dark text-white fw-bold me-1 fs-6 px-2.5 py-1">
                          {setup.symbol}
                        </span>
                        <small className="text-muted font-mono ms-1">
                          ₹{setup.spotPrice.toFixed(2)}
                        </small>
                      </div>

                      <div className="text-end">
                        <span
                          className={`badge fs-6 fw-bold ${
                            setup.surgeScore >= 80
                              ? 'bg-success text-white'
                              : setup.surgeScore >= 65
                              ? 'bg-primary text-white'
                              : 'bg-secondary text-white'
                          }`}
                        >
                          Surge Score: {setup.surgeScore}/100
                        </span>
                      </div>
                    </div>

                    <p className="small text-muted mb-2 text-truncate">{setup.companyName}</p>

                    {/* Recommended Option Strike Box */}
                    <div className="bg-white p-2.5 rounded-3 border mb-2.5 shadow-xs">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <small className="text-muted fw-semibold">Recommended Strike:</small>
                        <span className="badge bg-purple text-white fw-bold" style={{ backgroundColor: '#8b5cf6' }}>
                          🎯 {setup.recommendedStrike.contractName}
                        </span>
                      </div>
                      <div className="d-flex align-items-center justify-content-between text-xs">
                        <span className="text-success fw-bold">Delta Est: ~0.52 (ATM)</span>
                        <span className="text-muted">Max Rec Lot: <strong>{setup.maxRecommendedLotSize} Lot</strong></span>
                      </div>
                    </div>

                    {/* Key Technical Reasons */}
                    {setup.reasons.length > 0 && (
                      <div className="mb-2">
                        {setup.reasons.slice(0, 2).map((r, i) => (
                          <div key={i} className="text-xs text-success fw-semibold mb-1 d-flex align-items-center gap-1">
                            <span>✅</span> <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Warnings */}
                    {setup.warnings.length > 0 && (
                      <div className="mb-2">
                        {setup.warnings.slice(0, 1).map((w, i) => (
                          <div key={i} className="text-xs text-danger fw-semibold mb-1 d-flex align-items-center gap-1">
                            <span>⚠️</span> <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Spot Target / SL & Calculator Trigger */}
                  <div className="pt-2 border-top mt-2">
                    <div className="d-flex align-items-center justify-content-between text-xs font-mono mb-2">
                      <span>SL Spot: <strong className="text-danger">₹{setup.suggestedStopLossSpot}</strong></span>
                      <span>Target Spot: <strong className="text-success">₹{setup.suggestedTargetSpot}</strong></span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-success text-white fw-bold w-100 shadow-sm d-flex align-items-center justify-content-center gap-1"
                      onClick={() => handleOpenCalculator(setup)}
                    >
                      💰 Calculate Expiry Lot Size & Margin
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── EXPIRY DAY PRO TRADING RULES FOOTER ── */}
      <div className="card-footer bg-light p-3 border-top">
        <h6 className="fw-bold text-dark mb-2">🎯 Pro Expiry Day Golden Rules:</h6>
        <div className="row g-2 text-xs text-muted">
          <div className="col-12 col-md-4">
            <div className="bg-white p-2 rounded border">
              <strong className="text-dark d-block mb-1">1. Trade ATM/ITM Only</strong>
              Avoid cheap OTM options (&lt; ₹15) as 95% expire at ₹0.00.
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="bg-white p-2 rounded border">
              <strong className="text-dark d-block mb-1">2. 1:30 PM Gamma Window</strong>
              Short-covering breakouts accelerate between 1:30 PM and 2:30 PM IST.
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="bg-white p-2 rounded border">
              <strong className="text-dark d-block mb-1">3. 2:45 PM Hard Exit</strong>
              Square off all expiry positions by 2:45 PM IST to prevent zero-value decay.
            </div>
          </div>
        </div>
      </div>

      {/* Profit & Position Calculator Modal */}
      {showProfitModal && activeStockForModal && (
        <DailyProfitCalculatorModal
          symbol={activeStockForModal.symbol}
          companyName={activeStockForModal.companyName}
          currentPrice={activeStockForModal.price}
          vwap={activeStockForModal.vwap}
          onClose={() => setShowProfitModal(false)}
        />
      )}
    </div>
  );
}

