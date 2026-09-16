/**
 * Global Risk Alert Engine
 *
 * Detects 7 macro risk scenarios that impact Indian stock markets and produces
 * actionable alerts with sector-level guidance (AVOID / TRY).
 *
 * Risk Scenarios:
 * 1. 🛢️ Crude Oil Shock — Brent > $90 OR change > +3%
 * 2. ⚔️ Geopolitical Crisis — War/sanctions/military news keywords
 * 3. 📉 FII Selling Stampede — FII net outflow > -₹2,000 Cr
 * 4. 📊 US Market Crash — S&P 500 or Nasdaq change < -2%
 * 5. 💵 Rupee Panic — USD/INR change > +0.5%
 * 6. 🌋 VIX Explosion — India VIX > 20 OR VIX change > +15%
 * 7. 🌊 Asia Morning Selloff — Nikkei change < -2%
 *
 * Overall Risk Level:
 * - GREEN (0-25): Normal — trade freely
 * - AMBER (26-50): Caution — reduce position, tighten SL
 * - RED (51-75): High Risk — defensive sectors only
 * - CRITICAL (76-100): STOP trading — protect capital
 */

// ── TYPES ──

export type RiskSeverity = 'GREEN' | 'AMBER' | 'RED' | 'CRITICAL';

export interface SectorImpact {
  name: string;
  reason: string;
}

export interface RiskAlert {
  id: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  riskScore: number; // 0-100 contribution
  sectorsToAvoid: SectorImpact[];
  sectorsToTry: SectorImpact[];
  triggeredAt: Date;
}

export interface GlobalRiskAlertResult {
  overallRiskLevel: RiskSeverity;
  overallRiskScore: number; // 0-100
  alerts: RiskAlert[];
  riskSummary: string;
  tradingAction: string;
  timestamp: Date;
}

export interface GlobalRiskInput {
  // Crude Oil
  brentCrudePrice?: number;        // $/bbl (e.g., 78.5 or 92.4)
  brentCrudeChangePct?: number;    // e.g., +3.8%

  // US Markets
  sp500ChangePct?: number;         // e.g., -2.1%
  nasdaqChangePct?: number;        // e.g., -1.65%

  // Currency
  usdInrChangePct?: number;        // e.g., +0.55%

  // VIX
  indiaVix?: number;               // e.g., 22.5
  indiaVixChangePct?: number;      // e.g., +18%

  // Asia
  nikkeiChangePct?: number;        // e.g., -2.3%
  hangSengChangePct?: number;      // e.g., -1.8%

  // FII/DII
  fiiNetCrores?: number;           // e.g., -2800

  // News Headlines (array of strings)
  newsHeadlines?: string[];
}

// ── GEOPOLITICAL KEYWORDS ──
// Enhanced list beyond the newsSentimentEngine to catch specific crisis patterns
const GEOPOLITICAL_CRISIS_KEYWORDS = [
  // War & Military
  'war', 'military strike', 'missile', 'airstrikes', 'airstrike', 'bombing',
  'invasion', 'troops deployed', 'military escalation', 'armed conflict',
  'nuclear threat', 'nuclear', 'ceasefire broken', 'attack',

  // Specific Geopolitical Hotspots
  'usa iran', 'iran war', 'us iran', 'iran conflict', 'iran attack',
  'russia ukraine', 'china taiwan', 'israel hamas', 'israel iran',
  'north korea', 'middle east crisis', 'gulf crisis', 'strait of hormuz',
  'red sea', 'houthi',

  // Sanctions & Trade
  'sanctions', 'embargo', 'trade ban', 'export ban', 'import ban',
  'trade restriction', 'tariff war', 'trade war escalat',

  // Terror & Instability
  'terrorist attack', 'terror', 'coup', 'political crisis',
  'martial law', 'emergency declared', 'civil unrest',

  // Energy Crisis
  'oil supply disruption', 'opec emergency', 'pipeline attack',
  'refinery attack', 'supply cut', 'production cut',
];

// ── SECTOR IMPACT MATRIX ──
// Maps each risk scenario to the sectors it hurts and helps

const SECTOR_IMPACT = {
  CRUDE_OIL_SHOCK: {
    avoid: [
      { name: 'Paints', reason: 'Crude-derived raw materials (TiO2, solvents) cost surge' },
      { name: 'Tyres', reason: 'Natural rubber + crude-linked synthetic rubber cost spikes' },
      { name: 'Aviation', reason: 'ATF fuel cost is 40% of airline operating costs' },
      { name: 'Auto', reason: 'Higher fuel costs reduce consumer demand + input costs rise' },
      { name: 'FMCG Packaging', reason: 'Plastic/packaging costs linked to crude oil' },
      { name: 'Logistics', reason: 'Diesel cost surge compresses transport margins' },
    ],
    try: [
      { name: 'Upstream Oil (ONGC, Oil India)', reason: 'Higher crude = higher realization for oil producers' },
      { name: 'IT Services', reason: 'Domestic cost base, USD revenue — immune to crude' },
      { name: 'Pharma', reason: 'Inelastic healthcare demand — defensive safe haven' },
      { name: 'Gold & Jewellery', reason: 'Gold rallies as inflation hedge during oil shocks' },
    ],
  },

  GEOPOLITICAL_CRISIS: {
    avoid: [
      { name: 'Paints', reason: 'Import-dependent raw materials disrupted' },
      { name: 'Aviation', reason: 'Route restrictions + fuel surges during conflicts' },
      { name: 'Auto', reason: 'Supply chain disruptions + consumer sentiment collapse' },
      { name: 'IT Services', reason: 'US/European client spending freezes in wartime' },
      { name: 'Small-caps', reason: 'Risk-off selling hits small-caps hardest (low liquidity)' },
    ],
    try: [
      { name: 'Defence (HAL, BEL, BDL)', reason: 'Defence spending surges during geopolitical tensions' },
      { name: 'Gold & Jewellery', reason: 'Safe-haven flight to gold during wars' },
      { name: 'Pharma', reason: 'Non-discretionary healthcare demand stays stable' },
      { name: 'FMCG', reason: 'Essential consumption — people buy necessities regardless of war' },
    ],
  },

  FII_SELLING: {
    avoid: [
      { name: 'Large-cap Heavyweights', reason: 'FIIs hold 20-40% in Nifty 50 stocks — their selling creates max impact' },
      { name: 'Banking (HDFC, ICICI, Kotak)', reason: 'Banks are the #1 FII holding sector' },
      { name: 'IT Services', reason: 'Second-largest FII holding — correlated with US fund flows' },
      { name: 'Auto', reason: 'High FII ownership in Maruti, M&M, Tata Motors' },
    ],
    try: [
      { name: 'DII-favourite Mid-caps', reason: 'DII (mutual funds) buying absorbs FII selling in quality mid-caps' },
      { name: 'Pharma', reason: 'Domestic funds overweight Pharma as defensive play' },
      { name: 'PSU Banks', reason: 'Low FII ownership — immune to foreign selling pressure' },
      { name: 'Sugar & Agro', reason: 'Domestic theme, minimal foreign ownership' },
    ],
  },

  US_MARKET_CRASH: {
    avoid: [
      { name: 'IT Services (TCS, Infosys, HCL)', reason: '80% revenue from US — Nasdaq correlation is 0.85+' },
      { name: 'Global-linked stocks', reason: 'ADR-listed stocks follow US market direction' },
      { name: 'Tech & SaaS', reason: 'Global tech sentiment drags Indian tech stocks' },
    ],
    try: [
      { name: 'Domestic Consumption (FMCG)', reason: 'Zero US exposure — domestic demand-driven' },
      { name: 'Pharma', reason: 'Defensive counter-cyclical sector' },
      { name: 'Infra & Construction', reason: 'Government spending is domestically driven, immune to US' },
      { name: 'Gold & Jewellery', reason: 'Risk-off flows boost gold prices globally' },
    ],
  },

  RUPEE_PANIC: {
    avoid: [
      { name: 'Oil Marketing (IOC, BPCL, HPCL)', reason: 'Import bill surges when rupee weakens — crude is bought in USD' },
      { name: 'Capital Goods (imports)', reason: 'Machinery import costs rise sharply' },
      { name: 'Electronics', reason: 'Component imports become 5-10% costlier overnight' },
    ],
    try: [
      { name: 'IT Services (Export Revenue)', reason: 'Earn in USD, spend in INR — weak rupee = higher margins!' },
      { name: 'Pharma (Export Revenue)', reason: 'API/formulation exports benefit from weak rupee' },
      { name: 'Textiles (Export)', reason: 'Textile exporters gain competitive advantage' },
    ],
  },

  VIX_EXPLOSION: {
    avoid: [
      { name: 'Options Buying', reason: 'Premiums are inflated — high IV makes buying expensive' },
      { name: 'Small & Mid-caps', reason: 'Liquidity dries up in high-VIX — spreads widen dangerously' },
      { name: 'Intraday Scalping', reason: 'Violent whipsaws and false breakouts in high-VIX markets' },
    ],
    try: [
      { name: 'Cash positions', reason: 'Preserve capital — high VIX environments destroy overleveraged traders' },
      { name: 'Options Selling (Strangles)', reason: 'High premiums = profitable selling IF done with hedges' },
      { name: 'Nifty 50 Large-caps only', reason: 'If trading, stick to highest liquidity stocks with tight spreads' },
    ],
  },

  ASIA_SELLOFF: {
    avoid: [
      { name: 'Metal & Mining', reason: 'Asian demand outlook directly impacts commodity prices' },
      { name: 'Chemical Exporters', reason: 'China slowdown reduces chemical demand from Asia' },
      { name: 'Capital Goods', reason: 'Asian infrastructure slowdown reduces order pipelines' },
    ],
    try: [
      { name: 'Domestic FMCG', reason: 'Insulated from Asian trade dynamics' },
      { name: 'Pharma', reason: 'Healthcare demand is non-cyclical' },
      { name: 'IT Services', reason: 'US/Europe-focused — not Asia-dependent' },
    ],
  },
};

// ── RISK SCENARIO DETECTORS ──

function detectCrudeOilShock(input: GlobalRiskInput): RiskAlert | null {
  const price = input.brentCrudePrice ?? 0;
  const change = input.brentCrudeChangePct ?? 0;

  // Trigger: Brent > $90 OR daily change > +3%
  const isPriceShock = price > 90;
  const isSurge = change >= 3.0;
  const isElevated = price > 85 || change >= 2.0;

  if (!isPriceShock && !isSurge && !isElevated) return null;

  const severity: RiskSeverity = (isPriceShock && isSurge) ? 'CRITICAL' :
    (isPriceShock || isSurge) ? 'RED' : 'AMBER';

  const riskScore = isPriceShock && isSurge ? 85 :
    isPriceShock || isSurge ? 65 : 35;

  return {
    id: 'CRUDE_OIL_SHOCK',
    severity,
    title: '🛢️ Crude Oil Shock Alert',
    description: `Brent Crude at $${price.toFixed(1)} (${change >= 0 ? '+' : ''}${change.toFixed(1)}%). ${
      isPriceShock ? 'Price above $90 danger zone!' : 'Sharp daily surge detected.'
    } India imports 85% of its crude — this hits Paints, Tyres, Aviation hardest.`,
    riskScore,
    sectorsToAvoid: SECTOR_IMPACT.CRUDE_OIL_SHOCK.avoid,
    sectorsToTry: SECTOR_IMPACT.CRUDE_OIL_SHOCK.try,
    triggeredAt: new Date(),
  };
}

function detectGeopoliticalCrisis(input: GlobalRiskInput): RiskAlert | null {
  const headlines = input.newsHeadlines ?? [];
  if (headlines.length === 0) return null;

  const matchedKeywords: string[] = [];

  for (const headline of headlines) {
    const lower = headline.toLowerCase();
    for (const keyword of GEOPOLITICAL_CRISIS_KEYWORDS) {
      if (lower.includes(keyword)) {
        matchedKeywords.push(keyword);
      }
    }
  }

  // Deduplicate
  const uniqueMatches = [...new Set(matchedKeywords)];
  if (uniqueMatches.length === 0) return null;

  // More keyword matches = higher severity
  const severity: RiskSeverity = uniqueMatches.length >= 5 ? 'CRITICAL' :
    uniqueMatches.length >= 3 ? 'RED' : 'AMBER';

  const riskScore = Math.min(uniqueMatches.length * 15, 90);

  return {
    id: 'GEOPOLITICAL_CRISIS',
    severity,
    title: '⚔️ Geopolitical Crisis Alert',
    description: `Detected ${uniqueMatches.length} risk signal${uniqueMatches.length > 1 ? 's' : ''} in news: ${
      uniqueMatches.slice(0, 4).join(', ')
    }${uniqueMatches.length > 4 ? '...' : ''}. Geopolitical tensions create panic selling and risk-off moves in emerging markets.`,
    riskScore,
    sectorsToAvoid: SECTOR_IMPACT.GEOPOLITICAL_CRISIS.avoid,
    sectorsToTry: SECTOR_IMPACT.GEOPOLITICAL_CRISIS.try,
    triggeredAt: new Date(),
  };
}

function detectFIISelling(input: GlobalRiskInput): RiskAlert | null {
  const fiiNet = input.fiiNetCrores ?? 0;

  // Trigger: FII net outflow > -₹1,000 Cr (amber) or > -₹2,000 Cr (red)
  if (fiiNet >= -1000) return null;

  const severity: RiskSeverity = fiiNet <= -3000 ? 'RED' :
    fiiNet <= -2000 ? 'RED' : 'AMBER';

  const riskScore = fiiNet <= -3000 ? 70 :
    fiiNet <= -2000 ? 55 : 35;

  return {
    id: 'FII_SELLING',
    severity,
    title: '📉 FII Selling Stampede',
    description: `FII net outflow: ₹${Math.abs(fiiNet).toLocaleString('en-IN')} Cr. ${
      fiiNet <= -3000 ? 'Massive institutional liquidation!' :
        fiiNet <= -2000 ? 'Heavy foreign selling pressure on large-caps.' :
          'Moderate FII outflow — watch for acceleration.'
    }`,
    riskScore,
    sectorsToAvoid: SECTOR_IMPACT.FII_SELLING.avoid,
    sectorsToTry: SECTOR_IMPACT.FII_SELLING.try,
    triggeredAt: new Date(),
  };
}

function detectUSMarketCrash(input: GlobalRiskInput): RiskAlert | null {
  const sp500 = input.sp500ChangePct ?? 0;
  const nasdaq = input.nasdaqChangePct ?? 0;

  const sp500Crash = sp500 <= -2.0;
  const nasdaqCrash = nasdaq <= -2.0;
  const sp500Weak = sp500 <= -1.5;
  const nasdaqWeak = nasdaq <= -1.5;

  if (!sp500Crash && !nasdaqCrash && !sp500Weak && !nasdaqWeak) return null;

  const severity: RiskSeverity = (sp500Crash && nasdaqCrash) ? 'RED' :
    (sp500Crash || nasdaqCrash) ? 'RED' : 'AMBER';

  const riskScore = (sp500Crash && nasdaqCrash) ? 70 :
    (sp500Crash || nasdaqCrash) ? 55 : 35;

  return {
    id: 'US_MARKET_CRASH',
    severity,
    title: '📊 US Market Crash Signal',
    description: `S&P 500: ${sp500 >= 0 ? '+' : ''}${sp500.toFixed(1)}%, Nasdaq: ${nasdaq >= 0 ? '+' : ''}${nasdaq.toFixed(1)}%. ${
      sp500Crash && nasdaqCrash ? 'Both US indices in sharp sell-off — expect heavy gap-down in Indian IT stocks!' :
        'US weakness will drag Indian markets at open.'
    }`,
    riskScore,
    sectorsToAvoid: SECTOR_IMPACT.US_MARKET_CRASH.avoid,
    sectorsToTry: SECTOR_IMPACT.US_MARKET_CRASH.try,
    triggeredAt: new Date(),
  };
}

function detectRupeePanic(input: GlobalRiskInput): RiskAlert | null {
  const change = input.usdInrChangePct ?? 0;

  // Trigger: Rupee depreciation > +0.3% (amber) or > +0.5% (red)
  if (change < 0.3) return null;

  const severity: RiskSeverity = change >= 0.8 ? 'RED' :
    change >= 0.5 ? 'RED' : 'AMBER';

  const riskScore = change >= 0.8 ? 65 :
    change >= 0.5 ? 50 : 30;

  return {
    id: 'RUPEE_PANIC',
    severity,
    title: '💵 Rupee Depreciation Alert',
    description: `USD/INR moved +${change.toFixed(2)}% today. ${
      change >= 0.8 ? 'Sharp rupee crash! Import-heavy sectors will bleed.' :
        change >= 0.5 ? 'Significant rupee weakness — FIIs pulling capital out.' :
          'Mild rupee pressure — monitor for acceleration.'
    }`,
    riskScore,
    sectorsToAvoid: SECTOR_IMPACT.RUPEE_PANIC.avoid,
    sectorsToTry: SECTOR_IMPACT.RUPEE_PANIC.try,
    triggeredAt: new Date(),
  };
}

function detectVIXExplosion(input: GlobalRiskInput): RiskAlert | null {
  const vix = input.indiaVix ?? 0;
  const vixChange = input.indiaVixChangePct ?? 0;

  // Trigger: VIX > 18 (amber) or VIX > 22 (red) or VIX daily change > +12%
  const isElevated = vix > 18;
  const isHigh = vix > 22;
  const isSurge = vixChange >= 12;

  if (!isElevated && !isSurge) return null;

  const severity: RiskSeverity = (isHigh && isSurge) ? 'CRITICAL' :
    (isHigh || isSurge) ? 'RED' : 'AMBER';

  const riskScore = (isHigh && isSurge) ? 80 :
    isHigh ? 60 : isSurge ? 55 : 30;

  return {
    id: 'VIX_EXPLOSION',
    severity,
    title: '🌋 VIX Explosion — Fear Spike',
    description: `India VIX at ${vix.toFixed(1)} (${vixChange >= 0 ? '+' : ''}${vixChange.toFixed(1)}% today). ${
      isHigh ? 'Extreme fear levels — markets will have violent swings!' :
        isSurge ? 'Rapid VIX spike indicates institutional hedging (panic buying puts).' :
          'Elevated volatility — tighten stop-losses and reduce position sizes.'
    }`,
    riskScore,
    sectorsToAvoid: SECTOR_IMPACT.VIX_EXPLOSION.avoid,
    sectorsToTry: SECTOR_IMPACT.VIX_EXPLOSION.try,
    triggeredAt: new Date(),
  };
}

function detectAsiaSelloff(input: GlobalRiskInput): RiskAlert | null {
  const nikkei = input.nikkeiChangePct ?? 0;
  const hangSeng = input.hangSengChangePct ?? 0;

  const nikkeiCrash = nikkei <= -2.0;
  const hangSengCrash = hangSeng <= -2.0;
  const nikkeiWeak = nikkei <= -1.5;
  const hangSengWeak = hangSeng <= -1.5;

  if (!nikkeiCrash && !hangSengCrash && !nikkeiWeak && !hangSengWeak) return null;

  const severity: RiskSeverity = (nikkeiCrash && hangSengCrash) ? 'RED' :
    (nikkeiCrash || hangSengCrash) ? 'AMBER' : 'AMBER';

  const riskScore = (nikkeiCrash && hangSengCrash) ? 55 :
    (nikkeiCrash || hangSengCrash) ? 40 : 25;

  return {
    id: 'ASIA_SELLOFF',
    severity,
    title: '🌊 Asia Morning Selloff',
    description: `Nikkei: ${nikkei >= 0 ? '+' : ''}${nikkei.toFixed(1)}%, Hang Seng: ${hangSeng >= 0 ? '+' : ''}${hangSeng.toFixed(1)}%. ${
      nikkeiCrash && hangSengCrash ? 'Pan-Asia panic selling — Nifty will open with heavy gap-down!' :
        'Asian weakness sets negative tone for Indian market open.'
    }`,
    riskScore,
    sectorsToAvoid: SECTOR_IMPACT.ASIA_SELLOFF.avoid,
    sectorsToTry: SECTOR_IMPACT.ASIA_SELLOFF.try,
    triggeredAt: new Date(),
  };
}

// ── MAIN EVALUATION FUNCTION ──

/**
 * Evaluates all 7 global risk scenarios and produces a unified risk assessment.
 *
 * @param input - Global market data and news headlines
 * @returns GlobalRiskAlertResult with overall risk level, alerts, and trading guidance
 */
export function evaluateGlobalRiskAlerts(input: GlobalRiskInput = {}): GlobalRiskAlertResult {
  const detectors = [
    detectCrudeOilShock,
    detectGeopoliticalCrisis,
    detectFIISelling,
    detectUSMarketCrash,
    detectRupeePanic,
    detectVIXExplosion,
    detectAsiaSelloff,
  ];

  const alerts: RiskAlert[] = [];

  for (const detector of detectors) {
    const alert = detector(input);
    if (alert) {
      alerts.push(alert);
    }
  }

  // Sort alerts by severity (CRITICAL > RED > AMBER > GREEN) then by riskScore
  const severityOrder: Record<RiskSeverity, number> = {
    'CRITICAL': 4,
    'RED': 3,
    'AMBER': 2,
    'GREEN': 1,
  };

  alerts.sort((a, b) =>
    severityOrder[b.severity] - severityOrder[a.severity] ||
    b.riskScore - a.riskScore
  );

  // Overall risk score = weighted average of alert scores (top alerts weigh more)
  let overallRiskScore = 0;
  if (alerts.length > 0) {
    // Take the max risk score, then add diminishing contributions from other alerts
    overallRiskScore = alerts[0].riskScore;
    for (let i = 1; i < alerts.length; i++) {
      // Each subsequent alert adds 20% of its score (diminishing)
      overallRiskScore += alerts[i].riskScore * 0.2;
    }
    overallRiskScore = Math.min(Math.round(overallRiskScore), 100);
  }

  // Overall risk level
  let overallRiskLevel: RiskSeverity = 'GREEN';
  if (overallRiskScore >= 76) overallRiskLevel = 'CRITICAL';
  else if (overallRiskScore >= 51) overallRiskLevel = 'RED';
  else if (overallRiskScore >= 26) overallRiskLevel = 'AMBER';

  // Trading action guidance
  let tradingAction = '🟢 Normal Trading — All sectors open. Follow your standard strategy.';
  if (overallRiskLevel === 'CRITICAL') {
    tradingAction = '⚫ STOP TRADING — Protect capital! Do NOT enter new positions. Close all intraday trades.';
  } else if (overallRiskLevel === 'RED') {
    tradingAction = '🔴 Defensive Only — Trade ONLY defensive sectors (Pharma, FMCG, Gold). Halve position sizes. Tight SL mandatory.';
  } else if (overallRiskLevel === 'AMBER') {
    tradingAction = '🟡 Caution — Reduce position sizes by 50%. Tighten stop-losses. Avoid weak sectors listed above.';
  }

  // Summary
  const riskSummary = alerts.length === 0
    ? 'No global risk alerts detected. Markets appear stable for normal trading.'
    : `${alerts.length} risk alert${alerts.length > 1 ? 's' : ''} detected — ${overallRiskLevel} status. ${
      alerts.map(a => a.title.split(' ').slice(1).join(' ')).join(' • ')
    }`;

  return {
    overallRiskLevel,
    overallRiskScore,
    alerts,
    riskSummary,
    tradingAction,
    timestamp: new Date(),
  };
}

/**
 * Quick helper: Checks if any risk level is RED or above.
 * Use this for fast gating before allowing trades.
 */
export function isHighRiskEnvironment(input: GlobalRiskInput = {}): boolean {
  const result = evaluateGlobalRiskAlerts(input);
  return result.overallRiskLevel === 'RED' || result.overallRiskLevel === 'CRITICAL';
}

