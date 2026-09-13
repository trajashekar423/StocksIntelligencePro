/**
 * Tests for Live News Sentiment Engine
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyHeadline,
  aggregateStockSentiment,
  sentimentToScannerScore,
} from './newsSentimentEngine.js';

describe('classifyHeadline', () => {
  it('should classify SEBI penalty headline as NEGATIVE', () => {
    const result = classifyHeadline('SEBI Penalty imposed on XYZ Ltd for insider trading violation');
    assert.equal(result.sentiment, 'NEGATIVE');
    assert.ok(result.score < 0, `Expected negative score, got ${result.score}`);
    assert.ok(result.matchedKeywords.length > 0, 'Should have matched keywords');
  });

  it('should classify earnings beat headline as POSITIVE', () => {
    const result = classifyHeadline('RELIANCE Q2 earnings beat estimate with record revenue and margin expansion');
    assert.equal(result.sentiment, 'POSITIVE');
    assert.ok(result.score > 0, `Expected positive score, got ${result.score}`);
  });

  it('should classify neutral headline as NEUTRAL', () => {
    const result = classifyHeadline('Annual General Meeting scheduled for next week');
    assert.equal(result.sentiment, 'NEUTRAL');
    assert.equal(result.score, 0);
    assert.equal(result.matchedKeywords.length, 0);
  });

  it('should classify MSCI deletion as NEGATIVE', () => {
    const result = classifyHeadline('SWIGGY faces MSCI deletion and heavy FII selling pressure');
    assert.equal(result.sentiment, 'NEGATIVE');
    assert.ok(result.score <= -0.2);
  });

  it('should classify order win + upgrade as POSITIVE', () => {
    const result = classifyHeadline('TATASTEEL wins large order from railways, analysts upgrade to buy rating');
    assert.equal(result.sentiment, 'POSITIVE');
    assert.ok(result.score >= 0.2);
  });

  it('should handle empty/null input gracefully', () => {
    assert.equal(classifyHeadline('').sentiment, 'NEUTRAL');
    assert.equal(classifyHeadline(null).sentiment, 'NEUTRAL');
    assert.equal(classifyHeadline(undefined).sentiment, 'NEUTRAL');
  });

  it('should classify crash + selloff as strongly NEGATIVE', () => {
    const result = classifyHeadline('Markets crash amid heavy selling, bloodbath on Dalal Street as bears dominate');
    assert.equal(result.sentiment, 'NEGATIVE');
    assert.ok(result.score <= -0.5, `Expected strongly negative, got ${result.score}`);
  });

  it('should classify mixed headlines with more negatives as NEGATIVE', () => {
    const result = classifyHeadline('Despite revenue growth, profit decline and margin pressure weigh on outlook negative');
    assert.equal(result.sentiment, 'NEGATIVE');
    assert.ok(result.score < 0);
  });
});

describe('aggregateStockSentiment', () => {
  it('should aggregate mixed headlines correctly', () => {
    const headlines = [
      { title: 'SWIGGY faces MSCI deletion and FII selling pressure' },
      { title: 'Swiggy expands quick commerce with new launch in Tier 2 cities' },
      { title: 'SWIGGY quarterly loss widens amid margin pressure' },
    ];
    const result = aggregateStockSentiment(headlines);
    assert.equal(result.overallSentiment, 'NEGATIVE');
    assert.ok(result.overallScore < 0);
    assert.equal(result.totalHeadlines, 3);
    assert.ok(result.negativeCount >= 2);
    assert.ok(result.topHeadline !== null);
  });

  it('should return NEUTRAL for empty headlines array', () => {
    const result = aggregateStockSentiment([]);
    assert.equal(result.overallSentiment, 'NEUTRAL');
    assert.equal(result.overallScore, 0);
    assert.equal(result.totalHeadlines, 0);
  });

  it('should give higher weight to recent (earlier index) headlines', () => {
    // First headline is positive (recent), rest are neutral
    const headlines = [
      { title: 'RELIANCE earnings beat estimate with record revenue surge' },
      { title: 'Board meeting held on Tuesday' },
      { title: 'Company filed annual report with registrar' },
    ];
    const result = aggregateStockSentiment(headlines);
    assert.equal(result.overallSentiment, 'POSITIVE');
    assert.ok(result.overallScore > 0);
  });

  it('should classify all-positive headlines as POSITIVE', () => {
    const headlines = [
      { title: 'INFY upgrade to buy rating by Goldman Sachs, target raised' },
      { title: 'Infosys wins large order from European client, revenue growth outlook positive' },
    ];
    const result = aggregateStockSentiment(headlines);
    assert.equal(result.overallSentiment, 'POSITIVE');
    assert.ok(result.overallScore >= 0.3);
    assert.equal(result.positiveCount, 2);
    assert.equal(result.negativeCount, 0);
  });
});

describe('sentimentToScannerScore', () => {
  it('should map -1.0 to 0 for long scoring', () => {
    assert.equal(sentimentToScannerScore(-1.0), 0);
  });

  it('should map 0 to 50 for long scoring', () => {
    assert.equal(sentimentToScannerScore(0), 50);
  });

  it('should map +1.0 to 100 for long scoring', () => {
    assert.equal(sentimentToScannerScore(1.0), 100);
  });

  it('should invert for short scoring: -1.0 → 100', () => {
    assert.equal(sentimentToScannerScore(-1.0, true), 100);
  });

  it('should invert for short scoring: +1.0 → 0', () => {
    assert.equal(sentimentToScannerScore(1.0, true), 0);
  });

  it('should clamp values to 0-100 range', () => {
    assert.ok(sentimentToScannerScore(-2.0) >= 0);
    assert.ok(sentimentToScannerScore(2.0) <= 100);
  });
});
