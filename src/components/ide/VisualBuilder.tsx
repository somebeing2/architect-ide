import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, ArrowRight, BarChart2, TrendingUp, ScatterChart, PieChart, LayoutGrid, BoxSelect } from 'lucide-react';

type ChartType = 'Bar' | 'Line' | 'Scatter' | 'Pie' | 'Histogram' | 'Box';
type AggType   = 'None' | 'Count' | 'Mean' | 'Sum' | 'Max' | 'Min';

const CHART_TYPES: Array<{ type: ChartType; icon: React.ComponentType<{ className?: string }> }> = [
  { type: 'Bar',       icon: BarChart2 },
  { type: 'Line',      icon: TrendingUp },
  { type: 'Scatter',   icon: ScatterChart },
  { type: 'Pie',       icon: PieChart },
  { type: 'Histogram', icon: LayoutGrid },
  { type: 'Box',       icon: BoxSelect },
];

const AGG_TYPES: AggType[] = ['None', 'Count', 'Mean', 'Sum', 'Max', 'Min'];

export interface VisualBuilderProps {
  csvData: string;
  onGenerateCode: (code: string) => void;
  onSwitchToEditor: () => void;
}

function parseColumns(csvData: string): { all: string[]; numeric: string[] } {
  const lines  = csvData.trim().split('\n');
  if (lines.length < 2) return { all: [], numeric: [] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  // Detect numeric columns by sampling first 5 data rows
  const sampleRows = lines.slice(1, 6);
  const numeric = headers.filter((_, ci) => {
    return sampleRows.some(row => {
      const cols = row.split(',');
      return !isNaN(parseFloat(cols[ci])) && cols[ci]?.trim() !== '';
    });
  });

  return { all: headers, numeric };
}

function buildCode(
  chartType: ChartType,
  xCol: string,
  yCol: string,
  colorCol: string,
  agg: AggType,
): string {
  const needsY = chartType !== 'Histogram' && chartType !== 'Pie';
  const needsAgg = (chartType === 'Bar' || chartType === 'Line') && agg !== 'None' && needsY;

  const lines: string[] = [
    `# Visual Builder — ${chartType} Chart`,
    `import pandas as pd`,
    `import plotly.graph_objects as go`,
    ``,
    `df = pd.read_csv('/data.csv')`,
    ``,
  ];

  if (needsAgg && yCol) {
    const aggFunc = agg.toLowerCase();
    lines.push(`# Aggregate data`);
    if (colorCol) {
      lines.push(`agg_df = df.groupby(['${xCol}', '${colorCol}'], as_index=False)['${yCol}'].${aggFunc}()`);
    } else {
      lines.push(`agg_df = df.groupby('${xCol}', as_index=False)['${yCol}'].${aggFunc}()`);
    }
    lines.push(`df = agg_df`);
    lines.push(``);
  }

  lines.push(`fig = go.Figure()`);

  if (chartType === 'Bar') {
    if (colorCol) {
      lines.push(`for val in df['${colorCol}'].unique():`);
      lines.push(`    sub = df[df['${colorCol}'] == val]`);
      lines.push(`    fig.add_trace(go.Bar(x=sub['${xCol}'], y=sub['${yCol}'], name=str(val)))`);
    } else {
      lines.push(`fig.add_trace(go.Bar(`);
      lines.push(`    x=df['${xCol}'],`);
      lines.push(`    y=df['${yCol}' if '${yCol}' else '${xCol}'],`);
      lines.push(`    marker_color='#3b82f6',`);
      lines.push(`))`);
    }
  } else if (chartType === 'Line') {
    if (colorCol) {
      lines.push(`for val in df['${colorCol}'].unique():`);
      lines.push(`    sub = df[df['${colorCol}'] == val]`);
      lines.push(`    fig.add_trace(go.Scatter(x=sub['${xCol}'], y=sub['${yCol}'], mode='lines+markers', name=str(val)))`);
    } else {
      lines.push(`fig.add_trace(go.Scatter(`);
      lines.push(`    x=df['${xCol}'],`);
      lines.push(`    y=df['${yCol}'],`);
      lines.push(`    mode='lines+markers',`);
      lines.push(`    line=dict(color='#3b82f6', width=2),`);
      lines.push(`))`);
    }
  } else if (chartType === 'Scatter') {
    lines.push(`fig.add_trace(go.Scatter(`);
    lines.push(`    x=df['${xCol}'],`);
    lines.push(`    y=df['${yCol}'],`);
    lines.push(`    mode='markers',`);
    if (colorCol) {
      lines.push(`    marker=dict(color=df['${colorCol}'], colorscale='Viridis', showscale=True, size=6),`);
    } else {
      lines.push(`    marker=dict(color='#3b82f6', size=6, opacity=0.7),`);
    }
    lines.push(`))`);
  } else if (chartType === 'Pie') {
    lines.push(`vc = df['${xCol}'].value_counts().head(10)`);
    lines.push(`fig.add_trace(go.Pie(`);
    lines.push(`    labels=vc.index.tolist(),`);
    lines.push(`    values=vc.values.tolist(),`);
    lines.push(`    hole=0.35,`);
    lines.push(`))`);
  } else if (chartType === 'Histogram') {
    lines.push(`fig.add_trace(go.Histogram(`);
    lines.push(`    x=df['${xCol}'],`);
    lines.push(`    nbinsx=30,`);
    lines.push(`    marker_color='#3b82f6',`);
    lines.push(`    opacity=0.8,`);
    lines.push(`))`);
  } else if (chartType === 'Box') {
    if (colorCol) {
      lines.push(`for val in df['${colorCol}'].unique():`);
      lines.push(`    sub = df[df['${colorCol}'] == val]`);
      lines.push(`    fig.add_trace(go.Box(y=sub['${xCol}'], name=str(val)))`);
    } else {
      lines.push(`fig.add_trace(go.Box(y=df['${xCol}'], name='${xCol}', marker_color='#3b82f6'))`);
    }
  }

  const title = needsY && yCol
    ? `${chartType}: ${yCol} by ${xCol}${needsAgg ? ` (${agg})` : ''}`
    : `${chartType}: ${xCol}`;

  lines.push(`fig.update_layout(`);
  lines.push(`    title='${title}',`);
  lines.push(`    template='plotly_dark',`);
  lines.push(`    paper_bgcolor='rgba(0,0,0,0)',`);
  lines.push(`    plot_bgcolor='rgba(0,0,0,0)',`);
  lines.push(`    font=dict(family='JetBrains Mono', color='#d4d4d4'),`);
  lines.push(`    height=500,`);
  lines.push(`)`);
  lines.push(`_fig = fig`);
  lines.push(`print(f"Chart generated: ${title}")`);

  return lines.join('\n');
}

export function VisualBuilder({ csvData, onGenerateCode, onSwitchToEditor }: VisualBuilderProps) {
  const { all: allCols, numeric: numericCols } = useMemo(() => parseColumns(csvData), [csvData]);

  const [chartType,  setChartType]  = useState<ChartType>('Bar');
  const [xCol,       setXCol]       = useState(allCols[0] ?? '');
  const [yCol,       setYCol]       = useState(numericCols[0] ?? '');
  const [colorCol,   setColorCol]   = useState('');
  const [agg,        setAgg]        = useState<AggType>('None');

  const needsY   = chartType !== 'Histogram' && chartType !== 'Pie';
  const needsAgg = chartType === 'Bar' || chartType === 'Line';

  const handleGenerate = () => {
    const code = buildCode(chartType, xCol, yCol, colorCol, agg);
    onGenerateCode(code);
  };

  const SelectField = ({
    label, value, onChange, options, placeholder,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder?: string;
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded bg-secondary border border-border text-foreground text-xs outline-none focus:border-primary transition-colors"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <h3 className="text-xs font-bold text-foreground tracking-wide">Visual Builder</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">No-code chart generator</p>
        </div>
        <button
          onClick={onSwitchToEditor}
          className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
        >
          Switch to Editor <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {/* Chart type selector */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Chart Type</p>
          <div className="grid grid-cols-3 gap-2">
            {CHART_TYPES.map(({ type, icon: Icon }) => (
              <motion.button
                key={type}
                onClick={() => setChartType(type)}
                whileTap={{ scale: 0.96 }}
                className={`flex flex-col items-center gap-1.5 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                  chartType === type
                    ? 'bg-primary/15 border-primary text-primary'
                    : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                {type}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Axis config */}
        <div className="space-y-3">
          <SelectField
            label={chartType === 'Histogram' || chartType === 'Box' || chartType === 'Pie' ? 'Column' : 'X Axis'}
            value={xCol}
            onChange={setXCol}
            options={allCols}
          />

          {needsY && (
            <SelectField
              label="Y Axis"
              value={yCol}
              onChange={setYCol}
              options={numericCols}
              placeholder="— select column —"
            />
          )}

          <SelectField
            label="Color By (optional)"
            value={colorCol}
            onChange={setColorCol}
            options={allCols}
            placeholder="— none —"
          />

          {needsAgg && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Aggregation</label>
              <div className="flex gap-1.5 flex-wrap">
                {AGG_TYPES.map(a => (
                  <button
                    key={a}
                    onClick={() => setAgg(a)}
                    className={`px-2.5 py-1 rounded text-[11px] border transition-all ${
                      agg === a
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary/40 border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generate button */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <button
          onClick={handleGenerate}
          disabled={!xCol || (needsY && !yCol)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Play className="w-3.5 h-3.5" />
          Generate &amp; Run
        </button>
      </div>
    </div>
  );
}
