'use client';

import React, { useMemo, useState, Fragment } from 'react';
import { getScoreRowClass } from './marketIntelligence';
import BuyerDemandMeter from './BuyerDemandMeter';

function formatCell(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function getSectorCategory(symbol = '', sector = '', companyName = '') {
  const sym = String(symbol).toUpperCase().trim();
  const sec = String(sector).toLowerCase();
  const comp = String(companyName).toLowerCase();

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
    ['PAISALO', 'JISLJALEQS', 'MUTHOOTFIN', 'MANAPPURAM', 'BAJFINANCE', 'CHOLAFIN', 'SHRIRAMFIN', 'POONAWALLA', 'M&MFIN'].includes(sym) ||
    sec.includes('nbfc') || sec.includes('finance') || sec.includes('banking') || sec.includes('lending') ||
    comp.includes('finance') || comp.includes('capital') || (comp.includes('ltd') && comp.includes('credit'))
  ) {
    return '🏦 NBFC & Finance';
  }

  // 4. Defense, Tech & IT
  if (
    ['CENTUM', 'XTRANET', 'TEJASNET', 'JUSTDIAL', 'AMBER', 'KFINTECH', 'DATAPATT', 'HAL', 'BEL', 'BDL', 'MAZDOCK'].includes(sym) ||
    sec.includes('tech') || sec.includes('electronics') || sec.includes('defense') || sec.includes('telecom') || sec.includes('software') ||
    comp.includes('tech') || comp.includes('electronics') || comp.includes('software')
  ) {
    return '💻 Defense, Tech & IT';
  }

  // 5. Pipes, Infra & Capital Goods
  if (
    ['TEXMOPIPES', 'DBEIL', 'CGNRL', 'CORDSCABLE', 'POWERGRID', 'ADANIENT', 'ADANIPORTS', 'LT'].includes(sym) ||
    sec.includes('pipe') || sec.includes('infra') || sec.includes('power') || sec.includes('cable') || sec.includes('energy') ||
    comp.includes('pipe') || comp.includes('infra') || comp.includes('power') || comp.includes('cable')
  ) {
    return '🏭 Infra, Pipes & Energy';
  }

  // 6. Pharma & Healthcare
  if (
    ['STAR', 'SUNPHARMA', 'CIPLA', 'DRREDDY', 'LUPIN', 'DIVISLAB', 'TORNTPHARM'].includes(sym) ||
    sec.includes('pharma') || sec.includes('health') || sec.includes('bio') || comp.includes('pharma')
  ) {
    return '💊 Pharma & Healthcare';
  }

  // 7. Auto & EV Mobility
  if (
    ['TATAMOTORS', 'MARUTI', 'M&M', 'HEROMOTOCO', 'BAJAJ-AUTO', 'ATHERENERG', 'MOTHERSON'].includes(sym) ||
    sec.includes('auto') || comp.includes('motor') || comp.includes('auto')
  ) {
    return '🚗 Auto & EV Mobility';
  }

  // 8. ETFs & Index Funds
  if (sym.includes('ETF') || sym.includes('MONQ50') || sym.includes('BEES') || sec.includes('etf')) {
    return '📊 Index ETF / Fund';
  }

  return sector || (companyName ? companyName.slice(0, 18) : 'NSE Equities');
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows, columns) {
  const escape = (value) => `"${formatCell(value).replace(/"/g, '""')}"`;
  return [
    columns.map((column) => escape(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => escape(row[column.key])).join(',')),
  ].join('\n');
}

function toExcelHtml(rows, columns) {
  const cells = rows.map((row) => (
    `<tr>${columns.map((column) => `<td>${formatCell(row[column.key])}</td>`).join('')}</tr>`
  )).join('');
  return `<table><thead><tr>${columns.map((column) => `<th>${column.label}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table>`;
}

export default function MarketIntelligenceTable({
  rows,
  columns,
  title,
  loading,
  error,
  noDataMessage = 'No data',
  onRowClick,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [sorts, setSorts] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [visible, setVisible] = useState(() => new Set(columns.map((column) => column.key)));
  const [groupView, setGroupView] = useState('CATEGORIZED'); // 'CATEGORIZED' | 'FLAT'

  const visibleColumns = useMemo(
    () => columns.filter((column) => visible.has(column.key)),
    [columns, visible]
  );

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    const filterText = filter.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const rowText = columns.map((column) => formatCell(row[column.key])).join(' ').toLowerCase();
      return (!search || rowText.includes(search)) && (!filterText || rowText.includes(filterText));
    });

    return filtered.sort((a, b) => {
      for (const sort of sorts) {
        const av = a[sort.key];
        const bv = b[sort.key];
        const an = Number(av);
        const bn = Number(bv);
        const result = Number.isFinite(an) && Number.isFinite(bn)
          ? an - bn
          : formatCell(av).localeCompare(formatCell(bv));
        if (result !== 0) return sort.direction === 'asc' ? result : -result;
      }
      return 0;
    });
  }, [rows, columns, query, filter, sorts]);

  // Grouping & Trending Business Category Detection
  const { sectorGroups, topTrendingSector } = useMemo(() => {
    const map = new Map();

    filteredRows.forEach((row) => {
      const category = getSectorCategory(row.symbol, row.sector, row.companyName);
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category).push(row);
    });

    const groups = [];
    map.forEach((items, category) => {
      const count = items.length;
      const avgChange = Number((items.reduce((acc, r) => acc + Number(r.changePercent || 0), 0) / count).toFixed(2));
      const ucCount = items.filter((r) => r.isLockedInUC || r.isNearUC || String(r.liveSignal).includes('CIRCUIT')).length;
      const totalVolumeRatio = Number((items.reduce((acc, r) => acc + Number(r.volumeRatio || 1), 0) / count).toFixed(1));

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
  }, [filteredRows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(columnKey, multi) {
    setSorts((current) => {
      const existing = current.find((sort) => sort.key === columnKey);
      const nextSort = existing?.direction === 'asc'
        ? { key: columnKey, direction: 'desc' }
        : existing?.direction === 'desc'
          ? null
          : { key: columnKey, direction: 'asc' };
      const without = current.filter((sort) => sort.key !== columnKey);
      if (!nextSort) return multi ? without : [];
      return multi ? [...without, nextSort] : [nextSort];
    });
  }

  function toggleColumn(columnKey) {
    setVisible((current) => {
      const next = new Set(current);
      if (next.has(columnKey)) next.delete(columnKey);
      else next.add(columnKey);
      return next.size ? next : current;
    });
  }

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        {title ? <h5 className="mb-0 me-auto">{title}</h5> : <div className="me-auto" />}

        <input
          className="form-control form-control-sm"
          placeholder="Search"
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          style={{ width: 180 }}
        />

        <input
          className="form-control form-control-sm"
          placeholder="Filter"
          value={filter}
          onChange={(event) => {
            setPage(1);
            setFilter(event.target.value);
          }}
          style={{ width: 160 }}
        />

        <select
          className="form-select form-select-sm"
          value={pageSize}
          onChange={(event) => {
            setPage(1);
            setPageSize(Number(event.target.value));
          }}
          style={{ width: 90 }}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>

        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => downloadFile(`${title || 'market-intelligence'}.csv`, toCsv(filteredRows, visibleColumns), 'text/csv;charset=utf-8')}
        >
          CSV
        </button>

        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => downloadFile(`${title || 'market-intelligence'}.xls`, toExcelHtml(filteredRows, visibleColumns), 'application/vnd.ms-excel')}
        >
          Excel
        </button>

        {/* Category Grouping View Mode Switcher */}
        <div className="btn-group btn-group-sm shadow-sm rounded-pill overflow-hidden border ms-auto ms-md-0">
          <button
            type="button"
            className={`btn fw-bold px-2.5 py-1 ${groupView === 'CATEGORIZED' ? 'btn-primary text-white' : 'btn-light text-dark'}`}
            onClick={() => setGroupView('CATEGORIZED')}
            title="Group Stocks by Business Category & Sector"
          >
            📂 Grouped by Sector
          </button>
          <button
            type="button"
            className={`btn fw-bold px-2.5 py-1 ${groupView === 'FLAT' ? 'btn-primary text-white' : 'btn-light text-dark'}`}
            onClick={() => setGroupView('FLAT')}
            title="Flat All Stocks List"
          >
            📊 All Stocks List
          </button>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-2 small">
        {columns.map((column) => (
          <label key={column.key} className="form-check-label">
            <input
              className="form-check-input me-1"
              type="checkbox"
              checked={visible.has(column.key)}
              onChange={() => toggleColumn(column.key)}
            />
            {column.label}
          </label>
        ))}
      </div>

      {/* 🔥 TODAY'S #1 TRENDING BUSINESS SECTOR HERO BANNER */}
      {topTrendingSector && groupView === 'CATEGORIZED' && (
        <div className="p-3 rounded-3 mb-3 border border-warning border-opacity-50 text-white shadow-sm" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #31103f 100%)' }}>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="badge bg-warning text-dark fw-bold px-2.5 py-1.5 fs-6 shadow-sm">
                🔥 TODAY'S #1 TRENDING BUSINESS SECTOR
              </span>
              <h5 className="mb-0 fw-bold text-warning">{topTrendingSector.category}</h5>
              <span className="badge bg-danger text-white fw-bold">
                {topTrendingSector.count} Stocks Active Today
              </span>
            </div>
            <div className="d-flex align-items-center gap-3 small flex-wrap">
              <span className="text-light">Avg Sector Gain: <strong className="text-success fs-6">+{topTrendingSector.avgChange}%</strong></span>
              {topTrendingSector.ucCount > 0 && (
                <span className="badge bg-danger text-white fw-bold px-2.5 py-1 fs-6">
                  🔒 {topTrendingSector.ucCount} Upper Circuit Freeze{topTrendingSector.ucCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="placeholder-glow">
          <span className="placeholder col-12 mb-2" />
          <span className="placeholder col-10 mb-2" />
          <span className="placeholder col-11 mb-2" />
        </div>
      ) : error ? (
        <div className="alert alert-warning">{error}</div>
      ) : !filteredRows.length ? (
        <div className="text-muted">{noDataMessage}</div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table table-striped table-bordered table-sm align-middle">
              <thead className="position-sticky top-0" style={{ zIndex: 10 }}>
                <tr>
                  {visibleColumns.map((column) => {
                    const sort = sorts.find((item) => item.key === column.key);
                    return (
                      <th
                        key={column.key}
                        role="button"
                        onClick={(event) => toggleSort(column.key, event.shiftKey)}
                      >
                        {column.label}
                        {sort ? ` ${sort.direction === 'asc' ? '↑' : '↓'}` : ''}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {groupView === 'CATEGORIZED' ? (
                  sectorGroups.map((group) => (
                    <React.Fragment key={group.category}>
                      {/* Business Category Section Header */}
                      <tr>
                        <td colSpan={visibleColumns.length} className="py-2.5 px-3 bg-dark text-warning border-top border-bottom border-warning border-opacity-50">
                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <div className="d-flex align-items-center gap-2">
                              <span className="fs-6 fw-bold text-warning">📂 {group.category}</span>
                              <span className="badge bg-warning text-dark fw-bold">{group.count} Stocks</span>
                              {group === topTrendingSector && (
                                <span className="badge bg-danger text-white fw-bold">🔥 TODAY'S TOP TRENDING SECTOR</span>
                              )}
                            </div>
                            <div className="d-flex align-items-center gap-3 small text-light">
                              <span>Avg Sector Gain: <strong className={group.avgChange >= 0 ? 'text-success' : 'text-danger'}>+{group.avgChange}%</strong></span>
                              {group.ucCount > 0 && (
                                <span className="badge bg-danger text-white fw-bold">🔒 {group.ucCount} Upper Circuit</span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Category Rows */}
                      {group.items.map((row, index) => (
                        <tr
                          key={row.id || `${row.symbol || 'row'}-${index}`}
                          className={getScoreRowClass(Number(row.score ?? row.scannerScore ?? 0))}
                          onClick={() => onRowClick?.(row)}
                          style={{ cursor: onRowClick ? 'pointer' : undefined }}
                        >
                          {visibleColumns.map((column) => (
                            <td key={column.key}>
                              {column.key === 'symbol' ? (
                                <div>
                                  <strong className="text-dark d-block fs-6">{row.symbol}</strong>
                                  <span className="badge bg-light text-dark border font-monospace mt-0.5" style={{ fontSize: '0.7rem' }}>
                                    {getSectorCategory(row.symbol, row.sector, row.companyName)}
                                  </span>
                                </div>
                              ) : column.key === 'badges' ? (
                                <span className="d-flex flex-wrap gap-1">
                                  {(row.badges || []).map((badge) => (
                                    <span key={badge} className="badge text-bg-secondary">{badge}</span>
                                  ))}
                                </span>
                              ) : column.key === 'liveSignal' ? (
                                row.liveSignal === 'STRONG_SELLING' ? (
                                  <span className="badge bg-danger text-white fw-bold px-2 py-1 shadow-sm">
                                    {row.liveSignalText || '🔴 STRONG SELLING (Below VWAP)'}
                                  </span>
                                ) : row.liveSignal === 'LOCKED_CIRCUIT' ? (
                                  <span className="badge bg-danger text-white fw-bold px-2 py-1 shadow-sm">
                                    {row.liveSignalText || '🔒 LOCKED IN UC'}
                                  </span>
                                ) : row.liveSignal === 'NEAR_UC_ALERT' ? (
                                  <span className="badge bg-warning text-dark fw-bold px-2 py-1 border border-danger shadow-sm">
                                    {row.liveSignalText || '⚡ NEAR UPPER CIRCUIT'}
                                  </span>
                                ) : row.liveSignal === 'STRONG_BUY' ? (
                                  <span className="badge bg-success text-white fw-bold px-2 py-1 shadow-sm">
                                    {row.liveSignalText || '🟢 STRONG BUY'}
                                  </span>
                                ) : (
                                  <span className="badge bg-secondary text-white fw-semibold px-2 py-0.5">
                                    {row.liveSignalText || '🟡 WATCH'}
                                  </span>
                                )
                              ) : column.key === 'buyerMeter' ? (
                                <BuyerDemandMeter stock={row} compact />
                              ) : column.key === 'profitActionAdvice' ? (
                                <span className={row.liveSignal === 'STRONG_SELLING' ? 'text-danger fw-bold small' : 'text-success fw-bold small'}>
                                  {row.profitActionAdvice || formatCell(row[column.key])}
                                </span>
                              ) : column.key === 'circuitStatus' ? (
                                row.isLockedInUC ? (
                                  <span className="badge bg-danger text-white px-2 py-0.5 fw-bold">Locked</span>
                                ) : row.isNearUC ? (
                                  <span className="badge bg-warning text-dark px-2 py-0.5 fw-bold">{row.distToUcPct}% to UC</span>
                                ) : (
                                  <span className="text-muted small">Normal ({row.distToUcPct || 5}%)</span>
                                )
                              ) : column.key === 'vwap' ? (
                                <div>
                                  <strong className={row.price < row.vwap ? 'text-danger' : 'text-success'}>
                                    ₹{Number(row.vwap || 0).toFixed(2)}
                                  </strong>
                                  <small className="d-block" style={{ fontSize: 10, color: row.price < row.vwap ? '#dc3545' : '#198754' }}>
                                    {row.price < row.vwap ? '⚠️ Below' : '✓ Above'}
                                  </small>
                                </div>
                              ) : column.key === 'stopLoss' && row.stopLoss ? (
                                <span className="badge bg-danger text-white fw-bold px-2 py-1 shadow-sm">
                                  ₹{Number(row.stopLoss).toFixed(2)}
                                </span>
                              ) : column.key === 'target1' && row.target1 ? (
                                <span className="badge bg-success text-white fw-bold px-2 py-1 shadow-sm">
                                  ₹{Number(row.target1).toFixed(2)}
                                </span>
                              ) : (
                                formatCell(row[column.key])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                ) : (
                  pageRows.map((row, index) => (
                    <tr
                      key={row.id || `${row.symbol || 'row'}-${index}`}
                      className={getScoreRowClass(Number(row.score ?? row.scannerScore ?? 0))}
                      onClick={() => onRowClick?.(row)}
                      style={{ cursor: onRowClick ? 'pointer' : undefined }}
                    >
                      {visibleColumns.map((column) => (
                        <td key={column.key}>
                          {column.key === 'symbol' ? (
                            <div>
                              <strong className="text-dark d-block fs-6">{row.symbol}</strong>
                              <span className="badge bg-light text-dark border font-monospace mt-0.5" style={{ fontSize: '0.7rem' }}>
                                {getSectorCategory(row.symbol, row.sector, row.companyName)}
                              </span>
                            </div>
                          ) : column.key === 'badges' ? (
                            <span className="d-flex flex-wrap gap-1">
                              {(row.badges || []).map((badge) => (
                                <span key={badge} className="badge text-bg-secondary">{badge}</span>
                              ))}
                            </span>
                          ) : column.key === 'liveSignal' ? (
                            row.liveSignal === 'STRONG_SELLING' ? (
                              <span className="badge bg-danger text-white fw-bold px-2 py-1 shadow-sm">
                                {row.liveSignalText || '🔴 STRONG SELLING (Below VWAP)'}
                              </span>
                            ) : row.liveSignal === 'LOCKED_CIRCUIT' ? (
                              <span className="badge bg-danger text-white fw-bold px-2 py-1 shadow-sm">
                                {row.liveSignalText || '🔒 LOCKED IN UC'}
                              </span>
                            ) : row.liveSignal === 'NEAR_UC_ALERT' ? (
                              <span className="badge bg-warning text-dark fw-bold px-2 py-1 border border-danger shadow-sm">
                                {row.liveSignalText || '⚡ NEAR UPPER CIRCUIT'}
                              </span>
                            ) : row.liveSignal === 'STRONG_BUY' ? (
                              <span className="badge bg-success text-white fw-bold px-2 py-1 shadow-sm">
                                {row.liveSignalText || '🟢 STRONG BUY'}
                              </span>
                            ) : (
                              <span className="badge bg-secondary text-white fw-semibold px-2 py-0.5">
                                {row.liveSignalText || '🟡 WATCH'}
                              </span>
                            )
                          ) : column.key === 'buyerMeter' ? (
                            <BuyerDemandMeter stock={row} compact />
                          ) : column.key === 'profitActionAdvice' ? (
                            <span className={row.liveSignal === 'STRONG_SELLING' ? 'text-danger fw-bold small' : 'text-success fw-bold small'}>
                              {row.profitActionAdvice || formatCell(row[column.key])}
                            </span>
                          ) : column.key === 'circuitStatus' ? (
                            row.isLockedInUC ? (
                              <span className="badge bg-danger text-white px-2 py-0.5 fw-bold">Locked</span>
                            ) : row.isNearUC ? (
                              <span className="badge bg-warning text-dark px-2 py-0.5 fw-bold">{row.distToUcPct}% to UC</span>
                            ) : (
                              <span className="text-muted small">Normal ({row.distToUcPct || 5}%)</span>
                            )
                          ) : column.key === 'vwap' ? (
                            <div>
                              <strong className={row.price < row.vwap ? 'text-danger' : 'text-success'}>
                                ₹{Number(row.vwap || 0).toFixed(2)}
                              </strong>
                              <small className="d-block" style={{ fontSize: 10, color: row.price < row.vwap ? '#dc3545' : '#198754' }}>
                                {row.price < row.vwap ? '⚠️ Below' : '✓ Above'}
                              </small>
                            </div>
                          ) : column.key === 'stopLoss' && row.stopLoss ? (
                            <span className="badge bg-danger text-white fw-bold px-2 py-1 shadow-sm">
                              ₹{Number(row.stopLoss).toFixed(2)}
                            </span>
                          ) : column.key === 'target1' && row.target1 ? (
                            <span className="badge bg-success text-white fw-bold px-2 py-1 shadow-sm">
                              ₹{Number(row.target1).toFixed(2)}
                            </span>
                          ) : (
                            formatCell(row[column.key])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between align-items-center small">
            <span>{filteredRows.length} rows</span>
            <div className="btn-group btn-group-sm">
              <button type="button" className="btn btn-outline-secondary" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Prev
              </button>
              <button type="button" className="btn btn-outline-secondary" disabled>
                {safePage}/{pageCount}
              </button>
              <button type="button" className="btn btn-outline-secondary" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
