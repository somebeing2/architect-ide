import type { DataProfileType } from './DataProfile';

function sigStars(p: number | null): string {
  if (p === null) return '';
  if (p < 0.001) return '***';
  if (p < 0.01)  return '**';
  if (p < 0.05)  return '*';
  return '';
}

function corrLabel(r: number): string {
  const a = Math.abs(r);
  const dir = r > 0 ? 'positive' : 'negative';
  if (a > 0.8)  return `Very strong ${dir}`;
  if (a > 0.6)  return `Strong ${dir}`;
  if (a > 0.4)  return `Moderate ${dir}`;
  if (a > 0.2)  return `Weak ${dir}`;
  return 'Negligible';
}

function sparkBars(bins: { count: number }[], maxW = 120, h = 28): string {
  if (!bins.length) return '';
  const maxC = Math.max(...bins.map(b => b.count), 1);
  const bw = maxW / bins.length;
  const rects = bins.map((b, i) => {
    const bh = Math.max((b.count / maxC) * h, 1);
    const y = h - bh;
    return `<rect x="${(i * bw + 0.5).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${bh.toFixed(1)}" fill="#60a5fa" rx="1"/>`;
  }).join('');
  return `<svg width="${maxW}" height="${h}" style="display:block">${rects}</svg>`;
}

function topValuesBars(tvs: { value: string; count: number; percent?: number }[]): string {
  if (!tvs.length) return '';
  const maxC = Math.max(...tvs.map(v => v.count), 1);
  return tvs.slice(0, 6).map(tv => {
    const pct = ((tv.count / maxC) * 100).toFixed(0);
    const dispPct = tv.percent != null ? `${tv.percent.toFixed(1)}%` : tv.count.toString();
    return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:2px">
      <span style="width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#94a3b8" title="${tv.value}">${tv.value}</span>
      <div style="flex:1;height:8px;background:#1e293b;border-radius:4px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:#a855f7;border-radius:4px"></div>
      </div>
      <span style="font-family:monospace;color:#64748b;width:40px;text-align:right">${dispPct}</span>
    </div>`;
  }).join('');
}

export function generateHtmlReport(profile: DataProfileType, filename = 'dataset'): string {
  const ts = new Date().toLocaleString();
  const numCols  = profile.columns.filter(c => c.inferredType === 'numeric');
  const catCols  = profile.columns.filter(c => c.inferredType === 'categorical');
  const dtCols   = profile.columns.filter(c => c.inferredType === 'datetime');
  const nullCols = profile.columns.filter(c => c.nullPercent > 0).sort((a, b) => b.nullPercent - a.nullPercent);

  // Top correlation pairs
  const topPairs: { a: string; b: string; r: number; pv: number | null }[] = [];
  if (profile.correlationLabels.length >= 2) {
    profile.correlationLabels.forEach((a, i) => {
      profile.correlationLabels.forEach((b, j) => {
        if (j <= i) return;
        const r = profile.correlationMatrix[i]?.[j];
        if (r != null) topPairs.push({ a, b, r, pv: profile.pearsonPValues[i]?.[j] ?? null });
      });
    });
    topPairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  }

  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    h2 { font-size: 15px; font-weight: 600; color: #94a3b8; margin: 24px 0 10px; border-bottom: 1px solid #1e293b; padding-bottom: 6px; }
    h3 { font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin-bottom: 20px; }
    .stat-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; }
    .stat-card .val { font-size: 20px; font-weight: 700; color: #f1f5f9; }
    .stat-card .lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
    .cols-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
    .col-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; }
    .col-head { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
    .col-name { font-size: 13px; font-weight: 600; color: #f1f5f9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 4px; border: 1px solid; white-space: nowrap; }
    .badge-num  { background: rgba(59,130,246,.15); color: #60a5fa; border-color: rgba(59,130,246,.3); }
    .badge-cat  { background: rgba(168,85,247,.15); color: #c084fc; border-color: rgba(168,85,247,.3); }
    .badge-date { background: rgba(34,197,94,.15);  color: #4ade80; border-color: rgba(34,197,94,.3); }
    .badge-bool { background: rgba(234,179,8,.15);  color: #fbbf24; border-color: rgba(234,179,8,.3); }
    .badge-id   { background: rgba(100,116,139,.15); color: #94a3b8; border-color: rgba(100,116,139,.3); }
    .badge-text { background: rgba(249,115,22,.15);  color: #fb923c; border-color: rgba(249,115,22,.3); }
    .badge-card { font-size:9px; padding:1px 5px; border-radius:3px; }
    .badge-card-low    { background:rgba(34,197,94,.15);  color:#4ade80; }
    .badge-card-medium { background:rgba(234,179,8,.15);  color:#fbbf24; }
    .badge-card-high   { background:rgba(249,115,22,.15); color:#fb923c; }
    .badge-card-unique { background:rgba(239,68,68,.15);  color:#f87171; }
    .stats-table { width: 100%; font-size: 11px; border-collapse: collapse; margin-top: 6px; }
    .stats-table td { padding: 2px 4px; }
    .stats-table td:first-child { color: #64748b; }
    .stats-table td:last-child  { font-family: monospace; color: #f1f5f9; text-align: right; }
    .null-bar { height: 4px; background: #1e293b; border-radius: 2px; overflow: hidden; margin-top: 4px; }
    .null-fill { height: 100%; border-radius: 2px; }
    .warn { display: flex; align-items: flex-start; gap: 6px; background: rgba(234,179,8,.08); border: 1px solid rgba(234,179,8,.25); border-radius: 6px; padding: 6px 8px; font-size: 11px; color: #fbbf24; margin-top: 6px; }
    .insight { padding: 7px 10px; border-radius: 6px; margin-bottom: 6px; font-size: 12px; border-left: 3px solid; }
    .insight-red    { background: rgba(239,68,68,.08);  border-color: #ef4444; color: #fca5a5; }
    .insight-yellow { background: rgba(234,179,8,.08);  border-color: #eab308; color: #fde047; }
    .insight-blue   { background: rgba(59,130,246,.08); border-color: #3b82f6; color: #93c5fd; }
    .insight-green  { background: rgba(34,197,94,.08);  border-color: #22c55e; color: #86efac; }
    .corr-table { width: 100%; font-size: 11px; border-collapse: collapse; }
    .corr-table th { text-align: left; padding: 4px 8px; color: #64748b; font-weight: 500; border-bottom: 1px solid #334155; }
    .corr-table td { padding: 4px 8px; border-bottom: 1px solid #1e293b; }
    .corr-pos { color: #60a5fa; }
    .corr-neg { color: #f87171; }
    .sig { color: #86efac; }
    .section { margin-bottom: 32px; }
    .footer { font-size: 11px; color: #475569; margin-top: 32px; padding-top: 12px; border-top: 1px solid #1e293b; }
  `;

  const badgeClass = (t: string) => ({
    numeric: 'badge-num', categorical: 'badge-cat', datetime: 'badge-date',
    boolean: 'badge-bool', id: 'badge-id', text: 'badge-text',
  }[t] ?? 'badge-id');

  const cardClass = (c?: string) => ({
    low: 'badge-card-low', medium: 'badge-card-medium', high: 'badge-card-high', unique: 'badge-card-unique',
  }[c ?? ''] ?? '');

  const typeLabel = (t: string) => ({
    numeric: 'NUM', categorical: 'CAT', datetime: 'DATE', boolean: 'BOOL', id: 'ID', text: 'TEXT',
  }[t] ?? t.toUpperCase());

  const nullColor = (pct: number) =>
    pct > 50 ? '#ef4444' : pct > 20 ? '#f97316' : pct > 5 ? '#eab308' : '#22c55e';

  const colCards = profile.columns.map(col => {
    const nullFill = `<div class="null-bar"><div class="null-fill" style="width:${col.nullPercent}%;background:${nullColor(col.nullPercent)}"></div></div>`;
    const statsRows = col.stats ? [
      ['Mean', col.stats.mean?.toFixed(3)], ['Median', col.stats.median?.toFixed(3)],
      ['Std Dev', col.stats.std?.toFixed(3)], ['Min', col.stats.min?.toFixed(3)],
      ['Max', col.stats.max?.toFixed(3)], ['IQR', col.stats.iqr?.toFixed(3)],
      ['Skewness', col.stats.skewness?.toFixed(3)], ['CV%', col.stats.cv?.toFixed(1)],
    ].filter(([, v]) => v != null).map(([l, v]) =>
      `<tr><td>${l}</td><td>${v}</td></tr>`
    ).join('') : '';

    const hist = col.histogram?.length ? sparkBars(col.histogram) : '';
    const tvBars = col.topValues?.length ? topValuesBars(col.topValues) : '';
    const whitespaceWarn = (col.whitespaceCount ?? 0) > 0
      ? `<div class="warn">⚠ ${col.whitespaceCount} values have leading/trailing whitespace</div>` : '';
    const mixedWarn = col.mixedTypeCount != null
      ? `<div class="warn" style="border-color:rgba(249,115,22,.25);color:#fb923c">⚠ Mixed types: ${col.mixedTypeNumericCount} numeric + ${col.mixedTypeCount} non-numeric</div>` : '';
    const outlierNote = (col.outlierCount ?? 0) > 0
      ? `<div style="font-size:11px;color:#fb923c;margin-top:4px">⚠ ${col.outlierCount} IQR outlier(s) detected</div>` : '';
    const normalNote = col.isNormal != null
      ? `<div style="font-size:10px;color:${col.isNormal ? '#4ade80' : '#fb923c'};margin-top:3px">${col.isNormal ? '✓ Normal distribution' : '✗ Non-normal distribution'}</div>` : '';

    return `
    <div class="col-card">
      <div class="col-head">
        <span class="col-name" title="${col.name}">${col.name}</span>
        <span class="badge ${badgeClass(col.inferredType)}">${typeLabel(col.inferredType)}</span>
        ${col.cardinality ? `<span class="badge badge-card ${cardClass(col.cardinality)}">${col.cardinality}</span>` : ''}
      </div>
      <div style="font-size:11px;color:#64748b;margin-bottom:4px">
        ${col.uniqueCount} unique · ${col.nullPercent}% null · ${col.count} rows
      </div>
      ${nullFill}
      ${statsRows ? `<table class="stats-table"><tbody>${statsRows}</tbody></table>` : ''}
      ${hist ? `<div style="margin-top:8px">${hist}</div>` : ''}
      ${tvBars ? `<div style="margin-top:8px"><div style="font-size:10px;color:#64748b;margin-bottom:3px">Top values</div>${tvBars}</div>` : ''}
      ${outlierNote}${normalNote}${whitespaceWarn}${mixedWarn}
      ${col.suggestions?.length ? `<ul style="margin-top:6px;padding-left:14px;font-size:10px;color:#fbbf24">${col.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
    </div>`;
  }).join('');

  const corrRows = topPairs.slice(0, 20).map(p => {
    const stars = sigStars(p.pv);
    const cls = Math.abs(p.r) > 0.4 ? (p.r > 0 ? 'corr-pos' : 'corr-neg') : '';
    return `<tr>
      <td>${p.a}</td><td>${p.b}</td>
      <td class="${cls}">${p.r.toFixed(4)}</td>
      <td class="sig">${stars}</td>
      <td style="color:#64748b">${corrLabel(p.r)}</td>
    </tr>`;
  }).join('');

  const insightRows = (() => {
    const rows: string[] = [];
    const constCols = profile.columns.filter(c => c.isConstant);
    if (constCols.length) rows.push(`<div class="insight insight-red">🔴 <strong>${constCols.length} constant column(s)</strong> — safe to drop: ${constCols.map(c => c.name).join(', ')}</div>`);
    const highNull = profile.columns.filter(c => c.nullPercent > 30);
    if (highNull.length) rows.push(`<div class="insight insight-yellow">🟡 <strong>${highNull.length} column(s)</strong> with &gt;30% missing data: ${highNull.map(c => `${c.name} (${c.nullPercent}%)`).join(', ')}</div>`);
    const outlierCols = profile.columns.filter(c => (c.outlierCount ?? 0) > 0);
    if (outlierCols.length) rows.push(`<div class="insight insight-yellow">🟡 <strong>${outlierCols.length} column(s)</strong> have IQR outliers: ${outlierCols.map(c => `${c.name} (${c.outlierCount})`).join(', ')}</div>`);
    if (topPairs[0] && Math.abs(topPairs[0].r) > 0.7) rows.push(`<div class="insight insight-blue">🔵 Strong correlation between <strong>${topPairs[0].a}</strong> and <strong>${topPairs[0].b}</strong> (r=${topPairs[0].r.toFixed(3)})</div>`);
    if (profile.duplicateRows > 0) rows.push(`<div class="insight insight-yellow">🟡 <strong>${profile.duplicateRows} duplicate rows</strong> (${profile.duplicatePercent}% of data)</div>`);
    return rows.join('');
  })();

  const body = `
  <header>
    <h1>Data Profile Report</h1>
    <div class="meta">File: <strong>${filename}</strong> · Generated: ${ts}</div>
  </header>

  <section class="section">
    <h2>Dataset Overview</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="val">${profile.rowCount.toLocaleString()}</div><div class="lbl">Rows</div></div>
      <div class="stat-card"><div class="val">${profile.columnCount}</div><div class="lbl">Columns</div></div>
      <div class="stat-card"><div class="val">${profile.overallQuality}%</div><div class="lbl">Data Quality</div></div>
      <div class="stat-card"><div class="val">${profile.totalNullPercent}%</div><div class="lbl">Missing Values</div></div>
      <div class="stat-card"><div class="val">${profile.duplicateRows}</div><div class="lbl">Duplicate Rows</div></div>
      <div class="stat-card"><div class="val">${profile.memoryMB} MB</div><div class="lbl">Memory</div></div>
      <div class="stat-card"><div class="val">${numCols.length}</div><div class="lbl">Numeric Cols</div></div>
      <div class="stat-card"><div class="val">${catCols.length}</div><div class="lbl">Categorical Cols</div></div>
      <div class="stat-card"><div class="val">${dtCols.length}</div><div class="lbl">Datetime Cols</div></div>
    </div>
  </section>

  <section class="section">
    <h2>Key Findings</h2>
    ${insightRows || '<div style="font-size:12px;color:#64748b">No critical issues detected.</div>'}
  </section>

  <section class="section">
    <h2>Missing Data (top ${nullCols.length} columns)</h2>
    ${nullCols.length === 0 ? '<p style="font-size:12px;color:#64748b">No missing values.</p>' : `
    <table class="corr-table">
      <thead><tr><th>Column</th><th>Null %</th><th>Null Count</th></tr></thead>
      <tbody>${nullCols.map(c => `<tr><td>${c.name}</td><td style="color:${nullColor(c.nullPercent)}">${c.nullPercent}%</td><td style="font-family:monospace">${Math.round(c.nullPercent / 100 * c.count)}</td></tr>`).join('')}</tbody>
    </table>`}
  </section>

  <section class="section">
    <h2>Columns (${profile.columnCount})</h2>
    <div class="cols-grid">${colCards}</div>
  </section>

  ${topPairs.length ? `
  <section class="section">
    <h2>Top Correlations</h2>
    <table class="corr-table">
      <thead><tr><th>Column A</th><th>Column B</th><th>Pearson r</th><th>Sig.</th><th>Interpretation</th></tr></thead>
      <tbody>${corrRows}</tbody>
    </table>
    <div style="font-size:10px;color:#64748b;margin-top:6px">* p&lt;0.05 &nbsp; ** p&lt;0.01 &nbsp; *** p&lt;0.001</div>
  </section>` : ''}

  <div class="footer">Generated by Architect IDE Data Profiler · ${ts}</div>
  `;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Data Profile — ${filename}</title><style>${css}</style></head><body>${body}</body></html>`;
}
