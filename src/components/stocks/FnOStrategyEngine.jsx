'use client';

import { useState, useMemo } from 'react';
import {
  calcBullCallSpread,
  calcBearPutSpread,
  calcIronCondor,
  calcCalendarSpread,
  generatePayoff,
  scoreStrategy,
  classifyScore,
  detectRegime,
  getPaperTrades,
  savePaperTrade,
  clearPaperTrades,
  appendAuditLog,
  getAuditLog,
  riskGate,
  getMockOptionChain,
  suggestStrategy,
} from '../../services/foEngine.js';
import ExpirySurgeRadar from './ExpirySurgeRadar';

const DISCLAIMER =
  'This tool provides defined-risk strategy analysis only. It does not guarantee profit. ' +
  'All trades carry risk including maximum loss of the net debit shown. ' +
  'Paper trading mode only — no live orders are placed by this application.';

const UNDERLYINGS = [
  { symbol: 'NIFTY', spot: 24500, lotSize: 25 },
  { symbol: 'BANKNIFTY', spot: 52000, lotSize: 15 },
  { symbol: 'FINNIFTY', spot: 23500, lotSize: 40 },
  { symbol: 'MIDCPNIFTY', spot: 12000, lotSize: 75 },
];

const STRATEGIES = ['Bull Call Spread', 'Bear Put Spread', 'Iron Condor', 'Calendar Spread'];

const DEFAULT_RISK = {
  capital: 100000,
  riskPct: 1,
  maxDailyLoss: 2000,
  maxPositions: 3,
  minRR: 1.2,
  minLiquidity: 1000,
  maxBidAsk: 5,
  maxDataAgeMs: 60000,
};

function fmt(n, d = 2) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });
}

function fmtRs(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return '₹' + fmt(n);
}

function ScoreBadge({ score }) {
  const { label, color } = classifyScore(score);
  return <span className={`badge text-bg-${color}`}>{score}/100 — {label}</span>;
}

function DisclaimerBanner() {
  return (
    <div className="alert alert-warning py-2 small mb-3">
      <strong>Important: </strong>{DISCLAIMER}
    </div>
  );
}

function RiskConfig({ config, onChange }) {
  function field(key, label, min, max, step) {
    return (
      <div className="col-6 col-md-4 col-lg-3" key={key}>
        <label className="form-label small mb-1">{label}</label>
        <input
          type="number" className="form-control form-control-sm"
          min={min} max={max} step={step} value={config[key]}
          onChange={e => onChange({ ...config, [key]: Number(e.target.value) })}
        />
      </div>
    );
  }
  return (
    <div className="card mb-3">
      <div className="card-header py-2"><strong>Risk Configuration</strong></div>
      <div className="card-body">
        <div className="row g-2">
          {field('capital', 'Capital (₹)', 10000, 10000000, 1000)}
          {field('riskPct', 'Max Risk/Trade (%)', 0.1, 5, 0.1)}
          {field('maxDailyLoss', 'Max Daily Loss (₹)', 100, 100000, 100)}
          {field('maxPositions', 'Max Open Positions', 1, 20, 1)}
          {field('minRR', 'Min Reward/Risk', 0.5, 5, 0.1)}
          {field('minLiquidity', 'Min OI', 100, 1000000, 100)}
          {field('maxBidAsk', 'Max Bid-Ask Spread', 0.5, 50, 0.5)}
        </div>
        <div className="mt-2 small text-muted">
          Allowed risk per trade: <strong>{fmtRs(config.capital * config.riskPct / 100)}</strong>
        </div>
      </div>
    </div>
  );
}

function MarketOverview({ underlyings }) {
  return (
    <div className="row g-2 mb-3">
      {underlyings.map(u => {
        const regime = detectRegime({
          rsi: u.rsi, changePercent: u.changePercent || 0,
          iv: u.iv, spot: u.spot, ema20: u.ema20,
        });
        const regimeColor =
          regime === 'BULLISH' ? 'success' :
          regime === 'BEARISH' ? 'danger' :
          regime === 'HIGH VOLATILITY' ? 'warning' : 'secondary';
        return (
          <div key={u.symbol} className="col-6 col-lg-3">
            <div className="card h-100">
              <div className="card-body py-2 px-3">
                <div className="fw-bold">{u.symbol}</div>
                <div className="fs-5">{fmtRs(u.spot)}</div>
                <span className={`badge text-bg-${regimeColor} small`}>{regime}</span>
                <div className="small text-muted mt-1">
                  IV: {u.iv ? (u.iv * 100).toFixed(1) + '%' : '—'}&nbsp;
                  PCR: {u.pcr || '—'}&nbsp;
                  OI: {u.oi ? fmt(u.oi, 0) : '—'}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OptionChainTable({ chain }) {
  if (!chain) return <div className="text-muted small">Select an underlying and click Load Option Chain.</div>;
  return (
    <div>
      <div className="table-responsive">
        <table className="table table-sm table-bordered align-middle small">
          <thead className="table-dark">
            <tr>
              <th>CE OI</th><th>CE Vol</th><th>CE IV</th><th>CE Bid</th>
              <th>CE LTP</th><th>CE Ask</th>
              <th className="table-warning text-center">Strike</th>
              <th>PE Bid</th><th>PE LTP</th><th>PE Ask</th>
              <th>PE IV</th><th>PE Vol</th><th>PE OI</th>
            </tr>
          </thead>
          <tbody>
            {chain.strikes.map(s => (
              <tr key={s.strike}>
                <td>{fmt(s.ce.oi, 0)}</td>
                <td>{fmt(s.ce.volume, 0)}</td>
                <td>{(s.ce.iv * 100).toFixed(1)}%</td>
                <td>{fmtRs(s.ce.bid)}</td>
                <td className="fw-bold">{fmtRs(s.ce.ltp)}</td>
                <td>{fmtRs(s.ce.ask)}</td>
                <td className="table-warning text-center fw-bold">{s.strike}</td>
                <td>{fmtRs(s.pe.bid)}</td>
                <td className="fw-bold">{fmtRs(s.pe.ltp)}</td>
                <td>{fmtRs(s.pe.ask)}</td>
                <td>{(s.pe.iv * 100).toFixed(1)}%</td>
                <td>{fmt(s.pe.volume, 0)}</td>
                <td>{fmt(s.pe.oi, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-warning small mt-1">⚠️ {chain.source}</div>
    </div>
  );
}

function PayoffChart({ payoff, maxProfit, maxLoss, breakeven }) {
  if (!payoff || !payoff.length) return null;
  const maxAbs = Math.max(...payoff.map(p => Math.abs(p.pnl)), 1);
  const barH = 60;
  return (
    <div>
      <div className="d-flex align-items-end" style={{ height: barH * 2 + 4, overflowX: 'auto' }}>
        {payoff.map((p, i) => {
          const h = Math.abs(p.pnl / maxAbs) * barH;
          const color = p.pnl >= 0 ? '#198754' : '#dc3545';
          return (
            <div key={i} title={`Price: ${fmtRs(p.price)} P&L: ${fmtRs(p.pnl)}`}
              style={{ flex: 1, minWidth: 8, display: 'flex', flexDirection: 'column',
                alignItems: 'center', height: barH * 2 + 4 }}>
              {p.pnl >= 0
                ? <><div style={{ flex: 1 }} /><div style={{ height: h, width: '80%', background: color, borderRadius: 2 }} /><div style={{ height: barH }} /></>
                : <><div style={{ height: barH }} /><div style={{ height: h, width: '80%', background: color, borderRadius: 2 }} /><div style={{ flex: 1 }} /></>
              }
            </div>
          );
        })}
      </div>
      <div className="d-flex justify-content-between small text-muted mt-1">
        <span>{fmtRs(payoff[0]?.price)}</span>
        {breakeven && <span className="text-warning">BE: {fmtRs(breakeven)}</span>}
        <span>{fmtRs(payoff[payoff.length - 1]?.price)}</span>
      </div>
      <div className="d-flex gap-3 small mt-1">
        <span className="text-success">Max Profit: {fmtRs(maxProfit)}</span>
        <span className="text-danger">Max Loss: {fmtRs(maxLoss)}</span>
      </div>
    </div>
  );
}

function StrategyResult({ result, payoff, riskConfig, onPaperTrade }) {
  if (!result) return null;
  const { color } = classifyScore(result.score || 0);
  const gate = result.gate || { allowed: true, reasons: [] };
  return (
    <div className={`card border-${color} mb-3`}>
      <div className={`card-header bg-${color} text-white d-flex justify-content-between align-items-center py-2`}>
        <strong>{result.strategy}</strong>
        <ScoreBadge score={result.score || 0} />
      </div>
      <div className="card-body">
        <div className="row g-3">
          <div className="col-md-6">
            <table className="table table-sm table-bordered mb-0">
              <tbody>
                <tr><td>Direction</td><td><strong>{result.direction}</strong></td></tr>
                <tr><td>Market Regime</td><td>{result.regime}</td></tr>
                {result.netDebit !== undefined && (
                  <tr><td>Net Debit</td><td className="text-danger fw-bold">{fmtRs(result.netDebit)}</td></tr>
                )}
                {result.netCredit !== undefined && (
                  <tr><td>Net Credit</td><td className="text-success fw-bold">{fmtRs(result.netCredit)}</td></tr>
                )}
                <tr><td>Max Profit (gross)</td><td className="text-success">{fmtRs(result.maxProfit)}</td></tr>
                <tr><td>Max Loss (gross)</td><td className="text-danger">{fmtRs(result.maxLoss)}</td></tr>
                <tr><td>Est. Transaction Costs</td><td>{fmtRs(result.costs)}</td></tr>
                <tr><td>Net Max Profit</td><td className="text-success fw-bold">{fmtRs(result.netMaxProfit)}</td></tr>
                <tr><td>Net Max Loss</td><td className="text-danger fw-bold">{fmtRs(result.netMaxLoss)}</td></tr>
                {result.breakeven && <tr><td>Breakeven</td><td>{fmtRs(result.breakeven)}</td></tr>}
                {result.upperBreakeven && <tr><td>Upper Breakeven</td><td>{fmtRs(result.upperBreakeven)}</td></tr>}
                {result.lowerBreakeven && <tr><td>Lower Breakeven</td><td>{fmtRs(result.lowerBreakeven)}</td></tr>}
                <tr><td>Reward/Risk</td><td><strong>{result.rr}</strong></td></tr>
              </tbody>
            </table>
          </div>
          <div className="col-md-6">
            <PayoffChart
              payoff={payoff}
              maxProfit={result.maxProfit}
              maxLoss={result.maxLoss}
              breakeven={result.breakeven || result.upperBreakeven}
            />
          </div>
        </div>

        {result.greeks && (
          <div className="mt-2 small">
            <strong>Strategy Greeks: </strong>
            Delta: {result.greeks.delta}&nbsp;&nbsp;
            Theta: {fmtRs(result.greeks.theta)}/day&nbsp;&nbsp;
            Vega: {fmtRs(result.greeks.vega)}/1% IV
          </div>
        )}

        <div className="mt-2">
          <strong>Legs:</strong>
          <div className="d-flex flex-wrap gap-2 mt-1">
            {result.legs.map((leg, i) => (
              <span key={i} className={`badge text-bg-${leg.action === 'BUY' ? 'primary' : 'secondary'}`}>
                {leg.action} {leg.strike} {leg.type} @ {fmtRs(leg.premium)}{leg.expiry ? ` (${leg.expiry})` : ''}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 small text-muted">
          <strong>Main risks:</strong> Gap risk · IV change · Slippage · Execution risk · Expiry risk
        </div>

        <div className="mt-2">
          {gate.allowed ? (
            <div className="alert alert-success py-2 mb-2 small">
              ✅ All risk filters passed — <strong>ENTRY CANDIDATE</strong> (Controlled-risk setup)
            </div>
          ) : (
            <div className="alert alert-danger py-2 mb-2 small">
              ❌ <strong>NO TRADE</strong> — {gate.reasons.join(' | ')}
            </div>
          )}
          {gate.allowed && (
            <button className="btn btn-sm btn-outline-success" onClick={() => onPaperTrade(result)}>
              📝 Add to Paper Trades
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PaperTradesPanel({ trades, onClear }) {
  if (!trades.length) {
    return (
      <div className="text-muted small">
        No paper trades yet. Run a strategy analysis and click &apos;Add to Paper Trades&apos;.
      </div>
    );
  }
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong>Paper Trades ({trades.length})</strong>
        <button className="btn btn-sm btn-outline-danger" onClick={onClear}>Clear All</button>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-bordered small">
          <thead className="table-dark">
            <tr>
              <th>Time</th><th>Underlying</th><th>Strategy</th><th>Direction</th>
              <th>Max Profit</th><th>Max Loss</th><th>R/R</th><th>Score</th><th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {trades.map(t => (
              <tr key={t.id}>
                <td>{new Date(t.timestamp).toLocaleString('en-IN')}</td>
                <td>{t.underlying || '—'}</td>
                <td>{t.strategy}</td>
                <td>{t.direction}</td>
                <td className="text-success">{fmtRs(t.maxProfit)}</td>
                <td className="text-danger">{fmtRs(t.maxLoss)}</td>
                <td>{t.rr}</td>
                <td><ScoreBadge score={t.score || 0} /></td>
                <td><span className="badge text-bg-info">PAPER</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditLogPanel({ log }) {
  if (!log.length) return <div className="text-muted small">No audit entries yet.</div>;
  return (
    <div className="table-responsive">
      <table className="table table-sm table-bordered small">
        <thead className="table-dark">
          <tr><th>Time</th><th>Event</th><th>Detail</th></tr>
        </thead>
        <tbody>
          {log.slice(0, 50).map((e, i) => (
            <tr key={i}>
              <td>{new Date(e.ts).toLocaleTimeString('en-IN')}</td>
              <td>{e.event}</td>
              <td className="text-muted">{e.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StrategyBuilder({ chain, spot, lotSize, riskConfig, onResult }) {
  const [strategy, setStrategy] = useState('Bull Call Spread');
  const [lots, setLots] = useState(1);
  const [params, setParams] = useState({});

  const strikes = chain ? chain.strikes.map(s => s.strike) : [];
  const midIdx = chain ? Math.floor(chain.strikes.length / 2) : 0;
  const atm = chain ? chain.strikes[midIdx]?.strike : spot;
  const step = chain && chain.strikes.length > 1
    ? chain.strikes[1].strike - chain.strikes[0].strike
    : 100;

  function setP(key, val) {
    setParams(prev => ({ ...prev, [key]: val }));
  }

  function numField(key, label, options) {
    return (
      <div className="col-6 col-md-4" key={key}>
        <label className="form-label small mb-1">{label}</label>
        {options ? (
          <select className="form-select form-select-sm"
            value={params[key] || ''}
            onChange={e => setP(key, Number(e.target.value))}>
            <option value="">Select</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type="number" className="form-control form-control-sm"
            value={params[key] || ''}
            onChange={e => setP(key, Number(e.target.value))} />
        )}
      </div>
    );
  }

  function buildResult() {
    const T = (params.dte || 21) / 365;
    const r = 0.065;
    const iv = params.iv || 0.18;
    const base = { spot, lotSize, lots, T, r, iv };
    let result = null;

    if (strategy === 'Bull Call Spread') {
      const buyStrike = params.buyStrike || atm;
      const sellStrike = params.sellStrike || atm + step;
      const buyPremium = chain?.strikes.find(s => s.strike === buyStrike)?.ce.ltp || params.buyPremium || 100;
      const sellPremium = chain?.strikes.find(s => s.strike === sellStrike)?.ce.ltp || params.sellPremium || 50;
      result = calcBullCallSpread({ ...base, buyStrike, sellStrike, buyPremium, sellPremium });
    } else if (strategy === 'Bear Put Spread') {
      const buyStrike = params.buyStrike || atm;
      const sellStrike = params.sellStrike || atm - step;
      const buyPremium = chain?.strikes.find(s => s.strike === buyStrike)?.pe.ltp || params.buyPremium || 100;
      const sellPremium = chain?.strikes.find(s => s.strike === sellStrike)?.pe.ltp || params.sellPremium || 50;
      result = calcBearPutSpread({ ...base, buyStrike, sellStrike, buyPremium, sellPremium });
    } else if (strategy === 'Iron Condor') {
      const si = chain ? chain.strikes : [];
      const m = Math.floor(si.length / 2);
      result = calcIronCondor({
        ...base,
        longPutStrike: params.longPutStrike || si[m - 2]?.strike || atm - step * 3,
        shortPutStrike: params.shortPutStrike || si[m - 1]?.strike || atm - step,
        shortCallStrike: params.shortCallStrike || si[m + 1]?.strike || atm + step,
        longCallStrike: params.longCallStrike || si[m + 2]?.strike || atm + step * 3,
        longPutPremium: params.longPutPremium || si[m - 2]?.pe.ltp || 30,
        shortPutPremium: params.shortPutPremium || si[m - 1]?.pe.ltp || 60,
        shortCallPremium: params.shortCallPremium || si[m + 1]?.ce.ltp || 60,
        longCallPremium: params.longCallPremium || si[m + 2]?.ce.ltp || 30,
      });
    } else if (strategy === 'Calendar Spread') {
      result = calcCalendarSpread({
        ...base,
        strike: params.strike || atm,
        nearPremium: params.nearPremium || 80,
        farPremium: params.farPremium || 120,
        nearT: (params.nearDte || 7) / 365,
        farT: T,
        nearIV: params.nearIV || iv - 0.02,
        farIV: params.farIV || iv + 0.02,
      });
    }

    if (!result) return;

    const regime = detectRegime({
      rsi: params.rsi,
      changePercent: params.changePercent || 0,
      iv,
      spot,
    });

    const score = scoreStrategy({
      direction: result.direction,
      regime,
      rr: result.rr || 0,
      iv,
      liquidity: 'MEDIUM',
      oi: 100000,
      volume: 5000,
      technicalScore: params.technicalScore || 50,
    });

    const allowedRisk = riskConfig.capital * (riskConfig.riskPct / 100);
    const gate = riskGate({
      maxLoss: result.netMaxLoss || result.maxLoss,
      allowedRisk,
      liquidity: 100000,
      minLiquidity: riskConfig.minLiquidity,
      bidAskSpread: 2,
      maxBidAsk: riskConfig.maxBidAsk,
      dailyLoss: 0,
      maxDailyLoss: riskConfig.maxDailyLoss,
      openPositions: 0,
      maxPositions: riskConfig.maxPositions,
      dataAgeMs: 5000,
      maxDataAgeMs: riskConfig.maxDataAgeMs,
    });

    const payoff = generatePayoff(result.legs, spot, lotSize, lots);
    onResult({ ...result, score, gate, regime, payoff });
    appendAuditLog({
      event: 'SIGNAL_GENERATED',
      detail: `${result.strategy} score=${score} gate=${gate.allowed ? 'PASS' : 'FAIL'}`,
    });
  }

  return (
    <div className="card mb-3">
      <div className="card-header py-2"><strong>Strategy Builder</strong></div>
      <div className="card-body">
        <div className="row g-2 mb-3">
          <div className="col-6 col-md-4">
            <label className="form-label small mb-1">Strategy</label>
            <select className="form-select form-select-sm" value={strategy}
              onChange={e => { setStrategy(e.target.value); setParams({}); }}>
              {STRATEGIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-6 col-md-4">
            <label className="form-label small mb-1">Lots</label>
            <input type="number" min={1} className="form-control form-control-sm"
              value={lots} onChange={e => setLots(Number(e.target.value))} />
          </div>
          {numField('dte', 'DTE (days to expiry)')}
          {numField('iv', 'IV (e.g. 0.18 = 18%)')}
          {numField('rsi', 'RSI')}
          {numField('changePercent', 'Underlying Change %')}
          {numField('technicalScore', 'Technical Score (0–100)')}
        </div>

        {strategy === 'Bull Call Spread' && (
          <div className="row g-2 mb-2">
            {numField('buyStrike', 'Buy Strike (CE)', strikes)}
            {numField('sellStrike', 'Sell Strike (CE)', strikes)}
            {numField('buyPremium', 'Buy Premium (₹)')}
            {numField('sellPremium', 'Sell Premium (₹)')}
          </div>
        )}
        {strategy === 'Bear Put Spread' && (
          <div className="row g-2 mb-2">
            {numField('buyStrike', 'Buy Strike (PE)', strikes)}
            {numField('sellStrike', 'Sell Strike (PE)', strikes)}
            {numField('buyPremium', 'Buy Premium (₹)')}
            {numField('sellPremium', 'Sell Premium (₹)')}
          </div>
        )}
        {strategy === 'Iron Condor' && (
          <div className="row g-2 mb-2">
            {numField('longPutStrike', 'Long Put Strike', strikes)}
            {numField('shortPutStrike', 'Short Put Strike', strikes)}
            {numField('shortCallStrike', 'Short Call Strike', strikes)}
            {numField('longCallStrike', 'Long Call Strike', strikes)}
            {numField('longPutPremium', 'Long Put Premium (₹)')}
            {numField('shortPutPremium', 'Short Put Premium (₹)')}
            {numField('shortCallPremium', 'Short Call Premium (₹)')}
            {numField('longCallPremium', 'Long Call Premium (₹)')}
          </div>
        )}
        {strategy === 'Calendar Spread' && (
          <div className="row g-2 mb-2">
            {numField('strike', 'Strike', strikes)}
            {numField('nearDte', 'Near DTE')}
            {numField('nearPremium', 'Near Premium (₹)')}
            {numField('farPremium', 'Far Premium (₹)')}
            {numField('nearIV', 'Near IV')}
            {numField('farIV', 'Far IV')}
          </div>
        )}

        <button className="btn btn-sm btn-primary" onClick={buildResult}>
          Analyse Strategy
        </button>
      </div>
    </div>
  );
}

export default function FnOStrategyEngine() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedUnderlying, setSelectedUnderlying] = useState(UNDERLYINGS[0]);
  const [riskConfig, setRiskConfig] = useState(DEFAULT_RISK);
  const [chain, setChain] = useState(null);
  const [result, setResult] = useState(null);
  const [payoff, setPayoff] = useState(null);
  const [paperTrades, setPaperTrades] = useState(() => getPaperTrades());
  const [auditLog, setAuditLog] = useState(() => getAuditLog());
  const [mode, setMode] = useState('PAPER');

  const underlyings = useMemo(() => UNDERLYINGS.map(u => ({
    ...u, iv: 0.18, pcr: 0.85, oi: 1200000, rsi: 55, changePercent: 0.4,
  })), []);

  function loadChain() {
    const c = getMockOptionChain(selectedUnderlying.symbol, selectedUnderlying.spot);
    setChain(c);
    appendAuditLog({ event: 'OPTION_CHAIN_LOADED', detail: `${selectedUnderlying.symbol} spot=${selectedUnderlying.spot}` });
    setAuditLog(getAuditLog());
  }

  function handleResult(r) {
    setResult(r);
    setPayoff(r.payoff);
    setAuditLog(getAuditLog());
  }

  function handlePaperTrade(r) {
    if (mode === 'LIVE') {
      alert(
        'LIVE MODE: No orders are placed automatically by this application.\n' +
        'This is a signal only. Execute manually via your broker after your own verification.'
      );
      return;
    }
    savePaperTrade({ ...r, mode: 'PAPER', underlying: selectedUnderlying.symbol });
    appendAuditLog({ event: 'PAPER_TRADE_ADDED', detail: `${r.strategy} maxLoss=${r.maxLoss}` });
    setPaperTrades(getPaperTrades());
    setAuditLog(getAuditLog());
  }

  function handleClearPaper() {
    clearPaperTrades();
    setPaperTrades([]);
  }

  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'expiry', label: '⚡ Expiry Surge Radar' },
    { key: 'chain', label: 'Option Chain' },
    { key: 'builder', label: 'Strategy Builder' },
    { key: 'risk', label: 'Risk Config' },
    { key: 'paper', label: `Paper Trades (${paperTrades.length})` },
    { key: 'audit', label: 'Audit Log' },
  ];

  const regime = detectRegime({ rsi: 55, changePercent: 0.4, iv: 0.18, spot: selectedUnderlying.spot });
  const suggested = suggestStrategy(regime);

  return (
    <div className="p-3">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h4 className="mb-0">F&amp;O Defined-Risk Options Engine</h4>
          <div className="small text-muted">NSE India — Controlled-risk strategy analysis</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="small text-muted">Mode:</span>
          <span className={`badge text-bg-${mode === 'PAPER' ? 'info' : 'danger'} fs-6`}>{mode}</span>
          {mode === 'PAPER' ? (
            <button className="btn btn-sm btn-outline-danger" onClick={() => {
              if (window.confirm(
                'Switch to LIVE MODE?\n\nNo orders will be placed automatically.\n' +
                'You must execute manually via your broker.\n\nConfirm?'
              )) setMode('LIVE');
            }}>Switch to LIVE</button>
          ) : (
            <button className="btn btn-sm btn-outline-info" onClick={() => setMode('PAPER')}>
              Back to PAPER
            </button>
          )}
        </div>
      </div>

      <DisclaimerBanner />

      {/* Underlying selector */}
      <div className="d-flex flex-wrap gap-1 mb-3">
        {UNDERLYINGS.map(u => (
          <button key={u.symbol} type="button"
            className={`btn btn-sm ${selectedUnderlying.symbol === u.symbol ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => { setSelectedUnderlying(u); setChain(null); setResult(null); }}>
            {u.symbol} — {fmtRs(u.spot)}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        {tabs.map(t => (
          <li key={t.key} className="nav-item">
            <button
              className={`nav-link ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {/* Expiry Surge Radar */}
      {activeTab === 'expiry' && (
        <ExpirySurgeRadar
          symbol={selectedUnderlying.symbol}
          currentPrice={selectedUnderlying.spot}
        />
      )}

      {/* Dashboard */}
      {activeTab === 'dashboard' && (
        <>
          <MarketOverview underlyings={underlyings} />
          <div className="alert alert-info small mb-3">
            <strong>Suggested strategy for {selectedUnderlying.symbol}: </strong>
            {suggested || 'No clear setup — AVOID'} &nbsp;(regime: {regime})
            <br />
            Capital: {fmtRs(riskConfig.capital)} &nbsp;|&nbsp;
            Allowed risk/trade: {fmtRs(riskConfig.capital * riskConfig.riskPct / 100)} &nbsp;|&nbsp;
            Max daily loss: {fmtRs(riskConfig.maxDailyLoss)}
          </div>
          {result
            ? <StrategyResult result={result} payoff={payoff} riskConfig={riskConfig} onPaperTrade={handlePaperTrade} />
            : <div className="text-muted small">Go to the Strategy Builder tab to analyse a trade setup.</div>
          }
        </>
      )}

      {/* Option Chain */}
      {activeTab === 'chain' && (
        <>
          <div className="mb-2 d-flex align-items-center gap-3">
            <button className="btn btn-sm btn-primary" onClick={loadChain}>
              Load Option Chain — {selectedUnderlying.symbol}
            </button>
            <span className="small text-muted">
              Spot: {fmtRs(selectedUnderlying.spot)} | Lot size: {selectedUnderlying.lotSize}
            </span>
          </div>
          <OptionChainTable chain={chain} />
        </>
      )}

      {/* Strategy Builder */}
      {activeTab === 'builder' && (
        <>
          {!chain && (
            <div className="alert alert-warning small mb-2">
              Load the option chain first for auto-populated strikes and premiums.
              <button className="btn btn-sm btn-warning ms-2" onClick={loadChain}>Load Chain</button>
            </div>
          )}
          <StrategyBuilder
            chain={chain}
            spot={selectedUnderlying.spot}
            lotSize={selectedUnderlying.lotSize}
            riskConfig={riskConfig}
            onResult={handleResult}
          />
          {result && (
            <StrategyResult result={result} payoff={payoff} riskConfig={riskConfig} onPaperTrade={handlePaperTrade} />
          )}
        </>
      )}

      {/* Risk Config */}
      {activeTab === 'risk' && (
        <RiskConfig config={riskConfig} onChange={setRiskConfig} />
      )}

      {/* Paper Trades */}
      {activeTab === 'paper' && (
        <PaperTradesPanel trades={paperTrades} onClear={handleClearPaper} />
      )}

      {/* Audit Log */}
      {activeTab === 'audit' && (
        <AuditLogPanel log={auditLog} />
      )}
    </div>
  );
}
