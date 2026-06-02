/// <reference lib="webworker" />

let pyodide: unknown = null;
let duckDbPort: MessagePort | null = null;
let offscreenCanvas: OffscreenCanvas | null = null;
const ctx: OffscreenCanvasRenderingContext2D | null = null;
let skipCanvas: boolean = false;

// Stub out document/window for matplotlib/plotly if needed, though Pyodide handles most of it.
self.window = self as unknown as Window & typeof globalThis;

async function initPyodide() {
  if (pyodide) return pyodide;
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js');
  pyodide = await (self as unknown as { loadPyodide: (config: unknown) => Promise<unknown> }).loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
  });

  self.postMessage({ type: 'LOG', msg: '>>> Installing core packages (pandas, micropip, pyarrow)…' });
  await (pyodide as { loadPackage: (packages: string[]) => Promise<unknown> }).loadPackage(['pandas', 'micropip']);

  self.postMessage({ type: 'LOG', msg: '>>> Installing plotly, openpyxl, pyarrow via micropip…' });
  await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(`
import micropip
await micropip.install(['plotly', 'openpyxl', 'pyarrow'])

import sys
from io import StringIO
class OutputCapture:
    def __init__(self):
        self.outputs = []
    def write(self, text):
        if text.strip():
            self.outputs.append(text)
    def flush(self):
        pass
    def get_output(self):
        result = '\\n'.join(self.outputs)
        self.outputs = []
        return result

_capture = OutputCapture()
sys.stdout = _capture
sys.stderr = _capture
`);
  self.postMessage({ type: 'LOG', msg: '>>> Pyodide ready. All execution is local (WASM).' });
  return pyodide;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    try {
      await initPyodide();
      self.postMessage({ type: 'READY' });
    } catch (err: unknown) {
      self.postMessage({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
    }
  }
  else if (type === 'SET_PORT') {
    duckDbPort = e.ports[0];
  }
  else if (type === 'SET_CANVAS') {
    if (!e.data.canvas) {
      self.postMessage({ type: 'LOG', msg: '>>> WARNING: OffscreenCanvas failed to transfer. Proceeding with data-only analysis.' });
      skipCanvas = true;
    } else {
      offscreenCanvas = e.data.canvas;
      skipCanvas = false;
    }
  }
  else if (type === 'LOAD_EXCEL') {
    self.postMessage({ type: 'LOG', msg: '>>> Converting Excel file via pandas to Arrow…' });
    try {
      (pyodide as { FS: { writeFile: (path: string, data: Uint8Array) => void } }).FS.writeFile('/data.xlsx', new Uint8Array(payload.buffer));
      await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(`
import pandas as pd
import pyarrow as pa
import pyarrow.ipc as ipc

df = pd.read_excel('/data.xlsx')
table = pa.Table.from_pandas(df)
sink = pa.BufferOutputStream()
with ipc.RecordBatchStreamWriter(sink, table.schema) as writer:
    writer.write_table(table)
_arrow_buffer = sink.getvalue().to_pybytes()
`);
      const arrowBuffer = (pyodide as { globals: { get: (key: string) => unknown } }).globals.get('_arrow_buffer');
      const uint8Array = new Uint8Array(arrowBuffer as ArrayBuffer);
      (pyodide as { globals: { get: (key: string) => { destroy: () => void } } }).globals.get('_arrow_buffer').destroy();

      if (duckDbPort) {
        duckDbPort.postMessage({
          type: 'ARROW_DATA',
          source: 'python',
          tableName: 'data',
          buffer: uint8Array
        }, [uint8Array.buffer]);
      }
      self.postMessage({ type: 'EXCEL_LOADED' });
    } catch (err: unknown) {
      self.postMessage({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
    }
  }
  else if (type === 'LOAD_PARQUET') {
    self.postMessage({ type: 'LOG', msg: '>>> Converting Parquet file via pyarrow to Arrow…' });
    try {
      (pyodide as { FS: { writeFile: (path: string, data: Uint8Array) => void } }).FS.writeFile('/data.parquet', new Uint8Array(payload.buffer));
      await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(`
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.ipc as ipc

table = pq.read_table('/data.parquet')
sink = pa.BufferOutputStream()
with ipc.RecordBatchStreamWriter(sink, table.schema) as writer:
    writer.write_table(table)
_arrow_buffer = sink.getvalue().to_pybytes()
`);
      const arrowBuffer = (pyodide as { globals: { get: (key: string) => unknown } }).globals.get('_arrow_buffer');
      const uint8Array = new Uint8Array(arrowBuffer as ArrayBuffer);
      (pyodide as { globals: { get: (key: string) => { destroy: () => void } } }).globals.get('_arrow_buffer').destroy();

      if (duckDbPort) {
        duckDbPort.postMessage({
          type: 'ARROW_DATA',
          source: 'python',
          tableName: 'data',
          buffer: uint8Array
        }, [uint8Array.buffer]);
      }
      self.postMessage({ type: 'PARQUET_LOADED' });
    } catch (err: unknown) {
      self.postMessage({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
    }
  }
  else if (type === 'LOAD_JSON') {
    self.postMessage({ type: 'LOG', msg: '>>> Converting JSON file via pandas to Arrow…' });
    try {
      (pyodide as { FS: { writeFile: (path: string, data: Uint8Array) => void } }).FS.writeFile('/data.json', new Uint8Array(payload.buffer));
      await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(`
import pandas as pd
import pyarrow as pa
import pyarrow.ipc as ipc

df = pd.read_json('/data.json')
table = pa.Table.from_pandas(df)
sink = pa.BufferOutputStream()
with ipc.RecordBatchStreamWriter(sink, table.schema) as writer:
    writer.write_table(table)
_arrow_buffer = sink.getvalue().to_pybytes()
`);
      const arrowBuffer = (pyodide as { globals: { get: (key: string) => unknown } }).globals.get('_arrow_buffer');
      const uint8Array = new Uint8Array(arrowBuffer as ArrayBuffer);
      (pyodide as { globals: { get: (key: string) => { destroy: () => void } } }).globals.get('_arrow_buffer').destroy();

      if (duckDbPort) {
        duckDbPort.postMessage({
          type: 'ARROW_DATA',
          source: 'python',
          tableName: 'data',
          buffer: uint8Array
        }, [uint8Array.buffer]);
      }
      self.postMessage({ type: 'JSON_LOADED' });
    } catch (err: unknown) {
      self.postMessage({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
    }
  }
  else if (type === 'LOAD_FEATHER') {
    self.postMessage({ type: 'LOG', msg: '>>> Converting Feather file via pandas to Arrow…' });
    try {
      (pyodide as { FS: { writeFile: (path: string, data: Uint8Array) => void } }).FS.writeFile('/data.feather', new Uint8Array(payload.buffer));
      await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(`
import pandas as pd
import pyarrow as pa
import pyarrow.ipc as ipc

df = pd.read_feather('/data.feather')
table = pa.Table.from_pandas(df)
sink = pa.BufferOutputStream()
with ipc.RecordBatchStreamWriter(sink, table.schema) as writer:
    writer.write_table(table)
_arrow_buffer = sink.getvalue().to_pybytes()
`);
      const arrowBuffer = (pyodide as { globals: { get: (key: string) => unknown } }).globals.get('_arrow_buffer');
      const uint8Array = new Uint8Array(arrowBuffer as ArrayBuffer);
      (pyodide as { globals: { get: (key: string) => { destroy: () => void } } }).globals.get('_arrow_buffer').destroy();

      if (duckDbPort) {
        duckDbPort.postMessage({
          type: 'ARROW_DATA',
          source: 'python',
          tableName: 'data',
          buffer: uint8Array
        }, [uint8Array.buffer]);
      }
      self.postMessage({ type: 'FEATHER_LOADED' });
    } catch (err: unknown) {
      self.postMessage({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
    }
  }
  else if (type === 'LOAD_HDF5') {
    self.postMessage({ type: 'LOG', msg: '>>> Converting HDF5 file via pandas to Arrow…' });
    try {
      (pyodide as { FS: { writeFile: (path: string, data: Uint8Array) => void } }).FS.writeFile('/data.h5', new Uint8Array(payload.buffer));
      await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(`
import pandas as pd
import pyarrow as pa
import pyarrow.ipc as ipc

df = pd.read_hdf('/data.h5', key='data' if 'data' in pd.HDFStore('/data.h5') else None)
table = pa.Table.from_pandas(df)
sink = pa.BufferOutputStream()
with ipc.RecordBatchStreamWriter(sink, table.schema) as writer:
    writer.write_table(table)
_arrow_buffer = sink.getvalue().to_pybytes()
`);
      const arrowBuffer = (pyodide as { globals: { get: (key: string) => unknown } }).globals.get('_arrow_buffer');
      const uint8Array = new Uint8Array(arrowBuffer as ArrayBuffer);
      (pyodide as { globals: { get: (key: string) => { destroy: () => void } } }).globals.get('_arrow_buffer').destroy();

      if (duckDbPort) {
        duckDbPort.postMessage({
          type: 'ARROW_DATA',
          source: 'python',
          tableName: 'data',
          buffer: uint8Array
        }, [uint8Array.buffer]);
      }
      self.postMessage({ type: 'HDF5_LOADED' });
    } catch (err: unknown) {
      self.postMessage({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
    }
  }
  else if (type === 'PROFILE_DATA') {
    self.postMessage({ type: 'LOG', msg: '>>> Profiling data…' });
    try {
      if (payload.csvData) {
        (pyodide as { FS: { writeFile: (path: string, data: Uint8Array) => void } }).FS.writeFile('/data.csv', new TextEncoder().encode(payload.csvData));
      }
      const profileFilePath: string = payload.filePath ?? (payload.csvData ? '/data.csv' : '/data.csv');
      await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(`
import pandas as pd
import json
import math
import os
import numpy as np

_profile_file = '${profileFilePath}'

# ── Load dataframe based on file extension ─────────────────────────────────
def _load_df(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.parquet':
        import pyarrow.parquet as pq
        return pq.read_table(path).to_pandas()
    elif ext == '.feather':
        return pd.read_feather(path)
    elif ext in ('.h5', '.hdf5'):
        store = pd.HDFStore(path, mode='r')
        key = store.keys()[0] if store.keys() else None
        store.close()
        return pd.read_hdf(path, key=key)
    elif ext == '.json':
        return pd.read_json(path)
    else:
        try:
            return pd.read_csv(path, sep=None, engine='python')
        except Exception:
            return pd.read_csv(path)

try:
    df = _load_df(_profile_file)
except Exception:
    df = pd.DataFrame()

n = len(df)

def safe_float(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    try:
        f = float(v)
        return None if math.isnan(f) or math.isinf(f) else round(f, 4)
    except Exception:
        return None

def infer_col_type(col_data, dtype_str):
    if 'int' in dtype_str or 'float' in dtype_str:
        return 'numeric'
    if 'bool' in dtype_str:
        return 'boolean'
    if 'datetime' in dtype_str:
        return 'datetime'
    # Try to detect datetime in object columns
    sample = col_data.dropna().head(50).astype(str)
    try:
        parsed = pd.to_datetime(sample, infer_datetime_format=True, errors='coerce')
        if parsed.notna().sum() / max(len(sample), 1) > 0.8:
            return 'datetime'
    except Exception:
        pass
    unique_ratio = col_data.nunique() / max(n, 1)
    # Likely an ID column if very high cardinality and string-like
    if unique_ratio > 0.95 and n > 50:
        return 'id'
    # Categorical if low cardinality
    if col_data.nunique() <= 50 or unique_ratio < 0.05:
        return 'categorical'
    return 'text'

def histogram_bins(col_data, num_bins=10):
    clean = col_data.dropna()
    if len(clean) == 0:
        return []
    mn, mx = clean.min(), clean.max()
    if mn == mx:
        return [{'bin': str(round(float(mn), 2)), 'count': int(len(clean)), 'lo': float(mn), 'hi': float(mx), 'center': float(mn)}]
    try:
        counts, edges = np.histogram(clean, bins=num_bins)
        result = []
        for i in range(len(counts)):
            lo, hi = float(edges[i]), float(edges[i+1])
            label = f'{round(lo, 3)}–{round(hi, 3)}'
            result.append({'bin': label, 'count': int(counts[i]), 'lo': lo, 'hi': hi, 'center': (lo + hi) / 2})
        return result
    except Exception:
        return []

def top_values(col_data, n_top=8):
    try:
        vc  = col_data.value_counts(dropna=True).head(n_top)
        tot = max(int(col_data.notna().sum()), 1)
        return [{'value': str(v)[:40], 'count': int(c), 'percent': round(int(c)/tot*100, 1)} for v, c in vc.items()]
    except Exception:
        return []

def count_outliers_iqr(col_data):
    clean = col_data.dropna()
    if len(clean) < 4:
        return 0
    q1, q3 = clean.quantile(0.25), clean.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return 0
    return int(((clean < q1 - 1.5 * iqr) | (clean > q3 + 1.5 * iqr)).sum())

def quality_score(col_data):
    if n == 0:
        return 100.0
    null_pen = col_data.isna().sum() / n
    return round((1.0 - null_pen) * 100, 1)

def classify_distribution(skew, kurt):
    if skew is None:
        return 'unknown'
    if abs(skew) <= 0.5 and (kurt is None or abs(kurt) <= 1.0):
        return 'normal'
    if skew > 2:
        return 'highly_skewed_right'
    if skew < -2:
        return 'highly_skewed_left'
    if skew > 1:
        return 'skewed_right'
    if skew < -1:
        return 'skewed_left'
    if kurt is not None and kurt > 3:
        return 'leptokurtic'
    if kurt is not None and kurt < -1:
        return 'platykurtic'
    return 'approx_normal'

def normality_test(clean):
    if len(clean) < 8:
        return None, None
    try:
        from scipy.stats import normaltest
        _, p = normaltest(clean.values)
        return round(float(p), 4), bool(p > 0.05)
    except Exception:
        return None, None

import re as _re

_PATTERNS = [
    ('email',   r'^[\\w.+-]+@[\\w-]+\\.[\\w.-]+$'),
    ('url',     r'^https?://[^\\s]+$'),
    ('phone',   r'^[+\\d][\\d\\s\\-().]{6,}$'),
    ('uuid',    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
    ('integer', r'^-?\\d+$'),
    ('decimal', r'^-?\\d+\\.\\d+$'),
    ('zipcode', r'^\\d{5}(-\\d{4})?$'),
]

def detect_pattern(col_data):
    sample = col_data.dropna().astype(str).head(100)
    if len(sample) == 0:
        return None
    for name, pat in _PATTERNS:
        matched = sample.str.match(pat, case=False).sum()
        if matched / len(sample) > 0.8:
            return name
    return None

# ── Per-column profile ─────────────────────────────────────────────────────
columns_profile = []
total_cells = n * len(df.columns) if len(df.columns) > 0 else 1
total_nulls = 0

for col in df.columns:
    col_data = df[col]
    null_count = int(col_data.isna().sum())
    total_nulls += null_count
    unique_count = int(col_data.nunique())
    dtype_str = str(col_data.dtype)
    col_type = infer_col_type(col_data, dtype_str)
    is_constant = unique_count <= 1

    col_profile = {
        'name': col,
        'dtype': dtype_str,
        'inferredType': col_type,
        'nullCount': null_count,
        'nullPercent': round(null_count / max(n, 1) * 100, 2),
        'uniqueCount': unique_count,
        'uniquePercent': round(unique_count / max(n, 1) * 100, 2),
        'qualityScore': quality_score(col_data),
        'isConstant': is_constant,
    }

    if col_type == 'numeric' and not col_data.isna().all():
        clean = col_data.dropna()
        skew_val  = safe_float(clean.skew())      if len(clean) >= 3 else None
        kurt_val  = safe_float(clean.kurtosis())  if len(clean) >= 4 else None
        norm_p, is_normal = normality_test(clean)
        q25_v = safe_float(col_data.quantile(0.25))
        q75_v = safe_float(col_data.quantile(0.75))
        min_v = safe_float(col_data.min())
        max_v = safe_float(col_data.max())
        mean_v = safe_float(col_data.mean())
        std_v  = safe_float(col_data.std())
        iqr_v  = round(q75_v - q25_v, 4) if q25_v is not None and q75_v is not None else None
        range_v = round(max_v - min_v, 4) if min_v is not None and max_v is not None else None
        cv_v   = round(abs(std_v / mean_v) * 100, 2) if mean_v and mean_v != 0 and std_v is not None else None
        try:
            mode_v = safe_float(clean.mode().iloc[0]) if len(clean.mode()) > 0 else None
        except Exception:
            mode_v = None
        col_profile['stats'] = {
            'mean':     mean_v,
            'median':   safe_float(col_data.median()),
            'std':      std_v,
            'mode':     mode_v,
            'min':      min_v,
            'max':      max_v,
            'range':    range_v,
            'q25':      q25_v,
            'q75':      q75_v,
            'iqr':      iqr_v,
            'cv':       cv_v,
            'p5':       safe_float(col_data.quantile(0.05)),
            'p10':      safe_float(col_data.quantile(0.10)),
            'p90':      safe_float(col_data.quantile(0.90)),
            'p95':      safe_float(col_data.quantile(0.95)),
            'p99':      safe_float(col_data.quantile(0.99)),
            'skewness': skew_val,
            'kurtosis': kurt_val,
            'zeros':    int((clean == 0).sum()),
            'negativeCount': int((clean < 0).sum()),
            'infiniteCount': int(np.isinf(col_data.fillna(0)).sum()),
        }
        col_profile['distributionShape'] = classify_distribution(skew_val, kurt_val)
        col_profile['normalityPValue']   = norm_p
        col_profile['isNormal']          = is_normal
        col_profile['histogram'] = histogram_bins(col_data)
        col_profile['outlierCount'] = count_outliers_iqr(col_data)
        # Z-score outlier count
        try:
            std_z = clean.std()
            col_profile['zscoreOutlierCount'] = int((((clean - clean.mean()) / std_z).abs() > 3).sum()) if std_z > 0 else 0
        except Exception:
            col_profile['zscoreOutlierCount'] = 0
        # Top-5 most extreme outlier values
        try:
            if iqr_v and iqr_v > 0:
                lower_b = q25_v - 1.5 * iqr_v
                upper_b = q75_v + 1.5 * iqr_v
                out_s = clean[(clean < lower_b) | (clean > upper_b)]
                if len(out_s) > 0:
                    dist_f = out_s.apply(lambda x: abs(x - lower_b) if x < lower_b else abs(x - upper_b))
                    col_profile['outlierValues'] = [safe_float(out_s[i]) for i in dist_f.nlargest(5).index]
                else:
                    col_profile['outlierValues'] = []
            else:
                col_profile['outlierValues'] = []
        except Exception:
            col_profile['outlierValues'] = []
        # Q-Q plot points (theoretical normal vs sample quantiles)
        try:
            from scipy.stats import probplot
            if len(clean) >= 8:
                (theoretical_q, sample_q), _ = probplot(clean.values, dist='norm')
                n_pts = min(60, len(theoretical_q))
                idx = np.linspace(0, len(theoretical_q) - 1, n_pts, dtype=int)
                col_profile['qqPoints'] = [{'t': round(float(theoretical_q[i]), 4), 's': round(float(sample_q[i]), 4)} for i in idx]
            else:
                col_profile['qqPoints'] = []
        except Exception:
            col_profile['qqPoints'] = []

    if col_type in ('categorical', 'boolean', 'text', 'id', 'datetime'):
        col_profile['topValues'] = top_values(col_data)

    # Concentration risk (categorical/boolean)
    if col_type in ('categorical', 'boolean'):
        try:
            vc_abs = col_data.value_counts(dropna=True)
            if len(vc_abs) > 0:
                top_pct = float(vc_abs.iloc[0] / max(len(col_data.dropna()), 1) * 100)
                col_profile['concentrationRisk'] = round(top_pct, 1)
                col_profile['concentrationLabel'] = (
                    'severe' if top_pct >= 80 else
                    'high'   if top_pct >= 50 else
                    'medium' if top_pct >= 30 else 'low'
                )
        except Exception:
            pass

    if col_type in ('text', 'id') and col_data.dtype == object:
        col_profile['detectedPattern'] = detect_pattern(col_data)

    # Entropy (categorical/boolean/text/id)
    if col_type in ('categorical', 'boolean', 'text', 'id'):
        try:
            vc = col_data.dropna().value_counts(normalize=True)
            if len(vc) > 0:
                col_profile['entropy']    = round(float(-sum(p * math.log2(p) for p in vc.values if p > 0)), 3)
                col_profile['maxEntropy'] = round(math.log2(len(vc)) if len(vc) > 1 else 0.0, 3)
            else:
                col_profile['entropy'] = 0.0; col_profile['maxEntropy'] = 0.0
        except Exception:
            col_profile['entropy'] = None; col_profile['maxEntropy'] = None

    # String length stats (text/id/categorical with object dtype)
    if col_data.dtype == object and col_type in ('text', 'id', 'categorical'):
        try:
            str_s = col_data.dropna().astype(str)
            lens  = str_s.str.len()
            col_profile['lengthStats'] = {
                'min':        int(lens.min()),
                'max':        int(lens.max()),
                'mean':       round(float(lens.mean()), 1),
                'mode':       int(lens.mode().iloc[0]) if len(lens.mode()) > 0 else 0,
                'emptyCount': int((str_s.str.strip() == '').sum()),
            }
        except Exception:
            col_profile['lengthStats'] = None

    # Cardinality classification
    up = round(unique_count / max(n, 1) * 100, 2)
    col_profile['cardinality'] = (
        'unique' if up >= 99.9 else
        'high'   if up > 50 else
        'medium' if up > 5  else
        'low'
    )

    # Sample values (first 5 non-null)
    col_profile['sampleValues'] = col_data.dropna().head(5).astype(str).tolist()

    # Datetime range + time-series frequency chart
    if col_type == 'datetime':
        try:
            dt_s = pd.to_datetime(col_data.dropna(), errors='coerce').dropna()
            if len(dt_s) > 0:
                col_profile['dateMin']  = str(dt_s.min().date())
                col_profile['dateMax']  = str(dt_s.max().date())
                col_profile['spanDays'] = int((dt_s.max() - dt_s.min()).days)
                span = int((dt_s.max() - dt_s.min()).days)
                period = 'Y' if span > 730 else ('M' if span > 60 else 'W')
                try:
                    ts_counts = dt_s.dt.to_period(period).value_counts().sort_index()
                    col_profile['timeSeries'] = [{'period': str(p), 'count': int(c)} for p, c in ts_counts.items()]
                    # Trend direction: compare first half vs second half
                    ts = col_profile['timeSeries']
                    if len(ts) >= 4:
                        mid = len(ts) // 2
                        first_h = sum(x['count'] for x in ts[:mid])
                        second_h = sum(x['count'] for x in ts[mid:])
                        if first_h > 0:
                            pct_chg = (second_h - first_h) / first_h * 100
                            col_profile['trendPctChange'] = round(pct_chg, 1)
                            col_profile['trendDirection'] = 'up' if pct_chg > 10 else ('down' if pct_chg < -10 else 'flat')
                        else:
                            col_profile['trendDirection'] = 'flat'
                            col_profile['trendPctChange'] = 0.0
                except Exception:
                    col_profile['timeSeries'] = []
        except Exception:
            pass

    # Word frequency for text columns
    if col_type == 'text' and col_data.dtype == object:
        try:
            STOPWORDS = {'the','a','an','and','or','but','in','on','at','to','for','of','with','is','was','are','were','be','been','has','have','had','it','its','this','that','these','those','i','you','he','she','we','they','not','no','by','from','as','so','if','then','than','but','can','will','would','could','should','may','might','do','did','does'}
            all_text = ' '.join(col_data.dropna().astype(str).str.lower().str.replace(r'[^a-z0-9 ]', ' ', regex=True))
            words = [w for w in all_text.split() if len(w) > 2 and w not in STOPWORDS]
            if words:
                from collections import Counter
                word_counts = Counter(words).most_common(20)
                col_profile['wordFrequency'] = [{'word': w, 'count': c} for w, c in word_counts]
            else:
                col_profile['wordFrequency'] = []
        except Exception:
            col_profile['wordFrequency'] = []

    # Whitespace & mixed-type detection for object columns
    if col_data.dtype == object:
        try:
            non_null = col_data.dropna().astype(str)
            ws_count = int((non_null != non_null.str.strip()).sum())
            col_profile['whitespaceCount'] = ws_count
        except Exception:
            col_profile['whitespaceCount'] = 0
        if col_type in ('categorical', 'text'):
            try:
                numeric_parseable = pd.to_numeric(non_null, errors='coerce').notna().sum()
                non_numeric = len(non_null) - numeric_parseable
                if numeric_parseable > 0 and non_numeric > 0:
                    col_profile['mixedTypeCount'] = int(non_numeric)
                    col_profile['mixedTypeNumericCount'] = int(numeric_parseable)
            except Exception:
                pass

    # Suggestions
    suggestions = []
    if is_constant:
        suggestions.append('Constant column — all values are identical, safe to drop')
    elif unique_count == 2 and col_type != 'boolean':
        suggestions.append('Binary column — consider casting to bool')
    if col_profile['nullPercent'] > 30:
        suggestions.append('High null rate — consider imputation or dropping column')
    if col_type == 'id':
        suggestions.append('High-cardinality — likely an ID, not useful for analysis')
    if col_type == 'text' and col_data.dtype == object:
        try:
            pd.to_datetime(col_data.dropna().head(20), infer_datetime_format=True, errors='raise')
            suggestions.append('Possible datetime — try pd.to_datetime()')
        except Exception:
            pass
    if col_type == 'numeric' and col_profile.get('outlierCount', 0) > 0:
        pct = round(col_profile['outlierCount'] / max(n, 1) * 100, 1)
        suggestions.append(f'{col_profile["outlierCount"]} outlier(s) detected ({pct}% via IQR)')
    sk = col_profile.get('stats', {}).get('skewness')
    if sk is not None and abs(sk) > 1.0:
        direction = 'right' if sk > 0 else 'left'
        suggestions.append(f'Highly skewed {direction} (skew={round(sk,2)}) — consider log/sqrt transform')
    col_profile['suggestions'] = suggestions

    # ── Regex validation % for pattern columns ─────────────────────────────
    pattern = col_profile.get('detectedPattern')
    PATTERN_REGEX = {
        'email':   r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+[.][a-zA-Z]{2,}$',
        'url':     r'^https?://',
        'phone':   r'^[+]?[0-9 ().-]{7,}$',
        'uuid':    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
        'zipcode': r'^[0-9]{5}(-[0-9]{4})?$',
        'integer': r'^-?[0-9]+$',
        'decimal': r'^-?[0-9]+[.]?[0-9]*([eE][+-]?[0-9]+)?$',
    }
    if pattern and pattern in PATTERN_REGEX and col_data.dtype == object:
        try:
            non_null_s = col_data.dropna().astype(str)
            valid = non_null_s.str.match(PATTERN_REGEX[pattern]).sum()
            total = len(non_null_s)
            col_profile['patternValidCount']   = int(valid)
            col_profile['patternValidPercent'] = round(float(valid / max(total, 1) * 100), 1)
        except Exception:
            pass

    # ── Outlier row indices (top 10 most extreme) ────────────────────────────
    if col_type == 'numeric' and col_profile.get('outlierValues'):
        try:
            q25_v = col_profile.get('stats', {}).get('q25')
            q75_v = col_profile.get('stats', {}).get('q75')
            iqr_v = col_profile.get('stats', {}).get('iqr')
            if q25_v is not None and q75_v is not None and iqr_v and iqr_v > 0:
                lower_b = q25_v - 1.5 * iqr_v
                upper_b = q75_v + 1.5 * iqr_v
                out_mask = (col_data < lower_b) | (col_data > upper_b)
                out_series = col_data[out_mask].dropna()
                dist_from_fence = out_series.apply(
                    lambda x: abs(x - lower_b) if x < lower_b else abs(x - upper_b)
                )
                top_idx = dist_from_fence.nlargest(10).index.tolist()
                col_profile['outlierRowIndices'] = [int(i) for i in top_idx]
        except Exception:
            col_profile['outlierRowIndices'] = []

    # ── Column quality score (0-100) ─────────────────────────────────────────
    q_score = 100.0
    if is_constant:
        q_score = 0.0
    else:
        q_score -= col_profile['nullPercent']
        out_pct = col_profile.get('outlierCount', 0) / max(n, 1) * 100
        q_score -= min(out_pct * 0.5, 15)
        ws_pct  = col_profile.get('whitespaceCount', 0) / max(n, 1) * 100
        q_score -= min(ws_pct * 0.3, 10)
        if col_type in ('categorical', 'text') and col_profile.get('mixedTypeCount'):
            mixed_pct = col_profile['mixedTypeCount'] / max(n, 1) * 100
            q_score -= min(mixed_pct * 0.5, 10)
        pv = col_profile.get('patternValidPercent')
        if pv is not None and pv < 80:
            q_score -= (80 - pv) * 0.2
    col_profile['qualityScore'] = max(0, min(100, round(q_score, 1)))

    columns_profile.append(col_profile)

# ── Duplicate rows ─────────────────────────────────────────────────────────
duplicate_rows = int(df.duplicated().sum())

# ── Memory usage ────────────────────────────────────────────────────────────
try:
    memory_mb = round(float(df.memory_usage(deep=True).sum()) / 1024**2, 3)
except Exception:
    memory_mb = 0.0

# ── Pearson correlation (numeric cols, max 15) ─────────────────────────────
pearson_matrix = []
num_cols = []
try:
    num_cols = df.select_dtypes(include='number').columns.tolist()[:15]
    if len(num_cols) >= 2:
        corr_df = df[num_cols].corr(method='pearson')
        pearson_matrix = [[safe_float(corr_df.loc[r, c]) for c in num_cols] for r in num_cols]
except Exception:
    num_cols = []

# ── Spearman correlation ────────────────────────────────────────────────────
spearman_matrix = []
try:
    if len(num_cols) >= 2:
        sp_df = df[num_cols].corr(method='spearman')
        spearman_matrix = [[safe_float(sp_df.loc[r, c]) for c in num_cols] for r in num_cols]
except Exception:
    spearman_matrix = []

# ── Cramér's V (categorical columns, max 10) ───────────────────────────────
cramers_labels = []
cramers_matrix = []
try:
    from scipy.stats import chi2_contingency
    cat_cv = [c for c in df.columns if df[c].dtype == object and 1 < df[c].nunique() <= 30][:10]
    if len(cat_cv) >= 2:
        cramers_labels = cat_cv
        cramers_pvalues = []
        for r in cat_cv:
            row = []
            row_p = []
            for c in cat_cv:
                if r == c:
                    row.append(1.0); row_p.append(0.0)
                else:
                    try:
                        ct = pd.crosstab(df[r].fillna('_NA'), df[c].fillna('_NA'))
                        chi2, p_val, _, _ = chi2_contingency(ct)
                        nn = int(ct.values.sum())
                        phi2 = chi2 / nn
                        rr, kk = ct.shape
                        phi2c = max(0.0, phi2 - ((kk-1)*(rr-1))/(nn-1))
                        rc = rr - ((rr-1)**2)/(nn-1)
                        kc = kk - ((kk-1)**2)/(nn-1)
                        denom = min(rc-1, kc-1)
                        cv = round(float(np.sqrt(phi2c / denom)), 4) if denom > 0 else 0.0
                        row.append(cv); row_p.append(round(float(p_val), 4))
                    except Exception:
                        row.append(None); row_p.append(None)
            cramers_matrix.append(row)
            cramers_pvalues.append(row_p)
except Exception:
    cramers_labels = []
    cramers_pvalues = []

# ── Z-score anomaly rows ────────────────────────────────────────────────────
anomaly_rows = 0
try:
    if len(num_cols) >= 1:
        df_num = df[num_cols].select_dtypes(include='number')
        means = df_num.mean()
        stds  = df_num.std().replace(0, np.nan)
        z     = ((df_num - means) / stds).abs()
        anomaly_rows = int((z > 3).any(axis=1).sum())
except Exception:
    anomaly_rows = 0

# ── Pearson p-values ────────────────────────────────────────────────────────
pearson_pvalues = []
try:
    if len(num_cols) >= 2:
        from scipy.stats import pearsonr
        for r in num_cols:
            row_p = []
            for c in num_cols:
                if r == c:
                    row_p.append(0.0)
                else:
                    try:
                        combined = df[[r, c]].dropna()
                        if len(combined) >= 4:
                            _, p = pearsonr(combined[r].values, combined[c].values)
                            row_p.append(round(float(p), 4))
                        else:
                            row_p.append(None)
                    except Exception:
                        row_p.append(None)
            pearson_pvalues.append(row_p)
except Exception:
    pearson_pvalues = []

# ── Scatter data for top-3 correlated pairs ────────────────────────────────
scatter_data = {}
try:
    if len(num_cols) >= 2 and pearson_matrix:
        pairs = []
        for i in range(len(num_cols)):
            for j in range(i + 1, len(num_cols)):
                v = pearson_matrix[i][j]
                if v is not None:
                    pairs.append((abs(v), num_cols[i], num_cols[j]))
        pairs.sort(key=lambda x: -x[0])
        for _, c1, c2 in pairs[:3]:
            try:
                pair_df = df[[c1, c2]].dropna()
                if len(pair_df) >= 4:
                    s = pair_df.sample(min(200, len(pair_df)), random_state=42)
                    scatter_data[f'{c1}___{c2}'] = {
                        'x': [round(float(v), 4) for v in s[c1].tolist()],
                        'y': [round(float(v), 4) for v in s[c2].tolist()],
                        'xLabel': c1, 'yLabel': c2,
                    }
            except Exception:
                pass
except Exception:
    scatter_data = {}

# ── VIF (numpy lstsq, no sklearn) ──────────────────────────────────────────
vif_scores = {}
try:
    if len(num_cols) >= 2:
        df_vif = df[num_cols].dropna()
        if len(df_vif) > len(num_cols) + 1:
            X_vif = df_vif.values.astype(float)
            for i, col in enumerate(num_cols):
                y_v   = X_vif[:, i]
                others = np.delete(X_vif, i, axis=1)
                X_aug = np.hstack([np.ones((len(others), 1)), others])
                coef, _, _, _ = np.linalg.lstsq(X_aug, y_v, rcond=None)
                y_hat = X_aug @ coef
                ss_res = float(np.sum((y_v - y_hat) ** 2))
                ss_tot = float(np.sum((y_v - np.mean(y_v)) ** 2))
                r2 = 1 - ss_res / ss_tot if ss_tot > 1e-10 else 0.0
                vif_scores[col] = round(1 / (1 - r2), 2) if r2 < 0.9999 else 999.0
except Exception:
    vif_scores = {}

# ── Group statistics (cat cols × numeric cols) ──────────────────────────────
group_stats = {}
try:
    cat_group_cols = [
        c['name'] for c in columns_profile
        if c['inferredType'] in ('categorical', 'boolean') and 1 < c['uniqueCount'] <= 8
    ][:5]
    for cat_col in cat_group_cols:
        cat_entry = {}
        for num_col in num_cols[:8]:
            try:
                grp = df.groupby(cat_col)[num_col].agg(mean='mean', median='median', count='count')
                cat_entry[num_col] = {
                    str(k): {
                        'mean':   safe_float(v['mean']),
                        'median': safe_float(v['median']),
                        'count':  int(v['count']),
                    }
                    for k, v in grp.iterrows()
                }
            except Exception:
                pass
        if cat_entry:
            group_stats[cat_col] = cat_entry
except Exception:
    group_stats = {}

# ── Group statistical tests (Mann-Whitney U / Kruskal-Wallis) ──────────────
group_tests = {}
try:
    from scipy.stats import mannwhitneyu, kruskal
    for cat_col in [c['name'] for c in columns_profile
                    if c['inferredType'] in ('categorical', 'boolean') and 1 < c['uniqueCount'] <= 8][:5]:
        test_entry = {}
        for num_col in num_cols[:8]:
            try:
                groups = [df[df[cat_col] == val][num_col].dropna().values
                          for val in df[cat_col].dropna().unique()]
                groups = [g for g in groups if len(g) >= 3]
                if len(groups) == 2:
                    _, p = mannwhitneyu(groups[0], groups[1], alternative='two-sided')
                    test_entry[num_col] = {'test': 'Mann-Whitney U', 'pValue': round(float(p), 4)}
                elif len(groups) > 2:
                    _, p = kruskal(*groups)
                    test_entry[num_col] = {'test': 'Kruskal-Wallis', 'pValue': round(float(p), 4)}
            except Exception:
                pass
        if test_entry:
            group_tests[cat_col] = test_entry
except Exception:
    group_tests = {}

# ── Missing data co-occurrence ──────────────────────────────────────────────
missing_cooccurrence = {}
try:
    null_df  = df.isnull()
    null_cols = [c for c in df.columns if null_df[c].sum() > 0][:10]
    if len(null_cols) >= 2:
        mc = null_df[null_cols].astype(int).corr()
        missing_cooccurrence = {
            'labels': null_cols,
            'matrix': [[safe_float(mc.loc[r, c]) for c in null_cols] for r in null_cols],
        }
except Exception:
    missing_cooccurrence = {}

# ── Dataset-level quality score ────────────────────────────────────────────
overall_quality = round((1 - total_nulls / max(total_cells, 1)) * 100, 1)

# ── Missing per-column sorted list (for overview) ──────────────────────────
missing_summary = sorted(
    [{'col': c['name'], 'nullPercent': c['nullPercent']} for c in columns_profile if c['nullPercent'] > 0],
    key=lambda x: -x['nullPercent']
)[:10]

profile = {
    'rowCount': n,
    'columnCount': len(df.columns),
    'overallQuality': overall_quality,
    'totalNullPercent': round(total_nulls / max(total_cells, 1) * 100, 2),
    'duplicateRows': duplicate_rows,
    'duplicatePercent': round(duplicate_rows / max(n, 1) * 100, 2),
    'memoryMB': memory_mb,
    'correlationMatrix': pearson_matrix,
    'correlationLabels': num_cols if len(num_cols) >= 2 else [],
    'spearmanMatrix': spearman_matrix,
    'cramersVMatrix': cramers_matrix,
    'cramersVLabels': cramers_labels,
    'cramersVPValues': cramers_pvalues if 'cramers_pvalues' in dir() else [],
    'missingSummary': missing_summary,
    'anomalyRows': anomaly_rows,
    'pearsonPValues': pearson_pvalues,
    'vifScores': vif_scores,
    'groupStats': group_stats,
    'groupTests': group_tests,
    'missingCooccurrence': missing_cooccurrence,
    'scatterData': scatter_data,
    'sampleRows': df.head(5).fillna('').astype(str).to_dict('records'),
    'columns': columns_profile,
}

_profile_json = json.dumps(profile)
`);
      const profileJson = (pyodide as { globals: { get: (key: string) => string } }).globals.get('_profile_json');
      self.postMessage({ type: 'PROFILE_RESULT', profile: JSON.parse(profileJson) });
    } catch (err: unknown) {
      self.postMessage({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
    }
  }
  else if (type === 'MOUNT_WORKSPACE') {
    self.postMessage({ type: 'LOG', msg: '>>> Mounting local directory to Pyodide /mnt...' });
    try {
      try { (pyodide as { FS: { mkdir: (path: string) => void } }).FS.mkdir('/mnt'); } catch (e) { /* ignore if exists */ }
      try { (pyodide as { FS: { unmount: (path: string) => void } }).FS.unmount('/mnt'); } catch (e) { /* unmount old if needed */ }
      (pyodide as { FS: { mount: (fs: unknown, opts: unknown, path: string) => void } }).FS.mount((pyodide as { FS: { filesystems: { WORKERFS: unknown } } }).FS.filesystems.WORKERFS, { files: payload.files }, '/mnt');
      self.postMessage({ type: 'LOG', msg: '>>> Workspace mounted.' });
    } catch (err: unknown) {
      self.postMessage({ type: 'ERROR', error: 'Failed to mount workspace in Pyodide: ' + (err instanceof Error ? err.message : String(err)) });
    }
  }
  else if (type === 'RUN_CODE') {
    self.postMessage({ type: 'LOG', msg: '>>> Running analysis…' });
    try {
      const pandasLoaded = (pyodide as { runPython: (code: string) => boolean }).runPython("import sys; 'pandas' in sys.modules");
      if (!pandasLoaded) {
        self.postMessage({ type: 'LOG', msg: '>>> Packages Loading...' });
        throw new Error("Core packages not fully loaded. Please try again in a moment.");
      }

      if (payload.csvData) {
        (pyodide as { FS: { writeFile: (path: string, data: Uint8Array) => void } }).FS.writeFile('/data.csv', new TextEncoder().encode(payload.csvData));
      }

      let capturedOutput = '';
      try {
        await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(`${payload.code}\n\n_output = _capture.get_output()`);
        capturedOutput = (pyodide as { globals: { get: (key: string) => string } }).globals.get('_output') || '';
      } catch (pyErr: unknown) {
        throw new Error("Python Execution Error:\n" + (pyErr instanceof Error ? pyErr.message : String(pyErr)));
      }

      // Check for plotly figure
      let plotHtml: string | undefined;
      try {
        await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(`
try:
    import plotly.graph_objects as _go_cls
    _fig_candidates = [v for v in list(globals().values()) if isinstance(v, _go_cls.Figure)]
    if '_fig' in globals() and isinstance(globals()['_fig'], _go_cls.Figure):
        _plot_html = globals()['_fig'].to_html(include_plotlyjs='cdn', full_html=False)
    elif _fig_candidates:
        _plot_html = _fig_candidates[-1].to_html(include_plotlyjs='cdn', full_html=False)
    else:
        _plot_html = ''
except Exception:
    _plot_html = ''
`);
        plotHtml = (pyodide as { globals: { get: (key: string) => string } }).globals.get('_plot_html') || undefined;
      } catch { /* ignore plotly errors */ }

      // Automatically export all DataFrames to DuckDB
      try {
        await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(`
try:
    _export_targets = {k: v for k, v in globals().items() if not k.startswith('_') and isinstance(v, pd.DataFrame)}
    _arrows = {}
    for name, df in _export_targets.items():
        table = pa.Table.from_pandas(df)
        sink = pa.BufferOutputStream()
        with ipc.RecordBatchStreamWriter(sink, table.schema) as writer:
            writer.write_table(table)
        _arrows[name] = sink.getvalue().to_pybytes()
except Exception:
    _arrows = {}
`);
        const arrowMap = (pyodide as { globals: { get: (key: string) => { toJs: () => Map<string, unknown>; destroy: () => void } } }).globals.get('_arrows');
        if (arrowMap && duckDbPort) {
          const jsMap = arrowMap.toJs();
          for (const [name, buffer] of jsMap.entries()) {
            const uint8Array = new Uint8Array(buffer as ArrayBuffer);
            duckDbPort.postMessage({
              type: 'ARROW_DATA',
              source: 'python',
              tableName: name as string,
              buffer: uint8Array
            }, [uint8Array.buffer]);
          }
          arrowMap.destroy();
        }
      } catch { /* ignore Arrow export errors */ }

      self.postMessage({ type: 'CODE_RESULT', output: capturedOutput || 'Analysis complete.', plotHtml });
    } catch (err: unknown) {
      self.postMessage({ type: 'ERROR', error: err instanceof Error ? err.message : String(err) });
    }
  }
};
