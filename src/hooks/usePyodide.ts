import { useState, useCallback, useRef } from 'react';

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (pkg: string | string[]) => Promise<void>;
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
  };
  globals: {
    get: (name: string) => unknown;
  };
}

declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<PyodideInstance>;
  }
}

// All Python execution runs entirely in-browser via Pyodide (WebAssembly).
// External network is only used once at startup to fetch the WASM runtime and
// packages from jsDelivr/PyPI; after that everything is local in the browser.
export function usePyodide() {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const pyodideRef = useRef<PyodideInstance | null>(null);
  const [output, setOutput] = useState<string[]>([]);

  const loadPyodide = useCallback(async () => {
    if (pyodideRef.current) return pyodideRef.current;
    setLoading(true);
    setOutput(prev => [...prev, '>>> Loading Pyodide WASM runtime…']);

    // Inject the Pyodide bootstrap script if not already present
    if (!window.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        script.onload  = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const pyodide = await window.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
    });

    // ── Core packages ──────────────────────────────────────────────────────
    setOutput(prev => [...prev, '>>> Installing core packages (pandas, micropip)…']);
    await pyodide.loadPackage(['pandas', 'micropip']);

    // Pre-install plotly and openpyxl so templates and Excel files work instantly
    setOutput(prev => [...prev, '>>> Installing plotly & openpyxl via micropip…']);
    await pyodide.runPythonAsync(`
import micropip
await micropip.install(['plotly', 'openpyxl'])
`);

    // ── stdout / stderr capture ────────────────────────────────────────────
    await pyodide.runPythonAsync(`
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

    pyodideRef.current = pyodide;
    setReady(true);
    setLoading(false);
    setOutput(prev => [...prev, '>>> Pyodide ready — pandas, plotly & openpyxl loaded. All execution is local (WASM).']);
    return pyodide;
  }, []);

  // ── Excel → CSV conversion via Pyodide ──────────────────────────────────
  const loadExcel = useCallback(async (buffer: ArrayBuffer): Promise<string> => {
    const pyodide = await loadPyodide();
    setOutput(prev => [...prev, '>>> Converting Excel file via pandas…']);
    try {
      pyodide.FS.writeFile('/data.xlsx', new Uint8Array(buffer));
      await pyodide.runPythonAsync(`
import pandas as pd
_excel_df = pd.read_excel('/data.xlsx')
_excel_csv = _excel_df.to_csv(index=False)
# Also write to /data.csv so analysis code can use read_csv('/data.csv') as usual
_excel_df.to_csv('/data.csv', index=False)
`);
      const csv = (pyodide.globals.get('_excel_csv') as string) || '';
      setOutput(prev => [...prev, `>>> Excel loaded — ${csv.trim().split('\n').length - 1} rows converted to CSV.`]);
      return csv;
    } catch (err: unknown) {
      const msg = `Error reading Excel: ${err instanceof Error ? err.message : String(err)}`;
      setOutput(prev => [...prev, msg]);
      throw new Error(msg);
    }
  }, [loadPyodide]);

  const runCode = useCallback(async (
    code: string,
    csvData?: string,
  ): Promise<{ output: string; plotHtml?: string }> => {
    const pyodide = await loadPyodide();

    setOutput(prev => [...prev, '>>> Running analysis…']);

    try {
      // Write CSV to Pyodide's in-memory virtual filesystem
      if (csvData) {
        const encoder = new TextEncoder();
        pyodide.FS.writeFile('/data.csv', encoder.encode(csvData));
      }

      // Run user code and capture stdout
      const wrappedCode = `${code}\n\n_output = _capture.get_output()`;
      await pyodide.runPythonAsync(wrappedCode);
      const capturedOutput = (pyodide.globals.get('_output') as string) || '';

      // Auto-detect any plotly Figure in the user's scope — no need to name it `_fig`
      let plotHtml: string | undefined;
      try {
        await pyodide.runPythonAsync(`
try:
    import plotly.graph_objects as _go_cls
    # Scan all globals for Figure instances; prefer explicit _fig, else take the last one found
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
        const rawHtml = (pyodide.globals.get('_plot_html') as string) || undefined;
        plotHtml = rawHtml || undefined;
        if (plotHtml === '') plotHtml = undefined;
      } catch {
        // No plot produced — that's fine
      }

      const result = capturedOutput || 'Analysis complete.';
      setOutput(prev => [...prev, result]);
      return { output: result, plotHtml };
    } catch (err: unknown) {
      const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
      setOutput(prev => [...prev, errMsg]);
      return { output: errMsg };
    }
  }, [loadPyodide]);

  const clearOutput   = useCallback(() => setOutput([]), []);
  const appendOutput  = useCallback((msg: string) => setOutput(prev => [...prev, msg]), []);

  return { loading, ready, runCode, output, clearOutput, appendOutput, loadPyodide, loadExcel };
}
