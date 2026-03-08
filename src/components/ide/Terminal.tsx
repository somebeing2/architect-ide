import { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Trash2 } from 'lucide-react';

interface TerminalProps {
  output: string[];
  onClear: () => void;
  loading?: boolean;
}

export function Terminal({ output, onClear, loading }: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="flex flex-col h-full bg-terminal rounded-t-md border-t border-border">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-terminal-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Terminal</span>
        </div>
        <button onClick={onClear} className="text-muted-foreground hover:text-foreground transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 scrollbar-thin font-mono text-xs">
        {output.length === 0 && (
          <span className="text-muted-foreground">Ready. Upload a CSV and run an analysis.</span>
        )}
        {output.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap mb-1 ${
            line.startsWith('>>>') ? 'text-primary' 
            : line.startsWith('Error') ? 'text-destructive' 
            : 'text-terminal-foreground'
          }`}>
            {line}
          </div>
        ))}
        {loading && <span className="terminal-cursor text-primary">Processing</span>}
      </div>
    </div>
  );
}
