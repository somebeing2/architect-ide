import { useState, useCallback, useMemo } from 'react';
import {
  Settings, Github, Cpu, Database,
  ChevronDown, ChevronUp, Sparkles, AlertCircle,
  Sun, Moon, Activity, LayoutTemplate, BarChart2,
  Code2, HelpCircle,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { CSVDropzone } from './CSVDropzone';
import { DataPreview } from './DataPreview';
import { CodeEditor } from './CodeEditor';
import { Terminal } from './Terminal';
import { PlotViewer } from './PlotViewer';
import { SettingsModal } from './SettingsModal';
import { HistorySidebar } from './HistorySidebar';
import { TemplateGallery } from './TemplateGallery';
import { SystemHealthDrawer } from './SystemHealthDrawer';
import { VisualBuilder } from './VisualBuilder';
import { SecurityBadge } from './SecurityBadge';
import { GuidedTour } from './GuidedTour';
import { ProcessingOverlay } from './ProcessingOverlay';
import { usePyodide } from '@/hooks/usePyodide';
import { type Template } from '@/lib/templates';
import { useAppContext } from '@/context/AppContext';

const TITANIC_URL =
  'https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv';

export function IDELayout() {
  const {
    csvData, setCsvData,
    csvFileName, setCsvFileName,
    code, setCode,
    addHistory,
    plotHtml, setPlotHtml,
    activeMainTab, setActiveMainTab,
    theme, toggleTheme,
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

  // Row count used by the processing overlay
  const rowCount = useMemo(() => {
    if (!csvData) return 0;
    return csvData.trim().split('\n').length - 1;
  }, [csvData]);

  const { output, clearOutput, runCode, loading: pyodideLoading, ready: pyodideReady } = usePyodide();

  // ── File handlers ────────────────────────────────────────────────────────
  const handleFileLoaded = useCallback((data: string, fileName: string) => {
    setCsvData(data);
    setCsvFileName(fileName);
  }, [setCsvData, setCsvFileName]);

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
    const result = await runCode(code, csvData);
    const ms = Math.round(performance.now() - t0);
    setLastRunMs(ms);

    if (result.plotHtml) {
      setPlotHtml(result.plotHtml);
      // If the user is on the Editor tab, light up the Visualizer tab notification dot
      if (activeMainTab === 'editor') setNewPlotReady(true);
    }

    addHistory({
      id       : Date.now().toString(),
      name     : code.split('\n').find(l => l.startsWith('#'))?.replace('#', '').trim() || 'Analysis',
      timestamp: new Date().toISOString(),
      code,
    });

    setRunning(false);
  }, [code, csvData, runCode, setPlotHtml, addHistory, activeMainTab]);

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
      const result = await runCode(generatedCode, csvData);
      const ms = Math.round(performance.now() - t0);
      setLastRunMs(ms);
      if (result.plotHtml) setPlotHtml(result.plotHtml);
      setRunning(false);
    }
  }, [setCode, setActiveMainTab, csvData, runCode, setPlotHtml]);

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

  const hasApiKey = !!localStorage.getItem('anthropic_api_key');

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-y-auto">

      {/* ── Title bar ── */}
      <header className="flex items-center justify-between px-4 py-2 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-primary" />
          <h1 className="text-sm font-bold text-foreground tracking-wide">
            Architect<span className="text-primary">-WASM</span>
          </h1>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <CSVDropzone onFileLoaded={handleFileLoaded} fileName={csvFileName} onClear={handleClearFile} />

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

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

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
        <aside className="w-56 shrink-0 bg-sidebar border-r border-border overflow-hidden sidebar-collapse tablet-narrow">
          <HistorySidebar />
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
                <CSVDropzone onFileLoaded={handleFileLoaded} fileName={csvFileName} onClear={handleClearFile} />

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

                  {/* Code editor + plot viewer */}
                  <div className="flex-1 flex overflow-hidden">
                    <div className={`${plotHtml ? 'w-1/2' : 'w-full'} flex flex-col overflow-hidden p-2`}>
                      <CodeEditor
                        code={code}
                        onChange={setCode}
                        onRun={handleRunCode}
                        running={running || pyodideLoading}
                      />
                    </div>
                    {plotHtml && (
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
                    <Terminal output={output} onClear={clearOutput} loading={running || pyodideLoading} />
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
          {csvFileName && <span>{csvFileName}</span>}
          {lastRunMs !== undefined && <span>{lastRunMs}ms</span>}
        </div>
        <div className="flex items-center gap-3">
          <SecurityBadge />
          <span className="mobile-hidden">Python 3.11 (WASM)</span>
          <span className="mobile-hidden">Pandas · Plotly</span>
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

      {/* Processing overlay — pill at bottom of screen while WASM is running */}
      <ProcessingOverlay running={running} rowCount={rowCount} />
    </div>
  );
}
