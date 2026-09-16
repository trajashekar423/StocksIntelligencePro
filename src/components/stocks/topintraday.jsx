'use client';

import { useState } from 'react';

export default function TopIntraday({ activeTab, onChange }) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = [
    { key: 'ALL', label: '🔥 All Strategies' },
    { key: 'STRATEGY', label: '🛡️ Safe & Confluence' },
    { key: 'MOMENTUM', label: '⚡ Momentum & Radars' },
    { key: 'PORTFOLIO', label: '📁 Portfolio & Practice' },
  ];

  const tabs = [
    { key: 'tomorrow', label: "🎯 Today's Safe Intraday", isBtst: true, category: 'STRATEGY', tone: 'green' },
    { key: 'watchfornextday', label: '🔮 Watch For Next Day', isBtst: true, category: 'STRATEGY', tone: 'gold' },
    { key: 'reversal-scanner', label: '🔄 Reversal & Bounce', isLowRisk: true, category: 'STRATEGY', tone: 'green' },
    { key: 'confluence-quant', label: '🧠 Quant Confluence', isLowRisk: true, category: 'STRATEGY', tone: 'gold' },
    { key: 'smart-money-smc', label: '🧠 Smart Money (OB/FVG)', isLowRisk: true, category: 'STRATEGY', tone: 'gold' },
    { key: 'nifty50', label: '🇮🇳 NIFTY50 Scanner', isLowRisk: true, category: 'STRATEGY', tone: 'green' },

    { key: 'breakouts', label: '🚀 Breakouts', category: 'MOMENTUM', tone: 'green' },
    { key: 'momentum', label: '⚡ Momentum Scanner', category: 'MOMENTUM', tone: 'green' },
    { key: 'short-sell', label: '🔻 Short Sell Radar', category: 'MOMENTUM', tone: 'gold' },
    { key: 'bigshot-radar', label: '⭐ BigShot Radar (5x)', category: 'MOMENTUM', tone: 'gold' },
    { key: 'block-deals', label: '🏢 Block Deals', category: 'MOMENTUM', tone: 'green' },
    { key: 'seasonal-radar', label: '🗓️ Seasonal Radar', category: 'MOMENTUM', tone: 'gold' },

    { key: 'trading-skill-risk', label: '🛡️ Skill & Risk', category: 'PORTFOLIO', tone: 'gold' },
    { key: 'practice-trading', label: '🎓 Practice Mode', category: 'PORTFOLIO', tone: 'gold' },
    { key: 'dashboard', label: '📊 Market Dashboard', category: 'PORTFOLIO', tone: 'neutral' },
    { key: 'scanner', label: '📡 Live Scanner', category: 'PORTFOLIO', tone: 'neutral' },
    { key: 'favorites', label: '⭐ Favorites', category: 'PORTFOLIO', tone: 'green' },
    { key: 'mystocks', label: '📁 My Portfolio', category: 'PORTFOLIO', tone: 'green' },
    { key: 'candlestick-guide', label: '🕯️ Candlestick Guide', category: 'PORTFOLIO', tone: 'green' },
    { key: 'stock-bonus-dividend', label: '🎁 Bonus & Dividend', category: 'PORTFOLIO', tone: 'neutral' },
  ];

  const filteredTabs = selectedCategory === 'ALL'
    ? tabs
    : tabs.filter((t) => t.category === selectedCategory);

  return (
    <div className="w-100 mb-3">
      {/* Category Pills Header */}
      <div className="d-flex align-items-center gap-1.5 overflow-x-auto pb-2 mb-2 border-bottom">
        {categories.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`btn btn-sm rounded-pill px-3 py-1 text-nowrap fw-semibold transition-all ${
              selectedCategory === key
                ? 'btn-dark shadow-sm text-white'
                : 'btn-light text-secondary border-0'
            }`}
            style={{ fontSize: '0.78rem' }}
            onClick={() => setSelectedCategory(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Tab Strip */}
      <div className="d-flex align-items-center gap-2 overflow-x-auto pb-2" role="tablist" style={{ scrollbarWidth: 'thin' }}>
        {filteredTabs.map(({ key, label, isBtst, isLowRisk, tone = 'neutral' }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              className={`btn btn-sm rounded-pill px-3 py-1.5 text-nowrap d-flex align-items-center gap-1.5 fw-bold transition-all ${
                isActive
                  ? 'btn-primary shadow text-white'
                  : 'btn-outline-secondary bg-white text-dark border'
              }`}
              style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
              onClick={() => onChange?.(key)}
            >
              <span>{label}</span>
              {isBtst && (
                <span className="badge bg-warning text-dark border ms-1" style={{ fontSize: '0.62rem', padding: '2px 5px' }}>
                  BTST
                </span>
              )}
              {isLowRisk && (
                <span className="badge bg-success-subtle text-success border border-success-subtle ms-1" style={{ fontSize: '0.62rem', padding: '2px 5px' }}>
                  🛡️ Safe
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
