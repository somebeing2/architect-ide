import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';

const STEPS = [
  {
    icon: '📂',
    title: 'Step 1: Load Your Data',
    desc: 'Upload a CSV file using the header button, or click "Sample Data" to instantly load the Titanic dataset.',
  },
  {
    icon: '🗂',
    title: 'Step 2: Pick a Template',
    desc: 'Click "Gallery" in the header to choose from 10 ready-made analysis templates across 5 categories.',
  },
  {
    icon: '▶',
    title: 'Step 3: Run the Code',
    desc: 'Press "Run" in the code editor. Python executes 100% locally in your browser — no server needed.',
  },
  {
    icon: '📊',
    title: 'Step 4: Chart Appears Here',
    desc: 'Any Plotly chart your code produces is auto-detected and displayed in this panel — no special variable name needed.',
  },
  {
    icon: '✨',
    title: "You're Ready!",
    desc: 'Try the Visual Builder for no-code charts, or add an Anthropic API key for AI-generated analysis.',
  },
] as const;

const STEP_MS = 1000; // 1 second per step → 5 seconds total

interface GuidedTourProps {
  onClose: () => void;
}

export function GuidedTour({ onClose }: GuidedTourProps) {
  const [step, setStep] = useState(0);

  const advance = useCallback(() => {
    setStep(s => {
      if (s >= STEPS.length - 1) return s; // let the exit useEffect close
      return s + 1;
    });
  }, []);

  // Auto-advance; close after the last step completes
  useEffect(() => {
    const t = setTimeout(() => {
      if (step >= STEPS.length - 1) {
        onClose();
      } else {
        advance();
      }
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [step, advance, onClose]);

  const current = STEPS[step];

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-[2px] rounded"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="relative w-72 bg-card border border-border rounded-xl shadow-2xl p-5"
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ scale: 1,    opacity: 1, y: 0  }}
          exit={{   scale: 0.92, opacity: 0, y: -12 }}
          transition={{ type: 'spring', duration: 0.28 }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Content */}
          <div className="text-2xl mb-3">{current.icon}</div>
          <h3 className="text-sm font-bold text-foreground mb-1.5">{current.title}</h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{current.desc}</p>

          {/* Progress bar (refills each step) */}
          <div className="mt-4 h-1 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
            />
          </div>

          {/* Step dots + manual next */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-4 bg-primary' : 'w-1.5 bg-border hover:bg-muted-foreground'
                  }`}
                />
              ))}
            </div>
            {step < STEPS.length - 1 && (
              <button
                onClick={advance}
                className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 transition-colors"
              >
                Skip <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
