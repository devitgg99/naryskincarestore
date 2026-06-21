import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, RefreshCw, Database } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig } from '../services/db';
import { createClient } from '@supabase/supabase-js';

export default function SupabaseSettingsModal({ isOpen, onClose, onConfigChange }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [active, setActive] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, message: string }

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url);
      setKey(config.key);
      setActive(config.active);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!url || !key) {
      setTestResult({ success: false, message: 'Please enter both Supabase URL and Anon Key.' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const testClient = createClient(url, key);
      // Query a simple check
      const { data, error } = await testClient.from('products').select('id').limit(1);
      
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-dark-800 bg-dark-900 shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-500/10 text-primary-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Database Settings</h3>
              <p className="text-xs text-dark-400">Configure Supabase remote database</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between p-4 rounded-xl bg-dark-950/40 border border-dark-800">
            <div>
              <span className="text-sm font-medium text-white block">Use Live Supabase Database</span>
              <span className="text-xs text-dark-400">Toggle off to use Local Storage (Offline Mode)</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-dark-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-dark-400 after:border-dark-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500 peer-checked:after:bg-white"></div>
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Supabase URL</label>
              <input 
                type="text" 
                placeholder="https://your-project-id.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={!active}
                className="w-full glass-input disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Supabase Anon Key</label>
              <input 
                type="password" 
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={!active}
                className="w-full glass-input disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Connection Test Log */}
          {testResult && (
            <div className={`p-4 rounded-xl border text-sm flex gap-3 ${
              testResult.success 
                ? 'bg-emerald-950/20 border-emerald-800/30 text-emerald-300' 
                : 'bg-rose-950/20 border-rose-800/30 text-rose-300'
            }`}>
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-dark-800 bg-dark-950/20">
          <button
            onClick={handleTestConnection}
            disabled={testing || !active}
            className="glass-button-secondary disabled:opacity-40"
          >
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </button>
          
          <div className="flex gap-3">
            <button onClick={onClose} className="glass-button-secondary">
              Cancel
            </button>
            <button onClick={handleSave} className="glass-button-primary">
              Save Config
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
