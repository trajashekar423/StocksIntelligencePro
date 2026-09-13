'use client';

import React, { useState, useEffect, useCallback } from 'react';

const LiveNewsTicker = ({
  symbol,
  newsData = null,
  mode = 'compact',
  onNewsLoaded,
  autoRefresh = false,
}) => {
  const [headlines, setHeadlines] = useState([]);
  const [sentiment, setSentiment] = useState(null);
  const [loading, setLoading] = useState(!newsData);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchNews = useCallback(async () => {
    if (newsData) {
      const items = newsData.headlines || newsData.classifiedHeadlines || (Array.isArray(newsData) ? newsData : []);
      setHeadlines(items);
      setSentiment(newsData.sentiment || null);
      setLastUpdated(new Date());
      setLoading(false);
      return;
    }

    if (!symbol) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/news?symbol=${symbol}`);
      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }
      const data = await response.json();
      const symData = data.results ? data.results[symbol.toUpperCase()] : data;
      const items = symData?.headlines || [];
      setHeadlines(items);
      setSentiment(symData?.sentiment || null);
      setLastUpdated(new Date());

      if (onNewsLoaded && symData?.sentiment) {
        onNewsLoaded(symData.sentiment);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, newsData, onNewsLoaded]);

  useEffect(() => {
    fetchNews();

    let intervalId;
    if (autoRefresh) {
      intervalId = setInterval(() => {
        fetchNews();
      }, 5 * 60 * 1000); // 5 minutes
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchNews, autoRefresh]);

  const renderSentimentBadge = (sentTag) => {
    const s = (sentTag || sentiment?.overall || '').toUpperCase();
    if (s === 'POSITIVE') {
      return <span className="badge bg-success text-white">🟢 Positive</span>;
    } else if (s === 'NEGATIVE') {
      return <span className="badge bg-danger text-white">🔴 Negative</span>;
    } else {
      return <span className="badge bg-secondary text-white">⚪ Neutral</span>;
    }
  };

  const containerStyle = {
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    fontWeight: 'bold',
  };

  const headlineStyle = {
    textDecoration: 'none',
    color: '#1d4ed8',
    fontWeight: '500',
    fontSize: '0.9rem',
    lineHeight: '1.3',
  };

  const timeStyle = {
    fontSize: '0.75rem',
    color: '#64748b',
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span className="small text-dark">📰 Live News {symbol ? `- ${symbol}` : ''}</span>
        </div>
        <div className="d-flex justify-content-center align-items-center py-2">
          <div className="spinner-border spinner-border-sm text-primary me-2" role="status" aria-hidden="true" />
          <span className="text-muted small">Loading news...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span className="small text-dark">📰 Live News {symbol ? `- ${symbol}` : ''}</span>
        </div>
        <div className="text-danger small">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!headlines || headlines.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span className="small text-dark">📰 Live News {symbol ? `- ${symbol}` : ''}</span>
        </div>
        <div className="text-muted small">
          No live news found.
        </div>
      </div>
    );
  }

  const displayNews = mode === 'expanded' ? headlines.slice(0, 5) : headlines.slice(0, 1);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span className="small text-dark">📰 Live News {symbol ? `- ${symbol}` : ''}</span>
        {lastUpdated && (
          <span style={timeStyle}>Updated: {formatTime(lastUpdated)}</span>
        )}
      </div>

      <div className="d-flex flex-column gap-2">
        {displayNews.map((item, index) => (
          <div
            key={index}
            className="d-flex flex-column gap-1"
            style={{
              borderBottom: index < displayNews.length - 1 ? '1px solid #f1f5f9' : 'none',
              paddingBottom: index < displayNews.length - 1 ? '6px' : '0',
            }}
          >
            <div>
              <a
                href={item.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={headlineStyle}
                className="hover-underline"
              >
                {item.title || item.headline}
              </a>
            </div>
            <div className="d-flex align-items-center gap-2" style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {renderSentimentBadge(item.sentiment)}
              {item.source && <span>• {item.source}</span>}
              {item.publishedAt && (
                <span style={timeStyle}>
                  • {typeof item.publishedAt === 'string' ? item.publishedAt.slice(0, 16) : ''}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveNewsTicker;
