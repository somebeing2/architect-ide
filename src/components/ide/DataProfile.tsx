import { useState } from 'react';
import {
  BarChart3, Database, AlertTriangle, ChevronDown, ChevronRight,
  Lightbulb, RefreshCw, Wand2, Copy, Activity, GitBranch,
  CheckCircle2, Info, TrendingUp, TrendingDown, FileDown,
} from 'lucide-react';
import { generateHtmlReport } from './_htmlReport';

type InferredType = 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'id' | 'text';
type DistShape = 'normal' | 'approx_normal' | 'skewed_right' | 'skewed_left' |
                 'highly_skewed_right' | 'highly_skewed_left' | 'leptokurtic' | 'platykurtic' | 'unknown';

interface HistBin  { bin: string; count: number; lo?: number; hi?: number; center?: number; }
interface TopValue { value: string; count: number; percent?: number; }
interface MissingSummaryItem { col: string; nullPercent: number; }

interface ColumnProfile {
  name: string;
  dtype: string;
  inferredType: InferredType;
  nullCount: number;
  nullPercent: number;
  uniqueCount: number;
  uniquePercent: number;
  qualityScore: number;
  isConstant?: boolean;
  outlierCount?: number;
  detectedPattern?: string;
  distributionShape?: DistShape;
  normalityPValue?: number | null;
  isNormal?: boolean | null;
  sampleValues?: string[];
  dateMin?: string;
  dateMax?: string;
  spanDays?: number;
  timeSeries?: { period: string; count: number }[];
  trendDirection?: 'up' | 'down' | 'flat';
  trendPctChange?: number;
  concentrationRisk?: number;
  concentrationLabel?: 'severe' | 'high' | 'medium' | 'low';
  wordFrequency?: { word: string; count: number }[];
  whitespaceCount?: number;
  mixedTypeCount?: number;
  mixedTypeNumericCount?: number;
  qqPoints?: { t: number; s: number }[];
  patternValidCount?: number;
  patternValidPercent?: number;
  outlierRowIndices?: number[];
  outlierValues?: (number | null)[];
  zscoreOutlierCount?: number;
  entropy?: number | null;
  maxEntropy?: number | null;
  lengthStats?: { min: number; max: number; mean: number; mode: number; emptyCount: number } | null;
  cardinality?: 'unique' | 'high' | 'medium' | 'low';
  stats?: {
    mean: number | null; median: number | null; std: number | null; mode: number | null;
    min: number | null; max: number | null; range: number | null;
    q25: number | null; q75: number | null; iqr: number | null; cv: number | null;
    p5: number | null; p10: number | null; p90: number | null; p95: number | null; p99: number | null;
    skewness: number | null; kurtosis: number | null;
    zeros: number; negativeCount: number; infiniteCount: number;
  };
  histogram?: HistBin[];
  topValues?: TopValue[];
  suggestions?: string[];
}

export interface DataProfileType {
  rowCount: number;
  columnCount: number;
  overallQuality: number;
  totalNullPercent: number;
  duplicateRows: number;
  duplicatePercent: number;
  memoryMB: number;
  correlationMatrix: (number | null)[][];
  correlationLabels: string[];
  spearmanMatrix: (number | null)[][];
  cramersVMatrix: (number | null)[][];
  cramersVLabels: string[];
  cramersVPValues: (number | null)[][];
  missingSummary: MissingSummaryItem[];
  anomalyRows: number;
  pearsonPValues: (number | null)[][];
  vifScores: Record<string, number | null>;
  groupStats: Record<string, Record<string, Record<string, { mean: number | null; median: number | null; count: number }>>>;
  groupTests: Record<string, Record<string, { test: string; pValue: number }>>;
  missingCooccurrence: { labels: string[]; matrix: (number | null)[][] } | Record<string, never>;
  scatterData: Record<string, { x: number[]; y: number[]; xLabel: string; yLabel: string }>;
  sampleRows: Record<string, string>[];
  columns: ColumnProfile[];
}

interface DataProfileProps {
  profile: DataProfileType | null;
  loading: boolean;
  onRefresh?: () => void;
  onInsertCode?: (code: string) => void;
}

type Tab = 'executive' | 'overview' | 'columns' | 'correlations' | 'diagnostics' | 'samples';

const TYPE_CONFIG: Record<InferredType, { label: string; color: string }> = {
  numeric:     { label: 'NUM',  color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  categorical: { label: 'CAT',  color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  datetime:    { label: 'DATE', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  boolean:     { label: 'BOOL', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  id:          { label: 'ID',   color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  text:        { label: 'TEXT', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

function QualityBadge({ score }: { score: number }) {
  const color = score >= 90 ? 'text-green-400' : score >= 70 ? 'text-yellow-400' : 'text-red-400';
  const ring  = score >= 90 ? 'stroke-green-400' : score >= 70 ? 'stroke-yellow-400' : 'stroke-red-400';
  const r = 10; const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex items-center gap-1.5">
      <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0 -rotate-90">
        <circle cx="14" cy="14" r={r} fill="none" strokeWidth="3" className="stroke-border" />
        <circle cx="14" cy="14" r={r} fill="none" strokeWidth="3"
          className={ring} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className={`text-sm font-bold ${color}`}>{score}%</span>
      <span className="text-xs text-muted-foreground">quality</span>
    </div>
  );
}

function ChartCaption({ what, lookFor }: { what: string; lookFor?: string }) {
  return (
    <div className="text-[8px] text-muted-foreground/70 leading-relaxed mt-0.5 mb-1 italic">
      <span className="not-italic font-medium text-muted-foreground/90">What this shows: </span>{what}
      {lookFor && <><span className="not-italic font-medium"> · What to look for: </span>{lookFor}</>}
    </div>
  );
}

function BoxPlot({ s }: { s: NonNullable<ColumnProfile['stats']> }) {
  const [tip, setTip] = useState<string | null>(null);
  const { min, max, q25, q75, median } = s;
  if (min == null || max == null || q25 == null || q75 == null || median == null) return null;
  const range = max - min || 1;
  const iqr   = q75 - q25;
  const wLow  = Math.max(min, q25 - 1.5 * iqr);
  const wHigh = Math.min(max, q75 + 1.5 * iqr);
  const W = 260; const H = 40; const PL = 4; const PR = 4;
  const innerW = W - PL - PR;
  const px = (v: number) => PL + ((v - min) / range) * innerW;

  const zones: { id: string; x1: number; x2: number; label: string; color: string }[] = [
    { id: 'wLow',   x1: px(wLow),  x2: px(q25),    label: `Lower whisker: ${wLow.toFixed(2)}`,   color: 'transparent' },
    { id: 'box',    x1: px(q25),   x2: px(q75),    label: `IQR box: Q1=${q25.toFixed(2)} → Q3=${q75.toFixed(2)} (IQR=${iqr.toFixed(2)})`, color: 'transparent' },
    { id: 'wHigh',  x1: px(q75),   x2: px(wHigh),  label: `Upper whisker: ${wHigh.toFixed(2)}`,   color: 'transparent' },
    { id: 'median', x1: px(median)-6, x2: px(median)+6, label: `Median: ${median.toFixed(2)}`,    color: 'transparent' },
  ];

  return (
    <div className="w-full mt-1">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-muted-foreground">Box plot</span>
        {tip && <span className="text-[9px] font-mono bg-secondary px-1 py-0.5 rounded text-foreground">{tip}</span>}
      </div>
      <svg width={W} height={H} className="overflow-visible select-none cursor-crosshair">
        {/* baseline */}
        <line x1={PL} x2={PL + innerW} y1={H/2} y2={H/2} stroke="currentColor" strokeWidth="0.5" className="text-border" />
        {/* whisker lines */}
        <line x1={px(wLow)} x2={px(q25)} y1={H/2} y2={H/2} stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
        <line x1={px(q75)} x2={px(wHigh)} y1={H/2} y2={H/2} stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
        {/* whisker caps */}
        <line x1={px(wLow)}  x2={px(wLow)}  y1={H/2 - 7} y2={H/2 + 7} stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
        <line x1={px(wHigh)} x2={px(wHigh)} y1={H/2 - 7} y2={H/2 + 7} stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" />
        {/* IQR box */}
        <rect x={px(q25)} width={px(q75) - px(q25)} y={H/2 - 9} height="18"
          fill="rgb(59 130 246 / 0.2)" stroke="rgb(96 165 250)" strokeWidth="1" rx="2" />
        {/* median line */}
        <line x1={px(median)} x2={px(median)} y1={H/2 - 10} y2={H/2 + 10} stroke="rgb(96 165 250)" strokeWidth="2.5" />
        {/* min/max dots */}
        <circle cx={px(min)} cy={H/2} r="3" fill="rgb(148 163 184)" />
        <circle cx={px(max)} cy={H/2} r="3" fill="rgb(148 163 184)" />
        {/* hover zones */}
        {zones.map(z => (
          <rect key={z.id} x={z.x1} width={Math.max(z.x2 - z.x1, 10)} y={H/2 - 12} height="24"
            fill="transparent"
            onMouseEnter={() => setTip(z.label)}
            onMouseLeave={() => setTip(null)}
          />
        ))}
      </svg>
      <ChartCaption what="The box spans the middle 50% of values. The centre line is the typical (median) value. Dots at each end are the minimum and maximum." lookFor="Dots or points outside the whisker lines are potential outliers worth investigating." />
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span title="Min">{min.toFixed(2)}</span>
        <span title="Q1 (25th percentile)">Q1 {q25.toFixed(2)}</span>
        <span className="text-blue-400" title="Median">M {median.toFixed(2)}</span>
        <span title="Q3 (75th percentile)">Q3 {q75.toFixed(2)}</span>
        <span title="Max">{max.toFixed(2)}</span>
      </div>
    </div>
  );
}

function TimeSeriesChart({ series }: { series: { period: string; count: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!series.length) return null;
  const W = 260; const H = 80;
  const PAD = { t: 8, r: 4, b: 20, l: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxCount = Math.max(...series.map(s => s.count), 1);
  const pts = series.map((s, i) => ({
    x: PAD.l + (i / Math.max(series.length - 1, 1)) * innerW,
    y: PAD.t + innerH - (s.count / maxCount) * innerH,
    ...s,
  }));
  const polyline = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${PAD.l},${PAD.t + innerH} ` + polyline + ` ${PAD.l + innerW},${PAD.t + innerH}`;
  const tip = hovered != null ? pts[hovered] : null;

  return (
    <div className="mt-1">
      <ChartCaption what="Record count bucketed by time period, revealing growth, decline, or seasonal patterns." lookFor="Sudden drops or spikes may signal missing data or real-world events. A rising trend means growing data volume." />
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-muted-foreground">Records over time</span>
        {tip && <span className="text-[9px] font-mono bg-secondary px-1 py-0.5 rounded">{tip.period}: <span className="text-foreground">{tip.count.toLocaleString()}</span></span>}
      </div>
      <svg width={W} height={H} className="overflow-visible select-none">
        {[0, 0.5, 1].map(f => {
          const y = PAD.t + innerH * (1 - f);
          return <g key={f}>
            <line x1={PAD.l} x2={PAD.l + innerW} y1={y} y2={y} stroke="currentColor" strokeWidth="0.4" className="text-border" />
            <text x={PAD.l - 4} y={y + 3} fontSize="7" textAnchor="end" className="fill-muted-foreground">{Math.round(maxCount * f)}</text>
          </g>;
        })}
        <polygon points={area} fill="rgb(52 211 153 / 0.15)" />
        <polyline points={polyline} fill="none" stroke="rgb(52 211 153)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hovered === i ? 4 : 2.5}
            fill={hovered === i ? 'rgb(52 211 153)' : 'rgb(52 211 153 / 0.7)'}
            className="cursor-pointer"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
        ))}
        {series.length <= 12 && pts.map((p, i) => (
          <text key={i} x={p.x} y={H - 4} fontSize="6.5" textAnchor="middle" className="fill-muted-foreground">
            {p.period.length > 7 ? p.period.slice(2) : p.period}
          </text>
        ))}
        {series.length > 12 && [0, Math.floor(pts.length/2), pts.length-1].map(i => (
          <text key={i} x={pts[i].x} y={H - 4} fontSize="6.5" textAnchor="middle" className="fill-muted-foreground">
            {pts[i].period.slice(0, 7)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function WordFrequencyBars({ words }: { words: { word: string; count: number }[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!words.length) return null;
  const maxCount = Math.max(...words.map(w => w.count), 1);
  return (
    <div className="mt-1 space-y-0.5">
      <ChartCaption what="Most frequent meaningful words found in this text field after removing common filler words." lookFor="Dominant terms reveal the main topics or categories present in this field." />
      <span className="text-[9px] text-muted-foreground">Top words (stopwords removed)</span>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
        {words.slice(0, 16).map((w, i) => (
          <div key={i} className="flex items-center gap-1 text-[9px] cursor-default"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <span className={`w-14 truncate shrink-0 ${hovered === i ? 'text-foreground' : 'text-muted-foreground'}`} title={w.word}>{w.word}</span>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${hovered === i ? 'bg-emerald-400' : 'bg-emerald-500/60'}`}
                style={{ width: `${(w.count / maxCount) * 100}%` }} />
            </div>
            <span className="font-mono text-muted-foreground w-6 text-right shrink-0">{w.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QQPlot({ points, isNormal }: { points: { t: number; s: number }[]; isNormal?: boolean | null }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!points.length) return null;
  const W = 260; const H = 100;
  const PAD = { t: 8, r: 8, b: 20, l: 32 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const xs = points.map(p => p.t);
  const ys = points.map(p => p.s);
  const xMin = Math.min(...xs); const xMax = Math.max(...xs);
  const yMin = Math.min(...ys); const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1; const yRange = yMax - yMin || 1;

  const cx = (v: number) => PAD.l + ((v - xMin) / xRange) * innerW;
  const cy = (v: number) => PAD.t + innerH - ((v - yMin) / yRange) * innerH;

  // Reference line: least-squares fit through points
  const n = points.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const intercept = my - slope * mx;
  const lineY1 = slope * xMin + intercept;
  const lineY2 = slope * xMax + intercept;

  const tip = hovered != null ? points[hovered] : null;

  return (
    <div className="mt-1">
      <ChartCaption what="Compares the actual value distribution against a perfect normal (bell) curve." lookFor="Points close to the orange line mean normal distribution — deviations indicate skewness or unusual tails." />
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-muted-foreground">Q-Q plot (normality)</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${isNormal ? 'bg-green-500/15 text-green-400' : 'bg-orange-500/15 text-orange-400'}`}>
          {isNormal ? 'Normal' : 'Non-normal'}
        </span>
      </div>
      {tip && (
        <div className="text-[9px] font-mono bg-secondary px-1 py-0.5 rounded mb-0.5">
          theoretical={tip.t.toFixed(3)} · sample={tip.s.toFixed(3)}
        </div>
      )}
      <svg width={W} height={H} className="overflow-visible select-none">
        {[0, 0.5, 1].map(f => {
          const yV = yMin + yRange * f;
          const y  = cy(yV);
          return <g key={f}>
            <line x1={PAD.l} x2={PAD.l + innerW} y1={y} y2={y} stroke="currentColor" strokeWidth="0.4" className="text-border" />
            <text x={PAD.l - 4} y={y + 3} fontSize="6.5" textAnchor="end" className="fill-muted-foreground">{yV.toFixed(1)}</text>
          </g>;
        })}
        <line x1={PAD.l} x2={PAD.l + innerW} y1={PAD.t + innerH} y2={PAD.t + innerH} stroke="currentColor" strokeWidth="0.5" className="text-border" />
        {/* Reference line */}
        <line
          x1={cx(xMin)} y1={Math.max(PAD.t, Math.min(PAD.t + innerH, cy(lineY1)))}
          x2={cx(xMax)} y2={Math.max(PAD.t, Math.min(PAD.t + innerH, cy(lineY2)))}
          stroke="rgb(251 146 60)" strokeWidth="1" strokeDasharray="4 2" opacity="0.7"
        />
        {/* Points */}
        {points.map((p, i) => (
          <circle key={i}
            cx={cx(p.t)} cy={cy(p.s)} r={hovered === i ? 3.5 : 2}
            fill={hovered === i ? 'rgb(147 197 253)' : 'rgb(96 165 250 / 0.65)'}
            className="cursor-pointer"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          />
        ))}
        {[xMin, 0, xMax].map((v, i) => (
          <text key={i} x={cx(v)} y={H - 4} fontSize="6.5" textAnchor="middle" className="fill-muted-foreground">{v.toFixed(1)}</text>
        ))}
      </svg>
      <div className="flex gap-3 text-[8px] text-muted-foreground">
        <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-full bg-blue-400/65" />Sample quantiles</span>
        <span className="flex items-center gap-0.5"><span className="inline-block w-3 h-0.5 bg-orange-400 rounded" />Reference line</span>
      </div>
      <div className="text-[8px] text-muted-foreground mt-0.5">
        {isNormal
          ? 'Points follow the reference line — distribution is approximately normal.'
          : 'Points deviate from the reference line — distribution is not normal. Consider transformations.'}
      </div>
    </div>
  );
}

function ScatterPlot({ data, height = 120 }: { data: { x: number[]; y: number[]; xLabel: string; yLabel: string }; height?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const W = 260; const H = height;
  const PAD = { t: 8, r: 8, b: 22, l: 34 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const { x: xs, y: ys, xLabel, yLabel } = data;
  if (!xs.length) return null;

  const xMin = Math.min(...xs); const xMax = Math.max(...xs);
  const yMin = Math.min(...ys); const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1; const yRange = yMax - yMin || 1;
  const px = (v: number) => PAD.l + ((v - xMin) / xRange) * innerW;
  const py = (v: number) => PAD.t + innerH - ((v - yMin) / yRange) * innerH;

  // OLS regression line
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const intercept = my - slope * mx;
  const tip = hovered != null ? { x: xs[hovered], y: ys[hovered] } : null;

  return (
    <div className="mt-1">
      <ChartCaption what="Each dot is one record plotted by two measurements. The orange line shows the overall trend between them." lookFor="Dots clustered tightly around the line = strong relationship. A wide scatter = weak or no relationship." />
      {tip && (
        <div className="text-[9px] font-mono bg-secondary px-1 py-0.5 rounded mb-0.5">
          {xLabel}={tip.x.toFixed(3)} · {yLabel}={tip.y.toFixed(3)}
        </div>
      )}
      <svg width={W} height={H} className="overflow-visible select-none">
        {[0, 0.5, 1].map(f => {
          const yV = yMin + yRange * f;
          return <g key={f}>
            <line x1={PAD.l} x2={PAD.l + innerW} y1={py(yV)} y2={py(yV)} stroke="currentColor" strokeWidth="0.4" className="text-border" />
            <text x={PAD.l - 3} y={py(yV) + 3} fontSize="6.5" textAnchor="end" className="fill-muted-foreground">{yV.toFixed(1)}</text>
          </g>;
        })}
        <line x1={PAD.l} x2={PAD.l + innerW} y1={PAD.t + innerH} y2={PAD.t + innerH} stroke="currentColor" strokeWidth="0.5" className="text-border" />
        {/* Regression line */}
        <line
          x1={px(xMin)} y1={Math.max(PAD.t, Math.min(PAD.t + innerH, py(slope * xMin + intercept)))}
          x2={px(xMax)} y2={Math.max(PAD.t, Math.min(PAD.t + innerH, py(slope * xMax + intercept)))}
          stroke="rgb(251 146 60)" strokeWidth="1.5" opacity="0.8"
        />
        {/* Points */}
        {xs.map((x, i) => (
          <circle key={i}
            cx={px(x)} cy={py(ys[i])} r={hovered === i ? 3.5 : 2}
            fill={hovered === i ? 'rgb(167 243 208)' : 'rgb(52 211 153 / 0.5)'}
            stroke={hovered === i ? 'rgb(52 211 153)' : 'none'}
            strokeWidth="1"
            className="cursor-pointer"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          />
        ))}
        {[xMin, xMax].map((v, i) => (
          <text key={i} x={px(v)} y={H - 4} fontSize="6.5" textAnchor={i === 0 ? 'start' : 'end'} className="fill-muted-foreground">{v.toFixed(1)}</text>
        ))}
        <text x={PAD.l + innerW / 2} y={H - 4} fontSize="7" textAnchor="middle" className="fill-muted-foreground" fontStyle="italic">{xLabel}</text>
        <text x={PAD.l - 20} y={PAD.t + innerH / 2} fontSize="7" textAnchor="middle" className="fill-muted-foreground" fontStyle="italic"
          transform={`rotate(-90, ${PAD.l - 20}, ${PAD.t + innerH / 2})`}>{yLabel}</text>
      </svg>
    </div>
  );
}

function SamplePills({ values }: { values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {values.slice(0, 5).map((v, i) => (
        <span key={i} className="text-[9px] px-1.5 py-0.5 bg-secondary rounded font-mono text-muted-foreground truncate max-w-[80px]" title={v}>{v}</span>
      ))}
    </div>
  );
}

function MiniBar({ value, max, color = 'bg-primary' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NullBar({ nullPct }: { nullPct: number }) {
  const fillPct = Math.max(nullPct, nullPct > 0 ? 2 : 0);
  const color = nullPct > 30 ? 'bg-red-500' : nullPct > 10 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="text-muted-foreground w-8 shrink-0">Nulls</span>
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${fillPct}%` }} />
      </div>
      <span className="text-muted-foreground w-10 text-right shrink-0">{nullPct}%</span>
    </div>
  );
}

function Histogram({ bins }: { bins: HistBin[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!bins.length) return null;

  const W = 260; const H = 90;
  const PAD = { t: 4, r: 4, b: 18, l: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxCount = Math.max(...bins.map(b => b.count), 1);
  const total    = bins.reduce((s, b) => s + b.count, 0);
  const bw       = innerW / bins.length;

  // Gaussian KDE from bin centers (Scott's bandwidth rule)
  const kdePoints: string[] = [];
  const hasCenters = bins.some(b => b.center != null);
  if (hasCenters && total > 5 && bins.length > 1) {
    const centers = bins.map(b => b.center ?? 0);
    const counts  = bins.map(b => b.count);
    const mean    = centers.reduce((s, x, i) => s + x * counts[i], 0) / total;
    const vari    = centers.reduce((s, x, i) => s + counts[i] * (x - mean) ** 2, 0) / total;
    const stdKde  = Math.sqrt(vari) || 1;
    const h       = 1.06 * stdKde * Math.pow(total, -0.2);
    const xmin    = bins[0].lo  ?? centers[0];
    const xmax    = bins[bins.length - 1].hi ?? centers[centers.length - 1];
    const xRange  = xmax - xmin || 1;
    const binWidth = xRange / bins.length;
    for (let k = 0; k <= 60; k++) {
      const x = xmin + xRange * k / 60;
      const density = centers.reduce((s, xi, i) => {
        const z = (x - xi) / h;
        return s + counts[i] * Math.exp(-0.5 * z * z) / (h * Math.sqrt(2 * Math.PI));
      }, 0) / total;
      const scaledY = Math.min((density * binWidth), 1);
      const px = PAD.l + (k / 60) * innerW;
      const py = PAD.t + innerH - scaledY * innerH;
      kdePoints.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
  }

  const tip = hovered != null ? bins[hovered] : null;

  return (
    <div className="mt-1">
      <ChartCaption what="Each bar shows how many records fall in a value range. Taller bars mean more records have that value." lookFor="A roughly symmetric shape is normal. A long tail to one side means skew — averages may be misleading." />
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-muted-foreground">Distribution</span>
        {tip && (
          <span className="text-[9px] font-mono bg-secondary px-1 py-0.5 rounded">
            {tip.bin}:&nbsp;
            <span className="text-foreground">{tip.count.toLocaleString()}</span>
            <span className="text-muted-foreground ml-1">({((tip.count / total) * 100).toFixed(1)}%)</span>
          </span>
        )}
      </div>
      <svg width={W} height={H} className="overflow-visible select-none">
        {[0, 0.5, 1].map(f => {
          const y = PAD.t + innerH * (1 - f);
          return <g key={f}>
            <line x1={PAD.l - 2} x2={PAD.l + innerW} y1={y} y2={y} stroke="currentColor" strokeWidth="0.4" className="text-border" />
            <text x={PAD.l - 4} y={y + 3} fontSize="7" textAnchor="end" className="fill-muted-foreground">{Math.round(maxCount * f)}</text>
          </g>;
        })}
        <line x1={PAD.l} x2={PAD.l + innerW} y1={PAD.t + innerH} y2={PAD.t + innerH} stroke="currentColor" strokeWidth="0.5" className="text-border" />
        {bins.map((b, i) => {
          const x  = PAD.l + i * bw;
          const bh = (b.count / maxCount) * innerH;
          const y  = PAD.t + innerH - bh;
          return (
            <rect key={i} x={x + 0.5} y={y} width={bw - 1} height={Math.max(bh, 0.5)}
              fill={hovered === i ? 'rgb(96 165 250)' : 'rgb(96 165 250 / 0.5)'}
              rx="1"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer transition-colors"
            />
          );
        })}
        {kdePoints.length > 1 && (
          <polyline points={kdePoints.join(' ')} fill="none" stroke="rgb(251 146 60)" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        )}
        {[0, Math.floor((bins.length - 1) / 2), bins.length - 1].map(i => {
          if (i >= bins.length) return null;
          const b = bins[i]; const x = PAD.l + (i + 0.5) * bw;
          const label = b.lo != null
            ? (Math.abs(b.lo) >= 10000 ? (b.lo / 1000).toFixed(0) + 'k' : b.lo.toFixed(1))
            : b.bin.split('–')[0];
          return <text key={i} x={x} y={H - 2} fontSize="7" textAnchor="middle" className="fill-muted-foreground">{label}</text>;
        })}
      </svg>
      <div className="flex gap-3 text-[8px] text-muted-foreground">
        <span className="flex items-center gap-0.5"><span className="inline-block w-3 h-2 rounded-sm bg-blue-400/50" />Frequency</span>
        {kdePoints.length > 1 && <span className="flex items-center gap-0.5"><span className="inline-block w-3 h-0.5 bg-orange-400 rounded" />KDE curve</span>}
      </div>
    </div>
  );
}

function TopValuesBar({ topValues }: { topValues: TopValue[] }) {
  const [mode, setMode] = useState<'count' | 'pct'>('pct');
  const [hovered, setHovered] = useState<number | null>(null);
  if (!topValues.length) return null;
  const maxCount = Math.max(...topValues.map(v => v.count), 1);
  const maxPct   = Math.max(...topValues.map(v => v.percent ?? 0), 0.01);

  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground">Top values</span>
        <div className="flex gap-0.5">
          {(['count', 'pct'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`text-[8px] px-1.5 py-0.5 rounded transition-colors ${
                mode === m ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {m === 'count' ? '#' : '%'}
            </button>
          ))}
        </div>
      </div>
      {topValues.slice(0, 8).map((tv, i) => {
        const val    = mode === 'count' ? tv.count : (tv.percent ?? 0);
        const barPct = mode === 'count' ? (tv.count / maxCount) * 100 : (val / maxPct) * 100;
        const isHov  = hovered === i;
        return (
          <div key={i} className="flex items-center gap-1.5 text-[10px] cursor-default"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <span className={`truncate w-20 shrink-0 ${isHov ? 'text-foreground' : 'text-muted-foreground'}`}
              title={tv.value}>{tv.value}</span>
            <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${
                isHov ? 'bg-purple-400' : 'bg-purple-500/70'
              }`} style={{ width: `${barPct}%` }} />
            </div>
            <span className="font-mono text-muted-foreground shrink-0 w-10 text-right">
              {mode === 'count' ? tv.count.toLocaleString() : `${(tv.percent ?? 0).toFixed(1)}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const PATTERN_COLORS: Record<string, string> = {
  email: 'bg-sky-500/20 text-sky-400', url: 'bg-indigo-500/20 text-indigo-400',
  phone: 'bg-teal-500/20 text-teal-400', uuid: 'bg-pink-500/20 text-pink-400',
  integer: 'bg-blue-500/20 text-blue-400', decimal: 'bg-blue-500/20 text-blue-400',
  zipcode: 'bg-amber-500/20 text-amber-400',
};

function ColumnCard({ col }: { col: ColumnProfile }) {
  const [open, setOpen] = useState(false);
  const typeCfg = TYPE_CONFIG[col.inferredType] ?? TYPE_CONFIG.text;
  const hasSuggestions = col.suggestions && col.suggestions.length > 0;

  return (
    <div className={`rounded border bg-background overflow-hidden ${col.isConstant ? 'border-red-500/40' : 'border-border'}`}>
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-secondary/40 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
               : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
        <span className="flex-1 text-xs font-medium text-foreground truncate">{col.name}</span>
        {col.detectedPattern && (
          <span className={`text-[9px] px-1 py-0.5 rounded font-mono shrink-0 ${PATTERN_COLORS[col.detectedPattern] ?? 'bg-secondary text-muted-foreground'}`}>
            {col.detectedPattern}
          </span>
        )}
        <span className={`text-[9px] px-1 py-0.5 rounded border font-mono shrink-0 ${typeCfg.color}`}>
          {typeCfg.label}
        </span>
        {col.cardinality && (
          <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 ${
            col.cardinality === 'unique' ? 'bg-gray-500/20 text-gray-400' :
            col.cardinality === 'high'   ? 'bg-orange-500/20 text-orange-400' :
            col.cardinality === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                                           'bg-green-500/20 text-green-400'
          }`}>{col.cardinality}</span>
        )}
        {hasSuggestions && <Lightbulb className="w-3 h-3 text-yellow-400 shrink-0" />}
        {col.outlierCount !== undefined && col.outlierCount > 0 && (
          <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0" />
        )}
      </button>

      {/* Compact always-visible null bar */}
      <div className="px-2 pb-1.5">
        <NullBar nullPct={col.nullPercent} />
      </div>

      {/* Expanded section */}
      {open && (
        <div className="px-2 pb-2 border-t border-border pt-2 space-y-2">
          {/* Meta row */}
          {/* Plain-English narrative */}
          <div className="bg-secondary/30 border border-border/60 rounded px-2 py-1.5">
            <div className="text-[10px] text-foreground/80 leading-relaxed">{generateColumnNarrative(col)}</div>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
            <div><span>dtype: </span><span className="text-foreground font-mono">{col.dtype}</span></div>
            <div><span>unique: </span><span className="text-foreground">{col.uniqueCount.toLocaleString()} ({col.uniquePercent}%)</span></div>
            <div className="flex items-center gap-1">
              <span>quality: </span>
              <span className={`font-mono font-semibold ${
                col.qualityScore >= 90 ? 'text-green-400' :
                col.qualityScore >= 70 ? 'text-yellow-400' :
                col.qualityScore >= 50 ? 'text-orange-400' : 'text-red-400'
              }`}>{col.qualityScore}%</span>
            </div>
          </div>
          {/* Quality mini-bar */}
          <div className="h-1 bg-secondary rounded-full overflow-hidden mt-1">
            <div className={`h-full rounded-full transition-all ${
              col.qualityScore >= 90 ? 'bg-green-500' :
              col.qualityScore >= 70 ? 'bg-yellow-500' :
              col.qualityScore >= 50 ? 'bg-orange-500' : 'bg-red-500'
            }`} style={{ width: `${col.qualityScore}%` }} />
          </div>
          {/* Regex pattern validation */}
          {col.patternValidPercent != null && col.detectedPattern && (
            <div className={`flex items-center gap-1.5 text-[10px] mt-1 px-2 py-1 rounded ${
              col.patternValidPercent >= 95 ? 'bg-green-500/10 text-green-400' :
              col.patternValidPercent >= 80 ? 'bg-yellow-500/10 text-yellow-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              <span className="font-medium">{col.patternValidPercent}% valid {col.detectedPattern}s</span>
              <span className="text-muted-foreground">({col.patternValidCount?.toLocaleString()} / {(col.count - (col.count * (col.nullPercent / 100))).toFixed(0)} non-null)</span>
            </div>
          )}

          {/* Numeric stats */}
          {col.stats && (
            <>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {([['Mean', col.stats.mean], ['Median', col.stats.median], ['Mode', col.stats.mode], ['Std', col.stats.std]] as [string, number|null][]).map(([lbl, val]) => (
                  <div key={lbl}>
                    <div className="text-muted-foreground">{lbl}</div>
                    <div className="text-foreground font-mono">{val != null ? val.toFixed(2) : 'N/A'}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {([['Min', col.stats.min], ['Max', col.stats.max], ['Range', col.stats.range], ['IQR', col.stats.iqr]] as [string, number|null][]).map(([lbl, val]) => (
                  <div key={lbl}>
                    <div className="text-muted-foreground">{lbl}</div>
                    <div className="text-foreground font-mono">{val != null ? val.toFixed(2) : 'N/A'}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <div>
                  <div className="text-muted-foreground">CV%</div>
                  <div className={`font-mono ${col.stats.cv != null && col.stats.cv > 100 ? 'text-orange-400' : 'text-foreground'}`}>
                    {col.stats.cv != null ? col.stats.cv.toFixed(1) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Skewness</div>
                  <div className={`font-mono ${col.stats.skewness != null && Math.abs(col.stats.skewness) > 1 ? 'text-orange-400' : 'text-foreground'}`}>
                    {col.stats.skewness != null ? col.stats.skewness.toFixed(2) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Kurtosis</div>
                  <div className="text-foreground font-mono">{col.stats.kurtosis != null ? col.stats.kurtosis.toFixed(2) : 'N/A'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Zeros</div>
                  <div className="text-foreground font-mono">{col.stats.zeros}</div>
                </div>
              </div>
              {/* IQR vs Z-score outlier comparison */}
              <div className="flex gap-3 text-[10px]">
                <span className="text-muted-foreground">Outliers — IQR: <span className={`font-mono ${(col.outlierCount ?? 0) > 0 ? 'text-orange-400' : 'text-foreground'}`}>{col.outlierCount ?? 0}</span></span>
                <span className="text-muted-foreground">Z&gt;3: <span className={`font-mono ${(col.zscoreOutlierCount ?? 0) > 0 ? 'text-orange-400' : 'text-foreground'}`}>{col.zscoreOutlierCount ?? 0}</span></span>
              </div>
            </>
          )}

          {/* Entropy for categorical/text */}
          {col.entropy != null && col.maxEntropy != null && col.maxEntropy > 0 && (
            <div className="text-[10px]">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-muted-foreground">Entropy (diversity)</span>
                <span className="font-mono text-foreground">{col.entropy} / {col.maxEntropy} bits</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(col.entropy / col.maxEntropy) * 100}%` }} />
              </div>
            </div>
          )}

          {/* String length stats */}
          {col.lengthStats && (
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {([['Len min', col.lengthStats.min], ['Len max', col.lengthStats.max], ['Len avg', col.lengthStats.mean], ['Empty', col.lengthStats.emptyCount]] as [string, number][]).map(([lbl, val]) => (
                <div key={lbl}>
                  <div className="text-muted-foreground">{lbl}</div>
                  <div className={`font-mono ${lbl === 'Empty' && val > 0 ? 'text-orange-400' : 'text-foreground'}`}>{val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Box plot */}
          {col.stats && <BoxPlot s={col.stats} />}

          {/* Histogram */}
          {col.histogram && col.histogram.length > 0 && <Histogram bins={col.histogram} />}

          {/* Q-Q plot for numeric columns */}
          {col.qqPoints && col.qqPoints.length > 0 && <QQPlot points={col.qqPoints} isNormal={col.isNormal} />}

          {/* Datetime range + time-series chart */}
          {col.inferredType === 'datetime' && col.dateMin && (
            <div className="text-[10px] space-y-0.5">
              <div className="flex gap-2 text-muted-foreground">
                <span>From <span className="text-foreground font-mono">{col.dateMin}</span></span>
                <span>To <span className="text-foreground font-mono">{col.dateMax}</span></span>
              </div>
              {col.spanDays != null && <div className="text-muted-foreground">Span: <span className="text-foreground">{col.spanDays > 365 ? `${(col.spanDays/365).toFixed(1)} yrs` : `${col.spanDays} days`}</span></div>}
              {col.timeSeries && col.timeSeries.length > 1 && <TimeSeriesChart series={col.timeSeries} />}
            </div>
          )}

          {/* Word frequency for text columns */}
          {col.wordFrequency && col.wordFrequency.length > 0 && <WordFrequencyBars words={col.wordFrequency} />}

          {/* Top values */}
          {col.topValues && col.topValues.length > 0 && <TopValuesBar topValues={col.topValues} />}

          {/* Sample values */}
          {col.sampleValues && <div><div className="text-[9px] text-muted-foreground mt-1 mb-0.5">Samples</div><SamplePills values={col.sampleValues} /></div>}

          {/* Whitespace warning */}
          {(col.whitespaceCount ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1">
              <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
              <span className="text-yellow-400 font-medium">{col.whitespaceCount} values</span>
              <span className="text-muted-foreground">have leading/trailing whitespace — may cause incorrect grouping</span>
            </div>
          )}

          {/* Mixed-type warning */}
          {col.mixedTypeCount != null && col.mixedTypeNumericCount != null && (
            <div className="flex items-center gap-1.5 text-[10px] bg-orange-500/10 border border-orange-500/30 rounded px-2 py-1">
              <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0" />
              <span className="text-orange-400 font-medium">Mixed types detected</span>
              <span className="text-muted-foreground">{col.mixedTypeNumericCount} numeric, {col.mixedTypeCount} non-numeric values in same column</span>
            </div>
          )}

          {/* Suggestions */}
          {hasSuggestions && (
            <div className="space-y-1">
              {col.suggestions!.map((s, i) => (
                <div key={i} className="flex items-start gap-1 text-[10px] text-yellow-400">
                  <Lightbulb className="w-3 h-3 mt-px shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function corrColor(v: number | null): string {
  if (v === null) return 'bg-secondary';
  const a = Math.abs(v);
  if (a > 0.8) return v > 0 ? 'bg-blue-600' : 'bg-red-600';
  if (a > 0.5) return v > 0 ? 'bg-blue-500/60' : 'bg-red-500/60';
  if (a > 0.3) return v > 0 ? 'bg-blue-400/30' : 'bg-red-400/30';
  return 'bg-secondary/40';
}

function pSig(p: number | null | undefined): string {
  if (p == null) return '';
  if (p < 0.001) return '***';
  if (p < 0.01)  return '**';
  if (p < 0.05)  return '*';
  return '';
}

function Heatmap({ matrix, labels, title, pValues }: {
  matrix: (number|null)[][]; labels: string[]; title: string;
  pValues?: (number|null)[][];
}) {
  if (!labels.length || !matrix.length) return <p className="text-[10px] text-muted-foreground py-2">Not enough columns.</p>;
  const cs = Math.min(28, Math.floor(260 / labels.length));
  return (
    <div>
      <ChartCaption what="Each cell shows how strongly two columns move together. Blue = positive relationship, red = inverse." lookFor="Strong blue/red cells signal columns that are linked — useful for forecasting or detecting redundant fields." />
      <div className="text-[10px] text-muted-foreground mb-1">{title}</div>
      <div className="overflow-auto">
        <table className="text-[9px] border-collapse">
          <thead><tr>
            <th style={{ width: 56 }} />
            {labels.map(l => (
              <th key={l} style={{ width: cs }} className="text-muted-foreground font-normal pb-0.5">
                <div className="rotate-[-45deg] whitespace-nowrap origin-bottom-left ml-1 truncate" style={{ maxWidth: cs * 2 }}>{l}</div>
              </th>
            ))}
          </tr></thead>
          <tbody>
            {matrix.map((row, ri) => (
              <tr key={ri}>
                <td className="text-muted-foreground pr-1 truncate text-right" style={{ maxWidth: 56 }}>{labels[ri]}</td>
                {row.map((v, ci) => {
                  const sig = pValues ? pSig(pValues[ri]?.[ci]) : '';
                  return (
                    <td key={ci} title={`${labels[ri]} × ${labels[ci]}: r=${v?.toFixed(3) ?? 'N/A'}${pValues ? ` p=${pValues[ri]?.[ci]?.toFixed(4) ?? 'N/A'}` : ''}`}
                      className={`${corrColor(v)} rounded-sm m-px relative text-center leading-none`}
                      style={{ width: cs, height: cs, fontSize: 7 }}>
                      {sig && <span className="text-white font-bold">{sig}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground flex-wrap">
          <div className="flex gap-1 items-center"><div className="w-3 h-3 rounded bg-blue-600" /><span>+1.0</span></div>
          <div className="flex gap-1 items-center"><div className="w-3 h-3 rounded bg-secondary/40" /><span>0</span></div>
          <div className="flex gap-1 items-center"><div className="w-3 h-3 rounded bg-red-600" /><span>−1.0</span></div>
          {pValues && <span className="ml-2">* p&lt;0.05  ** p&lt;0.01  *** p&lt;0.001</span>}
        </div>
      </div>
    </div>
  );
}

// ── Cleaning code generator ───────────────────────────────────────────────

function buildCleaningCode(p: DataProfileType): string {
  const L: string[] = [
    'import pandas as pd', 'import numpy as np', '',
    '# ── Auto-generated cleaning code ──────────────────────',
    '# df is already loaded in this environment', '',
  ];
  const constantCols  = p.columns.filter(c => c.isConstant);
  const nullCols      = p.columns.filter(c => c.nullPercent > 0 && !c.isConstant);
  const datetimeCols  = p.columns.filter(c => c.inferredType === 'datetime' && c.dtype === 'object');
  const skewedCols    = p.columns.filter(c => c.stats?.skewness != null && Math.abs(c.stats.skewness!) > 1 && (c.stats?.min ?? 0) >= 0);
  if (constantCols.length) {
    L.push('# Drop constant columns');
    L.push(`df.drop(columns=${JSON.stringify(constantCols.map(c => c.name))}, inplace=True, errors='ignore')`); L.push('');
  }
  if (p.duplicateRows > 0) { L.push(`# Remove ${p.duplicateRows} duplicate rows`); L.push('df.drop_duplicates(inplace=True)'); L.push(''); }
  if (nullCols.length) {
    L.push('# Fill missing values');
    nullCols.forEach(c => {
      if (c.inferredType === 'numeric') L.push(`df['${c.name}'].fillna(df['${c.name}'].median(), inplace=True)  # ${c.nullPercent}% null`);
      else L.push(`df['${c.name}'].fillna('Unknown', inplace=True)  # ${c.nullPercent}% null`);
    }); L.push('');
  }
  if (datetimeCols.length) { L.push('# Convert datetime strings'); datetimeCols.forEach(c => L.push(`df['${c.name}'] = pd.to_datetime(df['${c.name}'], errors='coerce')`)); L.push(''); }
  if (skewedCols.length)    { L.push('# Log-transform skewed columns'); skewedCols.forEach(c => L.push(`df['${c.name}_log'] = np.log1p(df['${c.name}'])  # skew=${c.stats!.skewness?.toFixed(2)}`)); L.push(''); }
  // Whitespace stripping
  const whitespaceCols = p.columns.filter(c => (c.whitespaceCount ?? 0) > 0 && c.dtype === 'object');
  if (whitespaceCols.length) {
    L.push('# Strip leading/trailing whitespace');
    whitespaceCols.forEach(c => L.push(`df['${c.name}'] = df['${c.name}'].str.strip()  # ${c.whitespaceCount} values affected`));
    L.push('');
  }
  // Outlier capping (winsorization)
  const outlierCols = p.columns.filter(c => c.inferredType === 'numeric' && (c.outlierCount ?? 0) > 0 && c.stats?.q25 != null && c.stats?.q75 != null && c.stats?.iqr != null);
  if (outlierCols.length) {
    L.push('# Cap outliers using IQR fences (winsorization)');
    outlierCols.forEach(c => {
      const lo = (c.stats!.q25! - 1.5 * c.stats!.iqr!).toFixed(4);
      const hi = (c.stats!.q75! + 1.5 * c.stats!.iqr!).toFixed(4);
      L.push(`df['${c.name}'] = df['${c.name}'].clip(lower=${lo}, upper=${hi})  # ${c.outlierCount} outlier(s)`);
    });
    L.push('');
  }
  // Mixed-type coercion
  const mixedCols = p.columns.filter(c => c.mixedTypeCount != null && c.mixedTypeNumericCount != null);
  if (mixedCols.length) {
    L.push('# Coerce mixed-type columns to numeric (non-parseable become NaN)');
    mixedCols.forEach(c => L.push(`df['${c.name}'] = pd.to_numeric(df['${c.name}'], errors='coerce')  # ${c.mixedTypeNumericCount} numeric + ${c.mixedTypeCount} non-numeric`));
    L.push('');
  }
  L.push('print(f"Cleaned: {df.shape}")'); L.push('df.head()');
  return L.join('\n');
}

// ── Plain-English explainability ─────────────────────────────────────────

type InsightLevel = 'critical' | 'warning' | 'info' | 'good';
interface Insight { level: InsightLevel; title: string; detail: string; }

function fmt(v: number | null | undefined, dp = 2): string {
  if (v == null) return 'N/A';
  return Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: dp }) : v.toFixed(dp);
}

function generateColumnNarrative(col: ColumnProfile): string {
  const parts: string[] = [];

  if (col.isConstant) {
    return `Every row has the same value — this column carries no information and should be dropped.`;
  }

  if (col.inferredType === 'id') {
    return `Each value appears to be unique — this looks like an identifier column. Identifiers have no analytical or predictive value and should be excluded from modelling.`;
  }

  if (col.inferredType === 'numeric' && col.stats) {
    const { mean, median, min, max, skewness, cv, iqr, std } = col.stats;
    if (min != null && max != null && mean != null && median != null) {
      parts.push(`Values range from ${fmt(min)} to ${fmt(max)}, with a typical value around ${fmt(median)} (median).`);
      if (mean != null && std != null && std > 0) {
        const diff = Math.abs(mean - median) / std;
        if (diff > 0.15 && skewness != null) {
          const dir = skewness > 0 ? 'higher' : 'lower';
          const cause = skewness > 0 ? 'a few very large values pull the average up' : 'a few very small values pull the average down';
          parts.push(`The mean (${fmt(mean)}) is ${dir} than the median — ${cause}.`);
        }
      }
    }
    if (cv != null) {
      if (cv > 150) parts.push(`Extremely high variability (CV ${fmt(cv, 0)}%) — values are spread very widely relative to the average.`);
      else if (cv > 60) parts.push(`Moderate variability (CV ${fmt(cv, 0)}%) — values show meaningful spread around the average.`);
      else parts.push(`Low variability (CV ${fmt(cv, 0)}%) — values cluster fairly tightly around the average.`);
    }
    if (iqr != null && iqr === 0) parts.push(`The middle 50% of values are identical (IQR = 0) — this column may be mostly constant.`);
    if ((col.outlierCount ?? 0) > 0) {
      const both = col.zscoreOutlierCount != null && col.zscoreOutlierCount > 0;
      parts.push(`${col.outlierCount} extreme value${col.outlierCount! > 1 ? 's' : ''} detected by IQR${both ? `, ${col.zscoreOutlierCount} by Z-score` : ''} — investigate before modelling.`);
    }
    if (col.nullPercent > 30) parts.push(`${col.nullPercent}% of values are missing — this column needs imputation or should be dropped.`);
    else if (col.nullPercent > 0) parts.push(`${col.nullPercent}% of values are missing.`);
    if (col.stats.negativeCount > 0 && min != null && min >= 0) parts.push(`Contains negative values — verify this is expected for this field.`);
  }

  if (col.inferredType === 'categorical' || col.inferredType === 'boolean') {
    const top = col.topValues?.[0];
    parts.push(`Has ${col.uniqueCount} distinct value${col.uniqueCount > 1 ? 's' : ''}.`);
    if (top) parts.push(`Most common: "${top.value}"${top.percent != null ? ` appears in ${top.percent}% of rows` : ` (${top.count.toLocaleString()} occurrences)`}.`);
    if (col.entropy != null && col.maxEntropy != null && col.maxEntropy > 0) {
      const pct = Math.round((col.entropy / col.maxEntropy) * 100);
      const word = pct >= 80 ? 'very evenly spread across all categories' : pct >= 50 ? 'moderately spread across categories' : 'concentrated in a small number of categories';
      parts.push(`Values are ${word}.`);
    }
    if (col.nullPercent > 0) parts.push(`${col.nullPercent}% missing.`);
  }

  if (col.inferredType === 'text') {
    const ls = col.lengthStats;
    if (ls) parts.push(`Free-text field. Values are ${ls.min}–${ls.max} characters long (average ${ls.mean}).`);
    if (col.detectedPattern) parts.push(`Most values appear to follow a ${col.detectedPattern} pattern.`);
    if (col.nullPercent > 0) parts.push(`${col.nullPercent}% missing.`);
  }

  if (col.inferredType === 'datetime') {
    if (col.dateMin && col.dateMax) {
      const span = col.spanDays != null
        ? (col.spanDays >= 365 ? `${(col.spanDays / 365).toFixed(1)} years` : `${col.spanDays} days`)
        : '';
      parts.push(`Date range spans ${span}, from ${col.dateMin} to ${col.dateMax}.`);
    }
    parts.push(`Consider extracting year, month, and weekday as numeric features.`);
  }

  return parts.join(' ') || 'No additional context available for this column.';
}

function generateDatasetInsights(p: DataProfileType): Insight[] {
  const insights: Insight[] = [];

  // ── Quality ──────────────────────────────────────────────────────────────
  const criticalNullCols = p.columns.filter(c => c.nullPercent > 50);
  const highNullCols     = p.columns.filter(c => c.nullPercent > 20 && c.nullPercent <= 50);
  if (criticalNullCols.length > 0) {
    insights.push({ level: 'critical',
      title: `${criticalNullCols.length} column${criticalNullCols.length > 1 ? 's' : ''} mostly empty (>50% missing)`,
      detail: `${criticalNullCols.map(c => `${c.name} (${c.nullPercent}% missing)`).join(', ')}. These columns are unlikely to be useful as-is and should be dropped or carefully reconstructed.`,
    });
  }
  if (highNullCols.length > 0) {
    insights.push({ level: 'warning',
      title: `${highNullCols.length} column${highNullCols.length > 1 ? 's' : ''} with significant missing data (20–50%)`,
      detail: `${highNullCols.map(c => `${c.name} (${c.nullPercent}%)`).join(', ')}. Fill these gaps using mean/median/mode imputation or a predictive fill before analysis.`,
    });
  }
  if (p.duplicateRows > 0) {
    insights.push({ level: p.duplicatePercent > 5 ? 'warning' : 'info',
      title: `${p.duplicateRows.toLocaleString()} duplicate rows (${p.duplicatePercent}% of data)`,
      detail: `Duplicates inflate row counts and skew statistics. Remove them with df.drop_duplicates() before any analysis or modelling.`,
    });
  }
  const constCols = p.columns.filter(c => c.isConstant);
  if (constCols.length > 0) {
    insights.push({ level: 'warning',
      title: `${constCols.length} useless column${constCols.length > 1 ? 's' : ''} — all values identical`,
      detail: `${constCols.map(c => c.name).join(', ')} never change. They contribute nothing to analysis or models and should be dropped immediately.`,
    });
  }

  // ── Distribution ─────────────────────────────────────────────────────────
  const skewedCols = p.columns.filter(c => c.stats?.skewness != null && Math.abs(c.stats.skewness) > 2);
  if (skewedCols.length > 0) {
    insights.push({ level: 'info',
      title: `${skewedCols.length} column${skewedCols.length > 1 ? 's' : ''} with a heavily lopsided distribution`,
      detail: `${skewedCols.map(c => `${c.name} (skew ${c.stats!.skewness!.toFixed(1)})`).join(', ')}. A few extreme values are pulling the average away from the typical value. Log-transforming these columns usually improves model accuracy.`,
    });
  }
  const nonNormalCols = p.columns.filter(c => c.isNormal === false && c.inferredType === 'numeric');
  if (nonNormalCols.length > 0 && nonNormalCols.length <= 5) {
    insights.push({ level: 'info',
      title: `${nonNormalCols.length} numeric column${nonNormalCols.length > 1 ? 's' : ''} not bell-curve shaped`,
      detail: `${nonNormalCols.map(c => c.name).join(', ')} failed a normality test. Algorithms that assume a bell-curve distribution (like linear regression with small samples) may produce less reliable results.`,
    });
  }

  // ── Anomalies ────────────────────────────────────────────────────────────
  if (p.anomalyRows > 0) {
    const pct = ((p.anomalyRows / p.rowCount) * 100).toFixed(1);
    insights.push({ level: p.anomalyRows > p.rowCount * 0.05 ? 'warning' : 'info',
      title: `${p.anomalyRows.toLocaleString()} rows contain unusual values (${pct}% of data)`,
      detail: `These rows have at least one numeric value more than 3 standard deviations from the column average. They may represent data entry errors, rare events, or genuine outliers — worth investigating before modelling.`,
    });
  }

  // ── Correlation / Redundancy ──────────────────────────────────────────────
  const highVifCols = Object.entries(p.vifScores).filter(([, v]) => v != null && v > 10);
  if (highVifCols.length > 0) {
    insights.push({ level: 'warning',
      title: `${highVifCols.length} column${highVifCols.length > 1 ? 's' : ''} contain redundant information`,
      detail: `${highVifCols.map(([c, v]) => `${c} (VIF ${v! >= 999 ? '∞' : v!.toFixed(1)})`).join(', ')} are highly correlated with other columns. Keeping all of them in a regression model inflates standard errors and makes coefficients unreliable.`,
    });
  }
  // Top correlation pair
  if (p.correlationLabels.length >= 2) {
    let bestR = 0, bestA = '', bestB = '';
    p.correlationLabels.forEach((a, i) => {
      p.correlationLabels.forEach((b, j) => {
        if (j <= i) return;
        const r = p.correlationMatrix[i]?.[j];
        if (r != null && Math.abs(r) > Math.abs(bestR)) { bestR = r; bestA = a; bestB = b; }
      });
    });
    if (Math.abs(bestR) > 0.7) {
      const dir = bestR > 0 ? 'positively' : 'negatively';
      insights.push({ level: 'info',
        title: `${bestA} and ${bestB} are strongly linked (r = ${bestR.toFixed(2)})`,
        detail: `These two columns are ${dir} correlated — as one goes up, the other tends to ${bestR > 0 ? 'go up' : 'go down'} as well. They may be measuring the same underlying phenomenon. In a model, consider keeping only one.`,
      });
    }
  }

  // ── High cardinality / text ───────────────────────────────────────────────
  const highCardCols = p.columns.filter(c => c.cardinality === 'high' && c.inferredType !== 'id' && c.inferredType !== 'numeric');
  if (highCardCols.length > 0) {
    insights.push({ level: 'info',
      title: `${highCardCols.length} categorical column${highCardCols.length > 1 ? 's' : ''} with many unique values`,
      detail: `${highCardCols.map(c => c.name).join(', ')} have >50% unique values. High-cardinality categories are hard to encode — consider grouping rare values into an "Other" bucket or using target encoding.`,
    });
  }

  // ── Clean bill of health ──────────────────────────────────────────────────
  if (p.overallQuality >= 95 && criticalNullCols.length === 0 && highNullCols.length === 0 && p.duplicateRows === 0 && constCols.length === 0) {
    insights.push({ level: 'good',
      title: 'Data quality looks excellent',
      detail: `No significant missing values, duplicates, or structural problems detected. This dataset appears ready for analysis and modelling.`,
    });
  }

  return insights;
}

// ── Tab components ────────────────────────────────────────────────────────

const INSIGHT_CFG: Record<InsightLevel, { border: string; bg: string; text: string; icon: React.ReactNode }> = {
  critical: { border: 'border-red-500/50',    bg: 'bg-red-500/8',    text: 'text-red-400',    icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" /> },
  warning:  { border: 'border-yellow-500/50', bg: 'bg-yellow-500/8', text: 'text-yellow-400', icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" /> },
  info:     { border: 'border-blue-500/40',   bg: 'bg-blue-500/8',   text: 'text-blue-400',   icon: <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" /> },
  good:     { border: 'border-green-500/40',  bg: 'bg-green-500/8',  text: 'text-green-400',  icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" /> },
};

function InsightsPanel({ insights }: { insights: Insight[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!insights.length) return null;
  return (
    <div className="space-y-1.5">
      {insights.map((ins, i) => {
        const cfg = INSIGHT_CFG[ins.level];
        const isOpen = expanded === i;
        return (
          <button key={i} onClick={() => setExpanded(isOpen ? null : i)}
            className={`w-full text-left rounded border p-2 ${cfg.border} ${cfg.bg} transition-colors hover:brightness-110`}>
            <div className="flex items-start gap-2">
              {cfg.icon}
              <div className="flex-1 min-w-0">
                <div className={`text-[11px] font-medium ${cfg.text}`}>{ins.title}</div>
                {isOpen && <div className="text-[10px] text-foreground/80 mt-1 leading-relaxed">{ins.detail}</div>}
              </div>
              {isOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, sub, color = 'text-foreground' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-background border border-border rounded p-2 flex flex-col gap-0.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function OverviewTab({ p }: { p: DataProfileType }) {
  const numCols   = p.columns.filter(c => c.inferredType === 'numeric').length;
  const catCols   = p.columns.filter(c => c.inferredType === 'categorical').length;
  const dtCols    = p.columns.filter(c => c.inferredType === 'datetime').length;
  const constCols = p.columns.filter(c => c.isConstant).length;
  const insights  = generateDatasetInsights(p);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1.5">
        <StatCard label="Rows"     value={p.rowCount.toLocaleString()} />
        <StatCard label="Columns"  value={p.columnCount} />
        <StatCard label="Quality"  value={`${p.overallQuality}%`}
          color={p.overallQuality >= 90 ? 'text-green-400' : p.overallQuality >= 70 ? 'text-yellow-400' : 'text-red-400'} />
        <StatCard label="Memory"   value={`${p.memoryMB} MB`} />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <StatCard label="Numeric"  value={numCols}  color="text-blue-400" />
        <StatCard label="Categ."   value={catCols}  color="text-purple-400" />
        <StatCard label="Datetime" value={dtCols}   color="text-green-400" />
        <StatCard label="Constant" value={constCols} color={constCols > 0 ? 'text-red-400' : 'text-foreground'} />
      </div>

      {/* Plain-English insights panel */}
      <div>
        <div className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
          <Lightbulb className="w-3 h-3" />
          Key findings — click any to expand
        </div>
        <InsightsPanel insights={insights} />
      </div>
      <div className="bg-background border border-border rounded p-2 space-y-1.5">
        <div className="text-[10px] text-muted-foreground mb-1">Dataset health</div>
        {[
          { label: 'Nulls',      pct: p.totalNullPercent, color: p.totalNullPercent > 20 ? 'bg-red-500' : p.totalNullPercent > 5 ? 'bg-yellow-500' : 'bg-green-500' },
          { label: 'Duplicates', pct: p.duplicatePercent, color: p.duplicatePercent > 5 ? 'bg-orange-500' : 'bg-green-500' },
        ].map(({ label, pct, color }) => (
          <div key={label} className="flex items-center gap-2 text-[10px]">
            <span className="w-16 text-muted-foreground shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-muted-foreground w-10 text-right shrink-0">{pct}%</span>
          </div>
        ))}
      </div>
      {p.missingSummary.length > 0 && (
        <div className="bg-background border border-border rounded p-2">
          <div className="text-[10px] text-muted-foreground mb-1">Missing by column (top {p.missingSummary.length})</div>
          <div className="space-y-1">
            {p.missingSummary.map(m => (
              <div key={m.col} className="flex items-center gap-2 text-[10px]">
                <span className="truncate text-foreground w-24 shrink-0">{m.col}</span>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${m.nullPercent > 50 ? 'bg-red-500' : m.nullPercent > 20 ? 'bg-yellow-500' : 'bg-orange-400'}`}
                    style={{ width: `${m.nullPercent}%` }} />
                </div>
                <span className="text-muted-foreground w-10 text-right shrink-0">{m.nullPercent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const DIST_CONFIG: Record<DistShape, { label: string; color: string }> = {
  normal:              { label: 'Normal',        color: 'bg-green-500/20 text-green-400' },
  approx_normal:       { label: '≈ Normal',      color: 'bg-green-500/10 text-green-500' },
  skewed_right:        { label: 'Skewed →',      color: 'bg-yellow-500/20 text-yellow-400' },
  skewed_left:         { label: '← Skewed',      color: 'bg-yellow-500/20 text-yellow-400' },
  highly_skewed_right: { label: 'High Skew →',   color: 'bg-red-500/20 text-red-400' },
  highly_skewed_left:  { label: '← High Skew',   color: 'bg-red-500/20 text-red-400' },
  leptokurtic:         { label: 'Heavy tails',   color: 'bg-orange-500/20 text-orange-400' },
  platykurtic:         { label: 'Light tails',   color: 'bg-blue-500/20 text-blue-400' },
  unknown:             { label: '—',             color: 'bg-secondary text-muted-foreground' },
};

function OutlierRowsPanel({ columns, allColumns, sampleRows }: {
  columns: ColumnProfile[];
  allColumns: ColumnProfile[];
  sampleRows: Record<string, string>[];
}) {
  const [activeCol, setActiveCol] = useState(columns[0]?.name ?? '');
  const col = columns.find(c => c.name === activeCol);
  if (!col) return null;

  const colNames = allColumns.map(c => c.name);
  const outlierIdxSet = new Set(col.outlierRowIndices ?? []);

  // Build display rows: from sampleRows those whose index is in outlierRowIndices
  // sampleRows are df.head(5), so df indices 0–4 only. Show what we have plus index info.
  const sampleMatches = sampleRows
    .map((row, dfIdx) => ({ row, dfIdx }))
    .filter(({ dfIdx }) => outlierIdxSet.has(dfIdx));

  return (
    <div className="bg-background border border-border rounded overflow-hidden">
      <div className="px-2 py-1.5 border-b border-border flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-muted-foreground font-medium">Outlier rows</span>
        <div className="flex gap-0.5 flex-wrap">
          {columns.map(c => (
            <button key={c.name} onClick={() => setActiveCol(c.name)}
              className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                activeCol === c.name ? 'border-orange-500/50 bg-orange-500/10 text-orange-400' : 'border-border text-muted-foreground hover:text-foreground'
              }`}>{c.name} ({c.outlierRowIndices?.length ?? 0})</button>
          ))}
        </div>
      </div>

      {/* Row indices list */}
      <div className="px-2 py-1.5 space-y-1">
        <div className="text-[9px] text-muted-foreground mb-1">
          Row indices with outlier values in <span className="text-orange-400 font-medium">{activeCol}</span>
          {' '}(IQR fence: Q1−1.5×IQR to Q3+1.5×IQR):
        </div>
        <div className="flex flex-wrap gap-1">
          {(col.outlierRowIndices ?? []).map((idx, i) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded font-mono">
              row {idx}
            </span>
          ))}
        </div>

        {/* Sample rows that happen to be in the outlier set */}
        {sampleMatches.length > 0 && (
          <div className="mt-2">
            <div className="text-[9px] text-muted-foreground mb-1">Full row data for outlier rows within first 5 rows:</div>
            <div className="overflow-auto rounded border border-border">
              <table className="w-full text-[9px] border-collapse">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border">
                    <th className="px-1.5 py-1 text-left text-muted-foreground font-normal">#</th>
                    {colNames.map(cn => (
                      <th key={cn} className={`px-1.5 py-1 text-left font-normal whitespace-nowrap ${cn === activeCol ? 'text-orange-400' : 'text-muted-foreground'}`}>{cn}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleMatches.map(({ row, dfIdx }) => (
                    <tr key={dfIdx} className="border-b border-border/40 bg-orange-500/5">
                      <td className="px-1.5 py-1 text-muted-foreground font-mono">{dfIdx}</td>
                      {colNames.map(cn => {
                        const val = row[cn] ?? '';
                        const isEmpty = val === '' || val === 'nan' || val === 'None';
                        return (
                          <td key={cn} className={`px-1.5 py-1 font-mono ${cn === activeCol ? 'text-orange-400 font-semibold' : isEmpty ? 'text-muted-foreground/40 italic' : 'text-foreground'}`}>
                            {isEmpty ? 'null' : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="text-[8px] text-muted-foreground mt-1">
          Only first 5 rows of the dataset are loaded in memory. Use row indices above to locate outliers in your full dataset.
        </div>
      </div>
    </div>
  );
}

function DiagnosticsTab({ p }: { p: DataProfileType }) {
  const numCols = p.columns.filter(c => c.inferredType === 'numeric');
  const allSuggestions = p.columns.flatMap(c => (c.suggestions ?? []).map(s => ({ col: c.name, s })));

  return (
    <div className="space-y-3">
      {numCols.length > 0 && (
        <div className="bg-background border border-border rounded overflow-hidden">
          <div className="text-[10px] text-muted-foreground px-2 py-1 border-b border-border">Distribution diagnostics</div>
          <div className="overflow-auto max-h-52">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  {['Column', 'Shape', 'Normality', 'Skew', 'Kurt', 'Outliers'].map(h => (
                    <th key={h} className="text-left px-2 py-1 text-muted-foreground font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {numCols.map(col => {
                  const dist = col.distributionShape ?? 'unknown';
                  const dcfg = DIST_CONFIG[dist];
                  return (
                    <tr key={col.name} className="border-t border-border/50 hover:bg-secondary/20">
                      <td className="px-2 py-1 truncate max-w-[80px] text-foreground font-medium">{col.name}</td>
                      <td className="px-2 py-1">
                        <span className={`px-1 py-0.5 rounded text-[9px] ${dcfg.color}`}>{dcfg.label}</span>
                      </td>
                      <td className="px-2 py-1">
                        {col.isNormal === null || col.isNormal === undefined
                          ? <span className="text-muted-foreground">—</span>
                          : col.isNormal
                            ? <span className="text-green-400">Normal</span>
                            : <span className="text-orange-400">Non-normal</span>
                        }
                        {col.normalityPValue != null && (
                          <span className="text-muted-foreground ml-1">(p={col.normalityPValue})</span>
                        )}
                      </td>
                      <td className={`px-2 py-1 font-mono ${col.stats?.skewness != null && Math.abs(col.stats.skewness) > 1 ? 'text-orange-400' : 'text-foreground'}`}>
                        {col.stats?.skewness?.toFixed(2) ?? '—'}
                      </td>
                      <td className="px-2 py-1 font-mono text-foreground">{col.stats?.kurtosis?.toFixed(2) ?? '—'}</td>
                      <td className={`px-2 py-1 font-mono ${(col.outlierCount ?? 0) > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                        {col.outlierCount ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {numCols.length > 0 && (
        <div className="bg-background border border-border rounded overflow-hidden">
          <div className="text-[10px] text-muted-foreground px-2 py-1 border-b border-border">Percentile table</div>
          <div className="overflow-auto max-h-48">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  {['Column', 'P5', 'P10', 'Q1', 'Median', 'Q3', 'P90', 'P95', 'P99'].map(h => (
                    <th key={h} className="text-left px-2 py-1 text-muted-foreground font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {numCols.map(col => (
                  <tr key={col.name} className="border-t border-border/50 hover:bg-secondary/20">
                    <td className="px-2 py-1 truncate max-w-[80px] text-foreground font-medium">{col.name}</td>
                    {[col.stats?.p5, col.stats?.p10, col.stats?.q25, col.stats?.median,
                      col.stats?.q75, col.stats?.p90, col.stats?.p95, col.stats?.p99].map((v, i) => (
                      <td key={i} className="px-2 py-1 font-mono text-foreground">{v?.toFixed(2) ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* VIF table */}
      {Object.keys(p.vifScores).length >= 2 && (
        <div className="bg-background border border-border rounded overflow-hidden">
          <div className="text-[10px] text-muted-foreground px-2 py-1 border-b border-border flex items-center justify-between">
            <span>Variance Inflation Factor (VIF)</span>
            <span className="text-[9px]">VIF &gt;5 = moderate, &gt;10 = severe multicollinearity</span>
          </div>
          <div className="overflow-auto max-h-36">
            <table className="w-full text-[10px]">
              <thead className="sticky top-0 bg-background border-b border-border">
                <tr>
                  <th className="text-left px-2 py-1 text-muted-foreground font-normal">Column</th>
                  <th className="text-left px-2 py-1 text-muted-foreground font-normal">VIF</th>
                  <th className="text-left px-2 py-1 text-muted-foreground font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(p.vifScores).sort(([,a],[,b]) => (b ?? 0) - (a ?? 0)).map(([col, vif]) => (
                  <tr key={col} className="border-t border-border/50 hover:bg-secondary/20">
                    <td className="px-2 py-1 truncate max-w-[80px] text-foreground font-medium">{col}</td>
                    <td className={`px-2 py-1 font-mono ${(vif ?? 0) > 10 ? 'text-red-400' : (vif ?? 0) > 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {vif != null ? (vif >= 999 ? '∞' : vif.toFixed(2)) : '—'}
                    </td>
                    <td className="px-2 py-1 text-[9px]">
                      {vif == null ? '—' : vif >= 999 ? <span className="text-red-400">Perfect collinearity</span> : vif > 10 ? <span className="text-red-400">Severe</span> : vif > 5 ? <span className="text-yellow-400">Moderate</span> : <span className="text-green-400">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Outlier values */}
      {numCols.some(c => (c.outlierValues?.length ?? 0) > 0) && (
        <div className="bg-background border border-border rounded overflow-hidden">
          <div className="text-[10px] text-muted-foreground px-2 py-1 border-b border-border">Extreme outlier values (top 5 per column, by IQR distance)</div>
          <div className="divide-y divide-border/50">
            {numCols.filter(c => (c.outlierValues?.length ?? 0) > 0).map(col => (
              <div key={col.name} className="px-2 py-1 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-foreground font-medium w-20 shrink-0 truncate">{col.name}</span>
                <div className="flex gap-1 flex-wrap">
                  {(col.outlierValues ?? []).map((v, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded font-mono">{v?.toFixed(2) ?? '—'}</span>
                  ))}
                </div>
                <span className="text-[9px] text-muted-foreground ml-auto">IQR:{col.outlierCount} Z:{col.zscoreOutlierCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outlier rows panel */}
      {numCols.some(c => (c.outlierRowIndices?.length ?? 0) > 0) && (
        <OutlierRowsPanel columns={numCols.filter(c => (c.outlierRowIndices?.length ?? 0) > 0)} allColumns={p.columns} sampleRows={p.sampleRows} />
      )}

      {/* Group comparison */}
      {Object.keys(p.groupStats).length > 0 && (
        <GroupComparisonTable groupStats={p.groupStats} groupTests={p.groupTests} />
      )}

      {allSuggestions.length > 0 && (
        <div className="bg-background border border-border rounded p-2 space-y-1">
          <div className="text-[10px] text-muted-foreground mb-1">All suggestions ({allSuggestions.length})</div>
          {allSuggestions.map(({ col, s }, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px]">
              <Lightbulb className="w-3 h-3 text-yellow-400 mt-px shrink-0" />
              <span className="text-muted-foreground shrink-0">{col}:</span>
              <span className="text-foreground">{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupComparisonTable({ groupStats, groupTests }: {
  groupStats: DataProfileType['groupStats'];
  groupTests: DataProfileType['groupTests'];
}) {
  const catCols = Object.keys(groupStats);
  const [activeCat, setActiveCat] = useState(catCols[0]);
  const entry = groupStats[activeCat] ?? {};
  const tests = groupTests[activeCat] ?? {};
  const numericCols = Object.keys(entry);
  const allGroups = numericCols.length > 0 ? Object.keys(Object.values(entry)[0] ?? {}) : [];

  return (
    <div className="bg-background border border-border rounded overflow-hidden">
      <div className="text-[10px] text-muted-foreground px-2 py-1 border-b border-border flex items-center gap-2 flex-wrap">
        <span>Group comparison — mean by</span>
        <div className="flex gap-1">
          {catCols.map(c => (
            <button key={c} onClick={() => setActiveCat(c)}
              className={`px-1.5 py-0.5 rounded border text-[9px] transition-colors ${activeCat === c ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-auto max-h-40">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-background border-b border-border">
            <tr>
              <th className="text-left px-2 py-1 text-muted-foreground font-normal">Numeric col</th>
              {allGroups.map(g => <th key={g} className="text-left px-2 py-1 text-muted-foreground font-normal">{g}</th>)}
              <th className="text-left px-2 py-1 text-muted-foreground font-normal">Test p-value</th>
            </tr>
          </thead>
          <tbody>
            {numericCols.map(nc => {
              const t = tests[nc];
              const sig = t ? pSig(t.pValue) : '';
              return (
                <tr key={nc} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-2 py-1 text-foreground font-medium truncate max-w-[80px]">{nc}</td>
                  {allGroups.map(g => {
                    const stat = entry[nc]?.[g];
                    return (
                      <td key={g} className="px-2 py-1 font-mono text-foreground">
                        {stat?.mean != null ? stat.mean.toFixed(2) : '—'}
                        <span className="text-muted-foreground text-[9px] ml-0.5">(n={stat?.count ?? 0})</span>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-[9px]">
                    {t ? (
                      <span className={t.pValue < 0.05 ? 'text-green-400' : 'text-muted-foreground'}>
                        {t.pValue.toFixed(4)}{sig && <span className="font-bold ml-0.5">{sig}</span>}
                        <span className="text-muted-foreground ml-1 text-[8px]">{t.test}</span>
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-2 py-0.5 text-[9px] text-muted-foreground border-t border-border/50">* p&lt;0.05  ** p&lt;0.01  *** p&lt;0.001 — statistically significant group difference</div>
    </div>
  );
}

function CorrelationsTab({ p }: { p: DataProfileType }) {
  type CorrMode = 'pearson' | 'spearman' | 'cramers' | 'pairs' | 'missing' | 'scatter';
  const [mode, setMode] = useState<CorrMode>('pairs');
  const hasPearson  = p.correlationLabels.length >= 2;
  const hasSpearman = p.spearmanMatrix.length >= 2;
  const hasCramers  = p.cramersVLabels.length >= 2;
  const hasMissing  = 'labels' in p.missingCooccurrence && p.missingCooccurrence.labels.length >= 2;

  // Build ranked pairs from Pearson matrix
  const topPairs = (() => {
    if (!hasPearson) return [];
    const pairs: { a: string; b: string; r: number; p: number | null }[] = [];
    p.correlationLabels.forEach((a, i) => {
      p.correlationLabels.forEach((b, j) => {
        if (j <= i) return;
        const r = p.correlationMatrix[i]?.[j];
        const pv = p.pearsonPValues[i]?.[j] ?? null;
        if (r != null) pairs.push({ a, b, r, p: pv });
      });
    });
    return pairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  })();

  const hasScatter = p.scatterData && Object.keys(p.scatterData).length > 0;

  const MODES: [CorrMode, string][] = [
    ['pairs', 'Top Pairs'], ['scatter', 'Scatter'], ['pearson', 'Pearson'], ['spearman', 'Spearman'],
    ['cramers', "Cramér's V"], ['missing', 'Missing'],
  ];

  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {MODES.map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="text-[9px] text-muted-foreground">
        {mode === 'pairs'    && 'All numeric column pairs ranked by |Pearson r|. Green = significant (p<0.05).'}
        {mode === 'scatter'  && 'Scatter plots for the top-3 most correlated pairs with OLS regression line.'}
        {mode === 'pearson'  && 'Linear relationships between numeric columns. Asterisks show significance.'}
        {mode === 'spearman' && 'Rank-based (monotonic) relationships — robust to outliers and non-normality.'}
        {mode === 'cramers'  && "Association between categorical columns (0 = independent, 1 = perfect)."}
        {mode === 'missing'  && 'Co-occurrence of missing values — are nulls clustered in the same rows?'}
      </div>

      {mode === 'pairs' && (
        hasPearson ? (
          <div className="bg-background border border-border rounded overflow-hidden">
            <div className="overflow-auto max-h-64">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-background border-b border-border">
                  <tr>
                    {['Col A', 'Col B', 'r', '|r|', 'p-value', 'Sig', 'What this means'].map(h => (
                      <th key={h} className="text-left px-2 py-1 text-muted-foreground font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topPairs.map(({ a, b, r, p: pv }, i) => {
                    const absr = Math.abs(r);
                    const strength = absr > 0.8 ? 'very strong' : absr > 0.6 ? 'strong' : absr > 0.4 ? 'moderate' : absr > 0.2 ? 'weak' : 'negligible';
                    const direction = r > 0 ? 'positive' : 'negative';
                    const plain = pv != null && pv < 0.05
                      ? `${strength} ${direction} link — as ${a} rises, ${b} tends to ${r > 0 ? 'rise' : 'fall'} too`
                      : 'not statistically significant';
                    return (
                    <tr key={i} className="border-t border-border/50 hover:bg-secondary/20">
                      <td className="px-2 py-1 text-foreground truncate max-w-[70px]">{a}</td>
                      <td className="px-2 py-1 text-foreground truncate max-w-[70px]">{b}</td>
                      <td className={`px-2 py-1 font-mono ${r > 0 ? 'text-blue-400' : 'text-red-400'}`}>{r.toFixed(3)}</td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${r > 0 ? 'bg-blue-500' : 'bg-red-500'}`} style={{ width: `${Math.abs(r) * 100}%` }} />
                          </div>
                          <span className="font-mono text-foreground">{absr.toFixed(3)}</span>
                        </div>
                      </td>
                      <td className={`px-2 py-1 font-mono ${pv != null && pv < 0.05 ? 'text-green-400' : 'text-muted-foreground'}`}>
                        {pv != null ? pv.toFixed(4) : '—'}
                      </td>
                      <td className="px-2 py-1 font-bold text-foreground">{pSig(pv)}</td>
                      <td className="px-2 py-1 text-[9px] text-muted-foreground max-w-[140px]">{plain}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : <p className="text-[10px] text-muted-foreground">Need ≥2 numeric columns.</p>
      )}
      {mode === 'scatter'  && (
        hasScatter
          ? <div className="space-y-4">
              {Object.entries(p.scatterData).map(([key, sd]) => {
                const corrEntry = topPairs.find(tp => tp.a === sd.xLabel && tp.b === sd.yLabel);
                const r = corrEntry ? corrEntry.r : null;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-foreground">{sd.xLabel} × {sd.yLabel}</span>
                      {r != null && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                          Math.abs(r) > 0.7 ? 'bg-blue-500/20 text-blue-400' :
                          Math.abs(r) > 0.4 ? 'bg-sky-500/15 text-sky-400' : 'bg-secondary text-muted-foreground'
                        }`}>r = {r.toFixed(3)}</span>
                      )}
                    </div>
                    <ScatterPlot data={sd} />
                  </div>
                );
              })}
            </div>
          : <p className="text-[10px] text-muted-foreground">Need ≥2 numeric columns with data.</p>
      )}
      {mode === 'pearson'  && (hasPearson  ? <Heatmap matrix={p.correlationMatrix}  labels={p.correlationLabels}  title="Pearson correlation"   pValues={p.pearsonPValues.length ? p.pearsonPValues : undefined} /> : <p className="text-[10px] text-muted-foreground">Need ≥2 numeric columns.</p>)}
      {mode === 'spearman' && (hasSpearman ? <Heatmap matrix={p.spearmanMatrix}     labels={p.correlationLabels}  title="Spearman correlation" /> : <p className="text-[10px] text-muted-foreground">Need ≥2 numeric columns.</p>)}
      {mode === 'cramers'  && (hasCramers  ? <Heatmap matrix={p.cramersVMatrix}     labels={p.cramersVLabels}     title="Cramér's V association" pValues={p.cramersVPValues.length ? p.cramersVPValues : undefined} /> : <p className="text-[10px] text-muted-foreground">Need ≥2 categorical columns with ≤30 unique values.</p>)}
      {mode === 'missing'  && (hasMissing
        ? <Heatmap matrix={(p.missingCooccurrence as { labels: string[]; matrix: (number|null)[][] }).matrix} labels={(p.missingCooccurrence as { labels: string[]; matrix: (number|null)[][] }).labels} title="Missing data co-occurrence (correlation of null indicators)" />
        : <p className="text-[10px] text-muted-foreground">Need ≥2 columns with missing values.</p>
      )}
    </div>
  );
}

type SortKey = 'name' | 'nullPct' | 'quality' | 'type';

function ColumnsTab({ columns }: { columns: ColumnProfile[] }) {
  const [search, setSearch]   = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const typeOptions = ['all', ...Array.from(new Set(columns.map(c => c.inferredType))).sort()];

  const filtered = columns
    .filter(c => {
      const matchName = c.name.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'all' || c.inferredType === typeFilter;
      return matchName && matchType;
    })
    .sort((a, b) => {
      if (sortKey === 'name')    return a.name.localeCompare(b.name);
      if (sortKey === 'nullPct') return (b.nullPercent ?? 0) - (a.nullPercent ?? 0);
      if (sortKey === 'quality') return (a.qualityScore ?? 100) - (b.qualityScore ?? 100);
      if (sortKey === 'type')    return a.inferredType.localeCompare(b.inferredType);
      return 0;
    });

  return (
    <div className="space-y-2">
      {/* Controls row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="relative flex-1 min-w-[120px]">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search columns…"
            className="w-full h-6 pl-2 pr-2 text-[10px] bg-secondary border border-border rounded outline-none focus:border-primary placeholder:text-muted-foreground text-foreground"
          />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="h-6 px-1.5 text-[10px] bg-secondary border border-border rounded outline-none focus:border-primary text-foreground cursor-pointer">
          {typeOptions.map(t => <option key={t} value={t}>{t === 'all' ? 'All types' : t}</option>)}
        </select>
        <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
          className="h-6 px-1.5 text-[10px] bg-secondary border border-border rounded outline-none focus:border-primary text-foreground cursor-pointer">
          <option value="name">Sort: Name</option>
          <option value="nullPct">Sort: Null % ↓</option>
          <option value="quality">Sort: Quality ↑</option>
          <option value="type">Sort: Type</option>
        </select>
        <span className="text-[9px] text-muted-foreground shrink-0">{filtered.length}/{columns.length}</span>
      </div>
      {/* Grid */}
      {filtered.length === 0
        ? <p className="text-[10px] text-muted-foreground py-4 text-center">No columns match</p>
        : <div className="grid grid-cols-2 gap-1.5">
            {filtered.map((col, i) => <ColumnCard key={i} col={col} />)}
          </div>
      }
    </div>
  );
}

function SampleRowsTable({ rows, columns }: { rows: Record<string, string>[]; columns: string[] }) {
  const [view, setView] = useState<'first' | 'last'>('first');
  if (!rows.length) return <p className="text-[10px] text-muted-foreground">No sample rows available.</p>;
  const displayRows = view === 'first' ? rows : [...rows].reverse();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Showing first 5 rows of the dataset — hover cells for full value</span>
        <div className="flex gap-0.5">
          {(['first', 'last'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                view === v ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
              }`}>
              {v === 'first' ? 'First 5' : 'Last 5'}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-auto rounded border border-border">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-secondary/40 border-b border-border">
              <th className="px-2 py-1 text-left text-muted-foreground font-normal sticky left-0 bg-secondary/40 border-r border-border/50">#</th>
              {columns.map(col => (
                <th key={col} className="px-2 py-1 text-left text-muted-foreground font-normal whitespace-nowrap max-w-[80px] truncate"
                  title={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, ri) => (
              <tr key={ri} className={`border-b border-border/40 ${ri % 2 === 0 ? '' : 'bg-secondary/10'} hover:bg-secondary/30 transition-colors`}>
                <td className="px-2 py-1 text-muted-foreground sticky left-0 border-r border-border/30 font-mono">{view === 'first' ? ri + 1 : rows.length - ri}</td>
                {columns.map(col => {
                  const val = row[col] ?? '';
                  const isEmpty = val === '' || val === 'nan' || val === 'None';
                  return (
                    <td key={col} className="px-2 py-1 max-w-[80px] truncate" title={val}>
                      {isEmpty
                        ? <span className="text-muted-foreground/50 italic">null</span>
                        : <span className="text-foreground font-mono">{val}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[9px] text-muted-foreground">Values shown as strings. Empty cells indicate missing data (NaN/None).</div>
    </div>
  );
}

// ── Executive Tab ─────────────────────────────────────────────────────────

type ColDomain = 'financial' | 'customer' | 'product' | 'temporal' | 'geographic' | 'hr' | 'other';
function colDomain(name: string): ColDomain {
  // Split camelCase then tokenise on non-alphanumeric so "totalOrders" → ["total","orders"]
  // This prevents substring false-positives ("gender"→"end", "network"→"net", "type"→any column)
  const words = name
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const has = (...ws: string[]) => ws.some(w => words.includes(w));
  if (has('revenue','sales','amount','price','cost','profit','margin','payment','invoice','fee','balance','spend','budget','earning','earnings','gross','net','turnover')) return 'financial';
  if (has('customer','user','client','member','subscriber','buyer','consumer')) return 'customer';
  if (has('product','sku','brand','item','segment')) return 'product';
  if (has('date','time','timestamp','created','updated','year','month','week','period','quarter')) return 'temporal';
  if (has('city','state','country','region','zip','postal','address','location','territory','district')) return 'geographic';
  if (has('salary','wage','department','hire','tenure','role','headcount')) return 'hr';
  return 'other';
}

interface ExecFinding { type: 'critical' | 'warning' | 'positive'; text: string; }
interface ImpactCard { icon: string; headline: string; detail: string; severity: 'critical' | 'warning' | 'ok'; owner?: string; }
interface ExecRelationship { sentence: string; strength: 'strong' | 'moderate'; }
interface ActionItem { priority: 'critical' | 'warning'; owner: string; text: string; }

function buildExecutiveInsights(p: DataProfileType): { findings: ExecFinding[]; recommendations: string[] } {
  const findings: ExecFinding[] = [];
  const recommendations: string[] = [];

  // ── Critical ────────────────────────────────────────────────────────────
  const highNullCols = p.columns.filter(c => c.nullPercent > 30 && !c.isConstant);
  if (highNullCols.length) {
    findings.push({ type: 'critical', text: `${highNullCols.length} field(s) have >30% missing data — analysis results will be unreliable: ${highNullCols.map(c => `${c.name} (${c.nullPercent}%)`).join(', ')}` });
    recommendations.push(`Investigate why ${highNullCols.map(c => c.name).join(', ')} have high missing rates — optional fields, collection gaps, or a system issue?`);
  }
  if (p.duplicateRows > 0 && p.duplicatePercent > 5) {
    findings.push({ type: 'critical', text: `${p.duplicateRows.toLocaleString()} duplicate records (${p.duplicatePercent}%) — counts and totals are inflated` });
    recommendations.push(`Deduplicate ${p.duplicateRows} records before any reporting or modelling`);
  }
  const constantCols = p.columns.filter(c => c.isConstant);
  if (constantCols.length) {
    findings.push({ type: 'critical', text: `${constantCols.length} field(s) have the same value in every row — they carry zero information: ${constantCols.map(c => c.name).join(', ')}` });
    recommendations.push(`Remove redundant field(s): ${constantCols.map(c => c.name).join(', ')}`);
  }
  // Stale data
  const dtCols = p.columns.filter(c => c.inferredType === 'datetime' && c.dateMax);
  if (dtCols.length > 0 && dtCols[0].dateMax) {
    const daysSince = Math.round((Date.now() - new Date(dtCols[0].dateMax).getTime()) / 86_400_000);
    if (daysSince > 90) findings.push({ type: 'critical', text: `Data appears stale — most recent record in "${dtCols[0].name}" is ${Math.round(daysSince / 30)} month(s) old` });
    else if (daysSince > 30) findings.push({ type: 'warning', text: `Data may be outdated — most recent record in "${dtCols[0].name}" is ${daysSince} days old` });
    else findings.push({ type: 'positive', text: `Data is current — most recent record in "${dtCols[0].name}" is ${daysSince === 0 ? 'today' : `${daysSince} day(s) ago`}` });
  }

  // ── Warnings ────────────────────────────────────────────────────────────
  if (p.duplicateRows > 0 && p.duplicatePercent <= 5) {
    findings.push({ type: 'warning', text: `${p.duplicateRows} duplicate records (${p.duplicatePercent}%) — minor but should be reviewed` });
    if (!recommendations.some(r => r.includes('eduplicate'))) recommendations.push(`Remove ${p.duplicateRows} duplicate records before analysis`);
  }
  const outlierCols = p.columns.filter(c => (c.outlierCount ?? 0) > 0);
  if (outlierCols.length) {
    const totalOut = outlierCols.reduce((s, c) => s + (c.outlierCount ?? 0), 0);
    findings.push({ type: 'warning', text: `${totalOut} unusual values across ${outlierCols.length} numeric field(s) — averages and totals may be skewed` });
    recommendations.push(`Review outlier values in: ${outlierCols.slice(0, 3).map(c => c.name).join(', ')}${outlierCols.length > 3 ? ` and ${outlierCols.length - 3} more` : ''} — decide whether to cap or exclude them`);
  }
  const formatIssueCols = p.columns.filter(c => (c.whitespaceCount ?? 0) > 0 || c.mixedTypeCount != null);
  if (formatIssueCols.length) {
    findings.push({ type: 'warning', text: `${formatIssueCols.length} field(s) have formatting inconsistencies (extra spaces, mixed types) — may cause incorrect grouping or joining` });
    recommendations.push(`Clean formatting issues in: ${formatIssueCols.map(c => c.name).join(', ')}`);
  }
  const patternIssueCols = p.columns.filter(c => c.patternValidPercent != null && c.patternValidPercent < 80);
  if (patternIssueCols.length) {
    patternIssueCols.forEach(c => findings.push({ type: 'warning', text: `"${c.name}" is detected as ${c.detectedPattern} but only ${c.patternValidPercent}% of values match the expected format` }));
    recommendations.push(`Validate and fix pattern values in: ${patternIssueCols.map(c => c.name).join(', ')}`);
  }
  const severeConc = p.columns.filter(c => c.concentrationLabel === 'severe');
  if (severeConc.length) {
    severeConc.forEach(c => findings.push({ type: 'warning', text: `"${c.name}" is dominated by one value (${c.concentrationRisk}%) — this field will have limited analytical value` }));
  }
  const skewedCols = p.columns.filter(c => c.stats?.skewness != null && Math.abs(c.stats.skewness!) > 1.5);
  if (skewedCols.length) {
    findings.push({ type: 'warning', text: `${skewedCols.length} numeric field(s) are heavily skewed — the mean is not representative; use the median instead: ${skewedCols.map(c => c.name).join(', ')}` });
  }
  // Trend warnings
  const downCols = p.columns.filter(c => c.trendDirection === 'down');
  if (downCols.length) findings.push({ type: 'warning', text: `Declining data volume detected in: ${downCols.map(c => `${c.name} (${c.trendPctChange}%)`).join(', ')} — check for data collection gaps` });

  // ── Positives ───────────────────────────────────────────────────────────
  if (p.overallQuality >= 90) findings.push({ type: 'positive', text: `Data quality is excellent (${p.overallQuality}%) — dataset is well-suited for analysis and reporting` });
  else if (p.overallQuality >= 75) findings.push({ type: 'positive', text: `Data quality is good (${p.overallQuality}%) — minor issues exist but data is generally reliable` });
  if (p.duplicateRows === 0) findings.push({ type: 'positive', text: 'No duplicate records detected — data integrity is clean' });
  const upCols = p.columns.filter(c => c.trendDirection === 'up');
  if (upCols.length) findings.push({ type: 'positive', text: `Growing data volume in: ${upCols.map(c => `${c.name} (+${c.trendPctChange}%)`).join(', ')}` });
  // Top correlation
  const topPairs: { a: string; b: string; r: number }[] = [];
  if (p.correlationLabels.length >= 2) {
    p.correlationLabels.forEach((a, i) => p.correlationLabels.forEach((b, j) => {
      if (j <= i) return;
      const r = p.correlationMatrix[i]?.[j];
      if (r != null) topPairs.push({ a, b, r });
    }));
    topPairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  }
  if (topPairs[0] && Math.abs(topPairs[0].r) > 0.7) {
    const dir = topPairs[0].r > 0 ? 'increase together' : 'move in opposite directions';
    findings.push({ type: 'positive', text: `Strong relationship found: "${topPairs[0].a}" and "${topPairs[0].b}" tend to ${dir} (r=${topPairs[0].r.toFixed(2)}) — useful for forecasting` });
  }

  return { findings, recommendations };
}

function buildExecDashboard(p: DataProfileType): {
  readiness: 'ready' | 'review' | 'not-ready';
  readinessSummary: string;
  context: string[];
  impactCards: ImpactCard[];
  narratives: string[];
  relationships: ExecRelationship[];
  actions: ActionItem[];
} {
  const impactCards: ImpactCard[] = [];
  const narratives: string[] = [];
  const relationships: ExecRelationship[] = [];
  const actions: ActionItem[] = [];
  let criticalCount = 0;
  let warningCount  = 0;

  // ── Freshness ──────────────────────────────────────────────────────────
  const dtCols = p.columns.filter(c => c.inferredType === 'datetime' && c.dateMax);
  let daysSince: number | null = null;
  if (dtCols[0]?.dateMax) {
    daysSince = Math.max(0, Math.round((Date.now() - new Date(dtCols[0].dateMax).getTime()) / 86_400_000));
    if (daysSince > 90) {
      criticalCount++;
      impactCards.push({ icon: '📅', severity: 'critical',
        headline: `Data is ${Math.round(daysSince / 30)} months old`,
        detail: `The most recent record in "${dtCols[0].name}" is from ${dtCols[0].dateMax}. Decisions based on this data may not reflect current reality.`,
        owner: 'Data Team' });
      actions.push({ priority: 'critical', owner: 'Data Team', text: `Refresh data — most recent record is ${Math.round(daysSince / 30)} months old (field: "${dtCols[0].name}")` });
    } else if (daysSince > 30) {
      warningCount++;
      impactCards.push({ icon: '📅', severity: 'warning',
        headline: `Data is ${daysSince} days old`,
        detail: `Last record in "${dtCols[0].name}" was ${dtCols[0].dateMax}. Verify this is acceptable for the intended use.`,
        owner: 'Data Team' });
    }
  }

  // ── Missing data ────────────────────────────────────────────────────────
  const highNullCols = p.columns.filter(c => c.nullPercent > 15 && !c.isConstant).sort((a, b) => b.nullPercent - a.nullPercent);
  highNullCols.slice(0, 3).forEach(col => {
    const affected = Math.round(col.nullPercent / 100 * p.rowCount);
    const dom = colDomain(col.name);
    const impact = dom === 'financial' ? `Financial totals for "${col.name}" will be understated.` :
                   dom === 'customer'  ? `${affected.toLocaleString()} customer records are incomplete.` :
                   dom === 'product'   ? `${affected.toLocaleString()} product records are missing this value.` :
                   `${affected.toLocaleString()} records are incomplete for this field.`;
    const sev: ImpactCard['severity'] = col.nullPercent > 30 ? 'critical' : 'warning';
    if (sev === 'critical') criticalCount++; else warningCount++;
    impactCards.push({ icon: '⬜', severity: sev,
      headline: `${affected.toLocaleString()} records (${col.nullPercent}%) missing "${col.name}"`,
      detail: impact,
      owner: 'Data Team' });
    actions.push({ priority: sev === 'critical' ? 'critical' : 'warning',
      owner: 'Data Team',
      text: `Investigate ${affected.toLocaleString()} missing "${col.name}" values (${col.nullPercent}% of records) — impairs ${dom === 'financial' ? 'financial reporting' : dom === 'customer' ? 'customer analysis' : 'reporting accuracy'}` });
  });

  // ── Duplicates ─────────────────────────────────────────────────────────
  if (p.duplicateRows > 0) {
    const dom = p.columns.find(c => colDomain(c.name) === 'customer') ? 'customer' : 'transaction';
    const sev: ImpactCard['severity'] = p.duplicatePercent > 5 ? 'critical' : 'warning';
    if (sev === 'critical') criticalCount++; else warningCount++;
    const inflationNote = p.duplicatePercent < 1 ? `less than 1% inflation` : `~${p.duplicatePercent}% inflation in counts and totals`;
    impactCards.push({ icon: '🔁', severity: sev,
      headline: `${p.duplicateRows.toLocaleString()} duplicate ${dom} records`,
      detail: `Duplicate records cause ${inflationNote}. Any report using counts or sums from this data will be overstated.`,
      owner: 'Data Team' });
    actions.push({ priority: sev === 'critical' ? 'critical' : 'warning',
      owner: 'Data Team',
      text: `Remove ${p.duplicateRows.toLocaleString()} duplicate records before running any reports — they inflate totals by ~${p.duplicatePercent}%` });
  }

  // ── Pattern validity ────────────────────────────────────────────────────
  const patternCols = p.columns.filter(c => c.patternValidPercent != null && c.patternValidPercent < 85);
  patternCols.forEach(col => {
    const bad = (col.patternValidCount != null && col.patternValidPercent != null) ? Math.round((1 - col.patternValidPercent / 100) * p.rowCount) : '?';
    const owner = col.detectedPattern === 'email' ? 'Marketing' :
                  col.detectedPattern === 'phone' ? 'CRM Team' : 'Data Team';
    const businessImpact = col.detectedPattern === 'email'
      ? `${typeof bad === 'number' ? bad.toLocaleString() : bad} contacts may not receive email communications.`
      : col.detectedPattern === 'phone'
      ? `${typeof bad === 'number' ? bad.toLocaleString() : bad} phone numbers are invalid — outreach will fail.`
      : `${typeof bad === 'number' ? bad.toLocaleString() : bad} records have an unexpected format in "${col.name}".`;
    warningCount++;
    impactCards.push({ icon: '⚠️', severity: 'warning',
      headline: `${col.patternValidPercent}% of "${col.name}" values are valid ${col.detectedPattern}s`,
      detail: businessImpact, owner });
    actions.push({ priority: 'warning', owner,
      text: `Fix ${col.detectedPattern} format in "${col.name}" — ${100 - col.patternValidPercent!}% of values are invalid` });
  });

  // ── Outliers ────────────────────────────────────────────────────────────
  const financialOutlierCols = p.columns.filter(c => (c.outlierCount ?? 0) > 0 && colDomain(c.name) === 'financial');
  if (financialOutlierCols.length) {
    const totalOut = financialOutlierCols.reduce((s, c) => s + (c.outlierCount ?? 0), 0);
    warningCount++;
    impactCards.push({ icon: '📊', severity: 'warning',
      headline: `${totalOut} unusual financial values detected`,
      detail: `Unusually high or low values in ${financialOutlierCols.map(c => `"${c.name}"`).join(', ')} may distort totals and averages. Manual review recommended before including in reports.`,
      owner: 'Finance Team' });
    actions.push({ priority: 'warning', owner: 'Finance Team',
      text: `Review ${totalOut} outlier values in ${financialOutlierCols.map(c => `"${c.name}"`).join(', ')} before including in financial reports` });
  }
  const otherOutlierCols = p.columns.filter(c => (c.outlierCount ?? 0) > 0 && colDomain(c.name) !== 'financial');
  if (otherOutlierCols.length) {
    const totalOut = otherOutlierCols.reduce((s, c) => s + (c.outlierCount ?? 0), 0);
    warningCount++;
    actions.push({ priority: 'warning', owner: 'Data Analyst',
      text: `Review ${totalOut} outlier values in ${otherOutlierCols.slice(0, 3).map(c => `"${c.name}"`).join(', ')} — decide whether to cap or exclude them` });
  }

  // ── Format issues ───────────────────────────────────────────────────────
  const wsColsNames = p.columns.filter(c => (c.whitespaceCount ?? 0) > 0).map(c => `"${c.name}"`);
  if (wsColsNames.length) {
    warningCount++;
    actions.push({ priority: 'warning', owner: 'Data Team',
      text: `Strip extra whitespace from ${wsColsNames.join(', ')} — causes mismatches when joining or grouping records` });
  }

  // ── Constant / useless columns ──────────────────────────────────────────
  const constCols = p.columns.filter(c => c.isConstant);
  if (constCols.length) {
    actions.push({ priority: 'warning', owner: 'Data Team',
      text: `Remove ${constCols.length} field(s) that carry no information (every record has the same value): ${constCols.map(c => `"${c.name}"`).join(', ')}` });
  }

  // ── Narratives: What this data shows ────────────────────────────────────
  // Concentration in categorical columns
  const highConcCols = p.columns.filter(c => c.concentrationRisk != null && c.concentrationRisk > 40 && c.inferredType !== 'boolean' && c.inferredType !== 'id');
  highConcCols.slice(0, 3).forEach(col => {
    const top = col.topValues?.[0];
    if (!top) return;
    const dom = colDomain(col.name);
    const sent = dom === 'product'   ? `"${top.value}" accounts for ${col.concentrationRisk}% of all ${col.name} records — the product mix is heavily concentrated.` :
                 dom === 'customer'  ? `${col.concentrationRisk}% of records share the same ${col.name} value ("${top.value}") — low diversity in this dimension.` :
                 dom === 'geographic'? `${col.concentrationRisk}% of records are from "${top.value}" — data is geographically concentrated.` :
                 `"${top.value}" is the dominant value in "${col.name}", appearing in ${col.concentrationRisk}% of records.`;
    narratives.push(sent);
  });

  // Trend narratives for datetime columns
  p.columns.filter(c => c.trendDirection && c.trendPctChange != null).forEach(col => {
    const pct = Math.abs(col.trendPctChange!);
    const dom = colDomain(col.name);
    const subject = dom === 'temporal' ? 'Record volume' : `Activity tracked in "${col.name}"`;
    if (col.trendDirection === 'up')
      narratives.push(`${subject} has grown by ${pct}% over the dataset period — an upward trend.`);
    else if (col.trendDirection === 'down')
      narratives.push(`${subject} has declined by ${pct}% — this may indicate a drop in activity or a data collection gap.`);
    else
      narratives.push(`${subject} is stable across the dataset period — no significant growth or decline.`);
  });

  // Distribution narratives for key numeric columns
  const financialCols = p.columns.filter(c => c.inferredType === 'numeric' && colDomain(c.name) === 'financial' && c.stats?.skewness != null);
  financialCols.slice(0, 2).forEach(col => {
    const sk = col.stats!.skewness!;
    if (Math.abs(sk) > 1.5)
      narratives.push(`"${col.name}" is highly skewed — a small number of records account for a disproportionate share of the total. Use median, not mean, as the typical value.`);
    else if (col.stats?.median != null)
      narratives.push(`Typical "${col.name}" value is ${col.stats.median.toLocaleString(undefined, { maximumFractionDigits: 2 })} (median), ranging from ${col.stats.min?.toLocaleString()} to ${col.stats.max?.toLocaleString()}.`);
  });

  // Boolean narratives
  p.columns.filter(c => c.inferredType === 'boolean').slice(0, 2).forEach(col => {
    const top = col.topValues?.[0];
    if (top) narratives.push(`${col.concentrationRisk ?? '?'}% of records have "${col.name}" = ${top.value}.`);
  });

  // ── Relationships: plain English only, strong ────────────────────────────
  const topPairs: { a: string; b: string; r: number; pv: number | null }[] = [];
  if (p.correlationLabels.length >= 2) {
    p.correlationLabels.forEach((a, i) => p.correlationLabels.forEach((b, j) => {
      if (j <= i) return;
      const r = p.correlationMatrix[i]?.[j];
      if (r != null && Math.abs(r) > 0.4) topPairs.push({ a, b, r, pv: p.pearsonPValues[i]?.[j] ?? null });
    }));
    topPairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  }
  topPairs.slice(0, 4).forEach(tp => {
    const domA = colDomain(tp.a); const domB = colDomain(tp.b);
    const sig = tp.pv != null && tp.pv < 0.05;
    if (!sig && Math.abs(tp.r) < 0.6) return; // skip weak/non-significant in exec view
    const dir = tp.r > 0 ? 'higher' : 'lower';
    const strength: ExecRelationship['strength'] = Math.abs(tp.r) > 0.65 ? 'strong' : 'moderate';
    let sentence: string;
    if (domA === 'financial' && domB === 'financial')
      sentence = `When "${tp.a}" is high, "${tp.b}" tends to be ${dir} too. These two financial figures are strongly linked.`;
    else if (domA === 'financial' || domB === 'financial') {
      const fin = domA === 'financial' ? tp.a : tp.b;
      const oth = domA === 'financial' ? tp.b : tp.a;
      sentence = tp.r > 0
        ? `Higher values in "${oth}" are associated with higher "${fin}" — useful for forecasting.`
        : `Higher values in "${oth}" are associated with lower "${fin}" — an inverse relationship.`;
    } else
      sentence = tp.r > 0
        ? `When "${tp.a}" increases, "${tp.b}" tends to increase too — they move in the same direction.`
        : `When "${tp.a}" increases, "${tp.b}" tends to decrease — they move in opposite directions.`;
    relationships.push({ sentence, strength });
  });

  // ── Readiness ──────────────────────────────────────────────────────────
  const readiness: 'ready' | 'review' | 'not-ready' = criticalCount > 0 ? 'not-ready' : warningCount > 0 ? 'review' : 'ready';
  const readinessSummary = readiness === 'ready'
    ? 'No critical issues found — data appears ready for analysis and reporting.'
    : readiness === 'review'
    ? `${warningCount} issue${warningCount > 1 ? 's' : ''} should be reviewed before presenting this data.`
    : `${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} must be resolved before this data is used in reports.`;

  const context: string[] = [];
  context.push(`${p.rowCount.toLocaleString()} records · ${p.columnCount} fields`);
  if (daysSince != null) context.push(`Last record: ${daysSince === 0 ? 'today' : `${daysSince} day${daysSince > 1 ? 's' : ''} ago`}`);
  if (p.duplicateRows === 0) context.push('No duplicates');

  return { readiness, readinessSummary, context, impactCards, narratives, relationships, actions };
}

function ExecutiveTab({ p }: { p: DataProfileType }) {
  const { readiness, readinessSummary, context, impactCards, narratives, relationships, actions } = buildExecDashboard(p);

  const readinessStyle = readiness === 'ready'
    ? { icon: '✅', bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', label: 'Ready' }
    : readiness === 'review'
    ? { icon: '🟡', bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', label: 'Needs Review' }
    : { icon: '🔴', bg: 'bg-red-500/10 border-red-500/30',    text: 'text-red-400',    label: 'Not Ready' };

  const severityBg = (s: ImpactCard['severity']) =>
    s === 'critical' ? 'bg-red-500/8 border-red-500/25' :
    s === 'warning'  ? 'bg-yellow-500/8 border-yellow-500/20' :
                       'bg-green-500/8 border-green-500/20';
  const severityText = (s: ImpactCard['severity']) =>
    s === 'critical' ? 'text-red-300' : s === 'warning' ? 'text-yellow-200' : 'text-green-200';
  const actionBorder = (pr: ActionItem['priority']) =>
    pr === 'critical' ? 'border-l-red-400 bg-red-500/5' : 'border-l-yellow-400 bg-yellow-500/5';

  const unusedFormatIssues = p.columns.filter(c => (c.whitespaceCount ?? 0) > 0 || c.mixedTypeCount != null);
  const coverage = +(100 - p.totalNullPercent).toFixed(1);

  return (
    <div className="space-y-4">

      {/* ── 1. Readiness Status ── */}
      <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${readinessStyle.bg}`}>
        <span className="text-base mt-0.5 shrink-0">{readinessStyle.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] font-bold ${readinessStyle.text}`}>{readinessStyle.label}</div>
          <div className="text-[10px] text-foreground/85 mt-0.5 leading-snug">{readinessSummary}</div>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {context.map((c, i) => (
              <span key={i} className="text-[9px] text-muted-foreground px-1.5 py-0.5 bg-background/40 rounded border border-border/50">{c}</span>
            ))}
            <span className="text-[9px] text-muted-foreground px-1.5 py-0.5 bg-background/40 rounded border border-border/50">{coverage}% data coverage</span>
            {unusedFormatIssues.length > 0 && <span className="text-[9px] text-yellow-400/80 px-1.5 py-0.5 bg-yellow-500/5 rounded border border-yellow-500/20">{unusedFormatIssues.length} formatting issue(s)</span>}
          </div>
        </div>
      </div>

      {/* ── 2. Business Impact ── */}
      {impactCards.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Business Impact</div>
          <div className="space-y-1.5">
            {impactCards.map((card, i) => (
              <div key={i} className={`flex items-start gap-2.5 px-2.5 py-2 rounded-lg border ${severityBg(card.severity)}`}>
                <span className="text-sm shrink-0 mt-0.5">{card.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-[10px] font-semibold ${severityText(card.severity)}`}>{card.headline}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed">{card.detail}</div>
                  {card.owner && (
                    <span className="inline-block mt-1 text-[8px] px-1.5 py-0.5 rounded bg-background/40 border border-border/40 text-muted-foreground">
                      Owner: {card.owner}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. What This Data Shows ── */}
      {narratives.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">What This Data Shows</div>
          <div className="space-y-1">
            {narratives.map((n, i) => (
              <div key={i} className="flex items-start gap-2 text-[10px] text-foreground/80 leading-snug px-2 py-1.5 bg-secondary/20 rounded border border-border/40">
                <span className="text-muted-foreground/60 shrink-0 mt-0.5">›</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Key Relationships ── */}
      {relationships.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Key Relationships</div>
          <div className="space-y-1">
            {relationships.map((rel, i) => (
              <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-lg border bg-blue-500/5 border-blue-500/20">
                <span className="text-blue-400 shrink-0 mt-0.5 text-[10px]">{rel.strength === 'strong' ? '⬤' : '◐'}</span>
                <div>
                  <span className="text-[9px] text-blue-400/70 font-medium uppercase mr-1.5">{rel.strength}</span>
                  <span className="text-[10px] text-foreground/85">{rel.sentence}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[8px] text-muted-foreground/50 mt-1 pl-1">Only statistically significant relationships are shown.</div>
        </div>
      )}

      {/* ── 5. Action Items ── */}
      {actions.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Action Items for Your Team</div>
          <div className="space-y-1">
            {actions
              .sort((a, b) => (a.priority === 'critical' ? -1 : 1) - (b.priority === 'critical' ? -1 : 1))
              .map((action, i) => (
                <div key={i} className={`flex items-start gap-2 px-2.5 py-2 rounded border-l-2 ${actionBorder(action.priority)}`}>
                  <span className="shrink-0 text-[9px] font-bold mt-0.5 w-3">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] font-semibold text-muted-foreground uppercase mr-1.5 tracking-wide">[{action.owner}]</span>
                    <span className="text-[10px] text-foreground/85">{action.text}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* All clear */}
      {impactCards.length === 0 && narratives.length === 0 && actions.length === 0 && (
        <div className="text-center py-6 text-[10px] text-muted-foreground">
          <div className="text-2xl mb-2">✅</div>
          <div className="font-medium text-green-400">No issues found</div>
          <div className="mt-1">This dataset appears clean and ready for use.</div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'executive',     label: 'Executive',    icon: <TrendingUp className="w-3 h-3" /> },
  { id: 'overview',      label: 'Overview',     icon: <BarChart3 className="w-3 h-3" /> },
  { id: 'columns',       label: 'Columns',      icon: <Database className="w-3 h-3" /> },
  { id: 'correlations',  label: 'Correlations', icon: <GitBranch className="w-3 h-3" /> },
  { id: 'diagnostics',   label: 'Diagnostics',  icon: <Activity className="w-3 h-3" /> },
  { id: 'samples',       label: 'Samples',      icon: <Copy className="w-3 h-3" /> },
];

export function DataProfile({ profile, loading, onRefresh, onInsertCode }: DataProfileProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<Tab>('executive');
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="px-4 py-2 border-b border-border bg-secondary/20 flex items-center gap-2 text-xs text-muted-foreground">
        <Database className="w-3.5 h-3.5 animate-pulse text-primary" />
        <span>Profiling data…</span>
      </div>
    );
  }
  if (!profile) return null;

  const cleaningCode = buildCleaningCode(profile);

  return (
    <div className="border-b border-border bg-secondary/20 shrink-0">
      {/* ── Header row ── */}
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        <button onClick={() => setCollapsed(c => !c)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          <BarChart3 className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground">Data Profile</span>
          <span className="text-[10px] text-muted-foreground truncate">
            {profile.rowCount.toLocaleString()} rows × {profile.columnCount} cols
          </span>
          {profile.duplicateRows > 0 && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 shrink-0">
              {profile.duplicateRows} dups
            </span>
          )}
          {collapsed ? <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                     : <ChevronDown  className="w-3 h-3 text-muted-foreground shrink-0" />}
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          <QualityBadge score={profile.overallQuality} />
          <button onClick={() => { onInsertCode?.(cleaningCode); }} title="Insert cleaning code"
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
            <Wand2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={async () => { await navigator.clipboard.writeText(cleaningCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            title="Copy cleaning code"
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
            <Copy className={`w-3.5 h-3.5 ${copied ? 'text-green-400' : ''}`} />
          </button>
          <button
            onClick={() => {
              const html = generateHtmlReport(profile);
              const blob = new Blob([html], { type: 'text/html' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'data-profile-report.html';
              a.click();
              URL.revokeObjectURL(a.href);
            }}
            title="Download HTML report as file"
            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-emerald-400 transition-colors">
            <FileDown className="w-3.5 h-3.5" />
          </button>
          {onRefresh && (
            <button onClick={onRefresh} title="Re-profile"
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {/* ── Tab bar ── */}
          <div className="flex border-b border-border px-3 gap-0">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="px-3 py-2 max-h-80 overflow-y-auto scrollbar-thin">
            {tab === 'executive'    && <ExecutiveTab     p={profile} />}
            {tab === 'overview'     && <OverviewTab      p={profile} />}
            {tab === 'columns'      && <ColumnsTab columns={profile.columns} />}
            {tab === 'correlations' && <CorrelationsTab  p={profile} />}
            {tab === 'diagnostics'  && <DiagnosticsTab   p={profile} />}
            {tab === 'samples'      && <SampleRowsTable  rows={profile.sampleRows} columns={profile.columns.map(c => c.name)} />}
          </div>
        </>
      )}
    </div>
  );
}
