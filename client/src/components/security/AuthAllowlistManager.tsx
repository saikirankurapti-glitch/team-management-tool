import React, { useState, useEffect } from 'react';
import {
  Shield,
  UserCheck,
  UserX,
  AlertTriangle,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Lock,
  Mail,
  RefreshCw,
  Users,
  ShieldAlert,
  Eye,
  X,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import {
  OrganizationAuthAllowlistEntry,
  AuthAccessRequestEntry,
  SecurityEventEntry,
  SecurityOverviewStats,
  User,
  Project,
} from '../../types';

export const AuthAllowlistManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'allowlist' | 'requests' | 'events'>('allowlist');
  const [allowlist, setAllowlist] = useState<OrganizationAuthAllowlistEntry[]>([]);
  const [accessRequests, setAccessRequests] = useState<AuthAccessRequestEntry[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventEntry[]>([]);
  const [stats, setStats] = useState<SecurityOverviewStats | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterProvider, setFilterProvider] = useState<'ALL' | 'GOOGLE' | 'GITHUB'>('ALL');

  // Modal & Drawer State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<AuthAccessRequestEntry | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [approveUserId, setApproveUserId] = useState<string>('AUTO_PROVISION');
  const [approveRole, setApproveRole] = useState<string>('TEAM_MEMBER');
  const [approveProjectIds, setApproveProjectIds] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [filterRequestStatus, setFilterRequestStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const [newProvider, setNewProvider] = useState<'GOOGLE' | 'GITHUB'>('GOOGLE');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newUserId, setNewUserId] = useState<string>('');
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allowlistRes, requestsRes, overviewRes, membersRes, projectsRes] = await Promise.all([
        fetchApi<{ success: boolean; accounts: OrganizationAuthAllowlistEntry[] }>('/security/allowlist'),
        fetchApi<{ success: boolean; requests: AuthAccessRequestEntry[] }>('/security/access-requests'),
        fetchApi<{ success: boolean; stats: SecurityOverviewStats; recentEvents: SecurityEventEntry[] }>('/security/overview'),
        fetchApi<User[]>('/organization/members'),
        fetchApi<Project[]>('/projects'),
      ]);

      setAllowlist(allowlistRes.accounts || []);
      setAccessRequests(requestsRes.requests || []);
      setStats(overviewRes.stats || null);
      setSecurityEvents(overviewRes.recentEvents || []);
      setMembers(Array.isArray(membersRes) ? membersRes : (membersRes as any)?.members || []);
      setProjects(projectsRes || []);
    } catch (err) {
      console.error('[AuthAllowlistManager] Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      setFormError('Email address is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await fetchApi('/security/allowlist', {
        method: 'POST',
        body: JSON.stringify({
          provider: newProvider,
          email: newEmail.trim(),
          userId: newUserId || null,
          displayName: newDisplayName.trim() || null,
          status: newStatus,
        }),
      });

      setIsAddModalOpen(false);
      setNewEmail('');
      setNewUserId('');
      setNewDisplayName('');
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to add allowlisted account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, nextStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED') => {
    try {
      await fetchApi(`/security/allowlist/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update account status.');
    }
  };

  const handleDeleteAccount = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from the authorized allowlist?`)) {
      return;
    }

    try {
      await fetchApi(`/security/allowlist/${id}`, {
        method: 'DELETE',
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete allowlist entry.');
    }
  };

  const handleReviewRequest = async (
    id: string,
    decision: 'APPROVE' | 'REJECT',
    userId?: string,
    reason?: string,
    role?: string,
    projectIds?: string[]
  ) => {
    try {
      await fetchApi(`/security/access-requests/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          userId: userId === 'AUTO_PROVISION' ? null : (userId || null),
          role: role || 'TEAM_MEMBER',
          projectIds: projectIds || [],
          rejectionReason: reason || null,
        }),
      });
      setIsApproveModalOpen(false);
      setIsRejectModalOpen(false);
      setSelectedRequest(null);
      setApproveUserId('AUTO_PROVISION');
      setApproveRole('TEAM_MEMBER');
      setApproveProjectIds([]);
      setRejectionReason('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to review access request.');
    }
  };

  const filteredAllowlist = allowlist.filter((item) => {
    const matchProvider = filterProvider === 'ALL' || item.provider === filterProvider;
    const matchSearch =
      !searchQuery ||
      item.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.user?.fullName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchProvider && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* GOOGLE AUTHENTICATION Policy Panel */}
      <div className="panel-cream p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-borderWarm pb-3">
          <div className="flex items-center space-x-2.5">
            <Shield className="w-4 h-4 text-olive" />
            <span className="font-black text-xs text-ink tracking-wider uppercase">Authentication Governance Policy</span>
          </div>
          <span className="badge-pill bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
            Policy Active & Enforced
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-1">
          <div>
            <span className="editorial-eyebrow text-[9px] block mb-0.5">Google OAuth</span>
            <span className="font-bold text-xs text-ink">Enabled</span>
          </div>
          <div>
            <span className="editorial-eyebrow text-[9px] block mb-0.5">Application Policy</span>
            <span className="font-bold text-xs text-olive">Private Team</span>
          </div>
          <div>
            <span className="editorial-eyebrow text-[9px] block mb-0.5">Authorized Accounts</span>
            <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
              {stats?.authorizedAccounts ?? allowlist.filter((a) => a.status === 'ACTIVE').length}
            </span>
          </div>
          <div>
            <span className="editorial-eyebrow text-[9px] block mb-0.5">Auto Account Creation</span>
            <span className="font-bold text-xs text-rose-600 dark:text-rose-400">Disabled</span>
          </div>
          <div>
            <span className="editorial-eyebrow text-[9px] block mb-0.5">Unknown Accounts</span>
            <span className="font-bold text-xs text-rose-600 dark:text-rose-400">Blocked</span>
          </div>
          <div>
            <span className="editorial-eyebrow text-[9px] block mb-0.5">Admin Alerts</span>
            <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">Enabled</span>
          </div>
        </div>
      </div>

      {/* Security Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card-cream p-4">
          <span className="editorial-eyebrow text-[10px] block mb-1">Authorized</span>
          <div className="text-xl font-black text-ink flex items-center space-x-1.5">
            <Lock className="w-4 h-4 text-olive" />
            <span>{stats?.authorizedAccounts ?? allowlist.filter((a) => a.status === 'ACTIVE').length}</span>
          </div>
          <span className="text-[10px] text-ink/60 block mt-1">Allowlisted Identities</span>
        </div>

        <div className="card-cream p-4">
          <span className="editorial-eyebrow text-[10px] block mb-1">Team Members</span>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5">
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{stats?.activeTeamMembers ?? members.length}</span>
          </div>
          <span className="text-[10px] text-ink/60 block mt-1">Directory Profiles</span>
        </div>

        <div className="card-cream p-4">
          <span className="editorial-eyebrow text-[10px] block mb-1">Pending Requests</span>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 flex items-center space-x-1.5">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{stats?.pendingAccessRequests ?? accessRequests.filter((r) => r.status === 'PENDING').length}</span>
          </div>
          <span className="text-[10px] text-ink/60 block mt-1">Awaiting Admin Action</span>
        </div>

        <div className="card-cream p-4">
          <span className="editorial-eyebrow text-[10px] block mb-1">Blocked Logins</span>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 flex items-center space-x-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>{stats?.blockedLoginAttempts ?? securityEvents.filter((e) => e.status === 'BLOCKED').length}</span>
          </div>
          <span className="text-[10px] text-ink/60 block mt-1">Unauthorized Attempts</span>
        </div>

        <div className="card-cream p-4">
          <span className="editorial-eyebrow text-[10px] block mb-1">Suspended</span>
          <div className="text-xl font-black text-ink/60 flex items-center space-x-1.5">
            <UserX className="w-4 h-4 text-ink/60" />
            <span>{stats?.suspendedAccounts ?? allowlist.filter((a) => a.status === 'SUSPENDED' || a.status === 'REVOKED').length}</span>
          </div>
          <span className="text-[10px] text-ink/60 block mt-1">Access Denied</span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-borderWarm pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-surface border border-borderWarm rounded-full w-fit overflow-x-auto">
          <button
            onClick={() => setActiveTab('allowlist')}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'allowlist'
                ? 'bg-olive text-white shadow-sm'
                : 'text-ink/70 hover:text-ink hover:bg-canvas'
            }`}
          >
            Authorized Login Accounts ({allowlist.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all whitespace-nowrap flex items-center space-x-1.5 ${
              activeTab === 'requests'
                ? 'bg-olive text-white shadow-sm'
                : 'text-ink/70 hover:text-ink hover:bg-canvas'
            }`}
          >
            <span>Access Requests</span>
            {accessRequests.filter((r) => r.status === 'PENDING').length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500 text-white font-mono font-bold">
                {accessRequests.filter((r) => r.status === 'PENDING').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-1.5 rounded-full font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'events'
                ? 'bg-olive text-white shadow-sm'
                : 'text-ink/70 hover:text-ink hover:bg-canvas'
            }`}
          >
            Authentication Activity ({securityEvents.length})
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            title="Refresh Security State"
            className="p-2 text-ink/65 hover:text-ink bg-surface border border-borderWarm rounded-full hover:border-olive transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {activeTab === 'allowlist' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-pill-primary flex items-center space-x-1.5 text-xs py-2 px-4 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Authorized Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Authorized Allowlist Table */}
      {activeTab === 'allowlist' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search accounts or members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center space-x-1 text-xs">
              {(['ALL', 'GOOGLE', 'GITHUB'] as const).map((prov) => (
                <button
                  key={prov}
                  onClick={() => setFilterProvider(prov)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono ${
                    filterProvider === prov
                      ? 'bg-slate-800 text-slate-100 border border-slate-700'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {prov}
                </button>
              ))}
            </div>
          </div>

          <div className="ent-panel overflow-hidden border border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                  <th className="py-2.5 px-3">Team Member</th>
                  <th className="py-2.5 px-3">Authorized Email / Account</th>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Last Login</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAllowlist.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-2.5 px-3">
                      {item.user ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-[10px] font-bold">
                            {item.user.fullName[0]}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-200 block">{item.user.fullName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {item.user.jobTitle || item.user.role}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5">
                          <select
                            onChange={async (e) => {
                              const val = e.target.value;
                              if (val) {
                                try {
                                  await fetchApi(`/security/allowlist/${item.id}`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ userId: val }),
                                  });
                                  loadData();
                                } catch (err: any) {
                                  alert(err.message || 'Failed to map user');
                                }
                              }
                            }}
                            defaultValue=""
                            className="bg-slate-950 border border-amber-500/40 text-amber-300 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-amber-400"
                          >
                            <option value="" disabled>
                              Select team member...
                            </option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
                                {m.fullName} ({m.jobTitle || m.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      <div className="flex items-center space-x-1.5">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>{item.email}</span>
                      </div>
                      {item.displayName && item.displayName !== item.email && (
                        <span className="text-[10px] text-slate-500 block">{item.displayName}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          item.provider === 'GOOGLE'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}
                      >
                        {item.provider}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : item.status === 'SUSPENDED'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {item.status === 'ACTIVE' && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {item.status === 'SUSPENDED' && <AlertTriangle className="w-2.5 h-2.5" />}
                        {item.status === 'REVOKED' && <XCircle className="w-2.5 h-2.5" />}
                        <span>{item.status}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                      {item.lastLoginAt ? (
                        <div>
                          <span>{new Date(item.lastLoginAt).toLocaleString()}</span>
                          {item.lastLoginIp && (
                            <span className="text-[9px] text-slate-600 block">IP: {item.lastLoginIp}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">Never</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      {item.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'SUSPENDED')}
                          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded text-[10px] font-mono transition-colors"
                          title="Temporarily suspend access"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'ACTIVE')}
                          className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded text-[10px] font-mono transition-colors"
                          title="Reactivate account"
                        >
                          Reactivate
                        </button>
                      )}
                      {item.status !== 'REVOKED' && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'REVOKED')}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded text-[10px] font-mono transition-colors"
                          title="Revoke access permanently"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteAccount(item.id, item.email)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete allowlist entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredAllowlist.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500 italic">
                      No allowlisted accounts match your query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Access Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {/* Filter Bar: Pending | Approved | Rejected | All */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 font-mono text-xs">
              {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterRequestStatus(st)}
                  className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                    filterRequestStatus === st
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
                  }`}
                >
                  {st === 'ALL' ? 'All Requests' : st} (
                  {st === 'ALL'
                    ? accessRequests.length
                    : accessRequests.filter((r) => r.status === st).length}
                  )
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Click row or Details to inspect identity & security events
            </span>
          </div>

          <div className="ent-panel overflow-hidden border border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Gmail / Account</th>
                  <th className="py-2.5 px-3">Provider</th>
                  <th className="py-2.5 px-3">Requested</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Existing Team Member</th>
                  <th className="py-2.5 px-3">Last Attempt</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {accessRequests
                  .filter((req) => filterRequestStatus === 'ALL' || req.status === filterRequestStatus)
                  .map((req) => {
                    const isExistingMember = allowlist.some(
                      (a) => a.email.toLowerCase() === req.email.toLowerCase() && a.userId
                    );
                    const mappedMemberName = allowlist.find(
                      (a) => a.email.toLowerCase() === req.email.toLowerCase()
                    )?.user?.fullName;

                    return (
                      <tr
                        key={req.id}
                        className="hover:bg-slate-900/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedRequest(req)}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2">
                            {req.profileImageUrl ? (
                              <img
                                src={req.profileImageUrl}
                                alt={req.displayName || req.name || 'User'}
                                className="w-6 h-6 rounded-full border border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                                {(req.displayName || req.name || req.email)[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-slate-200 block">
                                {req.displayName || req.name || 'Google User'}
                              </span>
                              {req.attemptCount && req.attemptCount > 1 && (
                                <span className="text-[9px] text-amber-400 font-mono">
                                  {req.attemptCount} login attempts
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          <div className="flex items-center space-x-1.5">
                            <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[180px]">{req.email}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {req.provider}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                          {new Date(req.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center space-x-1 ${
                              req.status === 'PENDING'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : req.status === 'APPROVED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            <span>{req.status}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px]">
                          {isExistingMember ? (
                            <span className="inline-flex items-center space-x-1 text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Yes ({mappedMemberName})</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">No</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                          {req.lastSeenAt ? (
                            <span>{new Date(req.lastSeenAt).toLocaleString()}</span>
                          ) : (
                            <span>{new Date(req.createdAt).toLocaleString()}</span>
                          )}
                        </td>
                        <td
                          className="py-2.5 px-3 text-right space-x-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setSelectedRequest(req)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs inline-flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Details</span>
                          </button>
                          {req.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setIsApproveModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setIsRejectModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-rose-900/40 text-rose-300 border border-slate-700 rounded text-xs"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                {accessRequests.filter(
                  (req) => filterRequestStatus === 'ALL' || req.status === filterRequestStatus
                ).length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                      No {filterRequestStatus.toLowerCase()} access requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer: Request Details Drawer */}
      {selectedRequest && !isApproveModalOpen && !isRejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 space-y-5 overflow-y-auto shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <h3 className="font-bold text-sm text-slate-100">Access Request Details</h3>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-1 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Requester Name:</span>
                    <span className="text-slate-200 font-sans font-medium">
                      {selectedRequest.displayName || selectedRequest.name || 'Google User'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Google Email:</span>
                    <span className="text-blue-400 font-bold">{selectedRequest.email}</span>
                  </div>
                  {selectedRequest.externalIdentityId && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Google Subject ID:</span>
                      <span className="text-slate-300">{selectedRequest.externalIdentityId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Provider:</span>
                    <span className="text-slate-200">{selectedRequest.provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Request Date:</span>
                    <span className="text-slate-300">
                      {new Date(selectedRequest.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {selectedRequest.lastSeenAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Last Attempt:</span>
                      <span className="text-slate-300">
                        {new Date(selectedRequest.lastSeenAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedRequest.attemptCount && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Attempts:</span>
                      <span className="text-amber-400 font-bold">{selectedRequest.attemptCount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Status:</span>
                    <span
                      className={`font-bold ${
                        selectedRequest.status === 'PENDING'
                          ? 'text-amber-400'
                          : selectedRequest.status === 'APPROVED'
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {selectedRequest.status}
                    </span>
                  </div>
                  {selectedRequest.rejectionReason && (
                    <div className="flex flex-col space-y-1 pt-1 border-t border-slate-900">
                      <span className="text-slate-500">Rejection Reason:</span>
                      <span className="text-rose-300 font-sans">{selectedRequest.rejectionReason}</span>
                    </div>
                  )}
                  {selectedRequest.ip && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Client IP:</span>
                      <span className="text-slate-400">{selectedRequest.ip}</span>
                    </div>
                  )}
                </div>

                {/* Associated Allowlist Status */}
                <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1.5">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                    Existing Organization Mapping
                  </span>
                  {allowlist.find(
                    (a) => a.email.toLowerCase() === selectedRequest.email.toLowerCase()
                  ) ? (
                    <div className="text-emerald-400 text-xs flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Mapped to team member:{' '}
                        {allowlist.find(
                          (a) => a.email.toLowerCase() === selectedRequest.email.toLowerCase()
                        )?.user?.fullName || 'Active Allowlist Record'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-500 italic text-[11px] block">
                      Not currently mapped to any team member profile.
                    </span>
                  )}
                </div>

                {/* Previous Security Events for this email */}
                <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                    Related Security & Login Events
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {securityEvents.filter(
                      (e) => e.email?.toLowerCase() === selectedRequest.email.toLowerCase()
                    ).length > 0 ? (
                      securityEvents
                        .filter(
                          (e) => e.email?.toLowerCase() === selectedRequest.email.toLowerCase()
                        )
                        .map((e) => (
                          <div
                            key={e.id}
                            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-[10px] flex justify-between items-center"
                          >
                            <span className="text-rose-400 font-bold">{e.eventType}</span>
                            <span className="text-slate-500">
                              {new Date(e.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        ))
                    ) : (
                      <span className="text-slate-600 italic text-[10px]">
                        No prior blocked login events recorded.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setSelectedRequest(null)}
                className="ent-btn-secondary px-3 py-1.5 text-xs"
              >
                Close
              </button>
              {selectedRequest.status === 'PENDING' && (
                <div className="space-x-2">
                  <button
                    onClick={() => setIsRejectModalOpen(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-rose-300 border border-slate-700 rounded text-xs"
                  >
                    Reject Request
                  </button>
                  <button
                    onClick={() => setIsApproveModalOpen(true)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                  >
                    Approve Access
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Approve Access & Team Member / Role / Project Configuration */}
      {isApproveModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">Approve Access</h3>
              </div>
              <button
                onClick={() => setIsApproveModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400 leading-relaxed">
              Approve access for Google account <span className="text-blue-400 font-mono font-bold">{selectedRequest.email}</span>.
            </p>

            <div className="bg-slate-950 p-3 rounded border border-slate-800 font-mono text-[11px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Google Account:</span>
                <span className="text-slate-200 font-bold">{selectedRequest.displayName || selectedRequest.name || 'Google User'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="text-blue-400 font-bold">{selectedRequest.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Organization:</span>
                <span className="text-slate-300">TMP Organization</span>
              </div>
            </div>

            {/* TMP Team Member Mapping */}
            <div className="space-y-1">
              <label className="text-slate-300 font-medium block">TMP Team Member Profile:</label>
              <select
                value={approveUserId}
                onChange={(e) => setApproveUserId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="AUTO_PROVISION">✨ Automatically create new Team Member profile</option>
                <optgroup label="Or link to existing member:">
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} — {m.jobTitle || m.role} ({m.email})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Role Assignment: Default strictly to TEAM_MEMBER */}
            <div className="space-y-1">
              <label className="text-slate-300 font-medium block">Assigned Role:</label>
              <select
                value={approveRole}
                onChange={(e) => setApproveRole(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="TEAM_MEMBER">TEAM MEMBER (Standard, Recommended)</option>
                <option value="PROJECT_MANAGER">CTO / MANAGER (Management Access)</option>
              </select>
              <p className="text-[10px] text-slate-500">
                New approvals strictly default to Team Member. Admins can adjust privileges later.
              </p>
            </div>

            {/* Project Access Multi-select */}
            <div className="space-y-1">
              <label className="text-slate-300 font-medium block">Project Access:</label>
              <div className="max-h-28 overflow-y-auto space-y-1 bg-slate-950 p-2 rounded border border-slate-800">
                {projects.map((proj) => {
                  const checked = approveProjectIds.includes(proj.id);
                  return (
                    <label key={proj.id} className="flex items-center space-x-2 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) {
                            setApproveProjectIds((prev) => prev.filter((p) => p !== proj.id));
                          } else {
                            setApproveProjectIds((prev) => [...prev, proj.id]);
                          }
                        }}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                      />
                      <span>{proj.name} ({proj.key})</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="ent-btn-secondary px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleReviewRequest(
                    selectedRequest.id,
                    'APPROVE',
                    approveUserId,
                    undefined,
                    approveRole,
                    approveProjectIds
                  )
                }
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
              >
                Approve Access
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reject Access Request */}
      {isRejectModalOpen && selectedRequest && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <XCircle className="w-4 h-4 text-rose-400" />
                <h3 className="font-bold text-sm text-slate-100">Reject Access Request</h3>
              </div>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Rejecting access for <span className="text-slate-200 font-mono font-semibold">{selectedRequest.email}</span>. The request status will be updated to REJECTED and preserved in security audit history.
            </p>

            <div className="space-y-1 text-xs">
              <label className="text-slate-300 font-medium block">Optional Rejection Reason:</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Account not recognized as verified contractor or team member."
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 text-xs h-20"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="ent-btn-secondary px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleReviewRequest(
                    selectedRequest.id,
                    'REJECT',
                    undefined,
                    rejectionReason || undefined
                  )
                }
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold"
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Authentication Events */}
      {activeTab === 'events' && (
        <div className="ent-panel overflow-hidden border border-slate-800">
          <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
            {securityEvents.map((evt) => (
              <div key={evt.id} className="p-3 flex items-center justify-between hover:bg-slate-900/40">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      evt.status === 'BLOCKED'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {evt.status === 'BLOCKED' ? (
                      <ShieldAlert className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-slate-200">[{evt.eventType}]</span>
                      <span className="px-1.5 py-0.2 bg-slate-800 text-slate-400 text-[10px] rounded font-mono">
                        {evt.provider}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          evt.status === 'BLOCKED' ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {evt.status}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5 font-mono">
                      Account: <span className="text-slate-200">{evt.email || 'Unknown'}</span>
                      {evt.ip && <span className="text-slate-500 ml-2">IP: {evt.ip}</span>}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {new Date(evt.createdAt).toLocaleTimeString()} ({new Date(evt.createdAt).toLocaleDateString()})
                </span>
              </div>
            ))}
            {securityEvents.length === 0 && (
              <div className="p-6 text-center text-slate-500 italic">No recent authentication security events.</div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Add Authorized Account */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-sm text-slate-100">Add Authorized Account</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddAccount} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Provider</label>
                <select
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="GOOGLE">Google Workspace / Gmail</option>
                  <option value="GITHUB">GitHub</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Email Address (Exact Gmail or Verified GitHub Email)</label>
                <input
                  type="email"
                  placeholder="e.g. member.zerokost@gmail.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Link to Existing Team Member (Optional Identity Linking)</label>
                <select
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">— Leave Unmapped (Select Member Later) —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.jobTitle || m.role})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Does NOT create a new user. Maps this login identity to an existing team member profile.
                </span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Display Label</label>
                <input
                  type="text"
                  placeholder="e.g. Work Gmail Account"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Initial Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="ACTIVE">Active (Allowed to sign in)</option>
                  <option value="SUSPENDED">Suspended (Blocked until reactivated)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="ent-btn-secondary px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="ent-btn-primary px-3.5 py-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Authorize Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
