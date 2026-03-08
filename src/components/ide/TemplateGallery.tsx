import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, BarChart3, Grid3X3, TrendingUp, Sparkles, Table2,
  ClipboardList, FileOutput, LayoutGrid, Flame, GraduationCap,
  Search,
} from 'lucide-react';
import { templates, type Template, type TemplateCategory } from '@/lib/templates';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3, Grid3X3, TrendingUp, Sparkles, Table2,
  ClipboardList, FileOutput, LayoutGrid, Flame, GraduationCap,
};

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  explore: 'Explore',
  clean: 'Clean',
  visualize: 'Visualize',
  export: 'Export',
  education: 'Education',
};

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  explore:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
  clean:     'bg-green-500/15 text-green-400 border-green-500/30',
  visualize: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  export:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  education: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
};

interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: Template) => void;
}

const ALL_CATEGORIES: Array<TemplateCategory | 'all'> = [
  'all', 'explore', 'visualize', 'clean', 'export', 'education',
];

export function TemplateGallery({ open, onClose, onSelect }: TemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = templates.filter(t => {
    const matchesCat = activeCategory === 'all' || t.category === activeCategory;
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-3xl max-h-[80vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', duration: 0.3 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-sm font-bold text-foreground tracking-wide">Template Gallery</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">{templates.length} analysis templates</p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search + filter bar */}
            <div className="px-5 py-3 border-b border-border shrink-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search templates…"
                  className="w-full pl-9 pr-3 py-1.5 rounded bg-secondary border border-border text-foreground text-xs placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {ALL_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${
                      activeCategory === cat
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Search className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">No templates match your search</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filtered.map(template => {
                    const Icon = ICON_MAP[template.icon] ?? BarChart3;
                    return (
                      <motion.button
                        key={template.id}
                        onClick={() => { onSelect(template); onClose(); }}
                        className="group flex items-start gap-3 p-4 rounded-lg bg-secondary/40 border border-border hover:border-primary/40 hover:bg-secondary/70 text-left transition-all"
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-semibold text-foreground">{template.name}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CATEGORY_COLORS[template.category]}`}>
                              {CATEGORY_LABELS[template.category]}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{template.description}</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
