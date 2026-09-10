import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, ExternalLink, Unplug, RefreshCw, Calendar, HardDrive, Video, Loader2 } from 'lucide-react';
import { fetchApi } from '../../services/api';

interface GoogleConnectionStatus {
  connected: boolean;
  id?: string;
  googleEmail?: string;
  googleUserId?: string;
  status?: string;
  scope?: string;
  lastValidatedAt?: string;
  tokenExpiry?: string;
}

export const GoogleConnectionPanel: React.FC<{ onConnectionChange?: () => void }> = ({ onConnectionChange }) => {
  const [connectionStatus, setConnectionStatus] = useState<GoogleConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const loadConnectionStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetchApi<GoogleConnectionStatus>('/integrations/google/status');
      setConnectionStatus(res);
    } catch (err: any) {
      setConnectionStatus({ connected: false });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConnectionStatus();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    setFeedback(null);
    try {
      const res = await fetchApi<{ authUrl: string }>('/integrations/google/auth');
      if (res.authUrl) {
        window.location.href = res.authUrl;
      } else {
        setFeedback({ type: 'error', message: 'Failed to generate Google authorization URL. Please ensure Google OAuth is configured.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to connect Google account. Ensure Google OAuth credentials are configured in Settings.' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setFeedback(null);
    try {
      await fetchApi('/integrations/google/disconnect', { method: 'DELETE' });
      setConnectionStatus({ connected: false });
      setFeedback({ type: 'info', message: 'Google account disconnected successfully.' });
      if (onConnectionChange) onConnectionChange();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to disconnect Google account.' });
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-xs font-mono text-slate-400">Checking Google connection status...</div>;
  }

  const isConnected = connectionStatus?.connected === true;
  const isReauthRequired = connectionStatus?.status === 'REAUTH_REQUIRED';
  const tokenExpiry = connectionStatus?.tokenExpiry ? new Date(connectionStatus.tokenExpiry) : null;
  const isTokenExpired = tokenExpiry ? tokenExpiry.getTime() < Date.now() : false;

  const scopeList = connectionStatus?.scope?.split(' ').filter(Boolean) || [];
  const hasCalendarScope = scopeList.some(s => s.includes('calendar'));
  const hasDriveScope = scopeList.some(s => s.includes('drive'));

  return (
    <div className="ent-panel p-5 space-y-4 border border-blue-500/30 bg-slate-950/70 shadow-lg select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Google Account Connection
            </h3>
            <p className="text-[11px] text-slate-400">
              Connect your personal Google account for Calendar, Meet & Drive
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
              isConnected && !isReauthRequired && !isTokenExpired
                ? 'badge-green'
                : isReauthRequired || isTokenExpired
                ? 'badge-amber'
                : 'badge-red'
            }`}
          >
            {isConnected && !isReauthRequired && !isTokenExpired
              ? 'CONNECTED'
              : isReauthRequired
              ? 'RE-AUTH REQUIRED'
              : isTokenExpired
              ? 'TOKEN EXPIRED'
              : 'NOT CONNECTED'}
          </span>
        </div>
      </div>

      {/* Feedback */}
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
          {feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {isConnected ? (
        <>
          {/* Connected State */}
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Google Account Connected</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                <div>
                  <div className="text-slate-400 text-[10px]">Google Email</div>
                  <div className="text-slate-200 font-semibold">{connectionStatus?.googleEmail || '—'}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Last Validated</div>
                  <div className="text-slate-200 font-semibold">
                    {connectionStatus?.lastValidatedAt
                      ? new Date(connectionStatus.lastValidatedAt).toLocaleString()
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Token Expiry</div>
                  <div className={`font-semibold ${isTokenExpired ? 'text-amber-400' : 'text-slate-200'}`}>
                    {tokenExpiry ? tokenExpiry.toLocaleString() : '—'}
                    {isTokenExpired && ' (Expired)'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px]">Status</div>
                  <div className={`font-semibold ${isReauthRequired ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {connectionStatus?.status || 'CONNECTED'}
                  </div>
                </div>
              </div>

              {/* Scope Badges */}
              <div className="flex items-center space-x-2 pt-1 border-t border-emerald-500/20">
                <span className="text-[10px] text-slate-400 font-mono">Scopes:</span>
                {hasCalendarScope && (
                  <span className="flex items-center space-x-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300">
                    <Calendar className="w-3 h-3" />
                    <span>Calendar</span>
                  </span>
                )}
                {hasDriveScope && (
                  <span className="flex items-center space-x-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300">
                    <HardDrive className="w-3 h-3" />
                    <span>Drive</span>
                  </span>
                )}
                <span className="flex items-center space-x-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">
                  <Video className="w-3 h-3" />
                  <span>Meet</span>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-[10px] text-slate-500 font-mono">
                Tokens encrypted at rest with AES-256-CBC.
              </div>
              <div className="flex items-center space-x-2">
                {(isReauthRequired || isTokenExpired) && (
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="ent-btn-primary flex items-center space-x-1 text-xs px-3 py-1.5"
                  >
                    {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Re-authenticate</span>
                  </button>
                )}
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="ent-btn-danger flex items-center space-x-1 text-xs px-3 py-1.5"
                >
                  {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                  <span>{isDisconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Disconnected State */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="text-xs text-slate-300">
              Connect your Google account to enable:
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-slate-950/60 border border-slate-800 rounded flex items-center space-x-2 text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-300 font-semibold">Google Calendar</span>
              </div>
              <div className="p-2 bg-slate-950/60 border border-slate-800 rounded flex items-center space-x-2 text-[11px]">
                <Video className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-slate-300 font-semibold">Google Meet</span>
              </div>
              <div className="p-2 bg-slate-950/60 border border-slate-800 rounded flex items-center space-x-2 text-[11px]">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-300 font-semibold">Google Drive</span>
              </div>
            </div>

            <div className="text-[10px] text-slate-500 font-mono">
              Your credentials are exchanged directly with Google. We only store encrypted OAuth tokens.
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="ent-btn-primary flex items-center space-x-2 text-xs px-4 py-2 bg-blue-600 hover:bg-blue-500 border-blue-500"
            >
              {isConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              <span>{isConnecting ? 'Redirecting to Google...' : 'Connect Google Account'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
