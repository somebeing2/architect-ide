import { Database, Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ActiveTable } from '@/hooks/useDuckDB';

interface ActiveTablesSidebarProps {
  tables: ActiveTable[];
}

export function ActiveTablesSidebar({ tables }: ActiveTablesSidebarProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (tableName: string) => {
    const query = `SELECT * FROM ${tableName} LIMIT 10;`;
    navigator.clipboard.writeText(query);
    setCopiedId(tableName);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Active Tables</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {tables.length === 0 && (
          <div className="text-center py-6">
            <Database className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground">No tables available.<br/>Load CSV or Export from Py/R.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {tables.map(table => (
            <motion.div
              key={table.tableName}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="group flex items-center justify-between p-2 rounded hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    table.source === 'python' ? 'bg-yellow-400' :
                    table.source === 'r' ? 'bg-blue-500' : 'bg-green-500'
                  }`} />
                  <p className="text-xs font-medium text-foreground truncate" title={table.tableName}>{table.tableName}</p>
                </div>
                <button
                  onClick={() => handleCopy(table.tableName)}
                  className="p-1 rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-all flex shrink-0"
                  title="Copy SQL SELECT"
                >
                  {copiedId === table.tableName ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
