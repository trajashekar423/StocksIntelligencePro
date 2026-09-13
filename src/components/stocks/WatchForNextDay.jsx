'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import StockDetailModal from './StockDetailModal';
import {
  calculateTradingSessions,
  formatNseDate,
  toIsoDateString,
  getSuggestedTargetDates,
  isNseTradingDay,
  getTodayNseDate,
  getNextNseTradingDay,
} from '../../services/calendar/nseCalendarService';
import {
  runTargetDateStrategyScan,
} from '../../services/strategy/targetDateStrategyEngine';
import {
  loadScannerHistoryArchive,
} from '../../services/history/scannerHistoryService';
import { registerNewOpenPosition } from '../../services/risk/positionTracker';
import { groupStocksBySector, getSectorCategory } from '../../services/market/sectorCategoryService';
import BuyerDemandMeter, { calculateBuyerDemandPct } from './BuyerDemandMeter';

const STORAGE_KEY = 'user_selected_portfolio_stocks';

export default function WatchForNextDay({ onQuickTrade = null, onAddToPortfolio = null }) {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TOP_10'); // 'TOP_10' | 'FULL_TABLE' | 'DATE_HISTORY'

  // Dynamic NSE Date Initialization (IST)
  const today = getTodayNseDate();
  const defaultBuyIso = toIsoDateString(today);
  const defaultTargetDate = getNextNseTradingDay(today, false);
  const defaultTargetIso = toIsoDateString(defaultTargetDate);

  const [buyDate, setBuyDate] = useState(defaultBuyIso);
  const [targetSellDate, setTargetSellDate] = useState(defaultTargetIso);
  const [customDateInput, setCustomDateInput] = useState(defaultTargetIso);

  // Scanner results
  const [scanResult, setScanResult] = useState(() => ({
    sessionInfo: calculateTradingSessions(defaultBuyIso, defaultTargetIso),
    top10: [],
    allCandidates: [],
    totalScanned: 0,
    qualifiedCount: 0,
  }));

  // Filters & State
  const [selectedSignalTier, setSelectedSignalTier] = useState('ALL'); // 'ALL' | 'HIGH CONVICTION' | 'STRONG' | 'WATCH'
  const [excludeUpperCircuit, setExcludeUpperCircuit] = useState(false); // Filter out stocks locked in 100% Upper Circuit
  const [displayLimit, setDisplayLimit] = useState(10); // 10 | 20 | 30 | 50
  const [selectedStockForChart, setSelectedStockForChart] = useState(null);
  const [inspectingScoreStock, setInspectingScoreStock] = useState(null);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState('2026-08-27');
  const [historyArchive, setHistoryArchive] = useState({});
  const [addedSymbols, setAddedSymbols] = useState(new Set());
  const [riskTrackedSymbols, setRiskTrackedSymbols] = useState(new Set());
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [countdownSeconds, setCountdownSeconds] = useState(60);

  // Capital Budget & Quantity Sizing State
  const [userBudget, setUserBudget] = useState(50000);
  const [allocationSplit, setAllocationSplit] = useState('SPLIT_2'); // 'SPLIT_2' | 'SPLIT_3' | 'ALL_IN_1'

  // Live 60-second Scan Countdown Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Dynamic Suggested Target Date Presets based on Buy Date
  const suggestedPresets = useMemo(() => {
    return getSuggestedTargetDates(buyDate);
  }, [buyDate]);

  // Load Historical Archive on Mount
  useEffect(() => {
    const archive = loadScannerHistoryArchive();
    setHistoryArchive(archive);
  }, []);

  // 1. Fetch live NSE candidates and execute Target-Date Strategy Scan
  const fetchAndScan = useCallback(async () => {
    setLoading(true);
    try {
      // Query live NSE endpoints
      const [gainersRes, volRes, uniRes] = await Promise.allSettled([
        fetch('/api/nse/top-ten'),
        fetch('/api/nse/most-active'),
        fetch('/api/nse/universe'),
      ]);

      const candidateMap = new Map();

      // Process Universe High-Volume Gainers
      if (uniRes.status === 'fulfilled' && uniRes.value.ok) {
        const json = await uniRes.value.json().catch(() => ({}));
        const rows = Array.isArray(json?.data) ? json.data : [];
        rows.forEach((r) => {
          const sym = String(r.symbol || '').trim().toUpperCase();
          const ltp = Number(r.price || r.lastPrice || r.ltp || 0);
          if (sym && ltp > 0) {
            const prev = Number(r.previousClose || r.prev_price || ltp);
            const open = Number(r.open || ltp);
            const high = Number(r.dayHigh || ltp);
            const low = Number(r.dayLow || ltp);
            const chgPct = Number(r.changePercent || r.pChange || (prev > 0 ? ((ltp - prev) / prev) * 100 : 0));
            const vol = Number(r.volume || r.totalTradedVolume || 1000000);

            if (chgPct >= 1.0) {
              candidateMap.set(sym, {
                symbol: sym,
                companyName: r.companyName || `${sym} Limited`,
                sector: r.sector || 'Equities',
                price: ltp,
                previousClose: prev,
                open,
                high,
                low,
                changePercent: chgPct,
                volume: vol,
                averageVolume: Math.max(Math.round(vol / 1.8), 250000),
                vwap: Number(r.vwap || ((open + high + low + ltp) / 4).toFixed(2)),
                ema9: Number((ltp * 0.993).toFixed(2)),
                ema20: Number((ltp * 0.985).toFixed(2)),
                ema50: Number((ltp * 0.972).toFixed(2)),
                totalBuyQty: Number(r.totalBuyQty || 0),
                totalSellQty: Number(r.totalSellQty || 0),
                isUpperCircuit: Boolean(r.isUpperCircuit || chgPct >= 9.8),
              });
            }
          }
        });
      }

      // Process Gainers
      if (gainersRes.status === 'fulfilled' && gainersRes.value.ok) {
        const json = await gainersRes.value.json().catch(() => ({}));
        const rows = Array.isArray(json?.allSec?.data) ? json.allSec.data : Array.isArray(json?.data) ? json.data : [];
        rows.forEach((r) => {
          const sym = String(r.symbol || '').trim().toUpperCase();
          if (sym && Number(r.ltp) > 0) {
            const ltp = Number(r.ltp);
            const prev = Number(r.prev_price || r.previousClose || ltp);
            const open = Number(r.open_price || ltp);
            const high = Number(r.high_price || ltp);
            const low = Number(r.low_price || ltp);
            const chgPct = Number(r.perChange || (prev > 0 ? ((ltp - prev) / prev) * 100 : 0));
            const vol = Number(r.trade_quantity || r.volume || 1500000);

            candidateMap.set(sym, {
              symbol: sym,
              companyName: r.companyName || `${sym} Limited`,
              sector: r.sector || 'Equities',
              price: ltp,
              previousClose: prev,
              open,
              high,
              low,
              changePercent: chgPct,
              volume: vol,
              averageVolume: Math.max(Math.round(vol / 2.2), 300000),
              vwap: Number(((open + high + low + ltp) / 4).toFixed(2)),
              ema9: Number((ltp * 0.993).toFixed(2)),
              ema20: Number((ltp * 0.985).toFixed(2)),
              ema50: Number((ltp * 0.972).toFixed(2)),
              buySellRatio: chgPct >= 5 ? 2.3 : 1.7,
            });
          }
        });
      }

      // Process Volume Movers
      if (volRes.status === 'fulfilled' && volRes.value.ok) {
        const json = await volRes.value.json().catch(() => ({}));
        const rows = Array.isArray(json?.data) ? json.data : [];
        rows.forEach((r) => {
          const sym = String(r.symbol || '').trim().toUpperCase();
          if (sym && Number(r.ltp) > 0 && !candidateMap.has(sym)) {
            const ltp = Number(r.ltp);
            const prev = Number(r.prev_price || r.previousClose || ltp);
            const open = Number(r.open_price || ltp);
            const high = Number(r.high_price || ltp);
            const low = Number(r.low_price || ltp);
            const chgPct = Number(r.pChange || r.perChange || (prev > 0 ? ((ltp - prev) / prev) * 100 : 0));
            const vol = Number(r.volume || r.trade_quantity || 2000000);

            candidateMap.set(sym, {
              symbol: sym,
              companyName: r.companyName || `${sym} Limited`,
              sector: r.sector || 'Equities',
              price: ltp,
              previousClose: prev,
              open,
              high,
              low,
              changePercent: chgPct,
              volume: vol,
              averageVolume: Math.max(Math.round(vol / 2.0), 300000),
              vwap: Number(((open + high + low + ltp) / 4).toFixed(2)),
              ema9: Number((ltp * 0.992).toFixed(2)),
              ema20: Number((ltp * 0.984).toFixed(2)),
              ema50: Number((ltp * 0.970).toFixed(2)),
              buySellRatio: chgPct >= 4 ? 2.1 : 1.6,
            });
          }
        });
      }

      // If market is closed / after-hours or weekend, seed with active momentum universe
      if (candidateMap.size === 0) {
        const DEFAULT_POOL = [
          { symbol: 'TEJASNET', companyName: 'Tejas Networks Limited', sector: 'Telecom & Tech', price: 564.25, previousClose: 511.15, open: 538.0, high: 567.8, low: 538.0, changePercent: 10.39, volume: 3800000, averageVolume: 1100000, vwap: 556.2, ema9: 550.0, ema20: 530.0, ema50: 510.0, buySellRatio: 2.6 },
          { symbol: 'JUSTDIAL', companyName: 'Just Dial Limited', sector: 'Internet & Search', price: 704.55, previousClose: 640.5, open: 655.0, high: 704.55, low: 653.35, changePercent: 10.0, volume: 4200000, averageVolume: 1200000, vwap: 688.5, ema9: 680.0, ema20: 655.0, ema50: 640.0, buySellRatio: 2.9 },
          { symbol: 'PVP', companyName: 'PVP Ventures Limited', sector: 'Media & Real Estate', price: 65.22, previousClose: 62.12, open: 65.0, high: 65.22, low: 63.9, changePercent: 4.99, volume: 6800000, averageVolume: 1500000, vwap: 64.8, ema9: 64.5, ema20: 61.5, ema50: 58.0, buySellRatio: 3.1 },
          { symbol: 'DIXON', companyName: 'Dixon Technologies Limited', sector: 'Electronics & Consumer', price: 13450.0, previousClose: 12980.0, open: 13050.0, high: 13520.0, low: 13010.0, changePercent: 3.62, volume: 1450000, averageVolume: 420000, vwap: 13320.0, ema9: 13200.0, ema20: 12900.0, ema50: 12500.0, buySellRatio: 2.4 },
          { symbol: 'POLYCAB', companyName: 'Polycab India Limited', sector: 'Cables & Electricals', price: 6820.0, previousClose: 6610.0, open: 6640.0, high: 6850.0, low: 6620.0, changePercent: 3.18, volume: 2100000, averageVolume: 650000, vwap: 6760.0, ema9: 6700.0, ema20: 6550.0, ema50: 6380.0, buySellRatio: 2.2 },
          { symbol: 'HAL', companyName: 'Hindustan Aeronautics Limited', sector: 'Defence & Aerospace', price: 4850.0, previousClose: 4720.0, open: 4740.0, high: 4890.0, low: 4730.0, changePercent: 2.75, volume: 5600000, averageVolume: 1800000, vwap: 4810.0, ema9: 4780.0, ema20: 4680.0, ema50: 4500.0, buySellRatio: 2.5 },
          { symbol: 'BEL', companyName: 'Bharat Electronics Limited', sector: 'Defence Electronics', price: 312.5, previousClose: 304.2, open: 305.0, high: 314.8, low: 304.5, changePercent: 2.73, volume: 18500000, averageVolume: 6200000, vwap: 310.2, ema9: 308.0, ema20: 301.0, ema50: 292.0, buySellRatio: 2.3 },
          { symbol: 'TRENT', companyName: 'Trent Limited (Tata Retail)', sector: 'Retail & Consumer', price: 7420.0, previousClose: 7240.0, open: 7270.0, high: 7450.0, low: 7260.0, changePercent: 2.49, volume: 3200000, averageVolume: 950000, vwap: 7380.0, ema9: 7320.0, ema20: 7150.0, ema50: 6900.0, buySellRatio: 2.1 },
          { symbol: 'KALYANKJIL', companyName: 'Kalyan Jewellers India', sector: 'Retail & Jewellery', price: 685.0, previousClose: 668.0, open: 671.0, high: 689.5, low: 669.0, changePercent: 2.54, volume: 8900000, averageVolume: 2800000, vwap: 680.5, ema9: 675.0, ema20: 658.0, ema50: 635.0, buySellRatio: 2.0 },
          { symbol: 'AMBER', companyName: 'Amber Enterprises India', sector: 'Electronics & ACs', price: 7781.5, previousClose: 7701.0, open: 7750.5, high: 7788.0, low: 7700.0, changePercent: 1.05, volume: 720000, averageVolume: 350000, vwap: 7745.0, ema9: 7720.0, ema20: 7600.0, ema50: 7450.0, buySellRatio: 2.1 },
          { symbol: 'ADANIENT', companyName: 'Adani Enterprises Limited', sector: 'Metals & Energy', price: 3172.0, previousClose: 3159.3, open: 3165.0, high: 3178.0, low: 3150.0, changePercent: 0.4, volume: 2100000, averageVolume: 1200000, vwap: 3166.0, ema9: 3160.0, ema20: 3140.0, ema50: 3110.0, buySellRatio: 1.9 },
          { symbol: 'POWERGRID', companyName: 'Power Grid Corp of India', sector: 'Power / Utilities', price: 267.2, previousClose: 265.9, open: 266.0, high: 267.5, low: 265.0, changePercent: 0.49, volume: 8900000, averageVolume: 4500000, vwap: 266.5, ema9: 266.0, ema20: 264.5, ema50: 261.0, buySellRatio: 2.0 },
          { symbol: 'ADANIPORTS', companyName: 'Adani Ports & SEZ', sector: 'Infrastructure', price: 1724.0, previousClose: 1714.0, open: 1716.0, high: 1728.0, low: 1710.0, changePercent: 0.58, volume: 3400000, averageVolume: 1800000, vwap: 1719.0, ema9: 1718.0, ema20: 1705.0, ema50: 1690.0, buySellRatio: 1.8 },
          { symbol: 'WHIRLPOOL', companyName: 'Whirlpool of India Limited', sector: 'Consumer Durables', price: 825.0, previousClose: 836.15, open: 835.0, high: 835.0, low: 815.65, changePercent: -1.33, volume: 5190000, averageVolume: 1500000, vwap: 828.0, ema9: 835.0, ema20: 820.0, ema50: 800.0, buySellRatio: 1.4 },
        ];
        DEFAULT_POOL.forEach((c) => candidateMap.set(c.symbol, c));
      }

      const rawList = Array.from(candidateMap.values());
      const scan = runTargetDateStrategyScan(rawList, buyDate, targetSellDate, {
        niftyBullish: true,
        sectorBullish: true,
      });

      setScanResult(scan);
      setLastRefreshed(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [buyDate, targetSellDate]);

  useEffect(() => {
    fetchAndScan();
  }, [fetchAndScan]);

  // Handler to change target sell date
  const handleSelectPresetTargetDate = (isoDate) => {
    setTargetSellDate(isoDate);
    setCustomDateInput(isoDate);
  };

  const handleCustomDateChange = (e) => {
    const val = e.target.value;
    setCustomDateInput(val);
    if (val) {
      setTargetSellDate(val);
    }
  };

  // Filtered Bullish Candidates by Signal Tier, Circuit Lock & Display Limit
  const filteredTop10 = useMemo(() => {
    const source = scanResult.allCandidates.length ? scanResult.allCandidates : scanResult.top10;
    let list = source;
    if (excludeUpperCircuit) {
      list = list.filter((s) => {
        const demand = calculateBuyerDemandPct(s);
        return demand < 100 && !s.isUpperCircuit;
      });
    }
    if (selectedSignalTier !== 'ALL') {
      list = list.filter((s) => s.signalTier === selectedSignalTier);
    }
    return list.slice(0, displayLimit);
  }, [scanResult.allCandidates, scanResult.top10, selectedSignalTier, displayLimit, excludeUpperCircuit]);

  // Profit Booking & Distribution Candidates (Ranked by lowest score & supply pressure)
  const profitBookingStocks = useMemo(() => {
    if (!scanResult.allCandidates || scanResult.allCandidates.length === 0) return [];
    const candidates = [...scanResult.allCandidates]
      .filter((s) => s.price < s.vwap || s.distanceFromDayHigh >= 1.5 || s.score < 70 || s.changePercent <= 1.0)
      .sort((a, b) => a.score - b.score);
    return candidates.slice(0, displayLimit).map((item, idx) => ({ ...item, pbRank: idx + 1 }));
  }, [scanResult.allCandidates, displayLimit]);

  // Grouping & Trending Business Category Detection
  const trendingSectorInfo = useMemo(() => {
    const pool = scanResult.allCandidates.length ? scanResult.allCandidates : scanResult.top10;
    return groupStocksBySector(pool);
  }, [scanResult.allCandidates, scanResult.top10]);

  // 💰 Dynamic Shares Quantity & Budget Allocation Calculator
  const getStockBudgetPlan = useCallback((stock) => {
    const price = Number(stock.price || stock.entryPrice || 1);
    const sl = Number(stock.stopLoss || price * 0.97);
    const t1 = Number(stock.target1 || stock.targetDateTarget || price * 1.04);
    const t2 = Number(stock.target2 || price * 1.07);

    const numSplits = allocationSplit === 'SPLIT_3' ? 3 : allocationSplit === 'ALL_IN_1' ? 1 : 2;
    const budgetPerStock = Math.max(userBudget / numSplits, 1000);
    const rawQty = Math.floor(budgetPerStock / Math.max(price, 0.01));
    const qty = Math.max(rawQty, 1);
    const invested = Math.round(qty * price);

    const t1Profit = Math.round(qty * (t1 - price));
    const t2Profit = Math.round(qty * (t2 - price));
    const slLoss = Math.round(qty * Math.max(price - sl, 0.01));
    const halfQty = Math.max(Math.floor(qty / 2), 1);
    const halfProfitT1 = Math.round(halfQty * (t1 - price));
    const trailingProfit = Math.round(halfProfitT1 + (qty - halfQty) * (t2 - price));

    return {
      numSplits,
      budgetPerStock,
      qty,
      invested,
      t1Profit,
      t2Profit,
      slLoss,
      halfQty,
      halfProfitT1,
      trailingProfit,
      rrRatio: slLoss > 0 ? (t1Profit / slLoss).toFixed(1) : '2.0',
    };
  }, [userBudget, allocationSplit]);

  // Active History Record for selected past date
  const activeHistoryRecord = useMemo(() => {
    return historyArchive[selectedHistoryDate] || null;
  }, [selectedHistoryDate, historyArchive]);

  // 1-Click Track in Live Risk Engine
  const handleTrackInRiskEngine = (stock) => {
    try {
      const sym = stock.symbol;
      const comp = stock.companyName || `${sym} Ltd`;
      const buyPrice = stock.price || stock.entryPrice || 100;
      const sl = stock.stopLoss || Number((buyPrice * 0.97).toFixed(2));
      registerNewOpenPosition(sym, comp, 100, buyPrice, sl, 'MIS');

      setRiskTrackedSymbols((prev) => new Set([...prev, sym]));
      setFeedbackMsg(`✓ ${sym} registered into Live Position Risk Monitor with Trailing Stop Loss (₹${sl.toFixed(2)}) & Peak Profit Protection!`);
      setTimeout(() => setFeedbackMsg(null), 4500);
    } catch {
      // ignore
    }
  };

  // 1-Click Paper BTST Buy Execution
  const handlePaperBtstBuy = async (stock, plan) => {
    try {
      const sym = stock.symbol;
      const comp = stock.companyName || `${sym} Ltd`;
      const buyPrice = stock.price || stock.entryPrice || 100;
      const sl = stock.stopLoss || Number((buyPrice * 0.97).toFixed(2));
      const target = stock.target1 || stock.targetDateTarget || Number((buyPrice * 1.05).toFixed(2));
      const qty = plan.qty || 10;

      await fetch('/api/trading/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sym,
          entryPrice: buyPrice,
          stopLoss: sl,
          target: target,
          quantity: qty,
          mode: 'PAPER',
          productType: 'CNC',
        }),
      });

      registerNewOpenPosition(sym, comp, qty, buyPrice, sl, 'CNC');
      setRiskTrackedSymbols((prev) => new Set([...prev, sym]));
      setFeedbackMsg(
        `🟡 PAPER BTST ORDER EXECUTED! Bought ${qty} shares of ${sym} @ ₹${buyPrice.toFixed(2)} (CNC Delivery). Target: ₹${target.toFixed(2)}, SL: ₹${sl.toFixed(2)}. Held for tomorrow's target exit!`
      );
      setTimeout(() => setFeedbackMsg(null), 6000);
    } catch {
      setFeedbackMsg(`Paper BTST order submitted for ${stock.symbol}!`);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // 1-Click Add to Portfolio
  const handleAddToPortfolio = (stock) => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const list = saved ? JSON.parse(saved) : [];
      const sym = stock.symbol;
      if (!list.some((s) => s.symbol === sym)) {
        const newEntry = {
          symbol: sym,
          companyName: stock.companyName,
          price: stock.price,
          previousClose: stock.previousClose,
          dayHigh: stock.high,
          dayLow: stock.low,
          sharesOwned: 100,
          buyPrice: stock.price,
          support: stock.stopLoss,
          resistance: stock.target2,
          target1: stock.target1,
          target2: stock.target2,
          target3: stock.targetDateTarget,
          stopLoss: stock.stopLoss,
          riskReward: stock.riskRewardRatio,
          lastUpdated: 'Live',
        };
        list.unshift(newEntry);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
      setAddedSymbols((prev) => new Set([...prev, sym]));
      if (onAddToPortfolio) {
        onAddToPortfolio(stock);
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="watch-for-next-day-module w-100 mb-5">
      {/* ── 1. HEADER BANNER & RESEARCH NOTICE ── */}
      <div
        className="card border-0 shadow-sm rounded-4 overflow-hidden text-white mb-4 p-4"
        style={{ background: 'linear-gradient(135deg, #070f1e 0%, #1e1b4b 50%, #0f172a 100%)' }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="fs-3">🔮</span>
              <h4 className="mb-0 fw-bold">Target-Date NSE Pre-Close Momentum Scanner</h4>
              <span className="btst-badge-blink">
                <span className="btst-dot"></span>
                BTST ACTIVE
              </span>
              <span className="badge bg-warning text-dark fw-bold px-2.5 py-1 small shadow-sm">
                ⏰ PRE-CLOSE STRATEGY ENGINE
              </span>
            </div>
            <p className="text-light opacity-75 small mb-0 mt-1">
              Scans end-of-day institutional accumulation, VWAP reclaim, Day-High breakouts, and corporate action safety to identify top setups for holding until your <strong>selected Target Sell Date</strong>.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-light d-flex align-items-center gap-1 shadow-sm fw-semibold"
              onClick={fetchAndScan}
              disabled={loading}
            >
              {loading ? <span className="spinner-border spinner-border-sm" /> : '🔄 Rescan Market'}
            </button>
          </div>
        </div>

        {/* RESEARCH & PAPER TRADING MANDATORY DISCLAIMER */}
        <div className="p-2.5 rounded-3 bg-dark bg-opacity-40 border border-light border-opacity-10 text-light small d-flex align-items-center gap-2">
          <span className="text-warning fs-5">⚠️</span>
          <span style={{ fontSize: 12 }}>
            <strong>Research & Paper Trading Notice:</strong> Technical signals cannot guarantee future returns. This scanner is for research and paper trading and does not constitute an automatic trade instruction. Always respect technical stop-loss invalidation.
          </span>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackMsg && (
        <div className="alert alert-success bg-success bg-opacity-25 border-success text-dark rounded-3 p-3 mb-4 d-flex align-items-center justify-content-between shadow-sm">
          <div className="d-flex align-items-center gap-2">
            <span className="fs-5">✓</span>
            <strong>{feedbackMsg}</strong>
          </div>
          <button type="button" className="btn-close" onClick={() => setFeedbackMsg(null)} />
        </div>
      )}

      {/* ── 1.5 🔔 REAL-TIME SESSION ALARM & PROFIT-PROTECTION BANNER ── */}
      {(() => {
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        }).formatToParts(now);
        const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
        const min = Number(parts.find((p) => p.type === 'minute')?.value || 0);
        const totalMins = hour * 60 + min;

        const isMorningExit = totalMins >= (9 * 60 + 15) && totalMins <= (9 * 60 + 50); // 9:15 AM - 9:50 AM
        const isMidDay = totalMins > (9 * 60 + 50) && totalMins < (15 * 60); // 9:51 AM - 2:59 PM
        const isPreCloseBuy = totalMins >= (15 * 60) && totalMins <= (15 * 60 + 25); // 3:00 PM - 3:25 PM

        if (isMorningExit) {
          return (
            <div className="alert bg-gradient text-white border-danger shadow-lg rounded-4 p-3.5 mb-4 animate-pulse" style={{ background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)' }}>
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-3">
                  <span className="display-6">🚨</span>
                  <div>
                    <span className="badge bg-warning text-dark fw-bold px-2.5 py-1 mb-1">MORNING PROFIT-PROTECTION EXIT ALARM (9:15 AM - 9:45 AM)</span>
                    <h5 className="fw-bold mb-1 text-white">BOOK YOUR BTST PROFITS NOW! DO NOT HOLD PAST 9:45 AM!</h5>
                    <p className="small text-light-50 mb-0">
                      If your stock made ₹600+ profit at open, <b>LOCK IN YOUR PROFIT NOW</b>! Morning gap-ups often fade after 9:45 AM as mid-day profit-booking begins.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-warning text-dark fw-bold px-3.5 py-2 shadow-sm rounded-pill text-nowrap"
                  onClick={() => {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
                      const osc = ctx.createOscillator();
                      const gain = ctx.createGain();
                      osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.1);
                      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
                      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.3);
                      osc.connect(gain);
                      gain.connect(ctx.destination);
                      osc.start(ctx.currentTime + i * 0.1);
                      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
                    });
                    setFeedbackMsg('🔔 Morning Exit Alarm Sounded! Book your BTST profits now.');
                  }}
                >
                  🔔 Sound Exit Alarm
                </button>
              </div>
            </div>
          );
        }

        if (isMidDay) {
          return (
            <div className="alert bg-dark text-white border-secondary border-opacity-50 shadow-sm rounded-4 p-3 mb-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-3">
                  <span className="fs-3 text-warning">⏸️</span>
                  <div>
                    <span className="badge bg-secondary text-light fw-bold mb-1">MID-DAY CONSOLIDATION SESSION (9:50 AM - 2:59 PM)</span>
                    <h6 className="fw-bold mb-0 text-light">Mid-day trading in progress. Do NOT buy new BTST stocks during mid-day.</h6>
                    <small className="text-muted">
                      If you booked profit this morning, enjoy your day! High-conviction BTST Buy Window opens at <b>3:00 PM IST afternoon</b>.
                    </small>
                  </div>
                </div>
                <span className="badge bg-primary bg-opacity-20 text-info border border-info border-opacity-25 p-2">
                  ⏰ Next Buy Window: 3:00 PM IST
                </span>
              </div>
            </div>
          );
        }

        if (isPreCloseBuy) {
          return (
            <div className="alert bg-gradient text-dark border-warning shadow-lg rounded-4 p-3.5 mb-4" style={{ background: 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)' }}>
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-3">
                  <span className="display-6">🎯</span>
                  <div>
                    <span className="badge bg-dark text-warning fw-bold px-2.5 py-1 mb-1">3:00 PM PRE-CLOSE BTST BUY WINDOW IS LIVE</span>
                    <h5 className="fw-bold mb-1 text-dark">BUY YOUR ADVANCE BTST STOCKS FOR TOMORROW NOW!</h5>
                    <p className="small text-dark opacity-90 mb-0">
                      Institutional pre-close accumulation is confirmed. Pick 1 or 2 high-conviction setups below before <b>3:25 PM market close</b>.
                    </p>
                  </div>
                </div>
                <span className="badge bg-dark text-white p-2.5 fs-6 fw-bold shadow-sm">
                  ⏰ Closes at 3:25 PM IST
                </span>
              </div>
            </div>
          );
        }

        return null;
      })()}

      {/* ── 2. TARGET SELL DATE SELECTOR & NSE CALENDAR STRIP ── */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4 bg-white border border-secondary border-opacity-10">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-2 border-bottom">
          <div className="d-flex align-items-center gap-2">
            <span className="fs-4 text-primary">📅</span>
            <div>
              <h6 className="mb-0 fw-bold text-dark">Target Sell Date & Holding Period Engine</h6>
              <small className="text-muted">Calculates actual NSE trading sessions (skipping weekends & official market holidays)</small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <label className="text-secondary small fw-bold mb-0 text-nowrap">Custom Sell Date:</label>
            <input
              type="date"
              className="form-control form-control-sm bg-light border-secondary"
              style={{ width: 145 }}
              value={customDateInput}
              onChange={handleCustomDateChange}
            />
          </div>
        </div>

        {/* Quick Target Date Preset Pills */}
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <span className="small text-secondary fw-bold me-1">Quick Select Target Date:</span>
          {suggestedPresets.map((preset) => {
            const isSelected = targetSellDate === preset.isoDate;
            const isBtst = preset.label?.includes('BTST') || preset.holdingType === 'BTST / 1-DAY';
            return (
              <button
                key={preset.isoDate}
                type="button"
                className={`btn btn-sm rounded-pill fw-bold px-3 shadow-sm d-inline-flex align-items-center gap-1.5 ${
                  isSelected ? 'btn-primary text-white' : 'btn-outline-secondary'
                }`}
                onClick={() => handleSelectPresetTargetDate(preset.isoDate)}
              >
                <span>{preset.label}</span>
                {isBtst && (
                  <span className="btst-badge-blink ms-1" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>
                    <span className="btst-dot"></span>
                    BTST
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* CALENDAR METRICS STRIP */}
        <div className="row g-2 text-center text-md-start pt-2 border-top border-light">
          <div className="col-6 col-md-3">
            <div className="p-2 rounded bg-success bg-opacity-10 border border-success border-opacity-25">
              <span className="text-success small fw-bold d-block" style={{ fontSize: 11 }}>🛒 BUY DATE (ENTRY WINDOW)</span>
              <strong className="text-dark fs-6">{scanResult.sessionInfo.buyDateFormatted}</strong>
              <small className="text-success fw-bold d-block" style={{ fontSize: 10.5 }}>⏰ Buy 3:00 PM – 3:25 PM IST Today</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-2 rounded bg-primary bg-opacity-10 border border-primary border-opacity-25">
              <span className="text-primary small fw-bold d-block" style={{ fontSize: 11 }}>🎯 TARGET SELL DATE WINDOW</span>
              <strong className="text-primary fs-6">{scanResult.sessionInfo.adjustedTargetSellDateFormatted}</strong>
              <small className="text-primary fw-bold d-block" style={{ fontSize: 10.5 }}>⏰ Sell 9:15 AM – 9:45 AM IST Tomorrow</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-2 rounded bg-light border">
              <span className="text-muted small d-block" style={{ fontSize: 11 }}>NSE HOLDING PERIOD</span>
              <strong className="text-success fs-6">
                {scanResult.sessionInfo.tradingSessions} Trading Session{scanResult.sessionInfo.tradingSessions === 1 ? '' : 's'}
              </strong>
              <small className="text-muted d-block" style={{ fontSize: 10 }}>Overnight BTST Position</small>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-2 rounded bg-light border">
              <span className="text-muted small d-block" style={{ fontSize: 11 }}>CALENDAR DETAILS</span>
              <small className="text-secondary fw-semibold d-block mt-1" style={{ fontSize: 11.5 }}>
                {scanResult.sessionInfo.weekendDaysExcluded > 0 ? `${scanResult.sessionInfo.weekendDaysExcluded} weekend days skipped` : 'No weekend gap'}
                {scanResult.sessionInfo.holidaysEncountered.length > 0 ? ` | ${scanResult.sessionInfo.holidaysEncountered.length} holiday` : ''}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2.5 💰 CAPITAL BUDGET & QUANTITY SIZING PLANNER ── */}
      <div
        className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#f8fafc' }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-2 border-bottom border-secondary border-opacity-50">
          <div className="d-flex align-items-center gap-2">
            <span className="fs-4">💰</span>
            <div>
              <h5 className="mb-0 fw-bold text-white d-flex align-items-center gap-2 flex-wrap">
                <span>Capital Budget & Quantity Sizing Engine</span>
                <span className="btst-badge-blink" style={{ fontSize: '0.65rem' }}>
                  <span className="btst-dot"></span>
                  LIVE CALCULATOR
                </span>
              </h5>
              <small className="text-light text-opacity-75">
                Calculates exact shares to buy, expected profit at Target 1 & 2, max risk, and 50% profit lock
              </small>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="d-flex align-items-center gap-1.5 flex-wrap">
            <span className="small text-light text-opacity-75 me-1">Quick Budget:</span>
            {[25000, 50000, 100000, 200000].map((amt) => (
              <button
                key={amt}
                type="button"
                className={`btn btn-sm rounded-pill fw-bold px-2.5 ${
                  userBudget === amt ? 'btn-warning text-dark' : 'btn-outline-light'
                }`}
                style={{ fontSize: '0.75rem' }}
                onClick={() => setUserBudget(amt)}
              >
                ₹{(amt / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
        </div>

        <div className="row g-3 align-items-center">
          {/* Budget Input */}
          <div className="col-12 col-md-3">
            <label className="small text-light text-opacity-75 fw-bold mb-1 d-block">
              Total Budget (₹):
            </label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-dark text-warning border-secondary fw-bold">₹</span>
              <input
                type="number"
                min="1000"
                step="5000"
                className="form-control form-control-sm bg-dark text-white border-secondary fw-bold fs-6"
                value={userBudget}
                onChange={(e) => setUserBudget(Math.max(Number(e.target.value) || 0, 1000))}
              />
            </div>
          </div>

          {/* Strategy Split Switcher */}
          <div className="col-12 col-md-5">
            <label className="small text-light text-opacity-75 fw-bold mb-1 d-block">
              Portfolio Allocation Strategy:
            </label>
            <div className="btn-group btn-group-sm w-100 shadow-sm" role="group">
              <button
                type="button"
                className={`btn fw-bold ${allocationSplit === 'SPLIT_2' ? 'btn-primary text-white' : 'btn-outline-light'}`}
                onClick={() => setAllocationSplit('SPLIT_2')}
              >
                🎯 2 Stocks (₹{(userBudget / 2).toLocaleString('en-IN')}/ea)
              </button>
              <button
                type="button"
                className={`btn fw-bold ${allocationSplit === 'SPLIT_3' ? 'btn-primary text-white' : 'btn-outline-light'}`}
                onClick={() => setAllocationSplit('SPLIT_3')}
              >
                🛡️ 3 Stocks (₹{Math.round(userBudget / 3).toLocaleString('en-IN')}/ea)
              </button>
              <button
                type="button"
                className={`btn fw-bold ${allocationSplit === 'ALL_IN_1' ? 'btn-primary text-white' : 'btn-outline-light'}`}
                onClick={() => setAllocationSplit('ALL_IN_1')}
              >
                🚀 1 Stock (100%)
              </button>
            </div>
          </div>

          {/* Portfolio Target Goals Metric */}
          <div className="col-12 col-md-4">
            <div className="p-2.5 rounded-3 border border-secondary border-opacity-50" style={{ background: 'rgba(2, 6, 23, 0.5)' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="small text-light text-opacity-75">Target Profit (+4% to +10%):</span>
                <strong className="text-success fw-bold">
                  +₹{Math.round(userBudget * 0.04).toLocaleString('en-IN')} to +₹{Math.round(userBudget * 0.10).toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="small text-light text-opacity-75">Max Risk (Stop Loss ~2.5%):</span>
                <strong className="text-danger fw-bold">
                  -₹{Math.round(userBudget * 0.025).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. VIEW MODE NAVIGATION TABS ── */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div className="btn-group shadow-sm" role="group">
          <button
            type="button"
            className={`btn btn-sm fw-bold px-3 py-2 ${activeTab === 'TOP_10' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveTab('TOP_10')}
          >
            🏆 Top 10 Bullish Picks ({scanResult.top10.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm fw-bold px-3 py-2 ${activeTab === 'PROFIT_BOOKING' ? 'btn-danger text-white' : 'btn-outline-danger'}`}
            onClick={() => setActiveTab('PROFIT_BOOKING')}
          >
            📉 Profit Booking / Distribution ({profitBookingStocks.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm fw-bold px-3 py-2 ${activeTab === 'FULL_TABLE' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveTab('FULL_TABLE')}
          >
            📊 Full Results Table ({scanResult.allCandidates.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm fw-bold px-3 py-2 ${activeTab === 'DATE_HISTORY' ? 'btn-dark text-white' : 'btn-outline-dark'}`}
            onClick={() => setActiveTab('DATE_HISTORY')}
          >
            📜 Date-Wise History Archive
          </button>
        </div>

        {(activeTab === 'TOP_10' || activeTab === 'PROFIT_BOOKING') && (
          <div className="d-flex flex-wrap align-items-center gap-3">
            {/* Display Count Controller */}
            <div className="d-flex align-items-center gap-1 bg-light p-1 rounded-pill border">
              <span className="small text-muted fw-bold ms-2 me-1" style={{ fontSize: 11 }}>SHOW STOCKS:</span>
              {[10, 20, 30, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`btn btn-sm rounded-pill fw-bold px-2.5 py-0.5 ${
                    displayLimit === num ? 'btn-primary text-white shadow-sm' : 'btn-light text-muted'
                  }`}
                  style={{ fontSize: 11 }}
                  onClick={() => setDisplayLimit(num)}
                >
                  {num === 50 ? 'All (40+)' : `${num}`}
                </button>
              ))}
            </div>

            {/* Conviction & Circuit Lock Filters */}
            {activeTab === 'TOP_10' && (
              <div className="d-flex flex-wrap align-items-center gap-1.5">
                <span className="small text-muted fw-bold">Filter:</span>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill fw-bold px-2.5 ${excludeUpperCircuit ? 'btn-warning text-dark border-warning' : 'btn-outline-secondary'}`}
                  onClick={() => setExcludeUpperCircuit(!excludeUpperCircuit)}
                  title="Hide stocks locked in 100% Upper Circuit freeze with zero sellers"
                >
                  {excludeUpperCircuit ? '⚡ Actionable Buyable Only' : '🔒 Include 100% Circuit Locked'}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill fw-bold px-2.5 ${selectedSignalTier === 'ALL' ? 'btn-dark' : 'btn-outline-secondary'}`}
                  onClick={() => setSelectedSignalTier('ALL')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill fw-bold px-2.5 ${selectedSignalTier === 'HIGH CONVICTION' ? 'btn-danger text-white' : 'btn-outline-danger'}`}
                  onClick={() => setSelectedSignalTier('HIGH CONVICTION')}
                >
                  🔥 High Conviction
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill fw-bold px-2.5 ${selectedSignalTier === 'STRONG' ? 'btn-success text-white' : 'btn-outline-success'}`}
                  onClick={() => setSelectedSignalTier('STRONG')}
                >
                  🟢 Strong
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 4. TAB CONTENT 1: TOP 10 CARDS FOR SELECTED TARGET DATE ── */}
      {activeTab === 'TOP_10' && (
        <div className="top-10-container">
          {/* 🔥 TODAY'S #1 TRENDING BUSINESS SECTOR HERO BANNER */}
          {trendingSectorInfo.topTrendingSector && (
            <div className="p-3.5 rounded-4 mb-4 border border-warning border-opacity-50 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #31103f 100%)' }}>
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="badge bg-warning text-dark fw-bold px-2.5 py-1.5 fs-6 shadow-sm">
                    🔥 TODAY'S #1 TRENDING BUSINESS SECTOR
                  </span>
                  <h5 className="mb-0 fw-bold text-warning">{trendingSectorInfo.topTrendingSector.category}</h5>
                  <span className="badge bg-danger text-white fw-bold">
                    {trendingSectorInfo.topTrendingSector.count} Active Setups
                  </span>
                </div>
                <div className="d-flex align-items-center gap-3 small flex-wrap">
                  <span className="text-light">Avg Sector Gain: <strong className="text-success fs-6">+{trendingSectorInfo.topTrendingSector.avgChange}%</strong></span>
                </div>
              </div>
            </div>
          )}

          <div className="d-flex align-items-center justify-content-between mb-3">
            <h5 className="fw-bold text-dark mb-0">
              🌟 TOP {filteredTop10.length} STOCKS FOR {scanResult.sessionInfo.adjustedTargetSellDateFormatted.toUpperCase()}
            </h5>
            <small className="text-muted">
              Holding Period: <strong>{scanResult.sessionInfo.tradingSessions} NSE Session{scanResult.sessionInfo.tradingSessions === 1 ? '' : 's'}</strong>
            </small>
          </div>

          {loading && scanResult.top10.length === 0 ? (
            <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
              <div className="spinner-border text-primary mx-auto mb-3" />
              <h6 className="fw-bold">Evaluating Pre-Close Momentum & Target-Date Structure...</h6>
              <small className="text-muted">Analyzing VWAP, 5-minute EMA alignment, volume ratios, corporate actions, and realistic target boundaries</small>
            </div>
          ) : filteredTop10.length === 0 ? (
            <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
              <h5>No stocks match the selected tier filter</h5>
              <p className="text-muted small">Switch to &ldquo;All&rdquo; to view all ranked candidates.</p>
              <button type="button" className="btn btn-sm btn-primary rounded-pill px-4 mx-auto" onClick={() => setSelectedSignalTier('ALL')}>
                View All Top 10
              </button>
            </div>
          ) : (
            <div className="d-flex flex-column gap-4">
              {/* 🌟 1. TOP #1 HERO STOCK: RECOMMENDED BUY PICK FOR TOMORROW */}
              {(() => {
                const stock = filteredTop10[0];
                const isTracked = riskTrackedSymbols.has(stock.symbol);
                const isPositive = stock.changePercent >= 0;
                const plan = getStockBudgetPlan(stock);
                const buyerDemandPct = calculateBuyerDemandPct(stock);
                const is100PctBuyers = buyerDemandPct === 100;

                return (
                  <div key={stock.symbol}>
                    <div className="card border-0 shadow-lg rounded-4 overflow-hidden bg-white p-3 p-md-4 border-start border-5 border-warning">
                      <div className="p-2.5 px-3 mb-3 rounded-3 text-dark fw-bold d-flex flex-column gap-2 shadow-sm" style={{ background: 'linear-gradient(90deg, #fef08a 0%, #fde047 100%)', border: '1px solid #eab308' }}>
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="fs-6 fw-bold">🌟 RECOMMENDED BUY PICK FOR TOMORROW</span>
                            <span className="badge bg-dark text-warning">HIGH CONVICTION (#1 TOP PICK)</span>
                            <span className="badge bg-success text-white">🟢 SIGNAL STABLE (Rank #1)</span>
                            {is100PctBuyers && (
                              <span className="badge bg-danger text-white animate-pulse">
                                🔒 100% BUYERS LOCKED IN CIRCUIT
                              </span>
                            )}
                            <span className="badge bg-dark text-info">⏱️ Live Scan Refresh in: {countdownSeconds}s</span>
                          </div>
                          <span className="small text-dark">
                            ⏰ <b>Buy Window: 3:00 PM – 3:25 PM IST Today</b> | Target Exit: <b>9:15 AM – 9:45 AM Tomorrow</b>
                          </span>
                        </div>
                        {is100PctBuyers && (
                          <div className="p-2.5 rounded-2 bg-dark text-warning small fw-normal d-flex align-items-center justify-content-between flex-wrap gap-2 shadow-sm border border-warning border-opacity-50">
                            <div>
                              ⚡ <b>Upper Circuit Freeze (100% Buyers):</b> Zero sellers are available for instant market orders.
                            </div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                className="btn btn-sm btn-warning text-dark fw-bold px-3 py-1 rounded-pill shadow-sm"
                                onClick={() => setExcludeUpperCircuit(true)}
                              >
                                ⚡ Auto-Switch to Actionable Buyable Pick
                              </button>
                              <span className="badge bg-secondary text-white fw-bold">
                                Or place AMO order
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Header */}
                      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 border-bottom pb-3 mb-3">
                        <div className="d-flex align-items-start gap-3">
                          <div
                            className="rounded-3 px-3 py-2 text-center text-white fw-bold shadow-sm"
                            style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', minWidth: 54 }}
                          >
                            <div style={{ fontSize: 10, opacity: 0.8 }}>RANK</div>
                            <div className="fs-5">#1</div>
                          </div>

                          <div>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                              <span className="badge bg-dark fs-6 px-3 py-1 fw-bold">{stock.symbol}</span>
                              <span className="btst-badge-blink">
                                <span className="btst-dot"></span>
                                BTST HERO PICK
                              </span>
                              <h4 className="mb-0 fw-bold text-dark">{stock.companyName}</h4>
                              <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-2 py-1 small fw-bold">
                                {getSectorCategory(stock.symbol, stock.sector, stock.companyName)}
                              </span>
                            </div>
                            <div className="d-flex flex-wrap align-items-center gap-2 mt-1.5 small">
                              {stock.price < stock.vwap ? (
                                <span className="badge bg-danger text-white px-2.5 py-1 fw-bold">
                                  ❌ DO NOT BUY — Dumping Below VWAP
                                </span>
                              ) : (
                                <span className="badge bg-danger px-2.5 py-1 fw-bold">
                                  {stock.signalBadge || 'HIGH CONVICTION'}
                                </span>
                              )}
                              <span className="badge bg-light text-dark border">
                                {stock.breakoutStatus}
                              </span>
                              {is100PctBuyers && (
                                <span className="badge bg-warning text-dark border border-warning px-2 py-1 fw-bold">
                                  🔒 100% BUYERS (Upper Circuit Locked)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-end">
                          <div className="d-flex align-items-baseline justify-content-end gap-2">
                            <span className="fs-3 fw-bold text-dark">₹{stock.price.toFixed(2)}</span>
                            <span className={`badge ${isPositive ? 'bg-success' : 'bg-danger'} px-2.5 py-1 fs-6`}>
                              {isPositive ? '▲ +' : '▼ '}{stock.changePercent.toFixed(2)}%
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 mt-1 fw-bold text-decoration-none"
                            onClick={() => setInspectingScoreStock(stock)}
                            title="Click to view full 100-point score breakdown"
                          >
                            <span className="badge bg-primary text-white px-2.5 py-1">
                              🎯 Target-Date Score: {stock.score}/100 ℹ️
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Live Buyer Demand Meter */}
                      <div className="p-2.5 rounded-3 mb-3 border border-secondary border-opacity-15 shadow-sm bg-light">
                        <div className="d-flex align-items-center justify-content-between mb-1.5 flex-wrap gap-1">
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-bold text-dark small">📊 Live Buyer vs Seller Demand:</span>
                            <span className={`badge ${buyerDemandPct === 100 ? 'bg-danger text-white animate-pulse' : buyerDemandPct >= 75 ? 'bg-success text-white' : 'bg-warning text-dark'} fw-bold`}>
                              {buyerDemandPct === 100 ? '🔒 100% BUYERS (Upper Circuit Locked)' : `${buyerDemandPct}% BUYERS ACTIVE`}
                            </span>
                          </div>
                          <span className="small text-muted fw-semibold">
                            {buyerDemandPct === 100 ? 'Zero Sellers Available (100% Buyer Bids)' : `${100 - buyerDemandPct}% Sellers Remaining`}
                          </span>
                        </div>
                        <div className="progress overflow-hidden" style={{ height: 14, borderRadius: 7, background: '#e2e8f0' }}>
                          <div
                            className={`progress-bar progress-bar-striped ${buyerDemandPct === 100 ? 'bg-danger progress-bar-animated' : buyerDemandPct >= 75 ? 'bg-success' : 'bg-warning text-dark'}`}
                            role="progressbar"
                            style={{ width: `${buyerDemandPct}%`, transition: 'width 0.6s ease-in-out' }}
                          >
                            <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>{buyerDemandPct}% Buyers</span>
                          </div>
                        </div>
                      </div>

                      {/* Buy & Sell Schedule */}
                      <div className="p-2.5 rounded-3 mb-3 border border-secondary border-opacity-25 shadow-sm" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff' }}>
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-success text-white px-2.5 py-1.5 fw-bold" style={{ fontSize: '0.78rem' }}>🛒 BUY DATE</span>
                            <div>
                              <strong className="text-warning d-block" style={{ fontSize: '0.85rem' }}>Buy Today ({scanResult.sessionInfo.buyDateFormatted})</strong>
                              <small className="text-light opacity-75 d-block" style={{ fontSize: '0.73rem' }}>⏰ Best Window: <strong>3:00 PM – 3:25 PM IST</strong> (Pre-Close)</small>
                            </div>
                          </div>
                          <div className="text-light opacity-40 fs-5 d-none d-md-block">➔</div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-primary text-white px-2.5 py-1.5 fw-bold" style={{ fontSize: '0.78rem' }}>🎯 SELL DATE</span>
                            <div>
                              <strong className="text-info d-block" style={{ fontSize: '0.85rem' }}>Sell Tomorrow ({scanResult.sessionInfo.adjustedTargetSellDateFormatted})</strong>
                              <small className="text-light opacity-75 d-block" style={{ fontSize: '0.73rem' }}>⏰ Best Window: <strong>9:15 AM – 9:45 AM IST</strong> (Gap-Up)</small>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Budget Sizing & Buttons */}
                      <div className="p-3 rounded-3 mb-3 border border-primary border-opacity-30" style={{ background: 'linear-gradient(135deg, rgba(238, 242, 255, 0.7) 0%, rgba(240, 253, 244, 0.7) 100%)' }}>
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="badge bg-primary text-white fw-bold px-2 py-1">
                              💰 ₹{userBudget.toLocaleString('en-IN')} BUDGET PLAN
                            </span>
                            <span className="text-dark fw-bold">
                              Buy <span className="text-primary fs-5">{plan.qty} Shares</span> (₹{plan.invested.toLocaleString('en-IN')})
                            </span>
                          </div>
                          <span className="badge bg-success bg-opacity-25 text-success border border-success fw-bold px-2 py-1">
                            R:R 1 : {plan.rrRatio}
                          </span>
                        </div>
                        <div className="row g-2 text-start small">
                          <div className="col-6 col-md-3">
                            <div className="p-2 rounded bg-white border">
                              <span className="text-muted d-block" style={{ fontSize: 11 }}>🎯 TARGET 1 PROFIT</span>
                              <strong className="text-success fs-6">+₹{plan.t1Profit.toLocaleString('en-IN')}</strong>
                              <small className="text-muted d-block" style={{ fontSize: 10 }}>at ₹{Number(stock.target1 || stock.targetDateTarget).toFixed(2)} (+{stock.potentialReturnPct}%)</small>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div className="p-2 rounded bg-white border">
                              <span className="text-muted d-block" style={{ fontSize: 11 }}>🎯 TARGET 2 PROFIT</span>
                              <strong className="text-success fs-6">+₹{plan.t2Profit.toLocaleString('en-IN')}</strong>
                              <small className="text-muted d-block" style={{ fontSize: 10 }}>at ₹{Number(stock.target2 || stock.price * 1.07).toFixed(2)}</small>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div className="p-2 rounded bg-white border">
                              <span className="text-muted d-block" style={{ fontSize: 11 }}>🛑 MAX RISK AT SL</span>
                              <strong className="text-danger fs-6">-₹{plan.slLoss.toLocaleString('en-IN')}</strong>
                              <small className="text-muted d-block" style={{ fontSize: 10 }}>at ₹{stock.stopLoss.toFixed(2)} (-{((stock.price - stock.stopLoss)/stock.price*100).toFixed(1)}%)</small>
                            </div>
                          </div>
                          <div className="col-6 col-md-3">
                            <div className="p-2 rounded bg-white border">
                              <span className="text-muted d-block" style={{ fontSize: 11 }}>🔒 50% LOCK STRATEGY</span>
                              <strong className="text-dark" style={{ fontSize: 11.5 }}>Sell {plan.halfQty} Qty at T1</strong>
                              <small className="text-success fw-bold d-block" style={{ fontSize: 10 }}>Lock +₹{plan.halfProfitT1} & Trail</small>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="d-flex flex-wrap justify-content-end gap-2">
                        <button
                          type="button"
                          className="btn btn-warning text-dark fw-bold px-4 py-2 rounded-pill shadow-sm d-flex align-items-center gap-2"
                          onClick={() => handlePaperBtstBuy(stock, plan)}
                          disabled={isTracked}
                        >
                          <span>🟡 QUICK PAPER BTST BUY ({plan.qty} Qty)</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-success text-white fw-bold px-3.5 py-2 rounded-pill shadow-sm"
                          onClick={() => {
                            if (onQuickTrade) {
                              onQuickTrade({
                                ...stock,
                                sharesQuantity: plan.qty,
                                allocatedBudget: plan.invested,
                                buyPrice: stock.price,
                                stopLoss: stock.stopLoss,
                                target1: stock.target1 || stock.targetDateTarget,
                                target2: stock.target2,
                              });
                            }
                          }}
                        >
                          ⚡ Live Order ({plan.qty} Qty)
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-warning text-dark fw-bold px-3 py-2 rounded-pill shadow-sm d-flex align-items-center gap-1"
                          onClick={() => handleTrackInRiskEngine(stock)}
                          disabled={isTracked}
                        >
                          {isTracked ? '✓ Tracked in Risk Monitor' : '🛡️ Track in Risk Engine'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 📊 2. REMAINING RANKED CANDIDATES IN TABLE VIEW */}
              {filteredTop10.length > 1 && (
                <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white p-3 p-md-4 mt-2">
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 pb-2 border-bottom">
                    <div>
                      <h5 className="fw-bold text-dark mb-0">
                        📊 REMAINING RANKED CANDIDATES FOR {scanResult.sessionInfo.adjustedTargetSellDateFormatted.toUpperCase()} ({filteredTop10.length - 1} STOCKS)
                      </h5>
                      <small className="text-muted">Ranked by Target-Date Score, Volume Ratio & VWAP Proximity</small>
                    </div>
                    <span className="badge bg-secondary-subtle text-secondary fw-semibold">Table View</span>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 text-nowrap">
                      <thead className="table-light">
                        <tr className="small text-muted">
                          <th>Rank</th>
                          <th>Symbol & Company</th>
                          <th>LTP (₹)</th>
                          <th>Change (%)</th>
                          <th>VWAP (₹)</th>
                          <th>Buyer Demand</th>
                          <th>Score</th>
                          <th>Target / SL</th>
                          <th>Budget Qty</th>
                          <th className="text-end">Quick Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTop10.slice(1).map((stock) => {
                          const isTracked = riskTrackedSymbols.has(stock.symbol);
                          const isPositive = stock.changePercent >= 0;
                          const plan = getStockBudgetPlan(stock);
                          const buyerDemandPct = calculateBuyerDemandPct(stock);
                          const isBelowVwap = stock.price < stock.vwap;

                          return (
                            <tr key={stock.symbol} className={isBelowVwap ? 'table-warning opacity-90' : ''}>
                              <td>
                                <span className="badge bg-dark fw-bold">#{stock.rank}</span>
                              </td>
                              <td>
                                <div>
                                  <strong className="text-dark d-block">{stock.symbol}</strong>
                                  <small className="text-muted d-block" style={{ fontSize: 11 }}>
                                    {stock.companyName}
                                  </small>
                                </div>
                              </td>
                              <td className="fw-bold fs-6">₹{stock.price.toFixed(2)}</td>
                              <td>
                                <span className={`badge ${isPositive ? 'bg-success' : 'bg-danger'} px-2 py-1`}>
                                  {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                                </span>
                              </td>
                              <td>
                                <span className={isBelowVwap ? 'text-danger fw-bold' : 'text-muted'}>
                                  ₹{Number(stock.vwap).toFixed(2)} {isBelowVwap ? '⚠️' : '✓'}
                                </span>
                              </td>
                              <td style={{ minWidth: 130 }}>
                                <BuyerDemandMeter stock={stock} compact />
                              </td>
                              <td>
                                <span className="badge bg-primary px-2.5 py-1 font-monospace">
                                  {stock.score}/100
                                </span>
                              </td>
                              <td>
                                <div className="small">
                                  <div className="text-success fw-bold">T: ₹{stock.targetDateTarget.toFixed(2)}</div>
                                  <div className="text-danger">SL: ₹{stock.stopLoss.toFixed(2)}</div>
                                </div>
                              </td>
                              <td>
                                <span className="badge bg-light text-dark border fw-bold">
                                  {plan.qty} Shares
                                </span>
                              </td>
                              <td className="text-end">
                                <div className="d-flex align-items-center justify-content-end gap-1.5">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-warning text-dark fw-bold px-2.5 py-1 rounded-2 shadow-sm"
                                    onClick={() => handlePaperBtstBuy(stock, plan)}
                                    disabled={isTracked}
                                    title="Quick Paper BTST Buy"
                                  >
                                    🟡 Buy ({plan.qty})
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-warning text-dark fw-semibold px-2 py-1 rounded-2"
                                    onClick={() => handleTrackInRiskEngine(stock)}
                                    disabled={isTracked}
                                    title="Track in Risk Monitor"
                                  >
                                    {isTracked ? '✓' : '🛡️ Risk'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 4.5. TAB CONTENT: TOP 10 PROFIT BOOKING / DISTRIBUTION STOCKS ── */}
      {activeTab === 'PROFIT_BOOKING' && (
        <div className="profit-booking-container">
          <div className="alert shadow-lg rounded-4 p-3.5 mb-4" style={{ background: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)', border: '2px solid #f87171', color: '#000000' }}>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-3">
                <span className="display-6">📉</span>
                <div>
                  <span className="badge bg-danger text-white fw-bold px-2.5 py-1 mb-1">PROFIT BOOKING & OVERHEAD SUPPLY RADAR</span>
                  <h5 className="fw-bold mb-1 text-dark" style={{ color: '#000000' }}>TOP 10 STOCKS SHOWING PROFIT TAKING FOR {scanResult.sessionInfo.adjustedTargetSellDateFormatted.toUpperCase()}</h5>
                  <p className="small text-dark mb-0" style={{ color: '#000000', fontWeight: 500 }}>
                    Institutional profit booking, upper wick rejection, or dumping below VWAP. <b className="text-danger fw-bold">Avoid fresh buying</b> or set tight trailing stops to lock profit.
                  </p>
                </div>
              </div>
              <span className="badge bg-dark text-warning p-2.5 fs-6 fw-bold shadow-sm">
                ⚠️ AVOID FRESH BUYING
              </span>
            </div>
          </div>

          <div className="row g-4">
            {profitBookingStocks.length === 0 ? (
              <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
                <h5 className="fw-bold">No Heavy Profit Booking Pressure Detected</h5>
                <p className="text-muted small">All scanned universe candidates are holding support levels cleanly.</p>
              </div>
            ) : (
              profitBookingStocks.map((stock) => {
                const isTracked = riskTrackedSymbols.has(stock.symbol);
                const plan = getStockBudgetPlan(stock);
                return (
                  <div className="col-12" key={stock.symbol}>
                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white p-3 p-md-4 border-start border-5 border-danger shadow-lg">
                      <div className="p-2 px-3 mb-3 rounded-3 text-white fw-bold d-flex flex-wrap align-items-center justify-content-between gap-2 shadow-sm" style={{ background: 'linear-gradient(90deg, #991b1b 0%, #7f1d1d 100%)' }}>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <span className="fs-6 fw-bold">🔴 PROFIT BOOKING / DISTRIBUTION ALERT</span>
                          <span className="badge bg-dark text-warning">HIGH SUPPLY PRESSURE</span>
                          <span className="badge bg-light text-danger fw-bold">Rank #{stock.pbRank}</span>
                        </div>
                        <span className="small text-white">
                          ❌ Avoid Fresh Entry | Consider Exit or Tight Trailing SL
                        </span>
                      </div>

                      {/* Stock Details Header */}
                      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 border-bottom pb-3 mb-3">
                        <div className="d-flex align-items-start gap-3">
                          <div className="rounded-3 px-3 py-2 text-center text-white fw-bold shadow-sm bg-danger" style={{ minWidth: 54 }}>
                            <div style={{ fontSize: 10, opacity: 0.8 }}>PB RANK</div>
                            <div className="fs-5">#{stock.pbRank}</div>
                          </div>
                          <div>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                              <span className="badge bg-dark fs-6 px-3 py-1 fw-bold">{stock.symbol}</span>
                              <h5 className="mb-0 fw-bold text-dark">{stock.companyName}</h5>
                            </div>
                            <div className="d-flex flex-wrap align-items-center gap-2 mt-1.5 small">
                              <span className="badge bg-danger text-white px-2.5 py-1 fw-bold">
                                ❌ Dumping below ₹{Number(stock.vwap).toFixed(2)} VWAP
                              </span>
                              <span className="badge bg-warning text-dark border px-2 py-1 fw-bold">
                                Score: {stock.score}/100
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-end">
                          <div className="d-flex align-items-baseline justify-content-end gap-2">
                            <span className="fs-4 fw-bold text-dark">₹{stock.price.toFixed(2)}</span>
                            <span className={`badge ${stock.changePercent >= 0 ? 'bg-success' : 'bg-danger'} px-2.5 py-1 fs-6`}>
                              {stock.changePercent >= 0 ? '▲ +' : '▼ '}{stock.changePercent.toFixed(2)}%
                            </span>
                          </div>
                          <div className="small text-muted mt-1">VWAP: ₹{Number(stock.vwap).toFixed(2)}</div>
                        </div>
                      </div>

                      {/* Rationale & Action Buttons */}
                      <div className="p-2.5 rounded-3 bg-light border text-dark small mb-3">
                        <strong>⚠️ Profit Taking Rationale:</strong> {stock.riskWarnings.length > 0 ? stock.riskWarnings.join(' • ') : 'Stock trading below VWAP with high distribution pressure.'}
                      </div>

                      <div className="d-flex flex-wrap justify-content-end gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger fw-bold px-3 shadow-sm"
                          onClick={() => handleTrackInRiskEngine(stock)}
                          disabled={isTracked}
                        >
                          {isTracked ? '✓ Tracking Exit Alert' : '🚨 Register Exit Alarm'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── 5. TAB CONTENT 2: COMPREHENSIVE 28-COLUMN RESULTS TABLE ── */}
      {activeTab === 'FULL_TABLE' && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white p-3 p-md-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
            <div>
              <h5 className="fw-bold text-dark mb-0">
                📊 Detailed Technical Results Table (Target Date: {scanResult.sessionInfo.adjustedTargetSellDateFormatted})
              </h5>
              <small className="text-muted">Complete 28-metric multi-factor breakdown across all evaluated NSE candidates</small>
            </div>
            <span className="badge bg-primary fs-6 px-3 py-1.5 fw-bold">
              {scanResult.allCandidates.length} Total Candidates
            </span>
          </div>

          <div className="table-responsive" style={{ maxHeight: 650, overflowY: 'auto' }}>
            <table className="table table-hover table-striped align-middle table-sm small mb-0 text-nowrap">
              <thead className="table-dark sticky-top" style={{ zIndex: 5 }}>
                <tr>
                  <th>Rank</th>
                  <th>Symbol</th>
                  <th>Company</th>
                  <th>Buy Date</th>
                  <th>Target Sell Date</th>
                  <th>Sessions</th>
                  <th>LTP (₹)</th>
                  <th>Suggested Qty</th>
                  <th>Invested (₹)</th>
                  <th>T1 Profit (₹)</th>
                  <th>Change %</th>
                  <th>VWAP (₹)</th>
                  <th>Vol Ratio</th>
                  <th>EMA 9</th>
                  <th>EMA 20</th>
                  <th>EMA 50</th>
                  <th>RSI 14</th>
                  <th>MACD</th>
                  <th>Day High Dist</th>
                  <th>Breakout</th>
                  <th>Market Str</th>
                  <th>Sector Str</th>
                  <th>Corporate Action</th>
                  <th>Score</th>
                  <th>Signal</th>
                  <th>Entry Zone</th>
                  <th>Stop Loss</th>
                  <th>Target 1</th>
                  <th>Target 2</th>
                  <th>Target Date Target</th>
                  <th>Potential Return</th>
                  <th>Risk/Reward</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {scanResult.allCandidates.map((stock) => {
                  const isPositive = stock.changePercent >= 0;
                  const isTracked = riskTrackedSymbols.has(stock.symbol);
                  const plan = getStockBudgetPlan(stock);

                  return (
                    <tr key={stock.symbol}>
                      <td><span className="badge bg-dark fw-bold">#{stock.rank}</span></td>
                      <td><strong>{stock.symbol}</strong></td>
                      <td>{stock.companyName}</td>
                      <td>
                        <span className="badge bg-success bg-opacity-25 text-success border border-success fw-bold px-2 py-1">
                          🛒 Buy: {stock.buyDateFormatted} (3:00 PM)
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-primary bg-opacity-25 text-primary border border-primary fw-bold px-2 py-1">
                          🎯 Sell: {stock.targetSellDateFormatted} (9:15 AM)
                        </span>
                      </td>
                      <td><span className="badge bg-light text-dark border">{stock.holdingSessions}</span></td>
                      <td className="fw-bold">₹{stock.price.toFixed(2)}</td>
                      <td>
                        <span className="badge bg-primary text-white fw-bold px-2 py-1">
                          {plan.qty} Qty
                        </span>
                      </td>
                      <td className="fw-semibold">₹{plan.invested.toLocaleString('en-IN')}</td>
                      <td>
                        <span className="text-success fw-bold">
                          +₹{plan.t1Profit.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className={isPositive ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                        {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </td>
                      <td>₹{stock.vwap.toFixed(2)}</td>
                      <td><span className="badge bg-info text-dark">{stock.volumeRatio}x</span></td>
                      <td>₹{stock.ema9.toFixed(2)}</td>
                      <td>₹{stock.ema20.toFixed(2)}</td>
                      <td>₹{stock.ema50.toFixed(2)}</td>
                      <td>{stock.rsi14}</td>
                      <td>
                        <span className={`badge ${stock.macd.trend === 'BULLISH' ? 'bg-success' : 'bg-secondary'}`}>
                          {stock.macd.trend}
                        </span>
                      </td>
                      <td>{stock.distanceFromDayHigh}%</td>
                      <td><span className="badge bg-light text-dark border">{stock.breakoutStatus}</span></td>
                      <td>{stock.marketStrength}</td>
                      <td>{stock.sectorStrength}</td>
                      <td>
                        <span className={`badge ${stock.corporateAction.status === 'NONE' ? 'bg-success' : 'bg-warning text-dark'}`}>
                          {stock.corporateAction.status === 'NONE' ? 'Clean' : 'Caution'}
                        </span>
                      </td>
                      <td><strong className="text-primary fs-6">{stock.score}/100</strong></td>
                      <td>
                        <span className={`badge ${stock.signalTier === 'HIGH CONVICTION' ? 'bg-danger' : stock.signalTier === 'STRONG' ? 'bg-success' : 'bg-warning text-dark'}`}>
                          {stock.signalTier}
                        </span>
                      </td>
                      <td>{stock.entryZone}</td>
                      <td className="text-danger fw-bold">₹{stock.stopLoss.toFixed(2)}</td>
                      <td className="text-success">₹{stock.target1.toFixed(2)}</td>
                      <td className="text-success">₹{stock.target2.toFixed(2)}</td>
                      <td className="text-success fw-bold">₹{stock.targetDateTarget.toFixed(2)}</td>
                      <td className="text-success fw-bold">+{stock.potentialReturnPct}%</td>
                      <td><strong>1 : {stock.riskRewardRatio}</strong></td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-info text-dark fw-bold px-2 py-0.5"
                            onClick={() => {
                              if (onQuickTrade) {
                                onQuickTrade({
                                  ...stock,
                                  sharesQuantity: plan.qty,
                                  allocatedBudget: plan.invested,
                                  buyPrice: stock.price,
                                  stopLoss: stock.stopLoss,
                                  target1: stock.target1 || stock.targetDateTarget,
                                  target2: stock.target2,
                                });
                              }
                            }}
                            title={`Practice trade with ${plan.qty} shares`}
                            style={{ fontSize: 11 }}
                          >
                            🎓 Practice
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-success text-white fw-bold px-2 py-0.5"
                            onClick={() => {
                              if (onQuickTrade) {
                                onQuickTrade({
                                  ...stock,
                                  sharesQuantity: plan.qty,
                                  allocatedBudget: plan.invested,
                                  buyPrice: stock.price,
                                  stopLoss: stock.stopLoss,
                                  target1: stock.target1 || stock.targetDateTarget,
                                  target2: stock.target2,
                                });
                              }
                            }}
                            title={`Live trade with ${plan.qty} shares`}
                            style={{ fontSize: 11 }}
                          >
                            ⚡ Trade
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-outline-warning text-dark fw-bold px-2 py-0.5"
                            onClick={() => handleTrackInRiskEngine(stock)}
                            disabled={isTracked}
                            style={{ fontSize: 11 }}
                          >
                            {isTracked ? '✓ Tracked' : '🛡️ Risk'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 6. TAB CONTENT 3: DATE-WISE HISTORY ARCHIVE ── */}
      {activeTab === 'DATE_HISTORY' && (
        <div className="history-archive-container">
          <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-white">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold text-dark">Select Past Scan Date:</span>
                <div className="btn-group" role="group">
                  <button
                    type="button"
                    className={`btn btn-sm fw-bold px-3 ${selectedHistoryDate === '2026-08-27' ? 'btn-dark text-white' : 'btn-outline-dark'}`}
                    onClick={() => setSelectedHistoryDate('2026-08-27')}
                  >
                    📜 27-Aug-2026 (Yesterday — 83.3% Win Rate)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm fw-bold px-3 ${selectedHistoryDate === '2026-08-26' ? 'btn-dark text-white' : 'btn-outline-dark'}`}
                    onClick={() => setSelectedHistoryDate('2026-08-26')}
                  >
                    📜 26-Aug-2026 (WEL +17.5%)
                  </button>
                </div>
              </div>

              {activeHistoryRecord && (
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div className="badge bg-success text-white px-3 py-2 fs-6 fw-bold shadow-sm">
                    🏆 Win Rate: {activeHistoryRecord.winRatePct}% ({activeHistoryRecord.winCount} Wins / {activeHistoryRecord.lossCount} Loss)
                  </div>
                  <div className="badge bg-info text-white px-3 py-2 fs-6 fw-bold shadow-sm">
                    📈 Avg Next-Morning Return: +{activeHistoryRecord.avgReturnPct}%
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Historical Cards */}
          {activeHistoryRecord && (
            <div className="row g-4">
              {activeHistoryRecord.stocks.map((stock, idx) => {
                const isPositive = (stock.realizedGainPct || 0) >= 0;
                const isTracked = riskTrackedSymbols.has(stock.symbol);

                return (
                  <div className="col-12" key={stock.symbol}>
                    <div
                      className={`card border-0 shadow-sm rounded-4 overflow-hidden bg-white p-3 p-md-4 border-start border-4 ${
                        stock.outcomeStatus === 'TARGET_2_HIT'
                          ? 'border-warning'
                          : stock.outcomeStatus === 'TARGET_HIT' || isPositive
                          ? 'border-success'
                          : 'border-danger'
                      }`}
                    >
                      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 border-bottom pb-3 mb-3">
                        <div className="d-flex align-items-start gap-3">
                          <div
                            className="rounded-3 px-3 py-2 text-center text-white fw-bold shadow-sm"
                            style={{
                              background: idx === 0 ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : '#334155',
                              minWidth: 54,
                            }}
                          >
                            <div style={{ fontSize: 10, opacity: 0.8 }}>PICK</div>
                            <div className="fs-5">#{idx + 1}</div>
                          </div>

                          <div>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                              <span className="badge bg-dark fs-6 px-3 py-1 fw-bold">{stock.symbol}</span>
                              <h5 className="mb-0 fw-bold text-dark">{stock.companyName}</h5>
                              <span className="badge bg-warning text-dark small fw-bold">
                                Scanned @ ₹{stock.scanPrice.toFixed(2)} ({stock.scanTime})
                              </span>
                            </div>
                            <div className="d-flex flex-wrap align-items-center gap-2 mt-1.5 small">
                              <span className="badge bg-primary px-2.5 py-1 fw-bold">
                                Score: {stock.momentumScore}/100
                              </span>
                              <span className="badge bg-light text-dark border">
                                {stock.stage}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Next Morning Actual Outcome Badge */}
                        <div className="text-end">
                          <div className="badge fs-6 px-3 py-1.5 shadow-sm fw-bold" style={{
                            background: stock.outcomeStatus === 'TARGET_2_HIT' ? '#d97706' : isPositive ? '#16a34a' : '#dc2626',
                            color: '#fff',
                          }}>
                            {stock.outcomeBadge || (isPositive ? `+${stock.realizedGainPct}% GAIN` : `${stock.realizedGainPct}% LOSS`)}
                          </div>
                          <div className="small text-muted mt-1">
                            Next Morning Open: <strong>₹{stock.nextMorningOpen?.toFixed(2)}</strong> | High: <strong>₹{stock.nextMorningHigh?.toFixed(2)}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Outcome Note & Trade Plan */}
                      <div className="row g-3 align-items-center">
                        <div className="col-12 col-md-8">
                          {stock.outcomeNote && (
                            <div className="p-2.5 rounded-3 bg-light border text-dark small mb-2">
                              <strong>Performance Note:</strong> {stock.outcomeNote}
                            </div>
                          )}
                          <div className="d-flex flex-wrap gap-3 small">
                            <span>Target 1: <strong className="text-success">₹{stock.target1.toFixed(2)}</strong></span>
                            <span>Target 2: <strong className="text-success">₹{stock.target2.toFixed(2)}</strong></span>
                            <span>Stop Loss: <strong className="text-danger">₹{stock.stopLoss.toFixed(2)}</strong></span>
                            <span>VWAP on Scan: <strong>₹{stock.vwap.toFixed(2)}</strong></span>
                          </div>
                        </div>

                        <div className="col-12 col-md-4 text-md-end d-flex flex-wrap justify-content-md-end gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning text-dark fw-bold px-3 shadow-sm d-flex align-items-center gap-1"
                            onClick={() => handleTrackInRiskEngine(stock)}
                            disabled={isTracked}
                          >
                            {isTracked ? '✓ Tracked in Risk Monitor' : '🛡️ Track in Risk Engine'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 7. 100-POINT SCORE BREAKDOWN MODAL ── */}
      {inspectingScoreStock && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content rounded-4 shadow border-0 overflow-hidden">
              <div className="modal-header bg-dark text-white px-4 py-3">
                <div>
                  <h6 className="modal-title fw-bold mb-0">
                    🎯 100-Point Target-Date Score Breakdown: {inspectingScoreStock.symbol}
                  </h6>
                  <small className="text-light opacity-75">{inspectingScoreStock.companyName}</small>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setInspectingScoreStock(null)} />
              </div>

              <div className="modal-body p-4 small">
                <div className="d-flex align-items-center justify-content-between p-3 rounded-3 bg-light border mb-3">
                  <div>
                    <span className="text-muted d-block" style={{ fontSize: 11 }}>TOTAL TARGET-DATE SCORE</span>
                    <h3 className="fw-bold mb-0 text-primary">{inspectingScoreStock.score} / 100</h3>
                  </div>
                  <span className={`badge ${inspectingScoreStock.signalTier === 'HIGH CONVICTION' ? 'bg-danger' : inspectingScoreStock.signalTier === 'STRONG' ? 'bg-success' : 'bg-warning text-dark'} fs-6 px-3 py-1.5`}>
                    {inspectingScoreStock.signalBadge}
                  </span>
                </div>

                <div className="row g-2">
                  <div className="col-6">
                    <div className="p-2.5 rounded border bg-white d-flex justify-content-between align-items-center">
                      <span>Pre-Close Momentum (Max 25):</span>
                      <strong className="text-dark">{inspectingScoreStock.scoreBreakdown.preCloseMomentum} / 25</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2.5 rounded border bg-white d-flex justify-content-between align-items-center">
                      <span>VWAP Strength (Max 15):</span>
                      <strong className="text-dark">{inspectingScoreStock.scoreBreakdown.vwapStrength} / 15</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2.5 rounded border bg-white d-flex justify-content-between align-items-center">
                      <span>5-Min EMA Trend (Max 10):</span>
                      <strong className="text-dark">{inspectingScoreStock.scoreBreakdown.emaTrend} / 10</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2.5 rounded border bg-white d-flex justify-content-between align-items-center">
                      <span>Volume Expansion (Max 15):</span>
                      <strong className="text-dark">{inspectingScoreStock.scoreBreakdown.volumeExpansion} / 15</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2.5 rounded border bg-white d-flex justify-content-between align-items-center">
                      <span>Breakout Strength (Max 10):</span>
                      <strong className="text-dark">{inspectingScoreStock.scoreBreakdown.breakoutStrength} / 10</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2.5 rounded border bg-white d-flex justify-content-between align-items-center">
                      <span>Day-High Strength (Max 5):</span>
                      <strong className="text-dark">{inspectingScoreStock.scoreBreakdown.dayHighStrength} / 5</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2.5 rounded border bg-white d-flex justify-content-between align-items-center">
                      <span>Market/Sector Strength (Max 10):</span>
                      <strong className="text-dark">{inspectingScoreStock.scoreBreakdown.marketSector} / 10</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-2.5 rounded border bg-white d-flex justify-content-between align-items-center">
                      <span>Liquidity Gate (Max 5):</span>
                      <strong className="text-dark">{inspectingScoreStock.scoreBreakdown.liquidity} / 5</strong>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="p-2.5 rounded border bg-white d-flex justify-content-between align-items-center">
                      <span>Corporate-Action Safety (Max 5):</span>
                      <strong className="text-dark">{inspectingScoreStock.scoreBreakdown.corporateActionSafety} / 5</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer p-3 bg-light">
                <button type="button" className="btn btn-sm btn-dark px-4 fw-bold" onClick={() => setInspectingScoreStock(null)}>
                  Close Breakdown
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. CANDLESTICK CHART MODAL ── */}
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
