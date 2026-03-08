export type TemplateCategory = 'explore' | 'clean' | 'visualize' | 'export' | 'education';

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: TemplateCategory;
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
    category: 'explore',
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
    category: 'visualize',
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
    category: 'visualize',
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

  // ────────────────────────────────────────────────────────────────
  // 4. Data Janitor — automated cleaning pipeline
  // ────────────────────────────────────────────────────────────────
  {
    id: 'data-janitor',
    name: 'Data Janitor',
    description: 'Automated cleaning: duplicates, nulls, outlier capping, whitespace',
    icon: 'Sparkles',
    category: 'clean',
    code: `# Data Janitor — automated cleaning pipeline
import pandas as pd

df = pd.read_csv('/data.csv')
report = []

# 1. Shape
report.append(f"Original shape: {df.shape[0]} rows × {df.shape[1]} cols")

# 2. Duplicates
n_dup = df.duplicated().sum()
df = df.drop_duplicates()
report.append(f"Removed {n_dup} duplicate rows")

# 3. Null handling per column
for col in df.columns:
    n_null = df[col].isnull().sum()
    if n_null == 0:
        continue
    pct = n_null / len(df)
    if pct > 0.5:
        df = df.drop(columns=[col])
        report.append(f"Dropped column '{col}' (>{int(pct*100)}% null)")
    elif df[col].dtype in ['float64','int64']:
        fill_val = df[col].median()
        df[col] = df[col].fillna(fill_val)
        report.append(f"Filled '{col}' nulls with median ({fill_val:.2f})")
    else:
        fill_val = df[col].mode()[0]
        df[col] = df[col].fillna(fill_val)
        report.append(f"Filled '{col}' nulls with mode ('{fill_val}')")

# 4. IQR outlier capping (Winsorize)
numeric_cols = df.select_dtypes(include='number').columns.tolist()
for col in numeric_cols:
    Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
    IQR = Q3 - Q1
    lo, hi = Q1 - 1.5*IQR, Q3 + 1.5*IQR
    n_cap = int(((df[col] < lo) | (df[col] > hi)).sum())
    df[col] = df[col].clip(lo, hi)
    if n_cap:
        report.append(f"Winsorized {n_cap} outliers in '{col}'")

# 5. Strip whitespace from string cols
for col in df.select_dtypes(include='object').columns:
    df[col] = df[col].str.strip()

print("=== Data Janitor Report ===")
for line in report:
    print(f"  ✓ {line}")
print(f"\\nClean shape: {df.shape[0]} rows × {df.shape[1]} cols")
print(f"\\n=== Clean Data Sample ===\\n{df.head(5).to_string()}")
`,
  },

  // ────────────────────────────────────────────────────────────────
  // 5. Business Pivot — group-by aggregation & pivot table
  // ────────────────────────────────────────────────────────────────
  {
    id: 'business-pivot',
    name: 'Business Pivot',
    description: 'Group-by aggregation and pivot table analysis',
    icon: 'Table2',
    category: 'explore',
    code: `# Business Pivot — group-by aggregation & pivot table
import pandas as pd

df = pd.read_csv('/data.csv')
numeric_cols = df.select_dtypes(include='number').columns.tolist()
cat_cols     = df.select_dtypes(include='object').columns.tolist()

print("=== Column Overview ===")
print(f"Numeric : {numeric_cols}")
print(f"Categorical: {cat_cols}")

if cat_cols and numeric_cols:
    grp_col = cat_cols[0]
    val_col = numeric_cols[0]
    agg = df.groupby(grp_col)[val_col].agg(['count','mean','sum','min','max']).round(2)
    agg.columns = ['Count','Mean','Sum','Min','Max']
    print(f"\\n=== Group-by '{grp_col}' → '{val_col}' ===\\n{agg.to_string()}")

    if len(cat_cols) >= 2 and len(numeric_cols) >= 1:
        pivot = pd.pivot_table(df, values=numeric_cols[0],
                               index=cat_cols[0],
                               aggfunc=['mean','count'])
        print(f"\\n=== Pivot Table ===\\n{pivot.round(2).to_string()}")
else:
    print("\\nNeed at least one categorical and one numeric column for pivot.")

print(f"\\n=== Value Counts (top 10 per categorical col) ===")
for col in cat_cols[:3]:
    print(f"\\n  {col}:\\n{df[col].value_counts().head(10).to_string()}")
`,
  },

  // ────────────────────────────────────────────────────────────────
  // 6. Schema Auditor — deep data quality report
  // ────────────────────────────────────────────────────────────────
  {
    id: 'schema-auditor',
    name: 'Schema Auditor',
    description: 'Deep data quality report with quality score and issue detection',
    icon: 'ClipboardList',
    category: 'explore',
    code: `# Schema Auditor — deep data quality report
import pandas as pd

df = pd.read_csv('/data.csv')
total_rows = len(df)
total_cells = df.size

print("=== SCHEMA AUDIT REPORT ===")
print(f"Rows: {total_rows:,}  |  Columns: {df.shape[1]}  |  Cells: {total_cells:,}")

# Data quality score
null_pct = df.isnull().sum().sum() / total_cells
dup_pct  = df.duplicated().sum() / total_rows
quality  = max(0, round((1 - null_pct - dup_pct) * 100, 1))
print(f"Quality Score: {quality}/100  (nulls {null_pct*100:.1f}%, dups {dup_pct*100:.1f}%)\\n")

print(f"{'Column':<25} {'Type':<12} {'Non-Null':<10} {'Unique':<8} {'Min':<12} {'Max':<12}")
print("-" * 80)
for col in df.columns:
    dtype   = str(df[col].dtype)
    nn      = df[col].notna().sum()
    uniq    = df[col].nunique()
    if df[col].dtype in ['float64','int64']:
        mn, mx = f"{df[col].min():.2f}", f"{df[col].max():.2f}"
    else:
        mn, mx = str(df[col].min())[:10], str(df[col].max())[:10]
    print(f"{col:<25} {dtype:<12} {nn:<10} {uniq:<8} {mn:<12} {mx:<12}")

# Potential issues
print("\\n=== Potential Issues ===")
for col in df.columns:
    issues = []
    null_count = df[col].isnull().sum()
    if null_count:
        issues.append(f"{null_count} nulls ({null_count/total_rows*100:.1f}%)")
    if df[col].dtype == 'object':
        numeric_pct = pd.to_numeric(df[col], errors='coerce').notna().sum() / total_rows
        if numeric_pct > 0.5:
            issues.append("stored as text but looks numeric")
    if issues:
        print(f"  ⚠  {col}: {' | '.join(issues)}")
if not any(df[col].isnull().sum() > 0 for col in df.columns):
    print("  ✓  No issues found — dataset looks clean!")
`,
  },

  // ────────────────────────────────────────────────────────────────
  // 7. Smart Exporter — generate JSON + Markdown report
  // ────────────────────────────────────────────────────────────────
  {
    id: 'smart-exporter',
    name: 'Smart Exporter',
    description: 'Generate JSON summary and Markdown report from your data',
    icon: 'FileOutput',
    category: 'export',
    code: `# Smart Exporter — generate JSON + Markdown report
import pandas as pd, json

df = pd.read_csv('/data.csv')
numeric_cols = df.select_dtypes(include='number').columns.tolist()

# ── JSON Summary ──────────────────────────────────────────────
summary = {
    "rows"    : int(df.shape[0]),
    "columns" : int(df.shape[1]),
    "schema"  : {col: str(df[col].dtype) for col in df.columns},
    "nulls"   : {col: int(df[col].isnull().sum()) for col in df.columns},
    "stats"   : {}
}
for col in numeric_cols:
    summary["stats"][col] = {
        "mean"  : round(float(df[col].mean()), 4),
        "std"   : round(float(df[col].std()),  4),
        "min"   : round(float(df[col].min()),  4),
        "max"   : round(float(df[col].max()),  4),
        "median": round(float(df[col].median()),4),
    }

json_out = json.dumps(summary, indent=2)
print("=== JSON Summary ===")
print(json_out)

# ── Markdown Report ───────────────────────────────────────────
md = ["# Data Analysis Report", "",
      f"| Metric | Value |", f"|--------|-------|",
      f"| Rows   | {df.shape[0]:,} |",
      f"| Columns| {df.shape[1]} |",
      f"| Nulls  | {df.isnull().sum().sum()} |", ""]

md += ["## Column Statistics", ""]
md += ["| Column | Type | Mean | Std | Min | Max |",
       "|--------|------|------|-----|-----|-----|"]
for col in numeric_cols:
    md.append(f"| {col} | numeric | {df[col].mean():.2f} | {df[col].std():.2f} | {df[col].min():.2f} | {df[col].max():.2f} |")

print("\\n\\n=== Markdown Report ===")
print('\\n'.join(md))
`,
  },

  // ────────────────────────────────────────────────────────────────
  // 8. Interactive Filters — Plotly subplot grid
  // ────────────────────────────────────────────────────────────────
  {
    id: 'interactive-filters',
    name: 'Interactive Filters',
    description: 'Histogram grid for distribution exploration across numeric columns',
    icon: 'LayoutGrid',
    category: 'visualize',
    code: `# Interactive Filters — Plotly subplot grid
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots

df = pd.read_csv('/data.csv')
numeric_cols = df.select_dtypes(include='number').columns.tolist()[:4]
if not numeric_cols:
    print("No numeric columns found.")
else:
    n = len(numeric_cols)
    rows = (n + 1) // 2
    fig  = make_subplots(
        rows=rows, cols=min(2, n),
        subplot_titles=numeric_cols,
    )
    colors = ['#3b82f6','#10b981','#f59e0b','#ef4444']
    for i, col in enumerate(numeric_cols):
        r, c = divmod(i, 2)
        fig.add_trace(
            go.Histogram(x=df[col], name=col,
                         marker_color=colors[i % len(colors)],
                         opacity=0.8, nbinsx=30,
                         hovertemplate=f'{col}: %{{x}}<br>Count: %{{y}}<extra></extra>'),
            row=r+1, col=c+1,
        )
    fig.update_layout(
        title='Distribution Explorer (Histogram Grid)',
        template='plotly_dark',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        showlegend=False, height=400,
        font=dict(family='JetBrains Mono', color='#d4d4d4'),
    )
    _fig = fig
    print(f"Plotted distributions for: {', '.join(numeric_cols)}")
`,
  },

  // ────────────────────────────────────────────────────────────────
  // 9. Correlation Heatmap — Spearman feature-target ranking
  // ────────────────────────────────────────────────────────────────
  {
    id: 'spearman-heatmap',
    name: 'Spearman Heatmap',
    description: 'Spearman rank correlation heatmap ordered by feature importance',
    icon: 'Flame',
    category: 'visualize',
    code: `# Correlation Heatmap — Spearman feature-target ranking
import pandas as pd
import plotly.graph_objects as go

df = pd.read_csv('/data.csv').select_dtypes(include='number').dropna()

if df.shape[1] < 2:
    print("Need at least 2 numeric columns.")
else:
    # Spearman rank correlation (robust to outliers)
    corr = df.corr(method='spearman')

    # Reorder by hierarchical clustering proxy (sum of abs corr)
    order = corr.abs().sum().sort_values(ascending=False).index.tolist()
    corr  = corr.loc[order, order]

    print("=== Spearman Rank Correlation ===")
    print(corr.round(3).to_string())

    _fig = go.Figure(go.Heatmap(
        z=corr.values,
        x=corr.columns.tolist(),
        y=corr.columns.tolist(),
        colorscale='Viridis',
        zmin=-1, zmax=1,
        colorbar=dict(title='ρ'),
        text=corr.values.round(2),
        texttemplate='%{text}',
        hovertemplate='%{y} vs %{x}<br>ρ = %{z:.3f}<extra></extra>',
    ))
    _fig.update_layout(
        title='Spearman Correlation (feature-ordered)',
        template='plotly_dark',
        paper_bgcolor='rgba(0,0,0,0)',
        plot_bgcolor='rgba(0,0,0,0)',
        width=700, height=600,
        font=dict(family='JetBrains Mono', color='#d4d4d4'),
    )
    print("\\nSpearman heatmap generated.")
`,
  },

  // ────────────────────────────────────────────────────────────────
  // 10. Student Lab — step-by-step guided analysis
  // ────────────────────────────────────────────────────────────────
  {
    id: 'student-lab',
    name: 'Student Lab',
    description: 'Step-by-step guided exploration for learning data analysis',
    icon: 'GraduationCap',
    category: 'education',
    code: `# Student Lab — step-by-step guided analysis
import pandas as pd

print("╔══════════════════════════════════╗")
print("║   STUDENT LAB: Data Exploration  ║")
print("╚══════════════════════════════════╝\\n")

df = pd.read_csv('/data.csv')

# Step 1
print("📌 STEP 1: Load & Inspect")
print(f"   Your dataset has {df.shape[0]} rows and {df.shape[1]} columns.")
print(f"   Columns: {list(df.columns)}\\n")

# Step 2
print("📌 STEP 2: Check for Missing Values")
nulls = df.isnull().sum()
if nulls.sum() == 0:
    print("   ✓ Great news — no missing values!\\n")
else:
    print(f"   Missing values found:\\n{nulls[nulls > 0].to_string()}\\n")

# Step 3
print("📌 STEP 3: Describe Numeric Columns")
numeric = df.select_dtypes(include='number')
if numeric.empty:
    print("   No numeric columns found.\\n")
else:
    print(f"{numeric.describe().round(2).to_string()}\\n")

# Step 4
print("📌 STEP 4: Explore Text Columns")
text_cols = df.select_dtypes(include='object').columns
for col in text_cols[:2]:
    print(f"   '{col}' — {df[col].nunique()} unique values:")
    print(f"   {df[col].value_counts().head(5).to_string()}\\n")

print("📌 STEP 5: Quick Correlation")
if numeric.shape[1] >= 2:
    top_corr = numeric.corr().unstack().drop_duplicates()
    top_corr = top_corr[top_corr.index.get_level_values(0) != top_corr.index.get_level_values(1)]
    top_corr = top_corr.abs().sort_values(ascending=False).head(5)
    print("   Top 5 correlated pairs:")
    for (a, b), v in top_corr.items():
        print(f"   {a} ↔ {b}: {v:.3f}")
else:
    print("   Need ≥2 numeric columns for correlation.")

print("\\n✅ Lab complete! Try a Template for deeper analysis.")
`,
  },
];
