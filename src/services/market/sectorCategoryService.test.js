import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { getSectorCategory, groupStocksBySector } from './sectorCategoryService.js';

describe('Sector Category Service', () => {
  test('accurately classifies Gems & Jewellery stocks', () => {
    assert.equal(getSectorCategory('PCJEWELLER'), '💎 Gems & Jewellery');
    assert.equal(getSectorCategory('MVGJL'), '💎 Gems & Jewellery');
    assert.equal(getSectorCategory('RADHIKAJWE'), '💎 Gems & Jewellery');
    assert.equal(getSectorCategory('TITAN'), '💎 Gems & Jewellery');
  });

  test('accurately classifies Sugar & Agro stocks', () => {
    assert.equal(getSectorCategory('RENUKA'), '🍬 Sugar & Agro / Ethanol');
    assert.equal(getSectorCategory('BALRAMCHIN'), '🍬 Sugar & Agro / Ethanol');
  });

  test('accurately classifies NBFC & Financial stocks', () => {
    assert.equal(getSectorCategory('PAISALO'), '🏦 NBFC & Financial Services');
    assert.equal(getSectorCategory('BAJFINANCE'), '🏦 NBFC & Financial Services');
  });

  test('groups stock list and identifies #1 trending sector', () => {
    const list = [
      { symbol: 'PCJEWELLER', changePercent: 19.9, isLockedInUC: true },
      { symbol: 'MVGJL', changePercent: 19.9, isLockedInUC: true },
      { symbol: 'PAISALO', changePercent: 9.9, isLockedInUC: true },
      { symbol: 'CENTUM', changePercent: 4.5 },
    ];

    const { sectorGroups, topTrendingSector } = groupStocksBySector(list);
    assert.equal(sectorGroups.length, 3);
    assert.equal(topTrendingSector.category, '💎 Gems & Jewellery');
    assert.equal(topTrendingSector.count, 2);
    assert.equal(topTrendingSector.ucCount, 2);
  });
});

