import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Settings, Github, Cpu, Database,
  ChevronDown, ChevronUp, Sparkles, AlertCircle,
  Activity, LayoutTemplate, BarChart2,
  Code2, HelpCircle, Palette, Download,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { CSVDropzone } from './CSVDropzone';
import { DataPreview } from './DataPreview';
import { CodeEditor } from './CodeEditor';
import { Terminal } from './Terminal';
import { PlotViewer } from './PlotViewer';
import { SettingsModal } from './SettingsModal';
import { HistorySidebar } from './HistorySidebar';
import { ActiveTablesSidebar } from './ActiveTablesSidebar';
import { TemplateGallery } from './TemplateGallery';
import { SystemHealthDrawer } from './SystemHealthDrawer';
import { VisualBuilder } from './VisualBuilder';
import { SecurityBadge } from './SecurityBadge';
import { GuidedTour } from './GuidedTour';
import { ProcessingOverlay } from './ProcessingOverlay';
import { usePyodide } from '@/hooks/usePyodide';
import { useWebR } from '@/hooks/useWebR';
import { useDuckDB, formatQueryResult } from '@/hooks/useDuckDB';
import { type Template } from '@/lib/templates';
import { useAppContext } from '@/context/AppContext';
import { type Theme } from '@/context/AppContext';

const TITANIC_URL =
  'https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'default-dark', label: 'Default Dark' },
  { value: 'high-contrast', label: 'High Contrast' },
  { value: 'cyberpunk',     label: 'Cyberpunk' },
];

export function IDELayout() {
  const {
    csvData, setCsvData,
    csvFileName, setCsvFileName,
    code, setCode,
    sqlCode, setSqlCode,
    rCode, setRCode,
    editorMode, setEditorMode,
    addHistory,
    plotHtml, setPlotHtml,
    activeMainTab, setActiveMainTab,
    theme, setTheme,
    sessionRestored,
  } = useAppContext();

  const [settingsOpen,       setSettingsOpen]       = useState(false);
  const [galleryOpen,        setGalleryOpen]         = useState(false);
  const [healthOpen,         setHealthOpen]          = useState(false);
  const [running,            setRunning]             = useState(false);
  const [terminalExpanded,   setTerminalExpanded]    = useState(true);
  const [aiPrompt,           setAiPrompt]            = useState('');
  const [aiLoading,          setAiLoading]           = useState(false);
  const [titanicLoading,     setTitanicLoading]      = useState(false);
  const [lastRunMs,          setLastRunMs]           = useState<number | undefined>();
  // Glowing dot: chart was produced while on the Editor tab
  const [newPlotReady,       setNewPlotReady]        = useState(false);
  // Guided tour in the empty visualizer panel
  const [tourActive,         setTourActive]          = useState(false);
  // Theme dropdown
  const [themeMenuOpen,      setThemeMenuOpen]       = useState(false);
  // Session restored notification (shown once)
  const [restoredDismissed,  setRestoredDismissed]   = useState(false);

  // Row count used by the processing overlay
  const rowCount = useMemo(() => {
    if (!csvData) return 0;
    return csvData.trim().split('\n').length - 1;
  }, [csvData]);

  const { output: pyOutput, clearOutput: clearPy, appendOutput: appendPy, runCode: runPy, loadExcel, loading: pyodideLoading, ready: pyodideReady, configPort: configPyPort, loadPyodide, exportToSQL: pyExportToSQL } = usePyodide();
  const { output: rOutput, clearOutput: clearR, appendOutput: appendR, runCode: runR, loading: webrLoading, ready: webrReady, configPort: configWebRPort, loadWebR, exportToSQL: rExportToSQL } = useWebR();
  const { loading: duckLoading, ready: duckReady, loadCSV: duckLoadCSV, runSQL, initDB, activeTables } = useDuckDB();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workersLinked = useRef(false);

  const activeOutput = editorMode === 'r' ? rOutput : pyOutput;
  const activeClearOutput = editorMode === 'r' ? clearR : clearPy;
  const activeAppendOutput = editorMode === 'r' ? appendR : appendPy;

  // ── Initialize and link workers securely off-thread ────────────────────
  useEffect(() => {
    async function setupWorkers() {
      if (workersLinked.current) return;
      workersLinked.current = true;
      try {
        const { pyodidePort, webrPort } = await initDB();
        await configPyPort(pyodidePort);
        await configWebRPort(webrPort);
        
        if (canvasRef.current && 'transferControlToOffscreen' in canvasRef.current) {
          const offscreen = canvasRef.current.transferControlToOffscreen();
          const pWorker = await loadPyodide();
          pWorker.postMessage({ type: 'SET_CANVAS', canvas: offscreen }, [offscreen]);
        }

        // Pre-warm WebR
        await loadWebR();
      } catch (err) {
        console.error("Failed to link workers:", err);
      }
    }
    setupWorkers();
  }, [initDB, configPyPort, loadPyodide, configWebRPort, loadWebR]);

  // ── File handlers ────────────────────────────────────────────────────────
  const handleFileLoaded = useCallback((data: string, fileName: string) => {
    setCsvData(data);
    setCsvFileName(fileName);
  }, [setCsvData, setCsvFileName]);

  // ── Excel file handler — converts to CSV via Pyodide/pandas ─────────────
  const handleExcelLoaded = useCallback(async (buffer: ArrayBuffer, fileName: string) => {
    try {
      const csv = await loadExcel(buffer);
      setCsvData(csv);
      setCsvFileName(fileName);
    } catch {
      // error already logged in terminal via usePyodide
    }
  }, [loadExcel, setCsvData, setCsvFileName]);

  const handleClearFile = useCallback(() => {
    setCsvData(null);
    setCsvFileName('');
  }, [setCsvData, setCsvFileName]);

  // ── Titanic sample dataset ───────────────────────────────────────────────
  const handleLoadTitanic = useCallback(async () => {
    setTitanicLoading(true);
    try {
      const response = await fetch(TITANIC_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      handleFileLoaded(text, 'titanic.csv');
    } catch (err: unknown) {
      console.error('Failed to load Titanic dataset:', err instanceof Error ? err.message : String(err));
    } finally {
      setTitanicLoading(false);
    }
  }, [handleFileLoaded]);

  // ── Run code ─────────────────────────────────────────────────────────────
  const handleRunCode = useCallback(async () => {
    if (!csvData) return;
    setRunning(true);
    const t0 = performance.now();
    let result;
    if (editorMode === 'r') {
      result = await runR(rCode, csvData);
    } else {
      result = await runPy(code, csvData);
    }
    const ms = Math.round(performance.now() - t0);
    setLastRunMs(ms);

    if (result.plotHtml) {
      setPlotHtml(result.plotHtml);
      // If the user is on the Editor tab, light up the Visualizer tab notification dot
      if (activeMainTab === 'editor') setNewPlotReady(true);
    }

    addHistory({
      id       : Date.now().toString(),
      name     : (editorMode === 'r' ? rCode : code).split('\n').find(l => l.startsWith('#'))?.replace('#', '').trim() || 'Analysis',
      timestamp: new Date().toISOString(),
      code     : editorMode === 'r' ? rCode : code,
    });

    setRunning(false);
  }, [code, rCode, editorMode, csvData, runPy, runR, setPlotHtml, addHistory, activeMainTab]);

  // ── Run SQL via DuckDB ────────────────────────────────────────────────────
  const handleRunSQL = useCallback(async () => {
    if (!sqlCode.trim()) return;
    setRunning(true);
    activeAppendOutput('>>> Running SQL via DuckDB…');
    try {
      if (csvData) await duckLoadCSV(csvData);
      const result = await runSQL(sqlCode);
      setLastRunMs(result.durationMs);
      activeAppendOutput(formatQueryResult(result));
    } catch (err: unknown) {
      activeAppendOutput(`SQL Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setRunning(false);
  }, [csvData, sqlCode, duckLoadCSV, runSQL, activeAppendOutput]);

  // ── Export to SQL ────────────────────────────────────────────────────────
  const handleExportToSQL = useCallback(async () => {
    if (editorMode === 'python') {
      activeAppendOutput('>>> Exporting Python `data` to SQL table `python_data`...');
      await pyExportToSQL('python_data');
    } else if (editorMode === 'r') {
      activeAppendOutput('>>> Exporting R `data` to SQL table `r_data`...');
      await rExportToSQL('r_data');
    }
  }, [editorMode, pyExportToSQL, rExportToSQL, activeAppendOutput]);

  // ── Large-dataset hint (> 500k rows) ─────────────────────────────────────
  const isLargeDataset = rowCount > 500_000;

  // ── Template selection ───────────────────────────────────────────────────
  const handleSelectTemplate = useCallback((template: Template) => {
    setCode(template.code);
    setActiveMainTab('editor');
  }, [setCode, setActiveMainTab]);

  // ── VisualBuilder generates code ─────────────────────────────────────────
  const handleVisualCode = useCallback(async (generatedCode: string) => {
    setCode(generatedCode);
    setActiveMainTab('editor');
    // Auto-run if we have data
    if (csvData) {
      setRunning(true);
      const t0 = performance.now();
      const result = await runPy(generatedCode, csvData);
      const ms = Math.round(performance.now() - t0);
      setLastRunMs(ms);
      if (result.plotHtml) setPlotHtml(result.plotHtml);
      setRunning(false);
    }
  }, [setCode, setActiveMainTab, csvData, runPy, setPlotHtml]);

  // ── AI generation ────────────────────────────────────────────────────────
  const getCSVSchema = useCallback(() => {
    if (!csvData) return '';
    const lines   = csvData.trim().split('\n');
    const headers = lines[0];
    const sample  = lines.slice(1, 3).join('\n');
    return `Columns: ${headers}\nSample:\n${sample}`;
  }, [csvData]);

  const handleAIGenerate = useCallback(async () => {
    const apiKey = localStorage.getItem('anthropic_api_key');
    if (!apiKey || !csvData || !aiPrompt.trim()) return;

    setAiLoading(true);
    try {
      const schema = getCSVSchema();
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method : 'POST',
        headers: {
          'Content-Type'                              : 'application/json',
          'x-api-key'                                 : apiKey,
          'anthropic-version'                         : '2023-06-01',
          'anthropic-dangerous-direct-browser-access' : 'true',
        },
        body: JSON.stringify({
          model     : 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages  : [{
            role   : 'user',
            content: `You are a data science assistant. Generate Python code using pandas to analyze a CSV file at '/data.csv'.
Schema: ${schema}
Task: ${aiPrompt}
Rules: Use pandas. If visualization needed, use plotly and store figure in variable '_fig'. Print results. Only output Python code, no markdown.`,
          }],
        }),
      });

      const data          = await response.json() as { content?: Array<{ text: string }> };
      const generatedCode = data.content?.[0]?.text ?? '# AI generation failed';
      setCode(generatedCode.replace(/```python\n?/g, '').replace(/```\n?/g, ''));
    } catch (err: unknown) {
      setCode(`# AI Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setAiLoading(false);
  }, [aiPrompt, csvData, getCSVSchema, setCode]);

  // ── Export report ─────────────────────────────────────────────────────────
  const handleDownloadReport = useCallback(() => {
    if (!plotHtml) return;

    const rowCount = csvData ? csvData.trim().split('\n').length - 1 : 0;
    const columns  = csvData ? csvData.trim().split('\n')[0] : '';
    const timestamp = new Date().toLocaleString();

    const reportHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Architect-WASM Report</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0d1117; color: #e6edf3; margin: 0; padding: 24px; }
    h1 { font-size: 1.5rem; color: #58a6ff; margin-bottom: 4px; }
    .meta { font-size: 0.8rem; color: #8b949e; margin-bottom: 24px; }
    .section { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    .section h2 { font-size: 1rem; color: #58a6ff; margin: 0 0 12px; }
    .stat { display: inline-block; background: #21262d; border: 1px solid #30363d; border-radius: 6px; padding: 8px 14px; margin: 4px; font-size: 0.85rem; }
    .stat strong { color: #e6edf3; }
    .stat span { color: #8b949e; font-size: 0.75rem; }
    pre { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 14px; font-size: 0.8rem; color: #e6edf3; overflow-x: auto; white-space: pre-wrap; font-family: 'JetBrains Mono', monospace; }
    .columns { font-size: 0.8rem; color: #8b949e; word-break: break-word; }
  </style>
</head>
<body>
  <h1>Architect-WASM Report</h1>
  <div class="meta">Generated: ${timestamp}</div>

  <div class="section">
    <h2>Data Summary</h2>
    <div class="stat"><strong>${rowCount}</strong><br/><span>Rows</span></div>
    <div class="stat"><strong>${columns.split(',').length}</strong><br/><span>Columns</span></div>
    <div class="columns" style="margin-top:10px;">Columns: ${columns}</div>
  </div>

  <div class="section">
    <h2>Visualization</h2>
    ${plotHtml}
  </div>

  <div class="section">
    <h2>Python Code</h2>
    <pre>${code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>
</body>
</html>`;

    const blob = new Blob([reportHtml], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `architect-report-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [plotHtml, csvData, code]);

  const hasApiKey = !!localStorage.getItem('anthropic_api_key');

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-y-auto">

      {/* ── Session restored toast ── */}
      {sessionRestored && !restoredDismissed && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border text-xs text-foreground shadow-lg cursor-pointer"
          onClick={() => setRestoredDismissed(true)}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
          Session restored — click to dismiss
        </div>
      )}

      {/* ── Title bar ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-primary" />
          <h1 className="text-sm font-bold text-foreground tracking-wide">
            Architect<span className="text-primary">-WASM</span>
          </h1>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <CSVDropzone onFileLoaded={handleFileLoaded} onExcelLoaded={handleExcelLoaded} fileName={csvFileName} onClear={handleClearFile} />

          {/* Sample data button – only shown when no file is loaded */}
          {!csvFileName && (
            <button
              onClick={handleLoadTitanic}
              disabled={titanicLoading}
              title="Load the Titanic dataset as a demo"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors ml-1"
            >
              <Database className="w-3.5 h-3.5 text-primary" />
              {titanicLoading ? 'Loading…' : 'Sample Data'}
            </button>
          )}

          {/* Gallery button */}
          <button
            onClick={() => setGalleryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors ml-1"
          >
            <LayoutTemplate className="w-3.5 h-3.5" /> Gallery
          </button>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mobile-hidden flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors ml-1"
          >
            <Github className="w-3.5 h-3.5" /> GitHub
          </a>

          {/* System health button */}
          <button
            onClick={() => setHealthOpen(true)}
            title="System health"
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-1"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Theme switcher dropdown */}
          <div className="relative">
            <button
              onClick={() => setThemeMenuOpen(o => !o)}
              title="Switch theme"
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Palette className="w-4 h-4" />
            </button>
            {themeMenuOpen && (
              <>
                {/* backdrop to close */}
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setThemeMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1 z-40 w-40 rounded border border-border bg-card shadow-lg py-1">
                  {THEMES.map(t => (
                    <button
                      key={t.value}
                      onClick={() => { setTheme(t.value); setThemeMenuOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        theme === t.value
                          ? 'text-primary bg-secondary'
                          : 'text-foreground hover:bg-secondary'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-56 shrink-0 bg-sidebar border-r border-border overflow-hidden sidebar-collapse tablet-narrow flex flex-col">
          <div className="flex-1 min-h-0">
            <HistorySidebar />
          </div>
          <div className="h-2/5 border-t border-border shrink-0">
            <ActiveTablesSidebar tables={activeTables} />
          </div>
        </aside>

        {/* Editor + preview area */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Top: CSV preview or welcome screen */}
          {csvData ? (
            <div className="border-b border-border p-4 overflow-auto scrollbar-thin max-h-48 shrink-0">
              <DataPreview csvData={csvData} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <Cpu className="w-16 h-16 text-primary/20 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-foreground mb-2">Architect-WASM</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Client-side data science powered by WebAssembly.
                  Upload a CSV to start analyzing — or load the demo dataset below.
                </p>
                <CSVDropzone onFileLoaded={handleFileLoaded} onExcelLoaded={handleExcelLoaded} fileName={csvFileName} onClear={handleClearFile} />

                <div className="flex items-center gap-3 mt-5 mb-1">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <button
                  onClick={handleLoadTitanic}
                  disabled={titanicLoading}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-secondary text-sm font-medium text-foreground hover:bg-secondary/80 hover:border-primary/40 disabled:opacity-50 transition-all"
                >
                  <Database className="w-4 h-4 text-primary" />
                  {titanicLoading ? 'Fetching Titanic dataset…' : 'Load Titanic Dataset (Demo)'}
                </button>
                <p className="text-[11px] text-muted-foreground mt-2">
                  891 rows · survival, age, fare, class and more
                </p>
              </div>
            </div>
          )}

          {csvData && (
            <>
              {/* Main tabs: Editor | Visualizer */}
              <div className="flex items-center gap-0 px-4 pt-2 border-b border-border shrink-0 bg-card/50">
                <button
                  onClick={() => setActiveMainTab('editor')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                    activeMainTab === 'editor'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" /> Editor
                </button>
                <button
                  onClick={() => { setActiveMainTab('visualizer'); setNewPlotReady(false); }}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                    activeMainTab === 'visualizer'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" /> Visualizer
                  {/* Glowing notification dot — chart ready but user is on Editor tab */}
                  {newPlotReady && activeMainTab !== 'visualizer' && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
                    </span>
                  )}
                </button>

                {/* Download Report button — visible when chart is ready in Visualizer tab */}
                {activeMainTab === 'visualizer' && plotHtml && (
                  <button
                    onClick={handleDownloadReport}
                    title="Download standalone HTML report"
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors mb-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Report
                  </button>
                )}
              </div>

              {/* Visualizer tab */}
              {activeMainTab === 'visualizer' ? (
                <div className="flex-1 flex overflow-hidden">
                  <div className="w-64 shrink-0 border-r border-border overflow-hidden">
                    <VisualBuilder
                      csvData={csvData}
                      onGenerateCode={handleVisualCode}
                      onSwitchToEditor={() => setActiveMainTab('editor')}
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 relative">
                    {plotHtml ? (
                      <PlotViewer html={plotHtml} onClose={() => setPlotHtml(null)} />
                    ) : (
                      <div className="relative flex flex-col items-center justify-center h-full text-muted-foreground">
                        <BarChart2 className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-sm">Configure and generate a chart</p>
                        <p className="text-[11px] mt-1 opacity-60">Use the builder on the left</p>
                        <button
                          onClick={() => setTourActive(true)}
                          className="mt-4 flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          How do I see my chart?
                        </button>
                        {/* 5-second guided tour overlay */}
                        <AnimatePresence>
                          {tourActive && (
                            <GuidedTour onClose={() => setTourActive(false)} />
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* AI prompt bar */}
                  <div className="px-4 py-2 border-b border-border bg-card/50 shrink-0">
                    {hasApiKey ? (
                      <div className="flex gap-2">
                        <input
                          value={aiPrompt}
                          onChange={e => setAiPrompt(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAIGenerate()}
                          placeholder="Ask AI to generate analysis code…"
                          className="flex-1 px-3 py-1.5 rounded bg-secondary border border-border text-foreground text-xs font-mono placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors"
                        />
                        <button
                          onClick={handleAIGenerate}
                          disabled={aiLoading || !aiPrompt.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {aiLoading ? 'Generating…' : 'Generate'}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <AlertCircle className="w-3.5 h-3.5 text-warning" />
                        <span>
                          Use{' '}
                          <button onClick={() => setGalleryOpen(true)} className="text-primary hover:underline">Templates</button>
                          {' '}or{' '}
                          <button onClick={() => setSettingsOpen(true)} className="text-primary hover:underline">enter API Key</button>
                          {' '}for AI-powered analysis
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Python / SQL mode toggle + large-dataset hint */}
                  <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-card/30 shrink-0">
                    <div className="flex rounded overflow-hidden border border-border text-[11px]">
                      <button
                        onClick={() => setEditorMode('python')}
                        className={`px-3 py-1 font-medium transition-colors ${editorMode === 'python' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Python
                      </button>
                      <button
                        onClick={() => setEditorMode('sql')}
                        className={`px-3 py-1 font-medium transition-colors ${editorMode === 'sql' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        SQL
                      </button>
                      <button
                        onClick={() => setEditorMode('r')}
                        className={`px-3 py-1 font-medium transition-colors ${editorMode === 'r' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        R
                      </button>
                    </div>
                    {editorMode === 'sql' && (
                      <span className="text-[11px] text-muted-foreground">
                        DuckDB · table name: <code className="text-primary font-mono">data</code> (or <code className="text-primary font-mono">python_data</code>, <code className="text-primary font-mono">r_data</code>)
                        {duckLoading && ' · initializing…'}
                        {duckReady  && ' · ready'}
                      </span>
                    )}
                    {isLargeDataset && editorMode === 'python' && (
                      <span className="ml-auto text-[11px] text-warning flex items-center gap-1">
                        ⚡ {rowCount.toLocaleString()} rows — switch to SQL mode for best performance
                      </span>
                    )}
                    {(editorMode === 'python' || editorMode === 'r') && (
                      <button
                        onClick={handleExportToSQL}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="Exports the current 'data' dataframe to DuckDB via Arrow"
                      >
                        <Database className="w-3.5 h-3.5" /> Export to SQL
                      </button>
                    )}
                  </div>

                  {/* Code editor + plot viewer */}
                  <div className="flex-1 flex overflow-hidden">
                    <div className={`${plotHtml && (editorMode === 'python' || editorMode === 'r') ? 'w-1/2' : 'w-full'} flex flex-col overflow-hidden p-2`}>
                      <CodeEditor
                        code={editorMode === 'r' ? rCode : editorMode === 'python' ? code : sqlCode}
                        onChange={editorMode === 'r' ? setRCode : editorMode === 'python' ? setCode : setSqlCode}
                        onRun={editorMode === 'sql' ? handleRunSQL : handleRunCode}
                        running={running || pyodideLoading || webrLoading}
                        title={editorMode === 'r' ? 'analysis.R' : editorMode === 'python' ? 'analysis.py' : 'query.sql'}
                      />
                    </div>
                    {plotHtml && (editorMode === 'python' || editorMode === 'r') && (
                      <div className="w-1/2 flex flex-col overflow-hidden p-2 pl-0">
                        <PlotViewer html={plotHtml} onClose={() => setPlotHtml(null)} />
                      </div>
                    )}
                  </div>

                  {/* Terminal */}
                  <div className={`shrink-0 transition-all duration-200 ${terminalExpanded ? 'h-48' : 'h-8'}`}>
                    <button
                      onClick={() => setTerminalExpanded(!terminalExpanded)}
                      className="absolute right-6 z-10 p-0.5 text-muted-foreground hover:text-foreground"
                      style={{ marginTop: '4px' }}
                    >
                      {terminalExpanded
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronUp className="w-3.5 h-3.5" />}
                    </button>
                    <Terminal output={activeOutput} onClear={activeClearOutput} loading={running || pyodideLoading || webrLoading} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Status bar ── */}
      <footer className="flex items-center justify-between px-4 py-1 bg-status-bar border-t border-border text-[11px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1 ${pyodideLoading ? 'text-warning' : pyodideReady ? 'text-success' : 'text-muted-foreground'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {pyodideLoading ? 'Loading Pyodide…' : pyodideReady ? 'Pyodide Ready' : 'Pyodide Idle'}
          </span>
          {(duckReady || duckLoading) && (
            <span className={`flex items-center gap-1 ${duckLoading ? 'text-warning' : 'text-success'}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {duckLoading ? 'DuckDB loading…' : 'DuckDB Ready'}
            </span>
          )}
          <span className={`flex items-center gap-1 ${webrLoading ? 'text-warning' : webrReady ? 'text-success' : 'text-muted-foreground'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {webrLoading ? 'Loading WebR…' : webrReady ? 'WebR Ready' : 'WebR Idle'}
          </span>
          <span className="hidden">{/* dummy to close span below */}
          </span>
          {csvFileName && <span>{csvFileName}</span>}
          {lastRunMs !== undefined && <span>{lastRunMs}ms</span>}
        </div>
        <div className="flex items-center gap-3">
          <SecurityBadge />
          <span className="mobile-hidden">Pyodide · WebR</span>
          <span className="mobile-hidden">Arrow Data</span>
        </div>
      </footer>

      {/* ── Modals / drawers ── */}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <TemplateGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={handleSelectTemplate}
      />

      <SystemHealthDrawer
        open={healthOpen}
        onClose={() => setHealthOpen(false)}
        pyodideReady={pyodideReady}
        pyodideLoading={pyodideLoading}
        lastRunMs={lastRunMs}
      />

      {/* Hidden canvas for Pyodide OffscreenCanvas background rendering */}
      <canvas ref={canvasRef} style={{ display: 'none' }} width={800} height={600} />

      {/* Processing overlay — pill at bottom of screen while WASM is running */}
      <ProcessingOverlay running={running} rowCount={rowCount} />
    </div>
  );
}
