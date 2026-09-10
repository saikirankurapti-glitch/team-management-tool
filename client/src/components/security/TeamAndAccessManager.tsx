import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  FolderKanban,
  UserCheck,
  UserX,
  Lock,
  Mail,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { User, Project } from '../../types';

export const TeamAndAccessManager: React.FC = () => {
  const [members, setMembers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modals state
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [targetRole, setTargetRole] = useState<string>('TEAM_MEMBER');
  const [roleConfirmationText, setRoleConfirmationText] = useState<string>('');

  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState<boolean>(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [membersRes, projectsRes] = await Promise.all([
        fetchApi<User[]>('/organization/members?includeInactive=true'),
        fetchApi<Project[]>('/projects'),
      ]);
      setMembers(membersRes || []);
      setProjects(projectsRes || []);
    } catch (err: any) {
      console.error('[TeamAndAccessManager] Failed to load data:', err);
      setErrorMessage(err.message || 'Failed to load team and access data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openRoleModal = (member: User) => {
    setSelectedMember(member);
    setTargetRole(member.role);
    setRoleConfirmationText('');
    setErrorMessage(null);
    setIsRoleModalOpen(true);
  };

  const handleRoleChange = async () => {
    if (!selectedMember) return;
    setIsProcessing(true);
    setErrorMessage(null);

    // Sole Admin Protection check on client
    if (selectedMember.role === 'ADMIN' && targetRole !== 'ADMIN') {
      const activeAdminCount = members.filter((m) => m.role === 'ADMIN' && m.isActive !== false).length;
      if (activeAdminCount <= 1) {
        setErrorMessage('Cannot demote the sole Administrator of the organization.');
        setIsProcessing(false);
        return;
      }
    }

    try {
      await fetchApi(`/organization/members/${selectedMember.id}`, {
        method: 'PUT',
        body: JSON.stringify({ role: targetRole }),
      });
      setIsRoleModalOpen(false);
      setSelectedMember(null);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update role.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openProjectModal = (member: User) => {
    setSelectedMember(member);
    const existing = (member.projectMemberships || []).map((pm) => pm.project.id);
    setSelectedProjectIds(existing);
    setErrorMessage(null);
    setIsProjectModalOpen(true);
  };

  const handleProjectAssignment = async () => {
    if (!selectedMember) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      await fetchApi(`/organization/members/${selectedMember.id}`, {
        method: 'PUT',
        body: JSON.stringify({ projectIds: selectedProjectIds }),
      });
      setIsProjectModalOpen(false);
      setSelectedMember(null);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update project assignments.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedMember) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      await fetchApi(`/organization/members/${selectedMember.id}/deactivate`, {
        method: 'POST',
      });
      setIsDeactivateModalOpen(false);
      setSelectedMember(null);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to deactivate member.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReactivate = async (member: User) => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      await fetchApi(`/organization/members/${member.id}/reactivate`, {
        method: 'POST',
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reactivate member.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const matchRole = roleFilter === 'ALL' || m.role === roleFilter;
    const matchSearch =
      !searchQuery ||
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner: Authoritative Role Policy */}
      <div className="panel-cream p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-borderWarm pb-3">
          <div className="flex items-center space-x-2.5">
            <Shield className="w-4 h-4 text-olive" />
            <span className="font-black text-xs text-ink tracking-wider uppercase">
              Authoritative Role & Access Matrix
            </span>
          </div>
          <span className="badge-pill bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
            Policy Enforced
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
          <div className="p-3 bg-surface border border-borderWarm rounded-xl">
            <div className="flex items-center space-x-1.5 text-rose-600 dark:text-rose-400 font-bold mb-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Sole Administrator</span>
            </div>
            <div className="font-mono text-[11px] text-ink font-semibold">saikirankurapti@gmail.com</div>
            <p className="text-[10px] text-ink/65 mt-1 leading-relaxed">
              Sole Admin profile. Protected from deactivation, removal, and demotion. Full system control.
            </p>
          </div>

          <div className="p-3 bg-surface border border-borderWarm rounded-xl">
            <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>CTO / Project Manager</span>
            </div>
            <div className="font-mono text-[11px] text-ink font-semibold">ashwin.zerokost@gmail.com</div>
            <p className="text-[10px] text-ink/65 mt-1 leading-relaxed">
              Authorized CTO & Manager. Has Price Allocation access; restricted from Admin and Security settings.
            </p>
          </div>

          <div className="p-3 bg-surface border border-borderWarm rounded-xl">
            <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-bold mb-1">
              <Users className="w-3.5 h-3.5" />
              <span>Regular Team Members</span>
            </div>
            <div className="font-mono text-[11px] text-ink font-semibold">saikirankurapati04@gmail.com & others</div>
            <p className="text-[10px] text-ink/65 mt-1 leading-relaxed">
              Standard workspace access. Cannot see Admin, Security, Pricing, or Price Allocation.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filter, Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-borderWarm pb-3">
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="PROJECT_MANAGER">CTO / MANAGER</option>
            <option value="TEAM_MEMBER">TEAM MEMBER</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            title="Refresh Roster"
            className="p-2 text-ink/65 hover:text-ink bg-surface border border-borderWarm rounded-full hover:border-olive transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Team Members & Access Table */}
      <div className="ent-panel overflow-hidden border border-slate-800">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
              <th className="py-2.5 px-3">Team Member</th>
              <th className="py-2.5 px-3">Role</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Google Identity</th>
              <th className="py-2.5 px-3">Project Access</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredMembers.map((member) => {
              const isSoleAdmin = member.email === 'saikirankurapti@gmail.com' || member.role === 'ADMIN';
              const isAshwin = member.email === 'ashwin.zerokost@gmail.com';
              const hasGoogleConn = (member.googleConnections && member.googleConnections.length > 0) ||
                                    (member.authAllowlists && member.authAllowlists.some((a) => a.provider === 'GOOGLE' && a.status === 'ACTIVE'));
              const googleSubId = (member.googleConnections?.[0] as any)?.googleUserId ||
                                  (member.googleConnections?.[0] as any)?.googleSubjectId ||
                                  member.authAllowlists?.find((a) => a.provider === 'GOOGLE')?.externalIdentityId;
              const projectList = member.projectMemberships?.map((pm) => pm.project.name) || [];

              return (
                <tr key={member.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center space-x-2.5">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.fullName}
                          className="w-7 h-7 rounded-full border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                          {member.fullName[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-200">{member.fullName}</span>
                          {isSoleAdmin && (
                            <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-[9px] font-bold">
                              PRIMARY ADMIN
                            </span>
                          )}
                          {isAshwin && (
                            <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-[9px] font-bold">
                              CTO / MANAGER
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono block">{member.email}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-2.5 px-3 font-mono">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        member.role === 'ADMIN'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : member.role === 'PROJECT_MANAGER'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {member.role === 'PROJECT_MANAGER' ? 'CTO / MANAGER' : member.role}
                    </span>
                  </td>

                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        member.isActive !== false
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {member.isActive !== false ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          <span>ACTIVE</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-2.5 h-2.5 text-slate-400" />
                          <span>DEACTIVATED</span>
                        </>
                      )}
                    </span>
                  </td>

                  <td className="py-2.5 px-3 font-mono text-[11px]">
                    {hasGoogleConn ? (
                      <div>
                        <span className="text-emerald-400 flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Linked (OAuth)</span>
                        </span>
                        {googleSubId && (
                          <span className="text-[9px] text-slate-500 block truncate max-w-[140px]" title={googleSubId}>
                            Sub: {googleSubId}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-600 italic">No Identity</span>
                    )}
                  </td>

                  <td className="py-2.5 px-3">
                    {projectList.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {projectList.slice(0, 2).map((p, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded"
                          >
                            {p}
                          </span>
                        ))}
                        {projectList.length > 2 && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            +{projectList.length - 2} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-600 italic text-[11px]">No Projects Assigned</span>
                    )}
                  </td>

                  <td className="py-2.5 px-3 text-right space-x-1.5">
                    {/* Role Change Button */}
                    <button
                      onClick={() => openRoleModal(member)}
                      disabled={isSoleAdmin}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                      title={isSoleAdmin ? 'Sole Admin role cannot be modified' : 'Change member role'}
                    >
                      Change Role
                    </button>

                    {/* Projects Access Button */}
                    <button
                      onClick={() => openProjectModal(member)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded text-[11px]"
                      title="Manage project access"
                    >
                      Projects
                    </button>

                    {/* Deactivate / Reactivate Button */}
                    {member.isActive !== false ? (
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setIsDeactivateModalOpen(true);
                        }}
                        disabled={isSoleAdmin}
                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isSoleAdmin ? 'Cannot deactivate sole Administrator' : 'Deactivate member'}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(member)}
                        className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded text-[11px]"
                        title="Reactivate member profile"
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                  No team members match the filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Change Role with Safety Confirmation Barrier */}
      {isRoleModalOpen && selectedMember && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-slate-100">Change Role & Privileges</h3>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Target Member:</span>
                <span className="text-slate-200 font-bold">{selectedMember.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-300">{selectedMember.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Role:</span>
                <span className="text-blue-400 font-bold">{selectedMember.role}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-medium block">Select New Role:</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="TEAM_MEMBER">TEAM MEMBER (Default Standard Access)</option>
                <option value="PROJECT_MANAGER">CTO / MANAGER (Management & Price Allocation)</option>
                <option value="ADMIN">ADMIN (Full Control, Security, & Credentials)</option>
              </select>
            </div>

            {targetRole === 'ADMIN' && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-rose-300 space-y-2">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Grant ADMIN Access Warning</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  This grants full organization administration, security allowlists, user management, credentials, and sensitive commercial data access.
                </p>
                <div className="space-y-1 pt-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">
                    Type "CONFIRM ADMIN" to proceed:
                  </label>
                  <input
                    type="text"
                    value={roleConfirmationText}
                    onChange={(e) => setRoleConfirmationText(e.target.value)}
                    placeholder="CONFIRM ADMIN"
                    className="w-full bg-slate-950 border border-rose-500/50 rounded px-2 py-1 text-slate-200 placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {targetRole === 'PROJECT_MANAGER' && targetRole !== selectedMember.role && (
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded text-blue-300">
                <span className="font-bold block mb-0.5">Elevate to CTO / Manager:</span>
                This will grant project management capabilities and Price Allocation visibility.
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing || (targetRole === 'ADMIN' && roleConfirmationText !== 'CONFIRM ADMIN')}
                onClick={handleRoleChange}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs font-semibold"
              >
                {isProcessing ? 'Updating...' : 'Confirm Role Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Project Access Assignments */}
      {isProjectModalOpen && selectedMember && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FolderKanban className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-100">Project Membership Access</h3>
              </div>
              <button
                onClick={() => setIsProjectModalOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400 text-xs">
              Configure project memberships for <span className="text-slate-200 font-bold">{selectedMember.fullName}</span>.
              Access to work items, roadmaps, and tasks is strictly partitioned by project.
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {projects.map((proj) => {
                const isSelected = selectedProjectIds.includes(proj.id);
                return (
                  <label
                    key={proj.id}
                    className={`flex items-center justify-between p-2.5 rounded border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-slate-100'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            setSelectedProjectIds((prev) => prev.filter((id) => id !== proj.id));
                          } else {
                            setSelectedProjectIds((prev) => [...prev, proj.id]);
                          }
                        }}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                      />
                      <div>
                        <span className="font-bold block">{proj.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">{proj.key}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500">{proj.status}</span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleProjectAssignment}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-semibold"
              >
                {isProcessing ? 'Saving...' : 'Save Project Memberships'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Deactivate Confirmation */}
      {isDeactivateModalOpen && selectedMember && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center space-x-2 text-rose-400 border-b border-slate-800 pb-3">
              <UserX className="w-4 h-4" />
              <h3 className="font-bold text-sm">Deactivate Team Member</h3>
            </div>

            <p className="text-slate-300 leading-relaxed">
              Are you sure you want to deactivate <span className="font-bold text-slate-100">{selectedMember.fullName}</span>?
            </p>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded text-[11px] space-y-1.5 text-slate-400">
              <div className="text-emerald-400 font-semibold flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Historical work & artifacts preserved</span>
              </div>
              <p>Tasks, chat messages, meetings, and activity records will remain permanently intact.</p>
              <div className="text-rose-400 font-semibold flex items-center space-x-1.5 pt-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>Login immediately suspended</span>
              </div>
              <p>The user will be immediately blocked from authenticating or accessing organization APIs.</p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeactivateModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleDeactivate}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded text-xs font-semibold"
              >
                {isProcessing ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
