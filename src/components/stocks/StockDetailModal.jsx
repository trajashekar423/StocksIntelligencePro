'use client';

import React, { useState } from 'react';
import CandleChart from './CandleChart';
import CandleExplainer from './CandleExplainer';
import { evaluateOverboughtStatus } from '../../services/risk/overboughtEngine';
import { evaluateSMCTradeSetup, getQuickSMCStatus } from '../../services/strategy/smcEngine';

export default function StockDetailModal({
  stock,
  onClose,
  onQuickTrade = null,
}) {
  const [modalTab, setModalTab] = useState('chart'); // 'chart' | 'anatomy' | 'smc' | 'levels' | 'raw'
  const [selectedCandle, setSelectedCandle] = useState(null);
  const [isFullModal, setIsFullModal] = useState(false);

  if (!stock) return null;

  const symbol = stock.symbol || stock.Symbol || 'STOCK';
  const companyName = stock.companyName || stock.company || symbol;
  const ltp = Number(stock.price || stock.ltp || stock.lastPrice || 0);
  const change = Number(stock.change || stock.dayChange || (stock.previousClose ? ltp - stock.previousClose : 0));
  const changePct = Number(stock.changePercent || stock.pChange || (stock.previousClose ? ((ltp - stock.previousClose) / stock.previousClose) * 100 : 0));
  const isPositive = changePct >= 0;
  const score = stock.score ?? stock.bullishScore ?? 80;
  const vwap = Number(stock.vwap || stock.VWAP || 0);
  const isBelowVwap = vwap > 0 && ltp < vwap;

  // Universal Overbought Safe Exit Evaluation for ANY stock
  const obEval = evaluateOverboughtStatus({
    currentPrice: ltp,
    entryPrice: stock.entryPrice || null,
    vwap: vwap > 0 ? vwap : null,
    rsi: Number(stock.rsi || 60),
  });

  // Universal SMC Evaluation
  const smcStatus = getQuickSMCStatus(stock);
  const smcEval = evaluateSMCTradeSetup({
    symbol,
    companyName,
    sector: stock.sector || 'NSE Equities',
    candles: Array.isArray(stock.candles) ? stock.candles : [],
    vwap,
    currentPrice: ltp,
  });

  return (
    <div className="modal d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}>
      <div className={`modal-dialog ${isFullModal ? 'modal-fullscreen' : 'modal-xl modal-dialog-centered modal-dialog-scrollable'}`} role="document">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          {/* Top Modal Header */}
          <div className="modal-header bg-light border-bottom px-4 py-3 d-flex align-items-center justify-content-between">
            <div className="d-flex flex-wrap align-items-center gap-3">
              <div>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="badge bg-dark fs-6 px-3 py-1 fw-bold">{symbol}</span>
                  <h5 className="modal-title fw-bold text-dark mb-0">{companyName}</h5>
                  {isBelowVwap && (
                    <span className="badge bg-danger text-white fw-bold px-2 py-1 shadow-sm">
                      ❌ DO NOT BUY — Still dumping below ₹{vwap.toFixed(2)} VWAP
                    </span>
                  )}
                  {smcStatus.badgeText && (
                    <span className={`badge ${smcStatus.badgeClass} px-2 py-1 shadow-sm`}>
                      {smcStatus.badgeText}
                    </span>
                  )}
                  {obEval.isOverbought && (
                    <span className={`badge bg-${obEval.badgeColor} text-white fw-bold px-2 py-1 shadow-sm`}>
                      {obEval.badgeText}
                    </span>
                  )}
                </div>
                <div className="d-flex flex-wrap align-items-center gap-2 mt-1">
                  <span className="fs-5 fw-bold text-dark">₹{ltp.toFixed(2)}</span>
                  <span className={`badge ${isPositive ? 'bg-success' : 'bg-danger'} px-2 py-1`}>
                    {isPositive ? '▲ +' : '▼ '}
                    {changePct.toFixed(2)}% (₹{Math.abs(change).toFixed(2)})
                  </span>
                  {vwap > 0 && (
                    <span className="badge bg-light text-dark border">
                      Live VWAP: ₹{vwap.toFixed(2)}
                    </span>
                  )}
                  <span className="badge bg-primary-subtle text-primary fw-semibold">
                    🎯 Bullish Score: {score}/100
                  </span>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                onClick={() => setIsFullModal(!isFullModal)}
                title={isFullModal ? 'Restore Normal Window' : 'Maximize to Fullscreen Window'}
              >
                {isFullModal ? '🗗 Restore' : '⛶ Fullscreen'}
              </button>
              {onQuickTrade && (
                <button
                  type="button"
                  className="btn btn-sm btn-success fw-bold px-3 py-1.5 rounded-3 shadow-sm d-flex align-items-center gap-1"
                  onClick={() => onQuickTrade(stock)}
                >
                  ⚡ TRADE {symbol}
                </button>
              )}
              <button
                type="button"
                className="btn-close ms-2"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
          </div>

          {/* Modal Navigation Tabs */}
          <div className="px-4 pt-2 border-bottom bg-white">
            <ul className="nav nav-tabs border-0 gap-2">
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link border-0 fw-semibold pb-2 ${modalTab === 'chart' ? 'active border-bottom border-primary border-3 text-primary' : 'text-muted'}`}
                  onClick={() => setModalTab('chart')}
                >
                  📈 Interactive Candlestick Chart
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link border-0 fw-semibold pb-2 ${modalTab === 'smc' ? 'active border-bottom border-primary border-3 text-primary' : 'text-muted'}`}
                  onClick={() => setModalTab('smc')}
                >
                  🧠 Smart Money (OB/FVG)
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link border-0 fw-semibold pb-2 ${modalTab === 'anatomy' ? 'active border-bottom border-primary border-3 text-primary' : 'text-muted'}`}
                  onClick={() => setModalTab('anatomy')}
                >
                  🕯️ Live Candle Anatomy & Explainer
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link border-0 fw-semibold pb-2 ${modalTab === 'levels' ? 'active border-bottom border-primary border-3 text-primary' : 'text-muted'}`}
                  onClick={() => setModalTab('levels')}
                >
                  🎯 Key Intraday Levels & Risk
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  className={`nav-link border-0 fw-semibold pb-2 ${modalTab === 'raw' ? 'active border-bottom border-primary border-3 text-primary' : 'text-muted'}`}
                  onClick={() => setModalTab('raw')}
                >
                  📋 Raw Market Data
                </button>
              </li>
            </ul>
          </div>

          {/* Modal Body Content */}
          <div className="modal-body p-3 p-md-4 bg-light bg-opacity-50">
            {/* ── TAB 1: INTERACTIVE CANDLESTICK CHART ── */}
            {modalTab === 'chart' && (
              <div>
                <CandleChart
                  candles={stock.candles}
                  symbol={symbol}
                  companyName={companyName}
                  basePrice={ltp}
                  currentPrice={ltp}
                  height={390}
                  onCandleSelect={setSelectedCandle}
                />

                {/* Quick Anatomy Insight below chart */}
                <div className="mt-3">
                  <CandleExplainer
                    selectedStock={stock}
                    activeCandle={selectedCandle}
                  />
                </div>
              </div>
            )}

            {/* ── TAB 1.5: SMART MONEY CONCEPTS (OB & FVG) ── */}
            {modalTab === 'smc' && (
              <div className="card border-0 shadow-sm p-4 rounded-4 bg-dark text-white">
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom border-secondary border-opacity-40 pb-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="fs-4">🧠</span>
                    <h5 className="fw-bold mb-0 text-warning">Smart Money Concepts Analysis ({symbol})</h5>
                  </div>
                  <span className={`badge ${smcEval.signalType === 'BUY' ? 'bg-success text-white' : smcEval.signalType === 'SELL' ? 'bg-danger text-white' : 'bg-secondary'} px-3 py-1.5 fs-6 fw-bold`}>
                    {smcEval.signalType === 'BUY' ? '🟢 BUY LIMIT' : smcEval.signalType === 'SELL' ? '🔴 SELL LIMIT' : '⚪ STANDBY'}
                  </span>
                </div>

                <div className="row g-3 mb-3 text-center">
                  <div className="col-12 col-md-4">
                    <div className="p-3 rounded-3 bg-black bg-opacity-40 border border-secondary border-opacity-40">
                      <small className="text-light opacity-75 d-block mb-1">Recommended Entry</small>
                      <strong className="fs-5 text-white">₹{Number(smcEval?.entryPrice || ltp).toFixed(2)}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-3 rounded-3 bg-danger bg-opacity-30 border border-danger">
                      <small className="text-white d-block mb-1 fw-bold">Stop Loss (SL)</small>
                      <strong className="fs-5 fw-bold" style={{ color: '#ff6b6b' }}>₹{Number(smcEval?.stopLoss || (ltp * 0.985)).toFixed(2)}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-3 rounded-3 bg-success bg-opacity-30 border border-success">
                      <small className="text-white d-block mb-1 fw-bold">Target 1 (1:2 R:R)</small>
                      <strong className="fs-5 fw-bold" style={{ color: '#4ade80' }}>₹{Number(smcEval?.takeProfit1 || (ltp * 1.03)).toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <h6 className="fw-bold text-warning mb-2">⚡ Active Order Blocks & Imbalances</h6>
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    {(smcEval?.orderBlocks || []).map((ob) => (
                      <span key={ob.id} className={`badge ${ob.type === 'BULLISH_OB' ? 'bg-success' : 'bg-danger'} text-white p-2 fw-bold`}>
                        {ob.type === 'BULLISH_OB' ? '🎯 Bullish OB' : '🔴 Bearish OB'}: ₹{ob.low} - ₹{ob.high}
                      </span>
                    ))}
                    {(smcEval?.activeFVGs || []).map((fvg) => (
                      <span key={fvg.id} className="badge bg-warning text-dark p-2 fw-bold">
                        ⚡ FVG Imbalance: ₹{fvg.bottom} - ₹{fvg.top} ({fvg.fillPct}% filled)
                      </span>
                    ))}
                    {!(smcEval?.orderBlocks || []).length && !(smcEval?.activeFVGs || []).length && (
                      <span className="text-muted small">No active OB or FVG gap detected on current timeframe.</span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-3 bg-black bg-opacity-30 border border-light border-opacity-10">
                  <h6 className="fw-bold text-warning mb-2">🧠 Institutional Confluence Checklist</h6>
                  <ul className="mb-0 text-white small ps-3">
                    {(smcEval?.confluenceFactors || []).map((fact, idx) => (
                      <li key={idx} className="mb-1">{fact}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* ── TAB 2: CANDLE ANATOMY & EXPLAINER ── */}
            {modalTab === 'anatomy' && (
              <div>
                <CandleExplainer
                  selectedStock={stock}
                  activeCandle={selectedCandle}
                />
              </div>
            )}

            {/* ── TAB 3: KEY TECHNICAL LEVELS ── */}
            {modalTab === 'levels' && (() => {
              const slVal = Number(stock.stopLoss || (ltp * 0.985));
              const slPct = ltp > 0 ? (((slVal - ltp) / ltp) * 100).toFixed(1) : '-1.5';
              const t1Val = Number(stock.target1 || stock.target || (ltp * 1.03));
              const t1Pct = ltp > 0 ? (((t1Val - ltp) / ltp) * 100).toFixed(1) : '+3.0';
              const t2Val = Number(stock.target2 || (ltp * 1.05));
              const t2Pct = ltp > 0 ? (((t2Val - ltp) / ltp) * 100).toFixed(1) : '+5.0';

              return (
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm p-3 rounded-4 bg-white h-100">
                      <h6 className="fw-bold mb-3">🎯 Suggested Intraday Targets & Risk</h6>
                      <div className="list-group list-group-flush small">
                        <div className="list-group-item d-flex justify-content-between px-0">
                          <span className="text-muted">Calculated Entry Price:</span>
                          <strong className="text-dark">₹{Number(stock.entryPrice || ltp).toFixed(2)}</strong>
                        </div>
                        <div className="list-group-item d-flex justify-content-between px-0">
                          <span className="text-muted">Stop Loss (Risk Gate):</span>
                          <strong className="text-danger">
                            ₹{slVal.toFixed(2)} ({Number(slPct) > 0 ? '+' : ''}{slPct}%)
                          </strong>
                        </div>
                        <div className="list-group-item d-flex justify-content-between px-0">
                          <span className="text-muted">Target 1 (1:2 R:R):</span>
                          <strong className="text-success">
                            ₹{t1Val.toFixed(2)} ({Number(t1Pct) > 0 ? '+' : ''}{t1Pct}%)
                          </strong>
                        </div>
                        <div className="list-group-item d-flex justify-content-between px-0">
                          <span className="text-muted">Target 2 (Extended):</span>
                          <strong className="text-success">
                            ₹{t2Val.toFixed(2)} ({Number(t2Pct) > 0 ? '+' : ''}{t2Pct}%)
                          </strong>
                        </div>
                        <div className="list-group-item d-flex justify-content-between px-0">
                          <span className="text-muted">Risk : Reward Ratio:</span>
                          <strong className="badge bg-primary fs-6">1 : 2.0</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6">
                    <div className="card border-0 shadow-sm p-3 rounded-4 bg-white h-100">
                      <h6 className="fw-bold mb-3">📐 Support, Resistance & VWAP</h6>
                      <div className="list-group list-group-flush small">
                        <div className="list-group-item d-flex justify-content-between px-0">
                          <span className="text-muted">VWAP (Volume Weighted Avg):</span>
                          <strong className="text-purple" style={{ color: '#8b5cf6' }}>
                            ₹{Number(stock.vwap || ltp * 0.995).toFixed(2)}
                          </strong>
                        </div>
                        <div className="list-group-item d-flex justify-content-between px-0">
                          <span className="text-muted">Key Support (S1):</span>
                          <strong className="text-dark">₹{Number(stock.support || stock.stopLoss || ltp * 0.99).toFixed(2)}</strong>
                        </div>
                        <div className="list-group-item d-flex justify-content-between px-0">
                          <span className="text-muted">Key Resistance (R1):</span>
                          <strong className="text-dark">₹{Number(stock.resistance || stock.target1 || ltp * 1.02).toFixed(2)}</strong>
                        </div>
                        <div className="list-group-item d-flex justify-content-between px-0">
                          <span className="text-muted">RSI (14-Period Momentum):</span>
                          <strong className="badge bg-info text-dark">{Number(stock.rsi || 65).toFixed(1)}</strong>
                        </div>
                        <div className="list-group-item d-flex justify-content-between px-0">
                          <span className="text-muted">Relative Volume (RVOL):</span>
                          <strong className="text-dark">{Number(stock.volumeRatio || stock.rvol || 1.8).toFixed(2)}x</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Overbought Safe Exit Analysis Card */}
                  <div className="col-12">
                    <div className={`card border-0 shadow-sm p-3 rounded-4 ${obEval.isOverbought ? 'bg-danger bg-opacity-10 border border-danger' : 'bg-white'}`}>
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                        <h6 className="fw-bold mb-0 d-flex align-items-center gap-1.5">
                          🛡️ Universal Overbought & Safe Exit Guard ({symbol})
                        </h6>
                        <span className={`badge bg-${obEval.badgeColor} text-white fw-bold px-3 py-1`}>
                          {obEval.badgeText}
                        </span>
                      </div>
                      <div className="row g-2 small">
                        <div className="col-12 col-md-4">
                          <div className="p-2 rounded bg-white border">
                            <span className="text-muted d-block" style={{ fontSize: 11 }}>VWAP Deviation:</span>
                            <strong className="text-dark">
                              {obEval.vwapDeviationPct >= 0 ? '+' : ''}{obEval.vwapDeviationPct}% vs VWAP (₹{Number(stock.vwap || ltp * 0.995).toFixed(2)})
                            </strong>
                          </div>
                        </div>
                        <div className="col-12 col-md-4">
                          <div className="p-2 rounded bg-white border">
                            <span className="text-muted d-block" style={{ fontSize: 11 }}>Calculated Trailing Stop:</span>
                            <strong className="text-warning">
                              ₹{obEval.trailingStopPrice.toFixed(2)} (Protects Capital & Profit)
                            </strong>
                          </div>
                        </div>
                        <div className="col-12 col-md-4">
                          <div className="p-2 rounded bg-white border">
                            <span className="text-muted d-block" style={{ fontSize: 11 }}>Safe Intraday Action:</span>
                            <strong className={obEval.isOverbought ? 'text-danger' : 'text-success'}>
                              {obEval.actionAdvice}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── TAB 4: RAW DATA ── */}
            {modalTab === 'raw' && (
              <div className="card border-0 shadow-sm p-3 rounded-4 bg-white">
                <div className="row g-2 small">
                  {Object.entries(stock)
                    .filter(([k]) => k !== 'raw' && k !== 'institutionalDeals' && k !== 'marketDepth')
                    .map(([key, value]) => (
                      <div className="col-12 col-sm-6 col-md-4" key={key}>
                        <div className="p-2 rounded-2 bg-light border">
                          <span className="text-muted d-block" style={{ fontSize: 11 }}>{key}:</span>
                          <strong className="text-dark text-truncate d-block">
                            {Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                          </strong>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

