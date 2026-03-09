import { useState, useRef, useCallback } from 'react';

export interface QueryResult {
  columns: string[];
  rows: string[][];
  rowCount: number;
  durationMs: number;
}

export function useDuckDB() {
  const [loading,  setLoading]  = useState(false);
  const [ready,    setReady]    = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pyodidePortRef = useRef<MessagePort | null>(null);

  const initDB = useCallback(async (): Promise<{ worker: Worker, pyodidePort: MessagePort }> => {
    if (workerRef.current && pyodidePortRef.current) {
      return { worker: workerRef.current, pyodidePort: pyodidePortRef.current };
    }
    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('../workers/duckdb.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;

      worker.onmessage = (e) => {
        if (e.data.type === 'READY') {
          const channel = new MessageChannel();
          pyodidePortRef.current = channel.port1;
          worker.postMessage({ type: 'SET_PORT' }, [channel.port2]);
          
          setReady(true);
          setLoading(false);
          resolve({ worker, pyodidePort: pyodidePortRef.current });
        } else if (e.data.type === 'ERROR') {
          setError(e.data.error);
          setLoading(false);
          reject(new Error(e.data.error));
        }
      };

      worker.postMessage({ type: 'INIT' });
    });
  }, []);

  const loadCSV = useCallback(async (csvData: string): Promise<void> => {
    const { worker } = await initDB();
    return new Promise((resolve, reject) => {
      const id = Date.now().toString();
      const handler = (e: MessageEvent) => {
        if (e.data.id === id) {
          worker.removeEventListener('message', handler);
          if (e.data.type === 'CSV_LOADED') resolve();
          else if (e.data.type === 'ERROR') reject(new Error(e.data.error));
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'LOAD_CSV', payload: { id, csvData } });
    });
  }, [initDB]);

  const runSQL = useCallback(async (sql: string): Promise<QueryResult> => {
    const { worker } = await initDB();
    const t0 = performance.now();

    return new Promise((resolve, reject) => {
      const id = Date.now().toString() + Math.random().toString();
      const handler = (e: MessageEvent) => {
        if (e.data.id === id) {
          worker.removeEventListener('message', handler);
          if (e.data.type === 'SQL_RESULT') resolve(e.data.result);
          else if (e.data.type === 'ERROR') reject(new Error(e.data.error));
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'RUN_SQL', payload: { id, sql, t0 } });
    });
  }, [initDB]);

  return { loading, ready, error, initDB, loadCSV, runSQL };
}

export function formatQueryResult({ columns, rows, rowCount, durationMs }: QueryResult): string {
  if (rowCount === 0) return `Query returned 0 rows. (${durationMs}ms)`;
  const widths = columns.map((col, ci) =>
    Math.max(col.length, ...rows.map(r => (r[ci] ?? '').length))
  );
  const sep  = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const head = '|' + columns.map((col, ci) => ` ${col.padEnd(widths[ci])} `).join('|') + '|';
  const dataLines = rows.slice(0, 200).map(row =>
    '|' + row.map((cell, ci) => ` ${(cell ?? '').padEnd(widths[ci])} `).join('|') + '|'
  );
  const truncNote = rowCount > 200 ? [`  (showing 200 of ${rowCount} rows)`] : [];
  return [sep, head, sep, ...dataLines, sep, ...truncNote, `${rowCount} row(s) — ${durationMs}ms`].join('\n');
}
