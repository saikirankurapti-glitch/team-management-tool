import React, { useState, useEffect } from 'react';
import { GitBranch, GitPullRequest, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, ShieldCheck, Database, Server } from 'lucide-react';
import { fetchApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { GitHubConfigAdminPanel } from '../components/integrations/GitHubConfigAdminPanel';
import { GoogleConfigAdminPanel } from '../components/integrations/GoogleConfigAdminPanel';
import { GoogleConnectionPanel } from '../components/integrations/GoogleConnectionPanel';

export const IntegrationsPage: React.FC = () => {
  const [githubStatus, setGithubStatus] = useState<any>({ connected: false, status: 'DISCONNECTED' });
  const [configStatus, setConfigStatus] = useState<any>({ configured: false });
  const [repositories, setRepositories] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);
  const [pullRequests, setPullRequests] = useState<any[]>([]);
  const [eventLogs, setEventLogs] = useState<any[]>([]);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const [ghStatus, cfgStatus, logs, health] = await Promise.all([
        fetchApi<any>('/integrations/github/status').catch(() => ({ connected: false, status: 'DISCONNECTED' })),
        fetchApi<any>('/integrations/github/config').catch(() => ({ configured: false })),
        fetchApi<any[]>('/integrations/logs').catch(() => []),
        fetchApi<any>('/health/deps').catch(() => null),
      ]);

      setGithubStatus(ghStatus);
      setConfigStatus(cfgStatus);
      setEventLogs(logs);
      setHealthStatus(health);

      if (ghStatus.connected) {
        const repos = await fetchApi<any[]>('/integrations/github/repos').catch(() => []);
        setRepositories(repos);
        if (repos.length > 0) {
          setSelectedRepo(repos[0].fullName);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load integration data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedRepo && githubStatus.connected) {
      const [owner, repo] = selectedRepo.split('/');
      if (owner && repo) {
        Promise.all([
          fetchApi<any[]>(`/integrations/github/repos/${owner}/${repo}/branches`).catch(() => []),
          fetchApi<any[]>(`/integrations/github/repos/${owner}/${repo}/pulls`).catch(() => []),
        ]).then(([bData, prData]) => {
          setBranches(bData);
          setPullRequests(prData);
        });
      }
    }
  }, [selectedRepo, githubStatus.connected]);

  const { user } = useAuth();
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const handleConnectGitHub = async () => {
    try {
      setErrorMsg('');
      const res = await fetchApi<any>('/integrations/github/auth');
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        if (isAdmin && (res.adminMessage || res.error?.adminMessage)) {
          setErrorMsg(res.adminMessage || res.error?.adminMessage || 'GitHub OAuth Not configured. Missing: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET');
        } else {
          setErrorMsg(res.message || res.error?.message || 'GitHub connection is temporarily unavailable. Please contact your administrator.');
        }
      }
    } catch (err: any) {
      if (isAdmin) {
        setErrorMsg('GitHub OAuth Not configured. Missing: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET');
      } else {
        setErrorMsg('GitHub connection is temporarily unavailable. Please contact your administrator.');
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetchApi('/integrations/github/disconnect', { method: 'DELETE' });
      setRepositories([]);
      setBranches([]);
      setPullRequests([]);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="editorial-eyebrow">[ INTEGRATIONS ]</div>
        <div className="text-xl font-bold tracking-tight text-ink">Verifying developer connections & OAuth scopes...</div>
        <div className="h-64 bg-surface border border-borderWarm rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Calculate truthful webhook status
  const webhookStatusText = eventLogs.length > 0 ? 'ACTIVE' : configStatus.hasWebhookSecret ? 'CONFIGURED' : 'NOT CONFIGURED';
  const webhookStatusClass = eventLogs.length > 0 ? 'text-emerald-600 dark:text-emerald-400' : configStatus.hasWebhookSecret ? 'text-olive' : 'text-ink/50';

  const githubApiStatusText = githubStatus.connected ? 'ACTIVE' : configStatus.configured ? 'CONFIGURED' : 'NOT CONFIGURED';
  const githubApiStatusClass = githubStatus.connected ? 'text-emerald-600 dark:text-emerald-400' : configStatus.configured ? 'text-olive' : 'text-ink/50';

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Editorial Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-borderWarm">
        <div>
          <div className="editorial-eyebrow mb-1.5">[ EXTENSIONS & ECOSYSTEM ]</div>
          <h1 className="editorial-headline text-2xl md:text-3xl font-black text-ink">
            Integrations & Cloud Ecosystem
          </h1>
          <p className="text-xs text-ink/65 max-w-2xl font-sans mt-1">
            Real-time GitHub OAuth, Google Calendar, Google Meet & Drive sync, pull request hooks, and webhook audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2 text-ink/65 hover:text-ink bg-surface border border-borderWarm rounded-full hover:border-olive transition-colors"
            title="Refresh Telemetry"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {!githubStatus.connected ? (
            <button
              onClick={handleConnectGitHub}
              className="btn-pill-primary flex items-center space-x-1.5 py-2 px-4 shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Connect GitHub</span>
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-500/30 rounded-full text-xs font-bold transition-all"
            >
              Disconnect Account
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-700 dark:text-amber-300 font-mono text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Admin GitHub OAuth & Webhook Configuration Panel */}
      {isAdmin && <GitHubConfigAdminPanel onConfigSaved={loadData} />}

      {/* Admin Google Workspace Configuration Panel */}
      {isAdmin && <GoogleConfigAdminPanel onConfigSaved={loadData} />}

      {/* Google Account Connection Panel (all users) */}
      <GoogleConnectionPanel onConnectionChange={loadData} />

      {/* Integration Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* GitHub Connection Card */}
        <div className="ent-panel p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <GitPullRequest className="w-4 h-4 text-blue-500" />
              <span className="font-bold text-slate-900 dark:text-slate-100">GitHub Connection</span>
            </div>
            <span
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                githubStatus.connected
                  ? 'badge-green'
                  : githubStatus.status === 'AUTHENTICATION_REQUIRED'
                  ? 'badge-red'
                  : githubStatus.status === 'RATE_LIMITED' || githubStatus.status === 'FORBIDDEN'
                  ? 'badge-amber'
                  : configStatus.configured
                  ? 'badge-blue'
                  : 'badge-red'
              }`}
            >
              {githubStatus.connected
                ? 'CONNECTED'
                : githubStatus.status === 'AUTHENTICATION_REQUIRED'
                ? 'RECONNECT REQUIRED'
                : githubStatus.status === 'RATE_LIMITED'
                ? 'RATE LIMITED'
                : githubStatus.status === 'FORBIDDEN'
                ? 'FORBIDDEN'
                : configStatus.configured
                ? 'CONFIGURED'
                : 'NOT CONFIGURED'}
            </span>
          </div>

          <div className="space-y-1 text-[11px] font-mono">
            <div>
              OAuth App:{' '}
              <span className="text-slate-800 dark:text-slate-200 font-semibold">
                {configStatus.configured ? `Configured (${configStatus.source || 'DB'})` : 'Not Configured'}
              </span>
            </div>
            <div>
              Account:{' '}
              <span className="text-slate-800 dark:text-slate-200 font-semibold">
                {githubStatus.githubLogin ? `@${githubStatus.githubLogin}` : 'Not Connected'}
              </span>
            </div>
            <div>
              Repositories:{' '}
              <span className="text-slate-800 dark:text-slate-200 font-semibold">
                {githubStatus.connected ? repositories.length : 0}
              </span>
            </div>
            {githubStatus.message && !githubStatus.connected && (
              <div className="text-[10px] text-amber-400 font-sans pt-1">
                {githubStatus.message}
              </div>
            )}
            {githubStatus.lastValidatedAt && (
              <div className="text-[10px] text-slate-400">
                Validated: {new Date(githubStatus.lastValidatedAt).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Integration Health Matrix */}
        <div className="ent-panel p-4 space-y-3 col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-slate-900 dark:text-slate-100">System Integration Health</span>
            </div>
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
                configStatus.configured ? 'badge-green' : 'badge-amber'
              }`}
            >
              {configStatus.configured ? 'CONFIGURED' : 'SETUP REQUIRED'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="p-2 bg-slate-900/40 rounded border border-slate-800 flex items-center space-x-2">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <div>
                <div className="text-slate-400 text-[10px]">Database</div>
                <div className="font-bold text-emerald-400">{healthStatus?.dependencies?.database || 'UP'}</div>
              </div>
            </div>

            <div className="p-2 bg-slate-900/40 rounded border border-slate-800 flex items-center space-x-2">
              <GitBranch className="w-3.5 h-3.5 text-purple-400" />
              <div>
                <div className="text-slate-400 text-[10px]">GitHub API</div>
                <div className={`font-bold ${githubApiStatusClass}`}>{githubApiStatusText}</div>
              </div>
            </div>

            <div className="p-2 bg-slate-900/40 rounded border border-slate-800 flex items-center space-x-2">
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <div className="text-slate-400 text-[10px]">Webhooks</div>
                <div className={`font-bold ${webhookStatusClass}`}>{webhookStatusText}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Repositories & Telemetry */}
      {githubStatus.connected && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Repos Selector & Branch List */}
          <div className="ent-panel p-3.5 space-y-3">
            <div className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Repositories ({repositories.length})
            </div>
            <select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="ent-input w-full text-xs font-mono"
            >
              {repositories.map((r) => (
                <option key={r.id} value={r.fullName}>
                  {r.fullName} ({r.defaultBranch})
                </option>
              ))}
            </select>

            <div className="pt-2 space-y-1">
              <div className="font-bold text-[10px] uppercase text-slate-500">Live Branches ({branches.length})</div>
              <div className="divide-y divide-slate-800 max-h-40 overflow-y-auto">
                {branches.map((b) => (
                  <div key={b.name} className="py-1 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-300 font-semibold">{b.name}</span>
                    <span className="text-slate-500 text-[9px]">{b.commitSha.substring(0, 7)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pull Requests */}
          <div className="ent-panel p-3.5 space-y-3 col-span-2">
            <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
              <span>Pull Requests ({pullRequests.length})</span>
              <span className="text-[10px] font-mono text-slate-500">{selectedRepo}</span>
            </div>
            <div className="divide-y divide-slate-800 max-h-60 overflow-y-auto">
              {pullRequests.map((pr) => (
                <div key={pr.number} className="py-2 flex items-center justify-between text-[11px]">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-200 flex items-center space-x-2">
                      <span className="text-blue-400 font-mono font-bold">#{pr.number}</span>
                      <a href={pr.url} target="_blank" rel="noreferrer" className="hover:underline flex items-center">
                        {pr.title} <ExternalLink className="w-3 h-3 ml-1 text-slate-400" />
                      </a>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {pr.author} • {pr.headBranch} → {pr.baseBranch}
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                      pr.state === 'MERGED'
                        ? 'badge-purple'
                        : pr.state === 'OPEN'
                        ? 'badge-green'
                        : 'badge-amber'
                    }`}
                  >
                    {pr.state}
                  </span>
                </div>
              ))}
              {pullRequests.length === 0 && (
                <div className="p-4 text-center text-slate-500 italic text-[11px]">
                  No pull requests found for {selectedRepo}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Webhook Event Logs Table */}
      <div className="ent-panel overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
          Validated Webhook Delivery Audit
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-48 overflow-y-auto">
          {eventLogs.map((log) => (
            <div key={log.id} className="p-2.5 ent-table-row flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <div>
                  <span className="font-mono text-[10px] font-bold text-blue-500 mr-2">[{log.provider}]</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{log.eventType}</span>
                </div>
              </div>
              <span className="font-mono text-[10px] text-slate-500">
                {new Date(log.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {eventLogs.length === 0 && (
            <div className="p-4 text-center text-slate-500 italic">No webhook events logged yet.</div>
          )}
        </div>
      </div>
    </div>
  );
};
