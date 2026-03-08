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

    // Pre-install plotly so templates run instantly without a network fetch
    setOutput(prev => [...prev, '>>> Installing plotly via micropip…']);
    await pyodide.runPythonAsync(`
import micropip
await micropip.install('plotly')
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
    setOutput(prev => [...prev, '>>> Pyodide ready — pandas & plotly loaded. All execution is local (WASM).']);
    return pyodide;
  }, []);

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

      // Extract Plotly figure HTML if the user assigned one to `_fig`
      let plotHtml: string | undefined;
      try {
        await pyodide.runPythonAsync(`
try:
    _plot_html = _fig.to_html(include_plotlyjs='cdn', full_html=False) if '_fig' in dir() else ''
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

  const clearOutput = useCallback(() => setOutput([]), []);

  return { loading, ready, runCode, output, clearOutput, loadPyodide };
}
