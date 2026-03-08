import { useState } from 'react';
import { Play, Copy, Check } from 'lucide-react';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onRun: () => void;
  running?: boolean;
  title?: string;
}

export function CodeEditor({ code, onChange, onRun, running, title }: CodeEditorProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-editor rounded border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-destructive/80" />
          <div className="w-3 h-3 rounded-full bg-warning/80" />
          <div className="w-3 h-3 rounded-full bg-success/80" />
          <span className="ml-2 text-xs text-muted-foreground font-mono">{title || 'analysis.py'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleCopy} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-secondary">
            {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button 
            onClick={onRun} 
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            <Play className="w-3 h-3" />
            {running ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>
      <div className="flex flex-1 overflow-auto scrollbar-thin">
        <div className="flex flex-col py-3 px-2 text-right select-none border-r border-border bg-secondary/20">
          {lines.map((_, i) => (
            <span key={i} className="text-[11px] leading-5 text-muted-foreground/50 font-mono">{i + 1}</span>
          ))}
        </div>
        <textarea
          value={code}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 p-3 bg-transparent text-foreground font-mono text-xs leading-5 resize-none outline-none scrollbar-thin"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
