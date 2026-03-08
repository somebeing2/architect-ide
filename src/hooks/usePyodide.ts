import { useState, useCallback, useRef } from 'react';

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<any>;
  loadPackage: (pkg: string | string[]) => Promise<void>;
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
  };
  globals: {
    get: (name: string) => any;
  };
}

declare global {
  interface Window {
    loadPyodide: (config: { indexURL: string }) => Promise<PyodideInstance>;
  }
}

export function usePyodide() {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const pyodideRef = useRef<PyodideInstance | null>(null);
  const [output, setOutput] = useState<string[]>([]);

  const loadPyodide = useCallback(async () => {
    if (pyodideRef.current) return pyodideRef.current;
    setLoading(true);
    setOutput(prev => [...prev, '>>> Loading Pyodide runtime...']);

    // Load script if not present
    if (!window.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const pyodide = await window.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
    });

    await pyodide.loadPackage(['pandas', 'micropip']);
    
    // Set up stdout capture
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
    setOutput(prev => [...prev, '>>> Pyodide ready. Pandas loaded.']);
    return pyodide;
  }, []);

  const runCode = useCallback(async (code: string, csvData?: string): Promise<{ output: string; plotHtml?: string }> => {
    const pyodide = await loadPyodide();
    
    setOutput(prev => [...prev, '>>> Running analysis...']);

    try {
      if (csvData) {
        const encoder = new TextEncoder();
        pyodide.FS.writeFile('/data.csv', encoder.encode(csvData));
      }

      // Inject plotly HTML capture
      const wrappedCode = `
${code}

# Capture output
_output = _capture.get_output()
`;

      await pyodide.runPythonAsync(wrappedCode);
      const capturedOutput = pyodide.globals.get('_output') || '';
      
      // Check for plotly figure
      let plotHtml: string | undefined;
      try {
        await pyodide.runPythonAsync(`
try:
    _plot_html = _fig.to_html(include_plotlyjs='cdn', full_html=False) if '_fig' in dir() else ''
except:
    _plot_html = ''
`);
        plotHtml = pyodide.globals.get('_plot_html') || undefined;
        if (plotHtml === '') plotHtml = undefined;
      } catch {
        // no plot
      }

      const result = capturedOutput || 'Analysis complete.';
      setOutput(prev => [...prev, result]);
      return { output: result, plotHtml };
    } catch (err: any) {
      const errMsg = `Error: ${err.message}`;
      setOutput(prev => [...prev, errMsg]);
      return { output: errMsg };
    }
  }, [loadPyodide]);

  const clearOutput = useCallback(() => setOutput([]), []);

  return { loading, ready, runCode, output, clearOutput, loadPyodide };
}
