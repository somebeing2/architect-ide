export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  code: string;
}

export const templates: Template[] = [
  // ────────────────────────────────────────────────────────────────
  // 1. Basic Statistics  –  null audit + IQR outlier report
  // ────────────────────────────────────────────────────────────────
  {
    id: 'basic-stats',
    name: 'Basic Statistics',
    description: 'Null audit, descriptive stats, and IQR outlier report',
    icon: 'BarChart3',
    code: `# Basic Statistics — null audit + IQR outlier detection
import pandas as pd

df = pd.read_csv('/data.csv')

print("=== Dataset Overview ===")
print(f"Shape: {df.shape[0]} rows × {df.shape[1]} columns")
print(f"\\nColumn Types:\\n{df.dtypes.to_string()}")

# ── Null audit ──────────────────────────────────────────────────
null_counts = df.isnull().sum()
null_pct    = (null_counts / len(df) * 100).round(2)
null_report = pd.DataFrame({'missing': null_counts, 'pct_%': null_pct})
null_report = null_report[null_report['missing'] > 0]

print("\\n=== Missing Values ===")
if null_report.empty:
    print("No missing values found — dataset is clean.")
else:
    print(null_report.to_string())
    # Drop rows that have any null in numeric columns for analysis
    df_clean = df.dropna()
    print(f"\\nRows after dropping nulls: {len(df_clean)} "
          f"(removed {len(df) - len(df_clean)})")
    df = df_clean

numeric_cols = df.select_dtypes(include='number').columns.tolist()
if not numeric_cols:
    print("No numeric columns found.")
else:
    print(f"\\n=== Descriptive Statistics ===\\n{df[numeric_cols].describe().to_string()}")

    # ── IQR outlier detection ───────────────────────────────────
    print("\\n=== IQR Outlier Report ===")
    for col in numeric_cols:
        Q1  = df[col].quantile(0.25)
        Q3  = df[col].quantile(0.75)
        IQR = Q3 - Q1
        lo  = Q1 - 1.5 * IQR
        hi  = Q3 + 1.5 * IQR
        n_out = int(((df[col] < lo) | (df[col] > hi)).sum())
        print(f"  {col:<25} {n_out:>4} outlier(s)   "
              f"fence [{lo:.2f}, {hi:.2f}]")

    print(f"\\n=== Skewness ===\\n{df[numeric_cols].skew().round(4).to_string()}")
    print(f"\\n=== Kurtosis ===\\n{df[numeric_cols].kurtosis().round(4).to_string()}")
`,
  },

  // ────────────────────────────────────────────────────────────────
  // 2. Correlation Matrix  –  null drop + IQR cleaning before heatmap
  // ────────────────────────────────────────────────────────────────
  {
    id: 'correlation-matrix',
    name: 'Correlation Matrix',
    description: 'IQR-cleaned interactive heatmap with null handling',
    icon: 'Grid3X3',
    code: `# Correlation Matrix — null handling + IQR cleaning
import pandas as pd
import plotly.graph_objects as go

df = pd.read_csv('/data.csv')
numeric_df = df.select_dtypes(include='number')

# ── Null handling ────────────────────────────────────────────────
before = len(numeric_df)
numeric_df = numeric_df.dropna()
if len(numeric_df) < before:
    print(f"Dropped {before - len(numeric_df)} rows with missing values.")

# ── IQR outlier removal (per-column mask) ───────────────────────
def iqr_mask(df: pd.DataFrame) -> pd.Series:
    mask = pd.Series(True, index=df.index)
    for col in df.columns:
        Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
        IQR = Q3 - Q1
        mask &= df[col].between(Q1 - 1.5 * IQR, Q3 + 1.5 * IQR)
    return mask

clean = numeric_df[iqr_mask(numeric_df)]
print(f"Retained {len(clean)} / {len(numeric_df)} rows after IQR outlier removal.")

if clean.shape[1] < 2:
    print("Need at least 2 numeric columns for correlation.")
else:
    corr = clean.corr()
    print("\\n=== Correlation Matrix ===")
    print(corr.round(3).to_string())

    _fig = go.Figure(data=go.Heatmap(
        z=corr.values,
        x=corr.columns.tolist(),
        y=corr.columns.tolist(),
        colorscale='RdBu_r',
        zmin=-1, zmax=1,
        text=corr.values.round(2),
        texttemplate='%{text}',
        textfont={"size": 10},
        hovertemplate='%{x} vs %{y}: %{z:.3f}<extra></extra>',
    ))
    _fig.update_layout(
        title='Correlation Matrix (IQR-cleaned data)',
        template='plotly_dark',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        width=700, height=600,
        font=dict(family='JetBrains Mono', color='#d4d4d4'),
    )
    print("\\nCorrelation heatmap generated.")
`,
  },

  // ────────────────────────────────────────────────────────────────
  // 3. Trend Plot  –  null drop + IQR outlier shading bands
  // ────────────────────────────────────────────────────────────────
  {
    id: 'trend-plot',
    name: 'Trend Plot',
    description: 'Trends per numeric column with IQR outlier shading',
    icon: 'TrendingUp',
    code: `# Trend Plot — null handling + IQR outlier shading
import pandas as pd
import plotly.graph_objects as go

df = pd.read_csv('/data.csv')
numeric_cols = df.select_dtypes(include='number').columns.tolist()

# ── Null handling ────────────────────────────────────────────────
before = len(df)
df = df.dropna(subset=numeric_cols).reset_index(drop=True)
if len(df) < before:
    print(f"Dropped {before - len(df)} rows with missing numeric values.")

print(f"=== Trend Analysis  ({len(df)} rows, {len(numeric_cols)} numeric columns) ===")

COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
_fig = go.Figure()

for i, col in enumerate(numeric_cols[:7]):
    color = COLORS[i % len(COLORS)]
    series = df[col]

    # IQR fence values
    Q1, Q3 = series.quantile(0.25), series.quantile(0.75)
    IQR    = Q3 - Q1
    lo, hi = Q1 - 1.5 * IQR, Q3 + 1.5 * IQR
    n_out  = int(((series < lo) | (series > hi)).sum())

    # Main trend line
    _fig.add_trace(go.Scatter(
        y=series.values, name=col,
        mode='lines',
        line=dict(width=2, color=color),
        hovertemplate=f'{col}: %{{y:.2f}}<extra></extra>',
    ))

    # IQR band (shaded region between fences)
    _fig.add_hrect(
        y0=lo, y1=hi,
        fillcolor=color, opacity=0.05,
        line_width=0,
    )

    print(f"  {col:<25}  mean={series.mean():.2f}  std={series.std():.2f}  "
          f"outliers={n_out}  IQR fence=[{lo:.2f}, {hi:.2f}]")

_fig.update_layout(
    title='Column Trends with IQR Outlier Bands',
    template='plotly_dark',
    paper_bgcolor='rgba(0,0,0,0)',
    plot_bgcolor='rgba(0,0,0,0)',
    width=800, height=500,
    font=dict(family='JetBrains Mono', color='#d4d4d4'),
    legend=dict(orientation='h', y=-0.15),
    xaxis_title='Row Index',
    yaxis_title='Value',
)
print("\\nTrend plot generated.")
`,
  },
];
