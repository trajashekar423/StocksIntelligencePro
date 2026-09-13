export const dynamic = 'force-dynamic';

export async function GET(req) {
  const url = new URL(req.url);
  const rawSymbol = url.searchParams.get('symbol') || '';
  const symbol = rawSymbol.trim().toUpperCase().replace(/^EQN:/, '').replace(/:.*$/, '');

  if (!symbol) {
    return new Response(JSON.stringify({ error: 'symbol query parameter is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Try real-time stream from Groww Accord API
  try {
    const liveUrl = `https://groww.in/v1/api/stocks_data/v1/accord_points/exchange/NSE/segment/CASH/latest_prices_ohlc/${encodeURIComponent(
      symbol
    )}`;
    const liveRes = await fetch(liveUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    });

    if (liveRes.ok) {
      const d = await liveRes.json();
      if (d && Number(d.ltp) > 0) {
        const price = Number(d.ltp);
        const prev = Number(d.close || d.previousClose || price);
        const open = Number(d.open || price);
        const high = Number(d.high || price);
        const low = Number(d.low || price);
        const chg = Number(d.dayChange || (prev ? price - prev : 0));
        const chgPct = Number(d.dayChangePerc || (prev ? (chg / prev) * 100 : 0));

        const payload = {
          info: { symbol, companyName: `${symbol} Limited`, activeSeries: ['EQ'] },
          priceInfo: {
            lastPrice: price,
            change: Number(chg.toFixed(2)),
            pChange: Number(chgPct.toFixed(2)),
            previousClose: prev,
            open,
            close: price,
            intraDayHighLow: { min: low, max: high },
            vwap: Number(((open + high + low + price) / 4).toFixed(2)),
          },
          metadata: { symbol, companyName: `${symbol} Limited` },
          source: 'LIVE_GROWW_STREAM',
        };

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
  } catch {
    // Continue to Yahoo Finance fallback
  }

  // 2. Try Yahoo Finance fallback
  try {
    const yfRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.NS?interval=1d&range=5d`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(4000),
      }
    );
    if (yfRes.ok) {
      const yfJson = await yfRes.json();
      const meta = yfJson?.chart?.result?.[0]?.meta;
      if (meta?.regularMarketPrice) {
        const ltp = meta.regularMarketPrice;
        const prev = meta.chartPreviousClose || meta.previousClose || ltp;
        const chg = Number((ltp - prev).toFixed(2));
        const pChg = prev > 0 ? Number(((chg / prev) * 100).toFixed(2)) : 0;
        const compName = meta.shortName || meta.longName || `${symbol} Limited`;

        const payload = {
          info: { symbol, companyName: compName, activeSeries: ['EQ'] },
          priceInfo: {
            lastPrice: ltp,
            change: chg,
            pChange: pChg,
            previousClose: prev,
            open: meta.regularMarketDayLow || ltp,
            close: ltp,
            vwap: Number(((meta.regularMarketDayHigh + meta.regularMarketDayLow + ltp) / 3).toFixed(2)) || ltp,
            intraDayHighLow: {
              min: meta.regularMarketDayLow || ltp,
              max: meta.regularMarketDayHigh || ltp,
            },
          },
          metadata: { symbol, companyName: compName },
          source: 'LIVE_YAHOO_STREAM',
        };

        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
  } catch {
    // Fallback
  }

  // 3. Fallback quote response
  return new Response(
    JSON.stringify({
      info: { symbol, companyName: `${symbol} Limited`, activeSeries: ['EQ'] },
      priceInfo: {
        lastPrice: 100,
        change: 0,
        pChange: 0,
        previousClose: 100,
        open: 100,
        close: 100,
        vwap: 100,
        intraDayHighLow: { min: 95, max: 105 },
      },
      metadata: { symbol, companyName: `${symbol} Limited` },
      source: 'FALLBACK',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    }
  );
}

