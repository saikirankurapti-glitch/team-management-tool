import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Check, Copy, RefreshCw, AlertCircle, Key, Info, ExternalLink, Globe } from 'lucide-react';
import { fetchApi } from '../../services/api';

interface GoogleConfigData {
  configured: boolean;
  source: 'DATABASE' | 'ENVIRONMENT' | 'NONE';
  clientId: string;
  hasClientSecret: boolean;
  redirectUri: string;
  isEnabled: boolean;
}

export const GoogleConfigAdminPanel: React.FC<{ onConfigSaved?: () => void }> = ({ onConfigSaved }) => {
  const [config, setConfig] = useState<GoogleConfigData | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');

  const [isEditingClientSecret, setIsEditingClientSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetchApi<{
        configured: boolean;
        source: 'DATABASE' | 'ENVIRONMENT' | 'NONE';
        clientId: string;
        hasClientSecret: boolean;
        redirectUri: string;
        isEnabled: boolean;
      }>('/integrations/google/config');

      setConfig(res);
      setClientId(res.clientId || '');
      setRedirectUri(res.redirectUri || `${window.location.origin}/auth/google/callback`);
      setIsEditingClientSecret(!res.hasClientSecret);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load Google configuration.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const payload: any = {
        clientId: clientId.trim(),
        redirectUri: redirectUri.trim(),
        isEnabled: true,
      };

      if (isEditingClientSecret && clientSecret) {
        payload.clientSecret = clientSecret.trim();
      }

      const res = await fetchApi<any>('/integrations/google/config', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setFeedback({ type: 'success', message: res.message || 'Google Workspace configuration saved successfully!' });
      setClientSecret('');
      loadConfig();
      if (onConfigSaved) onConfigSaved();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save Google configuration.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setFeedback(null);

    try {
      const res = await fetchApi<any>('/integrations/google/config/test', {
        method: 'POST',
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Google Workspace OAuth configuration is valid and active!',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Google Workspace connection test failed.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Google Workspace connection test failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-xs font-mono text-slate-400">Loading Google Workspace configuration...</div>;
  }

  const defaultCallback = `${window.location.origin}/auth/google/callback`;

  return (
    <div className="ent-panel p-5 space-y-4 border border-rose-500/30 bg-slate-950/70 shadow-lg select-none">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Settings className="w-4 h-4 text-rose-400" />
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Google Workspace Integration (Calendar, Meet & Drive)
            </h3>
            <p className="text-[11px] text-slate-400">
              Configure Organization OAuth 2.0 Credentials (Admin Settings)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
              config?.configured ? 'badge-green' : 'badge-amber'
            }`}
          >
            {config?.configured ? `CONFIGURED (${config.source})` : 'NOT CONFIGURED'}
          </span>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded text-xs flex items-start space-x-2 font-mono ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : feedback.type === 'info'
              ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : feedback.type === 'info' ? (
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Setup Guide Accordion/Box */}
      <div className="bg-slate-900/60 border border-slate-800 rounded p-3 text-[11px] space-y-2 text-slate-300">
        <div className="flex items-center justify-between font-bold text-slate-200">
          <span className="flex items-center space-x-1.5 text-rose-400">
            <Globe className="w-3.5 h-3.5" />
            <span>Google Cloud Console Setup Requirements</span>
          </span>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
          >
            <span>Google Cloud Credentials</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <ol className="list-decimal list-inside space-y-1 text-slate-400 font-mono text-[10px]">
          <li>Enable <strong>Google Calendar API</strong> and <strong>Google Drive API</strong> in Google Cloud Console.</li>
          <li>Configure OAuth consent screen with scopes: <code>openid</code>, <code>email</code>, <code>profile</code>, <code>calendar.events</code>, <code>drive.file</code>.</li>
          <li>Create an <strong>OAuth 2.0 Client ID</strong> (Web Application).</li>
          <li>Add <code>{redirectUri || defaultCallback}</code> to <strong>Authorized redirect URIs</strong>.</li>
        </ol>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* OAuth Credentials */}
        <div className="space-y-3">
          <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Key className="w-3.5 h-3.5" />
            <span>Google OAuth 2.0 Credentials</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Client ID */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Client ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                className="ent-input w-full font-mono text-xs"
              />
            </div>

            {/* Client Secret */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Client Secret <span className="text-rose-400">*</span>
              </label>
              {!isEditingClientSecret && config?.hasClientSecret ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    disabled
                    value="••••••••••••••••••••••••••••••••"
                    className="ent-input w-full font-mono text-xs bg-slate-900/60 text-slate-400 cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingClientSecret(true)}
                    className="ent-btn-secondary text-xs px-2.5 py-1.5 shrink-0"
                  >
                    Update Secret
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="password"
                    required={!config?.hasClientSecret}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Paste Google OAuth Client Secret"
                    className="ent-input w-full font-mono text-xs"
                  />
                  {config?.hasClientSecret && (
                    <button
                      type="button"
                      onClick={() => setIsEditingClientSecret(false)}
                      className="text-xs text-slate-400 hover:text-slate-200 px-2 shrink-0"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Callback / Redirect URL */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Authorized Redirect URI (Must match Google Cloud Console)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={redirectUri || defaultCallback}
                className="ent-input w-full font-mono text-xs bg-slate-900/80 text-rose-300 border-slate-800"
              />
              <button
                type="button"
                onClick={() => handleCopy(redirectUri || defaultCallback, 'redirect')}
                className="ent-btn-secondary flex items-center space-x-1 px-3 py-1.5 shrink-0 text-xs"
              >
                {copiedField === 'redirect' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'redirect' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[10px] text-slate-500 font-mono">
            Encrypted with AES-256-CBC at rest. Never shared outside your organization.
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !config?.configured}
              className="ent-btn-secondary flex items-center space-x-1 text-xs px-3 py-1.5"
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isTesting ? 'Testing...' : 'Test Configuration'}</span>
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="ent-btn-primary flex items-center space-x-1 text-xs px-4 py-1.5"
            >
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
