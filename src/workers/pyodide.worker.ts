/// <reference lib="webworker" />

let pyodide: any = null;
let duckDbPort: MessagePort | null = null;
let offscreenCanvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

// Stub out document/window for matplotlib/plotly if needed, though Pyodide handles most of it.
self.window = self as any;

async function initPyodide() {
  if (pyodide) return pyodide;
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js');
  pyodide = await (self as any).loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
  });

  self.postMessage({ type: 'LOG', msg: '>>> Installing core packages (pandas, micropip, pyarrow)…' });
  await pyodide.loadPackage(['pandas', 'micropip']);

  self.postMessage({ type: 'LOG', msg: '>>> Installing plotly, openpyxl, pyarrow via micropip…' });
  await pyodide.runPythonAsync(`
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
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
  else if (type === 'SET_PORT') {
    duckDbPort = e.ports[0];
  }
  else if (type === 'SET_CANVAS') {
    offscreenCanvas = e.data.canvas;
  }
  else if (type === 'LOAD_EXCEL') {
    self.postMessage({ type: 'LOG', msg: '>>> Converting Excel file via pandas to Arrow…' });
    try {
      pyodide.FS.writeFile('/data.xlsx', new Uint8Array(payload.buffer));
      await pyodide.runPythonAsync(`
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
      const arrowBuffer = pyodide.globals.get('_arrow_buffer');
      const uint8Array = new Uint8Array(arrowBuffer);
      pyodide.globals.get('_arrow_buffer').destroy();

      if (duckDbPort) {
        // Send to DuckDB worker via MessageChannel
        duckDbPort.postMessage({
          type: 'ARROW_DATA',
          source: 'python',
          tableName: 'data',
          buffer: uint8Array
        }, [uint8Array.buffer]);
      }
      self.postMessage({ type: 'EXCEL_LOADED' });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
  else if (type === 'MOUNT_WORKSPACE') {
    self.postMessage({ type: 'LOG', msg: '>>> Mounting local directory to Pyodide /mnt...' });
    try {
      try { pyodide.FS.mkdir('/mnt'); } catch (e) { /* ignore if exists */ }
      try { pyodide.FS.unmount('/mnt'); } catch (e) { /* unmount old if needed */ }
      pyodide.FS.mount(pyodide.FS.filesystems.WORKERFS, { files: payload.files }, '/mnt');
      self.postMessage({ type: 'LOG', msg: '>>> Workspace mounted.' });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: 'Failed to mount workspace in Pyodide: ' + err.message });
    }
  }
  else if (type === 'RUN_CODE') {
    self.postMessage({ type: 'LOG', msg: '>>> Running analysis…' });
    try {
      if (payload.csvData) {
        pyodide.FS.writeFile('/data.csv', new TextEncoder().encode(payload.csvData));
      }

      await pyodide.runPythonAsync(`${payload.code}\n\n_output = _capture.get_output()`);
      const capturedOutput = pyodide.globals.get('_output') || '';

      // Check for plotly figure
      let plotHtml: string | undefined;
      try {
        await pyodide.runPythonAsync(`
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
        plotHtml = pyodide.globals.get('_plot_html') || undefined;
      } catch { }

      // Automatically export all DataFrames to DuckDB
      try {
        await pyodide.runPythonAsync(`
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
        const arrowMap = pyodide.globals.get('_arrows');
        if (arrowMap && duckDbPort) {
          const jsMap = arrowMap.toJs();
          for (const [name, buffer] of jsMap.entries()) {
            const uint8Array = new Uint8Array(buffer);
            duckDbPort.postMessage({
              type: 'ARROW_DATA',
              source: 'python',
              tableName: name,
              buffer: uint8Array
            }, [uint8Array.buffer]);
          }
          arrowMap.destroy();
        }
      } catch { }

      self.postMessage({ type: 'CODE_RESULT', output: capturedOutput || 'Analysis complete.', plotHtml });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
};
