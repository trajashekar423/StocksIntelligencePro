import { getNSEParts } from '../utils/nseTime.js';
function formatError(status, text) {
  return {
    ok: false,
    status,
    error: text || `Request failed with status ${status}`,
  };
}

function normalizeTopTen(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.allSec?.data)) return data.allSec.data;
  if (Array.isArray(data?.FOSec?.data)) return data.FOSec.data;
  if (Array.isArray(data?.data)) return data.data;
  return data;
}

function normalizeMostActive(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return data;
}

function normalizeUniverse(data) {
  if (Array.isArray(data)) {
    return data.map((item) => {
      if (typeof item === 'string') return { symbol: item, companyName: item };
      return {
        symbol: item.SYMBOL || item.Symbol || item.symbol || '',
        companyName: item['NAME OF COMPANY'] || item['Name of Company'] || item.companyName || item.NAMEDESC || '',
      };
    }).filter((item) => item.symbol);
  }

  return [];
}

export async function fetchTopTen() {
  const endpoint = '/api/nse/top-ten';
  const res = await fetch(endpoint);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (res.ok) {
    if (ct.includes('application/json')) {
      const text = await res.text();
      if (!text || !text.trim()) return { ok: true, data: normalizeTopTen(null) };
      try {
        const parsed = JSON.parse(text);
        return { ok: true, data: normalizeTopTen(parsed) };
      } catch (err) {
        return { ok: true, data: normalizeTopTen(text) };
      }
    }

    const text = await res.text();
    return { ok: true, data: text || 'No Top Ten data returned.' };
  }
  const text = await res.text();
  return formatError(res.status, text);
}

export async function fetchMostActive() {
  const endpoint = '/api/nse/most-active';
  const res = await fetch(endpoint);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (res.ok) {
    if (ct.includes('application/json')) {
      const text = await res.text();
      if (!text || !text.trim()) return { ok: true, data: normalizeMostActive(null) };
      try {
        const parsed = JSON.parse(text);
        return { ok: true, data: normalizeMostActive(parsed) };
      } catch (err) {
        return { ok: true, data: normalizeMostActive(text) };
      }
    }

    const text = await res.text();
    return { ok: true, data: text || 'No Most Active data returned.' };
  }
  const text = await res.text();
  return formatError(res.status, text);
}

export async function fetchMarketStatus() {
  const endpoint = '/api/nse/market-status';
  const res = await fetch(endpoint);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (res.ok) {
    if (ct.includes('application/json')) {
      const text = await res.text();
      if (!text || !text.trim()) return { ok: true, data: null };
      try {
        return { ok: true, data: JSON.parse(text) };
      } catch (err) {
        return { ok: true, data: text };
      }
    }

    return { ok: true, data: await res.text() };
  }
  const text = await res.text();
  return formatError(res.status, text);
}

export async function fetchAllIndices() {
  const endpoint = '/api/nse/all-indices';
  const res = await fetch(endpoint);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (res.ok) {
    if (ct.includes('application/json')) {
      const text = await res.text();
      if (!text || !text.trim()) return { ok: true, data: null };
      try {
        return { ok: true, data: JSON.parse(text) };
      } catch (err) {
        return { ok: true, data: text };
      }
    }

    return { ok: true, data: await res.text() };
  }
  const text = await res.text();
  return formatError(res.status, text);
}

export async function fetchStockQuote(symbol, section) {
  const params = new URLSearchParams({ symbol });
  if (section) params.set('section', section);
  const endpoint = `/api/quote-equity?${params.toString()}`;
  const res = await fetch(endpoint);
  const ct = (res.headers.get('content-type') || '').toLowerCase();

  if (!res.ok) {
    const text = await res.text();
    return formatError(res.status, text);
  }

  const fallback = res.headers.get('x-fallback');

  if (ct.includes('application/json')) {
    const text = await res.text();
    if (!text || !text.trim()) return { ok: true, data: null };
    try {
      const parsed = JSON.parse(text);
      return {
        ok: fallback !== 'nse-quote-blocked',
        data: parsed,
        fallback,
      };
    } catch (err) {
      return { ok: true, data: text };
    }
  }

  const text = await res.text();
  return { ok: true, data: text || null };
}

export async function fetchNseGetQuote(symbol) {
  const params = new URLSearchParams({ symbol });
  const endpoint = `/api/get-quote?${params.toString()}`;
  try {
    const res = await fetch(endpoint);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) {
      const text = await res.text();
      return formatError(res.status, text);
    }

    if (ct.includes('application/json')) {
      const text = await res.text();
      if (!text || !text.trim()) return { ok: true, data: null };
      try {
        return { ok: true, data: JSON.parse(text) };
      } catch (err) {
        return { ok: true, data: text };
      }
    }

    const text = await res.text();
    return { ok: true, data: text || null };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function fetchChartDataByIndex(index) {
  try {
    const endpoint = `/api/nse/chart-databyindex?index=${encodeURIComponent(index)}`;
    const res = await fetch(endpoint);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) {
      const text = await res.text();
      return formatError(res.status, text);
    }

    if (ct.includes('application/json')) {
      const text = await res.text();
      try {
        return { ok: true, data: JSON.parse(text) };
      } catch (err) {
        return { ok: true, data: text };
      }
    }

    const text = await res.text();
    return { ok: true, data: text || null };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function fetchUniverse() {
  const endpoint = '/api/nse/universe';
  try {
    const res = await fetch(endpoint);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) return { ok: false, status: res.status, error: await res.text() };

    const text = await res.text();
    if (!text) return { ok: true, data: [] };

    if (ct.includes('application/json')) {
      try {
        return { ok: true, data: normalizeUniverse(JSON.parse(text)) };
      } catch (err) {
        return { ok: true, data: [] };
      }
    }

    // CSV from NSE: first line headers, subsequent lines SYMBOL,NAME OF COMPANY,SERIES, etc.
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return { ok: true, data: [] };

    const headers = lines[0].split(',').map((h) => h.replace(/\"/g, '').trim());
    const rows = lines.slice(1).map((line) => {
      const parts = line.split(',');
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]] = (parts[i] || '').replace(/\"/g, '').trim();
      }
      return obj;
    });

    // Filter equities only (Series EQ) and exclude indices/ETFs by series if present
    const equities = rows.filter((r) => {
      const series = (r.Series || r.series || '').toUpperCase();
      const symbol = (r.SYMBOL || r.Symbol || r.symbol || '').toString().trim();
      if (!symbol) return false;
      if (series && series !== 'EQ') return false;
      // exclude typical non-equity suffixes
      if (/ETF|BE|MF|INDEX|INI|IND|GIFT/.test(symbol)) return false;
      return true;
    }).map((r) => ({ symbol: r.SYMBOL || r.Symbol || r.symbol, companyName: r['NAME OF COMPANY'] || r['Name of Company'] || r.NAMEDESC || '' }));

    // Deduplicate symbols
    const seen = new Set();
    const uniq = [];
    equities.forEach((e) => {
      const s = (e.symbol || '').toString().trim();
      if (!s) return;
      if (seen.has(s)) return;
      seen.add(s);
      uniq.push(e);
    });

    return { ok: true, data: uniq };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

/**
 * Bulk quote snapshot for an entire NSE index basket in a single request
 * (e.g. 'NIFTY 500', 'NIFTY MIDCAP 150', 'NIFTY SMALLCAP 250').
 * This is what lets the scanner see live price/volume for hundreds of
 * universe symbols at once instead of only NSE Top Ten / Most Active —
 * no symbol is hard-coded, the index name is just a broader basket.
 */
export async function fetchEquityStockIndices(indexName) {
  try {
    const endpoint = `/api/nse/equity-stock-indices?index=${encodeURIComponent(indexName)}`;
    const res = await fetch(endpoint);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) return { ok: false, status: res.status, error: await res.text(), data: [] };
    const text = await res.text();
    if (!text || !text.trim()) return { ok: true, data: [] };
    if (ct.includes('application/json')) {
      try {
        const parsed = JSON.parse(text);
        const rows = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];
        return { ok: true, data: rows };
      } catch {
        return { ok: true, data: [] };
      }
    }
    return { ok: true, data: [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), data: [] };
  }
}

/**
 * Broad candidate baskets used to enrich the universe with live quotes.
 * Each is fetched independently and merged; a failure in one basket
 * does not block the others (Promise.allSettled).
 */
export const SCANNER_QUOTE_BASKETS = ['NIFTY 500', 'NIFTY MIDCAP 150', 'NIFTY SMALLCAP 250'];

export async function fetchLargeDeals(mode) {
  try {
    const params = new URLSearchParams({ mode });
    const endpoint = `/api/nse/large-deals?${params.toString()}`;
    const res = await fetch(endpoint);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) {
      const text = await res.text();
      return formatError(res.status, text);
    }

    if (ct.includes('application/json')) {
      const text = await res.text();
      if (!text || !text.trim()) return { ok: true, data: [] };
      try {
        return { ok: true, data: JSON.parse(text) };
      } catch (err) {
        return { ok: true, data: [] };
      }
    }

    return { ok: true, data: await res.text() };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function fetchStockCandles(symbol) {
  const sym = String(symbol || '').trim().toUpperCase().replace(/:.*$/, '');
  if (!sym) return { ok: false, error: 'No symbol provided', data: [] };
  try {
    const endpoint = `/api/nse/candles?symbol=${encodeURIComponent(sym)}`;
    const res = await fetch(endpoint);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, error: text, symbol: sym, data: [] };
    }
    if (ct.includes('application/json')) {
      const text = await res.text();
      if (!text || !text.trim()) return { ok: true, symbol: sym, data: [] };
      try {
        return { ok: true, symbol: sym, data: JSON.parse(text) };
      } catch {
        return { ok: true, symbol: sym, data: [] };
      }
    }
    return { ok: true, symbol: sym, data: [] };
  } catch (err) {
    return { ok: false, symbol: sym, error: err?.message || String(err), data: [] };
  }
}

/**
 * Normalized intraday candle fetch — uses /api/nse/intraday/:symbol
 * Returns { ok, symbol, candles: [{timestamp,open,high,low,close,volume}], error }
 */
export async function fetchIntradayCandles(symbol) {
  const sym = String(symbol || '').trim().toUpperCase().replace(/^NSE:/, '').replace(/\.NS$/, '').replace(/:.*$/, '');
  if (!sym) return { ok: false, symbol: sym, candles: [], error: 'No symbol' };
  try {
    const res = await fetch(`/api/nse/intraday/${encodeURIComponent(sym)}`);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();
    if (!res.ok) return { ok: false, symbol: sym, candles: [], error: `HTTP ${res.status}`, raw: text };
    if (!ct.includes('application/json')) return { ok: false, symbol: sym, candles: [], error: 'Non-JSON response', raw: text };
    if (!text.trim()) return { ok: true, symbol: sym, candles: [], error: 'Empty response' };
    try {
      return { ok: true, symbol: sym, raw: JSON.parse(text), candles: [] };
    } catch (err) {
      return { ok: false, symbol: sym, candles: [], error: 'Invalid JSON response' };
    }
  } catch (err) {
    return { ok: false, symbol: sym, candles: [], error: err?.message || String(err) };
  }
}

/**
 * Batch fetch candles for multiple symbols — returns Map<symbol, rawData>
 */
export async function fetchIntradayCandlesBatch(symbols, concurrency = 4) {
  const result = new Map();
  const unique = [...new Set(symbols.map((s) => String(s || '').trim().toUpperCase().replace(/:.*$/, '')).filter(Boolean))];
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((sym) => fetchIntradayCandles(sym)));
    results.forEach((r, idx) => {
      const sym = batch[idx];
      result.set(sym, r.status === 'fulfilled' ? r.value : { ok: false, symbol: sym, candles: [], error: 'fetch failed' });
    });
  }
  return result;
}

/**
 * NSE market session status based on IST time.
 * Returns { isMarketOpen, isPreOpen, isPostMarket, isTradingDay, status, tradingDate }
 */
export function getMarketSessionStatus() {
  const now = getNSEParts();
  const totalMin = now.minutes;
  const isTradingDay = now.dayOfWeek !== 'Sat' && now.dayOfWeek !== 'Sun';
  const isPreOpen = isTradingDay && totalMin >= 540 && totalMin < 555;
  const isMarketOpen = isTradingDay && totalMin >= 555 && totalMin < 930;
  const isPostMarket = isTradingDay && totalMin >= 930 && totalMin < 960;

  let status = 'CLOSED';
  if (!isTradingDay) status = 'WEEKEND';
  else if (isPreOpen) status = 'PRE_OPEN';
  else if (isMarketOpen) status = 'OPEN';
  else if (isPostMarket) status = 'POST_MARKET';

  return {
    isMarketOpen, isPreOpen, isPostMarket, isTradingDay, status,
    tradingDate: now.date, istTime: now.shortTime, istDateTime: now.time,
  };
}

export async function fetchScannerMarketData() {
  // Primary universe = all eligible NSE equities from /api/nse/universe
  // Top-ten / most-active / broad index baskets are supplementary quote
  // enrichment ONLY — they never define or restrict the candidate universe.
  // Any universe stock that gets a live quote from ANY of these sources is
  // eligible to be scanned and rank #1, whether or not it's a "top" stock.
  try {
    const basketPromises = SCANNER_QUOTE_BASKETS.map((name) => fetchEquityStockIndices(name));
    const [uniRes, topRes, mostRes, ...basketRes] = await Promise.all([
      fetchUniverse(),
      fetchTopTen(),
      fetchMostActive(),
      ...basketPromises,
    ]);
    const universe = Array.isArray(uniRes?.data) ? uniRes.data : [];
    const top = Array.isArray(topRes?.data) ? topRes.data : [];
    const most = Array.isArray(mostRes?.data) ? mostRes.data : [];
    const baskets = basketRes.flatMap((r) => (Array.isArray(r?.data) ? r.data : []));

    // Build supplementary quote map for price/volume enrichment.
    // Broad index baskets are merged first (widest coverage), then
    // top-ten/most-active override with their (usually fresher) values.
    const quoteMap = new Map();
    [...baskets, ...top, ...most].forEach((row) => {
      const sym = String(row?.symbol || row?.Symbol || '').trim().toUpperCase();
      if (!sym) return;
      quoteMap.set(sym, { ...(quoteMap.get(sym) || {}), ...row });
    });

    if (universe.length) {
      const universeSyms = new Set();
      const merged = universe.map((u) => {
        const sym = String(u.symbol || '').trim().toUpperCase();
        universeSyms.add(sym);
        const quote = quoteMap.get(sym) || {};
        return { ...quote, ...u, symbol: sym };
      });
      // Include any top/most-active/basket rows not already in universe
      [...top, ...most, ...baskets].forEach((row) => {
        const sym = String(row?.symbol || row?.Symbol || '').trim().toUpperCase();
        if (sym && !universeSyms.has(sym)) { merged.push({ ...row, symbol: sym }); universeSyms.add(sym); }
      });
      return { ok: true, data: merged };
    }

    // Fallback: universe unavailable — use whatever quote sources responded (degraded mode)
    const seen = new Set();
    const deduped = [...top, ...most, ...baskets].filter((r) => {
      const sym = String(r?.symbol || r?.Symbol || '').trim().toUpperCase();
      if (!sym || seen.has(sym)) return false;
      seen.add(sym); return true;
    });
    return { ok: Boolean(topRes?.ok || mostRes?.ok || baskets.length), data: deduped, degraded: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
