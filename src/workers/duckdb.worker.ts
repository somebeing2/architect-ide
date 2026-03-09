/// <reference lib="webworker" />
import * as duckdb from '@duckdb/duckdb-wasm';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

async function initDB() {
  if (db) return;
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

  // We are already inside a Web Worker. DuckDB-WASM can instantiate its own background worker.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], { type: 'text/javascript' })
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.VoidLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  conn = await db.connect();
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    try {
      await initDB();
      self.postMessage({ type: 'READY' });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
  else if (type === 'SET_PORT') {
    const port = e.ports[0];
    port.onmessage = async (msg) => {
      if (msg.data.type === 'ARROW_DATA' && db && conn) {
        // We received Arrow IPC buffer directly from Pyodide!
        try {
          const { name, buffer } = msg.data;
          await db.registerFileBuffer(name + '.recordbatch', buffer);
          await conn.query(`DROP TABLE IF EXISTS ${name}`);
          await conn.query(`CREATE TABLE ${name} AS SELECT * FROM read_ipc('${name}.recordbatch')`);
          self.postMessage({ type: 'ARROW_LOADED' });
        } catch (err: any) {
          self.postMessage({ type: 'ERROR', error: 'Arrow Load Error: ' + err.message });
        }
      }
    };
  }
  else if (type === 'RUN_SQL') {
    if (!conn) return;
    try {
      const result = await conn.query(payload.sql) as any;
      const columns = result.schema.fields.map((f: any) => f.name);
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

      self.postMessage({
        type: 'SQL_RESULT',
        id: payload.id,
        result: {
          columns,
          rows,
          rowCount: rows.length,
          durationMs: payload.t0 ? Math.round(performance.now() - payload.t0) : 0,
        }
      });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message, id: payload.id });
    }
  }
  else if (type === 'LOAD_CSV') {
    if (!db || !conn) return;
    try {
      await db.registerFileText('data.csv', payload.csvData);
      await conn.query('DROP TABLE IF EXISTS data');
      await conn.query("CREATE TABLE data AS SELECT * FROM read_csv_auto('data.csv', header=true)");
      self.postMessage({ type: 'CSV_LOADED', id: payload.id });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message, id: payload.id });
    }
  }
};
