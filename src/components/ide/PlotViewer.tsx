import { X } from 'lucide-react';

interface PlotViewerProps {
  html: string;
  onClose: () => void;
}

export function PlotViewer({ html, onClose }: PlotViewerProps) {
  const srcDoc = `<!doctype html><html><head><style>body{margin:0;background:transparent;overflow:hidden;}</style></head><body>${html}</body></html>`;

  return (
    <div className="flex flex-col h-full bg-editor rounded border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/30">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Visualization</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <iframe
        srcDoc={srcDoc}
        className="flex-1 w-full bg-transparent"
        sandbox="allow-scripts"
        title="Plot"
      />
    </div>
  );
}
