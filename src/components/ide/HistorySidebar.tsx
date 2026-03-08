import { Clock, Play, Trash2, FileCode2, Layers } from 'lucide-react';

export interface HistoryEntry {
  id: string;
  name: string;
  timestamp: Date;
  code: string;
}

interface HistorySidebarProps {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

export function HistorySidebar({ entries, onSelect, onDelete }: HistorySidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <Layers className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">History</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {entries.length === 0 && (
          <div className="text-center py-8">
            <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No analyses yet</p>
          </div>
        )}
        {entries.map(entry => (
          <div
            key={entry.id}
            className="group flex items-start gap-2 p-2 rounded hover:bg-secondary/50 cursor-pointer transition-colors"
            onClick={() => onSelect(entry)}
          >
            <FileCode2 className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{entry.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {entry.timestamp.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
