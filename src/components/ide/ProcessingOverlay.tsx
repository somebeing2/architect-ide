import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ProcessingOverlayProps {
  running: boolean;
  rowCount: number;
}

export function ProcessingOverlay({ running, rowCount }: ProcessingOverlayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [running]);

  const isHeavy = rowCount > 1000;

  return (
    <AnimatePresence>
      {running && (
        <motion.div
          className="fixed bottom-9 left-1/2 z-50 -translate-x-1/2"
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{    opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.18 }}
        >
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-card border border-border shadow-xl text-xs font-medium text-foreground backdrop-blur-sm">
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
            <span>
              {isHeavy
                ? `Processing ${rowCount.toLocaleString()} rows…`
                : 'Running analysis…'}
            </span>
            {elapsed > 0 && (
              <span className="text-muted-foreground tabular-nums">{elapsed}s</span>
            )}
            {isHeavy && elapsed === 0 && (
              <span className="text-muted-foreground">hang tight</span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
