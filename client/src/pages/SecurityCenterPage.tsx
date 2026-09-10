import React, { useState, useEffect } from 'react';
import { Shield, Lock, CheckCircle2, UserCheck, KeyRound } from 'lucide-react';
import { fetchApi } from '../services/api';
import { AuthAllowlistManager } from '../components/security/AuthAllowlistManager';
import { TeamAndAccessManager } from '../components/security/TeamAndAccessManager';
import { Users } from 'lucide-react';

export const SecurityCenterPage: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<'team-access' | 'allowlist' | 'system'>('team-access');
  const [data, setData] = useState<any>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApi<any>('/v1/security'),
      fetchApi<any[]>('/v1/keys'),
    ])
      .then(([secData, keyData]) => {
        setData(secData);
        setKeys(keyData);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="editorial-eyebrow">[ SECURITY ]</div>
        <div className="text-xl font-bold tracking-tight text-ink">Verifying cryptographic perimeter...</div>
        <div className="h-64 bg-surface border border-borderWarm rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Editorial Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-borderWarm">
        <div>
          <div className="editorial-eyebrow mb-1.5">[ PERIMETER & GOVERNANCE ]</div>
          <h1 className="editorial-headline text-2xl md:text-3xl font-black text-ink">
            Security & Access Control Center
          </h1>
          <p className="text-xs text-ink/65 max-w-2xl font-sans mt-1">
            Authoritative user roles, team access, closed-team allowlist, and perimeter audit events.
          </p>
        </div>

        {/* Top-Level Mode Selector Pills */}
        <div className="flex items-center gap-1.5 p-1.5 bg-surface border border-borderWarm rounded-full overflow-x-auto">
          <button
            onClick={() => setActiveMainTab('team-access')}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full font-bold text-xs transition-all whitespace-nowrap ${
              activeMainTab === 'team-access'
                ? 'bg-olive text-white shadow-sm'
                : 'text-ink/70 hover:text-ink hover:bg-canvas'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Team & Access</span>
          </button>
          <button
            onClick={() => setActiveMainTab('allowlist')}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full font-bold text-xs transition-all whitespace-nowrap ${
              activeMainTab === 'allowlist'
                ? 'bg-olive text-white shadow-sm'
                : 'text-ink/70 hover:text-ink hover:bg-canvas'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Authentication Allowlist</span>
          </button>
          <button
            onClick={() => setActiveMainTab('system')}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full font-bold text-xs transition-all whitespace-nowrap ${
              activeMainTab === 'system'
                ? 'bg-olive text-white shadow-sm'
                : 'text-ink/70 hover:text-ink hover:bg-canvas'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>System Credentials & Audit</span>
          </button>
        </div>
      </div>

      {activeMainTab === 'team-access' && <TeamAndAccessManager />}

      {activeMainTab === 'allowlist' && <AuthAllowlistManager />}

      {activeMainTab === 'system' && (
        <div className="space-y-6">
          {/* Security Overview Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">SSO Provider</span>
              <div className="text-lg font-black text-ink">
                {data?.securityOverview?.ssoStatus || 'ACTIVE'}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Domain SSO Enforced
              </div>
            </div>

            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">API Key Credentials</span>
              <div className="text-lg font-black text-olive">
                {data?.securityOverview?.activeApiKeysCount || keys.length} Active Keys
              </div>
              <div className="text-xs text-ink/60 mt-1">RBAC Scoped</div>
            </div>

            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Webhooks Security</span>
              <div className="text-lg font-black text-olive">
                {data?.securityOverview?.activeWebhooksCount || 0} Endpoints
              </div>
              <div className="text-xs text-ink/60 mt-1">HMAC Signed</div>
            </div>

            <div className="card-cream p-4">
              <span className="editorial-eyebrow text-[10px] block mb-1">Isolation State</span>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">ENFORCED</div>
              <div className="text-xs text-ink/60 mt-1">TenantContext Strict</div>
            </div>
          </div>

          {/* Security Audit Trail Table */}
          <div className="panel-cream overflow-hidden">
            <div className="p-4 border-b border-borderWarm flex items-center justify-between">
              <span className="font-bold text-sm uppercase tracking-wider text-ink">
                Security Event Audit Logs
              </span>
              <span className="editorial-eyebrow text-[10px]">[ IMMUTABLE RECORD ]</span>
            </div>
            <div className="divide-y divide-borderWarm max-h-96 overflow-y-auto">
              {data?.recentSecurityEvents?.map((event: any) => (
                <div key={event.id} className="p-3.5 flex items-center justify-between hover:bg-canvas transition-colors">
                  <div className="flex items-center space-x-3">
                    <Lock className="w-4 h-4 text-olive shrink-0" />
                    <div>
                      <span className="font-mono font-bold text-xs text-ink mr-2">[{event.action}]</span>
                      <span className="text-xs text-ink/70">{event.user?.fullName || 'System User'}</span>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-ink/50">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
              {(!data?.recentSecurityEvents || data.recentSecurityEvents.length === 0) && (
                <div className="p-8 text-center text-ink/60 text-xs italic">No security events logged</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

