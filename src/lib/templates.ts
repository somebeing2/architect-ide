export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  code: string;
}

export const templates: Template[] = [
  {
    id: 'basic-stats',
    name: 'Basic Statistics',
    description: 'Compute descriptive statistics for all numeric columns',
    icon: 'BarChart3',
    code: `import pandas as pd

df = pd.read_csv('/data.csv')

print("=== Dataset Overview ===")
print(f"Shape: {df.shape[0]} rows × {df.shape[1]} columns")
print(f"\\nColumn Types:\\n{df.dtypes.to_string()}")
print(f"\\n=== Missing Values ===\\n{df.isnull().sum().to_string()}")
print(f"\\n=== Descriptive Statistics ===\\n{df.describe().to_string()}")

numeric_cols = df.select_dtypes(include='number').columns.tolist()
if numeric_cols:
    print(f"\\n=== Skewness ===\\n{df[numeric_cols].skew().to_string()}")
    print(f"\\n=== Kurtosis ===\\n{df[numeric_cols].kurtosis().to_string()}")
`,
  },
  {
    id: 'correlation-matrix',
    name: 'Correlation Matrix',
    description: 'Generate an interactive correlation heatmap',
    icon: 'Grid3X3',
    code: `import pandas as pd
import micropip
await micropip.install('plotly')
import plotly.graph_objects as go

df = pd.read_csv('/data.csv')
numeric_df = df.select_dtypes(include='number')

corr = numeric_df.corr()
print("=== Correlation Matrix ===")
print(corr.to_string())

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
    title='Correlation Matrix',
    template='plotly_dark',
    paper_bgcolor='rgba(0,0,0,0)',
    plot_bgcolor='rgba(0,0,0,0)',
    width=700, height=600,
    font=dict(family='JetBrains Mono', color='#d4d4d4'),
)
print("\\nCorrelation heatmap generated.")
`,
  },
  {
    id: 'trend-plot',
    name: 'Trend Plot',
    description: 'Plot trends for numeric columns over the index',
    icon: 'TrendingUp',
    code: `import pandas as pd
import micropip
await micropip.install('plotly')
import plotly.graph_objects as go

df = pd.read_csv('/data.csv')
numeric_cols = df.select_dtypes(include='number').columns.tolist()

print(f"=== Trend Analysis ===")
print(f"Plotting {len(numeric_cols)} numeric columns")

_fig = go.Figure()
colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

for i, col in enumerate(numeric_cols[:7]):
    color = colors[i % len(colors)]
    _fig.add_trace(go.Scatter(
        y=df[col].values,
        name=col,
        mode='lines',
        line=dict(width=2, color=color),
        hovertemplate=f'{col}: ' + '%{y:.2f}<extra></extra>',
    ))
    # Stats
    print(f"  {col}: mean={df[col].mean():.2f}, std={df[col].std():.2f}, trend={'↑' if df[col].iloc[-1] > df[col].iloc[0] else '↓'}")

_fig.update_layout(
    title='Column Trends',
    template='plotly_dark',
    paper_bgcolor='rgba(0,0,0,0)',
    plot_bgcolor='rgba(0,0,0,0)',
    width=800, height=500,
    font=dict(family='JetBrains Mono', color='#d4d4d4'),
    legend=dict(orientation='h', y=-0.15),
    xaxis_title='Index',
    yaxis_title='Value',
)
print("\\nTrend plot generated.")
`,
  },
];
