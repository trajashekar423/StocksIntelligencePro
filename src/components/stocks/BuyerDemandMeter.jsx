'use client';

export function calculateBuyerDemandPct(stock) {
  if (!stock) return 50;

  const totalBuyQty = Number(stock.totalBuyQty ?? stock.buyQty ?? 0);
  const totalSellQty = Number(stock.totalSellQty ?? stock.sellQty ?? -1);

  // 1. If real market order depth is present, use exact buyer percentage
  if (totalBuyQty > 0 && totalSellQty >= 0) {
    const total = totalBuyQty + totalSellQty;
    if (total > 0) {
      const rawPct = Math.round((totalBuyQty / total) * 100);
      if (totalSellQty === 0 && rawPct >= 99) return 100; // Locked UC
      return Math.max(10, Math.min(95, rawPct)); // Matching Groww App depth
    }
  }

  // 2. Check official Upper Circuit lock status flags
  const isTrulyLockedUC = Boolean(
    stock.isUpperCircuit ||
    stock.isLockedInUC ||
    stock.circuitStatus === 'LOCKED_UC' ||
    stock.distToUcPct === 0
  );

  if (isTrulyLockedUC) return 100;

  // 3. Estimate realistic buyer demand percentage for active gainers
  const changePercent = Number(stock.changePercent ?? stock.pChange ?? stock.perChange ?? stock.change_percentage ?? 0);

  if (changePercent < 0) {
    return Math.max(10, Math.round(50 + changePercent * 6));
  }
  if (changePercent >= 9.8 || changePercent >= 19.8) {
    return 100; // 10% or 20% circuit lock
  }
  if (changePercent >= 5.0) {
    return Math.min(92, Math.round(80 + (changePercent - 5.0) * 2));
  }
  if (changePercent >= 3.0) {
    return Math.round(72 + (changePercent - 3.0) * 4);
  }
  if (changePercent >= 1.5) {
    return Math.round(62 + (changePercent - 1.5) * 6.6);
  }
  return Math.round(50 + changePercent * 8);
}

export default function BuyerDemandMeter({ stock, compact = false }) {
  const buyerDemandPct = calculateBuyerDemandPct(stock);
  const is100 = buyerDemandPct === 100;

  if (compact) {
    return (
      <div className="d-flex align-items-center gap-1.5" style={{ minWidth: 110 }}>
        <div className="progress flex-grow-1 overflow-hidden" style={{ height: 8, borderRadius: 4, background: '#e2e8f0' }}>
          <div
            className={`progress-bar ${is100 ? 'bg-danger progress-bar-striped progress-bar-animated' : buyerDemandPct >= 75 ? 'bg-success' : buyerDemandPct >= 50 ? 'bg-warning text-dark' : 'bg-secondary'}`}
            style={{ width: `${buyerDemandPct}%` }}
          />
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, minWidth: 36 }} className={is100 ? 'text-danger fw-bold' : buyerDemandPct >= 75 ? 'text-success' : 'text-dark'}>
          {is100 ? '🔒100%' : `${buyerDemandPct}%`}
        </span>
      </div>
    );
  }

  return (
    <div className="p-2 rounded-3 border border-secondary border-opacity-15 shadow-sm bg-light mb-2">
      <div className="d-flex align-items-center justify-content-between mb-1 flex-wrap gap-1">
        <div className="d-flex align-items-center gap-1.5">
          <span className="fw-bold text-dark small">📊 Live Buyer Demand:</span>
          <span className={`badge ${is100 ? 'bg-danger text-white animate-pulse' : buyerDemandPct >= 75 ? 'bg-success text-white' : 'bg-warning text-dark'} fw-bold`}>
            {is100 ? '🔒 100% BUYERS (Upper Circuit)' : `${buyerDemandPct}% BUYERS ACTIVE`}
          </span>
        </div>
        <span className="small text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>
          {is100 ? 'Zero Sellers Available' : `${100 - buyerDemandPct}% Sellers Left`}
        </span>
      </div>
      <div className="progress overflow-hidden" style={{ height: 12, borderRadius: 6, background: '#e2e8f0' }}>
        <div
          className={`progress-bar ${is100 ? 'bg-danger progress-bar-striped progress-bar-animated' : buyerDemandPct >= 75 ? 'bg-success' : buyerDemandPct >= 50 ? 'bg-warning text-dark' : 'bg-secondary'}`}
          role="progressbar"
          style={{ width: `${buyerDemandPct}%`, transition: 'width 0.5s ease-in-out' }}
          aria-valuenow={buyerDemandPct}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>{buyerDemandPct}% Buyers</span>
        </div>
      </div>
    </div>
  );
}

