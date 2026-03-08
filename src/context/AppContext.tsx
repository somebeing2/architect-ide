/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface HistoryEntry {
  id: string;
  name: string;
  timestamp: string; // ISO string for serialisability
  code: string;
}

interface AppState {
  csvData: string | null;
  csvFileName: string;
  code: string;
  history: HistoryEntry[];
  plotHtml: string | null;
  activeMainTab: 'editor' | 'visualizer';
  theme: 'dark' | 'light';
}

interface AppActions {
  setCsvData: (data: string | null) => void;
  setCsvFileName: (name: string) => void;
  setCode: (code: string) => void;
  addHistory: (entry: HistoryEntry) => void;
  deleteHistory: (id: string) => void;
  clearHistory: () => void;
  setPlotHtml: (html: string | null) => void;
  setActiveMainTab: (tab: 'editor' | 'visualizer') => void;
  toggleTheme: () => void;
}

const AppContext = createContext<(AppState & AppActions) | null>(null);

const HISTORY_KEY = 'architect_wasm_history';
const THEME_KEY   = 'architect_wasm_theme';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [csvData,       setCsvDataRaw]    = useState<string | null>(null);
  const [csvFileName,   setCsvFileName]   = useState('');
  const [code,          setCode]          = useState('# Upload a CSV and select a template to begin\n');
  const [history,       setHistory]       = useState<HistoryEntry[]>([]);
  const [plotHtml,      setPlotHtml]      = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<'editor' | 'visualizer'>('editor');
  const [theme,         setTheme]         = useState<'dark' | 'light'>('dark');

  // Restore persisted state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved) as HistoryEntry[]);
    } catch { /* ignore */ }
    try {
      const savedTheme = localStorage.getItem(THEME_KEY) as 'dark' | 'light' | null;
      if (savedTheme === 'light' || savedTheme === 'dark') setTheme(savedTheme);
    } catch { /* ignore */ }
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Persist history whenever it changes
  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50))); }
    catch { /* ignore */ }
  }, [history]);

  const setCsvData = useCallback((data: string | null) => {
    setCsvDataRaw(data);
    if (!data) setPlotHtml(null);
  }, []);

  const addHistory = useCallback((entry: HistoryEntry) => {
    setHistory(prev => [entry, ...prev.slice(0, 49)]);
  }, []);

  const deleteHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  return (
    <AppContext.Provider value={{
      csvData, setCsvData,
      csvFileName, setCsvFileName,
      code, setCode,
      history, addHistory, deleteHistory, clearHistory,
      plotHtml, setPlotHtml,
      activeMainTab, setActiveMainTab,
      theme, toggleTheme,
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
