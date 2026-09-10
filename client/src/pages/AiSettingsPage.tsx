import React, { useState, useEffect } from 'react';
import { Bot, Shield, CheckCircle2 } from 'lucide-react';
import { fetchApi } from '../services/api';

export const AiSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApi<any>('/copilot/settings'),
      fetchApi<any[]>('/copilot/logs'),
    ])
      .then(([setData, logData]) => {
        setSettings(setData);
        setLogs(logData);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="p-6 text-xs font-mono text-slate-400">Loading AI Settings...</div>;
  }

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full text-xs">
      {/* Header Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-blue-500" />
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              AI Copilot Governance & Control Settings
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Model parameters, token budgets, human-in-the-loop confirmation gates, and prompt audit logs
            </p>
          </div>
        </div>
      </div>

      {/* Governance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
        <div className="ent-card p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span>Provider & Model</span>
            <span className="badge-green text-[9px] font-bold px-1.5 py-0.2 rounded">ACTIVE</span>
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{settings?.provider || 'OpenAI / Azure'}</div>
          <div className="text-[10px] text-blue-500">{settings?.model || 'gpt-4o'}</div>
        </div>

        <div className="ent-card p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span>Monthly Token Budget</span>
            <span className="text-[10px] font-bold text-blue-500">Limits</span>
          </div>
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {settings?.currentUsage || 450} / {settings?.monthlyUsageLimit || 10000}
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded overflow-hidden">
            <div className="bg-blue-600 h-full w-[15%]" />
          </div>
        </div>

        <div className="ent-card p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-500 font-sans">
            <span>Confirmation Gate</span>
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-[10px] text-slate-500 font-sans leading-tight">
            All AI mutations require explicit human review & confirmation.
          </p>
        </div>
      </div>

      {/* AI Audit Logs Table */}
      <div className="ent-panel overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
          AI Copilot Execution Audit Logs
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="p-2.5 ent-table-row flex items-center justify-between font-mono">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-sans mr-2">[{log.user?.fullName}]</span>
                  <span className="text-blue-500 text-[11px]">{log.prompt}</span>
                  {log.toolInvoked && <span className="text-slate-500 text-[10px] ml-2">(Tool: {log.toolInvoked})</span>}
                </div>
              </div>
              <span className="text-[10px] text-slate-500">
                {new Date(log.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {logs.length === 0 && <div className="p-4 text-center text-slate-500 italic">No AI execution logs recorded yet.</div>}
        </div>
      </div>
    </div>
  );
};
