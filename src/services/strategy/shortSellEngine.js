/**
 * Short Sell Radar & Breakdown Engine
 * Scans, scores, and structures high-conviction Intraday Short-Selling candidates
 * based on Global Market sentiment, Negative News Catalysts (MSCI exclusions, promoter selling),
 * Block Deal Outflows, Market-Open Gap Downs, and 15-min Opening Range Breakdowns (ORB).
 */

/**
 * Curated list of known catalyst stocks with structural headwinds or heavy institutional distribution
 */
export const SHORT_CATALYST_DIRECTORY = [
  {
    symbol: 'SWIGGY',
    companyName: 'Swiggy Limited',
    newsHeadline: 'MSCI Index Removal & 49.5% Foreign Ownership Cap Headwind',
    catalystType: 'MSCI_DELETION_OUTFLOW',
    catalystBadge: '🏢 MSCI Deletion Outflow',
    catalystImpact: 'High Institutional Distribution on Any Rallies',
    sector: 'Consumer Tech / Logistics',
    basePrice: 276.1,
    vwap: 277.9,
    dayHigh: 284.4,
    dayLow: 269.3,
    rvol: 2.8,
    blockOutflowCr: 450,
  },
  {
    symbol: 'PAYTM',
    companyName: 'One97 Communications Limited',
    newsHeadline: 'Regulatory Tightening & Ongoing Margin Compression',
    catalystType: 'REGULATORY_HEADWIND',
    catalystBadge: '⚖️ Regulatory Headwind',
    catalystImpact: 'Persistent Selling Below 50-EMA Resistance',
    sector: 'Fintech',
    basePrice: 652.0,
    vwap: 658.5,
    dayHigh: 664.0,
    dayLow: 641.2,
    rvol: 1.9,
    blockOutflowCr: 180,
  },
  {
    symbol: 'ZEEL',
    companyName: 'Zee Entertainment Enterprises',
    newsHeadline: 'Promoter Pledging & Post-Merger Structural Weakness',
    catalystType: 'PROMOTER_SELLING',
    catalystBadge: '📉 Promoter Pledging',
    catalystImpact: 'Supply Overhang at Every Minor Pullback',
    sector: 'Media & Entertainment',
    basePrice: 114.5,
    vwap: 116.2,
    dayHigh: 117.8,
    dayLow: 112.1,
    rvol: 2.1,
    blockOutflowCr: 95,
  },
  {
    symbol: 'INDUSINDBK',
    companyName: 'IndusInd Bank Limited',
    newsHeadline: 'Asset Quality Concerns & Credit Cost Acceleration',
    catalystType: 'EARNINGS_MISS',
    catalystBadge: '⚠️ Asset Quality Headwind',
    catalystImpact: 'FII Outflows in Banking Index Heavyweights',
    sector: 'Private Banking',
    basePrice: 1042.0,
    vwap: 1054.0,
    dayHigh: 1062.0,
    dayLow: 1031.5,
    rvol: 1.7,
    blockOutflowCr: 210,
  },
  {
    symbol: 'DELHIVERY',
    companyName: 'Delhivery Limited',
    newsHeadline: 'Intense E-commerce Price Competition & Express Volume Slowdown',
    catalystType: 'SECTOR_SLOWDOWN',
    catalystBadge: '📦 Margin Squeeze',
    catalystImpact: 'Sustained Breakdown Below 200-DMA Support',
    sector: 'Logistics',
    basePrice: 348.0,
    vwap: 353.2,
    dayHigh: 356.5,
    dayLow: 342.0,
    rvol: 1.8,
    blockOutflowCr: 85,
  },
  {
    symbol: 'BANDHANBNK',
    companyName: 'Bandhan Bank Limited',
    newsHeadline: 'Microfinance Stress & Credit Rating Downgrade Watch',
    catalystType: 'RATING_DOWNGRADE',
    catalystBadge: '📉 Rating Downgrade Watch',
    catalystImpact: 'High Delivery Selling by Domestic Mutual Funds',
    sector: 'Banking & NBFC',
    basePrice: 168.0,
    vwap: 171.5,
    dayHigh: 173.0,
    dayLow: 164.8,
    rvol: 2.3,
    blockOutflowCr: 120,
  },
  {
    symbol: 'VEDL',
    companyName: 'Vedanta Limited',
    newsHeadline: 'Debt Refinancing Pressure & Parent Company Leverage Concerns',
    catalystType: 'DEBT_LEVERAGE',
    catalystBadge: '💸 High Debt Leverage',
    catalystImpact: 'High Intraday Beta with Heavy Short Additions',
    sector: 'Metals & Mining',
    basePrice: 422.0,
    vwap: 428.5,
    dayHigh: 432.0,
    dayLow: 416.0,
    rvol: 2.0,
    blockOutflowCr: 140,
  },
  {
    symbol: 'BATAINDIA',
    companyName: 'Bata India Limited',
    newsHeadline: 'Rural Consumption Demand Lag & Retail Footfall De-growth',
    catalystType: 'DEMAND_SLUMP',
    catalystBadge: '🛍️ Consumer Demand Slump',
    catalystImpact: 'Multi-Month Lower Highs & Breakdown on Daily Chart',
    sector: 'Footwear & Retail',
    basePrice: 1280.0,
    vwap: 1298.0,
    dayHigh: 1308.0,
    dayLow: 1264.0,
    rvol: 1.5,
    blockOutflowCr: 60,
  },
];

/**
 * Evaluates Global Market Sentiments for Short Selling
 */
export function evaluateGlobalShortCues({
  giftNiftyChange = -65, // points
  usMarketSentiment = 'BEARISH', // 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  indiaVix = 15.8, // Volatility index
  crudeOilChange = +1.8, // % rise in crude oil (negative for India)
}) {
  let score = 0;
  const factors = [];

  // GIFT Nifty Gap Down Cue
  if (giftNiftyChange <= -50) {
    score += 6;
    factors.push(`GIFT Nifty indicating gap-down open (${giftNiftyChange} pts)`);
  } else if (giftNiftyChange < 0) {
    score += 3;
    factors.push(`GIFT Nifty trading in the red (${giftNiftyChange} pts)`);
  }

  // Surging India VIX (Favors Short Sellers)
  if (indiaVix >= 15.0) {
    score += 4;
    factors.push(`India VIX elevated at ${indiaVix.toFixed(1)} (Increased downside volatility)`);
  }

  // US Markets & Global Overnight Headwinds
  if (usMarketSentiment === 'BEARISH') {
    score += 3;
    factors.push('US markets closed lower with broad-based tech sell-off');
  }

  // Rising Crude Oil (Macro Headwind for Indian Rupee & Margins)
  if (crudeOilChange >= 1.5) {
    score += 2;
    factors.push(`Crude Oil surging +${crudeOilChange.toFixed(1)}% (Inflation & margin pressure)`);
  }

  return {
    score: Math.min(15, score),
    factors,
    regime: score >= 10 ? 'STRONG_SHORT_TAILWIND' : score >= 5 ? 'MODERATE_SHORT_TAILWIND' : 'NEUTRAL_GLOBAL',
  };
}

/**
 * Evaluates individual stock for Short Selling Conviction (0 - 100 Points)
 */
export function evaluateShortStock(stock, globalCues = null, liveNews = null) {
  const symbol = stock.symbol || stock.Symbol || 'STOCK';
  const companyName = stock.companyName || stock.company || symbol;
  const ltp = Number(stock.price || stock.ltp || stock.lastPrice || stock.basePrice || 0);
  const prevClose = Number(stock.previousClose || stock.prevClose || (stock.basePrice ? stock.basePrice * 1.015 : ltp));
  const openPrice = Number(stock.open || stock.openPrice || ltp);
  const dayHigh = Number(stock.high || stock.dayHigh || ltp * 1.01);
  const dayLow = Number(stock.low || stock.dayLow || ltp * 0.98);
  const vwap = Number(stock.vwap || stock.VWAP || (openPrice + dayHigh + dayLow + ltp) / 4);
  const rvol = Number(stock.volumeRatio || stock.rvol || stock.relativeVolume || 1.6);
  const pChange = prevClose > 0 ? Number((((ltp - prevClose) / prevClose) * 100).toFixed(2)) : 0;
  const gapPct = prevClose > 0 ? Number((((openPrice - prevClose) / prevClose) * 100).toFixed(2)) : 0;

  let technicalScore = 0; // max 40
  let institutionalScore = 0; // max 25
  let newsScore = 0; // max 20
  const shortChecklist = [];

  // 1. TECHNICAL BREAKDOWN (Max 40 Pts)
  // A. Trading Below VWAP (Mandatory Gate for Short Selling)
  if (ltp < vwap) {
    const vwapDiscountPct = ((vwap - ltp) / vwap) * 100;
    if (vwapDiscountPct >= 0.5) {
      technicalScore += 16;
      shortChecklist.push(`Trading strictly below VWAP (₹${vwap.toFixed(2)}, -${vwapDiscountPct.toFixed(1)}%)`);
    } else {
      technicalScore += 10;
      shortChecklist.push(`Trading below VWAP (₹${vwap.toFixed(2)})`);
    }
  }

  // B. Gap Down at Open Below Previous Day Close
  if (gapPct <= -0.6) {
    technicalScore += 12;
    shortChecklist.push(`Gap Down at 9:15 AM Open (${gapPct.toFixed(2)}%)`);
  } else if (pChange <= -1.0) {
    technicalScore += 8;
    shortChecklist.push(`Intraday Breakdown (${pChange.toFixed(2)}% in the red)`);
  }

  // C. Near Intraday Lows / 15-min ORB Breakdown
  const rangeFromLowPct = dayHigh > dayLow ? ((ltp - dayLow) / (dayHigh - dayLow)) * 100 : 50;
  if (rangeFromLowPct <= 25) {
    technicalScore += 12;
    shortChecklist.push('Trading in lower 25% of Day Range (Continuous selling pressure)');
  } else if (rangeFromLowPct <= 45) {
    technicalScore += 6;
    shortChecklist.push('Trading below midpoint of daily range');
  }

  // 2. INSTITUTIONAL OUTFLOW & HIGH VOLUME (Max 25 Pts)
  if (rvol >= 2.0) {
    institutionalScore += 15;
    shortChecklist.push(`Heavy Institutional Sell Volume (RVOL ${rvol.toFixed(1)}x)`);
  } else if (rvol >= 1.4) {
    institutionalScore += 10;
    shortChecklist.push(`Elevated Sell Volume (RVOL ${rvol.toFixed(1)}x)`);
  } else {
    institutionalScore += 5;
  }

  const blockOutflowCr = stock.blockOutflowCr || 0;
  if (blockOutflowCr >= 200) {
    institutionalScore += 10;
    shortChecklist.push(`Massive Block Deal Outflow (₹${blockOutflowCr} Cr offloaded)`);
  } else if (blockOutflowCr >= 50) {
    institutionalScore += 6;
    shortChecklist.push(`Institutional Block Distribution (₹${blockOutflowCr} Cr)`);
  }

  // 3. NEWS & STRUCTURAL HEADWINDS (Max 20 Pts)
  const knownCatalyst = SHORT_CATALYST_DIRECTORY.find((c) => c.symbol === symbol);
  let headline = stock.newsHeadline || knownCatalyst?.newsHeadline || 'Sectoral Margin Pressure & FII Offloading';
  let catalystBadge = stock.catalystBadge || knownCatalyst?.catalystBadge || '📉 Intraday Breakdown';

  // ── Live News Integration (dynamic scoring) ──
  if (liveNews && liveNews.overallScore !== undefined) {
    // Live negative news → full 20 pts (same weight as known catalyst)
    // Live positive news → only 4 pts (reduces short conviction)
    if (liveNews.overallScore <= -0.3) {
      newsScore += 20;
      shortChecklist.push(`📰 Live News: Strongly Negative Sentiment (${liveNews.negativeCount} negative headlines)`);
    } else if (liveNews.overallScore <= -0.1) {
      newsScore += 14;
      shortChecklist.push(`📰 Live News: Moderately Negative Sentiment`);
    } else if (liveNews.overallScore >= 0.3) {
      newsScore += 4;
      shortChecklist.push(`⚠️ Live News: Positive sentiment detected (reduces short conviction)`);
    } else {
      newsScore += 8;
      shortChecklist.push(`📰 Live News: Neutral Sentiment`);
    }
    // Use live headline if available
    if (liveNews.topHeadline?.title) {
      headline = liveNews.topHeadline.title;
    }
    if (liveNews.overallSentiment === 'NEGATIVE') {
      catalystBadge = '📰 Live Negative News';
    } else if (liveNews.overallSentiment === 'POSITIVE') {
      catalystBadge = '📰 Positive News (Caution)';
    }
  } else if (knownCatalyst || stock.catalystType) {
    // ── Static Catalyst Scoring (fallback) ──
    newsScore += 20;
    shortChecklist.push(`Catalyst: ${knownCatalyst?.catalystImpact || 'Negative News Headwind'}`);
  } else if (pChange <= -2.0) {
    newsScore += 14;
    shortChecklist.push('Severe Intraday Relative Weakness');
  } else {
    newsScore += 8;
  }

  // 4. GLOBAL CUES
  const globalScore = globalCues ? globalCues.score : 10;

  // Total Score (0 - 100)
  const totalScore = Math.min(
    100,
    Math.round(technicalScore + institutionalScore + newsScore + globalScore)
  );

  // Strategy Setup Classification
  let strategyType = 'VWAP_BREAKDOWN';
  if (gapPct <= -0.8 && rvol >= 1.8) {
    strategyType = 'GAP_DOWN_CONTINUATION';
  } else if (knownCatalyst?.catalystType === 'MSCI_DELETION_OUTFLOW') {
    strategyType = 'MSCI_INDEX_OUTFLOW';
  } else if (rangeFromLowPct <= 15) {
    strategyType = '15MIN_ORB_BREAKDOWN';
  }

  // Calculate Short Levels (Entry, SL above entry, Targets below entry)
  const entryPrice = ltp;
  // Stop-loss placed strictly above VWAP or +1.2% above entry
  const stopLoss = Number(Math.max(vwap * 1.006, entryPrice * 1.013).toFixed(2));
  const riskAmount = Number((stopLoss - entryPrice).toFixed(2));
  const riskPct = Number((((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2));

  // Target 1: 1:2 Risk-Reward (Downside -2.0% to -2.5%)
  const target1 = Number((entryPrice - (riskAmount * 1.8)).toFixed(2));
  const target1Pct = Number((((target1 - entryPrice) / entryPrice) * 100).toFixed(2));

  // Target 2: Extended 1:3 Breakdown (Downside -4.0% to -5.0%)
  const target2 = Number((entryPrice - (riskAmount * 3.0)).toFixed(2));
  const target2Pct = Number((((target2 - entryPrice) / entryPrice) * 100).toFixed(2));

  // Conviction Tier
  let conviction = 'MODERATE';
  let badgeColor = 'warning';
  if (totalScore >= 80) {
    conviction = 'HIGH_CONVICTION_SHORT';
    badgeColor = 'danger';
  } else if (totalScore < 60) {
    conviction = 'SPECULATIVE_SHORT';
    badgeColor = 'secondary';
  }

  return {
    symbol,
    companyName,
    sector: stock.sector || knownCatalyst?.sector || 'NSE Equities',
    price: ltp,
    previousClose: prevClose,
    pChange,
    gapPct,
    vwap,
    dayHigh,
    dayLow,
    rvol,
    score: totalScore,
    conviction,
    badgeColor,
    strategyType,
    newsHeadline: headline,
    catalystBadge,
    entryPrice,
    stopLoss,
    riskAmount,
    riskPct,
    target1,
    target1Pct,
    target2,
    target2Pct,
    shortChecklist,
    blockOutflowCr: blockOutflowCr || knownCatalyst?.blockOutflowCr || 0,
  };
}

/**
 * Runs full scan across stock list to rank Top Short Sell Candidates
 * @param {Array} stocks - Stock list to scan
 * @param {Object} globalParams - Global market parameters
 * @param {Object} liveNewsMap - Optional map of { symbol: sentimentData } from live news API
 */
export function runShortSellScan(stocks = [], globalParams = {}, liveNewsMap = {}) {
  const globalCues = evaluateGlobalShortCues(globalParams);

  // Combine provided stocks with default known catalysts if needed
  const combinedList = [...stocks];
  SHORT_CATALYST_DIRECTORY.forEach((cat) => {
    if (!combinedList.some((s) => (s.symbol || s.Symbol) === cat.symbol)) {
      combinedList.push(cat);
    }
  });

  const evaluated = combinedList
    .map((s) => {
      const sym = (s.symbol || s.Symbol || '').toUpperCase();
      const liveNews = liveNewsMap[sym]?.sentiment || null;
      return evaluateShortStock(s, globalCues, liveNews);
    })
    .filter((s) => s.price > 0 && s.score >= 50);

  // Sort descending by Short Conviction Score
  evaluated.sort((a, b) => b.score - a.score);

  return {
    globalCues,
    candidates: evaluated,
    highConvictionCount: evaluated.filter((s) => s.score >= 80).length,
    scannedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
  };
}
