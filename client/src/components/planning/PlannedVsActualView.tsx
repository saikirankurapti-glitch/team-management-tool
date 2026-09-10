import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { canAccessFinancials } from '../../utils/rbac';

interface PlannedVsActualViewProps {
  projectId: string;
}

export const PlannedVsActualView: React.FC<PlannedVsActualViewProps> = ({ projectId }) => {
  const { user } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canSeeCost = canAccessFinancials(user?.role);

  const loadVariance = () => {
    setIsLoading(true);
    fetchApi<any>(`/projects/${projectId}/variance`)
      .then((res) => setData(res))
      .catch((err) => console.error('Failed to load project variance:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (projectId) loadVariance();
  }, [projectId]);

  if (isLoading) {
    return <div className="p-8 text-xs font-mono text-slate-400">Computing earned value & variance analysis...</div>;
  }

  if (!data) {
    return <div className="p-8 text-xs text-rose-400">Failed to load variance data.</div>;
  }

  const variance = data.variance || {};
  const pricing = data.pricing || null;
  const isHealthy = variance.status === 'HEALTHY';
  const isCritical = variance.status === 'CRITICAL';

  return (
    <div className="space-y-4 text-xs">
      {/* Top Health Alert Banner */}
      <div
        className={`p-3.5 rounded-lg border flex items-center justify-between ${
          isCritical
            ? 'bg-rose-950/30 border-rose-900/50 text-rose-300'
            : !isHealthy
            ? 'bg-amber-950/30 border-amber-900/50 text-amber-300'
            : 'bg-emerald-950/30 border-emerald-900/50 text-emerald-300'
        }`}
      >
        <div className="flex items-center space-x-2.5">
          {isCritical ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : !isHealthy ? (
            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <div>
            <span className="font-bold text-sm">
              Project Delivery Health: {variance.status}
            </span>
            <div className="text-[11px] opacity-80 mt-0.5">
              Estimate Variance: <strong className="font-mono">{variance.estimateVariancePercent}%</strong> • Schedule Drift: <strong className="font-mono">{variance.scheduleVariancePercent}%</strong>
            </div>
          </div>
        </div>

        <button
          onClick={loadVariance}
          className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors"
          title="Refresh Metrics"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Variance KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Total Estimated Effort
          </div>
          <div className="text-xl font-bold text-slate-100">{variance.totalEstimatedHours}h</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Baseline commitment</div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Actual Hours Burned
          </div>
          <div className="text-xl font-bold text-blue-400">{variance.totalActualHours}h</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Tracked work log</div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Estimate Variance
          </div>
          <div
            className={`text-xl font-bold font-mono ${
              variance.estimateVarianceHours > 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {variance.estimateVarianceHours > 0 ? `+${variance.estimateVarianceHours}h` : `${variance.estimateVarianceHours}h`}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {variance.estimateVariancePercent > 0 ? `+${variance.estimateVariancePercent}%` : `${variance.estimateVariancePercent}%`} vs estimate
          </div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Forecast at Completion (FAC)
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono">
            {variance.forecastAtCompletionHours}h
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Actual + Remaining ({variance.remainingHours}h)</div>
        </div>
      </div>

      {/* Financial Overview (RBAC Protected) */}
      {canSeeCost && pricing && (
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-slate-200 flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Commercial Budget & Margin Tracking</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400 uppercase">
              Model: {pricing.pricingModel}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Baseline Cost</span>
              <span className="text-sm font-bold text-slate-100">
                ₹{pricing.estimatedInternalCost?.toLocaleString()}
              </span>
            </div>

            <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Contract Price</span>
              <span className="text-sm font-bold text-emerald-400">
                ₹{pricing.finalPrice?.toLocaleString()}
              </span>
            </div>

            <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Contingency Buffer</span>
              <span className="text-sm font-bold text-amber-400">
                {pricing.contingencyPercentage}%
              </span>
            </div>

            <div className="p-2.5 bg-slate-900 rounded border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Target Markup</span>
              <span className="text-sm font-bold text-blue-400">
                {pricing.markupPercentage}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
