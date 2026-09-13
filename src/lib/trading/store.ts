/**
 * Persistent State Store for Positions, Orders, Daily Stats, and Logs
 * File-backed persistence using server/data/trading-store.json
 */

import type { Position, DailyStats, TradingLog, TradingConfig } from '../../types/trading.ts';
import { DEFAULT_TRADING_CONFIG } from './config.ts';

let fs: any = null;
let path: any = null;

if (typeof window === 'undefined') {
  try {
    fs = require('fs');
    path = require('path');
  } catch {
    // client browser bundle fallback
  }
}

interface StoreData {
  config: TradingConfig;
  positions: Position[];
  closedPositions: Position[];
  stats: DailyStats;
  logs: TradingLog[];
}

function getTodayString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function getInitialStats(): DailyStats {
  return {
    date: getTodayString(),
    tradesToday: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    realizedPnL: 0,
    unrealizedPnL: 0,
    maxDailyLoss: DEFAULT_TRADING_CONFIG.maxDailyLoss,
    remainingRiskLimit: DEFAULT_TRADING_CONFIG.maxDailyLoss,
    dailyTarget: 2000,
    targetReached: false,
    maxLossHit: false,
  };
}

let inMemoryStore: StoreData = {
  config: { ...DEFAULT_TRADING_CONFIG },
  positions: [],
  closedPositions: [],
  stats: getInitialStats(),
  logs: [],
};

function getStorePath(): string {
  if (path && typeof process !== 'undefined' && process.cwd) {
    return path.resolve(process.cwd(), 'server', 'data', 'trading-store.json');
  }
  return '';
}

function loadFromFile() {
  try {
    const storePath = getStorePath();
    if (fs && storePath && fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed) {
        inMemoryStore.config = { ...DEFAULT_TRADING_CONFIG, ...(parsed.config || {}) };
        inMemoryStore.positions = parsed.positions || [];
        inMemoryStore.closedPositions = parsed.closedPositions || [];
        inMemoryStore.logs = parsed.logs || [];

        // Check if stats are from today
        const today = getTodayString();
        if (parsed.stats?.date === today) {
          inMemoryStore.stats = parsed.stats;
        } else {
          inMemoryStore.stats = getInitialStats();
        }
      }
    }
  } catch {
    // ignore
  }
}

function saveToFile() {
  try {
    const storePath = getStorePath();
    if (fs && path && storePath) {
      const dir = path.dirname(storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(storePath, JSON.stringify(inMemoryStore, null, 2), 'utf8');
    }
  } catch {
    // ignore
  }
}

// Initial load
loadFromFile();

export function getStore(): StoreData {
  const today = getTodayString();
  if (inMemoryStore.stats.date !== today) {
    inMemoryStore.stats = getInitialStats();
    saveToFile();
  }
  return inMemoryStore;
}

export function updateConfig(patch: Partial<TradingConfig>): TradingConfig {
  inMemoryStore.config = { ...inMemoryStore.config, ...patch };
  saveToFile();
  return inMemoryStore.config;
}

export function addLog(
  level: TradingLog['level'],
  category: TradingLog['category'],
  message: string,
  symbol?: string,
  details?: Record<string, any>
): TradingLog {
  const now = new Date();
  const timeString = now.toTimeString().split(' ')[0];
  const log: TradingLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: now.toISOString(),
    timeString,
    level,
    category,
    symbol,
    message,
    details,
  };

  inMemoryStore.logs.unshift(log);
  if (inMemoryStore.logs.length > 200) {
    inMemoryStore.logs.pop();
  }

  saveToFile();
  return log;
}

export function savePosition(position: Position): Position {
  const idx = inMemoryStore.positions.findIndex((p) => p.id === position.id || p.symbol === position.symbol);
  if (idx >= 0) {
    inMemoryStore.positions[idx] = position;
  } else {
    inMemoryStore.positions.push(position);
  }
  recalculateStats();
  saveToFile();
  return position;
}

export function removeOpenPosition(positionId: string, exitPrice?: number, reason?: string): Position | null {
  const idx = inMemoryStore.positions.findIndex((p) => p.id === positionId);
  if (idx < 0) return null;

  const pos = inMemoryStore.positions.splice(idx, 1)[0];
  const finalExitPrice = exitPrice ?? pos.currentPrice;
  const pnl = (finalExitPrice - pos.entryPrice) * pos.quantity * (pos.side === 'LONG' ? 1 : -1);

  const closed: Position = {
    ...pos,
    status: 'CLOSED',
    exitPrice: finalExitPrice,
    exitTime: new Date().toISOString(),
    exitReason: reason || pos.exitReason || 'Manual Exit',
    realizedPnL: pnl,
    unrealizedPnL: 0,
    unrealizedPnLPercent: 0,
  };

  inMemoryStore.closedPositions.unshift(closed);
  if (inMemoryStore.closedPositions.length > 500) {
    inMemoryStore.closedPositions.pop();
  }

  // Update stats
  inMemoryStore.stats.tradesToday += 1;
  inMemoryStore.stats.realizedPnL += pnl;
  if (pnl > 0) inMemoryStore.stats.winningTrades += 1;
  else if (pnl < 0) inMemoryStore.stats.losingTrades += 1;

  inMemoryStore.stats.winRate =
    inMemoryStore.stats.tradesToday > 0
      ? Math.round((inMemoryStore.stats.winningTrades / inMemoryStore.stats.tradesToday) * 100)
      : 0;

  inMemoryStore.stats.remainingRiskLimit = Math.max(
    0,
    inMemoryStore.stats.maxDailyLoss + inMemoryStore.stats.realizedPnL
  );
  inMemoryStore.stats.maxLossHit = inMemoryStore.stats.realizedPnL <= -inMemoryStore.stats.maxDailyLoss;
  inMemoryStore.stats.targetReached = inMemoryStore.stats.realizedPnL >= inMemoryStore.stats.dailyTarget;

  recalculateStats();
  saveToFile();
  return closed;
}

export function recalculateStats() {
  const unPnL = inMemoryStore.positions.reduce((sum, p) => sum + (p.unrealizedPnL || 0), 0);
  inMemoryStore.stats.unrealizedPnL = Number(unPnL.toFixed(2));
}

export function resetStore(capital = 50000) {
  inMemoryStore.positions = [];
  inMemoryStore.closedPositions = [];
  inMemoryStore.stats = getInitialStats();
  inMemoryStore.config.capital = capital;
  inMemoryStore.logs = [
    {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      timeString: new Date().toTimeString().split(' ')[0],
      level: 'INFO',
      category: 'SYSTEM',
      message: `🔄 Paper Trading Journal Reset. Virtual balance initialized to ₹${capital.toLocaleString('en-IN')}.`,
    },
  ];
  saveToFile();
  return inMemoryStore;
}
