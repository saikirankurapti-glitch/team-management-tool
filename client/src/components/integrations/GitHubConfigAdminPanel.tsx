import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Check, Copy, RefreshCw, AlertCircle, Sparkles, Key, Info } from 'lucide-react';
import { fetchApi } from '../../services/api';


interface GitHubConfigData {
  configured: boolean;
  source: 'DATABASE' | 'ENVIRONMENT' | 'NONE';
  clientId: string;
  hasClientSecret: boolean;
  hasWebhookSecret: boolean;
  callbackUrl: string;
  webhookUrl: string;
  status: string;
}

export const GitHubConfigAdminPanel: React.FC<{ onConfigSaved?: () => void }> = ({ onConfigSaved }) => {
  const [config, setConfig] = useState<GitHubConfigData | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');

  const [isEditingClientSecret, setIsEditingClientSecret] = useState(false);
  const [isEditingWebhookSecret, setIsEditingWebhookSecret] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetchApi<{
        success: boolean;
        configured: boolean;
        source: 'DATABASE' | 'ENVIRONMENT' | 'NONE';
        clientId: string;
        hasClientSecret: boolean;
        hasWebhookSecret: boolean;
        callbackUrl: string;
        webhookUrl: string;
        status: string;
      }>('/integrations/github/config');

      if (res.success) {
        setConfig(res);
        setClientId(res.clientId || '');
        setCallbackUrl(res.callbackUrl || `${window.location.origin}/auth/github/callback`);
        setIsEditingClientSecret(!res.hasClientSecret);
        setIsEditingWebhookSecret(!res.hasWebhookSecret);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load GitHub configuration.' });
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
        callbackUrl: callbackUrl.trim(),
      };

      if (isEditingClientSecret && clientSecret) {
        payload.clientSecret = clientSecret.trim();
      }

      if (isEditingWebhookSecret) {
        payload.webhookSecret = webhookSecret.trim();
      }

      const res = await fetchApi<any>('/integrations/github/config', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message || 'GitHub configuration saved and validated successfully!' });
        setClientSecret('');
        setWebhookSecret('');
        loadConfig();
        if (onConfigSaved) onConfigSaved();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Failed to save configuration.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save configuration.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setFeedback(null);

    try {
      const res = await fetchApi<any>('/integrations/github/config/test', {
        method: 'POST',
      });

      if (res.success && res.valid) {
        if (res.status === 'CONNECTED') {
          setFeedback({
            type: 'success',
            message: res.message || `GitHub API connection active. Authenticated account: @${res.details?.authenticatedAccount || 'User'}`,
          });
        } else {
          setFeedback({
            type: 'info',
            message: res.message || 'GitHub OAuth configuration is valid. User authorization is required.',
          });
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.message || 'GitHub connection test failed.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'GitHub API connection test failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-xs font-mono text-slate-400">Loading GitHub configuration...</div>;
  }

  const defaultCallback = `${window.location.origin}/auth/github/callback`;
  const defaultWebhookUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port || '5000'}/api/webhooks/github`;

  return (
    <div className="ent-panel p-5 space-y-4 border border-blue-500/30 bg-slate-950/70 shadow-lg select-none">
      {/* Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Settings className="w-4 h-4 text-blue-400" />
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              GitHub OAuth & Webhook Application Setup
            </h3>
            <p className="text-[11px] text-slate-400">
              Configure Organization Client Credentials & Webhooks (Admin Settings)
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

      <form onSubmit={handleSave} className="space-y-4">
        {/* OAuth Section */}
        <div className="space-y-3">
          <div className="text-[11px] font-bold text-blue-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Key className="w-3.5 h-3.5" />
            <span>GitHub OAuth Application</span>
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
                placeholder="e.g. Ov23li9X1abc234def56"
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
                    placeholder="Paste GitHub OAuth Client Secret"
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

          {/* Callback URL with Copy Button */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              OAuth Callback URL (Required in GitHub App settings)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={callbackUrl || defaultCallback}
                className="ent-input w-full font-mono text-xs bg-slate-900/80 text-blue-300 border-slate-800"
              />
              <button
                type="button"
                onClick={() => handleCopy(callbackUrl || defaultCallback, 'callback')}
                className="ent-btn-secondary flex items-center space-x-1 px-3 py-1.5 shrink-0 text-xs"
              >
                {copiedField === 'callback' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'callback' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Webhook Section */}
        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>GitHub Webhook Configuration</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Webhook Payload URL */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Webhook Payload URL (Target for GitHub Webhooks)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={config?.webhookUrl || defaultWebhookUrl}
                  className="ent-input w-full font-mono text-xs bg-slate-900/80 text-purple-300 border-slate-800"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(config?.webhookUrl || defaultWebhookUrl, 'webhook')}
                  className="ent-btn-secondary flex items-center space-x-1 px-3 py-1.5 shrink-0 text-xs"
                >
                  {copiedField === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedField === 'webhook' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Webhook Secret */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Webhook Secret (Optional HMAC SHA256 Signature Verification)
              </label>
              {!isEditingWebhookSecret && config?.hasWebhookSecret ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    disabled
                    value="••••••••••••••••••••••••••••••••"
                    className="ent-input w-full font-mono text-xs bg-slate-900/60 text-slate-400 cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingWebhookSecret(true)}
                    className="ent-btn-secondary text-xs px-2.5 py-1.5 shrink-0"
                  >
                    Update Secret
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <input
                    type="password"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="Enter Webhook Secret"
                    className="ent-input w-full font-mono text-xs"
                  />
                  {config?.hasWebhookSecret && (
                    <button
                      type="button"
                      onClick={() => setIsEditingWebhookSecret(false)}
                      className="text-xs text-slate-400 hover:text-slate-200 px-2 shrink-0"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[10px] text-slate-500 font-mono">
            Secrets are encrypted at rest with AES-256-CBC and never rendered on frontend APIs.
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !config?.configured}
              className="ent-btn-secondary flex items-center space-x-1 text-xs px-3 py-1.5"
            >
              {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
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
