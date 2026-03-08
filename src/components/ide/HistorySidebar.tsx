import { Clock, Trash2, FileCode2, Layers, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext, type HistoryEntry } from '@/context/AppContext';

// Re-export HistoryEntry from AppContext for backwards compatibility
export type { HistoryEntry };

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const secs  = Math.floor(diff / 1000);
  if (secs < 60)  return `${secs}s ago`;
  const mins  = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days  = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HistorySidebar() {
  const { history, setCode, deleteHistory, clearHistory } = useAppContext();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">History</span>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            title="Clear all history"
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          >
            <XCircle className="w-3 h-3" />
            Clear All
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {history.length === 0 && (
          <div className="text-center py-8">
            <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No analyses yet</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {history.map(entry => (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div
                className="group flex items-start gap-2 p-2 rounded hover:bg-secondary/50 cursor-pointer transition-colors"
                onClick={() => setCode(entry.code)}
              >
                <FileCode2 className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{entry.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {timeAgo(entry.timestamp)}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteHistory(entry.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
