import React, { useState, useEffect } from 'react';
import { Code, Play } from 'lucide-react';
import { fetchApi } from '../services/api';

export const DeveloperAppsPage: React.FC = () => {
  const [apps, setApps] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [appName, setAppName] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [createdSecret, setCreatedSecret] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = () => {
    Promise.all([
      fetchApi<any[]>('/v1/oauth/apps'),
      fetchApi<any[]>('/v1/webhooks'),
    ])
      .then(([appData, whData]) => {
        setApps(appData);
        setWebhooks(whData);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetchApi<any>('/v1/oauth/apps', {
        method: 'POST',
        body: JSON.stringify({
          name: appName,
          redirectUri,
          scopes: ['projects:read', 'work_items:write'],
        }),
      });
      setCreatedSecret(res.clientSecret);
      setAppName('');
      setRedirectUri('');
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      await fetchApi(`/v1/webhooks/${webhookId}/test`, { method: 'POST' });
      alert('Test event dispatched successfully! Check webhook delivery logs.');
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-xs font-mono text-slate-400">Loading Developer Apps...</div>;
  }

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full text-xs">
      {/* Header Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Code className="w-4 h-4 text-blue-500" />
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Developer Apps & OAuth Credentials
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Register OAuth applications, manage client secrets, and test webhook dispatches
            </p>
          </div>
        </div>
      </div>

      {createdSecret && (
        <div className="p-3 badge-amber rounded space-y-1 font-mono">
          <div className="font-bold text-amber-500">OAuth Client Secret Generated:</div>
          <div className="p-2 bg-slate-900 text-slate-200 rounded font-bold">{createdSecret}</div>
          <span className="text-[10px] text-slate-400">Copy secret immediately.</span>
        </div>
      )}

      {/* Register App Form */}
      <div className="ent-panel p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          Register New OAuth App
        </h3>
        <form onSubmit={handleCreateApp} className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            required
            placeholder="App Name (e.g. GitHub Sync Bot)"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="ent-input"
          />
          <input
            type="url"
            required
            placeholder="Redirect URI (e.g. https://app.com/callback)"
            value={redirectUri}
            onChange={(e) => setRedirectUri(e.target.value)}
            className="ent-input"
          />
          <button type="submit" className="ent-btn-primary">
            Register Application
          </button>
        </form>
      </div>

      {/* OAuth Apps Table */}
      <div className="ent-panel overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
          Registered Developer Applications
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {apps.map((app) => (
            <div key={app.id} className="p-2.5 ent-table-row flex items-center justify-between font-mono">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 font-sans">{app.name}</span>
                <span className="text-[10px] text-slate-500 block">Client ID: {app.clientId}</span>
              </div>
              <span className="badge-green text-[9px] font-bold px-1.5 py-0.2 rounded uppercase">
                {app.status}
              </span>
            </div>
          ))}
          {apps.length === 0 && <div className="p-4 text-center text-slate-500 italic">No apps registered</div>}
        </div>
      </div>

      {/* Webhooks Table */}
      <div className="ent-panel overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
          Active Outbound Webhooks
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {webhooks.map((wh) => (
            <div key={wh.id} className="p-2.5 ent-table-row flex items-center justify-between font-mono">
              <span className="font-semibold text-blue-500">{wh.url}</span>
              <button
                onClick={() => handleTestWebhook(wh.id)}
                className="ent-btn-secondary h-6 text-[10px] flex items-center space-x-1"
              >
                <Play className="w-3 h-3" />
                <span>Test Event</span>
              </button>
            </div>
          ))}
          {webhooks.length === 0 && <div className="p-4 text-center text-slate-500 italic">No webhooks registered</div>}
        </div>
      </div>
    </div>
  );
};
