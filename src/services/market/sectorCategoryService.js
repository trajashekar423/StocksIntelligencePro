/**
 * Centralized Business & Industry Sector Category Classifier & Grouping Engine
 */

export function getSectorCategory(symbol = '', sector = '', companyName = '') {
  const sym = String(symbol || '').toUpperCase().trim();
  const sec = String(sector || '').toLowerCase();
  const comp = String(companyName || '').toLowerCase();

  // 1. Gems & Jewellery
  if (
    ['PCJEWELLER', 'MVGJL', 'RADHIKAJWE', 'KALYANKJIL', 'TRIBHOVANDAS', 'THANGAMAYL', 'SENCO', 'TITAN', 'DPABHUSHAN', 'PNGS', 'GOLD'].includes(sym) ||
    sec.includes('jewel') || sec.includes('gems') || sec.includes('gold') || sec.includes('diamond') ||
    comp.includes('jewel') || comp.includes('gems') || comp.includes('gold') || comp.includes('abhushan')
  ) {
    return '💎 Gems & Jewellery';
  }

  // 2. Sugar & Agro / Ethanol
  if (
    ['RENUKA', 'BALRAMCHIN', 'TRIVENI', 'DHAMPURSUG', 'DWARKESH', 'EIDPARRY', 'UTAMSUGAR', 'DALMIASUG', 'AVADHSUG', 'MAGADSUGAR'].includes(sym) ||
    sec.includes('sugar') || sec.includes('agro') || sec.includes('ethanol') ||
    comp.includes('sugar') || comp.includes('agro') || comp.includes('ethanol')
  ) {
    return '🍬 Sugar & Agro / Ethanol';
  }

  // 3. NBFC & Financial Services
  if (
    ['PAISALO', 'JISLJALEQS', 'MUTHOOTFIN', 'MANAPPURAM', 'BAJFINANCE', 'CHOLAFIN', 'SHRIRAMFIN', 'POONAWALLA', 'M&MFIN', 'PAYTM', 'BANDHANBNK', 'INDUSINDBK'].includes(sym) ||
    sec.includes('nbfc') || sec.includes('finance') || sec.includes('bank') || sec.includes('lending') ||
    comp.includes('finance') || comp.includes('capital') || comp.includes('bank') || (comp.includes('ltd') && comp.includes('credit'))
  ) {
    return '🏦 NBFC & Financial Services';
  }

  // 4. Defense, Tech & IT Services
  if (
    ['CYIENTDLM', 'CENTUM', 'XTRANET', 'TEJASNET', 'JUSTDIAL', 'AMBER', 'KFINTECH', 'DATAPATT', 'HAL', 'BEL', 'BDL', 'MAZDOCK', 'DELHIVERY', 'ZEEL'].includes(sym) ||
    sec.includes('tech') || sec.includes('electronics') || sec.includes('defense') || sec.includes('telecom') || sec.includes('software') || sec.includes('media') ||
    comp.includes('tech') || comp.includes('electronics') || comp.includes('software') || comp.includes('networks')
  ) {
    return '💻 Defense, Tech & Media';
  }

  // 5. Pipes, Infrastructure & Energy
  if (
    ['GREENPOWER', 'ORIENTGREEN', 'TEXMOPIPES', 'DBEIL', 'CGNRL', 'CORDSCABLE', 'POWERGRID', 'ADANIENT', 'ADANIPORTS', 'VEDL', 'LT'].includes(sym) ||
    sec.includes('pipe') || sec.includes('infra') || sec.includes('power') || sec.includes('cable') || sec.includes('energy') || sec.includes('metal') ||
    comp.includes('pipe') || comp.includes('infra') || comp.includes('power') || comp.includes('cable') || comp.includes('energy')
  ) {
    return '🏭 Infra, Pipes & Energy';
  }

  // 6. Pharma, Healthcare & Chemicals
  if (
    ['STAR', 'SUNPHARMA', 'CIPLA', 'DRREDDY', 'LUPIN', 'DIVISLAB', 'TORNTPHARM', 'BODALCHEM', 'PAR'].includes(sym) ||
    sec.includes('pharma') || sec.includes('health') || sec.includes('chem') || sec.includes('bio') ||
    comp.includes('pharma') || comp.includes('chem')
  ) {
    return '💊 Pharma & Specialty Chemicals';
  }

  // 7. Auto & EV Mobility
  if (
    ['TATAMOTORS', 'MARUTI', 'M&M', 'HEROMOTOCO', 'BAJAJ-AUTO', 'ATHERENERG', 'MOTHERSON', 'BATAINDIA'].includes(sym) ||
    sec.includes('auto') || sec.includes('ev') || comp.includes('motor') || comp.includes('auto')
  ) {
    return '🚗 Auto & EV Mobility';
  }

  // 8. ETFs & Index Funds
  if (sym.includes('ETF') || sym.includes('MONQ50') || sym.includes('BEES') || sec.includes('etf')) {
    return '📊 Index ETF / Fund';
  }

  return sector || (companyName ? companyName.slice(0, 22) : 'NSE Equities');
}

/**
 * Groups a stock list by business sector category and detects the top trending sector
 */
export function groupStocksBySector(stockList = []) {
  const map = new Map();

  stockList.forEach((stock) => {
    const category = getSectorCategory(stock.symbol, stock.sector, stock.companyName);
    if (!map.has(category)) {
      map.set(category, []);
    }
    map.get(category).push(stock);
  });

  const groups = [];
  map.forEach((items, category) => {
    const count = items.length;
    const avgChange = Number((items.reduce((acc, r) => acc + Number(r.changePercent || r.dayGainPct || r.pChange || 0), 0) / count).toFixed(2));
    const ucCount = items.filter((r) => r.isLockedInUC || r.isNearUC || String(r.liveSignal || r.signal || '').includes('CIRCUIT')).length;
    const totalVolumeRatio = Number((items.reduce((acc, r) => acc + Number(r.volumeRatio || r.rvol || 1), 0) / count).toFixed(1));

    groups.push({
      category,
      items,
      count,
      avgChange,
      ucCount,
      totalVolumeRatio,
    });
  });

  // Sort groups: most Upper Circuits and highest avg gain first
  groups.sort((a, b) => b.ucCount - a.ucCount || b.avgChange - a.avgChange);

  const topTrendingSector = groups.length > 0 && groups[0].count >= 1 ? groups[0] : null;

  return { sectorGroups: groups, topTrendingSector };
}

