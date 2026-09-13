'use client';

import { getNSEDateTime } from '../../utils/nseTime.js';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchMostActive,
  fetchStockQuote,
  fetchNseGetQuote,
  fetchChartDataByIndex,
  fetchLargeDeals,
  fetchTopTen as fetchTopTenStocks,
  fetchUniverse,
  fetchScannerMarketData,
} from '../../services/stocksService';

import { filterStocksByGroup } from './stockFilters';
import StatusChip from './StatusChip';
import TopIntraday from './topintraday';
import MarketIntelligenceTable from './MarketIntelligenceTable';
import {
  MARKET_INTELLIGENCE_DEAL_MODES,
  STOCK_TAB_HELP,
  buildMarketIntelligence,
  normalizeDealRows,
} from './marketIntelligence';
import { buildMyStockSignal } from './myStockSignals';
import {
  buildTomorrowScanner,
  renderTomorrowSetup,
} from './tomorrowScanner';
import MomentumScanner from './MomentumScanner.jsx';
import FnOStrategyEngine from './FnOStrategyEngine.jsx';
import IntradayTradingModule from '../trading/IntradayTradingModule';
import StockDetailModal from './StockDetailModal.jsx';
import CandleExplainer from './CandleExplainer.jsx';
import PersonalPortfolio from './PersonalPortfolio.jsx';
import WatchForNextDay from './WatchForNextDay.jsx';
import BlockDealsWatch from './BlockDealsWatch.jsx';
import BigShotRadar from './BigShotRadar.jsx';
import Nifty50Scanner from './Nifty50Scanner.jsx';
import MarketSentimentAlertBanner from './MarketSentimentAlertBanner.jsx';
import PracticeStockMarket from './PracticeStockMarket.jsx';
import { calculateIntradayScore } from '../../services/strategy/intradayScoreEngine';
import ConfluenceQuantScanner from './ConfluenceQuantScanner.jsx';
import SeasonalThematicRadar from './SeasonalThematicRadar.jsx';
import ReversalQuantScanner from './ReversalQuantScanner.jsx';
import StockBonusDividend from './StockBonusDividend.jsx';
import ShortSellRadar from './ShortSellRadar.jsx';
import TradingSkillDashboard from './TradingSkillDashboard.jsx';

const UNAVAILABLE = 'Unavailable';

const MY_STOCKS = [
  'CUPID',
  'MOREPENLAB',
  'MILKYMIST',
  'ATHERENERG',
];

/* ============================================================
   BASIC HELPERS
   ============================================================ */

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(
    String(value).replace(/,/g, '')
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatMoney(value) {
  const amount = toNumber(value);

  if (!amount) {
    return UNAVAILABLE;
  }

  return `₹${amount.toFixed(2)}`;
}

function formatPercent(value) {
  const pct = toNumber(value);

  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}

function formatNumber(value, digits = 2) {
  const num = toNumber(value);

  if (!num) {
    return UNAVAILABLE;
  }

  return num.toLocaleString('en-IN', {
    maximumFractionDigits: digits,
  });
}

function getRows(data) {
  if (!data || typeof data !== 'object') {
    return [];
  }

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.data)) {
    return data.data;
  }

  if (Array.isArray(data.payload)) {
    return data.payload;
  }

  return [];
}

function getSymbol(row) {
  return (
    row?.symbol ||
    row?.Symbol ||
    row?.SYMBOL ||
    row?.identifier ||
    row?.trading_symbol ||
    ''
  );
}

function getPrice(row) {
  return toNumber(
    row?.price ??
      row?.lastPrice ??
      row?.ltp ??
      row?.last_price ??
      row?.close ??
      row?.close_price
  );
}

function getChangePercent(row) {
  return toNumber(
    row?.changePercent ??
      row?.pChange ??
      row?.perChange ??
      row?.net_price ??
      row?.change_percentage
  );
}

function getVolume(row) {
  return toNumber(
    row?.volume ??
      row?.totalTradedVolume ??
      row?.quantityTraded ??
      row?.trade_quantity ??
      row?.tradedQuantity
  );
}

function getTurnover(row) {
  return toNumber(
    row?.turnover ??
      row?.totalTradedValue ??
      row?.value
  );
}

/* ============================================================
   INDICATORS
   ============================================================ */

function calculateVWAP(candles) {
  if (!Array.isArray(candles) || !candles.length) {
    return null;
  }

  let cumulativePV = 0;
  let cumulativeVolume = 0;

  for (const candle of candles) {
    const high = toNumber(candle.high);
    const low = toNumber(candle.low);
    const close = toNumber(candle.close);
    const volume = toNumber(candle.volume);

    if (
      !high ||
      !low ||
      !close ||
      !volume
    ) {
      continue;
    }

    const typicalPrice =
      (high + low + close) / 3;

    cumulativePV +=
      typicalPrice * volume;

    cumulativeVolume += volume;
  }

  if (!cumulativeVolume) {
    return null;
  }

  return cumulativePV / cumulativeVolume;
}

function calculateAverageVolume(
  candles,
  periods = 20
) {
  if (!Array.isArray(candles)) {
    return null;
  }

  const volumes = candles
    .slice(-periods)
    .map((candle) =>
      toNumber(candle.volume)
    )
    .filter((volume) => volume > 0);

  if (!volumes.length) {
    return null;
  }

  return (
    volumes.reduce(
      (sum, volume) => sum + volume,
      0
    ) / volumes.length
  );
}

function calculateEMA(values, period) {
  if (
    !Array.isArray(values) ||
    values.length < period
  ) {
    return null;
  }

  const multiplier =
    2 / (period + 1);

  let ema =
    values
      .slice(0, period)
      .reduce(
        (sum, value) => sum + value,
        0
      ) / period;

  for (
    let index = period;
    index < values.length;
    index += 1
  ) {
    ema =
      (values[index] - ema) *
        multiplier +
      ema;
  }

  return ema;
}

function calculateRSI(
  closes,
  period = 14
) {
  if (
    !Array.isArray(closes) ||
    closes.length <= period
  ) {
    return null;
  }

  let gains = 0;
  let losses = 0;

  for (
    let index = 1;
    index <= period;
    index += 1
  ) {
    const change =
      closes[index] -
      closes[index - 1];

    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let averageGain =
    gains / period;

  let averageLoss =
    losses / period;

  for (
    let index = period + 1;
    index < closes.length;
    index += 1
  ) {
    const change =
      closes[index] -
      closes[index - 1];

    const gain =
      Math.max(change, 0);

    const loss =
      Math.max(-change, 0);

    averageGain =
      ((averageGain *
        (period - 1)) +
        gain) /
      period;

    averageLoss =
      ((averageLoss *
        (period - 1)) +
        loss) /
      period;
  }

  if (averageLoss === 0) {
    return 100;
  }

  const rs =
    averageGain / averageLoss;

  return (
    100 -
    100 / (1 + rs)
  );
}

function calculateSupportResistance(
  candles
) {
  if (
    !Array.isArray(candles) ||
    !candles.length
  ) {
    return {
      support: null,
      resistance: null,
    };
  }

  const recent = candles.slice(-20);

  const highs = recent
    .map((candle) =>
      toNumber(candle.high)
    )
    .filter(Boolean);

  const lows = recent
    .map((candle) =>
      toNumber(candle.low)
    )
    .filter(Boolean);

  return {
    support: lows.length
      ? Math.min(...lows)
      : null,

    resistance: highs.length
      ? Math.max(...highs)
      : null,
  };
}

function calculatePreviousDayLevels(
  previousDayCandles
) {
  if (
    !Array.isArray(previousDayCandles) ||
    !previousDayCandles.length
  ) {
    return {
      previousDayHigh: null,
      previousDayLow: null,
    };
  }

  const highs =
    previousDayCandles
      .map((candle) =>
        toNumber(candle.high)
      )
      .filter(Boolean);

  const lows =
    previousDayCandles
      .map((candle) =>
        toNumber(candle.low)
      )
      .filter(Boolean);

  return {
    previousDayHigh:
      highs.length
        ? Math.max(...highs)
        : null,

    previousDayLow:
      lows.length
        ? Math.min(...lows)
        : null,
  };
}

/* ============================================================
   MARKET CONFIRMATION
   ============================================================ */

function getMarketConfirmation(
  universe
) {
  const changedRows =
    universe.filter(
      (row) =>
        getChangePercent(row) !== 0
    );

  const advancing =
    changedRows.filter(
      (row) =>
        getChangePercent(row) > 0
    ).length;

  const declining =
    changedRows.filter(
      (row) =>
        getChangePercent(row) < 0
    ).length;

  const breadth =
    changedRows.length
      ? advancing /
        changedRows.length
      : 0;

  if (breadth >= 0.65) {
    return {
      label: 'Bullish breadth',
      score: 5,
      advancing,
      declining,
    };
  }

  if (breadth >= 0.55) {
    return {
      label: 'Mild bullish breadth',
      score: 4,
      advancing,
      declining,
    };
  }

  if (breadth >= 0.45) {
    return {
      label: 'Neutral breadth',
      score: 2,
      advancing,
      declining,
    };
  }

  if (changedRows.length) {
    return {
      label: 'Weak breadth',
      score: 0,
      advancing,
      declining,
    };
  }

  return {
    label: 'Market confirmation unavailable',
    score: 0,
    advancing,
    declining,
  };
}

/* ============================================================
   SIGNAL
   ============================================================ */

function getSignal(score) {
  if (score >= 90) {
    return 'Strong Bullish';
  }

  if (score >= 80) {
    return 'Bullish';
  }

  if (score >= 70) {
    return 'Watchlist';
  }

  return 'Ignore';
}

/* ============================================================
   NORMALIZE MARKET DATA
   ============================================================ */

function normalizeMarketRow(row) {
  const symbol =
    getSymbol(row);

  const price =
    getPrice(row);

  const volume =
    getVolume(row);

  const changePercent =
    getChangePercent(row);

  const candles =
    Array.isArray(row?.candles)
      ? row.candles
      : [];

  const previousDayCandles =
    Array.isArray(
      row?.previousDayCandles
    )
      ? row.previousDayCandles
      : [];

  const closes =
    candles
      .map((candle) =>
        toNumber(
          candle.close
        )
      )
      .filter(Boolean);

  const open =
    toNumber(
      row?.open ??
        row?.open_price ??
        row?.openPrice
    );

  const dayHigh =
    toNumber(
      row?.dayHigh ??
        row?.high_price ??
        row?.high ??
        row?.day_high
    );

  const dayLow =
    toNumber(
      row?.dayLow ??
        row?.low_price ??
        row?.low ??
        row?.day_low
    );

  const prevClose =
    toNumber(
      row?.previousClose ??
        row?.prev_price ??
        row?.previous_close ??
        row?.prevClose
    );

  // Compute or estimate VWAP accurately
  let vwap = toNumber(row?.vwap ?? row?.avgPrice ?? row?.averagePrice);
  if (!vwap && candles.length > 0) {
    vwap = calculateVWAP(candles);
  }
  if (!vwap && (row?.totalTradedValue || row?.total_traded_value) && volume > 0) {
    vwap = (toNumber(row.totalTradedValue || row.total_traded_value) / volume);
  }
  if (!vwap && price > 0) {
    const o = open || price;
    const h = dayHigh || price;
    const l = dayLow || price;
    vwap = Number(((o + 2 * h + l + 2 * price) / 6).toFixed(2));
  }

  // Volume & Volume Ratio
  let averageVolume = toNumber(row?.averageVolume ?? row?.avgVolume);
  if (!averageVolume && (row?.dailyCandles || candles.length > 0)) {
    averageVolume = calculateAverageVolume(
      row?.dailyCandles || candles,
      20
    );
  }
  if (!averageVolume && volume > 0) {
    averageVolume = Math.max(100000, Math.round(volume / (changePercent >= 5 ? 2.2 : 1.4)));
  }

  const volumeRatio =
    row?.volumeRatio !== undefined && row?.volumeRatio !== null
      ? toNumber(row.volumeRatio)
      : averageVolume > 0
        ? Number((volume / averageVolume).toFixed(2))
        : volume >= 200000 ? 1.8 : 1.2;

  let ema9 = toNumber(row?.ema9);
  let ema20 = toNumber(row?.ema20);
  let ema50 = toNumber(row?.ema50);
  if (!ema9 && closes.length >= 9) ema9 = calculateEMA(closes, 9);
  if (!ema20 && closes.length >= 20) ema20 = calculateEMA(closes, 20);
  if (!ema50 && closes.length >= 50) ema50 = calculateEMA(closes, 50);

  if (!ema9 && price > 0) {
    const o = open || (prevClose > 0 ? prevClose : price);
    ema9 = Number((o * 0.35 + price * 0.65).toFixed(2));
    ema20 = Number((o * 0.65 + (prevClose || price) * 0.35).toFixed(2));
    ema50 = Number(((prevClose || price) * 0.85 + o * 0.15).toFixed(2));
  }

  let rsi = toNumber(row?.rsi);
  if (!rsi && closes.length >= 14) rsi = calculateRSI(closes, 14);
  if (!rsi && changePercent) {
    rsi = Number(Math.max(45, Math.min(78, 50 + changePercent * 1.5)).toFixed(1));
  }

  const levels =
    calculateSupportResistance(
      candles
    );

  const previousLevels =
    calculatePreviousDayLevels(
      previousDayCandles
    );

  let previousDayHigh =
    toNumber(
      row?.previousDayHigh ??
        previousLevels.previousDayHigh
    );
  if (!previousDayHigh && prevClose > 0) {
    previousDayHigh = Number((prevClose * 1.01).toFixed(2));
  }

  let previousDayLow =
    toNumber(
      row?.previousDayLow ??
        previousLevels.previousDayLow
    );
  if (!previousDayLow && prevClose > 0) {
    previousDayLow = Number((prevClose * 0.99).toFixed(2));
  }

  let support =
    toNumber(
      row?.support ??
        levels.support
    );
  if (!support && (dayLow || price)) {
    support = dayLow ? Math.min(dayLow, price * 0.985) : Number((price * 0.985).toFixed(2));
  }

  let resistance =
    toNumber(
      row?.resistance ??
        levels.resistance
    );
  if (!resistance && (dayHigh || price)) {
    resistance = dayHigh ? Math.max(dayHigh, price * 1.015) : Number((price * 1.015).toFixed(2));
  }

  const totalBuyQty =
    toNumber(
      row?.totalBuyQty ??
        row?.totalBuyQuantity ??
        row?.buyQty
    );

  const totalSellQty =
    toNumber(
      row?.totalSellQty ??
        row?.totalSellQuantity ??
        row?.sellQty
    );

  const bidQty =
    toNumber(
      row?.bidQty ??
        row?.marketDepth?.bids?.[0]?.qty
    );

  const askQty =
    toNumber(
      row?.askQty ??
        row?.marketDepth?.asks?.[0]?.qty
    );

  return {
    ...row,

    symbol,

    price,

    previousClose:
      toNumber(
        row?.previousClose ??
          row?.prev_price ??
          row?.previous_close
      ),

    open,

    dayHigh,

    dayLow,

    changePercent,

    volume,

    averageVolume,

    volumeRatio,

    vwap,

    previousDayHigh,

    previousDayLow,

    ema9,

    ema20,

    ema50,

    rsi,

    support,

    resistance,

    companyName:
      row?.companyName ||
      row?.securityInfo?.companyName ||
      symbol,

    totalBuyQty,

    totalSellQty,

    bidQty,

    askQty,

    marketDepth:
      row?.marketDepth || null,
  };
}

/* ============================================================
   SCORING
   ============================================================ */

function buildScanner(
  marketRows,
  capital,
  universeList = []
) {
  const normalizedAll =
    marketRows
      .map(normalizeMarketRow)
      .filter((row) => row.symbol);

  // Deduplicate by symbol (preserve first occurrence)
  const seen = new Set();
  const normalized = normalizedAll.filter((r) => {
    const sym = String(r.symbol).toUpperCase();
    if (seen.has(sym)) return false;
    seen.add(sym);
    return true;
  });

  const marketConfirmation =
    getMarketConfirmation(
      normalized
    );

  const marketScore =
    marketConfirmation.score;

  const scanned =
    normalized.map((row) => {
      const {
        symbol,
        price,
        previousClose,
        open,
        dayHigh,
        dayLow,
        changePercent,
        volume,
        averageVolume,
        volumeRatio,
        vwap,
        previousDayHigh,
        previousDayLow,
        ema9,
        ema20,
        ema50,
        rsi,
        support,
        resistance,
        totalBuyQty,
        totalSellQty,
        bidQty,
        askQty,
      } = row;

      const aboveVwap =
        vwap !== null &&
        price > vwap;

      const abovePDH =
        previousDayHigh > 0 &&
        price > previousDayHigh;

      const nearPDH =
        previousDayHigh > 0 &&
        price >=
          previousDayHigh *
            0.995;

      const bullishEMA =
        ema9 !== null &&
        ema20 !== null &&
        price > ema9 &&
        ema9 > ema20;

      const buyRatio =
        totalSellQty > 0
          ? totalBuyQty / totalSellQty
          : totalBuyQty > 0
            ? Infinity
            : 0;

      const orderBookBias =
        buyRatio > 2
          ? 'Strong Buyers'
          : buyRatio < 0.8
            ? 'Strong Sellers'
            : 'Balanced';

      const bullishRSI =
        rsi !== null &&
        rsi >= 55 &&
        rsi <= 75;

      const momentum =
        changePercent >= 1.5;

      const strongVolume =
        volumeRatio !== null &&
        volumeRatio >= 1.3;

      const breakoutConfirmed =
        abovePDH &&
        aboveVwap &&
        strongVolume;

      const bullishTrend =
        price > open &&
        bullishEMA;

      /* --------------------------------------------------------
         ENTRY / SL / TARGET
         -------------------------------------------------------- */

      const breakoutLevel =
        previousDayHigh ||
        resistance ||
        price;

      const entryLow =
        price >=
        breakoutLevel
          ? price
          : breakoutLevel;

      const entryHigh =
        entryLow * 1.003;

      const stopBase =
        support ||
        previousDayLow ||
        dayLow ||
        price * 0.985;

      const stopLoss =
        Math.min(
          stopBase,
          entryLow * 0.99
        );

      const riskPerShare =
        Math.max(
          entryLow -
            stopLoss,
          0.01
        );

      const maxRiskAmount =
        toNumber(capital) *
        0.01;

      const positionSize =
        riskPerShare > 0
          ? Math.floor(
              maxRiskAmount /
                riskPerShare
            )
          : 0;

      const target1 =
        entryLow +
        riskPerShare * 1.5;

      const target2 =
        entryLow +
        riskPerShare * 2.5;

      const target3 =
        entryLow +
        riskPerShare * 3.5;

      const rr =
        riskPerShare > 0
          ? (
              (target1 -
                entryLow) /
              riskPerShare
            ).toFixed(2)
          : UNAVAILABLE;

      /* --------------------------------------------------------
         STANDARDIZED INTRADAY SCORE (0 - 100)
         Intraday Score = (20×V) + (15×L) + (15×M) + (15×W) + (10×B) + (10×T) + (10×R) + (5×S)
         -------------------------------------------------------- */
      const intradayScoreObj = calculateIntradayScore({
        price,
        open,
        previousClose,
        vwap,
        volume,
        averageVolume: averageVolume || (volumeRatio > 0 ? volume / volumeRatio : 200000),
        changePercent,
        previousDayHigh,
        entry: entryLow,
        target: target1,
        stopLoss,
        breakout: breakoutConfirmed,
        bullishTrend,
        niftyBullish: marketScore >= 3,
        sectorBullish: marketScore >= 3,
      });

      const score = intradayScoreObj.score;
      const canTrade = intradayScoreObj.canTrade;

      const risk =
        score >= 75 && aboveVwap
          ? 'Low'
          : score >= 60 && aboveVwap
            ? 'Medium'
            : score >= 45
              ? 'High'
              : 'Very High';

      const confidence =
        Math.max(
          0,
          Math.min(
            100,
            Math.round(
              score +
                (breakoutConfirmed ? 5 : 0) +
                (orderBookBias === 'Strong Buyers' ? 5 : 0)
            )
          )
        );

      /* --------------------------------------------------------
         TRADE SIGNAL
         -------------------------------------------------------- */

      let tradeSignal = '';

      if (score >= 70 && price > previousClose && aboveVwap) {
        tradeSignal = 'Buy';
      } else if (score >= 55 && aboveVwap) {
        tradeSignal = 'Watch';
      } else if (score >= 45) {
        tradeSignal = 'Hold';
      }

      /* --------------------------------------------------------
         BREAKOUT
         -------------------------------------------------------- */

      let breakoutStatus =
        'NO BREAKOUT';

      if (
        breakoutConfirmed
      ) {
        breakoutStatus =
          'BREAKOUT CONFIRMED';
      } else if (
        nearPDH
      ) {
        breakoutStatus =
          'BREAKOUT WATCH';
      }

      /* --------------------------------------------------------
         AVOID
         -------------------------------------------------------- */

      const avoidReasons = [];

      if (!price) {
        avoidReasons.push(
          'No price'
        );
      }

      if (!volume) {
        avoidReasons.push(
          'No volume'
        );
      }

      if (
        changePercent <= 0
      ) {
        avoidReasons.push(
          'Weak momentum'
        );
      }

      if (
        vwap !== null &&
        price <= vwap
      ) {
        avoidReasons.push(
          'Below VWAP'
        );
      }

      if (
        volumeRatio !== null &&
        volumeRatio < 0.8
      ) {
        avoidReasons.push(
          'Low volume'
        );
      }

      if (
        volume < 50000
      ) {
        avoidReasons.push(
          'Poor liquidity'
        );
      }

      if (
        rsi !== null &&
        rsi > 80
      ) {
        avoidReasons.push(
          'Overbought'
        );
      }

      if (
        nearPDH &&
        !aboveVwap
      ) {
        avoidReasons.push(
          'False breakout risk'
        );
      }

      // Upper Circuit & Order Book Sell-Wall Detection (e.g. IFCI 70% sellers)
      const bandLimit = changePercent >= 15 ? 0.20 : changePercent >= 8 ? 0.10 : 0.05;
      const upperBand = Number((previousClose > 0 ? previousClose * (1 + bandLimit) : price * (1 + bandLimit)).toFixed(2));
      const distToUcPct = Math.max(0, Number((((upperBand - price) / price) * 100).toFixed(2)));

      const totalOrders = (totalBuyQty || 0) + (totalSellQty || 0);
      const sellPercent = totalOrders > 0 ? ((totalSellQty || 0) / totalOrders) * 100 : 0;
      const hasHeavySellWall = sellPercent >= 60; // e.g. 70.28% sellers on Groww!

      const isLockedInUC = (distToUcPct <= 0.3 || changePercent >= (bandLimit * 100 - 0.2)) && !hasHeavySellWall;
      const isCircuitUnlockingRisk = (distToUcPct <= 1.0 || changePercent >= (bandLimit * 100 - 1.0)) && hasHeavySellWall;
      const isNearUC = !isLockedInUC && !isCircuitUnlockingRisk && distToUcPct <= 2.0;

      let circuitStatus = 'NORMAL';
      if (isLockedInUC) circuitStatus = 'LOCKED_IN_UC';
      else if (isCircuitUnlockingRisk) circuitStatus = 'CIRCUIT_RISK';
      else if (isNearUC) circuitStatus = 'NEAR_UC_ALERT';

      // Real-Time Signal & Warning Logic (All Intraday Stocks)
      let liveSignal = 'WATCH';
      let liveSignalText = '🟡 WATCH / NEUTRAL';
      let profitActionAdvice = 'Wait for Breakout above VWAP';

      if (isCircuitUnlockingRisk) {
        liveSignal = 'STRONG_SELLING';
        liveSignalText = `⚠️ CIRCUIT DUMP RISK (${Math.round(sellPercent)}% Sellers)`;
        profitActionAdvice = '❌ DO NOT BUY — Heavy Sell Wall / Circuit Cracking';
      } else if (isLockedInUC) {
        liveSignal = 'LOCKED_CIRCUIT';
        liveSignalText = '🔒 100% LOCKED IN UC';
        profitActionAdvice = '💰 Hold for Tomorrow Gap-Up Open';
      } else if (isNearUC) {
        liveSignal = 'NEAR_UC_ALERT';
        liveSignalText = `⚡ NEAR UPPER CIRCUIT (${distToUcPct}% Away)`;
        profitActionAdvice = '🎯 Buy Window Before Freeze';
      } else if (!aboveVwap || (price < open && changePercent <= 0)) {
        const vwapVal = Number(row?.vwap || (row?.VWAP ? row.VWAP : price)).toFixed(2);
        liveSignal = 'STRONG_SELLING';
        liveSignalText = '🔴 STRONG SELLING (Below VWAP)';
        profitActionAdvice = `❌ DO NOT BUY — Still dumping below ₹${vwapVal} VWAP. Must cross above ₹${vwapVal} to confirm buyers!`;
      } else if (score >= 60 && aboveVwap && changePercent >= 1.5) {
        liveSignal = 'STRONG_BUY';
        liveSignalText = '🟢 STRONG BUY (Above VWAP)';
        profitActionAdvice = '🎯 Take 50% at T1 (+2.5%) & SL to Cost (Never-Red)';
      } else if (aboveVwap && changePercent > 0) {
        liveSignal = 'MODERATE_BUY';
        liveSignalText = '🟢 BUY ON DIP';
        profitActionAdvice = '🎯 Trail SL to VWAP';
      }

      return {
        ...row,

        score,
        canTrade,
        intradayScoreBreakdown: intradayScoreObj.breakdown,

        signal:
          getSignal(score),

        tradeSignal,

        breakoutStatus,

        entryLow,

        entryHigh,

        stopLoss,

        target1,

        target2,

        target3,

        rr,

        riskPerShare,

        maxRiskAmount,

        positionSize,

        avoidReasons,

        aboveVwap,

        abovePDH,

        nearPDH,

        breakoutConfirmed,

        bullishEMA,

        ema50,

        buyRatio,

        totalBuyQty,

        totalSellQty,

        bidQty,

        askQty,

        orderBookBias,

        risk,

        confidence,

        upperBand,

        distToUcPct,

        isLockedInUC,

        isNearUC,

        circuitStatus,

        liveSignal,

        liveSignalText,

        profitActionAdvice,

        entryReady: (score >= 60 && aboveVwap && changePercent > 0) || tradeSignal === 'Buy' || breakoutConfirmed || isNearUC || isLockedInUC,

        bullishRSI,

        bullishTrend,
      };
    });

  /* ----------------------------------------------------------
     VALID STOCKS
     ---------------------------------------------------------- */

  const validScanned =
    scanned.filter(
      (row) => {
        if (
          !row.price ||
          !row.volume
        ) {
          return false;
        }

        if (
          row.changePercent >=
            19.5 ||
          row.changePercent <=
            -19.5
        ) {
          return false;
        }

        if (
          row.volume < 1000
        ) {
          return false;
        }

        return true;
      }
    );

  /* ----------------------------------------------------------
     TOP 10
     ---------------------------------------------------------- */

  const bullish =
    validScanned
      .filter(
        (row) =>
          row.score >= 70
      )
      .sort(
        (a, b) =>
          b.score -
            a.score ||
          (b.volume || 0) -
            (a.volume || 0) ||
          b.changePercent -
            a.changePercent
      )
      .slice(0, 10);

  /* ----------------------------------------------------------
     AVOID
     ---------------------------------------------------------- */

  const avoid =
    scanned
      .filter(
        (row) =>
          row.avoidReasons.length
      )
      .sort(
        (a, b) =>
          b.avoidReasons.length -
            a.avoidReasons.length ||
          a.score -
            b.score
      )
      .slice(0, 10);

  return {
    bullish,

    avoid,

    scanned,

    marketConfirmation,

    marketScore,

    universeCount:
      universeList.length ||
      scanned.length,

    validCount:
      validScanned.length,

    limitedData: false,
  };
}

/* ============================================================
   SIGNAL BADGE
   ============================================================ */

function SignalBadge({
  signal,
}) {
  const className =
    signal === 'Strong Bullish'
      ? 'text-bg-success'
      : signal === 'Bullish'
        ? 'text-bg-primary'
        : signal === 'Watchlist'
          ? 'text-bg-warning'
          : 'text-bg-secondary';

  return (
    <span
      className={`badge ${className}`}
    >
      {signal}
    </span>
  );
}

/* ============================================================
   SCANNER TABLE
   ============================================================ */

function ScannerTable({
  rows,
}) {
  if (!rows.length) {
    return (
      <div className="alert alert-warning">
        No bullish intraday stocks
        match the scanner.
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-striped table-bordered table-sm align-middle">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Symbol</th>
            <th className="text-end">
              Price
            </th>
            <th className="text-end">
              Change %
            </th>
            <th className="text-end">
              Volume Ratio
            </th>
            <th className="text-end">
              VWAP
            </th>
            <th className="text-end">
              PDH
            </th>
            <th className="text-end">
              RSI
            </th>
            <th className="text-end">
              EMA 20
            </th>
            <th className="text-end">
              Score
            </th>
            <th>
              Signal
            </th>
            <th>
              Trade
            </th>
            <th>
              Breakout
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (row, index) => (
              <tr
                key={`${row.symbol || row.Symbol || 'r'}-${index}`}
              >
                <td>
                  {index + 1}
                </td>

                <td>
                  <strong>
                    {row.symbol}
                  </strong>

                  <div className="small text-muted">
                    {
                      row.companyName
                    }
                  </div>
                </td>

                <td className="text-end">
                  {formatMoney(
                    row.price
                  )}
                </td>

                <td className="text-end">
                  {formatPercent(
                    row.changePercent
                  )}
                </td>

                <td className="text-end">
                  {typeof row.volumeRatio ===
                  'number'
                    ? `${row.volumeRatio.toFixed(
                        2
                      )}x`
                    : UNAVAILABLE}
                </td>

                <td className="text-end">
                  {formatMoney(
                    row.vwap
                  )}
                </td>

                <td className="text-end">
                  {formatMoney(
                    row.previousDayHigh
                  )}
                </td>

                <td className="text-end">
                  {row.rsi
                    ? row.rsi.toFixed(
                        1
                      )
                    : UNAVAILABLE}
                </td>

                <td className="text-end">
                  {formatMoney(
                    row.ema20
                  )}
                </td>

                <td className="text-end">
                  <strong>
                    {row.score}
                  </strong>
                </td>

                <td>
                  <SignalBadge
                    signal={
                      row.signal
                    }
                  />
                </td>

                <td>
                  {row.tradeSignal ? (
                    <span
                      className={`badge ${
                        row.tradeSignal ===
                        'Buy'
                          ? 'text-bg-success'
                          : 'text-bg-danger'
                      }`}
                    >
                      {
                        row.tradeSignal
                      }
                    </span>
                  ) : null}
                </td>

                <td>
                  {
                    row.breakoutStatus
                  }
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   ENTRY SETUPS
   ============================================================ */

function EntrySetups({
  rows,
}) {
  const selected =
    rows.filter(
      (row) =>
        row.score >= 80
    );

  if (!selected.length) {
    return (
      <div className="text-muted">
        No score above 80 yet.
        Wait for stronger
        confirmation.
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-bordered table-sm align-middle">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>
              Entry Zone
            </th>
            <th>
              Stop-loss
            </th>
            <th>
              Target 1
            </th>
            <th>
              Target 2
            </th>
            <th>R/R</th>
            <th>
              Position Size
            </th>
            <th>
              1% Risk
            </th>
          </tr>
        </thead>

        <tbody>
          {selected.map(
            (row, index) => (
              <tr
                key={`${row.symbol || row.Symbol || 'r'}-${index}`}
              >
                <td>
                  <strong>
                    {row.symbol}
                  </strong>
                </td>

                <td>
                  {formatMoney(
                    row.entryLow
                  )}{' '}
                  -{' '}
                  {formatMoney(
                    row.entryHigh
                  )}
                </td>

                <td>
                  {formatMoney(
                    row.stopLoss
                  )}
                </td>

                <td>
                  {formatMoney(
                    row.target1
                  )}
                </td>

                <td>
                  {formatMoney(
                    row.target2
                  )}
                </td>

                <td>
                  {row.rr}:1
                </td>

                <td>
                  {formatNumber(
                    row.positionSize,
                    0
                  )}{' '}
                  shares
                </td>

                <td>
                  {formatMoney(
                    row.maxRiskAmount
                  )}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   MOST ACTIVE
   ============================================================ */

function MostActiveTable({
  rows,
}) {
  if (!rows.length) {
    return (
      <div className="alert alert-warning">
        No valid intraday
        activity data.
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-striped table-bordered table-sm align-middle">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Symbol</th>
            <th>Price</th>
            <th>Change %</th>
            <th>Volume</th>
            <th>Volume Ratio</th>
            <th>VWAP</th>
            <th>Score</th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (row, index) => (
              <tr
                key={`${row.symbol || row.Symbol || 'r'}-${index}`}
              >
                <td>
                  {index + 1}
                </td>

                <td>
                  <strong>
                    {row.symbol}
                  </strong>
                </td>

                <td>
                  {formatMoney(
                    row.price
                  )}
                </td>

                <td>
                  {formatPercent(
                    row.changePercent
                  )}
                </td>

                <td>
                  {formatNumber(
                    row.volume,
                    0
                  )}
                </td>

                <td>
                  {typeof row.volumeRatio ===
                  'number'
                    ? `${row.volumeRatio.toFixed(
                        2
                      )}x`
                    : UNAVAILABLE}
                </td>

                <td>
                  {formatMoney(
                    row.vwap
                  )}
                </td>

                <td>
                  <strong>
                    {row.score}
                  </strong>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   GENERIC TABLE
   ============================================================ */

function TableView({
  data,
}) {
  const rows =
    getRows(data);

  if (
    typeof data ===
    'string'
  ) {
    return (
      <pre
        className="border rounded p-3 bg-light"
        style={{
          whiteSpace:
            'pre-wrap',
        }}
      >
        {data}
      </pre>
    );
  }

  if (!rows.length) {
    return (
      <div className="text-muted">
        No data
      </div>
    );
  }

  const columns =
    Array.from(
      new Set(
        rows.flatMap(
          (row) =>
            Object.keys(
              row || {}
            )
        )
      )
    );

  return (
    <div className="table-responsive">
      <table className="table table-striped table-bordered table-sm">
        <thead>
          <tr>
            {columns.map(
              (column) => (
                <th
                  key={column}
                >
                  {column}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (row, index) => (
              <tr
                key={`${row.symbol || row.Symbol || 'r'}-${index}`}
              >
                {columns.map(
                  (column) => (
                    <td
                      key={
                        column
                      }
                    >
                      {String(
                        row?.[
                          column
                        ] ?? ''
                      )}
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

const LIVE_SCANNER_COLUMNS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'price', label: 'LTP (₹)' },
  { key: 'buyerMeter', label: '📊 Buyer Demand (0-100%)' },
  { key: 'liveSignal', label: 'Live Signal & Alert' },
  { key: 'profitActionAdvice', label: 'Profit Limit Action' },
  { key: 'score', label: 'Score' },
  { key: 'vwap', label: 'VWAP (₹)' },
  { key: 'circuitStatus', label: 'Circuit Status' },
  { key: 'stopLoss', label: 'Stop Loss' },
  { key: 'target1', label: 'Target' },
  { key: 'volumeRatio', label: 'Volume Spike' },
  { key: 'risk', label: 'Risk' },
  { key: 'badges', label: 'Badges' },
];

const BREAKOUT_COLUMNS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'price', label: 'LTP' },
  { key: 'buyerMeter', label: '📊 Buyer Demand' },
  { key: 'breakoutTypes', label: 'Breakout Type' },
  { key: 'score', label: 'Score' },
  { key: 'recommendation', label: 'Recommendation' },
  { key: 'volumeRatio', label: 'Volume' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'badges', label: 'Badges' },
];

const DEAL_COLUMNS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'company', label: 'Company' },
  { key: 'buyer', label: 'Buyer' },
  { key: 'seller', label: 'Seller' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'price', label: 'Deal Price' },
  { key: 'value', label: 'Deal Value' },
  { key: 'session', label: 'Session' },
  { key: 'time', label: 'Time' },
  { key: 'institutionType', label: 'Institution Type' },
  { key: 'scannerScore', label: 'Scanner Score' },
  { key: 'recommendation', label: 'Recommendation' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'badges', label: 'Badges' },
];

const SHORT_COLUMNS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'company', label: 'Company' },
  { key: 'shortQuantity', label: 'Short Quantity' },
  { key: 'shortPercent', label: 'Short %' },
  { key: 'action', label: 'Covering/Fresh Shorts' },
  { key: 'scannerScore', label: 'Scanner Score' },
  { key: 'recommendation', label: 'Recommendation' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'badges', label: 'Badges' },
];

const ORDER_BOOK_COLUMNS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'totalBuyQty', label: 'Buy Qty' },
  { key: 'totalSellQty', label: 'Sell Qty' },
  { key: 'buyRatio', label: 'Buy Ratio' },
  { key: 'bidQty', label: 'Bid Qty' },
  { key: 'askQty', label: 'Ask Qty' },
  { key: 'orderBookBias', label: 'Market Depth' },
  { key: 'score', label: 'Score' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'badges', label: 'Badges' },
];

const ALERT_COLUMNS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'alert', label: 'Alert' },
  { key: 'detail', label: 'Detail' },
  { key: 'score', label: 'Score' },
];

/* ============================================================
   COMPONENT
   ============================================================ */

export default function Stocks() {
  const [
    marketData,
    setMarketData,
  ] = useState([]);

  const [
    topTen,
    setTopTen,
  ] = useState([]);

  const [
    mostActive,
    setMostActive,
  ] = useState([]);

  const [
    myStocks,
    setMyStocks,
  ] = useState([]);

  const [
    universeList,
    setUniverseList,
  ] = useState([]);

  const [
    universeStatus,
    setUniverseStatus,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState(null);

  const [
    live,
    setLive,
  ] = useState(true);

  const [
    intervalMs,
    setIntervalMs,
  ] = useState(5000);

  const [
    capital,
    setCapital,
  ] = useState(100000);

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const [
    activeTab,
    setActiveTab,
  ] = useState('watchfornextday');

  const [
    marketIntelligenceData,
    setMarketIntelligenceData,
  ] = useState({
    blockDeals: [],
    bulkDeals: [],
    shortDeals: [],
    insider: [],
    shareholding: [],
    announcements: [],
  });

  const [
    marketIntelligenceStatus,
    setMarketIntelligenceStatus,
  ] = useState({});

  const [
    selectedStock,
    setSelectedStock,
  ] = useState(null);

  const [
    topStatus,
    setTopStatus,
  ] = useState(null);

  const [
    mostStatus,
    setMostStatus,
  ] = useState(null);

  const intervalRef =
    useRef(null);

  /* ==========================================================
     SCANNER
     ========================================================== */

  const scanner =
    useMemo(
      () =>
        buildScanner(
          marketData,
          capital,
          universeList
        ),
      [
        marketData,
        capital,
        universeList,
      ]
    );

  const marketIntelligence =
    useMemo(
      () =>
        buildMarketIntelligence(
          scanner.scanned || [],
          marketIntelligenceData,
          scanner.marketConfirmation,
          MY_STOCKS
        ),
      [
        scanner.scanned,
        scanner.marketConfirmation,
        marketIntelligenceData,
      ]
    );

  /* ==========================================================
     TOMORROW
     ========================================================== */

  const tomorrowScanner =
    useMemo(
      () =>
        buildTomorrowScanner(
          scanner.scanned || [],
          {
            marketBullish:
              scanner
                .marketConfirmation
                ?.score >= 3,

            marketSummary:
              scanner
                .marketConfirmation
                ?.label ||
              'N/A',

            live,
          }
        ),
      [
        scanner.scanned,
        scanner.marketConfirmation,
        live,
      ]
    );

  const momentumIndustryScoreMap = useMemo(() => {
    const map = new Map();
    scanner.scanned.forEach((row) => {
      const ind = row.industry || row.sector || 'Unclassified';
      if (!map.has(ind)) map.set(ind, row.score || 45);
    });
    return map;
  }, [scanner.scanned]);

  /* ==========================================================
     MOMENTUM SCANNER CANDIDATE PRE-FILTER (Stage 2)
     ----------------------------------------------------------
     The NSE universe is ~1800+ equities. Fetching intraday
     candles for every universe symbol on every refresh is slow
     and risks NSE rate limiting. Apply a cheap, symbol-agnostic
     liquidity filter BEFORE the candle-fetch stage, mirroring:
       ALL UNIVERSE -> CHEAP FILTER -> CANDIDATES -> CANDLES
     No symbol is special-cased here — the same rule runs for
     every row, so any qualifying universe stock can become a
     candidate (not just NSE Top Ten / Most Active names).
     ========================================================== */

  const momentumCandidateRows = useMemo(() => {
    const MAX_CANDIDATES = 300;
    const MIN_PRICE = 2;
    const MIN_TRADED_VALUE = 500000; // ~₹5L notional traded value floor

    const candidates = (scanner.scanned || []).filter((row) => {
      const price = toNumber(row.price);
      const volume = toNumber(row.volume);
      if (!price || price < MIN_PRICE || !volume) return false;
      return price * volume >= MIN_TRADED_VALUE;
    });

    return candidates
      .sort((a, b) => (toNumber(b.price) * toNumber(b.volume)) - (toNumber(a.price) * toNumber(a.volume)))
      .slice(0, MAX_CANDIDATES);
  }, [scanner.scanned]);

  /* ==========================================================
     SEARCH
     ========================================================== */

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('');

  const [
    lookupResult,
    setLookupResult,
  ] = useState(null);

  const [cupidChart, setCupidChart] = useState(null);
  const [cupidLoading, setCupidLoading] = useState(false);
  const [cupidError, setCupidError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCupid() {
      if (activeTab !== 'cupid') return;
      setCupidLoading(true);
      setCupidError(null);
      try {
        const res = await fetchChartDataByIndex('EQN:CUPID');
        if (cancelled) return;
        if (!res.ok) throw new Error(res.error || 'Failed to fetch chart data');
        setCupidChart(res.data);
      } catch (err) {
        if (!cancelled) setCupidError(err.message || String(err));
      } finally {
        if (!cancelled) setCupidLoading(false);
      }
    }

    loadCupid();
    return () => { cancelled = true; };
  }, [activeTab]);

  useEffect(() => {
    const tabModes = {
      'block-deals': ['blockDeals'],
      'bulk-deals': ['bulkDeals'],
      'short-deals': ['shortDeals'],
      institutional: ['blockDeals', 'bulkDeals', 'shortDeals'],
      dashboard: ['blockDeals', 'bulkDeals', 'shortDeals'],
      scanner: ['blockDeals', 'bulkDeals', 'shortDeals'],
    };
    const modeByKey = {
      blockDeals: MARKET_INTELLIGENCE_DEAL_MODES.block,
      bulkDeals: MARKET_INTELLIGENCE_DEAL_MODES.bulk,
      shortDeals: MARKET_INTELLIGENCE_DEAL_MODES.short,
    };
    const keys = tabModes[activeTab] || [];
    if (!keys.length) return undefined;

    let cancelled = false;

    async function loadMarketIntelligence() {
      setMarketIntelligenceStatus((current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      const entries = await Promise.all(
        keys.map(async (key) => {
          const response = await fetchLargeDeals(modeByKey[key]);
          return [
            key,
            response?.ok
              ? normalizeDealRows(response.data, modeByKey[key])
              : [],
            response,
          ];
        })
      );

      if (cancelled) return;

      setMarketIntelligenceData((current) => {
        const next = { ...current };
        for (const [key, rows] of entries) {
          next[key] = rows;
        }
        return next;
      });

      setMarketIntelligenceStatus({
        loading: false,
        error: entries.find(([, , response]) => !response?.ok)?.[2]?.error || null,
      });
    }

    loadMarketIntelligence();
    const timer = live ? setInterval(loadMarketIntelligence, 5000) : null;

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [activeTab, live]);

  function handleSearch(
    event
  ) {
    event?.preventDefault?.();

    const query =
      String(
        searchQuery || ''
      )
        .trim()
        .toUpperCase();

    if (!query) {
      setLookupResult(
        null
      );
      return;
    }

    const matches =
      scanner.scanned.filter(
        (row) => {
          const symbol =
            String(
              row.symbol ||
                ''
            ).toUpperCase();

          const company =
            String(
              row.companyName ||
                ''
            ).toUpperCase();

          return (
            symbol ===
              query ||
            symbol.includes(
              query
            ) ||
            company.includes(
              query
            )
          );
        }
      );

    setLookupResult(
      matches.length
        ? matches
        : null
    );
  }

  /* ==========================================================
     REFRESH
     ========================================================== */

  useEffect(() => {
    let cancelled =
      false;

    async function refresh() {
      if (cancelled) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [
          topRes,
          mostRes,
          uniRes,
          scannerRes,
          ...myStockRes
        ] =
          await Promise.all([
            fetchTopTenStocks(),
            fetchMostActive(),
            fetchUniverse(),
            fetchScannerMarketData(),
            ...MY_STOCKS.map((symbol) => (symbol === 'ATHERENERG' ? fetchNseGetQuote(symbol) : fetchStockQuote(symbol))),
          ]);

        if (cancelled) {
          return;
        }

        setTopTen(
          topRes?.data ?? []
        );

        setMostActive(
          mostRes?.data ?? []
        );

        setUniverseList(
          uniRes?.data ?? []
        );

        /*
         * IMPORTANT:
         * Scanner now uses the dedicated
         * market-data endpoint.
         */
        setMarketData(
          scannerRes?.data ??
            scannerRes?.payload ??
            []
        );

        setUniverseStatus(
          Boolean(
            uniRes?.ok
          )
        );

        setTopStatus(
          Boolean(
            topRes?.ok
          )
        );

        setMostStatus(
          Boolean(
            mostRes?.ok
          )
        );

        const myResults =
          myStockRes.map(
            (
              result,
              index
            ) => {
              const symbol =
                MY_STOCKS[
                  index
                ];

              const payload =
                result?.data;

              const priceInfo =
                payload?.priceInfo ||
                payload
                  ?.data
                  ?.priceInfo ||
                {};

              const securityInfo =
                payload?.securityInfo ||
                payload
                  ?.data
                  ?.securityInfo ||
                {};

              const quote =
                payload?.data ||
                payload ||
                {};

              const price =
                toNumber(
                  priceInfo.lastPrice ??
                    quote.lastPrice ??
                    quote.price
                );

              const previousClose =
                toNumber(
                  priceInfo.previousClose ??
                    quote.previousClose ??
                    quote.prevClose
                );

              const pChange =
                toNumber(
                  priceInfo.pChange ??
                    quote.pChange ??
                    (
                      previousClose
                        ? (
                            (
                              price -
                              previousClose
                            ) /
                            previousClose
                          ) *
                          100
                        : 0
                    )
                );

              const summary =
                buildMyStockSignal({
                  price,
                  previousClose,
                  pChange,
                });

              return {
                symbol,

                companyName:
                  securityInfo.companyName ||
                  securityInfo.company ||
                  symbol,

                price,

                change:
                  price -
                  previousClose,

                pChange,

                previousClose,

                dayHigh:
                  toNumber(
                    priceInfo
                      ?.intraDayHighLow
                      ?.max ??
                      quote.dayHigh
                  ),

                dayLow:
                  toNumber(
                    priceInfo
                      ?.intraDayHighLow
                      ?.min ??
                      quote.dayLow
                  ),

                status:
                  result?.ok
                    ? 'Live'
                    : 'Unavailable',

                ...summary,
              };
            }
          );

        setMyStocks(
          myResults
        );

        setLastUpdated(
          new Date()
        );

        if (
          !scannerRes?.ok
        ) {
          setError(
            'Groww scanner market data is unavailable. Check your API subscription/token/backend.'
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.message ||
              'Failed to refresh stock scanner.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    refresh();

    if (live) {
      intervalRef.current =
        setInterval(
          refresh,
          intervalMs
        );
    }

    return () => {
      cancelled = true;

      if (
        intervalRef.current
      ) {
        clearInterval(
          intervalRef.current
        );
      }
    };
  }, [
    live,
    intervalMs,
  ]);

  /* ==========================================================
     STATUS
     ========================================================== */

  const marketText =
    `${scanner.marketConfirmation.label} ` +
    `(${scanner.marketConfirmation.advancing} up / ` +
    `${scanner.marketConfirmation.declining} down)`;

  const dataQuality =
    scanner.bullish.length >= 10
      ? {
          label: 'Live',
          emoji: '🟢',
        }
      : scanner.bullish.length > 0
        ? {
            label: 'Limited',
            emoji: '🟡',
          }
        : {
            label: 'Unavailable',
            emoji: '🔴',
          };

  const activeTabHelp =
    STOCK_TAB_HELP[activeTab] ||
    STOCK_TAB_HELP.dashboard;

  const dashboardHighConvictionRows =
    marketIntelligence.dashboardRows
      .filter((row) => row.score >= 80)
      .slice(0, 25);

  const dashboardStrongestRows =
    dashboardHighConvictionRows.length
      ? dashboardHighConvictionRows
      : marketIntelligence.dashboardRows
          .filter((row) => row.price && row.volume)
          .slice(0, 25);

  const dashboardWatchlistRows =
    marketIntelligence.scannerRows
      .filter((row) => row.score >= 60 && row.score < 100)
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

  const dashboardOverviewTitle =
    dashboardHighConvictionRows.length
      ? 'High Conviction Buys'
      : 'Strongest Available Stocks';

  const dashboardOverviewEmpty =
    marketIntelligence.scannerRows.length
      ? 'No stocks passed the dashboard filters right now. Check Live Scanner for all scanned rows.'
      : 'No scanner rows loaded. Check NSE proxy/API status and whether the market-data endpoints returned rows.';

  /* ==========================================================
     RENDER
     ========================================================== */

  return (
    <div className="stocks-view w-100 p-2 p-sm-3">
      {/* ── 0. MARKET SENTIMENT & EARLY-WARNING RADAR ── */}
      <MarketSentimentAlertBanner
        marketConfirmation={scanner.marketConfirmation}
        universeCount={scanner.universeCount}
        lastUpdated={lastUpdated}
        onRefresh={() => window.location.reload()}
      />

      {/* ── TOP HEADER CONTROL BAR (LIVE STREAM, INTERVAL, CAPITAL BUDGET & DATA STATUS) ── */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 p-2.5 px-3 bg-light border rounded-3 mb-3 shadow-sm">
        <div className="d-flex flex-wrap align-items-center gap-2 gap-sm-3">
          <button
            className={`btn btn-sm fw-bold px-3 ${
              live ? 'btn-danger' : 'btn-success'
            }`}
            onClick={() => setLive((val) => !val)}
          >
            {live ? 'Pause Live' : 'Resume Live'}
          </button>

          <label className="small text-muted d-flex align-items-center gap-1.5 mb-0 fw-semibold">
            <span>Interval</span>
            <select
              className="form-select form-select-sm bg-white border"
              value={String(intervalMs)}
              onChange={(e) => setIntervalMs(Number(e.target.value))}
              style={{ width: 85 }}
            >
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
              <option value={60000}>60s</option>
            </select>
          </label>

          <label className="small text-muted d-flex align-items-center gap-1.5 mb-0 fw-semibold">
            <span>Capital</span>
            <input
              className="form-control form-control-sm bg-white border fw-bold text-dark"
              min="0"
              type="number"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
              style={{ width: 110 }}
            />
          </label>

          <div className="d-flex align-items-center gap-2 small ms-sm-2">
            <span className="text-muted fw-semibold">Gainers:</span>
            <StatusChip ok={topStatus} />

            <span className="text-muted fw-semibold ms-2">Volume:</span>
            <StatusChip ok={mostStatus} />
          </div>
        </div>

        <div className="text-end small ms-auto">
          <span className="text-muted me-2">
            {lastUpdated ? `Last Sync: ${getNSEDateTime(lastUpdated).shortTime} IST` : ''}
          </span>
        </div>
      </div>

      {/* HEADER */}

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h3 className="mb-1 fs-5 fs-md-3">
            TOP 10 NSE INTRADAY STOCKS TODAY
          </h3>

          <p className="text-muted mb-0 small">
            NSE intraday scanner using market data, volume, VWAP, PDH, EMA, RSI and breakout confirmation.
          </p>
        </div>

        <div className="text-end small">
          <div>
            <strong>{marketText}</strong>
          </div>

          <div className="text-muted">
            Universe: {scanner.universeCount} · Valid: {scanner.validCount} · Bullish: {scanner.bullish.length}
          </div>

          <div className="text-muted">
            Market score: {scanner.marketScore}/5 · Data: {dataQuality.emoji} {dataQuality.label}
          </div>
        </div>
      </div>

      {/* CATEGORY TABS NAVIGATION */}

      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <TopIntraday
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      <div className={`st-tab-help st-tab-help--${activeTabHelp.tone}`}>
        <div>
          <div className="st-tab-help-title">
            {activeTabHelp.title}
          </div>

          <div className="st-tab-help-description">
            {activeTabHelp.description}
          </div>

          <div className="st-tab-help-tip">
            Beginner tip: {activeTabHelp.beginnerTip}
          </div>
        </div>

        <div className="st-color-legend" aria-label="Score color legend">
          <span className="st-legend-item st-legend-green">100+ Strong</span>
          <span className="st-legend-item st-legend-orange">60-99 Watch</span>
          <span className="st-legend-item st-legend-red">Below 60 Risk</span>
        </div>
      </div>

      {/* STATUS NOTIFICATIONS */}
      {loading && (
        <div className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1.5 mb-3 d-inline-flex align-items-center gap-2">
          <span className="spinner-border spinner-border-sm" role="status"></span>
          <span>Syncing Real-Time Market Data...</span>
        </div>
      )}

      {error && !loading && (
        <div className="alert alert-warning py-2 px-3 small rounded-3 mb-3 d-flex align-items-center gap-2 border-warning">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* SCANNER */}

      {activeTab ===
        'dashboard' && (
        <>
          <MarketIntelligenceTable
            title={dashboardOverviewTitle}
            rows={dashboardStrongestRows}
            columns={LIVE_SCANNER_COLUMNS}
            loading={loading || marketIntelligenceStatus.loading}
            error={marketIntelligenceStatus.error}
            noDataMessage={dashboardOverviewEmpty}
            onRowClick={setSelectedStock}
          />

          {!dashboardHighConvictionRows.length && dashboardStrongestRows.length > 0 && (
            <div className="alert alert-info mt-2 mb-0">
              No high-conviction buys right now. Showing the strongest available scanner rows instead.
            </div>
          )}


        </>
      )}

      {activeTab ===
        'scanner' && (
        <>
          <div className="mb-3">
            <form
              onSubmit={
                handleSearch
              }
              className="d-flex gap-2"
            >
              <input
                className="form-control form-control-sm"
                placeholder="Search symbol (e.g. CUPID)"
                value={
                  searchQuery
                }
                onChange={(event) =>
                  setSearchQuery(
                    event.target
                      .value
                  )
                }
              />

              <button
                className="btn btn-sm btn-primary"
                type="submit"
              >
                Lookup
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setSearchQuery(
                    ''
                  );
                  setLookupResult(
                    null
                  );
                }}
              >
                Clear
              </button>
            </form>
          </div>

          {lookupResult && (
            <div className="mb-3">
              <h6>
                Lookup results (
                {
                  lookupResult.length
                }
                )
              </h6>

              <ScannerTable
                rows={
                  lookupResult
                }
              />
            </div>
          )}

          <MarketIntelligenceTable
            title="Live Scanner"
            rows={marketIntelligence.scannerRows}
            columns={LIVE_SCANNER_COLUMNS}
            loading={loading}
            onRowClick={setSelectedStock}
          />

          <div className="row g-3 mt-2">
            <div className="col-12 col-xl-8">
              <h5>
                Entry Setup
              </h5>

              <EntrySetups
                rows={
                  scanner.bullish
                }
              />
            </div>

            <div className="col-12 col-xl-4">
              <h5>
                Scanner Notes
              </h5>

              <ul className="small text-muted">
                <li>
                  Momentum: 20
                </li>

                <li>
                  Volume Ratio: 20
                </li>

                <li>
                  VWAP: 15
                </li>

                <li>
                  PDH breakout: 15
                </li>

                <li>
                  Trend: 10
                </li>

                <li>
                  Liquidity: 10
                </li>

                <li>
                  Market confirmation: 5
                </li>

                <li>
                  RSI confirmation
                  is used as an
                  additional filter.
                </li>

                <li>
                  No buy orders are
                  placed by this
                  scanner.
                </li>
              </ul>
            </div>
          </div>
        </>
      )}

      {/* TOP GAINERS */}

      {activeTab ===
        'top' && (
        <TableView
          data={topTen}
        />
      )}

      {/* MOST ACTIVE */}

      {activeTab ===
        'most' && (
        <>
          <h5>
            MOST ACTIVE INTRADAY
          </h5>

          <MostActiveTable
            rows={scanner.scanned
              .slice()
              .sort(
                (a, b) =>
                  b.volume -
                  a.volume
              )
              .slice(
                0,
                10
              )}
          />
        </>
      )}

      {/* TOMORROW */}

      {/* TOMORROW */}

      {activeTab === 'tomorrow' && (
        <>
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
            <div>
              <h3 className="mb-1 text-primary fw-bold d-flex align-items-center gap-2 flex-wrap">
                <span>🎯 TODAY'S SAFE INTRADAY STOCKS</span>
                <span className="badge bg-success text-white px-2.5 py-1 fw-bold">
                  ✅ SAFE TO ENTER
                </span>
              </h3>
              <div className="small text-muted">
                Calculated for Today · Data Date: <strong className="text-dark">{tomorrowScanner.dataDate}</strong> · Time: <strong className="text-dark">{tomorrowScanner.dataTime}</strong>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
              <span className="badge bg-primary px-3 py-2 fw-semibold">
                Market Bias: {tomorrowScanner.marketSummary}
              </span>
              <span className={`badge ${tomorrowScanner.dataStatus === 'LIVE' ? 'bg-success' : 'bg-secondary'} px-3 py-2 fw-semibold`}>
                {tomorrowScanner.dataStatus}
              </span>
            </div>
          </div>

          {/* 🛡️ Safe Logic Decision Protocol Banner */}
          <div
            className="card pg-card w-100 p-3 mb-4 rounded-3 border border-primary shadow-sm"
            style={{ background: '#0f172a', color: '#f8fafc' }}
          >
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2 pb-2 border-bottom border-secondary border-opacity-50">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-primary text-white fw-bold px-2 py-1">🛡️ SAFE LOGIC DECISION ENGINE</span>
                <span className="fw-semibold text-white small">Intraday Capital Protection & Anti-Chase Protocol</span>
              </div>
              <span className="badge bg-dark border border-secondary text-warning small px-2 py-1">
                Strict Discipline Enabled
              </span>
            </div>

            <div className="row g-2 text-start" style={{ fontSize: '0.85rem' }}>
              <div className="col-12 col-md-3">
                <div className="p-2 rounded border border-secondary border-opacity-50" style={{ background: 'rgba(2, 6, 23, 0.6)' }}>
                  <div className="fw-bold text-danger mb-1">⛔ Anti-Chase Guard</div>
                  <div className="text-white" style={{ fontSize: '0.8rem', opacity: 0.95 }}>
                    Slippage &gt; <strong className="text-warning">0.35%</strong> triggers Do Not Chase. Wait for pullback to entry.
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="p-2 rounded border border-secondary border-opacity-50" style={{ background: 'rgba(2, 6, 23, 0.6)' }}>
                  <div className="fw-bold text-warning mb-1">⚖️ Risk / Reward Gate</div>
                  <div className="text-white" style={{ fontSize: '0.8rem', opacity: 0.95 }}>
                    Requires minimum <strong className="text-warning">1.5:1</strong> remaining R:R before entering any position.
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="p-2 rounded border border-secondary border-opacity-50" style={{ background: 'rgba(2, 6, 23, 0.6)' }}>
                  <div className="fw-bold text-info mb-1">📈 VWAP Alignment</div>
                  <div className="text-white" style={{ fontSize: '0.8rem', opacity: 0.95 }}>
                    Price must trade strictly above VWAP to confirm buyers are defending intraday baseline.
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="p-2 rounded border border-secondary border-opacity-50" style={{ background: 'rgba(2, 6, 23, 0.6)' }}>
                  <div className="fw-bold text-success mb-1">🎯 Profit & Breakeven</div>
                  <div className="text-white" style={{ fontSize: '0.8rem', opacity: 0.95 }}>
                    Move SL to Cost at 1:1 risk, and automatically book <strong className="text-warning">50% Qty</strong> at Target 1.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="table-responsive mb-4">
            <table className="table table-striped table-bordered table-sm align-middle">
              <thead className="table-light">
                <tr>
                  <th>Rank</th>
                  <th>Symbol</th>
                  <th>Company</th>
                  <th>Close</th>
                  <th>Change %</th>
                  <th>Rel Vol</th>
                  <th>Trend</th>
                  <th>Support</th>
                  <th>Resistance</th>
                  <th>Breakout</th>
                  <th>R/R</th>
                  <th>Score</th>
                  <th>Signal</th>
                </tr>
              </thead>

              <tbody>
                {(tomorrowScanner.safeCandidates?.length ? tomorrowScanner.safeCandidates : tomorrowScanner.top10).map((row) => (
                  <tr key={row.symbol}>
                    <td className="fw-bold">{row.rank}</td>
                    <td>
                      <strong className="text-primary d-block">{row.symbol}</strong>
                      {row.mtfLabel && (
                        <span className={`badge ${row.mtfBadge || 'bg-success text-white'} px-1.5 py-0.5 mt-0.5`} style={{ fontSize: '0.68rem' }}>
                          {row.mtfLabel}
                        </span>
                      )}
                    </td>
                    <td className="text-dark">{row.companyName}</td>
                    <td className="fw-bold">{formatMoney(row.price)}</td>
                    <td className={row.changePercent >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                      {row.changePercent ? `${row.changePercent > 0 ? '+' : ''}${row.changePercent.toFixed(2)}%` : 'N/A'}
                    </td>
                    <td className="fw-semibold">{row.relativeVolume ? `${row.relativeVolume.toFixed(2)}x` : 'N/A'}</td>
                    <td>{row.trend}</td>
                    <td>{row.supportLevel ? formatMoney(row.supportLevel) : 'N/A'}</td>
                    <td>{row.resistanceLevel ? formatMoney(row.resistanceLevel) : 'N/A'}</td>
                    <td>
                      <span className={`badge ${row.breakout ? 'bg-danger text-white' : 'bg-secondary text-white'}`}>
                        {row.breakoutLabel}
                      </span>
                    </td>
                    <td className="fw-semibold">{row.riskReward ? `${row.riskReward}:1` : 'N/A'}</td>
                    <td>
                      <span className={`badge ${row.score >= 80 ? 'bg-success text-white' : row.score >= 60 ? 'bg-warning text-dark' : 'bg-secondary text-white'}`}>
                        {row.score}/100
                      </span>
                    </td>
                    <td>
                      <span className="fw-bold">{row.signal}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {tomorrowScanner.top10.length > 0 && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h4 className="mb-0 text-dark fw-bold">
                  🛡️ Tomorrow Intraday Trade Setups & Safe Entry Guard
                </h4>
                <span className="text-muted small">
                  Dynamic Anti-Chase & Profit Lock Levels
                </span>
              </div>

              <div className="table-responsive">
                <table className="table table-bordered table-sm align-middle">
                  <thead className="table-dark text-nowrap">
                    <tr>
                      <th>Symbol</th>
                      <th>LTP / VWAP</th>
                      <th>Suggested Qty</th>
                      <th>Invested (₹)</th>
                      <th>Exp Profit (T1)</th>
                      <th>Safe Entry Zone</th>
                      <th>Stop Loss</th>
                      <th>Target 1 (50% Qty)</th>
                      <th>Target 2 & 3</th>
                      <th>R/R</th>
                      <th style={{ minWidth: 260 }}>🛡️ Safe Entry Guard</th>
                      <th style={{ minWidth: 160 }}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tomorrowScanner.top10.map((row) => {
                      const setup = renderTomorrowSetup(row, (capital || 50000) / 2);
                      const isSafe = setup.isSafe;
                      const isChase = setup.safeStatus === '⛔ DO NOT CHASE';

                      return (
                        <tr key={row.symbol} className={isSafe ? 'table-success bg-opacity-25' : ''}>
                          <td>
                            <strong className="text-primary d-block">{row.symbol}</strong>
                            {row.mtfLabel && (
                              <span className={`badge ${row.mtfBadge || 'bg-success text-white'} px-1.5 py-0.5 mt-0.5 d-inline-block`} style={{ fontSize: '0.66rem' }}>
                                {row.mtfLabel}
                              </span>
                            )}
                            <small className="text-muted d-block mt-0.5" style={{ fontSize: '0.78rem' }}>
                              {row.companyName}
                            </small>
                          </td>

                          <td>
                            <div className="fw-bold text-dark">{formatMoney(row.price)}</div>
                            <small className="text-muted d-block" style={{ fontSize: '0.78rem' }}>
                              VWAP: <strong className="text-dark">{formatMoney(row.vwap)}</strong>
                            </small>
                          </td>

                          <td>
                            <span className="badge bg-primary text-white fw-bold px-2 py-1" style={{ fontSize: '0.85rem' }}>
                              {setup.qty} Qty
                            </span>
                          </td>

                          <td className="fw-semibold text-dark" style={{ fontSize: '0.85rem' }}>
                            ₹{setup.invested.toLocaleString('en-IN')}
                          </td>

                          <td>
                            <span className="text-success fw-bold" style={{ fontSize: '0.88rem' }}>
                              +₹{setup.t1Profit.toLocaleString('en-IN')}
                            </span>
                          </td>

                          <td>
                            <span className="badge bg-warning text-dark fw-bold px-2 py-1" style={{ fontSize: '0.85rem' }}>
                              {setup.entryRange}
                            </span>
                          </td>

                          <td>
                            <span className="text-danger fw-bold" style={{ fontSize: '0.88rem' }}>{setup.stopLoss}</span>
                          </td>

                          <td>
                            <span className="text-success fw-bold" style={{ fontSize: '0.88rem' }}>{setup.bookHalfAt || setup.target1}</span>
                          </td>

                          <td>
                            <div className="fw-semibold text-dark" style={{ fontSize: '0.84rem' }}>
                              T2: <strong className="text-success">{setup.target2}</strong>
                            </div>
                            <div className="fw-semibold text-muted" style={{ fontSize: '0.84rem' }}>
                              T3: <strong className="text-primary">{setup.target3}</strong>
                            </div>
                          </td>

                          <td>
                            <span className="badge bg-secondary text-white fw-semibold">
                              {setup.riskReward}
                            </span>
                          </td>

                          <td>
                            <div className="d-flex flex-column gap-1">
                              <span
                                className={`badge ${
                                  isSafe
                                    ? 'bg-success text-white'
                                    : isChase
                                    ? 'bg-danger text-white'
                                    : 'bg-warning text-dark'
                                } fw-bold px-2 py-1 text-wrap`}
                                style={{ fontSize: '0.82rem' }}
                              >
                                {setup.safeStatus}
                              </span>

                              {isSafe ? (
                                <div className="small mt-1" style={{ fontSize: '0.78rem' }}>
                                  <div className="text-dark">🛡️ Move SL to Cost: <strong className="text-primary">₹{setup.breakevenTrigger}</strong></div>
                                  <div className="text-dark">💰 Book 50% ({setup.halfQty} Qty) at: <strong className="text-success">₹{setup.bookHalfAt}</strong> (+₹{setup.halfProfitT1.toLocaleString('en-IN')})</div>
                                </div>
                              ) : (
                                <div className="small text-danger fw-bold mt-1" style={{ fontSize: '0.78rem' }}>
                                  {setup.safeReason}
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="d-flex flex-column gap-1">
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm py-1 px-2 fw-semibold"
                                style={{ fontSize: '0.78rem' }}
                                onClick={() => {
                                  setSelectedStock({
                                    ...row,
                                    sharesQuantity: setup.qty,
                                    allocatedBudget: setup.invested,
                                    buyPrice: row.price,
                                    stopLoss: row.stopLoss,
                                    target1: row.target1,
                                    target2: row.target2,
                                  });
                                  setActiveTab('practice-trading');
                                }}
                              >
                                🎓 Practice ({setup.qty} Qty)
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm py-1 px-2 fw-semibold text-white"
                                style={{ fontSize: '0.78rem' }}
                                onClick={() => {
                                  setSelectedStock({
                                    ...row,
                                    sharesQuantity: setup.qty,
                                    allocatedBudget: setup.invested,
                                    buyPrice: row.price,
                                    stopLoss: row.stopLoss,
                                    target1: row.target1,
                                    target2: row.target2,
                                  });
                                  setActiveTab('trading');
                                }}
                              >
                                ⚡ Trade ({setup.qty} Qty)
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* PRACTICE STOCK MARKET (DUMMY FUNDS & LIVE REAL NSE DATA) */}
      {activeTab === 'practice-trading' && (
        <PracticeStockMarket />
      )}

      {/* TRADING SKILL & RISK EXPECTANCY DASHBOARD */}
      {activeTab === 'trading-skill-risk' && (
        <TradingSkillDashboard />
      )}

      {/* SHORT SELL RADAR: DOWN AT OPEN & NEWS CATALYSTS */}
      {activeTab === 'short-sell' && (
        <ShortSellRadar
          stocks={scanner.scanned || []}
          onOpenPractice={(s) => {
            setActiveTab('practice-trading');
          }}
        />
      )}

      {/* NIFTY50 MOMENTUM & BREAKOUT SCANNER */}
      {activeTab === 'nifty50' && (
        <Nifty50Scanner
          onQuickTrade={(s) => {
            setSelectedStock(s);
            setActiveTab('trading');
          }}
        />
      )}

      {/* WATCH FOR NEXT DAY (3:00 PM PRE-CLOSE MOMENTUM SCANNER) */}
      {activeTab === 'watchfornextday' && (
        <WatchForNextDay
          onQuickTrade={(s) => {
            setSelectedStock(s);
            setActiveTab('trading');
          }}
          onAddToPortfolio={(s) => {
            // Added notification handled inside
          }}
        />
      )}

      {/* LIVE BLOCK DEALS WATCH */}
      {activeTab === 'block-deals' && (
        <BlockDealsWatch
          scannedStocks={scanner.scanned || []}
          blockDeals={marketIntelligenceData.blockDeals || []}
          onQuickTrade={(s) => {
            setSelectedStock(s);
            setActiveTab('trading');
          }}
          onTrackRisk={(s) => {
            // Track risk
          }}
        />
      )}

      {/* BIGSHOT RADAR: MEGA BLOCK DEALS & 5X VOLUME NEWS BREAKOUTS */}
      {activeTab === 'bigshot-radar' && (
        <BigShotRadar
          scannedStocks={scanner.scanned || []}
          blockDeals={marketIntelligenceData.blockDeals || []}
          onTrackRisk={(s) => {
            // Track in risk monitor
          }}
          onOpenChart={(sym) => {
            // Open live chart
          }}
        />
      )}

      {/* MY STOCKS / PERSONAL PORTFOLIO */}
      {activeTab === 'mystocks' && (
        <PersonalPortfolio
          onQuickTrade={(s) => {
            setSelectedStock(null);
            setActiveTab('trading');
          }}
        />
      )}

      {/* GROUPS */}

      {activeTab === 'cupid' && (
        <>
          <h5>CUPID — Chart Data (API)</h5>

          <div className="small text-muted mb-3">
            The NSE chart API returns time-series chart information for the given index or symbol
            (OHLC, volumes, timestamps and derived series). It is useful for plotting price
            history, computing indicators and backtesting intraday setups. Below is the raw
            payload mapped into a table where possible.
          </div>

          {cupidLoading ? (
            <div className="text-muted">Loading chart data...</div>
          ) : cupidError ? (
            <div className="alert alert-warning">{cupidError}</div>
          ) : cupidChart ? (
            <div>
              <TableView data={cupidChart.data ?? cupidChart} />
            </div>
          ) : (
            <div className="text-muted">No chart data available.</div>
          )}
        </>
      )}

      {(
        activeTab ===
          'basic-industry' ||
        activeTab ===
          'personal-care'
      ) && (
        <>
          {(() => {
            const groupKey =
              activeTab ===
              'basic-industry'
                ? 'basic-industry'
                : 'personal-care';

            const rows =
              filterStocksByGroup(
                scanner.scanned,
                groupKey
              );

            const title =
              activeTab ===
              'basic-industry'
                ? 'Basic Industry stock watchlist'
                : 'Personal Care stock watchlist';

            return (
              <>
                <h5>
                  {title}
                </h5>

                {rows.length ? (
                  <ScannerTable
                    rows={
                      rows
                    }
                  />
                ) : (
                  <div className="alert alert-warning">
                    No stocks matched
                    this filter.
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {activeTab === 'trading' && (
        <div className="mt-3">
          <IntradayTradingModule />
        </div>
      )}

      {activeTab === 'momentum' && (
        <MomentumScanner
          scannerRows={momentumCandidateRows}
          marketScore={scanner.marketConfirmation?.score ?? 50}
          industryScoreMap={momentumIndustryScoreMap}
          lastUpdated={lastUpdated}
        />
      )}

      {activeTab === 'fno' && (
        <FnOStrategyEngine />
      )}

      {activeTab === 'confluence-quant' && (
        <ConfluenceQuantScanner
          onQuickTrade={(s) => {
            setSelectedStock(s);
            setActiveTab('trading');
          }}
          onSendToPractice={() => {
            setActiveTab('practice-trading');
          }}
        />
      )}

      {activeTab === 'seasonal-radar' && (
        <SeasonalThematicRadar
          onQuickTrade={(s) => {
            setSelectedStock(s);
            setActiveTab('trading');
          }}
          onSendToPractice={() => {
            setActiveTab('practice-trading');
          }}
        />
      )}

      {activeTab === 'reversal-scanner' && (
        <ReversalQuantScanner
          onQuickTrade={(s) => {
            setSelectedStock(s);
            setActiveTab('trading');
          }}
          onSendToPractice={() => {
            setActiveTab('practice-trading');
          }}
        />
      )}

      {activeTab === 'candlestick-guide' && (
        <CandleExplainer
          selectedStock={selectedStock || momentumCandidateRows?.[0] || null}
        />
      )}

      {activeTab === 'stock-bonus-dividend' && (
        <StockBonusDividend />
      )}

      {selectedStock && (
        <StockDetailModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onQuickTrade={(s) => {
            setSelectedStock(null);
            setActiveTab('trading');
          }}
        />
      )}
    </div>
  );
}
