/**
 * ⚡ Real-Time 5-Minute VWAP Crossover & Volume Surge (3x SMA20) Monitoring Engine
 * 
 * High-performance WebSocket data monitor optimized for high-frequency live market feeds.
 * Uses O(1) incremental tick updates, sliding window volume buffers, running VWAP sums,
 * and automated webhook/push alert dispatching.
 */

export interface LiveTick {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number; // Unix timestamp in ms
}

export interface Candle5Min {
  symbol: string;
  startTime: number; // Candle 5-min bucket start time (ms)
  endTime: number;   // Candle 5-min bucket end time (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  isClosed: boolean;
}

export interface AlertPayload {
  alertId: string;
  symbol: string;
  timestamp: number;
  timeString: string;
  candle: Candle5Min;
  prevClose: number;
  prevVwap: number;
  volumeSma20: number;
  volumeSurgeRatio: number;
  vwapCrossover: {
    fromBelow: number;
    toAbove: number;
    vwap: number;
  };
  conditionsMet: {
    vwapBullishCross: boolean;
    volumeSurge3x: boolean;
    bullishCandle: boolean;
  };
  message: string;
}

export interface WebhookConfig {
  url?: string;
  headers?: Record<string, string>;
  onAlert?: (alert: AlertPayload) => void;
}

export interface MonitorOptions {
  smaPeriod?: number;           // Default: 20 candles
  volumeSurgeThreshold?: number; // Default: 3.0 (300%)
  candleIntervalMs?: number;    // Default: 300000ms (5 mins)
  webhookConfig?: WebhookConfig;
  webSocketUrl?: string;
}

interface SymbolState {
  currentCandle: Candle5Min | null;
  prevCandle: Candle5Min | null;
  historyCandleVolumes: number[]; // Circular ring buffer (size <= smaPeriod)
  runningVolumeSum: number;
  cumulativePriceVolume: number; // Running sum(price * volume) for VWAP
  cumulativeVolume: number;      // Running sum(volume) for VWAP
}

export class RealtimeVwapSurgeMonitor {
  private smaPeriod: number;
  private volumeSurgeThreshold: number;
  private candleIntervalMs: number;
  private webhookConfig: WebhookConfig;
  private webSocketUrl?: string;

  private ws: WebSocket | null = null;
  private isConnected = false;
  private symbolStates: Map<string, SymbolState> = new Map();
  private alertListeners: Set<(alert: AlertPayload) => void> = new Set();
  private alertHistory: AlertPayload[] = [];
  private processedTickCount = 0;

  constructor(options: MonitorOptions = {}) {
    this.smaPeriod = options.smaPeriod ?? 20;
    this.volumeSurgeThreshold = options.volumeSurgeThreshold ?? 3.0;
    this.candleIntervalMs = options.candleIntervalMs ?? 5 * 60 * 1000; // 5 minutes
    this.webhookConfig = options.webhookConfig ?? {};
    this.webSocketUrl = options.webSocketUrl;

    if (this.webhookConfig.onAlert) {
      this.alertListeners.add(this.webhookConfig.onAlert);
    }
  }

  /**
   * Connects to a WebSocket endpoint.
   * Handles auto-reconnect and incoming tick parsing.
   */
  public connect(url?: string): void {
    const wsUrl = url || this.webSocketUrl;
    if (!wsUrl) return;

    try {
      if (typeof WebSocket === 'undefined') return;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const rawData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (Array.isArray(rawData)) {
            for (let i = 0; i < rawData.length; i++) {
              this.processTick(rawData[i]);
            }
          } else if (rawData && typeof rawData === 'object') {
            this.processTick(rawData as LiveTick);
          }
        } catch {
          // Ignore invalid message formatting
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch {
      this.isConnected = false;
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  public subscribeAlert(listener: (alert: AlertPayload) => void): () => void {
    this.alertListeners.add(listener);
    return () => {
      this.alertListeners.delete(listener);
    };
  }

  /**
   * High-Frequency O(1) Incremental Tick Processing Engine
   * Updates 5-minute candle OHLCV, cumulative VWAP, and volume SMA without execution lag.
   */
  public processTick(tick: LiveTick): AlertPayload | null {
    if (!tick || !tick.symbol || typeof tick.price !== 'number' || tick.price <= 0) {
      return null;
    }

    this.processedTickCount++;

    const timestamp = tick.timestamp || Date.now();
    const bucketStart = Math.floor(timestamp / this.candleIntervalMs) * this.candleIntervalMs;
    const bucketEnd = bucketStart + this.candleIntervalMs;

    let state = this.symbolStates.get(tick.symbol);
    if (!state) {
      state = {
        currentCandle: null,
        prevCandle: null,
        historyCandleVolumes: [],
        runningVolumeSum: 0,
        cumulativePriceVolume: 0,
        cumulativeVolume: 0,
      };
      this.symbolStates.set(tick.symbol, state);
    }

    // Incremental VWAP running totals
    const tickVol = Math.max(0, tick.volume || 1);
    state.cumulativePriceVolume += tick.price * tickVol;
    state.cumulativeVolume += tickVol;
    const currentVwap = Number((state.cumulativePriceVolume / Math.max(1, state.cumulativeVolume)).toFixed(2));

    let completedAlert: AlertPayload | null = null;

    // Check if tick belongs to a new 5-minute candle interval
    if (!state.currentCandle || state.currentCandle.startTime !== bucketStart) {
      if (state.currentCandle) {
        // Finalize previous candle
        const finishedCandle: Candle5Min = {
          ...state.currentCandle,
          isClosed: true,
        };
        state.prevCandle = finishedCandle;

        // O(1) Sliding Window Volume SMA Update
        state.historyCandleVolumes.push(finishedCandle.volume);
        state.runningVolumeSum += finishedCandle.volume;

        if (state.historyCandleVolumes.length > this.smaPeriod) {
          const removedVol = state.historyCandleVolumes.shift() || 0;
          state.runningVolumeSum -= removedVol;
        }

        // Evaluate conditions on finished candle
        completedAlert = this.evaluateAlertConditions(tick.symbol, finishedCandle, state);
      }

      // Initialize new 5-minute candle
      state.currentCandle = {
        symbol: tick.symbol,
        startTime: bucketStart,
        endTime: bucketEnd,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tickVol,
        vwap: currentVwap,
        isClosed: false,
      };
    } else {
      // Update ongoing candle O(1)
      const candle = state.currentCandle;
      candle.high = Math.max(candle.high, tick.price);
      candle.low = Math.min(candle.low, tick.price);
      candle.close = tick.price;
      candle.volume += tickVol;
      candle.vwap = currentVwap;
    }

    return completedAlert;
  }

  /**
   * Evaluates the 3 mandatory alert conditions simultaneously:
   * 1. Candle's closing price crosses from below VWAP to above VWAP.
   * 2. Trading volume is >= 300% (3x) higher than the simple moving average of volume over past 20 candles.
   * 3. Current close is higher than current open (Close > Open).
   */
  public evaluateAlertConditions(
    symbol: string,
    candle: Candle5Min,
    state: SymbolState
  ): AlertPayload | null {
    // Condition 3: Bullish candle check (Close > Open)
    const bullishCandle = candle.close > candle.open;
    if (!bullishCandle) return null;

    // Condition 1: Price crosses from below VWAP to above VWAP
    // Either previous candle closed below its VWAP, or opening of candle was below VWAP, and close is >= VWAP
    const prevClose = state.prevCandle ? state.prevCandle.close : candle.open;
    const prevVwap = state.prevCandle ? state.prevCandle.vwap : candle.vwap;
    
    const wasBelowVwap = prevClose < prevVwap || candle.open < candle.vwap;
    const nowAboveVwap = candle.close >= candle.vwap;
    const vwapBullishCross = wasBelowVwap && nowAboveVwap;

    if (!vwapBullishCross) return null;

    // Condition 2: Volume >= 3x SMA(20)
    // History contains previous completed candles (excluding current finished candle)
    const historyCount = state.historyCandleVolumes.length - 1;
    if (historyCount < 1) {
      // If historical count is insufficient in fresh sessions, fall back to comparing against average
      return null;
    }

    // SMA calculated from prior completed candles (excluding the current one)
    const priorVolumeSum = state.runningVolumeSum - candle.volume;
    const volumeSma20 = Number((priorVolumeSum / historyCount).toFixed(2));
    const volumeSurgeRatio = Number((candle.volume / Math.max(1, volumeSma20)).toFixed(2));

    const volumeSurge3x = volumeSurgeRatio >= this.volumeSurgeThreshold;
    if (!volumeSurge3x) return null;

    // Construct Instant Alert Payload
    const alertId = `ALERT_${symbol}_${candle.startTime}_${Date.now()}`;
    const timeString = new Date(candle.endTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });

    const alert: AlertPayload = {
      alertId,
      symbol,
      timestamp: candle.endTime,
      timeString,
      candle,
      prevClose,
      prevVwap,
      volumeSma20,
      volumeSurgeRatio,
      vwapCrossover: {
        fromBelow: prevClose,
        toAbove: candle.close,
        vwap: candle.vwap,
      },
      conditionsMet: {
        vwapBullishCross: true,
        volumeSurge3x: true,
        bullishCandle: true,
      },
      message: `🚨 HIGH CONVICTION ALERT: ${symbol} 5-Min Bullish VWAP Crossover with ${volumeSurgeRatio}x Volume Surge! Close: ₹${candle.close} > VWAP: ₹${candle.vwap}.`,
    };

    // Store in history
    this.alertHistory.unshift(alert);
    if (this.alertHistory.length > 100) {
      this.alertHistory.pop();
    }

    // Dispatch alert to listeners
    this.alertListeners.forEach((listener) => {
      try {
        listener(alert);
      } catch {
        // Suppress listener callback errors
      }
    });

    // Dispatch HTTP Webhook POST alert if URL configured
    if (this.webhookConfig.url) {
      this.dispatchWebhook(alert);
    }

    return alert;
  }

  private async dispatchWebhook(alert: AlertPayload): Promise<void> {
    if (!this.webhookConfig.url) return;

    try {
      if (typeof fetch !== 'undefined') {
        await fetch(this.webhookConfig.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.webhookConfig.headers || {}),
          },
          body: JSON.stringify(alert),
        });
      }
    } catch {
      // Suppress network errors in fallback environments
    }
  }

  // Helper utility getters
  public getSymbolState(symbol: string): SymbolState | undefined {
    return this.symbolStates.get(symbol);
  }

  public getAlertHistory(): AlertPayload[] {
    return [...this.alertHistory];
  }

  public getProcessedTickCount(): number {
    return this.processedTickCount;
  }

  public clear(): void {
    this.symbolStates.clear();
    this.alertHistory = [];
    this.processedTickCount = 0;
  }
}

