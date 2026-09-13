'use client';

import React, { useState, useMemo } from 'react';
import { calculateDailyProfitPlan } from '../../services/risk/dailyProfitPlannerEngine';

export default function DailyProfitCalculatorModal({
  show = false,
  onClose = () => {},
  initialStockPrice = 450,
  initialSymbol = 'STOCK'
}) {
  const [targetProfit, setTargetProfit] = useState(5000);
  const [stockPrice, setStockPrice] = useState(initialStockPrice || 450);
  const [expectedMovePct, setExpectedMovePct] = useState(1.5);
  const [tradesPerDay, setTradesPerDay] = useState(1);
  const [riskRewardRatio, setRiskRewardRatio] = useState(2);
  const [leverage, setLeverage] = useState(5);

  // Sync initial price if changed
  React.useEffect(() => {
    if (initialStockPrice > 0) {
      setStockPrice(initialStockPrice);
    }
  }, [initialStockPrice]);

  const plan = useMemo(() => {
    return calculateDailyProfitPlan({
      targetProfit: Number(targetProfit) || 1000,
      stockPrice: Number(stockPrice) || 100,
      expectedMovePct: Number(expectedMovePct) || 1.5,
      tradesPerDay: Number(tradesPerDay) || 1,
      riskRewardRatio: Number(riskRewardRatio) || 2,
      leverageMultiplier: Number(leverage) || 5
    });
  }, [targetProfit, stockPrice, expectedMovePct, tradesPerDay, riskRewardRatio, leverage]);

  if (!show) return null;

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1080 }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden bg-white">
          
          {/* Header */}
          <div className="modal-header bg-dark text-white px-4 py-3 border-0 d-flex justify-content-between align-items-center">
            <div className="d-flex items-center gap-2">
              <span className="fs-4">🎯</span>
              <div>
                <h5 className="modal-title fw-bold mb-0 text-white">Daily Profit & Position Size Planner</h5>
                <p className="text-light text-opacity-75 small mb-0">
                  Target calculation for <span className="badge bg-primary px-2 py-0.5">{initialSymbol}</span> @ ₹{stockPrice}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body p-4 space-y-4">

            {/* Quick Preset Buttons */}
            <div>
              <label className="form-label text-uppercase fw-bold text-muted small mb-2">
                ⚡ Quick Daily Target Preset
              </label>
              <div className="d-flex flex-wrap gap-2">
                {[1000, 2500, 5000, 10000].map((tgt) => (
                  <button
                    key={tgt}
                    type="button"
                    onClick={() => setTargetProfit(tgt)}
                    className={`btn btn-sm px-3 py-1.5 rounded-3 fw-bold transition ${
                      targetProfit === tgt
                        ? 'btn-success text-white shadow-sm'
                        : 'btn-outline-secondary'
                    }`}
                  >
                    🎯 ₹{tgt.toLocaleString()} / Day
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="row g-3 bg-light p-3 rounded-3 border">
              {/* Target Profit Input */}
              <div className="col-md-4">
                <label className="form-label fw-bold text-dark small mb-1">
                  💰 Target Daily Profit (₹)
                </label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white fw-bold">₹</span>
                  <input
                    type="number"
                    className="form-control fw-bold text-success"
                    value={targetProfit}
                    onChange={(e) => setTargetProfit(Number(e.target.value))}
                    min="100"
                    step="500"
                  />
                </div>
              </div>

              {/* Stock Entry Price */}
              <div className="col-md-4">
                <label className="form-label fw-bold text-dark small mb-1">
                  📈 Stock Entry Price (₹)
                </label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white fw-bold">₹</span>
                  <input
                    type="number"
                    className="form-control fw-bold"
                    value={stockPrice}
                    onChange={(e) => setStockPrice(Number(e.target.value))}
                    min="1"
                    step="1"
                  />
                </div>
              </div>

              {/* Expected Move % */}
              <div className="col-md-4">
                <label className="form-label fw-bold text-dark small mb-1">
                  🚀 Expected Target Move (%)
                </label>
                <div className="input-group input-group-sm">
                  <input
                    type="number"
                    className="form-control fw-bold"
                    value={expectedMovePct}
                    onChange={(e) => setExpectedMovePct(Number(e.target.value))}
                    min="0.2"
                    max="10"
                    step="0.1"
                  />
                  <span className="input-group-text bg-white fw-bold">%</span>
                </div>
              </div>

              {/* Trades Split */}
              <div className="col-md-6">
                <label className="form-label fw-bold text-dark small mb-1">
                  📊 Split Across Trades
                </label>
                <select
                  className="form-select form-select-sm fw-semibold"
                  value={tradesPerDay}
                  onChange={(e) => setTradesPerDay(Number(e.target.value))}
                >
                  <option value={1}>1 Single Trade (Full ₹{targetProfit.toLocaleString()} Target)</option>
                  <option value={2}>2 Trades (₹{(targetProfit / 2).toLocaleString()} per trade - Lower Risk)</option>
                  <option value={3}>3 Trades (₹{(targetProfit / 3).toFixed(0)} per trade - Safe Strategy)</option>
                </select>
              </div>

              {/* Intraday Leverage */}
              <div className="col-md-6">
                <label className="form-label fw-bold text-dark small mb-1">
                  ⚡ Broker Intraday Margin Leverage
                </label>
                <select
                  className="form-select form-select-sm fw-semibold"
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                >
                  <option value={5}>5x MIS Leverage (NSE Standard)</option>
                  <option value={1}>1x Cash / Full Capital (No Leverage)</option>
                </select>
              </div>
            </div>

            {/* RESULTS DASHBOARD */}
            <div className="card border-0 bg-dark text-white rounded-3 p-3 shadow-sm">
              <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-secondary">
                <span className="fw-bold text-uppercase tracking-wider small text-success">
                  📋 Required Order Execution
                </span>
                <span className={`badge ${
                  plan.feasibilityRating === 'REALISTIC' ? 'bg-success' : plan.feasibilityRating === 'MODERATE' ? 'bg-warning text-dark' : 'bg-danger'
                } px-2.5 py-1 text-uppercase fw-bold`}>
                  {plan.feasibilityRating === 'REALISTIC' ? '🟢 High Feasibility' : plan.feasibilityRating === 'MODERATE' ? '🟡 Moderate Target' : '🔴 High Volatility Required'}
                </span>
              </div>

              <div className="row g-3 text-center">
                {/* SHARES TO BUY */}
                <div className="col-6 col-md-3">
                  <div className="p-2.5 rounded bg-secondary bg-opacity-25 border border-secondary border-opacity-50">
                    <span className="small text-light text-opacity-75 d-block">BUY QUANTITY</span>
                    <span className="fs-3 fw-bolder text-warning">
                      {plan.quantityPerTrade} <span className="fs-6 fw-normal text-light">shares</span>
                    </span>
                    <span className="d-block text-muted text-opacity-75 font-monospace" style={{ fontSize: '10px' }}>
                      {tradesPerDay > 1 ? `(${plan.requiredQuantityTotal} total in ${tradesPerDay} trades)` : 'Single trade execution'}
                    </span>
                  </div>
                </div>

                {/* MARGIN REQUIRED */}
                <div className="col-6 col-md-3">
                  <div className="p-2.5 rounded bg-secondary bg-opacity-25 border border-secondary border-opacity-50">
                    <span className="small text-light text-opacity-75 d-block">5x MARGIN NEEDED</span>
                    <span className="fs-3 fw-bolder text-info">
                      ₹{plan.marginPerTrade5x.toLocaleString()}
                    </span>
                    <span className="d-block text-muted text-opacity-75 font-monospace" style={{ fontSize: '10px' }}>
                      (Full Capital: ₹{plan.tradeBreakdown[0]?.capitalRequired.toLocaleString()})
                    </span>
                  </div>
                </div>

                {/* TARGET EXIT PRICE */}
                <div className="col-6 col-md-3">
                  <div className="p-2.5 rounded bg-success bg-opacity-20 border border-success border-opacity-50">
                    <span className="small text-success text-opacity-90 d-block">TARGET EXIT PRICE</span>
                    <span className="fs-3 fw-bolder text-success">
                      ₹{plan.targetPrice}
                    </span>
                    <span className="d-block text-success text-opacity-75 font-monospace" style={{ fontSize: '10px' }}>
                      (+₹{plan.requiredMovePerShare} / +{plan.requiredMovePct}%)
                    </span>
                  </div>
                </div>

                {/* STOP LOSS PRICE */}
                <div className="col-6 col-md-3">
                  <div className="p-2.5 rounded bg-danger bg-opacity-20 border border-danger border-opacity-50">
                    <span className="small text-danger text-opacity-90 d-block">STOP LOSS (1:2 R:R)</span>
                    <span className="fs-3 fw-bolder text-danger">
                      ₹{plan.stopLossPrice}
                    </span>
                    <span className="d-block text-danger text-opacity-75 font-monospace" style={{ fontSize: '10px' }}>
                      (Max Risk: ₹{plan.tradeBreakdown[0]?.maxRiskThisTrade})
                    </span>
                  </div>
                </div>
              </div>

              {/* Feasibility rationale */}
              <div className="mt-3 p-2 bg-secondary bg-opacity-20 rounded border border-secondary border-opacity-30 text-start">
                <span className="small text-light">
                  💡 <strong>Pro Tip:</strong> {plan.feasibilityReason}
                </span>
              </div>
            </div>

            {/* SPLIT TRADES TABLE */}
            {tradesPerDay > 1 && (
              <div>
                <h6 className="fw-bold text-dark mb-2">📋 Multi-Trade Execution Roadmap</h6>
                <div className="table-responsive">
                  <table className="table table-sm table-bordered align-middle text-center small mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Trade #</th>
                        <th>Target Profit</th>
                        <th>Buy Quantity</th>
                        <th>5x Margin Needed</th>
                        <th>Max Risk Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.tradeBreakdown.map((tb) => (
                        <tr key={tb.tradeNumber}>
                          <td className="fw-bold">Trade {tb.tradeNumber}</td>
                          <td className="fw-bold text-success">₹{tb.targetProfitThisTrade}</td>
                          <td className="fw-bold text-primary">{tb.quantity} shares</td>
                          <td className="fw-bold">₹{tb.marginRequired5x.toLocaleString()}</td>
                          <td className="text-danger fw-semibold">₹{tb.maxRiskThisTrade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="modal-footer bg-light px-4 py-3 border-top d-flex justify-content-between align-items-center">
            <span className="small text-muted">
              🛡️ Based on 2-Candle Gate & 4-TF Alignment Strategy
            </span>
            <button
              type="button"
              className="btn btn-dark btn-sm px-4 rounded-3 fw-bold"
              onClick={onClose}
            >
              Done / Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

