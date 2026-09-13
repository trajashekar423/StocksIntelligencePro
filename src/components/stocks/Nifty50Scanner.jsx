'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import StockDetailModal from './StockDetailModal';
import BuyerDemandMeter from './BuyerDemandMeter';
import { NSE_INDEX_CATEGORIES } from '../../services/niftyIndexDirectory';

const STORAGE_PORTFOLIO_KEY = 'user_selected_portfolio_stocks';
const STORAGE_PAPER_POSITIONS_KEY = 'intraday_paper_positions_store';

export default function Nifty50Scanner({ onQuickTrade = null }) {
  const [selectedIndex, setSelectedIndex] = useState('NIFTY 50');
  const [data, setData] = useState({
    indexStatus: null,
    ranked: [],
    top5: [],
    totalCount: 0,
    superStrongCount: 0,
    strongCount: 0,
    watchCount: 0,
    lastUpdated: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // in seconds
  const [countdown, setCountdown] = useState(30);

  // View Mode: 'table' or 'cards'
  const [viewMode, setViewMode] = useState('table');

  // Filters
  const [minScore, setMinScore] = useState(0);
  const [minChange, setMinChange] = useState(0);
  const [minVolumeRatio, setMinVolumeRatio] = useState(0);
  const [signalFilter, setSignalFilter] = useState('ALL');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [breakoutOnly, setBreakoutOnly] = useState(false);
  const [aboveVwapOnly, setAboveVwapOnly] = useState(false);
  const [tenPctOnly, setTenPctOnly] = useState(false);
  const [rrTwoOnly, setRrTwoOnly] = useState(false);

  // Modals & User Feedback
  const [selectedStockForChart, setSelectedStockForChart] = useState(null);
  const [paperTradeStock, setPaperTradeStock] = useState(null);
  const [paperQuantity, setPaperQuantity] = useState(50);
  const [paperMessage, setPaperMessage] = useState(null);
  const [portfolioAddedMap, setPortfolioAddedMap] = useState({});

  // 1. Fetch live strategy data for chosen index
  const fetchData = useCallback(
    async (indexOverride) => {
      const targetIndex = typeof indexOverride === 'string' ? indexOverride : selectedIndex;
      try {
        setError(null);
        setLoading(true);
        const res = await fetch(`/api/scanner/nifty50?index=${encodeURIComponent(targetIndex)}`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const json = await res.json();
        if (json.success) {
          setData({
            indexStatus: json.indexStatus,
            ranked: json.ranked || [],
            top5: json.top5 || [],
            totalCount: json.totalCount || 0,
            superStrongCount: json.superStrongCount || 0,
            strongCount: json.strongCount || 0,
            watchCount: json.watchCount || 0,
            lastUpdated: json.lastUpdated || new Date().toLocaleTimeString('en-IN'),
          });
        } else {
          throw new Error(json.error || 'Failed to load strategy data');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setCountdown(refreshInterval);
      }
    },
    [selectedIndex, refreshInterval]
  );

  const handleIndexChange = (e) => {
    const newIdx = e.target.value;
    setSelectedIndex(newIdx);
    fetchData(newIdx);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh interval timer
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, fetchData]);

  // Filter options: Unique sectors list
  const availableSectors = useMemo(() => {
    const set = new Set();
    data.ranked.forEach((s) => {
      if (s.sector) set.add(s.sector);
    });
    return Array.from(set).sort();
  }, [data.ranked]);

  // Filtered stocks list
  const filteredStocks = useMemo(() => {
    return data.ranked.filter((stock) => {
      if (stock.score < minScore) return false;
      if (stock.changePercent < minChange) return false;
      if (stock.volumeRatio < minVolumeRatio) return false;
      if (signalFilter !== 'ALL' && !stock.classification.includes(signalFilter)) return false;
      if (sectorFilter !== 'ALL' && stock.sector !== sectorFilter) return false;
      if (breakoutOnly && stock.distanceFromHigh > 1.2) return false;
      if (aboveVwapOnly && !stock.isAboveVwap) return false;
      if (tenPctOnly && !stock.tenPercentFeasible) return false;
      if (rrTwoOnly && stock.riskReward < 2.0) return false;
      return true;
    });
  }, [
    data.ranked,
    minScore,
    minChange,
    minVolumeRatio,
    signalFilter,
    sectorFilter,
    breakoutOnly,
    aboveVwapOnly,
    tenPctOnly,
    rrTwoOnly,
  ]);

  // 1-Click Add to My Portfolio
  const handleAddToPortfolio = (stock) => {
    try {
      const saved = localStorage.getItem(STORAGE_PORTFOLIO_KEY);
      const list = saved ? JSON.parse(saved) : [];
      if (!list.some((s) => s.symbol === stock.symbol)) {
        const newEntry = {
          symbol: stock.symbol,
          companyName: stock.company,
          price: stock.ltp,
          previousClose: stock.previousClose,
          dayHigh: stock.high,
          dayLow: stock.low,
          sharesOwned: 50,
          buyPrice: stock.ltp,
          support: stock.stopLoss,
          resistance: stock.target2,
          target1: stock.target1,
          target2: stock.target2,
          target3: stock.target3,
          stopLoss: stock.stopLoss,
          riskReward: stock.riskReward,
          lastUpdated: 'Live',
        };
        list.unshift(newEntry);
        localStorage.setItem(STORAGE_PORTFOLIO_KEY, JSON.stringify(list));
      }
      setPortfolioAddedMap((prev) => ({ ...prev, [stock.symbol]: true }));
    } catch {
      // ignore
    }
  };

  // Submit Paper Trade
  const handleExecutePaperTrade = (e) => {
    e.preventDefault();
    if (!paperTradeStock) return;
    try {
      const saved = localStorage.getItem(STORAGE_PAPER_POSITIONS_KEY);
      const positions = saved ? JSON.parse(saved) : [];
      const newPos = {
        id: `paper-nifty50-${paperTradeStock.symbol}-${Date.now()}`,
        symbol: paperTradeStock.symbol,
        company: paperTradeStock.company,
        mode: 'PAPER',
        quantity: paperQuantity,
        entryPrice: paperTradeStock.ltp,
        currentPrice: paperTradeStock.ltp,
        stopLoss: paperTradeStock.stopLoss,
        trailingSL: paperTradeStock.stopLoss,
        target: paperTradeStock.target2,
        target1: paperTradeStock.target1,
        target2: paperTradeStock.target2,
        target3: paperTradeStock.target3,
        openedAt: new Date().toLocaleTimeString('en-IN'),
        status: 'OPEN',
      };
      positions.unshift(newPos);
      localStorage.setItem(STORAGE_PAPER_POSITIONS_KEY, JSON.stringify(positions));
      setPaperMessage(`✓ Simulated Buy Order Placed for ${paperQuantity} shares of ${paperTradeStock.symbol}!`);
      setTimeout(() => {
        setPaperTradeStock(null);
        setPaperMessage(null);
      }, 1400);
    } catch {
      setPaperMessage('Failed to store paper order.');
    }
  };

  return (
    <div className="nifty50-strategy-module w-100">
      {/* ── 1. HEADER & MARKET STATUS DASHBOARD ── */}
      <div
        className="card border-0 shadow-sm rounded-4 overflow-hidden text-white mb-4 p-3 p-md-4"
        style={{ background: 'linear-gradient(135deg, #06101e 0%, #0c2340 50%, #172554 100%)' }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="fs-3">🇮🇳</span>
              <h4 className="mb-0 fw-bold">{selectedIndex} MOMENTUM & BREAKOUT SCANNER</h4>
              <span className="badge bg-success px-2.5 py-1 fw-bold fs-6 shadow-sm">
                ● LIVE {selectedIndex}
              </span>
            </div>
            <p className="text-light opacity-75 small mb-0 mt-1">
              Dynamic multi-factor analysis across <strong>{selectedIndex}</strong> index constituents. Identifies top momentum setups, breakout triggers, and realistic <strong>+3%, +5%, and +10% swing targets</strong>.
            </p>
          </div>

          {/* Index Selector & Controls */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            {/* NSE INDEX SELECTOR DROPDOWN */}
            <div className="d-flex align-items-center gap-1.5 bg-dark bg-opacity-75 p-1 px-2.5 rounded-3 border border-warning border-opacity-35 shadow-sm">
              <span className="text-warning fw-bold small text-nowrap">📑 Index:</span>
              <select
                className="form-select form-select-sm bg-black text-warning fw-bold border-0 py-1"
                style={{ minWidth: 210, fontSize: 12 }}
                value={selectedIndex}
                onChange={handleIndexChange}
              >
                {NSE_INDEX_CATEGORIES.map((group) => (
                  <optgroup key={group.category} label={group.category}>
                    {group.indices.map((idx) => (
                      <option key={idx.id} value={idx.id}>
                        {idx.name} ({idx.description})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Auto Refresh */}
            <div className="btn-group btn-group-sm bg-dark bg-opacity-60 p-1 rounded-3 border border-light border-opacity-10 shadow-sm">
              <button
                type="button"
                className={`btn btn-sm fw-semibold ${autoRefresh ? 'btn-primary text-white' : 'btn-outline-light'}`}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? `⏱️ Auto: ${countdown}s` : '⏸️ Paused'}
              </button>
              <select
                className="form-select form-select-sm bg-dark text-white border-0 py-0"
                style={{ width: 'auto', fontSize: 12 }}
                value={refreshInterval}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setRefreshInterval(val);
                  setCountdown(val);
                }}
              >
                <option value={15}>15s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={300}>5m</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-light d-flex align-items-center gap-1 shadow-sm px-3 fw-semibold"
              onClick={() => fetchData()}
              disabled={loading}
            >
              {loading ? <span className="spinner-border spinner-border-sm" /> : '🔄 Rescan'}
            </button>
          </div>
        </div>

        {/* NIFTY INDEX SNAPSHOT STRIP (Responsive 6-card row) */}
        <div className="row g-2 g-md-3 pt-3 border-top border-light border-opacity-10 align-items-center text-center">
          <div className="col-6 col-sm-4 col-lg-2">
            <div className="p-2.5 rounded-3 bg-dark bg-opacity-50 border border-light border-opacity-10 h-100 d-flex flex-column justify-content-center">
              <span className="text-light opacity-75 d-block text-truncate px-1" style={{ fontSize: 10.5 }}>{selectedIndex}</span>
              <strong className="fs-6 text-warning mt-1">
                ₹{Number(data.indexStatus?.niftyLtp || 24365).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </strong>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-lg-2">
            <div className="p-2.5 rounded-3 bg-dark bg-opacity-50 border border-light border-opacity-10 h-100 d-flex flex-column justify-content-center">
              <span className="text-light opacity-75 d-block" style={{ fontSize: 11 }}>DAY CHANGE</span>
              <strong className={`fs-6 mt-1 ${Number(data.indexStatus?.niftyChange || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                {Number(data.indexStatus?.niftyChange || 0) >= 0 ? '+' : ''}
                {Number(data.indexStatus?.niftyChange || 0).toFixed(1)} (
                {Number(data.indexStatus?.niftyChangePct || 0) >= 0 ? '+' : ''}
                {Number(data.indexStatus?.niftyChangePct || 0).toFixed(2)}%)
              </strong>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-lg-2">
            <div className="p-2.5 rounded-3 bg-dark bg-opacity-50 border border-light border-opacity-10 h-100 d-flex flex-column justify-content-center">
              <span className="text-light opacity-75 d-block" style={{ fontSize: 11 }}>NIFTY VWAP</span>
              <strong className="fs-6 text-light mt-1">
                ₹{Number(data.indexStatus?.niftyVwap || data.indexStatus?.niftyLtp || 24345).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </strong>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-lg-2">
            <div className="p-2.5 rounded-3 bg-dark bg-opacity-50 border border-light border-opacity-10 h-100 d-flex flex-column justify-content-center">
              <span className="text-light opacity-75 d-block" style={{ fontSize: 11 }}>EMA 9 / 20</span>
              <strong className="fs-6 text-light mt-1">
                {Number(data.indexStatus?.niftyEma9 || 24350).toFixed(0)} / {Number(data.indexStatus?.niftyEma20 || 24310).toFixed(0)}
              </strong>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-lg-2">
            <div className="p-2.5 rounded-3 bg-dark bg-opacity-50 border border-light border-opacity-10 h-100 d-flex flex-column justify-content-center">
              <span className="text-light opacity-75 d-block" style={{ fontSize: 11 }}>MARKET TREND</span>
              <strong className="fs-6 text-success mt-1">
                {data.indexStatus?.marketTrend || 'BULLISH 🟢'}
              </strong>
            </div>
          </div>
          <div className="col-6 col-sm-4 col-lg-2">
            <div className="p-2.5 rounded-3 bg-dark bg-opacity-50 border border-light border-opacity-10 h-100 d-flex flex-column justify-content-center">
              <span className="text-light opacity-75 d-block" style={{ fontSize: 11 }}>CONSTITUENTS</span>
              <strong className="fs-6 text-white mt-1">{data.ranked.length} / 50 Live</strong>
            </div>
          </div>
        </div>

        {/* SAFETY & RISK DISCLAIMER */}
        <div className="mt-3 p-2.5 rounded-3 bg-dark bg-opacity-60 border border-warning border-opacity-25 small text-light d-flex align-items-center gap-2">
          <span className="text-warning fs-5">⚠️</span>
          <span style={{ fontSize: 11.5 }}>
            <strong>Important Safety Notice:</strong> Signals are algorithmic research and paper-trading signals, not guaranteed returns. A 10% target is an objective, not a guaranteed profit. Always size trades appropriately and respect stop-loss invalidation levels.
          </span>
        </div>
      </div>

      {/* ── 2. 🔥 TOP 5 NIFTY50 SETUPS (Responsive Cards Grid) ── */}
      <div className="mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <h5 className="fw-bold text-dark d-flex align-items-center gap-2 mb-0">
            <span>🔥</span> TOP 5 NIFTY50 SETUPS (Highest Conviction)
          </h5>
          <span className="badge bg-primary-subtle text-primary fw-bold px-3 py-1.5 rounded-pill">
            Highest Score Ranked
          </span>
        </div>

        <div className="row g-3">
          {data.top5.map((stock) => {
            const isAdded = portfolioAddedMap[stock.symbol];
            return (
              <div className="col-12 col-md-6 col-xl-4" key={stock.symbol}>
                <div className="card h-100 border-0 shadow-sm rounded-4 p-3 bg-white border-top border-4 border-primary d-flex flex-column justify-content-between transition-all">
                  <div>
                    {/* Header */}
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-2 pb-2 border-bottom">
                      <div>
                        <div className="d-flex flex-wrap align-items-center gap-1.5">
                          <span className="badge bg-dark fs-6 px-2.5 py-1 fw-bold">{stock.symbol}</span>
                          <span className={`badge ${stock.score >= 90 ? 'bg-danger' : 'bg-success'} px-2 py-1 small fw-bold`}>
                            {stock.classification}
                          </span>
                        </div>
                        <div className="small text-muted fw-semibold text-truncate mt-1" style={{ maxWidth: 200 }}>
                          {stock.company}
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="fs-5 fw-bold text-dark font-monospace">₹{stock.ltp.toFixed(2)}</div>
                        <span className="badge bg-success-subtle text-success fw-bold">
                          +{stock.changePercent.toFixed(2)}% ▲
                        </span>
                      </div>
                    </div>

                    {/* Score & Live Buyer Demand Meter */}
                    <BuyerDemandMeter stock={stock} />
                    <div className="p-2 rounded-3 bg-light border mb-2.5 d-flex align-items-center justify-content-between small">
                      <span className="text-muted fw-semibold">Score:</span>
                      <strong className="fs-6 text-primary">{stock.score} / 100</strong>
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle fw-semibold">
                        R:R {stock.riskReward}:1
                      </span>
                    </div>

                    {/* Entry & Targets Grid (Balanced 2x3 layout) */}
                    <div className="row g-1.5 small text-center mb-2.5">
                      <div className="col-6">
                        <div className="p-2 rounded-2 bg-light border h-100">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>Entry Zone</span>
                          <strong className="text-dark font-monospace" style={{ fontSize: 12 }}>{stock.entryZone}</strong>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="p-2 rounded-2 bg-light border h-100">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>Stop Loss (SL)</span>
                          <strong className="text-danger font-monospace" style={{ fontSize: 12 }}>₹{stock.stopLoss.toFixed(2)}</strong>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="p-1.5 rounded-2 bg-light border h-100">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>T1 (+3%)</span>
                          <strong className="text-success font-monospace" style={{ fontSize: 11.5 }}>₹{stock.target1.toFixed(0)}</strong>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="p-1.5 rounded-2 bg-light border h-100">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>T2 (+5%)</span>
                          <strong className="text-success font-monospace" style={{ fontSize: 11.5 }}>₹{stock.target2.toFixed(0)}</strong>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="p-1.5 rounded-2 bg-light border h-100">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>T3 (10%)</span>
                          <strong className={`font-monospace ${stock.tenPercentFeasible ? 'text-primary' : 'text-muted text-decoration-line-through'}`} style={{ fontSize: 11.5 }}>
                            ₹{stock.target3.toFixed(0)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* 10% Target Availability Note */}
                    <div className="mb-2.5">
                      <div
                        className={`p-1.5 rounded-2 small text-center ${
                          stock.tenPercentFeasible
                            ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25'
                            : 'bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25'
                        }`}
                        style={{ fontSize: 11 }}
                      >
                        {stock.tenPercentNote}
                      </div>
                    </div>

                    {/* Why It Qualifies Checklist */}
                    <div className="p-2.5 rounded-3 bg-success bg-opacity-10 border border-success border-opacity-25 small mb-3">
                      <span className="fw-bold text-success d-block mb-1">✓ Why it qualifies:</span>
                      <ul className="mb-0 ps-3 text-dark" style={{ fontSize: 11 }}>
                        {stock.keyReasons.slice(0, 4).map((r, i) => (
                          <li key={i} className="mb-0.5">{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Top 5 Card Actions */}
                  <div className="d-flex align-items-center justify-content-between gap-1.5 pt-2 border-top mt-auto">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold flex-grow-1"
                      onClick={() => setSelectedStockForChart(stock)}
                    >
                      📈 Chart
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill fw-bold px-3 ${
                        isAdded ? 'btn-secondary' : 'btn-outline-dark'
                      }`}
                      onClick={() => handleAddToPortfolio(stock)}
                      title="Add to My Portfolio"
                    >
                      {isAdded ? '✓ Added' : '💼 +'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-success rounded-pill fw-bold px-3 shadow-sm flex-grow-1"
                      onClick={() => {
                        setPaperTradeStock(stock);
                        setPaperQuantity(Math.max(10, Math.round(50000 / stock.ltp)));
                      }}
                    >
                      ⚡ Trade
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. FILTERS & CONTROLS TOOLBAR ── */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 bg-white mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 pb-2 border-bottom">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold text-dark small">⚙️ SCANNER FILTERS & PARAMETERS</span>
            <span className="badge bg-light text-secondary border small">{filteredStocks.length} matching</span>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* View Mode Toggle (Table vs Cards) */}
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('table')}
              >
                📊 Table View
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setViewMode('cards')}
              >
                🗂️ Cards View
              </button>
            </div>

            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none small text-muted ms-2"
              onClick={() => {
                setMinScore(0);
                setMinChange(0);
                setMinVolumeRatio(0);
                setSignalFilter('ALL');
                setSectorFilter('ALL');
                setBreakoutOnly(false);
                setAboveVwapOnly(false);
                setTenPctOnly(false);
                setRrTwoOnly(false);
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>

        <div className="row g-2.5 small">
          <div className="col-6 col-sm-4 col-md-3 col-lg-2">
            <label className="text-muted d-block mb-1" style={{ fontSize: 11 }}>Min Score</label>
            <select
              className="form-select form-select-sm"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
            >
              <option value={0}>All Scores</option>
              <option value={70}>70+ (Watch+)</option>
              <option value={80}>80+ (Strong+)</option>
              <option value={90}>90+ (Super Strong)</option>
            </select>
          </div>

          <div className="col-6 col-sm-4 col-md-3 col-lg-2">
            <label className="text-muted d-block mb-1" style={{ fontSize: 11 }}>Min Change %</label>
            <select
              className="form-select form-select-sm"
              value={minChange}
              onChange={(e) => setMinChange(Number(e.target.value))}
            >
              <option value={0}>All Changes</option>
              <option value={1}>+1.0%+</option>
              <option value={2}>+2.0%+</option>
              <option value={3}>+3.0%+</option>
            </select>
          </div>

          <div className="col-6 col-sm-4 col-md-3 col-lg-2">
            <label className="text-muted d-block mb-1" style={{ fontSize: 11 }}>Volume Ratio</label>
            <select
              className="form-select form-select-sm"
              value={minVolumeRatio}
              onChange={(e) => setMinVolumeRatio(Number(e.target.value))}
            >
              <option value={0}>All Volumes</option>
              <option value={1.5}>&ge; 1.5x Avg</option>
              <option value={2.0}>&ge; 2.0x Avg</option>
            </select>
          </div>

          <div className="col-6 col-sm-4 col-md-3 col-lg-2">
            <label className="text-muted d-block mb-1" style={{ fontSize: 11 }}>Signal Tier</label>
            <select
              className="form-select form-select-sm"
              value={signalFilter}
              onChange={(e) => setSignalFilter(e.target.value)}
            >
              <option value="ALL">All Signals</option>
              <option value="SUPER STRONG">Super Strong 🔥</option>
              <option value="STRONG">Strong 🟢</option>
              <option value="WATCH">Watch 🟡</option>
            </select>
          </div>

          <div className="col-12 col-sm-8 col-md-6 col-lg-4">
            <label className="text-muted d-block mb-1" style={{ fontSize: 11 }}>Sector Category</label>
            <select
              className="form-select form-select-sm"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
            >
              <option value="ALL">All Sectors (50 Constituents)</option>
              {availableSectors.map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          {/* Quick Toggle Checkboxes */}
          <div className="col-12 d-flex flex-wrap align-items-center gap-2 pt-2">
            <button
              type="button"
              className={`btn btn-sm rounded-pill fw-semibold px-3 ${
                breakoutOnly ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => setBreakoutOnly(!breakoutOnly)}
            >
              {breakoutOnly ? '✓ Breakout Only' : 'Breakout Only'}
            </button>

            <button
              type="button"
              className={`btn btn-sm rounded-pill fw-semibold px-3 ${
                aboveVwapOnly ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => setAboveVwapOnly(!aboveVwapOnly)}
            >
              {aboveVwapOnly ? '✓ Above VWAP Only' : 'Above VWAP Only'}
            </button>

            <button
              type="button"
              className={`btn btn-sm rounded-pill fw-semibold px-3 ${
                tenPctOnly ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => setTenPctOnly(!tenPctOnly)}
            >
              {tenPctOnly ? '✓ 10% Target Feasible' : '10% Target Feasible'}
            </button>

            <button
              type="button"
              className={`btn btn-sm rounded-pill fw-semibold px-3 ${
                rrTwoOnly ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => setRrTwoOnly(!rrTwoOnly)}
            >
              {rrTwoOnly ? '✓ R:R ≥ 2:1' : 'R:R ≥ 2:1'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 4. MAIN NIFTY50 RANKED TABLE / CARDS VIEW ── */}
      {viewMode === 'table' ? (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white mb-4">
          <div className="card-header bg-light border-bottom px-4 py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h6 className="mb-0 fw-bold text-dark">NIFTY 50 CONSTITUENTS RANKED TABLE</h6>
              <small className="text-muted">
                Showing <strong>{filteredStocks.length}</strong> of {data.ranked.length} stocks sorted by Momentum Score
              </small>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 small">
              <thead className="table-light text-muted" style={{ fontSize: 11 }}>
                <tr>
                  <th className="ps-4">Rank</th>
                  <th>Symbol & Company</th>
                  <th className="text-end">LTP</th>
                  <th className="text-end">Change %</th>
                  <th className="text-center">Buyer Demand</th>
                  <th className="text-end">Volume Ratio</th>
                  <th className="text-end">VWAP</th>
                  <th className="text-center">RSI / MACD</th>
                  <th className="text-center">High Dist</th>
                  <th className="text-center">Score</th>
                  <th className="text-center">Signal</th>
                  <th>Entry Zone</th>
                  <th>Stop Loss</th>
                  <th>Target 1 / 2 / 3</th>
                  <th className="text-center">R:R</th>
                  <th className="pe-4 text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="text-center py-5 text-muted">
                      No NIFTY50 constituents matched your selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock) => {
                    const isAdded = portfolioAddedMap[stock.symbol];
                    return (
                      <tr key={stock.symbol}>
                        <td className="ps-4 fw-bold text-muted">#{stock.rank}</td>
                        <td>
                          <div className="fw-bold text-dark">{stock.symbol}</div>
                          <div className="text-muted text-truncate" style={{ maxWidth: 160, fontSize: 10.5 }}>
                            {stock.company}
                          </div>
                        </td>
                        <td className="text-end fw-bold text-dark font-monospace">₹{stock.ltp.toFixed(2)}</td>
                        <td className="text-end">
                          <span className={`badge ${stock.changePercent >= 0 ? 'bg-success' : 'bg-danger'} px-2 py-1`}>
                            {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="text-center">
                          <BuyerDemandMeter stock={stock} compact />
                        </td>
                        <td className="text-end text-primary fw-semibold">{stock.volumeRatio.toFixed(1)}x</td>
                        <td className="text-end font-monospace">₹{stock.vwap.toFixed(1)}</td>
                        <td className="text-center">
                          <span className="badge bg-light text-dark border me-1">{stock.rsi}</span>
                          <span className={`badge ${stock.macdBullish ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: 9 }}>
                            {stock.macdBullish ? '▲' : '▼'}
                          </span>
                        </td>
                        <td className="text-center font-monospace">
                          <span className={stock.distanceFromHigh <= 1.0 ? 'text-success fw-bold' : 'text-muted'}>
                            {stock.distanceFromHigh.toFixed(1)}%
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-primary text-white px-2 py-1 fw-bold">
                            {stock.score}
                          </span>
                        </td>
                        <td className="text-center">
                          {!stock.isAboveVwap ? (
                            <span className="badge bg-danger text-white px-2 py-1 fw-bold">
                              ❌ DO NOT BUY
                            </span>
                          ) : (
                            <span className={`badge ${stock.score >= 90 ? 'bg-danger' : stock.score >= 80 ? 'bg-success' : 'bg-warning text-dark'} px-2 py-1`}>
                              {stock.signal}
                            </span>
                          )}
                        </td>
                        <td className="font-monospace text-nowrap">
                          {!stock.isAboveVwap ? (
                            <span className="text-danger fw-semibold" style={{ fontSize: 11 }}>
                              ❌ Still dumping below ₹{stock.vwap.toFixed(1)} VWAP. Must cross above ₹{stock.vwap.toFixed(1)} to confirm buyers!
                            </span>
                          ) : (
                            stock.entryZone
                          )}
                        </td>
                        <td className="font-monospace text-danger text-nowrap">₹{stock.stopLoss.toFixed(1)}</td>
                        <td className="font-monospace text-nowrap">
                          <span className="text-success">₹{stock.target1.toFixed(0)}</span> /{' '}
                          <span className="text-success fw-semibold">₹{stock.target2.toFixed(0)}</span> /{' '}
                          <span className={stock.tenPercentFeasible ? 'text-primary fw-bold' : 'text-muted text-decoration-line-through'}>
                            ₹{stock.target3.toFixed(0)}
                          </span>
                        </td>
                        <td className="text-center fw-semibold text-primary">{stock.riskReward}:1</td>
                        <td className="pe-4 text-end text-nowrap">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm rounded-pill px-2.5 py-0.5 me-1"
                            onClick={() => setSelectedStockForChart(stock)}
                            title="Open Chart"
                          >
                            📈
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm rounded-pill px-2.5 py-0.5 me-1 ${isAdded ? 'btn-secondary' : 'btn-outline-dark'}`}
                            onClick={() => handleAddToPortfolio(stock)}
                            title="Add to Portfolio"
                          >
                            {isAdded ? '✓' : '💼'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-success btn-sm rounded-pill px-2.5 py-0.5 fw-bold"
                            onClick={() => {
                              setPaperTradeStock(stock);
                              setPaperQuantity(Math.max(10, Math.round(50000 / stock.ltp)));
                            }}
                          >
                            ⚡ Trade
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View (Mobile/Tablet Friendly) */
        <div className="row g-3 mb-4">
          {filteredStocks.map((stock) => {
            const isAdded = portfolioAddedMap[stock.symbol];
            return (
              <div className="col-12 col-md-6 col-lg-4" key={stock.symbol}>
                <div className="card border-0 shadow-sm rounded-4 p-3 bg-white h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-2 pb-2 border-bottom">
                      <div>
                        <div className="d-flex align-items-center gap-1.5">
                          <span className="badge bg-dark fw-bold">{stock.symbol}</span>
                          <span className="badge bg-primary text-white">{stock.score}/100</span>
                        </div>
                        <div className="small text-muted text-truncate mt-1" style={{ maxWidth: 180 }}>
                          {stock.company}
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="fw-bold font-monospace fs-6">₹{stock.ltp.toFixed(2)}</div>
                        <span className={`badge ${stock.changePercent >= 0 ? 'bg-success' : 'bg-danger'}`}>
                          {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className="row g-1.5 small text-center mb-2">
                      <div className="col-6">
                        <div className={`p-1.5 rounded border ${!stock.isAboveVwap ? 'bg-danger bg-opacity-10 border-danger' : 'bg-light'}`}>
                          <span className={`${!stock.isAboveVwap ? 'text-danger fw-bold' : 'text-muted'} d-block`} style={{ fontSize: 10 }}>
                            {!stock.isAboveVwap ? '❌ DO NOT BUY' : 'Entry Zone'}
                          </span>
                          <strong className={`${!stock.isAboveVwap ? 'text-danger' : 'text-dark'} font-monospace`} style={{ fontSize: !stock.isAboveVwap ? 11 : 12 }}>
                            {!stock.isAboveVwap ? `Below ₹${stock.vwap.toFixed(1)} VWAP` : stock.entryZone}
                          </strong>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="p-1.5 rounded bg-light border">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>Stop Loss</span>
                          <strong className="text-danger font-monospace">₹{stock.stopLoss.toFixed(1)}</strong>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="p-1.5 rounded bg-light border">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>T1 (+3%)</span>
                          <strong className="text-success font-monospace">₹{stock.target1.toFixed(0)}</strong>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="p-1.5 rounded bg-light border">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>T2 (+5%)</span>
                          <strong className="text-success font-monospace">₹{stock.target2.toFixed(0)}</strong>
                        </div>
                      </div>
                      <div className="col-4">
                        <div className="p-1.5 rounded bg-light border">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>T3 (10%)</span>
                          <strong className="font-monospace text-primary">₹{stock.target3.toFixed(0)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex align-items-center justify-content-between gap-1.5 pt-2 border-top mt-auto">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary rounded-pill px-3 flex-grow-1"
                      onClick={() => setSelectedStockForChart(stock)}
                    >
                      📈 Chart
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm rounded-pill px-3 ${isAdded ? 'btn-secondary' : 'btn-outline-dark'}`}
                      onClick={() => handleAddToPortfolio(stock)}
                    >
                      {isAdded ? '✓' : '💼'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-success rounded-pill fw-bold px-3 flex-grow-1"
                      onClick={() => {
                        setPaperTradeStock(stock);
                        setPaperQuantity(Math.max(10, Math.round(50000 / stock.ltp)));
                      }}
                    >
                      ⚡ Trade
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 5. PAPER TRADE MODAL ── */}
      {paperTradeStock && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-md">
            <div className="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-dark text-white px-4 py-3">
                <div>
                  <h6 className="modal-title fw-bold mb-0">
                    ⚡ SIMULATE PAPER TRADE: {paperTradeStock.symbol}
                  </h6>
                  <small className="text-light opacity-75">{paperTradeStock.company}</small>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setPaperTradeStock(null)} />
              </div>

              <form onSubmit={handleExecutePaperTrade}>
                <div className="modal-body p-4 small">
                  {paperMessage && (
                    <div className="alert alert-success p-2.5 mb-3 rounded fw-bold text-center">
                      {paperMessage}
                    </div>
                  )}

                  <div className="row g-2 mb-3 text-center">
                    <div className="col-6">
                      <div className="p-2 rounded bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 10 }}>ENTRY PRICE</span>
                        <strong className="fs-6 text-dark font-monospace">₹{paperTradeStock.ltp.toFixed(2)}</strong>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="p-2 rounded bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 10 }}>STOP LOSS (SL)</span>
                        <strong className="fs-6 text-danger font-monospace">₹{paperTradeStock.stopLoss.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="row g-2 mb-3 text-center">
                    <div className="col-4">
                      <div className="p-2 rounded bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 10 }}>TARGET 1 (+3%)</span>
                        <strong className="text-success font-monospace">₹{paperTradeStock.target1.toFixed(1)}</strong>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="p-2 rounded bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 10 }}>TARGET 2 (+5%)</span>
                        <strong className="text-success font-monospace">₹{paperTradeStock.target2.toFixed(1)}</strong>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="p-2 rounded bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 10 }}>10% SWING</span>
                        <strong className={`font-monospace ${paperTradeStock.tenPercentFeasible ? 'text-primary' : 'text-muted'}`}>
                          ₹{paperTradeStock.target3.toFixed(1)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Risk Calculator */}
                  <div className="mb-3">
                    <label className="form-label fw-bold mb-1">Trade Quantity (Shares)</label>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      className="form-control form-control-sm font-monospace fw-bold"
                      value={paperQuantity}
                      onChange={(e) => setPaperQuantity(Number(e.target.value) || 1)}
                    />
                  </div>

                  <div className="p-3 rounded-3 bg-light border mb-2 small">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Total Order Capital:</span>
                      <strong className="font-monospace">₹{(paperQuantity * paperTradeStock.ltp).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="d-flex justify-content-between mb-1 text-danger">
                      <span>Max Capital at Risk:</span>
                      <strong className="font-monospace">-₹{(paperQuantity * (paperTradeStock.ltp - paperTradeStock.stopLoss)).toFixed(2)}</strong>
                    </div>
                    <div className="d-flex justify-content-between text-success">
                      <span>Potential Profit (Target 2):</span>
                      <strong className="font-monospace">+₹{(paperQuantity * (paperTradeStock.target2 - paperTradeStock.ltp)).toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="text-muted text-center" style={{ fontSize: 11 }}>
                    Simulated execution stored in your local paper trading journal. Does not submit real broker orders.
                  </div>
                </div>

                <div className="modal-footer p-3 bg-light d-flex justify-content-between">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPaperTradeStock(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success btn-sm px-4 fw-bold shadow-sm">
                    ✓ Confirm Paper Buy Order
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. CANDLESTICK CHART & FULLSCREEN MODAL ── */}
      {selectedStockForChart && (
        <StockDetailModal
          stock={selectedStockForChart}
          onClose={() => setSelectedStockForChart(null)}
          onQuickTrade={onQuickTrade}
        />
      )}
    </div>
  );
}
