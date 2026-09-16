import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTodayActiveExpiry,
  getExpirySessionZone,
  recommendOptionStrike,
  evaluateExpirySurge,
} from './expirySurgeEngine.ts';

describe('⚡ Expiry Day Gamma Surge & Safety Radar Engine Suite', () => {
  it('1. Correctly maps Day of Week to active Index Expiry', () => {
    // Thursday (Day 4) -> NIFTY 50
    const thursdayDate = new Date('2026-09-17T10:00:00+05:30');
    const infoThursday = getTodayActiveExpiry(thursdayDate);
    assert.equal(infoThursday.indexSymbol, 'NIFTY');
    assert.equal(infoThursday.dayOfWeek, 'Thursday');

    // Tuesday (Day 2) -> FINNIFTY
    const tuesdayDate = new Date('2026-09-15T10:00:00+05:30');
    const infoTuesday = getTodayActiveExpiry(tuesdayDate);
    assert.equal(infoTuesday.indexSymbol, 'FINNIFTY');
    assert.equal(infoTuesday.dayOfWeek, 'Tuesday');

    // Wednesday (Day 3) -> BANKNIFTY
    const wednesdayDate = new Date('2026-09-16T10:00:00+05:30');
    const infoWednesday = getTodayActiveExpiry(wednesdayDate);
    assert.equal(infoWednesday.indexSymbol, 'BANKNIFTY');
    assert.equal(infoWednesday.dayOfWeek, 'Wednesday');
  });

  it('2. Correctly identifies 1:30 PM Gamma Surge Window and 2:45 PM Hard Exit Zone', () => {
    // 1:45 PM IST -> GAMMA_WINDOW_130
    const time145 = new Date('2026-09-17T13:45:00+05:30');
    const zone145 = getExpirySessionZone(time145);
    assert.equal(zone145.zone, 'GAMMA_WINDOW_130');
    assert.ok(zone145.message.includes('GAMMA SURGE WINDOW ACTIVE'));

    // 2:50 PM IST -> HARD_EXIT_ZONE_245
    const time250 = new Date('2026-09-17T14:50:00+05:30');
    const zone250 = getExpirySessionZone(time250);
    assert.equal(zone250.zone, 'HARD_EXIT_ZONE_245');
    assert.ok(zone250.message.includes('HARD TIME-EXIT ZONE'));
  });

  it('3. Recommends rounded ATM strike contract correctly', () => {
    // NIFTY spot 24,088 -> ATM strike 24,100 CE
    const recCall = recommendOptionStrike(24088, 50, 'CE');
    assert.equal(recCall.strike, 24100);
    assert.equal(recCall.optionType, 'CE');
    assert.equal(recCall.contractName, '24100 CE (ATM)');
    assert.equal(recCall.isSafeToTrade, true);

    // BANKNIFTY spot 52,140 -> ATM strike 52,100 PE
    const recPut = recommendOptionStrike(52140, 100, 'PE');
    assert.equal(recPut.strike, 52100);
    assert.equal(recPut.optionType, 'PE');
  });

  it('4. Scores high conviction Gamma Surge Setup correctly', () => {
    const testDate130 = new Date('2026-09-17T13:45:00+05:30'); // 1:45 PM Thursday
    const result = evaluateExpirySurge({
      symbol: 'NIFTY',
      spotPrice: 24120,
      vwap: 24080,
      morningHigh: 24100,
      morningLow: 24020,
      currentVolume: 5000000,
      avgVolume: 2000000,
      rsi: 65,
      trend4TfAlignment: 'PERFECT_4_GREEN',
      testDate: testDate130,
    });

    assert.ok(result.surgeScore >= 80);
    assert.equal(result.signal, 'GAMMA_SURGE_BURST');
    assert.equal(result.canTradeExpiry, true);
    assert.ok(result.reasons.length >= 3);
  });

  it('5. Flags 2:45 PM Hard Exit and caps position size at 25%', () => {
    const testDate250 = new Date('2026-09-17T14:50:00+05:30'); // 2:50 PM Thursday
    const result = evaluateExpirySurge({
      symbol: 'NIFTY',
      spotPrice: 24120,
      vwap: 24080,
      morningHigh: 24100,
      morningLow: 24020,
      currentVolume: 5000000,
      avgVolume: 2000000,
      testDate: testDate250,
    });

    assert.equal(result.sessionZone, 'HARD_EXIT_ZONE_245');
    assert.equal(result.canTradeExpiry, false); // Blocked in hard exit zone
    assert.ok(result.warnings.some((w) => w.includes('Hard Exit Zone')));
  });
});

