import { useState } from 'react';
import { Shield, X, Lock, Cpu, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function SecurityBadge() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1 text-success hover:text-success/80 transition-colors"
        title="Security information"
      >
        <Shield className="w-3 h-3" />
        <span className="text-[10px] font-medium">100% Local</span>
      </button>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.3 }}
            >
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-success/15 text-success">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Privacy Guarantee</h3>
                  <p className="text-[11px] text-muted-foreground">Your data never leaves this device</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  {
                    icon: Cpu,
                    title: 'WebAssembly Execution',
                    desc: 'All Python code runs locally in your browser via Pyodide (WebAssembly). No server involved.',
                  },
                  {
                    icon: Lock,
                    title: 'Data Never Uploaded',
                    desc: 'Your CSV files are processed entirely in browser memory. Nothing is transmitted externally.',
                  },
                  {
                    icon: Wifi,
                    title: 'One-time Runtime Download',
                    desc: 'Pyodide runtime + packages download once from CDN. After that, everything is offline-capable.',
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-3 p-3 rounded-lg bg-secondary/40 border border-border">
                    <Icon className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
