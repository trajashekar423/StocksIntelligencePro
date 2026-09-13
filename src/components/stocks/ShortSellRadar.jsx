'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { runShortSellScan } from '../../services/strategy/shortSellEngine';
import StockDetailModal from './StockDetailModal.jsx';
import LiveNewsTicker from './LiveNewsTicker.jsx';
import BuyerDemandMeter from './BuyerDemandMeter.jsx';

export default function ShortSellRadar({
  stocks = [],
  onOpenTrade = null,
  onOpenPractice = null,
}) {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('auto'); // 'auto' | 'cards' | 'table'
  const [selectedModalStock, setSelectedModalStock] = useState(null);
  const [growwGuideStock, setGrowwGuideStock] = useState(null);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Live News State
  const [liveNewsEnabled, setLiveNewsEnabled] = useState(true);
  const [liveNewsMap, setLiveNewsMap] = useState({});
  const [newsLoading, setNewsLoading] = useState(false);

  // Batch fetch news for short candidates
  const fetchLiveNews = useCallback(async () => {
    if (!liveNewsEnabled) return;
    try {
      setNewsLoading(true);
      // Key short candidate symbols
      const defaultSymbols = ['SWIGGY', 'PAYTM', 'ZEEL', 'INDUSINDBK', 'DELHIVERY', 'BANDHANBNK', 'VEDL', 'BATAINDIA'];
      const stockSymbols = stocks.map(s => (s.symbol || s.Symbol || '').toUpperCase()).filter(Boolean);
      const allSymbols = Array.from(new Set([...defaultSymbols, ...stockSymbols])).slice(0, 8);

      const res = await fetch(`/api/news?symbols=${allSymbols.join(',')}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results) {
          setLiveNewsMap(data.results);
        }
      }
    } catch (err) {
      console.warn('[ShortSellRadar] News fetch error:', err);
    } finally {
      setNewsLoading(false);
    }
  }, [liveNewsEnabled, stocks]);

  useEffect(() => {
    fetchLiveNews();
    const interval = setInterval(fetchLiveNews, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [fetchLiveNews]);

  // Audio Synthesizer for Short Breakdown Chime
  const playAlertChime = useCallback((type) => {
    if (!soundAlertsEnabled || typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      if (type === 'SHORT_BREAKDOWN') {
        // Double punch descending tone (E5 -> C5 -> G4)
        [659.25, 523.25, 392.0].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.09);
          gain.gain.setValueAtTime(0.12, now + idx * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.09);
          osc.stop(now + idx * 0.09 + 0.25);
        });
      }
    } catch {
      // ignore
    }
  }, [soundAlertsEnabled]);

  // Run full Short Sell Scanner with live news map
  const scanResults = useMemo(() => {
    return runShortSellScan(
      stocks,
      {
        giftNiftyChange: -65,
        usMarketSentiment: 'BEARISH',
        indiaVix: 15.8,
        crudeOilChange: 1.8,
      },
      liveNewsEnabled ? liveNewsMap : {}
    );
  }, [stocks, liveNewsMap, liveNewsEnabled]);

  // Request Desktop Notification Permission
  const requestNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          setFeedbackMsg('🔔 Desktop Notifications Activated for High-Conviction Short Sell Breakdowns!');
          playAlertChime('SHORT_BREAKDOWN');
        } else {
          setFeedbackMsg('⚠️ Browser notifications disabled. You will still receive in-app audio chimes!');
        }
        setTimeout(() => setFeedbackMsg(null), 4000);
      });
    }
  };

  // Filtered Candidates
  const filteredCandidates = useMemo(() => {
    let list = scanResults.candidates || [];

    if (activeFilter === 'MSCI_DUMPS') {
      list = list.filter((s) => s.strategyType === 'MSCI_INDEX_OUTFLOW' || s.blockOutflowCr >= 100);
    } else if (activeFilter === 'GAP_DOWN') {
      list = list.filter((s) => s.gapPct <= -0.5 || s.strategyType === 'GAP_DOWN_CONTINUATION');
    } else if (activeFilter === 'ORB_BREAKDOWN') {
      list = list.filter((s) => s.strategyType === '15MIN_ORB_BREAKDOWN' || s.strategyType === 'VWAP_BREAKDOWN');
    } else if (activeFilter === 'HIGH_CONVICTION') {
      list = list.filter((s) => s.score >= 80);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.companyName.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q) ||
          s.newsHeadline.toLowerCase().includes(q)
      );
    }

    return list;
  }, [scanResults.candidates, activeFilter, searchQuery]);

  return (
    <div className="short-sell-radar-module container-fluid px-0 pb-5">
      {/* ── 1. HEADER & GLOBAL CUES HERO BANNER ── */}
      <div
        className="card border-0 shadow-sm rounded-4 p-4 mb-4 text-white overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #450a0a 0%, #1c1917 100%)' }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-danger text-white px-3 py-1.5 fw-bold fs-6 shadow-sm">
                🔻 SHORT SELL RADAR
              </span>
              <span className="badge bg-warning text-dark fw-bold">
                DOWN AT OPEN & NEWS CATALYSTS
              </span>
            </div>
            <h3 className="fw-bold mb-0">Intraday Short Breakdown & Negative News Scanner</h3>
            <p className="text-light opacity-75 small mb-0 mt-1">
              Filter stocks breaking down at 9:15 AM market open, suffering from MSCI index deletions, promoter selling, or trading strictly below VWAP.
            </p>
          </div>

          {/* Quick Notification & Sound Controls */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              className={`btn btn-sm ${liveNewsEnabled ? 'btn-danger text-white' : 'btn-outline-light'}`}
              onClick={() => setLiveNewsEnabled(!liveNewsEnabled)}
              title="Toggle Live News Sentiment Integration"
            >
              {newsLoading ? '⏳ Fetching News...' : liveNewsEnabled ? '📰 Live News: ON' : '📰 Live News: OFF'}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${soundAlertsEnabled ? 'btn-outline-warning' : 'btn-outline-secondary text-white'}`}
              onClick={() => setSoundAlertsEnabled(!soundAlertsEnabled)}
              title="Toggle Audio Breakdown Chimes"
            >
              {soundAlertsEnabled ? '🔊 Sound ON' : '🔇 Sound OFF'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-light fw-bold"
              onClick={requestNotificationPermission}
            >
              🔔 Desktop Alerts
            </button>
          </div>
        </div>

        {/* Global Macro Short Alignment Bar */}
        <div className="row g-2.5 mt-1">
          <div className="col-12 col-md-3">
            <div className="p-3 rounded-3 bg-white bg-opacity-10 border border-light border-opacity-10 h-100">
              <span className="text-light opacity-75 small d-block">GIFT Nifty Sentiment</span>
              <h5 className="fw-bold mb-0 mt-1 text-danger">🔴 -65 Pts (Gap Down Open)</h5>
              <span className="small text-light opacity-90" style={{ fontSize: 11 }}>Opening Range Breakdown Tailwinds</span>
            </div>
          </div>
          <div className="col-12 col-md-3">
            <div className="p-3 rounded-3 bg-white bg-opacity-10 border border-light border-opacity-10 h-100">
              <span className="text-light opacity-75 small d-block">India VIX (Downside Volatility)</span>
              <h5 className="fw-bold mb-0 mt-1 text-warning">⚡ 15.8 (+4.2%) Elevated</h5>
              <span className="small text-light opacity-90" style={{ fontSize: 11 }}>Favors Intraday Short Expansion</span>
            </div>
          </div>
          <div className="col-12 col-md-3">
            <div className="p-3 rounded-3 bg-white bg-opacity-10 border border-light border-opacity-10 h-100">
              <span className="text-light opacity-75 small d-block">Global Overnight Cue</span>
              <h5 className="fw-bold mb-0 mt-1 text-danger">📉 US Tech Sell-Off</h5>
              <span className="small text-light opacity-90" style={{ fontSize: 11 }}>Nasdaq -1.4% • Crude Oil +1.8%</span>
            </div>
          </div>
          <div className="col-12 col-md-3">
            <div className="p-3 rounded-3 bg-white bg-opacity-10 border border-light border-opacity-10 h-100">
              <span className="text-light opacity-75 small d-block">High-Conviction Short Picks</span>
              <h5 className="fw-bold mb-0 mt-1 text-white">
                🔥 {scanResults.highConvictionCount} Setups Active
              </h5>
              <span className="small text-light opacity-90" style={{ fontSize: 11 }}>Score &ge; 80/100 (Below VWAP)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. FEEDBACK / ALERT TOAST ── */}
      {feedbackMsg && (
        <div className="alert alert-info border-2 border-info shadow-sm rounded-4 p-3 mb-4 fw-bold text-dark animate-pulse">
          {feedbackMsg}
        </div>
      )}

      {/* ── 3. FILTER TABS & SEARCH BAR ── */}
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-light">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          {/* Catalyst Filter Pills */}
          <div className="d-flex flex-wrap gap-2">
            {[
              { key: 'ALL', label: `All Short Candidates (${scanResults.candidates?.length || 0})` },
              { key: 'HIGH_CONVICTION', label: `🔥 High Conviction (${scanResults.highConvictionCount || 0})` },
              { key: 'MSCI_DUMPS', label: '🏢 MSCI Outflows & Block Dumps' },
              { key: 'GAP_DOWN', label: '⚡ 9:15 AM Gap Down Openers' },
              { key: 'ORB_BREAKDOWN', label: '📉 15-Min ORB Low Breakdown' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold shadow-sm ${
                  activeFilter === f.key ? 'btn-danger text-white' : 'btn-outline-secondary bg-white'
                }`}
                onClick={() => setActiveFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search & View Switcher */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <input
              type="text"
              className="form-control form-control-sm rounded-pill px-3 shadow-sm"
              placeholder="Search symbol, sector, news..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 220 }}
            />

            <div className="btn-group btn-group-sm shadow-sm" role="group">
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'cards' ? 'btn-danger text-white' : 'btn-outline-secondary bg-white'}`}
                onClick={() => setViewMode('cards')}
              >
                Cards
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'table' ? 'btn-danger text-white' : 'btn-outline-secondary bg-white'}`}
                onClick={() => setViewMode('table')}
              >
                Table
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'auto' ? 'btn-danger text-white' : 'btn-outline-secondary bg-white'}`}
                onClick={() => setViewMode('auto')}
              >
                Auto
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. CANDIDATES DISPLAY (CARDS / TABLE) ── */}
      {filteredCandidates.length === 0 ? (
        <div className="text-center py-5 text-muted bg-white rounded-4 border border-dashed">
          <span className="fs-1 d-block mb-2">🔍</span>
          <h5 className="fw-bold text-dark">No Short Setups Found</h5>
          <p className="small mb-0">Try changing your search filter or selecting "All Short Candidates".</p>
        </div>
      ) : (
        <>
          {/* CARDS VIEW (Mobile + Optional Desktop) */}
          <div className={`row g-3 ${viewMode === 'table' ? 'd-none' : viewMode === 'auto' ? 'd-flex d-lg-none' : 'd-flex'}`}>
            {filteredCandidates.map((stock) => (
              <div className="col-12 col-md-6" key={`card-${stock.symbol}`}>
                <div className="card border-0 shadow-sm rounded-4 p-3.5 h-100 bg-white position-relative overflow-hidden">
                  {/* Top Header */}
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-dark fs-6 px-2.5 py-1 fw-bold">{stock.symbol}</span>
                        <h6 className="fw-bold mb-0 text-dark text-truncate" style={{ maxWidth: 180 }}>
                          {stock.companyName}
                        </h6>
                      </div>
                      <small className="text-muted">{stock.sector}</small>
                    </div>

                    <div className="text-end">
                      <span className={`badge bg-${stock.badgeColor} text-white fw-bold px-2.5 py-1`}>
                        🎯 Score: {stock.score}/100
                      </span>
                      <div className="fs-5 fw-bold text-dark mt-0.5">₹{stock.price.toFixed(2)}</div>
                      <small className="fw-bold text-danger">▼ {stock.pChange}%</small>
                    </div>
                  </div>

                  {/* News Catalyst Banner */}
                  <div className="p-2.5 rounded-3 bg-danger bg-opacity-10 border border-danger border-opacity-25 mb-2.5">
                    <span className="badge bg-danger text-white fw-bold small mb-1">{stock.catalystBadge}</span>
                    <p className="small text-dark mb-0 fw-semibold" style={{ lineHeight: '1.4' }}>
                      {stock.newsHeadline}
                    </p>
                  </div>

                  {/* 📊 Live Buyer vs Seller Meter */}
                  <BuyerDemandMeter stock={stock} />

                  {/* Key Short Levels */}
                  <div className="row g-2 small mb-3">
                    <div className="col-6 col-md-3">
                      <div className="p-2 rounded bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 11 }}>Short Entry:</span>
                        <strong className="text-dark">₹{stock.entryPrice.toFixed(2)}</strong>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="p-2 rounded bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 11 }}>Stop Loss (Risk):</span>
                        <strong className="text-danger">₹{stock.stopLoss.toFixed(2)} (+{stock.riskPct}%)</strong>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="p-2 rounded bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 11 }}>Target 1 (1:2):</span>
                        <strong className="text-success">₹{stock.target1.toFixed(2)} ({stock.target1Pct}%)</strong>
                      </div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="p-2 rounded bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 11 }}>Target 2 (Dump):</span>
                        <strong className="text-success">₹{stock.target2.toFixed(2)} ({stock.target2Pct}%)</strong>
                      </div>
                    </div>
                  </div>

                  {/* Technical Checklist Pills */}
                  <div className="d-flex flex-wrap gap-1.5 mb-3">
                    {stock.shortChecklist.slice(0, 3).map((item, idx) => (
                      <span key={idx} className="badge bg-light text-dark border small fw-normal">
                        ✓ {item}
                      </span>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-auto pt-2 border-top">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm rounded-pill px-3 fw-semibold"
                      onClick={() => setSelectedModalStock(stock)}
                    >
                      📈 View Chart
                    </button>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm rounded-pill px-3 fw-bold"
                        onClick={() => setGrowwGuideStock(stock)}
                        title="View Groww App Intraday MIS Steps"
                      >
                        📱 Groww Guide
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm rounded-pill px-3 fw-bold shadow-sm"
                        onClick={() => {
                          if (onOpenPractice) {
                            onOpenPractice(stock);
                          } else {
                            setSelectedModalStock(stock);
                          }
                        }}
                      >
                        ⚡ Practice Short
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* TABLE VIEW (Desktop Multi-Column) */}
          <div className={`card border-0 shadow-sm rounded-4 overflow-hidden bg-white ${viewMode === 'cards' ? 'd-none' : viewMode === 'auto' ? 'd-none d-lg-block' : 'd-block'}`}>
            <div className="table-responsive st-responsive-table-container">
              <table className="table table-hover align-middle small mb-0">
                <thead className="table-dark">
                  <tr>
                    <th>Stock & Sector</th>
                    <th>Conviction</th>
                    <th>Catalyst & News Headline</th>
                    <th>Current Price</th>
                    <th>Short Entry</th>
                    <th>Stop Loss (Risk)</th>
                    <th>Target 1 (1:2 R:R)</th>
                    <th>Target 2 (Dump)</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((stock) => (
                    <tr key={`table-${stock.symbol}`}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge bg-dark px-2.5 py-1 fw-bold">{stock.symbol}</span>
                          <div>
                            <strong className="text-dark d-block">{stock.companyName}</strong>
                            <small className="text-muted">{stock.sector}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge bg-${stock.badgeColor} text-white fw-bold px-2.5 py-1`}>
                          {stock.score}/100 ({stock.conviction === 'HIGH_CONVICTION_SHORT' ? '🔥 HIGH' : 'MODERATE'})
                        </span>
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        <span className="badge bg-danger text-white small mb-1">{stock.catalystBadge}</span>
                        <div className="text-dark fw-semibold text-truncate" title={stock.newsHeadline}>
                          {stock.newsHeadline}
                        </div>
                      </td>
                      <td>
                        <strong className="fs-6 text-dark d-block">₹{stock.price.toFixed(2)}</strong>
                        <small className="fw-bold text-danger">▼ {stock.pChange}%</small>
                      </td>
                      <td>
                        <strong className="text-dark">₹{stock.entryPrice.toFixed(2)}</strong>
                        <small className="text-muted d-block">VWAP: ₹{stock.vwap.toFixed(2)}</small>
                      </td>
                      <td>
                        <strong className="text-danger">₹{stock.stopLoss.toFixed(2)}</strong>
                        <small className="text-muted d-block">+{stock.riskPct}% Risk</small>
                      </td>
                      <td>
                        <strong className="text-success">₹{stock.target1.toFixed(2)}</strong>
                        <small className="text-success d-block">{stock.target1Pct}%</small>
                      </td>
                      <td>
                        <strong className="text-success">₹{stock.target2.toFixed(2)}</strong>
                        <small className="text-success d-block">{stock.target2Pct}%</small>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1.5">
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-xs rounded-pill px-2.5 fw-semibold"
                            onClick={() => setSelectedModalStock(stock)}
                            title="Interactive Chart"
                          >
                            📈 Chart
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-xs rounded-pill px-2.5 fw-bold"
                            onClick={() => setGrowwGuideStock(stock)}
                            title="Groww MIS Order Guide"
                          >
                            📱 Groww
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-xs rounded-pill px-2.5 fw-bold shadow-sm"
                            onClick={() => {
                              if (onOpenPractice) {
                                onOpenPractice(stock);
                              } else {
                                setSelectedModalStock(stock);
                              }
                            }}
                          >
                            ⚡ Short
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── 5. GROWW MIS ORDER INSTRUCTIONS MODAL ── */}
      {growwGuideStock && (
        <div className="modal d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-danger text-white px-4 py-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <span className="fs-5">📱</span>
                  <h5 className="modal-title fw-bold mb-0">How to Short Sell {growwGuideStock.symbol} in Groww</h5>
                </div>
                <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={() => setGrowwGuideStock(null)} />
              </div>

              <div className="modal-body p-4 bg-light">
                <div className="p-3 bg-white rounded-3 border mb-3">
                  <h6 className="fw-bold mb-2 text-dark">📋 Exact Groww Order Parameters:</h6>
                  <div className="list-group list-group-flush small">
                    <div className="list-group-item d-flex justify-content-between px-0">
                      <span className="text-muted">Stock Symbol:</span>
                      <strong className="text-dark">{growwGuideStock.symbol} ({growwGuideStock.companyName})</strong>
                    </div>
                    <div className="list-group-item d-flex justify-content-between px-0">
                      <span className="text-muted">Action:</span>
                      <strong className="badge bg-danger fs-7">🔴 SELL</strong>
                    </div>
                    <div className="list-group-item d-flex justify-content-between px-0">
                      <span className="text-muted">Product Type:</span>
                      <strong className="badge bg-warning text-dark fs-7">INTRADAY (MIS)</strong>
                    </div>
                    <div className="list-group-item d-flex justify-content-between px-0">
                      <span className="text-muted">Entry Price:</span>
                      <strong className="text-dark">₹{growwGuideStock.entryPrice.toFixed(2)} (Market or Limit)</strong>
                    </div>
                    <div className="list-group-item d-flex justify-content-between px-0">
                      <span className="text-muted">Add Stop-Loss Trigger:</span>
                      <strong className="text-danger">₹{growwGuideStock.stopLoss.toFixed(2)} (Above VWAP)</strong>
                    </div>
                    <div className="list-group-item d-flex justify-content-between px-0">
                      <span className="text-muted">Target (Buy back to cover):</span>
                      <strong className="text-success">₹{growwGuideStock.target1.toFixed(2)} (-{Math.abs(growwGuideStock.target1Pct)}%)</strong>
                    </div>
                  </div>
                </div>

                <div className="alert alert-warning small mb-0">
                  <strong>⏰ Remember:</strong> Intraday MIS trades on Groww auto-square off at <strong>03:15 PM</strong>. Always exit manually before 3:10 PM to avoid the ₹50 auto-square-off charge!
                </div>
              </div>

              <div className="modal-footer bg-white px-4 py-2.5">
                <button type="button" className="btn btn-secondary btn-sm rounded-pill px-4" onClick={() => setGrowwGuideStock(null)}>
                  Got It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Candlestick Modal */}
      {selectedModalStock && (
        <StockDetailModal
          stock={selectedModalStock}
          onClose={() => setSelectedModalStock(null)}
        />
      )}
    </div>
  );
}
