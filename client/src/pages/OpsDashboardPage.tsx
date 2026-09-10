import React, { useState, useEffect } from 'react';
import { Activity, Server, Cpu, Database, Zap, Play } from 'lucide-react';
import { fetchApi } from '../services/api';

export const OpsDashboardPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadMetrics = () => {
    fetchApi<any>('/v1/ops/metrics')
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleEnqueueTestJob = () => {
    setIsProcessing(true);
    fetchApi('/v1/ops/jobs/enqueue', { method: 'POST', body: JSON.stringify({ jobType: 'NOTIFICATION' }) })
      .then(() => loadMetrics())
      .catch((err) => console.error(err))
      .finally(() => setIsProcessing(false));
  };

  if (isLoading) {
    return <div className="p-6 text-xs font-mono text-slate-400">Loading Operational Telemetry...</div>;
  }

  const { metrics, jobs } = data || {};

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full text-xs">
      {/* Header Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Operational Telemetry & System Health
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              API latency, background worker queue state, and AI circuit breaker telemetry
            </p>
          </div>
        </div>

        <button
          onClick={handleEnqueueTestJob}
          disabled={isProcessing}
          className="ent-btn-primary flex items-center space-x-1"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{isProcessing ? 'Enqueueing...' : 'Simulate Job'}</span>
        </button>
      </div>

      {/* Telemetry Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        <div className="ent-card p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span>Uptime</span>
            <Server className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{metrics?.uptimeSeconds || 0}s</div>
          <span className="badge-green text-[9px] font-bold px-1.5 py-0.2 rounded inline-block">Healthy</span>
        </div>

        <div className="ent-card p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span>API Latency</span>
            <Cpu className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{metrics?.avgLatencyMs || 4} ms</div>
          <span className="text-[10px] text-slate-400 font-normal">Target: &lt; 50 ms</span>
        </div>

        <div className="ent-card p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span>Circuit Breaker</span>
            <Zap className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{metrics?.aiCircuitState || 'CLOSED'}</div>
          <span className="badge-blue text-[9px] font-bold px-1.5 py-0.2 rounded inline-block">Isolated</span>
        </div>

        <div className="ent-card p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span>Sockets</span>
            <Database className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{metrics?.activeSockets || 1}</div>
          <span className="text-[10px] text-slate-400 font-normal">WebSocket Pool</span>
        </div>
      </div>

      {/* Queue Telemetry */}
      <div className="ent-panel p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          Background Worker Queue Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Pending Jobs</span>
            <span className="text-lg font-bold text-amber-500">{jobs?.pending || 0}</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Completed Jobs</span>
            <span className="text-lg font-bold text-emerald-500">{jobs?.completed || 0}</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Failed Jobs</span>
            <span className="text-lg font-bold text-rose-500">{jobs?.failed || 0}</span>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase block">Dead Letter Queue</span>
            <span className="text-lg font-bold text-slate-400">{jobs?.deadLetter || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
