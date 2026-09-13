'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import StockDetailModal from './StockDetailModal';

// Storage key for user's personal stocks
const STORAGE_KEY = 'user_selected_portfolio_stocks';

// Known common typos to correct automatically
const SYMBOL_ALIASES = {
  NICTO: 'NITCO',
  ADVIT: 'RAMBHAJO',
  ADVITJEWELS: 'RAMBHAJO',
};

// Default initial starter stocks (clean user stocks)
const INITIAL_STARTER_STOCKS = [
  {
    symbol: 'WEL',
    companyName: 'Wonder Electricals Limited',
    price: 157.4,
    previousClose: 134.02,
    dayHigh: 160.0,
    dayLow: 133.0,
    sharesOwned: 360,
    buyPrice: 152.5,
    support: 152.5,
    resistance: 160.82,
    target1: 165.0,
    target2: 172.0,
    target3: 175.0,
    stopLoss: 153.0,
    riskReward: 3.57,
    lastUpdated: 'Live',
  },
  {
    symbol: 'RAMBHAJO',
    companyName: 'Advit Jewels Limited',
    price: 228.25,
    previousClose: 177.39,
    dayHigh: 242.0,
    dayLow: 225.18,
    sharesOwned: 200,
    buyPrice: 227.36,
    support: 225.18,
    resistance: 241.02,
    target1: 236.08,
    target2: 240.44,
    target3: 244.8,
    stopLoss: 225.18,
    riskReward: 2.63,
    lastUpdated: 'Live',
  },
  {
    symbol: 'NITCO',
    companyName: 'NITCO Limited',
    price: 101.78,
    previousClose: 90.15,
    dayHigh: 109.25,
    dayLow: 101.0,
    sharesOwned: 200,
    buyPrice: 101.6,
    support: 101.0,
    resistance: 107.31,
    target1: 104.0,
    target2: 105.2,
    target3: 106.4,
    stopLoss: 101.0,
    riskReward: 4.26,
    lastUpdated: 'Live',
  },
];

export default function PersonalPortfolio({ onQuickTrade = null }) {
  const [portfolio, setPortfolio] = useState(INITIAL_STARTER_STOCKS);
  const [mounted, setMounted] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newQty, setNewQty] = useState(100);
  const [newBuyPrice, setNewBuyPrice] = useState('');
  const [loadingSymbol, setLoadingSymbol] = useState(false);
  const [selectedStockForChart, setSelectedStockForChart] = useState(null);
  const [editingStock, setEditingStock] = useState(null);
  const [editQty, setEditQty] = useState(100);
  const [editBuyPrice, setEditBuyPrice] = useState('');

  const portfolioRef = useRef(portfolio);
  useEffect(() => {
    portfolioRef.current = portfolio;
  }, [portfolio]);

  // 1. Load User Selected Stocks from LocalStorage on mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize any typos like NICTO -> NITCO
          const normalized = parsed.map((s) => {
            const sym = SYMBOL_ALIASES[s.symbol] || s.symbol;
            return { ...s, symbol: sym };
          });
          setPortfolio(normalized);
          portfolioRef.current = normalized;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 2. Save to LocalStorage whenever portfolio changes
  useEffect(() => {
    if (mounted && Array.isArray(portfolio) && portfolio.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
      } catch {
        // ignore
      }
    }
  }, [portfolio, mounted]);

  // 3. Fetch Real-time Live Prices & Setups for User's Selected Stocks (Stable Reference)
  const refreshLivePrices = useCallback(async () => {
    const currentList = portfolioRef.current;
    if (!currentList || !currentList.length) return;
    try {
      const updated = await Promise.all(
        currentList.map(async (stk) => {
          const sym = SYMBOL_ALIASES[stk.symbol] || stk.symbol;
          try {
            const res = await fetch(`/api/quote-equity?symbol=${sym}`);
            if (res.ok) {
              const data = await res.json();
              const price = Number(data?.price || data?.lastPrice || data?.priceInfo?.lastPrice || data?.priceInfo?.close || stk.price);
              const prev = Number(data?.previousClose || data?.priceInfo?.previousClose || stk.previousClose);
              const high = Number(data?.high || data?.priceInfo?.intraDayHighLow?.max || stk.dayHigh || price);
              const low = Number(data?.low || data?.priceInfo?.intraDayHighLow?.min || stk.dayLow || price);
              const comp = data?.info?.companyName || data?.metadata?.companyName || stk.companyName;

              const sl = stk.stopLoss || Number((low > 0 ? low : price * 0.985).toFixed(2));
              const t1 = stk.target1 || Number((price + Math.max(price - sl, 1) * 1.5).toFixed(2));
              const t2 = stk.target2 || Number((price + Math.max(price - sl, 1) * 2.5).toFixed(2));
              const t3 = stk.target3 || Number((price + Math.max(price - sl, 1) * 3.5).toFixed(2));
              const rr = Number((Math.max(t1 - price, 0.5) / Math.max(price - sl, 0.5)).toFixed(2));

              return {
                ...stk,
                symbol: sym,
                price: price || stk.price,
                previousClose: prev || stk.previousClose,
                dayHigh: high,
                dayLow: low,
                companyName: comp || stk.companyName,
                stopLoss: sl,
                target1: t1,
                target2: t2,
                target3: t3,
                riskReward: rr || stk.riskReward || 2.0,
                lastUpdated: new Date().toLocaleTimeString(),
              };
            }
          } catch {
            // Keep existing
          }
          return { ...stk, symbol: sym };
        })
      );

      // Only update state if prices or values actually changed to eliminate shaking/re-render jitter
      setPortfolio((prev) => {
        const isDifferent = updated.some((u, idx) => {
          const p = prev[idx];
          return !p || p.price !== u.price || p.symbol !== u.symbol || p.dayHigh !== u.dayHigh;
        });
        return isDifferent ? updated : prev;
      });
    } catch {
      // ignore
    }
  }, []);

  // Periodic Auto-refresh (Strict 15-second interval, no render loop)
  useEffect(() => {
    if (!mounted) return;
    const timer = setInterval(() => {
      refreshLivePrices();
    }, 15000);
    return () => clearInterval(timer);
  }, [mounted, refreshLivePrices]);

  // Compute Portfolio Metrics
  const { totalInvested, currentValue, totalPnL, totalPnLPct } = useMemo(() => {
    let invested = 0;
    let current = 0;

    portfolio.forEach((stk) => {
      const shares = Number(stk.sharesOwned) || 0;
      const buy = Number(stk.buyPrice) || Number(stk.price) || 0;
      invested += shares * buy;
      current += shares * (Number(stk.price) || 0);
    });

    const pnl = current - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

    return {
      totalInvested: invested,
      currentValue: current,
      totalPnL: pnl,
      totalPnLPct: pnlPct,
    };
  }, [portfolio]);

  // Add a new stock to user's portfolio
  const handleAddStock = async (e) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    let upper = newSymbol.trim().toUpperCase();
    if (SYMBOL_ALIASES[upper]) {
      upper = SYMBOL_ALIASES[upper];
    }

    // Check if already in portfolio
    if (portfolio.some((s) => s.symbol === upper)) {
      setNewSymbol('');
      return;
    }

    setLoadingSymbol(true);
    let livePrice = 0;
    let livePrev = 0;
    let liveHigh = 0;
    let liveLow = 0;
    let compName = `${upper} Ltd`;

    try {
      const res = await fetch(`/api/nse/quote-equity?symbol=${upper}`);
      if (res.ok) {
        const data = await res.json();
        livePrice = Number(data?.priceInfo?.lastPrice || data?.priceInfo?.close || 0);
        livePrev = Number(data?.priceInfo?.previousClose || livePrice);
        liveHigh = Number(data?.priceInfo?.intraDayHighLow?.max || livePrice);
        liveLow = Number(data?.priceInfo?.intraDayHighLow?.min || livePrice);
        compName = data?.info?.companyName || data?.metadata?.companyName || `${upper} Ltd`;
      }
    } catch {
      // fallback
    } finally {
      setLoadingSymbol(false);
    }

    const shares = Number(newQty) || 100;
    const buy = Number(newBuyPrice) || livePrice || livePrev || 100;
    const sl = Number((liveLow > 0 ? liveLow : livePrice * 0.985).toFixed(2));
    const t1 = Number((livePrice + Math.max(livePrice - sl, 1) * 1.5).toFixed(2));
    const t2 = Number((livePrice + Math.max(livePrice - sl, 1) * 2.5).toFixed(2));
    const t3 = Number((livePrice + Math.max(livePrice - sl, 1) * 3.5).toFixed(2));
    const rr = Number((Math.max(t1 - livePrice, 0.5) / Math.max(livePrice - sl, 0.5)).toFixed(2));

    const newEntry = {
      symbol: upper,
      companyName: compName,
      price: livePrice || buy,
      previousClose: livePrev || buy,
      dayHigh: liveHigh || livePrice || buy,
      dayLow: liveLow || livePrice || buy,
      sharesOwned: shares,
      buyPrice: buy,
      support: sl,
      resistance: t2,
      target1: t1,
      target2: t2,
      target3: t3,
      stopLoss: sl,
      riskReward: rr || 2.0,
      lastUpdated: new Date().toLocaleTimeString(),
    };

    setPortfolio((prev) => [newEntry, ...prev]);
    setNewSymbol('');
    setNewBuyPrice('');
  };

  const handleRemoveStock = (sym) => {
    setPortfolio((prev) => prev.filter((s) => s.symbol !== sym));
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingStock) return;
    setPortfolio((prev) =>
      prev.map((s) =>
        s.symbol === editingStock.symbol
          ? {
              ...s,
              sharesOwned: Number(editQty) || 1,
              buyPrice: Number(editBuyPrice) || s.buyPrice,
            }
          : s
      )
    );
    setEditingStock(null);
  };

  return (
    <div className="personal-portfolio-hub">
      {/* Top Banner & Portfolio Summary */}
      <div
        className="card border-0 shadow-sm rounded-4 overflow-hidden text-white mb-4 p-4"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className="fs-3">💼</span>
              <h4 className="mb-0 fw-bold">My Personal Stocks Portfolio</h4>
              <span className="badge bg-danger text-white ms-2 px-2 py-1 small">
                🔴 LIVE STREAMING
              </span>
            </div>
            <small className="text-light opacity-75">
              Live tracking only for your selected stocks with real exchange prices, trade setups, and candlestick charts
            </small>
          </div>

          {/* Add Stock Form */}
          <form onSubmit={handleAddStock} className="d-flex flex-wrap gap-2 align-items-center">
            <input
              type="text"
              className="form-control form-control-sm bg-light text-dark fw-bold"
              placeholder="Stock symbol (e.g. RAMBHAJO, NITCO)..."
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              style={{ minWidth: 200 }}
              disabled={loadingSymbol}
            />
            <input
              type="number"
              className="form-control form-control-sm bg-light text-dark fw-bold"
              placeholder="Qty (e.g. 200)"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              style={{ width: 90 }}
              min="1"
            />
            <input
              type="number"
              step="any"
              className="form-control form-control-sm bg-light text-dark fw-bold"
              placeholder="Avg Buy ₹"
              value={newBuyPrice}
              onChange={(e) => setNewBuyPrice(e.target.value)}
              style={{ width: 110 }}
            />
            <button type="submit" className="btn btn-sm btn-success fw-bold px-3" disabled={loadingSymbol}>
              {loadingSymbol ? <span className="spinner-border spinner-border-sm" /> : '+ Add My Stock'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-light"
              onClick={refreshLivePrices}
              title="Refresh Live Prices"
            >
              🔄 Refresh
            </button>
          </form>
        </div>

        {/* Portfolio Stats Cards */}
        <div className="row g-3">
          <div className="col-6 col-md-3">
            <div className="p-3 rounded-3 bg-dark bg-opacity-50 border border-light border-opacity-10">
              <small className="text-light opacity-75 d-block">Current Portfolio Value</small>
              <div className="fs-4 fw-bold text-white mt-1">
                ₹{currentValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-3 rounded-3 bg-dark bg-opacity-50 border border-light border-opacity-10">
              <small className="text-light opacity-75 d-block">Total Invested Amount</small>
              <div className="fs-4 fw-bold text-light mt-1">
                ₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-3 rounded-3 bg-dark bg-opacity-50 border border-light border-opacity-10">
              <small className="text-light opacity-75 d-block">Total Profit / Loss (P&L)</small>
              <div className={`fs-4 fw-bold mt-1 ${totalPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                <span className="fs-6 ms-1">({totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%)</span>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="p-3 rounded-3 bg-dark bg-opacity-50 border border-light border-opacity-10">
              <small className="text-light opacity-75 d-block">Tracked Stocks Count</small>
              <div className="fs-4 fw-bold text-primary mt-1">
                {portfolio.length} {portfolio.length === 1 ? 'Stock' : 'Stocks'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State when no stocks are tracked */}
      {portfolio.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
          <div className="fs-1 mb-3">💼</div>
          <h5 className="fw-bold text-dark mb-2">No stocks in your portfolio yet</h5>
          <p className="text-muted small mb-4">
            Type your stock symbol above (e.g. <strong>RAMBHAJO</strong>, <strong>NITCO</strong>, <strong>CUPID</strong>) to start tracking live prices, trade setups, and candlestick charts.
          </p>
          <div className="d-flex justify-content-center gap-2">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm rounded-pill px-3"
              onClick={() => {
                setNewSymbol('RAMBHAJO');
                setNewBuyPrice('227.36');
                setNewQty(200);
              }}
            >
              + Track RAMBHAJO
            </button>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm rounded-pill px-3"
              onClick={() => {
                setNewSymbol('NITCO');
                setNewBuyPrice('101.60');
                setNewQty(200);
              }}
            >
              + Track NITCO
            </button>
          </div>
        </div>
      ) : (
        /* Selected Stocks Grid */
        <div className="row g-4">
          {portfolio.map((stk) => {
            const price = Number(stk.price) || 0;
            const prev = Number(stk.previousClose) || price;
            const dayChange = price - prev;
            const dayChangePct = prev > 0 ? (dayChange / prev) * 100 : 0;
            const isDayUp = dayChangePct >= 0;

            const buyPrice = Number(stk.buyPrice) || price;
            const shares = Number(stk.sharesOwned) || 1;
            const pnl = (price - buyPrice) * shares;
            const pnlPct = buyPrice > 0 ? ((price - buyPrice) / buyPrice) * 100 : 0;

            // Compute dynamic signal based on real price action
            const isStrongBullish = dayChangePct >= 5;
            const isBullish = dayChangePct >= 1;
            const isBearish = dayChangePct <= -2;

            let signalBadge = '🟡 HOLD';
            let signalClass = 'bg-warning text-dark';
            let signalText = `Price consolidating near ₹${price.toFixed(2)}. Maintain support SL at ₹${(stk.stopLoss || price * 0.985).toFixed(2)}.`;

            if (isStrongBullish) {
              signalBadge = '🟢 STRONG BULLISH (HOLD)';
              signalClass = 'bg-success text-white';
              signalText = `Strong momentum rally (+${dayChangePct.toFixed(2)}%). Trail stop loss to ₹${(stk.stopLoss || price * 0.985).toFixed(2)} to protect profits.`;
            } else if (isBullish) {
              signalBadge = '🟢 BULLISH (HOLD / BUY)';
              signalClass = 'bg-success text-white';
              signalText = `Trading higher (+${dayChangePct.toFixed(2)}%). Bullish buyers in control towards Target ₹${(stk.target1 || price * 1.05).toFixed(2)}.`;
            } else if (isBearish) {
              signalBadge = '🔴 BEARISH (WATCH SL)';
              signalClass = 'bg-danger text-white';
              signalText = `Pullback detected (${dayChangePct.toFixed(2)}%). Watch strict stop loss at ₹${(stk.stopLoss || price * 0.95).toFixed(2)}.`;
            }

            return (
              <div className="col-12 col-lg-6" key={stk.symbol}>
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden h-100 bg-white p-3 p-md-4">
                  {/* Stock Header */}
                  <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 border-bottom pb-3 mb-3">
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-dark fs-6 px-3 py-1 fw-bold">{stk.symbol}</span>
                        <h5 className="mb-0 fw-bold text-dark">{stk.companyName}</h5>
                      </div>
                      <small className="text-muted d-block mt-1">
                        Holding: <strong>{shares} shares</strong> @ Avg <strong>₹{buyPrice.toFixed(2)}</strong>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 ms-2 text-primary"
                          onClick={() => {
                            setEditingStock(stk);
                            setEditQty(shares);
                            setEditBuyPrice(buyPrice);
                          }}
                        >
                          ✏️ Edit
                        </button>
                      </small>
                    </div>

                    <div className="text-end">
                      <div className="fs-4 fw-bold text-dark">₹{price.toFixed(2)}</div>
                      <span className={`badge ${isDayUp ? 'bg-success' : 'bg-danger'} px-2 py-1`}>
                        {isDayUp ? '▲ +' : '▼ '}
                        {dayChangePct.toFixed(2)}% (₹{Math.abs(dayChange).toFixed(2)})
                      </span>
                    </div>
                  </div>

                  {/* Real-Time Live Signal */}
                  <div className="p-3 rounded-3 bg-light border mb-3">
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                      <span className="small fw-bold text-muted">LIVE MARKET SIGNAL:</span>
                      <span className={`badge ${signalClass} fs-6 px-3 py-1 fw-bold shadow-sm`}>
                        {signalBadge}
                      </span>
                    </div>
                    <p className="mb-0 text-secondary small fw-semibold">
                      💡 {signalText}
                    </p>
                  </div>

                  {/* Trade Setup: Target 1, Target 2, Target 3, Stop Loss & R:R */}
                  <div className="p-3 rounded-3 bg-light bg-opacity-50 border mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small fw-bold text-dark">🎯 INTRADAY TRADE SETUP</span>
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                        R:R {stk.riskReward || '2.5'}:1
                      </span>
                    </div>
                    <div className="row g-2 text-center small">
                      <div className="col-3">
                        <div className="p-2 rounded bg-white border">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>Stop Loss</span>
                          <strong className="text-danger">₹{(stk.stopLoss || price * 0.985).toFixed(2)}</strong>
                        </div>
                      </div>
                      <div className="col-3">
                        <div className="p-2 rounded bg-white border">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>Target 1</span>
                          <strong className="text-success">₹{(stk.target1 || price * 1.03).toFixed(2)}</strong>
                        </div>
                      </div>
                      <div className="col-3">
                        <div className="p-2 rounded bg-white border">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>Target 2</span>
                          <strong className="text-success">₹{(stk.target2 || price * 1.06).toFixed(2)}</strong>
                        </div>
                      </div>
                      <div className="col-3">
                        <div className="p-2 rounded bg-white border">
                          <span className="text-muted d-block" style={{ fontSize: 10 }}>Target 3</span>
                          <strong className="text-success">₹{(stk.target3 || price * 1.09).toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* P&L and Intraday High / Low */}
                  <div className="row g-2 mb-3 small text-center">
                    <div className="col-4">
                      <div className="p-2 rounded-2 bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 11 }}>Holding P&L</span>
                        <strong className={pnl >= 0 ? 'text-success' : 'text-danger'}>
                          {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                        </strong>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="p-2 rounded-2 bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 11 }}>Day High</span>
                        <strong className="text-success">₹{(Number(stk.dayHigh) || price).toFixed(2)}</strong>
                      </div>
                    </div>
                    <div className="col-4">
                      <div className="p-2 rounded-2 bg-light border">
                        <span className="text-muted d-block" style={{ fontSize: 11 }}>Day Low</span>
                        <strong className="text-danger">₹{(Number(stk.dayLow) || price).toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="d-flex align-items-center justify-content-between gap-2 pt-2 border-top mt-auto">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm rounded-pill fw-semibold px-3 d-flex align-items-center gap-1"
                      onClick={() => setSelectedStockForChart(stk)}
                    >
                      📈 View Candlestick Chart & Signals
                    </button>

                    <div className="d-flex gap-1">
                      {onQuickTrade && (
                        <button
                          type="button"
                          className="btn btn-sm btn-success rounded-pill fw-bold px-3"
                          onClick={() => onQuickTrade(stk)}
                        >
                          ⚡ Trade
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger rounded-pill px-2"
                        title="Remove from My Portfolio"
                        onClick={() => handleRemoveStock(stk.symbol)}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Holding Modal */}
      {editingStock && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content rounded-4 shadow">
              <div className="modal-header">
                <h6 className="modal-title fw-bold">Edit {editingStock.symbol}</h6>
                <button type="button" className="btn-close" onClick={() => setEditingStock(null)} />
              </div>
              <form onSubmit={handleSaveEdit}>
                <div className="modal-body p-3 small">
                  <div className="mb-2">
                    <label className="form-label text-muted">Shares Owned (Qty):</label>
                    <input
                      type="number"
                      className="form-control form-control-sm fw-bold"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      min="1"
                      required
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label text-muted">Average Buy Price (₹):</label>
                    <input
                      type="number"
                      step="any"
                      className="form-control form-control-sm fw-bold"
                      value={editBuyPrice}
                      onChange={(e) => setEditBuyPrice(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer p-2">
                  <button type="button" className="btn btn-sm btn-light" onClick={() => setEditingStock(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary fw-bold">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Candlestick Chart Modal for Selected Stock */}
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
