import { useState, useCallback, useRef, useEffect } from 'react';

export function usePyodide() {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const [output, setOutput] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const loadPyodide = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    setLoading(true);
    setOutput(prev => [...prev, '>>> Initializing Pyodide Worker…']);

    return new Promise<Worker>((resolve, reject) => {
      const worker = new Worker(new URL('../workers/pyodide.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.addEventListener('message', (e) => {
        if (e.data.type === 'LOG') {
          setOutput(prev => [...prev, e.data.msg]);
        }
      });

      const initHandler = (e: MessageEvent) => {
        if (e.data.type === 'READY') {
          worker.removeEventListener('message', initHandler);
          setReady(true);
          setLoading(false);
          resolve(worker);
        } else if (e.data.type === 'ERROR') {
          worker.removeEventListener('message', initHandler);
          setLoading(false);
          reject(new Error(e.data.error));
        }
      };

      worker.addEventListener('message', initHandler);
      worker.postMessage({ type: 'INIT' });
    });
  }, []);

  const configPort = useCallback(async (port: MessagePort) => {
    const worker = await loadPyodide();
    worker.postMessage({ type: 'SET_PORT' }, [port]);
  }, [loadPyodide]);

  const loadExcel = useCallback(async (buffer: ArrayBuffer): Promise<string> => {
    const worker = await loadPyodide();
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === 'EXCEL_LOADED') {
          worker.removeEventListener('message', handler);
          resolve(''); // CSV parsing bypassed; Arrow sent directly
        } else if (e.data.type === 'ERROR') {
          worker.removeEventListener('message', handler);
          reject(new Error(e.data.error));
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'LOAD_EXCEL', payload: { buffer } }, [buffer]);
    });
  }, [loadPyodide]);

  const runCode = useCallback(async (
    code: string,
    csvData?: string,
    exportTableName?: string,
  ): Promise<{ output: string; plotHtml?: string }> => {
    const worker = await loadPyodide();

    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        if (e.data.type === 'CODE_RESULT') {
          worker.removeEventListener('message', handler);
          resolve({ output: e.data.output, plotHtml: e.data.plotHtml });
        } else if (e.data.type === 'ERROR') {
          worker.removeEventListener('message', handler);
          reject(new Error(e.data.error));
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'RUN_CODE', payload: { code, csvData, exportTableName } });
    });
  }, [loadPyodide]);

  const exportToSQL = useCallback(async (tableName: string) => {
    const worker = await loadPyodide();
    // This empty code block triggers the auto-export logic inside the worker 
    // without running a new visible script.
    worker.postMessage({ type: 'RUN_CODE', payload: { code: 'pass', exportTableName: tableName } });
  }, [loadPyodide]);

  const mountWorkspace = useCallback(async (files: File[]) => {
    const worker = await loadPyodide();
    worker.postMessage({ type: 'MOUNT_WORKSPACE', payload: { files } });
  }, [loadPyodide]);

  const clearOutput = useCallback(() => setOutput([]), []);
  const appendOutput = useCallback((msg: string) => setOutput(prev => [...prev, msg]), []);

  return { loading, ready, runCode, output, clearOutput, appendOutput, loadPyodide, loadExcel, configPort, exportToSQL, mountWorkspace };
}
