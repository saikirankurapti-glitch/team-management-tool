import React, { useState, useEffect } from 'react';
import { Shield, GitCommit, Sliders, CheckSquare, History, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { fetchApi } from '../services/api';

export const GovernancePage: React.FC = () => {
  const [tab, setTab] = useState<'WORKFLOWS' | 'FIELDS' | 'APPROVALS' | 'HEALTH'>('WORKFLOWS');
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [customData, setCustomData] = useState<any>(null);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = () => {
    Promise.all([
      fetchApi<any[]>('/v1/workflows'),
      fetchApi<any>('/v1/custom-fields'),
      fetchApi<any[]>('/v1/approvals'),
      fetchApi<any>('/v1/governance/health'),
    ])
      .then(([wfData, cfData, appData, hData]) => {
        setWorkflows(wfData);
        setCustomData(cfData);
        setApprovals(appData);
        setHealthData(hData);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) {
    return <div className="p-6 text-xs font-mono text-slate-400">Loading Governance Center...</div>;
  }

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full text-xs">
      {/* Header Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-blue-500" />
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Enterprise Governance Control Center
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Workflow schemes, custom field registries, approval chains, and health rules
            </p>
          </div>
        </div>

        {healthData && (
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${healthData.health === 'EXCELLENT' ? 'badge-green' : 'badge-amber'}`}>
            Config Health: {healthData.health}
          </span>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="ent-toolbar flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium">
        <button
          onClick={() => setTab('WORKFLOWS')}
          className={`px-3 py-1 rounded transition-colors flex items-center space-x-1 ${
            tab === 'WORKFLOWS' ? 'bg-blue-600/15 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span>Workflows ({workflows.length})</span>
        </button>

        <button
          onClick={() => setTab('FIELDS')}
          className={`px-3 py-1 rounded transition-colors flex items-center space-x-1 ${
            tab === 'FIELDS' ? 'bg-blue-600/15 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Custom Fields ({customData?.fields?.length || 0})</span>
        </button>

        <button
          onClick={() => setTab('APPROVALS')}
          className={`px-3 py-1 rounded transition-colors flex items-center space-x-1 ${
            tab === 'APPROVALS' ? 'bg-blue-600/15 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Approvals ({approvals.length})</span>
        </button>

        <button
          onClick={() => setTab('HEALTH')}
          className={`px-3 py-1 rounded transition-colors flex items-center space-x-1 ${
            tab === 'HEALTH' ? 'bg-blue-600/15 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Health Rules</span>
        </button>
      </div>

      {/* Tab Panels */}
      {tab === 'WORKFLOWS' && (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <div key={wf.id} className="p-3 ent-card space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{wf.name}</span>
                  <span className="text-[10px] text-slate-500 block">{wf.description}</span>
                </div>
                {wf.isDefault && <span className="badge-blue text-[9px] font-mono font-bold px-1.5 py-0.2 rounded">DEFAULT</span>}
              </div>

              <div className="flex items-center space-x-1.5 pt-1">
                {wf.statuses?.map((st: any) => (
                  <span key={st.id} className="px-1.5 py-0.2 rounded font-mono text-[9px]" style={{ backgroundColor: `${st.color}15`, color: st.color, border: `1px solid ${st.color}30` }}>
                    {st.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'FIELDS' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {customData?.fields?.map((f: any) => (
            <div key={f.id} className="p-3 ent-card space-y-1 font-mono">
              <span className="font-bold text-slate-800 dark:text-slate-200 font-sans block">{f.name}</span>
              <span className="text-[10px] text-blue-500 block">Type: {f.fieldType}</span>
              <span className="text-[9px] text-slate-500 block">Key: {f.fieldKey}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'APPROVALS' && (
        <div className="space-y-2">
          {approvals.map((app) => (
            <div key={app.id} className="p-3 ent-card flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">{app.title}</span>
                <span className="text-[10px] text-slate-500 block">By {app.requester?.fullName}</span>
              </div>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${app.status === 'APPROVED' ? 'badge-green' : 'badge-amber'}`}>
                {app.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'HEALTH' && (
        <div className="ent-panel p-4 space-y-2">
          <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 block">
            Configuration Integrity Rules
          </span>
          {healthData?.warnings?.length === 0 ? (
            <div className="p-2.5 badge-green rounded flex items-center font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> All workflow state transitions valid!
            </div>
          ) : (
            healthData?.warnings?.map((w: string, idx: number) => (
              <div key={idx} className="p-2.5 badge-amber rounded flex items-center font-mono">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> {w}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
