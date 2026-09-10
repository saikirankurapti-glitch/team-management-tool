import React, { useState, useEffect } from 'react';
import { CreditCard, Zap, CheckCircle2 } from 'lucide-react';
import { fetchApi } from '../services/api';

export const BillingPage: React.FC = () => {
  const [billing, setBilling] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const loadBilling = () => {
    fetchApi<any>('/v1/billing')
      .then((data) => setBilling(data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadBilling();
  }, []);

  const handleUpgrade = async (targetPlan: string) => {
    try {
      setIsUpgrading(true);
      await fetchApi('/v1/billing/upgrade', {
        method: 'POST',
        body: JSON.stringify({ plan: targetPlan }),
      });
      loadBilling();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpgrading(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-xs font-mono text-slate-400">Loading Billing Controls...</div>;
  }

  const sub = billing?.subscription;
  const usage = billing?.usage;

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full text-xs">
      {/* Header Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <CreditCard className="w-4 h-4 text-blue-500" />
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Subscription & Entitlement Controls
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Metered resources, seat licenses, API usage thresholds, and plan upgrades
            </p>
          </div>
        </div>

        <button
          onClick={() => handleUpgrade('BUSINESS')}
          disabled={isUpgrading}
          className="ent-btn-primary flex items-center space-x-1"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{isUpgrading ? 'Upgrading...' : 'Upgrade Plan'}</span>
        </button>
      </div>

      {/* Active Subscription Banner */}
      <div className="ent-panel p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{sub?.plan} Plan</span>
            <span className="badge-blue text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase">
              {sub?.status}
            </span>
          </div>
          {sub?.status === 'TRIALING' && (
            <p className="text-amber-500 text-xs font-medium mt-0.5">
              14-Day Active Trial ({sub?.trialDaysRemaining} days remaining)
            </p>
          )}
        </div>
      </div>

      {/* Usage Meter Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
        <div className="ent-card p-3 space-y-2">
          <div className="flex justify-between text-slate-500">
            <span>Members</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{usage?.members?.current} / {usage?.members?.max}</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded overflow-hidden">
            <div className="bg-blue-600 h-full" style={{ width: `${usage?.members?.percentage || 0}%` }} />
          </div>
        </div>

        <div className="ent-card p-3 space-y-2">
          <div className="flex justify-between text-slate-500">
            <span>Projects</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{usage?.projects?.current} / {usage?.projects?.max}</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded overflow-hidden">
            <div className="bg-emerald-600 h-full" style={{ width: `${usage?.projects?.percentage || 0}%` }} />
          </div>
        </div>

        <div className="ent-card p-3 space-y-2">
          <div className="flex justify-between text-slate-500">
            <span>AI Tokens</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{usage?.aiTokens?.current} / {usage?.aiTokens?.max}</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded overflow-hidden">
            <div className="bg-blue-500 h-full w-[15%]" />
          </div>
        </div>

        <div className="ent-card p-3 space-y-2">
          <div className="flex justify-between text-slate-500">
            <span>Storage Usage</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{usage?.storageGb?.current} GB / {usage?.storageGb?.max} GB</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded overflow-hidden">
            <div className="bg-blue-600 h-full w-[40%]" />
          </div>
        </div>
      </div>
    </div>
  );
};
