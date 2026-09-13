/**
 * Live News Sentiment Engine
 * 
 * Keyword-based sentiment classifier for Indian stock market news headlines.
 * Classifies each headline as POSITIVE / NEGATIVE / NEUTRAL with a score from -1.0 to +1.0.
 * Aggregates across multiple headlines to produce an overall stock sentiment.
 * 
 * No ML dependency — pure keyword matching with domain-specific financial terms.
 */

// ── NEGATIVE KEYWORDS (bearish / risk signals) ──
const NEGATIVE_KEYWORDS = [
  // Regulatory & Legal
  'sebi penalty', 'sebi ban', 'sebi order', 'rbi action', 'regulatory action',
  'probe', 'investigation', 'fraud', 'scam', 'fir filed', 'arrest',
  'violation', 'non-compliance', 'suspension', 'banned', 'debarred',
  'enforcement', 'show cause', 'penalty imposed', 'fine imposed',
  
  // Earnings & Financials
  'loss widens', 'net loss', 'profit decline', 'revenue decline', 'earnings miss',
  'revenue miss', 'margin pressure', 'margin compression', 'debt default',
  'rating downgrade', 'credit downgrade', 'npa', 'bad loan', 'write-off',
  'provision increase', 'asset quality concern', 'stressed asset',
  'guidance cut', 'outlook negative', 'target cut', 'price target cut',
  
  // Institutional Selling
  'sell-off', 'selloff', 'fii selling', 'fii outflow', 'foreign outflow',
  'block deal sell', 'promoter selling', 'promoter pledge', 'stake sale',
  'offloaded', 'dumped shares', 'insider selling', 'bulk deal sell',
  'msci exclusion', 'msci deletion', 'msci removal', 'index exclusion',
  'index removal',
  
  // Market Action (Bearish)
  'crash', 'plunge', 'tumble', 'slump', 'tank', 'nosedive', 'collapse',
  'free fall', 'freefall', 'sharp decline', 'steep fall', 'heavy selling',
  'circuit hit', 'lower circuit', 'bloodbath', 'carnage', 'meltdown',
  'bear grip', 'bears dominate', 'selling pressure',
  
  // Corporate Negatives
  'layoff', 'lay off', 'job cuts', 'restructuring', 'shutdown',
  'plant closure', 'resignation', 'ceo resign', 'cfo resign', 'fired',
  'terminated', 'management exit', 'board resignation',
  'recall', 'product recall', 'safety concern', 'quality issue',
  'supply disruption', 'demand slump', 'order cancellation',
  
  // Macro Negative
  'recession', 'slowdown', 'inflation spike', 'rate hike', 'tariff',
  'trade war', 'geopolitical risk', 'war', 'sanctions', 'embargo',
  'crude surge', 'oil spike', 'rupee fall', 'rupee depreciation',
  'capital flight', 'risk-off',
  
  // Analyst Sentiment
  'downgrade', 'underperform', 'sell rating', 'reduce', 'avoid',
  'bearish', 'cautious', 'risk', 'warning', 'red flag', 'concern',
  'negative', 'weak', 'disappointing', 'below estimate', 'below expectation',
];

// ── POSITIVE KEYWORDS (bullish / growth signals) ──
const POSITIVE_KEYWORDS = [
  // Earnings & Financials
  'profit surge', 'profit jump', 'profit growth', 'revenue growth',
  'revenue surge', 'earnings beat', 'beat estimate', 'above estimate',
  'beat expectation', 'margin expansion', 'margin improvement',
  'record revenue', 'record profit', 'all-time high revenue',
  'guidance raised', 'outlook positive', 'outlook upgraded',
  'strong quarter', 'robust growth', 'stellar result',
  
  // Analyst & Rating
  'upgrade', 'buy rating', 'outperform', 'overweight', 'accumulate',
  'target raised', 'price target raised', 'target price raised',
  'bullish', 'positive', 'optimistic', 'strong buy',
  'top pick', 'conviction buy', 'preferred pick',
  
  // Institutional Buying
  'fii buying', 'fii inflow', 'foreign inflow', 'dii buying',
  'block deal buy', 'promoter buying', 'stake increase', 'bulk deal buy',
  'msci inclusion', 'msci addition', 'index inclusion', 'index addition',
  'nifty inclusion', 'institutional buying', 'smart money',
  
  // Market Action (Bullish)
  'rally', 'surge', 'soar', 'jump', 'spike', 'breakout', 'all-time high',
  '52-week high', '52 week high', 'new high', 'upper circuit',
  'strong momentum', 'bulls dominate', 'buying spree', 'sharp rally',
  'robust demand', 'strong buying',
  
  // Corporate Positives
  'expansion', 'new plant', 'capacity expansion', 'capex',
  'acquisition', 'merger', 'partnership', 'collaboration', 'tie-up',
  'new launch', 'product launch', 'order win', 'new order',
  'contract win', 'deal win', 'export order', 'large order',
  'dividend', 'bonus', 'stock split', 'buyback', 'share buyback',
  'delisting', 'open offer',
  
  // Macro Positive
  'rate cut', 'rbi rate cut', 'gdp growth', 'recovery', 'boom',
  'bull run', 'risk-on', 'stimulus', 'reform', 'fdi inflow',
  'rupee strengthens', 'crude decline', 'oil decline',
  
  // Growth & Innovation
  'growth', 'innovation', 'patent', 'approval', 'clearance',
  'licence', 'license', 'market share gain', 'new market',
  'digital transformation', 'ai adoption', 'tech upgrade',
];

/**
 * Classifies a single headline as POSITIVE, NEGATIVE, or NEUTRAL.
 * 
 * @param {string} title - The headline text
 * @returns {{ sentiment: string, score: number, matchedKeywords: string[] }}
 */
export function classifyHeadline(title) {
  if (!title || typeof title !== 'string') {
    return { sentiment: 'NEUTRAL', score: 0, matchedKeywords: [] };
  }

  const lowerTitle = title.toLowerCase();
  const matchedPositive = [];
  const matchedNegative = [];

  // Check negative keywords (longer phrases first for better matching)
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (lowerTitle.includes(keyword)) {
      matchedNegative.push(keyword);
    }
  }

  // Check positive keywords
  for (const keyword of POSITIVE_KEYWORDS) {
    if (lowerTitle.includes(keyword)) {
      matchedPositive.push(keyword);
    }
  }

  const totalHits = matchedPositive.length + matchedNegative.length;

  if (totalHits === 0) {
    return { sentiment: 'NEUTRAL', score: 0, matchedKeywords: [] };
  }

  // Score: (positive - negative) / total → range -1.0 to +1.0
  const rawScore = (matchedPositive.length - matchedNegative.length) / totalHits;
  const score = Number(rawScore.toFixed(2));

  let sentiment = 'NEUTRAL';
  if (score >= 0.2) sentiment = 'POSITIVE';
  else if (score <= -0.2) sentiment = 'NEGATIVE';

  return {
    sentiment,
    score,
    matchedKeywords: [...matchedNegative.map(k => `⛔ ${k}`), ...matchedPositive.map(k => `✅ ${k}`)],
  };
}

/**
 * Aggregates sentiment across multiple headlines for a stock.
 * Recent headlines (index 0 = most recent) carry higher weight.
 * 
 * @param {Array<{ title: string, publishedAt?: string }>} headlines
 * @returns {{
 *   overallSentiment: string,
 *   overallScore: number,
 *   positiveCount: number,
 *   negativeCount: number,
 *   neutralCount: number,
 *   totalHeadlines: number,
 *   topHeadline: object|null,
 *   classifiedHeadlines: Array
 * }}
 */
export function aggregateStockSentiment(headlines) {
  if (!Array.isArray(headlines) || headlines.length === 0) {
    return {
      overallSentiment: 'NEUTRAL',
      overallScore: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      totalHeadlines: 0,
      topHeadline: null,
      classifiedHeadlines: [],
    };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let neutralCount = 0;

  const classifiedHeadlines = headlines.map((h, idx) => {
    const classification = classifyHeadline(h.title || h.headline || '');
    
    // Recent headlines (lower index) get higher weight: weight = 1 / (1 + idx * 0.3)
    const recencyWeight = 1 / (1 + idx * 0.3);
    
    // Non-neutral headlines get extra weight (they carry more signal)
    const signalWeight = classification.sentiment !== 'NEUTRAL' ? 1.5 : 1.0;
    const finalWeight = recencyWeight * signalWeight;

    weightedSum += classification.score * finalWeight;
    totalWeight += finalWeight;

    if (classification.sentiment === 'POSITIVE') positiveCount++;
    else if (classification.sentiment === 'NEGATIVE') negativeCount++;
    else neutralCount++;

    return {
      ...h,
      ...classification,
    };
  });

  const overallScore = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : 0;

  let overallSentiment = 'NEUTRAL';
  if (overallScore >= 0.15) overallSentiment = 'POSITIVE';
  else if (overallScore <= -0.15) overallSentiment = 'NEGATIVE';

  // Top headline = most impactful (highest absolute score, preferring recent)
  const topHeadline = classifiedHeadlines
    .filter(h => h.sentiment !== 'NEUTRAL')
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0] || classifiedHeadlines[0] || null;

  return {
    overallSentiment,
    overallScore,
    positiveCount,
    negativeCount,
    neutralCount,
    totalHeadlines: headlines.length,
    topHeadline,
    classifiedHeadlines,
  };
}

/**
 * Converts aggregate sentiment into a 0-100 score for scanner integration.
 * Maps: -1.0 → 0, 0 → 50, +1.0 → 100
 * 
 * For SHORT scoring (inverted): -1.0 → 100, 0 → 50, +1.0 → 0
 * 
 * @param {number} overallScore - The aggregate sentiment score (-1.0 to +1.0)
 * @param {boolean} invertForShort - If true, inverts the mapping for short selling
 * @returns {number} - Score from 0 to 100
 */
export function sentimentToScannerScore(overallScore, invertForShort = false) {
  // Map -1.0..+1.0 to 0..100
  let score = Math.round(((overallScore + 1) / 2) * 100);
  score = Math.max(0, Math.min(100, score));
  
  if (invertForShort) {
    score = 100 - score;
  }
  
  return score;
}
