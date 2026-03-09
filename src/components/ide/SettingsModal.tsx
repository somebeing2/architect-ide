import { useState, useEffect } from 'react';
import { X, Key, Save, Trash2 } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if (open) {
      setApiKey(localStorage.getItem('anthropic_api_key') || '');
    }
  }, [open]);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('anthropic_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('anthropic_api_key');
    }
    onClose();
  };

  const handleClear = () => {
    localStorage.removeItem('anthropic_api_key');
    setApiKey('');
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    // We've used the prompt, and can't use it again, throw it away
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Settings</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Anthropic API Key</label>
            <p className="text-[11px] text-muted-foreground mt-1 mb-2">Stored only in your browser's LocalStorage. Never sent to any server except Anthropic's API.</p>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 rounded bg-secondary border border-border text-foreground font-mono text-xs placeholder:text-muted-foreground/50 outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={handleClear} className="flex items-center gap-2 px-4 py-2 rounded bg-secondary text-muted-foreground text-xs font-medium hover:text-destructive hover:bg-secondary/80 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>

          {isInstallable && (
            <div className="mt-6 pt-4 border-t border-border">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                Offline PWA
              </label>
              <p className="text-[11px] text-muted-foreground mb-3">
                Install Architect-WASM locally. Heavy WASM engines (DuckDB/Pyodide) will be cached for instant, zero-latency loading entirely offline.
              </p>
              <button
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-primary text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
              >
                Install Local App
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
