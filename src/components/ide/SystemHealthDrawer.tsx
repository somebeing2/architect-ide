import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Cpu, Package, RefreshCw, CheckCircle2, Loader2, AlertCircle,
  HardDrive, Zap,
} from 'lucide-react';

interface MemoryInfo {
  used: number;
  total: number;
  limit: number;
}

function getMemoryMB(): MemoryInfo | null {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!mem) return null;
  return {
    used:  Math.round(mem.usedJSHeapSize  / 1024 / 1024),
    total: Math.round(mem.totalJSHeapSize / 1024 / 1024),
    limit: Math.round(mem.jsHeapSizeLimit  / 1024 / 1024),
  };
}

export interface SystemHealthDrawerProps {
  open: boolean;
  onClose: () => void;
  pyodideReady: boolean;
  pyodideLoading: boolean;
  lastRunMs?: number;
}

interface HealthCard {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  status?: 'ok' | 'warn' | 'loading';
}

export function SystemHealthDrawer({
  open,
  onClose,
  pyodideReady,
  pyodideLoading,
  lastRunMs,
}: SystemHealthDrawerProps) {
  const [memory, setMemory] = useState<MemoryInfo | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (open) {
      setMemory(getMemoryMB());
    }
  }, [open, refreshKey]);

  const handleRefresh = () => {
    setMemory(getMemoryMB());
    setRefreshKey(k => k + 1);
  };

  const pyodideStatus = pyodideLoading ? 'loading' : pyodideReady ? 'ok' : 'warn';

  const cards: HealthCard[] = [
    {
      icon: Cpu,
      label: 'Pyodide Runtime',
      value: pyodideLoading ? 'Loading…' : pyodideReady ? 'Ready' : 'Not loaded',
      sub: 'Python 3.11 (WASM)',
      status: pyodideStatus,
    },
    {
      icon: HardDrive,
      label: 'WASM Memory',
      value: memory ? `${memory.used} MB used` : 'N/A',
      sub: memory ? `${memory.total} MB total · ${memory.limit} MB limit` : 'performance.memory not available',
      status: memory ? (memory.used / memory.limit > 0.8 ? 'warn' : 'ok') : 'warn',
    },
    {
      icon: Package,
      label: 'pandas',
      value: 'Pre-loaded',
      sub: 'Data manipulation library',
      status: pyodideReady ? 'ok' : 'loading',
    },
    {
      icon: Package,
      label: 'plotly',
      value: 'Pre-loaded',
      sub: 'Interactive visualizations',
      status: pyodideReady ? 'ok' : 'loading',
    },
    {
      icon: Zap,
      label: 'Last Run',
      value: lastRunMs !== undefined ? `${lastRunMs} ms` : '—',
      sub: 'Execution time',
      status: 'ok',
    },
  ];

  const statusIcon = (status?: HealthCard['status']) => {
    if (status === 'loading') return <Loader2 className="w-4 h-4 text-warning animate-spin" />;
    if (status === 'warn')    return <AlertCircle className="w-4 h-4 text-warning" />;
    return <CheckCircle2 className="w-4 h-4 text-success" />;
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed top-0 right-0 bottom-0 z-50 w-80 bg-card border-l border-border shadow-2xl flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-sm font-bold text-foreground">System Health</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Runtime diagnostics</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  title="Refresh metrics"
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {cards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.label}
                    className="flex items-start gap-3 p-3 rounded-lg bg-secondary/40 border border-border"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">{card.label}</p>
                        {statusIcon(card.status)}
                      </div>
                      <p className="text-xs text-foreground/80 mt-0.5">{card.value}</p>
                      {card.sub && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{card.sub}</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border shrink-0">
              <p className="text-[10px] text-muted-foreground text-center">
                All execution is local — no data leaves your browser
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
