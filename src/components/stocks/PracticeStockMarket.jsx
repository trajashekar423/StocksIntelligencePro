'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import StockDetailModal from './StockDetailModal.jsx';
import { evaluateOverboughtStatus } from '../../services/risk/overboughtEngine';

const STORAGE_WALLET_KEY = 'practice_stock_market_wallet_v1';
const STORAGE_POSITIONS_KEY = 'practice_stock_market_positions_v1';
const STORAGE_HISTORY_KEY = 'practice_stock_market_history_v1';

const INITIAL_CAPITAL = 100000; // ₹1,00,000 default dummy budget

const QUICK_STOCK_PICKS = [
  { symbol: 'SWIGGY', name: 'Swiggy Limited', desc: 'Overbought Reversal & Intraday Short Demo' },
  { symbol: 'INFY', name: 'Infosys Limited', desc: 'Tech Intraday Active' },
  { symbol: 'TATASTEEL', name: 'Tata Steel Limited', desc: 'Metal Momentum Setup' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', desc: 'Nifty 50 Blue Chip' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', desc: 'Banking Major' },
  { symbol: 'CUPID', name: 'Cupid Limited', desc: 'High Volatility Runner' },
  { symbol: 'IFCI', name: 'IFCI Limited', desc: 'High Volume Intraday Active' },
];

export default function PracticeStockMarket() {
  // Wallet & Dummy Funds State
  const [wallet, setWallet] = useState({
    balance: INITIAL_CAPITAL,
    initialCapital: INITIAL_CAPITAL,
  });

  // Active Positions & History
  const [openPositions, setOpenPositions] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);

  // Selected Stock for Practice Analysis & Order Placement
  const [selectedSymbol, setSelectedSymbol] = useState('SWIGGY');
  const [searchSymbolInput, setSearchSymbolInput] = useState('');
  const [quoteData, setQuoteData] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(null);

  // Order Placement Direction: 'BUY' (Go Long) vs 'SELL' (Short Sell)
  const [orderSide, setOrderSide] = useState('BUY');
  const [orderQty, setOrderQty] = useState(100);
  const [customSlPct, setCustomSlPct] = useState(1.5); // default 1.5% Stop Loss
  const [customTgtPct, setCustomTgtPct] = useState(2.5); // default 2.5% Target 1
  const [orderFeedback, setOrderFeedback] = useState(null);

  // Terminal Practice Mode: 'EQUITY' vs 'OPTIONS'
  const [practiceTerminalTab, setPracticeTerminalTab] = useState('EQUITY');

  // Options Simulator State
  const [optIndex, setOptIndex] = useState('NIFTY 50');
  const [optType, setOptType] = useState('PUT'); // 'CALL' (CE) vs 'PUT' (PE)
  const [optStrike, setOptStrike] = useState(23650);
  const [optLots, setOptLots] = useState(1);
  const [optSlPct, setOptSlPct] = useState(20); // 20% SL on option premium
  const [optTgtPct, setOptTgtPct] = useState(40); // 40% Target on option premium

  // Modals & Sound
  const [chartModalStock, setChartModalStock] = useState(null);
  const [showLearningGuide, setShowLearningGuide] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Audio Synthesizer for Practice Notifications
  const playSound = useCallback((type) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      if (type === 'WIN' || type === 'PROFIT') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.12, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.28);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.28);
        });
      } else if (type === 'STOP_LOSS') {
        [440, 329.63].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.1, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.25);
        });
      }
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  // 1. Load LocalStorage on mount
  useEffect(() => {
    try {
      const savedWallet = localStorage.getItem(STORAGE_WALLET_KEY);
      if (savedWallet) setWallet(JSON.parse(savedWallet));

      const savedPositions = localStorage.getItem(STORAGE_POSITIONS_KEY);
      if (savedPositions) setOpenPositions(JSON.parse(savedPositions));

      const savedHistory = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (savedHistory) setTradeHistory(JSON.parse(savedHistory));
    } catch {
      // ignore
    }
  }, []);

  // 2. Save Wallet
  const updateWallet = (newWallet) => {
    setWallet(newWallet);
    try {
      localStorage.setItem(STORAGE_WALLET_KEY, JSON.stringify(newWallet));
    } catch {
      // ignore
    }
  };

  // 3. Save Positions
  const updatePositions = (newPositions) => {
    setOpenPositions(newPositions);
    try {
      localStorage.setItem(STORAGE_POSITIONS_KEY, JSON.stringify(newPositions));
    } catch {
      // ignore
    }
  };

  // 4. Save History
  const updateHistory = (newHistory) => {
    setTradeHistory(newHistory);
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(newHistory));
    } catch {
      // ignore
    }
  };

  // Preset Balance Reset
  const handleSetCapital = (amount) => {
    const updated = {
      balance: amount,
      initialCapital: amount,
    };
    updateWallet(updated);
    setOrderFeedback(`💰 Dummy Funds Reset to ₹${amount.toLocaleString('en-IN')}`);
    setTimeout(() => setOrderFeedback(null), 3000);
  };

  // Reset Everything
  const handleResetAll = () => {
    if (window.confirm('Reset all practice positions, wallet balance, and trade history?')) {
      const freshWallet = { balance: INITIAL_CAPITAL, initialCapital: INITIAL_CAPITAL };
      updateWallet(freshWallet);
      updatePositions([]);
      updateHistory([]);
      setOrderFeedback('🔄 Simulator completely reset with ₹1,00,000 dummy funds!');
      setTimeout(() => setOrderFeedback(null), 3500);
    }
  };

  // 5. Fetch Live Quote for Selected Symbol
  const fetchLiveQuote = useCallback(async (sym) => {
    if (!sym) return;
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const res = await fetch(`/api/quote-equity?symbol=${encodeURIComponent(sym)}`);
      if (res.ok) {
        const json = await res.json();
        const priceInfo = json?.priceInfo || {};
        const ltp = Number(priceInfo.lastPrice || 0);
        if (ltp > 0) {
          setQuoteData({
            symbol: sym,
            companyName: json?.info?.companyName || `${sym} Limited`,
            price: ltp,
            previousClose: Number(priceInfo.previousClose || ltp),
            change: Number(priceInfo.change || 0),
            pChange: Number(priceInfo.pChange || 0),
            vwap: Number(priceInfo.vwap || ltp),
            high: Number(priceInfo.intraDayHighLow?.max || ltp),
            low: Number(priceInfo.intraDayHighLow?.min || ltp),
            lastUpdated: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
          });
        } else {
          setQuoteError(`No price data received for ${sym}`);
        }
      } else {
        setQuoteError(`Failed to fetch live quote for ${sym} (HTTP ${res.status})`);
      }
    } catch (err) {
      setQuoteError(err.message || 'Network error');
    } finally {
      setQuoteLoading(false);
    }
  }, []);

  // Poll live quote for selected symbol
  useEffect(() => {
    fetchLiveQuote(selectedSymbol);
    const timer = setInterval(() => fetchLiveQuote(selectedSymbol), 10000);
    return () => clearInterval(timer);
  }, [selectedSymbol, fetchLiveQuote]);

  // 6. Live Tick Polling for ALL Open Positions (Every 10 seconds)
  useEffect(() => {
    if (openPositions.length === 0) return;

    let isMounted = true;
    const pollPositions = async () => {
      const updatedList = await Promise.all(
        openPositions.map(async (pos) => {
          try {
            const res = await fetch(`/api/quote-equity?symbol=${pos.symbol}`);
            if (!res.ok) return pos;
            const data = await res.json();
            const currentPrice = Number(data?.priceInfo?.lastPrice || pos.currentPrice);
            const vwap = Number(data?.priceInfo?.vwap || pos.vwap || currentPrice);
            const isShort = pos.side === 'SELL';

            // P&L calculation:
            // For BUY: (currentPrice - entryPrice) * qty
            // For SELL (Short): (entryPrice - currentPrice) * qty
            const pnl = isShort
              ? Number(((pos.entryPrice - currentPrice) * pos.qty).toFixed(2))
              : Number(((currentPrice - pos.entryPrice) * pos.qty).toFixed(2));
            const pnlPct = isShort
              ? Number((((pos.entryPrice - currentPrice) / pos.entryPrice) * 100).toFixed(2))
              : Number((((currentPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2));

            let highestPrice = Math.max(pos.highestPrice || pos.entryPrice, currentPrice);
            let lowestPrice = Math.min(pos.lowestPrice || pos.entryPrice, currentPrice);
            let peakPnl = Math.max(pos.peakPnl || 0, pnl);
            let trailingStop = pos.trailingStop || pos.stopLoss;

            // Trailing Stop Logic:
            if (!isShort) {
              // ── LONG POSITION TRAILING SL ──
              if (pnlPct >= 1.0 && trailingStop < pos.entryPrice) {
                trailingStop = pos.entryPrice; // Move to Cost
              }
              if (pnlPct >= 1.8) {
                const trailTarget = Number((highestPrice * 0.988).toFixed(2));
                if (trailTarget > trailingStop) trailingStop = trailTarget;
              }

              // AUTO-EXIT: STOP LOSS HIT FOR LONG
              if (currentPrice <= trailingStop) {
                playSound('STOP_LOSS');
                const closedTrade = {
                  id: pos.id,
                  symbol: pos.symbol,
                  companyName: pos.companyName,
                  side: 'BUY',
                  qty: pos.qty,
                  entryPrice: pos.entryPrice,
                  exitPrice: trailingStop,
                  pnl: Number(((trailingStop - pos.entryPrice) * pos.qty).toFixed(2)),
                  pnlPct: Number((((trailingStop - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2)),
                  exitReason: trailingStop >= pos.entryPrice ? '🛡️ Breakeven SL Protected (Never-Red)' : '🛑 Stop Loss Hit (Capital Defended)',
                  lesson: trailingStop >= pos.entryPrice
                    ? 'Excellent execution! You moved Stop Loss to Cost and avoided turning a winning trade into a loss.'
                    : 'Great discipline! Taking a small controlled loss preserved your trading capital to fight another day.',
                  entryTime: pos.entryTime,
                  exitTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
                };

                const returnedCash = (pos.qty * pos.entryPrice) + closedTrade.pnl;
                setWallet((prev) => {
                  const nextWallet = { ...prev, balance: Number((prev.balance + returnedCash).toFixed(2)) };
                  localStorage.setItem(STORAGE_WALLET_KEY, JSON.stringify(nextWallet));
                  return nextWallet;
                });
                setTradeHistory((prev) => {
                  const nextHist = [closedTrade, ...prev];
                  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(nextHist));
                  return nextHist;
                });
                setOrderFeedback(`🛑 ${pos.symbol} Long Stop Loss Triggered at ₹${trailingStop.toFixed(2)} (P&L: ₹${closedTrade.pnl})`);
                setTimeout(() => setOrderFeedback(null), 4000);
                return null;
              }

              // AUTO-EXIT: TARGET 2 HIT FOR LONG
              if (pos.target2 && currentPrice >= pos.target2) {
                playSound('WIN');
                const closedTrade = {
                  id: pos.id,
                  symbol: pos.symbol,
                  companyName: pos.companyName,
                  side: 'BUY',
                  qty: pos.qty,
                  entryPrice: pos.entryPrice,
                  exitPrice: pos.target2,
                  pnl: Number(((pos.target2 - pos.entryPrice) * pos.qty).toFixed(2)),
                  pnlPct: Number((((pos.target2 - pos.entryPrice) / pos.entryPrice) * 100).toFixed(2)),
                  exitReason: '🎯 Target 2 (+5.0%) Runner Hit!',
                  lesson: 'Masterclass trade! You let your runner position capture the full institutional expansion wave.',
                  entryTime: pos.entryTime,
                  exitTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
                };

                const returnedCash = (pos.qty * pos.entryPrice) + closedTrade.pnl;
                setWallet((prev) => {
                  const nextWallet = { ...prev, balance: Number((prev.balance + returnedCash).toFixed(2)) };
                  localStorage.setItem(STORAGE_WALLET_KEY, JSON.stringify(nextWallet));
                  return nextWallet;
                });
                setTradeHistory((prev) => {
                  const nextHist = [closedTrade, ...prev];
                  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(nextHist));
                  return nextHist;
                });
                setOrderFeedback(`🎉 ${pos.symbol} Target 2 Hit (+₹${closedTrade.pnl})! Full Profit Banked!`);
                setTimeout(() => setOrderFeedback(null), 4000);
                return null;
              }
            } else {
              // ── SHORT POSITION TRAILING SL (Trails Downwards) ──
              if (pnlPct >= 1.0 && trailingStop > pos.entryPrice) {
                trailingStop = pos.entryPrice; // Move down to Cost
              }
              if (pnlPct >= 1.8) {
                const trailTarget = Number((lowestPrice * 1.012).toFixed(2));
                if (trailTarget < trailingStop) trailingStop = trailTarget;
              }

              // AUTO-EXIT: STOP LOSS HIT FOR SHORT (Price rises above stop)
              if (currentPrice >= trailingStop) {
                playSound('STOP_LOSS');
                const closedTrade = {
                  id: pos.id,
                  symbol: pos.symbol,
                  companyName: pos.companyName,
                  side: 'SELL',
                  qty: pos.qty,
                  entryPrice: pos.entryPrice,
                  exitPrice: trailingStop,
                  pnl: Number(((pos.entryPrice - trailingStop) * pos.qty).toFixed(2)),
                  pnlPct: Number((((pos.entryPrice - trailingStop) / pos.entryPrice) * 100).toFixed(2)),
                  exitReason: trailingStop <= pos.entryPrice ? '🛡️ Short Breakeven Protected' : '🛑 Short Stop Loss Hit',
                  lesson: 'Flawless risk management on your short trade. Capital was strictly defended.',
                  entryTime: pos.entryTime,
                  exitTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
                };

                const returnedCash = (pos.qty * pos.entryPrice) + closedTrade.pnl;
                setWallet((prev) => {
                  const nextWallet = { ...prev, balance: Number((prev.balance + returnedCash).toFixed(2)) };
                  localStorage.setItem(STORAGE_WALLET_KEY, JSON.stringify(nextWallet));
                  return nextWallet;
                });
                setTradeHistory((prev) => {
                  const nextHist = [closedTrade, ...prev];
                  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(nextHist));
                  return nextHist;
                });
                setOrderFeedback(`🛑 ${pos.symbol} Short Stop Loss Hit at ₹${trailingStop.toFixed(2)} (P&L: ₹${closedTrade.pnl})`);
                setTimeout(() => setOrderFeedback(null), 4000);
                return null;
              }

              // AUTO-EXIT: TARGET 2 HIT FOR SHORT (Price drops down to target)
              if (pos.target2 && currentPrice <= pos.target2) {
                playSound('WIN');
                const closedTrade = {
                  id: pos.id,
                  symbol: pos.symbol,
                  companyName: pos.companyName,
                  side: 'SELL',
                  qty: pos.qty,
                  entryPrice: pos.entryPrice,
                  exitPrice: pos.target2,
                  pnl: Number(((pos.entryPrice - pos.target2) * pos.qty).toFixed(2)),
                  pnlPct: Number((((pos.entryPrice - pos.target2) / pos.entryPrice) * 100).toFixed(2)),
                  exitReason: '🎯 Short Target 2 (-5.0% Dump) Hit!',
                  lesson: 'Incredible short selling execution! You capitalized on institutional dumping all the way to target.',
                  entryTime: pos.entryTime,
                  exitTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
                };

                const returnedCash = (pos.qty * pos.entryPrice) + closedTrade.pnl;
                setWallet((prev) => {
                  const nextWallet = { ...prev, balance: Number((prev.balance + returnedCash).toFixed(2)) };
                  localStorage.setItem(STORAGE_WALLET_KEY, JSON.stringify(nextWallet));
                  return nextWallet;
                });
                setTradeHistory((prev) => {
                  const nextHist = [closedTrade, ...prev];
                  localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(nextHist));
                  return nextHist;
                });
                setOrderFeedback(`🎉 ${pos.symbol} Short Target Hit (+₹${closedTrade.pnl})! Full Short Profit Banked!`);
                setTimeout(() => setOrderFeedback(null), 4000);
                return null;
              }
            }

            return {
              ...pos,
              currentPrice,
              vwap,
              highestPrice,
              lowestPrice,
              peakPnl,
              trailingStop,
              pnl,
              pnlPct,
            };
          } catch {
            return pos;
          }
        })
      );

      if (isMounted) {
        const remaining = updatedList.filter(Boolean);
        setOpenPositions(remaining);
        localStorage.setItem(STORAGE_POSITIONS_KEY, JSON.stringify(remaining));
      }
    };

    const interval = setInterval(pollPositions, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [openPositions, playSound]);

  // 7. Educational Entry & Overbought Checklist Analysis
  const entryAnalysis = useMemo(() => {
    if (!quoteData) return null;
    const price = quoteData.price;
    const vwap = quoteData.vwap;
    const pChange = quoteData.pChange;
    const low = quoteData.low;

    const isAboveVwap = price >= vwap;
    const isGreen = pChange > 0;

    // Overbought status
    const obEval = evaluateOverboughtStatus({
      currentPrice: price,
      vwap: vwap,
      rsi: isGreen ? 72 : 45,
    });

    let status = 'CAUTION';
    let badgeClass = 'bg-warning text-dark';
    let title = '⚠️ CAUTION — WAIT FOR CONFIRMATION';
    let guidance = 'Price is consolidating. Wait for confirmation!';
    let score = 50;

    if (orderSide === 'BUY') {
      if (obEval.isOverbought) {
        status = 'OVERBOUGHT_WARN';
        badgeClass = 'bg-danger text-white';
        title = '🚨 OVERBOUGHT WARNING — DO NOT BUY AT PEAK';
        guidance = `Stock is extended (+${obEval.vwapDeviationPct}% above VWAP). Buying here is a classic bull trap! Look for 🔴 Short Sell or wait for pullback to VWAP.`;
        score = 25;
      } else if (isAboveVwap && isGreen) {
        status = 'SAFE_ENTRY';
        badgeClass = 'bg-success text-white';
        title = '🟢 SAFE LONG ENTRY (Above VWAP)';
        guidance = `Price (₹${price.toFixed(2)}) is defending VWAP (₹${vwap.toFixed(2)}) in green (+${pChange.toFixed(2)}%). Safe to enter with SL below VWAP!`;
        score = 85;
      } else {
        status = 'DUMP_TRAP';
        badgeClass = 'bg-danger text-white';
        title = '❌ DO NOT BUY — Still Dumping Below VWAP';
        guidance = `Price is below VWAP (₹${vwap.toFixed(2)}). Sellers are in control.`;
        score = 30;
      }
    } else {
      // SHORT SELL (SELL FIRST)
      if (obEval.isOverbought || !isAboveVwap) {
        status = 'SAFE_SHORT';
        badgeClass = 'bg-danger text-white';
        title = '🔴 SAFE SHORT ENTRY (Sell High, Buy Low)';
        guidance = obEval.isOverbought
          ? `⚡ High conviction Short: Stock reached overbought exhaustion (+${obEval.vwapDeviationPct}% above VWAP). Sell at ₹${price.toFixed(2)} to capture dump back to VWAP!`
          : `⚡ Bearish breakdown below VWAP (₹${vwap.toFixed(2)}). Short momentum active. Sell now and target lower support!`;
        score = 90;
      } else {
        status = 'CAUTION';
        badgeClass = 'bg-warning text-dark';
        title = '⚠️ CAUTION — STRONG BULLISH MOMENTUM';
        guidance = `Stock is rising strongly above VWAP. Do not short into strong buying momentum without exhaustion confirmation!`;
        score = 40;
      }
    }

    // Calculated SL and Target for BUY vs SELL
    let calculatedSl, calculatedTgt1, calculatedTgt2;
    if (orderSide === 'BUY') {
      calculatedSl = Number((price * (1 - customSlPct / 100)).toFixed(2));
      calculatedTgt1 = Number((price * (1 + customTgtPct / 100)).toFixed(2));
      calculatedTgt2 = Number((price * 1.05).toFixed(2));
    } else {
      // SHORT SELL: SL is ABOVE entry, Targets are BELOW entry
      calculatedSl = Number((price * (1 + customSlPct / 100)).toFixed(2));
      calculatedTgt1 = Number((price * (1 - customTgtPct / 100)).toFixed(2));
      calculatedTgt2 = Number((price * 0.95).toFixed(2));
    }

    const marginRequired = Number((price * orderQty).toFixed(2));
    const maxRiskRupees = Number((Math.abs(price - calculatedSl) * orderQty).toFixed(2));
    const expectedGainRupees = Number((Math.abs(calculatedTgt1 - price) * orderQty).toFixed(2));
    const riskRewardRatio = maxRiskRupees > 0 ? (expectedGainRupees / maxRiskRupees).toFixed(1) : '2.0';

    return {
      status,
      score,
      badgeClass,
      title,
      guidance,
      obEval,
      isAboveVwap,
      isGreen,
      calculatedSl,
      calculatedTgt1,
      calculatedTgt2,
      marginRequired,
      maxRiskRupees,
      expectedGainRupees,
      riskRewardRatio,
    };
  }, [quoteData, customSlPct, customTgtPct, orderQty, orderSide]);

  // 8. Place Virtual Practice Order (BUY or SHORT SELL)
  const handlePlaceVirtualOrder = () => {
    if (!quoteData || !entryAnalysis) return;

    if (entryAnalysis.marginRequired > wallet.balance) {
      alert(
        `Insufficient virtual balance! Required: ₹${entryAnalysis.marginRequired.toLocaleString('en-IN')}, Available: ₹${wallet.balance.toLocaleString('en-IN')}. Reduce quantity or reset balance.`
      );
      return;
    }

    const newPosition = {
      id: `PRACTICE-${Date.now()}-${quoteData.symbol}`,
      symbol: quoteData.symbol,
      companyName: quoteData.companyName,
      side: orderSide, // 'BUY' or 'SELL'
      qty: orderQty,
      initialQty: orderQty,
      entryPrice: quoteData.price,
      currentPrice: quoteData.price,
      vwap: quoteData.vwap,
      stopLoss: entryAnalysis.calculatedSl,
      trailingStop: entryAnalysis.calculatedSl,
      target1: entryAnalysis.calculatedTgt1,
      target2: entryAnalysis.calculatedTgt2,
      highestPrice: quoteData.price,
      lowestPrice: quoteData.price,
      peakPnl: 0,
      pnl: 0,
      pnlPct: 0,
      entryTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      halfBooked: false,
    };

    // Deduct margin from wallet
    const nextWallet = {
      ...wallet,
      balance: Number((wallet.balance - entryAnalysis.marginRequired).toFixed(2)),
    };
    updateWallet(nextWallet);

    const nextPositions = [newPosition, ...openPositions];
    updatePositions(nextPositions);

    playSound('PROFIT');
    setOrderFeedback(
      orderSide === 'BUY'
        ? `🟢 Long Position Opened: Bought ${orderQty} ${quoteData.symbol} @ ₹${quoteData.price.toFixed(2)} (SL: ₹${entryAnalysis.calculatedSl}, Tgt: ₹${entryAnalysis.calculatedTgt1})`
        : `🔴 Short Position Opened: Sold ${orderQty} ${quoteData.symbol} @ ₹${quoteData.price.toFixed(2)} (SL: ₹${entryAnalysis.calculatedSl}, Tgt: ₹${entryAnalysis.calculatedTgt1})`
    );
    setTimeout(() => setOrderFeedback(null), 5000);
  };

  // 8b. Option Contract Pricing & Risk Calculation Helper
  const optionContractDetails = useMemo(() => {
    const isNifty = optIndex === 'NIFTY 50';
    const spot = isNifty ? 23650 : 51200;
    const lotSize = isNifty ? 25 : 15;
    const strike = Number(optStrike);

    // Calculate realistic option premium based on strike distance and Call/Put type
    let basePremium = isNifty ? 35 : 140;
    const dist = (strike - spot) * (optType === 'CALL' ? -1 : 1);
    const estPremium = Math.max(8, Number((basePremium + dist * 0.45).toFixed(2)));

    const totalQty = optLots * lotSize;
    const totalInvestment = Number((estPremium * totalQty).toFixed(2));
    const slPrice = Number((estPremium * (1 - optSlPct / 100)).toFixed(2));
    const tgtPrice = Number((estPremium * (1 + optTgtPct / 100)).toFixed(2));
    const maxLossRupees = Number(((estPremium - slPrice) * totalQty).toFixed(2));
    const maxGainRupees = Number(((tgtPrice - estPremium) * totalQty).toFixed(2));

    return {
      spot,
      lotSize,
      strike,
      estPremium,
      totalQty,
      totalInvestment,
      slPrice,
      tgtPrice,
      maxLossRupees,
      maxGainRupees,
      contractSymbol: `${optIndex === 'NIFTY 50' ? 'NIFTY' : 'BANKNIFTY'} ${strike} ${optType === 'CALL' ? 'Call (CE)' : 'Put (PE)'}`,
    };
  }, [optIndex, optType, optStrike, optLots, optSlPct, optTgtPct]);

  // 8c. Place Virtual Option Order (BUY CALL or BUY PUT)
  const handlePlaceOptionOrder = () => {
    const details = optionContractDetails;
    if (details.totalInvestment > wallet.balance) {
      alert(
        `Insufficient virtual balance! Required: ₹${details.totalInvestment.toLocaleString('en-IN')}, Available: ₹${wallet.balance.toLocaleString('en-IN')}. Reduce lots or reset balance.`
      );
      return;
    }

    const newPosition = {
      id: `OPT-${Date.now()}-${details.contractSymbol}`,
      symbol: details.contractSymbol,
      companyName: `${optIndex} Options Contract`,
      side: optType === 'CALL' ? 'BUY_CALL' : 'BUY_PUT',
      isOption: true,
      qty: details.totalQty,
      initialQty: details.totalQty,
      entryPrice: details.estPremium,
      currentPrice: details.estPremium,
      stopLoss: details.slPrice,
      trailingStop: details.slPrice,
      target1: details.tgtPrice,
      highestPrice: details.estPremium,
      lowestPrice: details.estPremium,
      peakPnl: 0,
      pnl: 0,
      pnlPct: 0,
      entryTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      halfBooked: false,
    };

    const nextWallet = {
      ...wallet,
      balance: Number((wallet.balance - details.totalInvestment).toFixed(2)),
    };
    updateWallet(nextWallet);

    const nextPositions = [newPosition, ...openPositions];
    updatePositions(nextPositions);

    playSound('PROFIT');
    setOrderFeedback(
      `🟢 ${optType === 'CALL' ? 'Call (CE)' : 'Put (PE)'} Option Opened: ${details.contractSymbol} @ ₹${details.estPremium} (${details.totalQty} Qty / ${optLots} Lot, Total: ₹${details.totalInvestment})`
    );
    setTimeout(() => setOrderFeedback(null), 5000);
  };

  // 9. Manual Partial Book (50%)
  const handlePartialBook50Pct = (posId) => {
    const pos = openPositions.find((p) => p.id === posId);
    if (!pos || pos.halfBooked || pos.qty <= 1) return;

    const sellQty = Math.floor(pos.qty / 2);
    const remainQty = pos.qty - sellQty;
    const isShort = pos.side === 'SELL';

    const lockedPnl = isShort
      ? Number(((pos.entryPrice - pos.currentPrice) * sellQty).toFixed(2))
      : Number(((pos.currentPrice - pos.entryPrice) * sellQty).toFixed(2));
    const lockedPnlPct = pos.pnlPct;

    // Return margin + locked PnL
    const returnedCash = (sellQty * pos.entryPrice) + lockedPnl;
    const nextWallet = {
      ...wallet,
      balance: Number((wallet.balance + returnedCash).toFixed(2)),
    };
    updateWallet(nextWallet);

    const updated = openPositions.map((p) => {
      if (p.id === posId) {
        return {
          ...p,
          qty: remainQty,
          halfBooked: true,
          trailingStop: p.entryPrice, // Move SL to Cost
        };
      }
      return p;
    });
    updatePositions(updated);

    const partialRecord = {
      id: `${pos.id}-PARTIAL`,
      symbol: pos.symbol,
      companyName: pos.companyName,
      side: pos.side,
      qty: sellQty,
      entryPrice: pos.entryPrice,
      exitPrice: pos.currentPrice,
      pnl: lockedPnl,
      pnlPct: lockedPnlPct,
      exitReason: '🎯 50% Profit Booked at Target 1 (SL Moved to Cost)',
      lesson: 'Golden Never-Red execution! You locked cash in the bank and made the remaining 50% shares 100% risk-free.',
      entryTime: pos.entryTime,
      exitTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };
    updateHistory([partialRecord, ...tradeHistory]);

    playSound('WIN');
    setOrderFeedback(`🎯 Locked +₹${lockedPnl} (+${lockedPnlPct}%) on ${sellQty} shares of ${pos.symbol}! Stop Loss moved to Cost (₹${pos.entryPrice}). You cannot lose on this trade!`);
    setTimeout(() => setOrderFeedback(null), 5000);
  };

  // 10. Manual Close Full Position
  const handleManualClosePosition = (posId) => {
    const pos = openPositions.find((p) => p.id === posId);
    if (!pos) return;

    const returnedCash = (pos.qty * pos.entryPrice) + pos.pnl;
    const nextWallet = {
      ...wallet,
      balance: Number((wallet.balance + returnedCash).toFixed(2)),
    };
    updateWallet(nextWallet);

    const closedRecord = {
      id: pos.id,
      symbol: pos.symbol,
      companyName: pos.companyName,
      side: pos.side,
      qty: pos.qty,
      entryPrice: pos.entryPrice,
      exitPrice: pos.currentPrice,
      pnl: pos.pnl,
      pnlPct: pos.pnlPct,
      exitReason: pos.pnl >= 0 ? '🟢 Manual Profit Exit' : '🛑 Manual Loss Cut',
      lesson: pos.pnl >= 0 ? 'Profits banked cleanly.' : 'Disciplined capital preservation. Cutting small losses protects your wallet.',
      entryTime: pos.entryTime,
      exitTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };
    updateHistory([closedRecord, ...tradeHistory]);

    const remaining = openPositions.filter((p) => p.id !== posId);
    updatePositions(remaining);

    if (pos.pnl > 0) playSound('WIN');
    setOrderFeedback(`Closed ${pos.symbol} (${pos.side}) @ ₹${pos.currentPrice.toFixed(2)} (P&L: ₹${pos.pnl > 0 ? '+' : ''}${pos.pnl})`);
    setTimeout(() => setOrderFeedback(null), 4000);
  };

  // 10b. Check if market is past 03:15 PM IST
  const isPast315Pm = useMemo(() => {
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(now);
      const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
      const min = Number(parts.find((p) => p.type === 'minute')?.value || 0);
      return (hour * 60 + min) >= (15 * 60 + 15);
    } catch {
      return false;
    }
  }, []);

  // 10c. Close all open profitable positions
  const handleCloseAllProfitablePositions = () => {
    const profitable = openPositions.filter((p) => (p.pnl || 0) > 0);
    if (profitable.length === 0) return;

    let totalReturnedCash = 0;
    const closedRecords = [];

    profitable.forEach((pos) => {
      totalReturnedCash += (pos.qty * pos.entryPrice) + pos.pnl;
      closedRecords.push({
        id: `${pos.id}-CLOSE-315`,
        symbol: pos.symbol,
        companyName: pos.companyName,
        side: pos.side,
        qty: pos.qty,
        entryPrice: pos.entryPrice,
        exitPrice: pos.currentPrice,
        pnl: pos.pnl,
        pnlPct: pos.pnlPct,
        exitReason: '⏰ 03:15 PM Mandatory Intraday Profit Sweep',
        lesson: 'Flawless time discipline! You locked in your daily profits before closing square-off algorithms wiped them out.',
        entryTime: pos.entryTime,
        exitTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
      });
    });

    const nextWallet = {
      ...wallet,
      balance: Number((wallet.balance + totalReturnedCash).toFixed(2)),
    };
    updateWallet(nextWallet);
    updateHistory([...closedRecords, ...tradeHistory]);

    const remaining = openPositions.filter((p) => (p.pnl || 0) <= 0);
    updatePositions(remaining);
  };

  // Portfolio Totals
  const totalInvested = useMemo(() => {
    return openPositions.reduce((sum, p) => sum + (p.qty * p.entryPrice), 0);
  }, [openPositions]);

  const totalCurrentValue = useMemo(() => {
    return openPositions.reduce((sum, p) => sum + (p.qty * p.entryPrice) + (p.pnl || 0), 0);
  }, [openPositions]);

  const totalUnrealizedPnl = useMemo(() => {
    return openPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  }, [openPositions]);

  const totalRealizedPnl = useMemo(() => {
    return tradeHistory.reduce((sum, h) => sum + (h.pnl || 0), 0);
  }, [tradeHistory]);

  const winCount = useMemo(() => tradeHistory.filter((h) => h.pnl > 0).length, [tradeHistory]);
  const lossCount = useMemo(() => tradeHistory.filter((h) => h.pnl < 0).length, [tradeHistory]);
  const winRate = tradeHistory.length > 0 ? ((winCount / tradeHistory.length) * 100).toFixed(1) : '0.0';

  return (
    <div className="practice-stock-market-module container-fluid px-0 pb-5">
      {/* ── 1. HEADER & DUMMY WALLET DASHBOARD ── */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 text-white" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-warning text-dark px-3 py-1.5 fw-bold fs-6">
                🎓 VIRTUAL INTRADAY SIMULATOR
              </span>
              <span className="badge bg-success bg-opacity-25 text-success fw-semibold">
                BUY & SHORT SELL (2-WAY)
              </span>
            </div>
            <h3 className="fw-bold mb-0">Practice Stock Market with Real NSE Feed</h3>
            <p className="text-light opacity-75 small mb-0 mt-1">
              Practice Long entries, Short Selling, Overbought safe exits, and Never-Red trailing stop discipline without risking real money.
            </p>
          </div>

          {/* Quick Capital Preset Buttons & Sound Toggle */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button
              type="button"
              className={`btn btn-sm ${soundEnabled ? 'btn-outline-warning' : 'btn-outline-secondary'}`}
              onClick={() => setSoundEnabled(!soundEnabled)}
              title="Toggle Audio Notifications"
            >
              {soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF'}
            </button>
            <div className="btn-group btn-group-sm">
              <button type="button" className="btn btn-outline-light" onClick={() => handleSetCapital(50000)}>
                ₹50k
              </button>
              <button type="button" className="btn btn-outline-light active" onClick={() => handleSetCapital(100000)}>
                ₹1 Lakh
              </button>
              <button type="button" className="btn btn-outline-light" onClick={() => handleSetCapital(500000)}>
                ₹5 Lakh
              </button>
            </div>
            <button type="button" className="btn btn-sm btn-danger fw-bold" onClick={handleResetAll}>
              🔄 Reset All
            </button>
          </div>
        </div>

        {/* 4 Key Stat Cards */}
        <div className="row g-3 mt-1">
          <div className="col-6 col-md-3">
            <div className="p-3 rounded-3 bg-white bg-opacity-10 border border-light border-opacity-10">
              <span className="text-light opacity-75 small d-block">Available Virtual Cash</span>
              <h4 className="fw-bold mb-0 mt-1 text-white">₹{wallet.balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h4>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 rounded-3 bg-white bg-opacity-10 border border-light border-opacity-10">
              <span className="text-light opacity-75 small d-block">Open Positions P&L</span>
              <h4 className={`fw-bold mb-0 mt-1 ${totalUnrealizedPnl >= 0 ? 'text-success' : 'text-danger'}`}>
                {totalUnrealizedPnl >= 0 ? '+₹' : '-₹'}{Math.abs(totalUnrealizedPnl).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </h4>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 rounded-3 bg-white bg-opacity-10 border border-light border-opacity-10">
              <span className="text-light opacity-75 small d-block">Total Realized P&L</span>
              <h4 className={`fw-bold mb-0 mt-1 ${totalRealizedPnl >= 0 ? 'text-success' : 'text-danger'}`}>
                {totalRealizedPnl >= 0 ? '+₹' : '-₹'}{Math.abs(totalRealizedPnl).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </h4>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="p-3 rounded-3 bg-white bg-opacity-10 border border-light border-opacity-10">
              <span className="text-light opacity-75 small d-block">Practice Win Rate</span>
              <h4 className="fw-bold mb-0 mt-1 text-warning">
                {winRate}% ({winCount}W / {lossCount}L)
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. REAL-TIME NOTIFICATION BANNER ── */}
      {orderFeedback && (
        <div className="alert alert-info border-2 border-info shadow-sm rounded-4 p-3 mb-4 fw-bold animate-pulse text-dark">
          {orderFeedback}
        </div>
      )}

      {/* ── 3. STOCK & OPTIONS ORDER ENTRY TERMINAL ── */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4 bg-light">
        {/* Terminal Header & Mode Switcher */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 pb-3 border-bottom border-secondary border-opacity-25">
          <div>
            <h5 className="fw-bold mb-0 text-dark">🎯 Virtual Order Placement Terminal</h5>
            <small className="text-muted">Practice Stock Equities (Long/Short) or Index Options (Call CE & Put PE).</small>
          </div>

          <div className="btn-group btn-group-sm">
            <button
              type="button"
              className={`btn ${practiceTerminalTab === 'EQUITY' ? 'btn-primary fw-bold' : 'btn-outline-secondary'}`}
              onClick={() => setPracticeTerminalTab('EQUITY')}
            >
              📈 Equities (Stocks)
            </button>
            <button
              type="button"
              className={`btn ${practiceTerminalTab === 'OPTIONS' ? 'btn-warning text-dark fw-bold' : 'btn-outline-secondary'}`}
              onClick={() => setPracticeTerminalTab('OPTIONS')}
            >
              📊 Options (NIFTY / BANKNIFTY Call & Put)
            </button>
          </div>
        </div>

        {/* ── OPTIONS PRACTICE TERMINAL BLOCK ── */}
        {practiceTerminalTab === 'OPTIONS' && (
          <div className="bg-white p-3 p-md-4 rounded-4 border border-warning shadow-sm mb-3">
            <div className="alert bg-gradient text-dark border-warning p-3 rounded-3 mb-3" style={{ background: 'linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%)' }}>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <h6 className="fw-bold mb-1">💡 Call (CE) vs Put (PE) Practice Cheat Sheet:</h6>
                  <ul className="mb-0 small ps-3">
                    <li><b>🟢 CALL (CE)</b>: Buy when you predict the index will <b>RISE / GO UP 📈</b></li>
                    <li><b>🔴 PUT (PE)</b>: Buy when you predict the index will <b>FALL / GO DOWN 📉</b></li>
                  </ul>
                </div>
                <div className="text-end">
                  <span className="badge bg-dark text-warning p-2">NIFTY Lot = 25 Qty</span>
                  <span className="badge bg-dark text-info p-2 ms-1">BANKNIFTY Lot = 15 Qty</span>
                </div>
              </div>
            </div>

            <div className="row g-3 align-items-center">
              {/* Index Selection */}
              <div className="col-md-3">
                <label className="form-label text-muted small fw-bold">1. Select Index:</label>
                <select
                  className="form-select form-select-sm fw-bold border-secondary"
                  value={optIndex}
                  onChange={(e) => {
                    const idx = e.target.value;
                    setOptIndex(idx);
                    setOptStrike(idx === 'NIFTY 50' ? 23650 : 51200);
                  }}
                >
                  <option value="NIFTY 50">🇮🇳 NIFTY 50 (Spot ~23,650)</option>
                  <option value="BANK NIFTY">🏦 BANK NIFTY (Spot ~51,200)</option>
                </select>
              </div>

              {/* Option Direction: CALL vs PUT */}
              <div className="col-md-3">
                <label className="form-label text-muted small fw-bold">2. Option Type:</label>
                <div className="btn-group w-100 btn-group-sm">
                  <button
                    type="button"
                    className={`btn ${optType === 'CALL' ? 'btn-success fw-bold' : 'btn-outline-success'}`}
                    onClick={() => setOptType('CALL')}
                  >
                    🟢 CALL (CE) 📈
                  </button>
                  <button
                    type="button"
                    className={`btn ${optType === 'PUT' ? 'btn-danger fw-bold' : 'btn-outline-danger'}`}
                    onClick={() => setOptType('PUT')}
                  >
                    🔴 PUT (PE) 📉
                  </button>
                </div>
              </div>

              {/* Strike Price */}
              <div className="col-md-3">
                <label className="form-label text-muted small fw-bold">3. Strike Price:</label>
                <select
                  className="form-select form-select-sm fw-bold border-secondary"
                  value={optStrike}
                  onChange={(e) => setOptStrike(Number(e.target.value))}
                >
                  {optIndex === 'NIFTY 50' ? (
                    <>
                      <option value={23600}>23600 Strike (ITM/OTM)</option>
                      <option value={23650}>23650 Strike (ATM - At The Money)</option>
                      <option value={23700}>23700 Strike</option>
                      <option value={23750}>23750 Strike</option>
                      <option value={23800}>23800 Strike</option>
                    </>
                  ) : (
                    <>
                      <option value={51000}>51000 Strike</option>
                      <option value={51200}>51200 Strike (ATM)</option>
                      <option value={51500}>51500 Strike</option>
                    </>
                  )}
                </select>
              </div>

              {/* Number of Lots */}
              <div className="col-md-3">
                <label className="form-label text-muted small fw-bold">4. Number of Lots:</label>
                <select
                  className="form-select form-select-sm fw-bold border-secondary"
                  value={optLots}
                  onChange={(e) => setOptLots(Number(e.target.value))}
                >
                  <option value={1}>1 Lot ({optionContractDetails.lotSize * 1} Qty)</option>
                  <option value={2}>2 Lots ({optionContractDetails.lotSize * 2} Qty)</option>
                  <option value={4}>4 Lots ({optionContractDetails.lotSize * 4} Qty)</option>
                  <option value={10}>10 Lots ({optionContractDetails.lotSize * 10} Qty)</option>
                </select>
              </div>
            </div>

            {/* Option Calculation & Execution Summary */}
            <div className="mt-3 p-3 bg-dark text-light rounded-3">
              <div className="row g-3 align-items-center">
                <div className="col-md-6">
                  <span className="badge bg-warning text-dark fw-bold mb-1">{optionContractDetails.contractSymbol}</span>
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fs-4 fw-bold text-success">₹{optionContractDetails.estPremium}</span>
                    <span className="text-light-50 small">/ share premium</span>
                  </div>
                  <small className="text-muted d-block">
                    Total Investment: <b className="text-warning">₹{optionContractDetails.totalInvestment.toLocaleString('en-IN')}</b> ({optionContractDetails.totalQty} shares)
                  </small>
                </div>

                <div className="col-md-6 text-end">
                  <div className="d-flex justify-content-end gap-3 mb-2 small text-light-50">
                    <span>Stop Loss (-{optSlPct}%): <b className="text-danger">₹{optionContractDetails.slPrice}</b></span>
                    <span>Target (+{optTgtPct}%): <b className="text-success">₹{optionContractDetails.tgtPrice}</b></span>
                  </div>
                  <button
                    type="button"
                    className={`btn w-100 fw-bold py-2.5 ${optType === 'CALL' ? 'btn-success' : 'btn-danger'}`}
                    onClick={handlePlaceOptionOrder}
                  >
                    🚀 Buy {optType === 'CALL' ? 'Call (CE)' : 'Put (PE)'} Option (₹{optionContractDetails.totalInvestment.toLocaleString('en-IN')} Virtual Funds)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── EQUITIES PRACTICE TERMINAL BLOCK ── */}
        {practiceTerminalTab === 'EQUITY' && (
          <>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              {/* Search Any NSE Symbol */}
              <form
                className="d-flex align-items-center gap-2 w-100 w-md-auto"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchSymbolInput.trim()) {
                    const sym = searchSymbolInput.trim().toUpperCase();
                    setSelectedSymbol(sym);
                    fetchLiveQuote(sym);
                    setSearchSymbolInput('');
                  }
                }}
              >
                <input
                  type="text"
                  className="form-control form-control-sm rounded-pill px-3 shadow-sm"
                  placeholder="Search any NSE symbol (e.g. SWIGGY)..."
                  value={searchSymbolInput}
                  onChange={(e) => setSearchSymbolInput(e.target.value)}
                  style={{ maxWidth: 260 }}
                />
                <button type="submit" className="btn btn-sm btn-primary rounded-pill px-3 fw-bold">
                  Analyze
                </button>
              </form>
            </div>

        {/* Quick Stock Chips */}
        <div className="d-flex flex-wrap gap-2 mb-3">
          <span className="text-muted small align-self-center">Practice Picks:</span>
          {QUICK_STOCK_PICKS.map((stock) => (
            <button
              key={stock.symbol}
              type="button"
              className={`btn btn-xs rounded-pill px-3 py-1 fw-bold shadow-sm ${selectedSymbol === stock.symbol ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => {
                setSelectedSymbol(stock.symbol);
                fetchLiveQuote(stock.symbol);
              }}
            >
              {stock.symbol}
            </button>
          ))}
        </div>

        {/* Live Quote & Entry Inspection Box */}
        {quoteLoading && !quoteData ? (
          <div className="text-center py-4 text-muted">
            <span className="spinner-border spinner-border-sm me-2" />
            Loading real-time NSE data for {selectedSymbol}...
          </div>
        ) : quoteError ? (
          <div className="alert alert-warning small py-2">{quoteError}</div>
        ) : quoteData && entryAnalysis ? (
          <div className="bg-white rounded-3 p-3 p-md-4 border border-light-subtle shadow-sm">
            <div className="row g-3 align-items-center">
              {/* Stock Price & VWAP Metrics */}
              <div className="col-12 col-md-5">
                <div className="d-flex align-items-center gap-2">
                  <h4 className="fw-bold mb-0 text-dark">{quoteData.symbol}</h4>
                  <span className="text-muted small">({quoteData.companyName})</span>
                </div>
                <div className="d-flex align-items-baseline gap-2 mt-1">
                  <h3 className="fw-bold text-dark mb-0">₹{quoteData.price.toFixed(2)}</h3>
                  <span className={`fw-bold ${quoteData.pChange >= 0 ? 'text-success' : 'text-danger'}`}>
                    {quoteData.pChange >= 0 ? '▲ +' : '▼ '}{quoteData.pChange.toFixed(2)}%
                  </span>
                  <span className="badge bg-light text-dark border small ms-1">
                    Live VWAP: <strong>₹{quoteData.vwap.toFixed(2)}</strong>
                  </span>
                </div>
                <div className="small text-muted mt-1">
                  Day Range: ₹{quoteData.low.toFixed(2)} — ₹{quoteData.high.toFixed(2)} • Updated: {quoteData.lastUpdated}
                </div>
              </div>

              {/* Traffic Light Entry Guidance Card */}
              <div className="col-12 col-md-7">
                <div className={`p-3 rounded-3 ${entryAnalysis.status === 'SAFE_ENTRY' ? 'border border-success bg-success bg-opacity-10' : entryAnalysis.status === 'SAFE_SHORT' || entryAnalysis.status === 'DUMP_TRAP' || entryAnalysis.status === 'OVERBOUGHT_WARN' ? 'border border-danger bg-danger bg-opacity-10' : 'border border-warning bg-warning bg-opacity-10'}`}>
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <strong className="fs-6 d-flex align-items-center gap-2">
                      <span className={`badge ${entryAnalysis.badgeClass} rounded-pill px-2.5 py-1`}>
                        {entryAnalysis.status === 'SAFE_ENTRY' ? '🟢 SAFE LONG' : entryAnalysis.status === 'SAFE_SHORT' ? '🔴 SAFE SHORT' : entryAnalysis.status === 'OVERBOUGHT_WARN' ? '🚨 OVERBOUGHT' : '🟡 WATCHING'}
                      </span>
                      <span>{entryAnalysis.title}</span>
                    </strong>
                    <span className="badge bg-dark text-white">Score: {entryAnalysis.score}/100</span>
                  </div>
                  <p className="small mb-0 text-dark" style={{ lineHeight: '1.5' }}>
                    {entryAnalysis.guidance}
                  </p>
                </div>
              </div>
            </div>

            {/* Sizing & Order Placement Bar */}
            <hr className="my-3 text-muted opacity-25" />
            <div className="row g-3 align-items-center">
              {/* Order Direction Switcher (BUY vs SHORT SELL) */}
              <div className="col-12 col-lg-3">
                <label className="form-label small text-muted mb-1 d-block fw-semibold">Order Direction</label>
                <div className="btn-group w-100 shadow-sm" role="group">
                  <button
                    type="button"
                    className={`btn btn-sm fw-bold ${orderSide === 'BUY' ? 'btn-success text-white' : 'btn-outline-success'}`}
                    onClick={() => setOrderSide('BUY')}
                  >
                    🟢 BUY (Long)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm fw-bold ${orderSide === 'SELL' ? 'btn-danger text-white' : 'btn-outline-danger'}`}
                    onClick={() => setOrderSide('SELL')}
                  >
                    🔴 SHORT (Sell)
                  </button>
                </div>
              </div>

              <div className="col-12 col-lg-5">
                <div className="row g-2">
                  <div className="col-4">
                    <label className="form-label small text-muted mb-1">Virtual Qty</label>
                    <input
                      type="number"
                      className="form-control form-control-sm fw-bold text-center"
                      value={orderQty}
                      min="1"
                      onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>
                  <div className="col-4">
                    <label className="form-label small text-muted mb-1">Stop Loss</label>
                    <div className="form-control form-control-sm bg-light text-danger fw-bold text-center">
                      ₹{entryAnalysis.calculatedSl}
                    </div>
                  </div>
                  <div className="col-4">
                    <label className="form-label small text-muted mb-1">Target 1</label>
                    <div className="form-control form-control-sm bg-light text-success fw-bold text-center">
                      ₹{entryAnalysis.calculatedTgt1}
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Execution Actions */}
              <div className="col-12 col-lg-4 text-lg-end">
                <div className="small text-muted mb-2">
                  Margin: <strong>₹{entryAnalysis.marginRequired.toLocaleString('en-IN')}</strong> • Max Risk: <strong className="text-danger">-₹{entryAnalysis.maxRiskRupees}</strong> • Reward: <strong className="text-success">+₹{entryAnalysis.expectedGainRupees}</strong>
                </div>
                <div className="d-flex justify-content-lg-end gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm rounded-pill px-3 fw-bold"
                    onClick={() => setChartModalStock(quoteData)}
                  >
                    📈 View Chart
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm rounded-pill px-4 fw-bold shadow-sm ${orderSide === 'BUY' ? 'btn-success text-white' : 'btn-danger text-white'}`}
                    onClick={handlePlaceVirtualOrder}
                  >
                    {orderSide === 'BUY' ? `🟢 Buy ${orderQty} Shares` : `🔴 Short Sell ${orderQty} Shares`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        </>
      )}
      </div>

      {/* ── 4. ACTIVE VIRTUAL POSITIONS (Real-Time Live NSE Monitoring) ── */}
      <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4 mb-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h5 className="fw-bold mb-0 text-dark">
              💼 Active Practice Positions ({openPositions.length})
            </h5>
            <small className="text-muted">
              Auto-syncing tick-by-tick from live NSE feed • Overbought safe exit alerts & Never-Red trailing stops active
            </small>
          </div>
          <span className="badge bg-success bg-opacity-15 text-success fw-bold px-3 py-1.5 rounded-pill">
            🟢 LIVE TICK POLLING (10s)
          </span>
        </div>

        {/* ⏰ 3:15 PM Mandatory Profit Sweep Alert */}
        {isPast315Pm && openPositions.some((p) => (p.pnl || 0) > 0) && (
          <div className="alert alert-warning border-2 border-warning shadow-sm rounded-4 p-3 mb-3 d-flex flex-column flex-md-row justify-content-between align-items-center gap-3" style={{ background: '#fffbeb', borderColor: '#f59e0b' }}>
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="fs-3">⏰</span>
                <div>
                  <strong className="fs-6 text-dark d-block">03:15 PM Mandatory Square-Off Time!</strong>
                  <span className="badge bg-danger text-white">Intraday Session Ending</span>
                </div>
              </div>
              <p className="text-secondary small mb-0 mt-2">
                Brokers auto-square off intraday trades now. You have open profits on screen! Lock in your gains immediately before closing selling wipes them out.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-warning btn-sm rounded-pill px-4 py-2 fw-bold shadow text-dark"
              onClick={handleCloseAllProfitablePositions}
            >
              💰 Lock All Open Profits Now
            </button>
          </div>
        )}

        {/* Positions List */}
        {openPositions.length === 0 ? (
          <div className="text-center py-5 text-muted bg-light rounded-4 border border-dashed">
            <span className="fs-1 d-block mb-2">🎓</span>
            <h6 className="fw-bold text-dark">No Active Practice Positions</h6>
            <p className="small mb-3">
              Search any NSE stock above and place a virtual <strong>🟢 BUY (Long)</strong> or <strong>🔴 SHORT (Sell)</strong> order to practice!
            </p>
          </div>
        ) : (
          <div className="row g-3">
            {openPositions.map((pos) => {
              const isProfit = (pos.pnl || 0) >= 0;
              const isShort = pos.side === 'SELL';
              const canBook50 = !pos.halfBooked && pos.qty > 1 && (pos.pnlPct || 0) >= 1.0;

              return (
                <div className="col-12 col-lg-6" key={pos.id}>
                  <div className={`card border-2 shadow-sm rounded-4 p-3 h-100 ${isProfit ? 'border-success' : 'border-danger'}`}>
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className={`badge ${isShort ? 'bg-danger text-white' : 'bg-success text-white'} fw-bold`}>
                          {isShort ? '🔴 SHORT (SELL)' : '🟢 LONG (BUY)'}
                        </span>
                        <h5 className="fw-bold mb-0 text-dark">{pos.symbol}</h5>
                        <span className="badge bg-light text-dark border small">{pos.qty} Shares</span>
                      </div>
                      <div className="text-end">
                        <h5 className={`fw-bold mb-0 ${isProfit ? 'text-success' : 'text-danger'}`}>
                          {isProfit ? '+₹' : '-₹'}{Math.abs(pos.pnl || 0).toFixed(2)} ({isProfit ? '+' : ''}{pos.pnlPct}%)
                        </h5>
                      </div>
                    </div>

                    {/* Price and Levels Details */}
                    <div className="row g-2 small mb-3">
                      <div className="col-6 col-md-3">
                        <div className="p-2 rounded bg-light border">
                          <span className="text-muted d-block" style={{ fontSize: 11 }}>Entry Price:</span>
                          <strong className="text-dark">₹{pos.entryPrice.toFixed(2)}</strong>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="p-2 rounded bg-light border">
                          <span className="text-muted d-block" style={{ fontSize: 11 }}>Current Price:</span>
                          <strong className="text-dark">₹{pos.currentPrice.toFixed(2)}</strong>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="p-2 rounded bg-light border">
                          <span className="text-muted d-block" style={{ fontSize: 11 }}>Trailing SL:</span>
                          <strong className="text-danger">₹{pos.trailingStop?.toFixed(2) || pos.stopLoss?.toFixed(2)}</strong>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="p-2 rounded bg-light border">
                          <span className="text-muted d-block" style={{ fontSize: 11 }}>Target 1:</span>
                          <strong className="text-success">₹{pos.target1?.toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Position Actions */}
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-auto pt-2 border-top">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-xs rounded-pill px-3 fw-semibold"
                        onClick={() => setChartModalStock({ symbol: pos.symbol, companyName: pos.companyName, price: pos.currentPrice, vwap: pos.vwap })}
                      >
                        📈 Chart
                      </button>

                      <div className="d-flex align-items-center gap-2">
                        {canBook50 && (
                          <button
                            type="button"
                            className="btn btn-warning btn-xs rounded-pill px-3 fw-bold text-dark shadow-sm"
                            onClick={() => handlePartialBook50Pct(pos.id)}
                          >
                            🎯 Book 50% Profit
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-danger btn-xs rounded-pill px-3 fw-bold shadow-sm"
                          onClick={() => handleManualClosePosition(pos.id)}
                        >
                          ⚡ {isShort ? 'Cover Short & Close' : 'Exit & Close Position'}
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

      {/* ── 5. CLOSED PRACTICE TRADE HISTORY ── */}
      {tradeHistory.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4 p-3 p-md-4">
          <h5 className="fw-bold mb-3 text-dark">📋 Closed Practice Trade History ({tradeHistory.length})</h5>
          <div className="table-responsive">
            <table className="table table-hover align-middle small mb-0">
              <thead className="table-light">
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Qty</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>P&L (₹)</th>
                  <th>Exit Reason & Lesson</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.map((trade, idx) => {
                  const isGain = (trade.pnl || 0) >= 0;
                  return (
                    <tr key={`${trade.id}-${idx}`}>
                      <td className="fw-bold">{trade.symbol}</td>
                      <td>
                        <span className={`badge ${trade.side === 'SELL' ? 'bg-danger' : 'bg-success'}`}>
                          {trade.side || 'BUY'}
                        </span>
                      </td>
                      <td>{trade.qty}</td>
                      <td>₹{trade.entryPrice?.toFixed(2)}</td>
                      <td>₹{trade.exitPrice?.toFixed(2)}</td>
                      <td className={`fw-bold ${isGain ? 'text-success' : 'text-danger'}`}>
                        {isGain ? '+₹' : '-₹'}{Math.abs(trade.pnl || 0).toFixed(2)} ({isGain ? '+' : ''}{trade.pnlPct}%)
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{trade.exitReason}</div>
                        <small className="text-muted">{trade.lesson}</small>
                      </td>
                      <td className="text-muted">{trade.exitTime}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interactive Candlestick Modal */}
      {chartModalStock && (
        <StockDetailModal
          stock={chartModalStock}
          onClose={() => setChartModalStock(null)}
        />
      )}
    </div>
  );
}
