import { useState, useRef, useCallback } from 'react';
import type { AsyncDuckDB, AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

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
  const dbRef      = useRef<AsyncDuckDB | null>(null);
  const connRef    = useRef<AsyncDuckDBConnection | null>(null);

  // ── Lazy-init DuckDB from jsDelivr CDN bundles ───────────────────────────
  const initDB = useCallback(async (): Promise<AsyncDuckDB> => {
    if (dbRef.current) return dbRef.current;
    setLoading(true);
    setError(null);
    try {
      const duckdb = await import('@duckdb/duckdb-wasm');
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

      // Create worker from blob so CDN WASM can load without CORS issues
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
      );
      const worker = new Worker(workerUrl);
      const logger = new duckdb.VoidLogger();
      const db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);

      dbRef.current  = db;
      connRef.current = await db.connect();
      setReady(true);
      return db;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load CSV string into DuckDB table named 'data' ───────────────────────
  const loadCSV = useCallback(async (csvData: string): Promise<void> => {
    const db   = await initDB();
    const conn = connRef.current!;
    // Register as virtual file, then CREATE TABLE via read_csv_auto
    await db.registerFileText('data.csv', csvData);
    await conn.query('DROP TABLE IF EXISTS data');
    await conn.query("CREATE TABLE data AS SELECT * FROM read_csv_auto('data.csv', header=true)");
  }, [initDB]);

  // ── Execute a SQL query and return column-aligned results ────────────────
  const runSQL = useCallback(async (sql: string): Promise<QueryResult> => {
    await initDB();
    const conn = connRef.current!;
    const t0   = performance.now();

    // result is an Apache Arrow Table
    const result = await conn.query(sql) as unknown as {
      schema: { fields: Array<{ name: string }> };
      batches: Array<{
        numRows: number;
        getChildAt: (i: number) => { get: (j: number) => unknown } | null;
      }>;
    };

    const columns = result.schema.fields.map(f => f.name);
    const rows: string[][] = [];

    for (const batch of result.batches) {
      for (let rowIdx = 0; rowIdx < batch.numRows; rowIdx++) {
        const row: string[] = [];
        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
          const vec = batch.getChildAt(colIdx);
          const val = vec?.get(rowIdx);
          row.push(val === null || val === undefined ? 'NULL' : String(val));
        }
        rows.push(row);
      }
    }

    return {
      columns,
      rows,
      rowCount: rows.length,
      durationMs: Math.round(performance.now() - t0),
    };
  }, [initDB]);

  return { loading, ready, error, initDB, loadCSV, runSQL };
}

// ── Format QueryResult as a plain-text aligned table for the terminal ──────
export function formatQueryResult({ columns, rows, rowCount, durationMs }: QueryResult): string {
  if (rowCount === 0) return `Query returned 0 rows. (${durationMs}ms)`;

  // Column widths = max of header or any cell
  const widths = columns.map((col, ci) =>
    Math.max(col.length, ...rows.map(r => (r[ci] ?? '').length))
  );

  const sep  = '+' + widths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const head = '|' + columns.map((col, ci) => ` ${col.padEnd(widths[ci])} `).join('|') + '|';
  const dataLines = rows.slice(0, 200).map(row =>   // cap display at 200 rows
    '|' + row.map((cell, ci) => ` ${(cell ?? '').padEnd(widths[ci])} `).join('|') + '|'
  );
  const truncNote = rowCount > 200 ? [`  (showing 200 of ${rowCount} rows)`] : [];

  return [sep, head, sep, ...dataLines, sep, ...truncNote, `${rowCount} row(s) — ${durationMs}ms`].join('\n');
}
