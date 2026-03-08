import { useState, useMemo, useCallback, useRef } from 'react';
import { Play, Copy, Check } from 'lucide-react';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onRun: () => void;
  running?: boolean;
  title?: string;
}

// Pixel constants that must match the CSS applied to both <pre> and <textarea>
const LINE_HEIGHT = 20;   // px  (leading-5 → 1.25rem → 20px at default 16px root)
const PAD_V      = 24;    // px  (padding-top 12 + padding-bottom 12)
const PAD_H      = 12;    // px  (padding-left / padding-right)

const SHARED_STYLE: React.CSSProperties = {
  position : 'absolute',
  top      : 0,
  left     : 0,
  right    : 0,
  bottom   : 0,
  margin   : 0,
  padding  : `${PAD_H}px`,
  fontFamily: "'JetBrains Mono', monospace",
  fontSize : '12px',
  lineHeight: `${LINE_HEIGHT}px`,
  whiteSpace: 'pre',
  tabSize  : 4,
};

export function CodeEditor({ code, onChange, onRun, running, title }: CodeEditorProps) {
  const [copied, setCopied] = useState(false);

  // ── Syntax highlight via Prism (loaded globally in index.html) ──────────
  const highlightedCode = useMemo(() => {
    const Prism = (window as any).Prism;
    if (Prism?.languages?.python) {
      return Prism.highlight(code, Prism.languages.python, 'python');
    }
    // Fallback: escape HTML so raw code shows safely
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }, [code]);

  // ── Scroll-sync refs ────────────────────────────────────────────────────
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const preRef         = useRef<HTMLPreElement>(null);
  const lineNumRef     = useRef<HTMLDivElement>(null);

  // Textarea is the primary scroll driver. On scroll we shift the <pre> and
  // line-number column by the same offset (both have overflow:hidden so they
  // cannot scroll by themselves; we move them via CSS top/left instead).
  const handleScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.style.top  = `-${ta.scrollTop}px`;
      preRef.current.style.left = `-${ta.scrollLeft}px`;
    }
    if (lineNumRef.current) {
      // shift the inner content upward so line numbers stay in sync
      lineNumRef.current.style.transform = `translateY(-${ta.scrollTop}px)`;
    }
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');

  return (
    <div className="flex flex-col h-full bg-editor rounded border border-border">

      {/* ── Title bar ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-destructive/80" />
          <div className="w-3 h-3 rounded-full bg-warning/80" />
          <div className="w-3 h-3 rounded-full bg-success/80" />
          <span className="ml-2 text-xs text-muted-foreground font-mono">{title || 'analysis.py'}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-secondary"
          >
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

      {/* ── Editor body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Line numbers – overflow:hidden; shifted vertically by handleScroll */}
        <div className="shrink-0 overflow-hidden border-r border-border bg-secondary/20 select-none">
          <div
            ref={lineNumRef}
            className="flex flex-col py-3 px-2 text-right"
            style={{ willChange: 'transform' }}
          >
            {lines.map((_, i) => (
              <span
                key={i}
                className="text-[11px] font-mono text-muted-foreground/50"
                style={{ lineHeight: `${LINE_HEIGHT}px` }}
              >
                {i + 1}
              </span>
            ))}
          </div>
        </div>

        {/* Code area: highlight <pre> behind a transparent <textarea> */}
        <div className="flex-1 relative overflow-hidden">
          {/* Highlight layer (read-only, pointer-events:none) */}
          <pre
            ref={preRef}
            aria-hidden="true"
            className="language-python"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
            style={{
              ...SHARED_STYLE,
              background     : 'transparent',
              pointerEvents  : 'none',
              overflow       : 'visible',
              zIndex         : 1,
              color          : 'inherit',
              /* willChange lets the browser composite this on its own layer */
              willChange     : 'top, left',
            }}
          />

          {/* Input layer – transparent text so highlights show through */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={e => onChange(e.target.value)}
            onScroll={handleScroll}
            spellCheck={false}
            className="scrollbar-thin"
            style={{
              ...SHARED_STYLE,
              width       : '100%',
              height      : '100%',
              background  : 'transparent',
              color       : 'transparent',
              caretColor  : '#d4d4d4',
              resize      : 'none',
              outline     : 'none',
              overflow    : 'auto',
              zIndex      : 2,
            }}
          />
        </div>
      </div>
    </div>
  );
}
