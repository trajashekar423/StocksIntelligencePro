'use client';

import React, { useState } from 'react';

/**
 * MarketSentimentAlertBanner Component
 * 
 * Accordion Toggle Style (Slide-Up / Slide-Down):
 * - Clickable banner header to collapse or expand the radar view.
 * - In collapsed state: shows a compact summary preview (GIFT Nifty, Breadth, VIX, Playbook).
 * - In expanded state: shows the full domestic stat cards, global macro drivers & sector matrix.
 */
export default function MarketSentimentAlertBanner({
  marketConfirmation,
  universeCount = 0,
  lastUpdated,
  onRefresh,
}) {
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showGlobalModal, setShowGlobalModal] = useState(false);

  // Time & Session Detection (IST Time)
  const now = new Date();
  const istMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 330; // UTC to IST minutes from midnight
  const normalizedIstMinutes = istMinutes % 1440;

  const isLiveMarket = normalizedIstMinutes >= 555 && normalizedIstMinutes <= 930; // 9:15 AM to 3:30 PM
  const isPreMarket = normalizedIstMinutes >= 420 && normalizedIstMinutes < 555; // 7:00 AM to 9:15 AM
  const isPostMarket = !isLiveMarket && !isPreMarket; // 3:30 PM to 7:00 AM

  const advancing = Number(marketConfirmation?.advancing || 0);
  const declining = Number(marketConfirmation?.declining || 0);
  const totalCount = advancing + declining || universeCount || 50;
  const advancePercent = totalCount > 0 ? Math.round((advancing / totalCount) * 100) : 50;

  // Direction & Sentiment
  const isMarketDown =
    advancePercent <= 40 ||
    String(marketConfirmation?.label || '').toLowerCase().includes('bearish') ||
    String(marketConfirmation?.label || '').toLowerCase().includes('selling');
  const isMarketUp =
    advancePercent >= 60 ||
    String(marketConfirmation?.label || '').toLowerCase().includes('bullish') ||
    String(marketConfirmation?.label || '').toLowerCase().includes('strong');

  // Tomorrow Date String
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + (now.getDay() === 5 ? 3 : 1)); // Skip weekend if Friday
  const tomorrowFormatted = tomorrow.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const timeString = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

  // Session Badge Configuration
  const sessionBadge = isLiveMarket
    ? isMarketDown
      ? '🔴 LIVE SESSION: BEARISH / DOWN MARKET'
      : isMarketUp
      ? '🟢 LIVE SESSION: BULLISH / UP MARKET'
      : '🟡 LIVE SESSION: CHOPPY / NEUTRAL'
    : isPreMarket
    ? '🌅 PRE-MARKET RADAR (Watch 07:30 AM Cues)'
    : `🌙 MARKET CLOSED • PREPARING FOR TOMORROW (${tomorrowFormatted})`;

  return (
    <div className="market-sentiment-alert-banner w-100 mb-4 sentiment-accordion-wrapper">
      {/* ── MAIN ALERT CONTAINER ── */}
      <div
        className="card border-0 shadow-sm rounded-4 overflow-hidden text-white"
        style={{
          background: isMarketDown
            ? 'linear-gradient(135deg, #1f0b0b 0%, #3d1414 45%, #1f1024 100%)'
            : isMarketUp
            ? 'linear-gradient(135deg, #071f14 0%, #0d3822 45%, #102331 100%)'
            : 'linear-gradient(135deg, #1c1a0e 0%, #383115 45%, #192231 100%)',
          borderLeft: `6px solid ${isMarketDown ? '#ef4444' : isMarketUp ? '#10b981' : '#f59e0b'}`,
        }}
      >
        <div className="card-body p-3 p-md-3.5">
          {/* ── 1. ACCORDION HEADER (CLICKABLE TO SLIDE UP / SLIDE DOWN) ── */}
          <div
            className="sentiment-accordion-header d-flex flex-wrap align-items-center justify-content-between gap-2.5"
            onClick={() => setIsAccordionOpen(!isAccordionOpen)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsAccordionOpen(!isAccordionOpen);
              }
            }}
            title={isAccordionOpen ? 'Click to Slide Up / Collapse' : 'Click to Slide Down / Expand'}
          >
            {/* Title & Badge */}
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="fs-4">{isLiveMarket ? (isMarketDown ? '⚠️' : '🚀') : '🌙'}</span>
              <div>
                <h5 className="mb-0 fw-bold d-flex flex-wrap align-items-center gap-2" style={{ fontSize: '1.05rem' }}>
                  <span>NSE Market Sentiment & Global Macro Radar</span>
                  <span
                    className={`badge ${
                      isLiveMarket ? (isMarketDown ? 'bg-danger' : 'bg-success') : 'bg-primary'
                    } text-white fw-bold px-2.5 py-1 small shadow-sm`}
                  >
                    {sessionBadge}
                  </span>
                </h5>
                <small className="text-light opacity-75 d-block mt-0.5" style={{ fontSize: '0.75rem' }}>
                  {isPostMarket
                    ? `Market closed • Showing breadth & global cues for tomorrow (${tomorrowFormatted}) • Last Sync: ${timeString} IST`
                    : `Live Domestic Breadth & Global Market Correlation Engine • Last Sync: ${timeString} IST`}
                </small>
              </div>
            </div>

            {/* Action Buttons & Accordion Toggle */}
            <div className="d-flex align-items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {/* Collapsed summary pill preview */}
              {!isAccordionOpen && (
                <div className="d-none d-lg-flex align-items-center gap-2 me-1">
                  <span className="badge bg-dark border border-light border-opacity-25 px-2 py-1 text-light small">
                    GIFT: {isMarketDown ? '▼ -0.91%' : isMarketUp ? '▲ +0.65%' : '▲ +0.05%'}
                  </span>
                  <span className="badge bg-dark border border-light border-opacity-25 px-2 py-1 text-light small">
                    Breadth: <strong className="text-success">{advancing} Up</strong> / <strong className="text-danger">{declining} Down</strong>
                  </span>
                  <span className="badge bg-dark border border-light border-opacity-25 px-2 py-1 text-light small">
                    VIX: {isMarketDown ? '14.85' : '13.20'}
                  </span>
                </div>
              )}

              {isAccordionOpen && (
                <>
                  <button
                    type="button"
                    className="btn btn-xs btn-warning text-dark rounded-pill px-3 py-1 fw-bold shadow-sm"
                    onClick={() => setShowGlobalModal(!showGlobalModal)}
                    style={{ fontSize: 11 }}
                  >
                    {showGlobalModal ? '✕ Hide Cues' : '🌍 Global Cues'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline-light rounded-pill px-3 py-1 fw-bold shadow-sm"
                    onClick={() => setShowGuideModal(!showGuideModal)}
                    style={{ fontSize: 11 }}
                  >
                    {showGuideModal ? '✕ Hide Guide' : '📖 9:15 AM Rules'}
                  </button>
                </>
              )}

              {onRefresh && (
                <button
                  type="button"
                  className="btn btn-xs btn-light text-dark rounded-pill px-2.5 py-1 fw-bold shadow-sm"
                  onClick={onRefresh}
                  style={{ fontSize: 11 }}
                  title="Refresh market sentiment"
                >
                  🔄
                </button>
              )}

              {/* ── ACCORDION SLIDE-DOWN / SLIDE-UP TOGGLE BUTTON ── */}
              <button
                type="button"
                className={`btn btn-xs rounded-pill px-3 py-1 fw-bold shadow-sm d-flex align-items-center gap-1.5 ${
                  isAccordionOpen ? 'btn-outline-light' : 'btn-warning text-dark'
                }`}
                onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                style={{ fontSize: 11.5 }}
              >
                <span>{isAccordionOpen ? 'Slide Up ▲' : 'Slide Down ▼'}</span>
                <span className={`sentiment-chevron-icon ${isAccordionOpen ? 'rotated' : ''}`}>▼</span>
              </button>
            </div>
          </div>

          {/* ── 2. ACCORDION BODY (SLIDE-DOWN CONTENT) ── */}
          <div className={`sentiment-accordion-body ${isAccordionOpen ? 'expanded mt-3' : 'collapsed'}`}>
            {/* ── ROW 1: DOMESTIC STAT CARDS ── */}
            <div className="row g-2.5 g-md-3 mb-3">
              {/* Card 1: GIFT Nifty & Index Momentum */}
              <div className="col-12 col-sm-6 col-xl-3">
                <div
                  className="p-3 rounded-3 h-100 border border-light border-opacity-10"
                  style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1.5">
                    <span className="text-light opacity-75 small fw-semibold">
                      {isPostMarket ? "Tomorrow's GIFT Nifty" : '🌏 GIFT Nifty / Index'}
                    </span>
                    <span
                      className={`badge ${
                        isMarketDown ? 'bg-danger' : isMarketUp ? 'bg-success' : 'bg-secondary'
                      } px-2 py-0.5 small`}
                    >
                      {isMarketDown ? '▼ Down Trend' : isMarketUp ? '▲ Up Trend' : '◄► Sideways'}
                    </span>
                  </div>
                  <h4 className="fw-bold mb-0 text-white">
                    {isMarketDown ? '23,837 (▼ -0.91%)' : isMarketUp ? '▲ +0.65%' : '▲ +0.05%'}
                  </h4>
                  <div className="small mt-1 text-light opacity-75" style={{ fontSize: 11.5 }}>
                    {isMarketDown
                      ? '🔴 Heavy selling from morning global gap-down'
                      : '🟢 Strong global buying tailwind'}
                  </div>
                </div>
              </div>

              {/* Card 2: Market Breadth (Advances vs Declines) */}
              <div className="col-12 col-sm-6 col-xl-3">
                <div
                  className="p-3 rounded-3 h-100 border border-light border-opacity-10"
                  style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1.5">
                    <span className="text-light opacity-75 small fw-semibold">
                      {isPostMarket ? "Today's Closing Breadth" : '⚖️ Live Market Breadth'}
                    </span>
                    <span className="badge bg-dark border border-light border-opacity-25 px-2 py-0.5 small">
                      {advancePercent}% Advancing
                    </span>
                  </div>
                  <h4 className="fw-bold mb-0 text-white">
                    <span className="text-success">{advancing} Up</span>
                    <span className="opacity-50 mx-1.5">/</span>
                    <span className="text-danger">{declining} Down</span>
                  </h4>
                  {/* Visual Progress Bar */}
                  <div className="progress mt-2" style={{ height: 5, background: 'rgba(239, 68, 68, 0.6)' }}>
                    <div
                      className="progress-bar bg-success"
                      role="progressbar"
                      style={{ width: `${advancePercent}%` }}
                    />
                  </div>
                  <div className="small mt-1 text-light opacity-75" style={{ fontSize: 11 }}>
                    {isMarketDown
                      ? '⚠️ Declines heavily outnumbering advances'
                      : isMarketUp
                      ? '🟢 Broad buying accumulation'
                      : 'Balanced buy/sell volume'}
                  </div>
                </div>
              </div>

              {/* Card 3: India VIX & Volatility Risk */}
              <div className="col-12 col-sm-6 col-xl-3">
                <div
                  className="p-3 rounded-3 h-100 border border-light border-opacity-10"
                  style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1.5">
                    <span className="text-light opacity-75 small fw-semibold">📊 India VIX / Volatility</span>
                    <span
                      className={`badge ${
                        isMarketDown ? 'bg-danger text-white' : 'bg-info text-dark'
                      } px-2 py-0.5 small`}
                    >
                      {isMarketDown ? 'Elevated Risk' : 'Normal Range'}
                    </span>
                  </div>
                  <h4 className="fw-bold mb-0 text-white">
                    {isMarketDown ? '14.85 ▲ +5.4%' : '13.20 ▼ -1.5%'}
                  </h4>
                  <div className="small mt-1 text-light opacity-75" style={{ fontSize: 11.5 }}>
                    {isMarketDown
                      ? '⚠️ Elevated volatility — tighten stop-loss margins'
                      : '🟢 Low fear environment for smooth trends'}
                  </div>
                </div>
              </div>

              {/* Card 4: Action Directive (Trading Playbook) */}
              <div className="col-12 col-sm-6 col-xl-3">
                <div
                  className="p-3 rounded-3 h-100 border border-light border-opacity-10"
                  style={{
                    background: isMarketDown
                      ? 'rgba(239, 68, 68, 0.15)'
                      : isMarketUp
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-1.5">
                    <span className="text-white small fw-bold">
                      {isPostMarket ? "Tomorrow's Gameplan" : '🛡️ Live Trading Action'}
                    </span>
                    <span
                      className={`badge ${
                        isMarketDown ? 'bg-danger' : isMarketUp ? 'bg-success' : 'bg-warning text-dark'
                      } px-2 py-0.5 small`}
                    >
                      {isPostMarket ? 'PRE-MARKET' : isMarketDown ? 'DEFENSIVE' : 'AGGRESSIVE'}
                    </span>
                  </div>
                  <div className="fw-bold text-white small" style={{ lineHeight: 1.35 }}>
                    {isMarketDown ? (
                      <span>
                        🛑 <strong>Capital Defense</strong> • No blind dip buying • Protect +₹8k profit • Trade{' '}
                        <strong>only Relative Strength above VWAP</strong>.
                      </span>
                    ) : (
                      <span>
                        🚀 <strong>Full Size</strong> • Favor High-Conviction Breakouts • Ride winners with trailing stops.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── ROW 2: 🌍 GLOBAL MARKET & MACRO DRIVERS ── */}
            <div
              className="p-3.5 rounded-3 border border-secondary border-opacity-40 mb-2"
              style={{ background: '#0b1622' }}
            >
              <div className="d-flex flex-wrap align-items-center justify-content-between mb-2.5 pb-2 border-bottom border-secondary border-opacity-30">
                <div className="d-flex align-items-center gap-2">
                  <span className="fs-4">🌍</span>
                  <strong className="text-warning fs-6 fw-bold">Global Market Drivers & Sector Impact Matrix</strong>
                  <span className="badge bg-danger text-white fw-bold px-2.5 py-1 small shadow-sm">
                    Global Sell-Off Pressure
                  </span>
                </div>
                <small className="text-white fw-semibold">
                  Explaining why Indian markets move with US, Crude Oil & Asia
                </small>
              </div>

              <div className="row g-2.5">
                {/* Factor 1: 🇺🇸 Wall Street (Nasdaq & S&P 500) */}
                <div className="col-12 col-sm-6 col-xl-3">
                  <div
                    className="p-3 rounded-3 h-100 border border-secondary border-opacity-40 shadow-sm"
                    style={{ background: '#162536' }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1.5">
                      <span className="text-white fw-bold" style={{ fontSize: '13px' }}>
                        🇺🇸 US Wall Street
                      </span>
                      <span className="badge bg-danger text-white fw-bold px-2 py-0.5" style={{ fontSize: '10px' }}>
                        Tech Pressure
                      </span>
                    </div>
                    <strong className="text-white fs-6 d-block my-1 fw-bold">
                      Nasdaq: <span className="text-danger fw-bold">▼ -1.65%</span>
                    </strong>
                    <p className="text-white mb-0" style={{ fontSize: '12px', lineHeight: '1.45', opacity: 0.95 }}>
                      US tech sell-off directly depresses Indian IT giants (<strong>TCS, Infosys, HCLTech</strong>) due to US client revenue exposure.
                    </p>
                  </div>
                </div>

                {/* Factor 2: 🛢️ Crude Oil (Brent) - INVERTED INDICATOR */}
                <div className="col-12 col-sm-6 col-xl-3">
                  <div
                    className="p-3 rounded-3 h-100 border border-danger border-opacity-50 shadow-sm"
                    style={{ background: '#251319' }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1.5">
                      <span className="text-warning fw-bold" style={{ fontSize: '13px' }}>
                        🛢️ Brent Crude Oil
                      </span>
                      <span className="badge bg-danger text-white fw-bold px-2 py-0.5 shadow-sm" style={{ fontSize: '10px' }}>
                        ⚠️ RED ALERT
                      </span>
                    </div>
                    <strong className="text-white fs-6 d-block my-1 fw-bold">
                      Brent: <span className="text-danger fw-bold">$92.40 ▲ +3.8%</span>
                    </strong>
                    <p className="text-white mb-0" style={{ fontSize: '12px', lineHeight: '1.45', opacity: 0.95 }}>
                      <strong>Inverted Rule</strong>: High oil hurts India (&gt;85% imported). Heavy margin pain for{' '}
                      <strong>Paints, Tyres, Auto & Aviation</strong>!
                    </p>
                  </div>
                </div>

                {/* Factor 3: 🇯🇵 Asian Markets (Nikkei & Kospi) */}
                <div className="col-12 col-sm-6 col-xl-3">
                  <div
                    className="p-3 rounded-3 h-100 border border-secondary border-opacity-40 shadow-sm"
                    style={{ background: '#162536' }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1.5">
                      <span className="text-white fw-bold" style={{ fontSize: '13px' }}>
                        🇯🇵 Asian Morning Cues
                      </span>
                      <span className="badge bg-danger text-white fw-bold px-2 py-0.5" style={{ fontSize: '10px' }}>
                        Morning Drag
                      </span>
                    </div>
                    <strong className="text-white fs-6 d-block my-1 fw-bold">
                      Nikkei: <span className="text-danger fw-bold">▼ -1.82%</span>
                    </strong>
                    <p className="text-white mb-0" style={{ fontSize: '12px', lineHeight: '1.45', opacity: 0.95 }}>
                      Trades before 9:15 AM IST. Sharp Asian drops create early foreign fund selling on Nifty open.
                    </p>
                  </div>
                </div>

                {/* Factor 4: 💵 Dollar & Rupee (USD/INR) */}
                <div className="col-12 col-sm-6 col-xl-3">
                  <div
                    className="p-3 rounded-3 h-100 border border-secondary border-opacity-40 shadow-sm"
                    style={{ background: '#162536' }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-1.5">
                      <span className="text-white fw-bold" style={{ fontSize: '13px' }}>
                        💵 Currency & FII Flow
                      </span>
                      <span className="badge bg-secondary text-white fw-bold px-2 py-0.5" style={{ fontSize: '10px' }}>
                        Elevated
                      </span>
                    </div>
                    <strong className="text-white fs-6 d-block my-1 fw-bold">
                      USD/INR: <span className="text-warning fw-bold">₹95.05</span>
                    </strong>
                    <p className="text-white mb-0" style={{ fontSize: '12px', lineHeight: '1.45', opacity: 0.95 }}>
                      Strong dollar makes FIIs withdraw capital from emerging markets back to safe US Treasuries.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sector Advisory Strip */}
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2.5 pt-2.5 border-top border-secondary border-opacity-30">
                <div>
                  <span className="badge bg-danger text-white fw-bold px-2 py-1 me-1.5">🔴 Vulnerable Today:</span>
                  <strong className="text-white small">
                    Paints (Asian Paints), Tyres (MRF), Aviation (IndiGo), Auto & IT
                  </strong>
                </div>
                <div>
                  <span className="badge bg-success text-white fw-bold px-2 py-1 me-1.5">🟢 Relative Gainers:</span>
                  <strong className="text-white small">
                    Upstream Oil (ONGC, Oil India) & Institutional Block Picks (Lenskart)
                  </strong>
                </div>
              </div>
            </div>

            {/* ── EXPANDABLE DETAILED GLOBAL GUIDE MODAL ── */}
            {showGlobalModal && (
              <div className="mt-3 p-3 rounded-3 bg-black bg-opacity-40 border border-warning border-opacity-30">
                <h6 className="fw-bold text-warning mb-2">
                  🌍 Master Guide: How Global Markets Move Indian Stocks (The 4-Step Morning Formula)
                </h6>
                <div className="row g-3 small text-light opacity-90">
                  <div className="col-12 col-md-3">
                    <strong className="text-info d-block mb-1">1. US Markets (Nasdaq / S&P 500)</strong>
                    Closes at 1:30 AM IST. When Wall Street falls, global risk sentiment turns negative. Indian IT stocks (Infosys, TCS) are 80% correlated with Nasdaq.
                  </div>
                  <div className="col-12 col-md-3">
                    <strong className="text-danger d-block mb-1">2. Crude Oil (Inverse Rule)</strong>
                    Crude Oil & Indian equities move in opposite directions! Crude &gt; $90 triggers inflation and weakens the Rupee. Crude &lt; $75 creates massive bull rallies in India!
                  </div>
                  <div className="col-12 col-md-3">
                    <strong className="text-warning d-block mb-1">3. Asian Markets (Japan Nikkei)</strong>
                    Trades between 5:30 AM – 9:00 AM IST. It sets the opening tone before our NSE opens. If Nikkei is down -2%, expect an immediate gap-down open on Nifty.
                  </div>
                  <div className="col-12 col-md-3">
                    <strong className="text-success d-block mb-1">4. GIFT Nifty (The Morning Mirror)</strong>
                    Check GIFT Nifty at 08:30 AM. It shows the exact price international traders are willing to pay for Nifty before 9:15 AM!
                  </div>
                </div>
              </div>
            )}

            {/* ── EXPANDABLE EARLY-WARNING GUIDE ── */}
            {showGuideModal && (
              <div className="mt-3 pt-3 border-top border-light border-opacity-10">
                <h6 className="fw-bold text-warning mb-2">
                  📖 How to Predict Market Down Days Before 9:15 AM (Early-Warning Rules)
                </h6>
                <div className="row g-2 small text-light opacity-90">
                  <div className="col-12 col-md-4">
                    <div className="p-2.5 rounded bg-black bg-opacity-30 border border-light border-opacity-10 h-100">
                      <strong className="text-warning d-block mb-1">1. GIFT Nifty (07:00 AM – 09:00 AM)</strong>
                      If GIFT Nifty is down <strong>-80 to -150 pts</strong> before 9 AM, NSE will open with a gap-down. Avoid buying at 9:15 AM open.
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-2.5 rounded bg-black bg-opacity-30 border border-light border-opacity-10 h-100">
                      <strong className="text-warning d-block mb-1">2. NSE Pre-Open (09:00 AM – 09:08 AM)</strong>
                      Check Advance/Decline at 9:07 AM. If <strong>35+ Nifty stocks are red</strong>, broader selling pressure is confirmed.
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="p-2.5 rounded bg-black bg-opacity-30 border border-light border-opacity-10 h-100">
                      <strong className="text-warning d-block mb-1">3. Relative Strength Rule on Red Days</strong>
                      On down days, only touch stocks that are <strong>Green (+2%+) and above VWAP</strong>. Never average down on falling stocks!
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
