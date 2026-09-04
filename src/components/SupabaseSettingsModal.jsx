import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig } from '../services/db';
import { createClient } from '@supabase/supabase-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function SupabaseSettingsModal({ isOpen, onClose, onConfigChange }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [active, setActive] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url);
      setKey(config.key);
      setActive(config.active);
      setTestResult(null);
    }
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleTestConnection = async () => {
    if (!url || !key) {
      setTestResult({ success: false, message: 'Please enter both Supabase URL and Anon Key.' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const testClient = createClient(url, key);
      const { error } = await testClient.from('products').select('id').limit(1);
      
      if (error) {
        throw error;
      }
      
      setTestResult({
        success: true,
        message: 'Successfully connected! Your Supabase database is ready.'
      });
    } catch (err) {
      console.error(err);
      setTestResult({
        success: false,
        message: `Connection failed: ${err.message || 'Check your URL/Key and CORS settings'}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveSupabaseConfig(url, key, active);
    if (onConfigChange) onConfigChange();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Database Settings</DialogTitle>
              <DialogDescription className="text-xs">
                Configure connection to your live Supabase cloud database.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Active Mode Switch */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
            <div>
              <span className="text-sm font-medium text-foreground block">Use Live Supabase Database</span>
              <span className="text-xs text-muted-foreground">Toggle off to use Local Storage (Offline Mode)</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-muted-foreground after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:after:bg-primary-foreground"></div>
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Supabase URL
              </label>
              <Input 
                type="text" 
                placeholder="https://your-project-id.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={!active}
                className="font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Supabase Anon Key
              </label>
              <Input 
                type="password" 
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={!active}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Connection Test Log */}
          {testResult && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              testResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}>
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-destructive" />
              )}
              <span className="font-medium leading-relaxed">{testResult.message}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || !active}
            className="w-full sm:w-auto h-9 gap-1.5"
          >
            {testing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
          
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-9">
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave} className="h-9">
              Save Config
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
