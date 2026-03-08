/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

export interface HistoryEntry {
  id: string;
  name: string;
  timestamp: string; // ISO string for serialisability
  code: string;
}

export type Theme = 'default-dark' | 'high-contrast' | 'cyberpunk';

export type EditorMode = 'python' | 'sql';

interface AppState {
  csvData: string | null;
  csvFileName: string;
  code: string;
  sqlCode: string;
  editorMode: EditorMode;
  history: HistoryEntry[];
  plotHtml: string | null;
  activeMainTab: 'editor' | 'visualizer';
  theme: Theme;
  sessionRestored: boolean;
}

interface AppActions {
  setCsvData: (data: string | null) => void;
  setCsvFileName: (name: string) => void;
  setCode: (code: string) => void;
  setSqlCode: (code: string) => void;
  setEditorMode: (mode: EditorMode) => void;
  addHistory: (entry: HistoryEntry) => void;
  deleteHistory: (id: string) => void;
  clearHistory: () => void;
  setPlotHtml: (html: string | null) => void;
  setActiveMainTab: (tab: 'editor' | 'visualizer') => void;
  setTheme: (theme: Theme) => void;
}

const AppContext = createContext<(AppState & AppActions) | null>(null);

const HISTORY_KEY    = 'architect_wasm_history';
const THEME_KEY      = 'architect_wasm_theme';
const IDB_CSV_KEY    = 'architect_csv';
const IDB_CODE_KEY   = 'architect_code';

const DEFAULT_CODE = '# Upload a CSV and select a template to begin\n';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [csvData,         setCsvDataRaw]    = useState<string | null>(null);
  const [csvFileName,     setCsvFileName]   = useState('');
  const [code,            setCodeRaw]       = useState(DEFAULT_CODE);
  const [sqlCode,         setSqlCode]       = useState('SELECT * FROM data LIMIT 100;');
  const [editorMode,      setEditorMode]    = useState<EditorMode>('python');
  const [history,         setHistory]       = useState<HistoryEntry[]>([]);
  const [plotHtml,        setPlotHtml]      = useState<string | null>(null);
  const [activeMainTab,   setActiveMainTab] = useState<'editor' | 'visualizer'>('editor');
  const [theme,           setThemeState]    = useState<Theme>('default-dark');
  const [sessionRestored, setSessionRestored] = useState(false);

  // debounce timer ref for code saves
  const codeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Restore persisted state on mount ────────────────────────────────────
  useEffect(() => {
    // Restore history & theme from localStorage (small data)
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved) as HistoryEntry[]);
    } catch { /* ignore */ }

    try {
      const savedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
      if (savedTheme === 'default-dark' || savedTheme === 'high-contrast' || savedTheme === 'cyberpunk') {
        setThemeState(savedTheme);
      }
    } catch { /* ignore */ }

    // Restore csvData & code from IndexedDB (potentially large)
    let didRestoreAny = false;
    Promise.all([
      idbGet<string>(IDB_CSV_KEY),
      idbGet<string>(IDB_CODE_KEY),
    ]).then(([savedCsv, savedCode]) => {
      if (savedCsv) {
        setCsvDataRaw(savedCsv);
        didRestoreAny = true;
      }
      if (savedCode && savedCode !== DEFAULT_CODE) {
        setCodeRaw(savedCode);
        didRestoreAny = true;
      }
      if (didRestoreAny) {
        setSessionRestored(true);
      }
    }).catch(() => { /* ignore */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Apply theme to document ──────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // ── Persist history whenever it changes ─────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50))); }
    catch { /* ignore */ }
  }, [history]);

  // ── Persist csvData to IndexedDB ─────────────────────────────────────────
  useEffect(() => {
    if (csvData === null) {
      idbDel(IDB_CSV_KEY).catch(() => {});
    } else {
      idbSet(IDB_CSV_KEY, csvData).catch(() => {});
    }
  }, [csvData]);

  // ── Persist code to IndexedDB (debounced 500ms) ──────────────────────────
  useEffect(() => {
    if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);
    codeDebounceRef.current = setTimeout(() => {
      idbSet(IDB_CODE_KEY, code).catch(() => {});
    }, 500);
    return () => {
      if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);
    };
  }, [code]);

  const setCsvData = useCallback((data: string | null) => {
    setCsvDataRaw(data);
    if (!data) setPlotHtml(null);
  }, []);

  const setCode = useCallback((c: string) => {
    setCodeRaw(c);
  }, []);

  const addHistory = useCallback((entry: HistoryEntry) => {
    setHistory(prev => [entry, ...prev.slice(0, 49)]);
  }, []);

  const deleteHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  return (
    <AppContext.Provider value={{
      csvData, setCsvData,
      csvFileName, setCsvFileName,
      code, setCode,
      sqlCode, setSqlCode,
      editorMode, setEditorMode,
      history, addHistory, deleteHistory, clearHistory,
      plotHtml, setPlotHtml,
      activeMainTab, setActiveMainTab,
      theme, setTheme,
      sessionRestored,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}
