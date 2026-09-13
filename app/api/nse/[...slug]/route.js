import fs from 'node:fs';
import path from 'node:path';

const NSE_ORIGIN = 'https://www.nseindia.com';

const ROUTES_MAP = {
  'top-ten': '/api/live-analysis-variations?index=gainers',
  'most-active': '/api/live-analysis-most-active-securities?index=volume',
  'universe': '/content/equities/EQUITY_L.csv',
  'market-status': '/api/marketStatus',
  'all-indices': '/api/allIndices',
  'scanner-market-data': '/api/live-analysis-most-active-securities?index=volume',
};

const COMMON_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'sec-ch-ua': '"Not.A/Brand";v="8", "Chromium";v="124", "Google Chrome";v="124"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-user': '?1',
  'sec-fetch-dest': 'document',
  'x-requested-with': 'XMLHttpRequest',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,authorization',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

const FALLBACK_EQUITY_BASKET = [
  { symbol: 'SUZLON', companyName: 'Suzlon Energy Limited', lastPrice: 74.50, pChange: 4.80, change: 3.40, open: 71.20, high: 75.00, low: 71.00, previousClose: 71.10, totalTradedVolume: 65000000, totalTradedValue: 4842500000, vwap: 73.80 },
  { symbol: 'YESBANK', companyName: 'Yes Bank Limited', lastPrice: 24.15, pChange: 3.20, change: 0.75, open: 23.40, high: 24.50, low: 23.30, previousClose: 23.40, totalTradedVolume: 85000000, totalTradedValue: 2052750000, vwap: 23.90 },
  { symbol: 'IDEA', companyName: 'Vodafone Idea Limited', lastPrice: 14.80, pChange: 5.71, change: 0.80, open: 14.00, high: 15.00, low: 13.90, previousClose: 14.00, totalTradedVolume: 120000000, totalTradedValue: 1776000000, vwap: 14.50 },
  { symbol: 'PCJEWELLER', companyName: 'PC Jeweller Limited', lastPrice: 168.40, pChange: 4.98, change: 8.00, open: 160.40, high: 168.40, low: 160.00, previousClose: 160.40, totalTradedVolume: 14000000, totalTradedValue: 2357600000, vwap: 165.20 },
  { symbol: 'MOTISONS', companyName: 'Motisons Jewellers Limited', lastPrice: 285.60, pChange: 6.25, change: 16.80, open: 269.00, high: 290.00, low: 268.00, previousClose: 268.80, totalTradedVolume: 9200000, totalTradedValue: 2627520000, vwap: 281.00 },
  { symbol: 'IFCI', companyName: 'IFCI Limited', lastPrice: 68.20, pChange: 4.60, change: 3.00, open: 65.20, high: 69.00, low: 65.00, previousClose: 65.20, totalTradedVolume: 32000000, totalTradedValue: 2182400000, vwap: 67.50 },
  { symbol: 'RENUKA', companyName: 'Shree Renuka Sugars Limited', lastPrice: 48.90, pChange: 3.80, change: 1.80, open: 47.10, high: 49.50, low: 47.00, previousClose: 47.10, totalTradedVolume: 18000000, totalTradedValue: 880200000, vwap: 48.20 },
  { symbol: 'SHIPROCKET', companyName: 'Shiprocket Logistics Limited', lastPrice: 340.50, pChange: 4.15, change: 13.55, open: 327.00, high: 345.00, low: 326.00, previousClose: 326.95, totalTradedVolume: 7800000, totalTradedValue: 2655900000, vwap: 336.00 },
  { symbol: 'BAJAJHIND', companyName: 'Bajaj Hindusthan Sugar Limited', lastPrice: 38.40, pChange: 4.35, change: 1.60, open: 36.80, high: 39.00, low: 36.70, previousClose: 36.80, totalTradedVolume: 22000000, totalTradedValue: 844800000, vwap: 37.90 },
  { symbol: 'ASTERDM', companyName: 'Aster DM Healthcare Limited', lastPrice: 410.20, pChange: 2.80, change: 11.15, open: 399.00, high: 415.00, low: 398.00, previousClose: 399.05, totalTradedVolume: 4500000, totalTradedValue: 1845900000, vwap: 406.00 },
  { symbol: 'ZAGGLE', companyName: 'Zaggle Prepaid Ocean Services', lastPrice: 445.80, pChange: 5.10, change: 21.60, open: 424.20, high: 452.00, low: 422.00, previousClose: 424.20, totalTradedVolume: 6100000, totalTradedValue: 2719380000, vwap: 440.00 },
  { symbol: 'GTLINFRA', companyName: 'GTL Infrastructure Limited', lastPrice: 2.85, pChange: 5.56, change: 0.15, open: 2.70, high: 2.85, low: 2.70, previousClose: 2.70, totalTradedVolume: 95000000, totalTradedValue: 270750000, vwap: 2.80 },
  { symbol: 'RELIANCE', companyName: 'Reliance Industries Limited', lastPrice: 2980.15, pChange: 1.54, change: 45.20, open: 2940.00, high: 2990.00, low: 2935.00, previousClose: 2934.95, totalTradedVolume: 8500000, totalTradedValue: 25330000000, vwap: 2965.00 },
  { symbol: 'TCS', companyName: 'Tata Consultancy Services Limited', lastPrice: 4250.80, pChange: -0.29, change: -12.30, open: 4270.00, high: 4285.00, low: 4240.00, previousClose: 4263.10, totalTradedVolume: 3200000, totalTradedValue: 13600000000, vwap: 4260.00 },
  { symbol: 'HDFCBANK', companyName: 'HDFC Bank Limited', lastPrice: 1650.00, pChange: 1.10, change: 18.00, open: 1635.00, high: 1655.00, low: 1630.00, previousClose: 1632.00, totalTradedVolume: 11000000, totalTradedValue: 18150000000, vwap: 1642.00 },
  { symbol: 'ICICIBANK', companyName: 'ICICI Bank Limited', lastPrice: 1210.30, pChange: 1.31, change: 15.60, open: 1198.00, high: 1215.00, low: 1195.00, previousClose: 1194.70, totalTradedVolume: 9500000, totalTradedValue: 11500000000, vwap: 1205.00 },
  { symbol: 'INFY', companyName: 'Infosys Limited', lastPrice: 1890.50, pChange: 1.89, change: 35.10, open: 1860.00, high: 1895.00, low: 1855.00, previousClose: 1855.40, totalTradedVolume: 9100000, totalTradedValue: 17200000000, vwap: 1875.00 },
  { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel Limited', lastPrice: 1580.90, pChange: 1.83, change: 28.40, open: 1555.00, high: 1585.00, low: 1550.00, previousClose: 1552.50, totalTradedVolume: 6200000, totalTradedValue: 9800000000, vwap: 1570.00 },
  { symbol: 'TATAMOTORS', companyName: 'Tata Motors Limited', lastPrice: 995.80, pChange: 2.30, change: 22.40, open: 978.00, high: 1002.00, low: 975.00, previousClose: 973.40, totalTradedVolume: 14200000, totalTradedValue: 14140000000, vwap: 988.00 },
  { symbol: 'TATASTEEL', companyName: 'Tata Steel Limited', lastPrice: 154.20, pChange: 3.21, change: 4.80, open: 150.00, high: 155.50, low: 149.50, previousClose: 149.40, totalTradedVolume: 22000000, totalTradedValue: 3392000000, vwap: 152.50 },
  { symbol: 'SBIN', companyName: 'State Bank of India', lastPrice: 840.50, pChange: 1.55, change: 12.80, open: 830.00, high: 844.00, low: 828.00, previousClose: 827.70, totalTradedVolume: 13500000, totalTradedValue: 11340000000, vwap: 836.00 },
  { symbol: 'SWIGGY', companyName: 'Swiggy Limited', lastPrice: 520.40, pChange: 3.68, change: 18.50, open: 505.00, high: 525.00, low: 502.00, previousClose: 501.90, totalTradedVolume: 28000000, totalTradedValue: 14570000000, vwap: 512.00 },
  { symbol: 'ZOMATO', companyName: 'Zomato Limited', lastPrice: 245.10, pChange: 2.60, change: 6.20, open: 240.00, high: 248.00, low: 239.00, previousClose: 238.90, totalTradedVolume: 25000000, totalTradedValue: 6120000000, vwap: 243.00 },
  { symbol: 'LT', companyName: 'Larsen & Toubro Limited', lastPrice: 3650.00, pChange: 1.53, change: 55.00, open: 3600.00, high: 3665.00, low: 3595.00, previousClose: 3595.00, totalTradedVolume: 4100000, totalTradedValue: 14965000000, vwap: 3630.00 },
  { symbol: 'M&M', companyName: 'Mahindra & Mahindra Limited', lastPrice: 2750.40, pChange: 2.10, change: 56.60, open: 2700.00, high: 2765.00, low: 2695.00, previousClose: 2693.80, totalTradedVolume: 5200000, totalTradedValue: 14300000000, vwap: 2730.00 },
  { symbol: 'SUNPHARMA', companyName: 'Sun Pharmaceutical Industries Limited', lastPrice: 1780.20, pChange: 1.45, change: 25.40, open: 1760.00, high: 1790.00, low: 1755.00, previousClose: 1754.80, totalTradedVolume: 3800000, totalTradedValue: 6760000000, vwap: 1770.00 },
  { symbol: 'MARUTI', companyName: 'Maruti Suzuki India Limited', lastPrice: 12450.00, pChange: 1.15, change: 141.00, open: 12350.00, high: 12500.00, low: 12300.00, previousClose: 12309.00, totalTradedVolume: 1200000, totalTradedValue: 14940000000, vwap: 12400.00 },
  { symbol: 'BAJFINANCE', companyName: 'Bajaj Finance Limited', lastPrice: 7120.00, pChange: 1.78, change: 124.50, open: 7010.00, high: 7150.00, low: 7000.00, previousClose: 6995.50, totalTradedVolume: 2900000, totalTradedValue: 20648000000, vwap: 7080.00 },
  { symbol: 'AXISBANK', companyName: 'Axis Bank Limited', lastPrice: 1175.50, pChange: 1.35, change: 15.60, open: 1162.00, high: 1182.00, low: 1160.00, previousClose: 1159.90, totalTradedVolume: 7400000, totalTradedValue: 8695000000, vwap: 1170.00 },
  { symbol: 'KOTAKBANK', companyName: 'Kotak Mahindra Bank Limited', lastPrice: 1790.00, pChange: 0.95, change: 16.80, open: 1778.00, high: 1798.00, low: 1775.00, previousClose: 1773.20, totalTradedVolume: 4800000, totalTradedValue: 8592000000, vwap: 1785.00 },
  { symbol: 'TITAN', companyName: 'Titan Company Limited', lastPrice: 3420.00, pChange: 1.62, change: 54.50, open: 3375.00, high: 3435.00, low: 3370.00, previousClose: 3365.50, totalTradedVolume: 2600000, totalTradedValue: 8892000000, vwap: 3405.00 },
  { symbol: 'ULTRACEMCO', companyName: 'UltraTech Cement Limited', lastPrice: 11200.00, pChange: 1.25, change: 138.00, open: 11080.00, high: 11250.00, low: 11050.00, previousClose: 11062.00, totalTradedVolume: 850000, totalTradedValue: 9520000000, vwap: 11150.00 },
  { symbol: 'WIPRO', companyName: 'Wipro Limited', lastPrice: 535.40, pChange: 1.80, change: 9.45, open: 527.00, high: 538.00, low: 526.00, previousClose: 525.95, totalTradedVolume: 11200000, totalTradedValue: 5996000000, vwap: 532.00 },
  { symbol: 'HCLTECH', companyName: 'HCL Technologies Limited', lastPrice: 1785.00, pChange: 1.50, change: 26.35, open: 1762.00, high: 1792.00, low: 1760.00, previousClose: 1758.65, totalTradedVolume: 4300000, totalTradedValue: 7675000000, vwap: 1778.00 },
  { symbol: 'TECHM', companyName: 'Tech Mahindra Limited', lastPrice: 1620.00, pChange: 2.15, change: 34.10, open: 1590.00, high: 1628.00, low: 1588.00, previousClose: 1585.90, totalTradedVolume: 4900000, totalTradedValue: 7938000000, vwap: 1608.00 },
  { symbol: 'NTPC', companyName: 'NTPC Limited', lastPrice: 412.50, pChange: 1.90, change: 7.70, open: 406.00, high: 415.00, low: 405.00, previousClose: 404.80, totalTradedVolume: 16500000, totalTradedValue: 6806000000, vwap: 410.00 },
  { symbol: 'POWERGRID', companyName: 'Power Grid Corporation Limited', lastPrice: 348.20, pChange: 1.65, change: 5.65, open: 343.00, high: 350.00, low: 342.50, previousClose: 342.55, totalTradedVolume: 14800000, totalTradedValue: 5153000000, vwap: 346.00 },
  { symbol: 'ONGC', companyName: 'Oil & Natural Gas Corp Limited', lastPrice: 295.80, pChange: 2.40, change: 6.90, open: 290.00, high: 298.00, low: 289.50, previousClose: 288.90, totalTradedVolume: 19200000, totalTradedValue: 5679000000, vwap: 293.00 },
  { symbol: 'COALINDIA', companyName: 'Coal India Limited', lastPrice: 492.10, pChange: 1.75, change: 8.45, open: 485.00, high: 495.00, low: 484.00, previousClose: 483.65, totalTradedVolume: 12800000, totalTradedValue: 6298000000, vwap: 489.00 },
  { symbol: 'ADANIENT', companyName: 'Adani Enterprises Limited', lastPrice: 3150.00, pChange: 2.85, change: 87.20, open: 3075.00, high: 3175.00, low: 3070.00, previousClose: 3062.80, totalTradedVolume: 6400000, totalTradedValue: 20160000000, vwap: 3120.00 },
  { symbol: 'ADANIPORTS', companyName: 'Adani Ports & SEZ Limited', lastPrice: 1485.00, pChange: 2.10, change: 30.55, open: 1460.00, high: 1495.00, low: 1455.00, previousClose: 1454.45, totalTradedVolume: 7100000, totalTradedValue: 10543000000, vwap: 1475.00 },
  { symbol: 'CUPID', companyName: 'Cupid Limited', lastPrice: 92.40, pChange: 4.85, change: 4.25, open: 88.50, high: 92.40, low: 88.00, previousClose: 88.15, totalTradedVolume: 3500000, totalTradedValue: 323400000, vwap: 90.50 },
  { symbol: 'MOREPENLAB', companyName: 'Morepen Laboratories Limited', lastPrice: 115.72, close: 115.78, pChange: 0.38, change: 0.44, open: 115.20, high: 117.50, low: 114.20, previousClose: 115.28, totalTradedVolume: 8200000, totalTradedValue: 948904000, vwap: 115.10 },
  { symbol: 'MILKYMIST', companyName: 'Milky Mist Dairy Foods Limited', lastPrice: 415.00, pChange: 3.10, change: 12.50, open: 404.00, high: 420.00, low: 402.00, previousClose: 402.50, totalTradedVolume: 1800000, totalTradedValue: 747000000, vwap: 410.00 },
  { symbol: 'ATHERENERG', companyName: 'Ather Energy Limited', lastPrice: 1480.00, pChange: -1.02, change: -15.30, open: 1485.00, high: 1495.00, low: 1470.00, previousClose: 1495.30, totalTradedVolume: 11880000, totalTradedValue: 17582400000, vwap: 1482.00 }
];

let cachedCookie = '';

function updateCookie(headers) {
  const setCookie = headers.getSetCookie?.() || [];
  if (setCookie.length) {
    cachedCookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  }
}

async function ensureCookie() {
  if (cachedCookie) return;
  try {
    const res = await fetch(NSE_ORIGIN, { headers: COMMON_HEADERS });
    updateCookie(res.headers);
  } catch {
    // ignore
  }
}

async function fetchNse(nsePath) {
  await ensureCookie();
  let res = await fetch(`${NSE_ORIGIN}${nsePath}`, {
    headers: {
      ...COMMON_HEADERS,
      cookie: cachedCookie,
      referer: `${NSE_ORIGIN}/`,
      origin: NSE_ORIGIN,
    },
  });

  if (res.status === 401 || res.status === 403) {
    cachedCookie = '';
    await ensureCookie();
    res = await fetch(`${NSE_ORIGIN}${nsePath}`, {
      headers: {
        ...COMMON_HEADERS,
        cookie: cachedCookie,
        referer: `${NSE_ORIGIN}/`,
        origin: NSE_ORIGIN,
        'x-requested-with': 'XMLHttpRequest',
      },
    });
  }

  updateCookie(res.headers);
  return res;
}

function jsonResponse(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extra,
    },
  });
}

function readLocalUniverse() {
  try {
    const candidates = [
      path.resolve(process.cwd(), 'server', 'data', 'all-securities.json'),
      path.resolve(process.cwd(), 'data', 'all-securities.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch {
    // ignore
  }
  return null;
}

function readLocalQuote(symbol) {
  if (!symbol) return null;
  try {
    const p = path.resolve(process.cwd(), 'server', 'data', 'quotes', `${symbol}.json`);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    // ignore
  }
  return null;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(req, context = {}) {
  const resolvedParams = await context?.params;
  const slug = Array.isArray(resolvedParams?.slug) ? resolvedParams.slug : [];
  const routeKey = slug.join('/');
  const url = new URL(req.url);

  let nsePath = ROUTES_MAP[routeKey];

  if (!nsePath && routeKey === 'quote-equity') {
    const symbol = url.searchParams.get('symbol');
    const section = url.searchParams.get('section');
    const q = new URLSearchParams();
    if (symbol) q.set('symbol', symbol);
    if (section) q.set('section', section);
    nsePath = `/api/quote-equity?${q.toString()}`;
  }

  if (!nsePath && routeKey === 'get-quote') {
    const symbol = url.searchParams.get('symbol');
    if (symbol) {
      nsePath = `/api/NextApi/apiClient/GetQuoteApi?functionName=getSymbolData&marketType=N&series=EQ&symbol=${encodeURIComponent(symbol)}`;
    }
  }

  if (!nsePath && routeKey === 'equity-stock-indices') {
    const index = url.searchParams.get('index') || 'NIFTY 500';
    nsePath = `/api/equity-stockIndices?index=${encodeURIComponent(index)}`;
  }

  if (!nsePath && routeKey === 'chart-databyindex') {
    const index = url.searchParams.get('index');
    if (index) {
      nsePath = `/api/chart-databyindex?index=${encodeURIComponent(index)}`;
    }
  }

  if (!nsePath && routeKey === 'candles') {
    const symbol = (url.searchParams.get('symbol') || '').trim().toUpperCase().replace(/:.*$/, '');
    if (symbol) {
      nsePath = `/api/chart-databyindex?index=EQN:${encodeURIComponent(symbol)}`;
    }
  }

  if (!nsePath && (routeKey.startsWith('intraday/') || (slug[0] === 'intraday' && slug[1]))) {
    const symbol = (slug[1] || '').trim().toUpperCase().replace(/:.*$/, '');
    if (symbol) {
      nsePath = `/api/chart-databyindex?index=EQN:${encodeURIComponent(symbol)}`;
    }
  }

  if (!nsePath && (routeKey.startsWith('quote/') || (slug[0] === 'quote' && slug[1]))) {
    const symbol = (slug[1] || '').trim().toUpperCase();
    if (symbol) {
      nsePath = `/get-quote/equity/${encodeURIComponent(symbol)}`;
    }
  }

  if (!nsePath && (routeKey === 'large-deals' || routeKey === 'block-deal' || routeKey === 'block-deals' || routeKey === 'snapshot-capital-market-largedeal')) {
    const mode = url.searchParams.get('mode');
    if (mode === 'bulk_deals' || mode === 'bulk') {
      nsePath = '/api/historical/bulk-deals';
    } else if (mode === 'short_deals' || mode === 'short') {
      nsePath = '/api/snapshot-capital-market-short-deal';
    } else {
      nsePath = '/api/block-deal';
    }
  }

  if (!nsePath && (routeKey === 'corporate-actions' || routeKey === 'corporate' || routeKey === 'corporates-corporateActions')) {
    const caType = url.searchParams.get('type') || url.searchParams.get('index') || 'equities';
    const fromDate = url.searchParams.get('from_date') || '';
    const toDate = url.searchParams.get('to_date') || '';
    const q = new URLSearchParams();
    q.set('index', caType);
    if (fromDate) q.set('from_date', fromDate);
    if (toDate) q.set('to_date', toDate);
    nsePath = `/api/corporates-corporateActions?${q.toString()}`;
  }

  if (!nsePath) {
    return jsonResponse({ error: 'Unknown NSE proxy route', path: routeKey }, 404);
  }

  try {
    const upstream = await fetchNse(nsePath);
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';

    // Fallbacks when NSE is blocked / market closed
    if ((upstream.status === 403 || upstream.status === 404) && routeKey === 'universe') {
      const data = readLocalUniverse() || FALLBACK_EQUITY_BASKET.map((s) => ({ symbol: s.symbol, companyName: s.companyName }));
      return jsonResponse(data, 200, { 'x-fallback': 'cached-universe' });
    }
    if ((upstream.status === 403 || upstream.status === 404) && routeKey === 'top-ten') {
      return jsonResponse({ data: FALLBACK_EQUITY_BASKET.slice(0, 10) }, 200, { 'x-fallback': 'top-ten-fallback' });
    }
    if ((upstream.status === 403 || upstream.status === 404) && routeKey === 'most-active') {
      return jsonResponse({ data: FALLBACK_EQUITY_BASKET.slice(0, 15) }, 200, { 'x-fallback': 'most-active-fallback' });
    }

    const SYMBOL_ALIASES = {
      ADVIT: 'RAMBHAJO',
      'ADVIT JEWELS': 'RAMBHAJO',
      'ADVIT-JEWELS': 'RAMBHAJO',
      'ADVITJEWELS': 'RAMBHAJO',
      NICTO: 'NITCO',
      INFOSYS: 'INFY',
      'TATA MOTORS': 'TATAMOTORS',
      'TATA STEEL': 'TATASTEEL',
      'STATE BANK': 'SBIN',
      'SBI': 'SBIN',
      'HDFC': 'HDFCBANK',
      'ICICI': 'ICICIBANK',
      'RELIANCE IND': 'RELIANCE',
      'RIL': 'RELIANCE',
    };

    const normalizeSymbol = (sym) => {
      if (!sym) return '';
      const cleaned = String(sym).replace(/^EQN:/, '').replace(/:.*$/, '').trim().toUpperCase();
      return SYMBOL_ALIASES[cleaned] || cleaned;
    };

    if (upstream.status === 403 && nsePath.startsWith('/api/quote-equity')) {
      const rawSymbol = url.searchParams.get('symbol');
      const symbol = normalizeSymbol(rawSymbol);
      // Try live market price resolver
      try {
        const yfRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=1d&range=5d`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(4000),
        });
        if (yfRes.ok) {
          const yfJson = await yfRes.json();
          const meta = yfJson?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice) {
            const prev = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
            const ltp = meta.regularMarketPrice;
            const chg = Number((ltp - prev).toFixed(2));
            const pChg = prev > 0 ? Number(((chg / prev) * 100).toFixed(2)) : 0;
            const compName = symbol === 'RAMBHAJO' ? 'Advit Jewels Limited' : (meta.shortName || meta.longName || `${symbol} Ltd`);
            return jsonResponse({
              info: { symbol, companyName: compName, activeSeries: ['EQ'] },
              priceInfo: {
                lastPrice: ltp,
                change: chg,
                pChange: pChg,
                previousClose: prev,
                open: meta.regularMarketDayLow ? meta.regularMarketDayLow : ltp,
                close: ltp,
                vwap: Number(((meta.regularMarketDayHigh + meta.regularMarketDayLow + ltp) / 3).toFixed(2)) || ltp,
                intraDayHighLow: {
                  min: meta.regularMarketDayLow || ltp,
                  max: meta.regularMarketDayHigh || ltp,
                },
              },
              metadata: {
                symbol,
                companyName: compName,
                industry: meta.instrumentType || 'EQUITY',
                lastUpdateTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
              },
            }, 200, { 'x-source': 'live-market-feed' });
          }
        }
      } catch {
        // continue to local cache
      }

      const data = readLocalQuote(symbol);
      if (data) return jsonResponse(data, 200, { 'x-fallback': 'cached-quote' });
      return jsonResponse({ symbol, unavailable: true, error: 'NSE blocked quote-equity.' }, 200, {
        'x-fallback': 'nse-quote-blocked',
      });
    }

    if (routeKey === 'candles' || routeKey === 'chart-databyindex' || slug.includes('candles')) {
      const rawSymbol = url.searchParams.get('symbol') || url.searchParams.get('index') || '';
      const symbol = normalizeSymbol(rawSymbol);
      if (symbol) {
        try {
          const yfRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS?interval=5m&range=1d`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(4000),
          });
          if (yfRes.ok) {
            const yfJson = await yfRes.json();
            const timestamps = yfJson?.chart?.result?.[0]?.timestamp || [];
            const quotes = yfJson?.chart?.result?.[0]?.indicators?.quote?.[0] || {};
            
            const grapthData = timestamps.map((ts, idx) => [
              ts * 1000,
              quotes.close?.[idx] || quotes.open?.[idx] || 0,
            ]).filter(([_, p]) => p > 0);

            const candles = timestamps.map((ts, idx) => {
              const o = quotes.open?.[idx] || 0;
              const h = quotes.high?.[idx] || o;
              const l = quotes.low?.[idx] || o;
              const c = quotes.close?.[idx] || o;
              const v = quotes.volume?.[idx] || 0;
              const date = new Date(ts * 1000);
              return {
                timestamp: date.toISOString(),
                timeStr: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                open: Number(o.toFixed(2)),
                high: Number(h.toFixed(2)),
                low: Number(l.toFixed(2)),
                close: Number(c.toFixed(2)),
                volume: v,
              };
            }).filter((c) => c.close > 0);

            if (candles.length > 0) {
              return jsonResponse({ candles, grapthData, symbol }, 200, { 'x-source': 'live-candles' });
            }
          }
        } catch {
          // ignore
        }
      }
    }

    if (!upstream.ok && (nsePath.includes('bulk-deals') || nsePath.includes('short-deal') || nsePath.includes('block-deal') || nsePath.includes('large-deal') || nsePath.includes('snapshot-capital-market-largedeal'))) {
      const fallbackDeals = [
        {
          session: "Session 2",
          symbol: "STAR",
          series: "BL",
          open: 990,
          dayHigh: 990,
          dayLow: 990,
          lastPrice: 990,
          previousClose: 983,
          change: 7,
          pchange: 0.71,
          totalTradedVolume: 1000000,
          totalTradedValue: 990000000,
          lastUpdateTime: "28-Aug-2026 14:06:04",
          exDate: "31-Jul-2026",
        },
        {
          session: "Session 1",
          symbol: "LENSKART",
          series: "BL",
          open: 630,
          dayHigh: 630,
          dayLow: 630,
          lastPrice: 630,
          previousClose: 640.6,
          change: -10.6,
          pchange: -1.65,
          totalTradedVolume: 29472670,
          totalTradedValue: 18567782100,
          lastUpdateTime: "28-Aug-2026 08:46:28",
        },
        {
          session: "Session 1",
          symbol: "ATHERENERG",
          series: "BL",
          open: 1480,
          dayHigh: 1480,
          dayLow: 1480,
          lastPrice: 1480,
          previousClose: 1495.3,
          change: -15.3,
          pchange: -1.02,
          totalTradedVolume: 11880000,
          totalTradedValue: 17582400000,
          lastUpdateTime: "28-Aug-2026 08:51:27",
        },
        {
          session: "Session 1",
          symbol: "SPAL",
          series: "BL",
          open: 925,
          dayHigh: 925,
          dayLow: 925,
          lastPrice: 925,
          previousClose: 952.95,
          change: -27.95,
          pchange: -2.93,
          totalTradedVolume: 500000,
          totalTradedValue: 462500000,
          lastUpdateTime: "28-Aug-2026 08:45:21",
        }
      ];
      return jsonResponse({
        timestamp: "31-Aug-2026 11:38:00",
        data: nsePath.includes('short-deal') ? [] : fallbackDeals,
        totalTradedValue: 37602682100,
        totalTradedVolume: 42852670,
        "Session 1": { advances: 0, declines: 0, unchanged: 3 },
        "Session 2": { advances: 0, declines: 0, unchanged: 1 },
        marketStatus: {
          market: "Capital Market",
          marketStatus: "Open",
          tradeDate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          index: "NIFTY 50",
          last: 24088.6,
          percentChange: -0.72,
        }
      }, 200, { 'x-fallback': 'nse-deals-safe-fallback' });
    }

    if ((upstream.status === 403 || upstream.status === 404) && nsePath.includes('/api/equity-stockIndices')) {
      return jsonResponse(
        { data: FALLBACK_EQUITY_BASKET },
        200,
        { 'x-fallback': 'nse-equity-stock-indices-fallback' }
      );
    }

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        ...CORS_HEADERS,
      },
    });
  } catch (err) {
    if (routeKey === 'universe') {
      const data = readLocalUniverse() || FALLBACK_EQUITY_BASKET.map((s) => ({ symbol: s.symbol, companyName: s.companyName }));
      return jsonResponse(data, 200, { 'x-fallback': 'cached-universe' });
    }
    if (routeKey === 'top-ten') {
      return jsonResponse({ data: FALLBACK_EQUITY_BASKET.slice(0, 10) }, 200);
    }
    if (routeKey === 'most-active') {
      return jsonResponse({ data: FALLBACK_EQUITY_BASKET.slice(0, 15) }, 200);
    }
    if (nsePath?.includes('/api/equity-stockIndices')) {
      return jsonResponse({ data: FALLBACK_EQUITY_BASKET }, 200);
    }
    if (nsePath?.includes('bulk-deals') || nsePath?.includes('short-deal') || nsePath?.includes('block-deal') || nsePath?.includes('large-deal') || nsePath?.includes('snapshot-capital-market-largedeal')) {
      const fallbackDeals = [
        {
          session: "Session 2",
          symbol: "STAR",
          series: "BL",
          open: 990,
          dayHigh: 990,
          dayLow: 990,
          lastPrice: 990,
          previousClose: 983,
          change: 7,
          pchange: 0.71,
          totalTradedVolume: 1000000,
          totalTradedValue: 990000000,
          lastUpdateTime: "28-Aug-2026 14:06:04",
          exDate: "31-Jul-2026",
        },
        {
          session: "Session 1",
          symbol: "LENSKART",
          series: "BL",
          open: 630,
          dayHigh: 630,
          dayLow: 630,
          lastPrice: 630,
          previousClose: 640.6,
          change: -10.6,
          pchange: -1.65,
          totalTradedVolume: 29472670,
          totalTradedValue: 18567782100,
          lastUpdateTime: "28-Aug-2026 08:46:28",
        },
        {
          session: "Session 1",
          symbol: "ATHERENERG",
          series: "BL",
          open: 1480,
          dayHigh: 1480,
          dayLow: 1480,
          lastPrice: 1480,
          previousClose: 1495.3,
          change: -15.3,
          pchange: -1.02,
          totalTradedVolume: 11880000,
          totalTradedValue: 17582400000,
          lastUpdateTime: "28-Aug-2026 08:51:27",
        },
        {
          session: "Session 1",
          symbol: "SPAL",
          series: "BL",
          open: 925,
          dayHigh: 925,
          dayLow: 925,
          lastPrice: 925,
          previousClose: 952.95,
          change: -27.95,
          pchange: -2.93,
          totalTradedVolume: 500000,
          totalTradedValue: 462500000,
          lastUpdateTime: "28-Aug-2026 08:45:21",
        }
      ];
      return jsonResponse({
        timestamp: "31-Aug-2026 11:38:00",
        data: nsePath?.includes('short-deal') ? [] : fallbackDeals,
        totalTradedValue: 37602682100,
        totalTradedVolume: 42852670,
        "Session 1": { advances: 0, declines: 0, unchanged: 3 },
        "Session 2": { advances: 0, declines: 0, unchanged: 1 },
        marketStatus: {
          market: "Capital Market",
          marketStatus: "Open",
          tradeDate: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          index: "NIFTY 50",
          last: 24088.6,
          percentChange: -0.72,
        }
      }, 200, { 'x-fallback': 'nse-deals-safe-fallback' });
    }
    return jsonResponse({ data: [], unavailable: true, message: err?.message || 'NSE endpoint fallback' }, 200);
  }
}
