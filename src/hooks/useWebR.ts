import { useState, useCallback, useRef } from 'react';

export function useWebR() {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const [output, setOutput] = useState<string[]>([]);

  const loadWebR = useCallback(async () => {
    if (workerRef.current) return workerRef.current;
    setLoading(true);
    setOutput(prev => [...prev, '>>> Initializing WebR Worker…']);

    return new Promise<Worker>((resolve, reject) => {
      const worker = new Worker(new URL('../workers/webr.worker.ts', import.meta.url), { type: 'module' });
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
    const worker = await loadWebR();
    worker.postMessage({ type: 'SET_PORT' }, [port]);
  }, [loadWebR]);

  const runCode = useCallback(async (
    code: string,
    csvData?: string,
    exportTableName?: string,
  ): Promise<{ output: string; plotHtml?: string }> => {
    const worker = await loadWebR();

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
  }, [loadWebR]);

  const exportToSQL = useCallback(async (tableName: string) => {
    const worker = await loadWebR();
    worker.postMessage({ type: 'RUN_CODE', payload: { code: 'invisible()', exportTableName: tableName } });
  }, [loadWebR]);

  const clearOutput   = useCallback(() => setOutput([]), []);
  const appendOutput  = useCallback((msg: string) => setOutput(prev => [...prev, msg]), []);

  return { loading, ready, runCode, output, clearOutput, appendOutput, loadWebR, configPort, exportToSQL };
}
