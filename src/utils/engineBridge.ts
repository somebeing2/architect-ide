/**
 * Represents the structure of an Apache Arrow payload sent over 
 * a MessageChannel between web workers (Pyodide <-> DuckDB, WebR <-> DuckDB).
 */
export interface ArrowPayload {
  type: 'ARROW_DATA';
  source: 'python' | 'r';
  tableName: string;
  buffer: Uint8Array;
}
