/**
 * Live News API Route
 * 
 * Server-side news aggregator that fetches headlines from Google News RSS
 * and classifies sentiment using the newsSentimentEngine.
 * 
 * Endpoints:
 *   GET /api/news?symbol=SWIGGY          → Single stock news
 *   GET /api/news?symbols=SWIGGY,PAYTM   → Batch stock news
 * 
 * Returns:
 *   { results: { [symbol]: { headlines, sentiment } }, fetchedAt }
 */
import { NextResponse } from 'next/server';
import {
  classifyHeadline,
  aggregateStockSentiment,
} from '../../../src/services/news/newsSentimentEngine.js';

// ── In-Memory Cache (5-minute TTL per symbol) ──
const newsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedNews(symbol) {
  const cached = newsCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

function setCachedNews(symbol, data) {
  newsCache.set(symbol, { data, timestamp: Date.now() });
}

/**
 * Parses Google News RSS XML response into headline objects.
 * Simple XML parsing without external dependencies.
 */
function parseRSSXml(xmlText) {
  const headlines = [];
  
  // Extract all <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];
    
    // Extract title
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const title = titleMatch ? (titleMatch[1] || titleMatch[2] || '').trim() : '';
    
    // Extract link
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
    const url = linkMatch ? linkMatch[1].trim() : '';
    
    // Extract pubDate
    const dateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    const publishedAt = dateMatch ? dateMatch[1].trim() : '';
    
    // Extract source
    const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/);
    const source = sourceMatch ? sourceMatch[1].trim() : 'Google News';
    
    if (title) {
      // Clean HTML entities from title
      const cleanTitle = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, ''); // Strip any remaining HTML tags
      
      headlines.push({
        title: cleanTitle,
        url,
        publishedAt,
        source,
      });
    }
  }
  
  return headlines;
}

/**
 * Fetches news headlines for a single stock symbol from Google News RSS.
 */
async function fetchGoogleNewsForSymbol(symbol) {
  const query = encodeURIComponent(`${symbol} NSE stock India`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.warn(`[NewsAPI] Google News returned ${response.status} for ${symbol}`);
      return [];
    }
    
    const xmlText = await response.text();
    const headlines = parseRSSXml(xmlText);
    
    // Limit to most recent 15 headlines
    return headlines.slice(0, 15);
  } catch (err) {
    console.warn(`[NewsAPI] Failed to fetch Google News for ${symbol}:`, err.message);
    return [];
  }
}

/**
 * Fetches and classifies news for a single symbol.
 * Uses cache when available.
 */
async function getNewsForSymbol(symbol) {
  const upperSymbol = symbol.toUpperCase().trim();
  
  // Check cache first
  const cached = getCachedNews(upperSymbol);
  if (cached) {
    return { ...cached, fromCache: true };
  }
  
  // Fetch from Google News RSS
  const rawHeadlines = await fetchGoogleNewsForSymbol(upperSymbol);
  
  // Classify each headline
  const classifiedHeadlines = rawHeadlines.map(h => ({
    ...h,
    ...classifyHeadline(h.title),
  }));
  
  // Aggregate sentiment
  const sentiment = aggregateStockSentiment(rawHeadlines);
  
  const result = {
    symbol: upperSymbol,
    headlines: classifiedHeadlines,
    sentiment: {
      overall: sentiment.overallSentiment,
      score: sentiment.overallScore,
      positiveCount: sentiment.positiveCount,
      negativeCount: sentiment.negativeCount,
      neutralCount: sentiment.neutralCount,
      totalHeadlines: sentiment.totalHeadlines,
      topHeadline: sentiment.topHeadline,
    },
    fetchedAt: new Date().toISOString(),
    fromCache: false,
  };
  
  // Cache the result
  setCachedNews(upperSymbol, result);
  
  return result;
}

/**
 * GET /api/news?symbol=SWIGGY
 * GET /api/news?symbols=SWIGGY,PAYTM,RELIANCE
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const singleSymbol = searchParams.get('symbol');
    const multiSymbols = searchParams.get('symbols');
    
    if (!singleSymbol && !multiSymbols) {
      return NextResponse.json(
        { error: 'Missing required parameter: symbol or symbols' },
        { status: 400 }
      );
    }
    
    const symbols = singleSymbol
      ? [singleSymbol]
      : multiSymbols.split(',').map(s => s.trim()).filter(Boolean);
    
    if (symbols.length === 0) {
      return NextResponse.json(
        { error: 'No valid symbols provided' },
        { status: 400 }
      );
    }
    
    // Cap at 10 symbols per request to prevent abuse
    const cappedSymbols = symbols.slice(0, 10);
    
    // Fetch news for all symbols (with small delay between requests to avoid rate limiting)
    const results = {};
    for (let i = 0; i < cappedSymbols.length; i++) {
      const sym = cappedSymbols[i];
      results[sym.toUpperCase()] = await getNewsForSymbol(sym);
      
      // Small delay between requests (only for non-cached requests)
      if (i < cappedSymbols.length - 1 && !results[sym.toUpperCase()]?.fromCache) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    
    return NextResponse.json({
      results,
      symbolCount: cappedSymbols.length,
      fetchedAt: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
    });
  } catch (err) {
    console.error('[NewsAPI] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch news', details: err.message },
      { status: 500 }
    );
  }
}
