'use client';

import { MARKET_INTELLIGENCE_TABS } from './marketIntelligence';

export default function TopIntraday({ activeTab, onChange }) {
  const tabs = [
    { key: 'watchfornextday', label: '🔮 Watch For Next Day', isBtst: true, tone: 'gold' },
    { key: 'tomorrow', label: "🎯 Today's Safe Intraday", isBtst: true, tone: 'green' },
    { key: 'nifty50', label: '🇮🇳 NIFTY50 Scanner', isLowRisk: true, tone: 'green' },
    { key: 'reversal-scanner', label: '🔄 Reversal & Support Bounce', isLowRisk: true, tone: 'gold' },
    { key: 'confluence-quant', label: '🧠 Quant Confluence', isLowRisk: true, tone: 'gold' },
    { key: 'dashboard', label: '📊 Market Dashboard', tone: 'neutral' },
    { key: 'scanner', label: '📡 Live Scanner', tone: 'neutral' },
    { key: 'breakouts', label: '🚀 Breakouts', tone: 'green' },
    { key: 'favorites', label: '⭐ Favorites', tone: 'green' },
    { key: 'short-sell', label: '🔻 Short Sell Radar', tone: 'gold' },
    { key: 'seasonal-radar', label: '🗓️ Seasonal Radar', tone: 'gold' },
    { key: 'block-deals', label: '🏢 Block Deals', tone: 'green' },
    { key: 'bigshot-radar', label: '⭐ BigShot Radar', tone: 'gold' },
    { key: 'momentum', label: '⚡ Momentum Scanner', tone: 'green' },
    { key: 'trading-skill-risk', label: '🛡️ Skill & Risk Dashboard', tone: 'gold' },
    { key: 'practice-trading', label: '🎓 Practice Mode', tone: 'gold' },
    { key: 'trading', label: '⚡ Groww Intraday Trading', tone: 'green' },
    { key: 'candlestick-guide', label: '🕯️ Candlestick Guide', tone: 'green' },
    { key: 'stock-bonus-dividend', label: '🎁 Bonus & Dividend', tone: 'neutral' },
    { key: 'mystocks', label: '📁 My Portfolio', tone: 'green' },
  ];

  return (
    <div className="st-tab-strip" role="tablist" aria-label="Stocks tabs">
      {tabs.map(({ key, label, isBtst, isLowRisk, tone = 'neutral' }) => (
        <button
          key={key}
          type="button"
          className={`st-tab-btn st-tab-btn--${tone} ${activeTab === key ? 'active' : ''}`}
          onClick={() => onChange?.(key)}
        >
          <span>{label}</span>
          {isBtst && (
            <span className="btst-badge-blink ms-1.5">
              <span className="btst-dot"></span>
              BTST
            </span>
          )}
          {isLowRisk && (
            <span className="badge bg-success text-white ms-1.5" style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4 }}>
              🛡️ Low Risk
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
