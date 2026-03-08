import { useState, useCallback } from 'react';
import { Settings, BookTemplate, Github, Cpu, ChevronDown, ChevronUp, Sparkles, AlertCircle } from 'lucide-react';
import { CSVDropzone } from './CSVDropzone';
import { DataPreview } from './DataPreview';
import { CodeEditor } from './CodeEditor';
import { Terminal } from './Terminal';
import { PlotViewer } from './PlotViewer';
import { SettingsModal } from './SettingsModal';
import { HistorySidebar, type HistoryEntry } from './HistorySidebar';
import { usePyodide } from '@/hooks/usePyodide';
import { templates, type Template } from '@/lib/templates';

export function IDELayout() {
  const [csvData, setCsvData] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [code, setCode] = useState('# Upload a CSV and select a template to begin\n');
  const [plotHtml, setPlotHtml] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [terminalExpanded, setTerminalExpanded] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { output, clearOutput, runCode, loading: pyodideLoading } = usePyodide();

  const handleFileLoaded = useCallback((data: string, fileName: string) => {
    setCsvData(data);
    setCsvFileName(fileName);
  }, []);

  const handleClearFile = useCallback(() => {
    setCsvData(null);
    setCsvFileName('');
  }, []);

  const handleRunCode = useCallback(async () => {
    if (!csvData) return;
    setRunning(true);
    const result = await runCode(code, csvData);
    if (result.plotHtml) setPlotHtml(result.plotHtml);
    
    setHistory(prev => [{
      id: Date.now().toString(),
      name: code.split('\n').find(l => l.startsWith('#'))?.replace('#', '').trim() || 'Analysis',
      timestamp: new Date(),
      code,
    }, ...prev]);
    
    setRunning(false);
  }, [code, csvData, runCode]);

  const handleSelectTemplate = useCallback((template: Template) => {
    setCode(template.code);
    setTemplatesOpen(false);
  }, []);

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    setCode(entry.code);
  }, []);

  const handleHistoryDelete = useCallback((id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
  }, []);

  const getCSVSchema = useCallback(() => {
    if (!csvData) return '';
    const lines = csvData.trim().split('\n');
    const headers = lines[0];
    const sample = lines.slice(1, 3).join('\n');
    return `Columns: ${headers}\nSample:\n${sample}`;
  }, [csvData]);

  const handleAIGenerate = useCallback(async () => {
    const apiKey = localStorage.getItem('anthropic_api_key');
    if (!apiKey) return;
    if (!csvData || !aiPrompt.trim()) return;

    setAiLoading(true);
    try {
      const schema = getCSVSchema();
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: `You are a data science assistant. Generate Python code using pandas to analyze a CSV file at '/data.csv'. 
Schema: ${schema}
Task: ${aiPrompt}
Rules: Use pandas. If visualization needed, use plotly and store figure in variable '_fig'. Print results. Only output Python code, no markdown.`
          }],
        }),
      });

      const data = await response.json();
      const generatedCode = data.content?.[0]?.text || '# AI generation failed';
      setCode(generatedCode.replace(/```python\n?/g, '').replace(/```\n?/g, ''));
    } catch (err: any) {
      setCode(`# AI Error: ${err.message}`);
    }
    setAiLoading(false);
  }, [aiPrompt, csvData, getCSVSchema]);

  const hasApiKey = !!localStorage.getItem('anthropic_api_key');

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Title Bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-card border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-primary" />
          <h1 className="text-sm font-bold text-foreground tracking-wide">Architect<span className="text-primary">-WASM</span></h1>
        </div>
        <div className="flex items-center gap-1">
          <CSVDropzone onFileLoaded={handleFileLoaded} fileName={csvFileName} onClear={handleClearFile} />
          
          {/* Templates dropdown */}
          <div className="relative ml-2">
            <button
              onClick={() => setTemplatesOpen(!templatesOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              <BookTemplate className="w-3.5 h-3.5" /> Templates
            </button>
            {templatesOpen && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-popover border border-border rounded-lg shadow-xl z-50">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplate(t)}
                    className="w-full flex items-start gap-3 p-3 hover:bg-secondary/50 transition-colors text-left first:rounded-t-lg last:rounded-b-lg"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors ml-1"
          >
            <Github className="w-3.5 h-3.5" /> Sync to GitHub
          </a>

          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-1"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 bg-sidebar border-r border-border overflow-hidden">
          <HistorySidebar entries={history} onSelect={handleHistorySelect} onDelete={handleHistoryDelete} />
        </aside>

        {/* Editor + Preview Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top: CSV Preview or Welcome */}
          {csvData ? (
            <div className="border-b border-border p-4 overflow-auto scrollbar-thin max-h-64 shrink-0">
              <DataPreview csvData={csvData} />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <Cpu className="w-16 h-16 text-primary/20 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-foreground mb-2">Architect-WASM</h2>
                <p className="text-sm text-muted-foreground mb-6">Client-side data science powered by WebAssembly. Upload a CSV to start analyzing.</p>
                <CSVDropzone onFileLoaded={handleFileLoaded} fileName={csvFileName} onClear={handleClearFile} />
              </div>
            </div>
          )}

          {csvData && (
            <>
              {/* AI Prompt Bar */}
              <div className="px-4 py-2 border-b border-border bg-card/50 shrink-0">
                {hasApiKey ? (
                  <div className="flex gap-2">
                    <input
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAIGenerate()}
                      placeholder="Ask AI to generate analysis code..."
                      className="flex-1 px-3 py-1.5 rounded bg-secondary border border-border text-foreground text-xs font-mono placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors"
                    />
                    <button
                      onClick={handleAIGenerate}
                      disabled={aiLoading || !aiPrompt.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {aiLoading ? 'Generating...' : 'Generate'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <AlertCircle className="w-3.5 h-3.5 text-warning" />
                    <span>Use <button onClick={() => setTemplatesOpen(true)} className="text-primary hover:underline">Templates</button> or <button onClick={() => setSettingsOpen(true)} className="text-primary hover:underline">enter API Key</button> for AI-powered analysis</span>
                  </div>
                )}
              </div>

              {/* Code + Plot */}
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
            </>
          )}

          {/* Terminal */}
          {csvData && (
            <div className={`shrink-0 transition-all duration-200 ${terminalExpanded ? 'h-48' : 'h-8'}`}>
              <button
                onClick={() => setTerminalExpanded(!terminalExpanded)}
                className="absolute right-6 z-10 p-0.5 text-muted-foreground hover:text-foreground"
                style={{ marginTop: '4px' }}
              >
                {terminalExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
              <Terminal output={output} onClear={clearOutput} loading={running || pyodideLoading} />
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <footer className="flex items-center justify-between px-4 py-1 bg-status-bar border-t border-border text-[11px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1 ${pyodideLoading ? 'text-warning' : 'text-success'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {pyodideLoading ? 'Loading Pyodide...' : 'Pyodide Ready'}
          </span>
          {csvFileName && <span>📄 {csvFileName}</span>}
        </div>
        <div className="flex items-center gap-3">
          <span>Python 3.11 (WASM)</span>
          <span>Pandas • Plotly</span>
        </div>
      </footer>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
