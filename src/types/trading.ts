/**
 * Internal Trading & Risk Management Types
 */

export type TradingMode = 'PAPER' | 'LIVE';

export type SignalLevel = 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'WEAK' | 'BEARISH';

export type PositionStatus =
  | 'PENDING'
  | 'OPEN'
  | 'TARGET_HIT'
  | 'STOP_LOSS_HIT'
  | 'TRAILING_STOP_HIT'
  | 'CLOSED'
  | 'ERROR';

export interface TradeSignal {
  symbol: string;
  signal: 'BUY' | 'WAIT' | 'AVOID';
  signalLevel: SignalLevel;
  bullishScore: number;
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskReward: number;
  quantity: number;
  riskAmount: number;
  potentialProfit: number;
  reasons: string[];
  generatedAt: string;
}

export interface Position {
  id: string;
  symbol: string;
  exchange: string;
  side: 'LONG' | 'SHORT';
  mode: TradingMode;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number;
  target1: number;
  target2: number;
  trailingStop: number;
  trailingHighWater: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  realizedPnL?: number;
  status: PositionStatus;
  exitReason?: string;
  exitPrice?: number;
  entryTime: string;
  exitTime?: string;
  growwOrderId?: string;
  orderReferenceId?: string;
}

export interface ScannerStock {
  rank: number;
  symbol: string;
  companyName?: string;
  ltp: number;
  changePercent: number;
  volume: number;
  volumeRatio?: number;
  vwap: number;
  rsi: number;
  support: number;
  resistance: number;
  bullishScore: number;
  score?: number;
  aboveVwap?: boolean;
  signal: SignalLevel;
  entryPrice: number;
  target: number;
  stopLoss: number;
  riskReward: number;
  riskRewardRatio?: number;
  suggestedQty?: number;
  adx?: number;
  atr?: number;
  candlePattern?: string | null;
  breakoutType?: string | null;
}

export interface DailyStats {
  date: string;
  tradesToday: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  realizedPnL: number;
  unrealizedPnL: number;
  maxDailyLoss: number;
  remainingRiskLimit: number;
  dailyTarget: number;
  targetReached: boolean;
  maxLossHit: boolean;
}

export interface TradingConfig {
  mode: TradingMode;
  enabled: boolean;
  capital: number;
  riskPerTradePct: number;
  maxPositionValue: number;
  maxTradesPerDay: number;
  maxDailyLoss: number;
  maxOpenPositions: number;
  minBullishScore: number;
  minRsi: number;
  maxRsi: number;
  minVolume: number;
  minVolumeRatio: number;
  minBreakoutPercent: number;
  stopLossPct: number;
  targetPct: number;
  trailingStopTriggerPct: number;
  trailingStopDistancePct: number;
  useAtrStop: boolean;
}

export interface TradingLog {
  id: string;
  timestamp: string;
  timeString: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'ALERT';
  category: 'SCANNER' | 'SIGNAL' | 'ORDER' | 'POSITION' | 'RISK' | 'AUTH' | 'SYSTEM';
  symbol?: string;
  message: string;
  details?: Record<string, any>;
}

export interface RiskCheckResult {
  allowed: boolean;
  code?: string;
  reason?: string;
  details?: Record<string, any>;
}

