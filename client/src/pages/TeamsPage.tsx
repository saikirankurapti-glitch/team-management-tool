import React, { useState, useEffect } from 'react';
import {
  Users,
  Edit2,
  Check,
  X,
  Sparkles,
  Briefcase,
  Layers,
  ChevronRight,
  ShieldCheck,
  Search,
  ExternalLink,
} from 'lucide-react';
import { fetchApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TeamWorkloadItem, Team, User } from '../types';

export const TeamsPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [workload, setWorkload] = useState<TeamWorkloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Editing modal state
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSkillsText, setEditSkillsText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Profile drawer state
  const [drawerMember, setDrawerMember] = useState<any | null>(null);

  const canEdit =
    currentUser?.role === 'OWNER' ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'PROJECT_MANAGER';

  const loadAll = () => {
    setIsLoading(true);
    Promise.all([
      fetchApi<any[]>('/organization/members'),
      fetchApi<Team[]>('/teams'),
      fetchApi<TeamWorkloadItem[]>('/teams/workload'),
    ])
      .then(([mems, teamData, workloadData]) => {
        setMembers(mems);
        setTeams(teamData);
        setWorkload(workloadData);
      })
      .catch((err) => console.error('Failed to load team data:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openEditModal = (member: any) => {
    setEditingMember(member);
    setEditFullName(member.fullName);
    setEditJobTitle(member.jobTitle || '');
    setEditDepartment(member.department || 'Engineering');
    setEditRole(member.role || 'TEAM_MEMBER');
    setEditSkillsText(
      (member.skills || []).map((s: any) => s.skillName || s).join(', ')
    );
    setEditError(null);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setIsSaving(true);
    setEditError(null);

    const skillsArray = editSkillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ skillName: name, proficiency: 'INTERMEDIATE' }));

    try {
      await fetchApi(`/organization/members/${editingMember.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          fullName: editFullName,
          jobTitle: editJobTitle,
          department: editDepartment,
          role: editRole,
          skills: skillsArray,
        }),
      });

      setEditingMember(null);
      loadAll();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update member');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="editorial-eyebrow">[ TEAMS & DIRECTORY ]</div>
        <div className="text-xl font-bold tracking-tight text-ink">Loading engineering roster...</div>
        <div className="h-64 bg-surface border border-borderWarm rounded-2xl animate-pulse" />
      </div>
    );
  }

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      m.fullName?.toLowerCase().includes(q) ||
      m.jobTitle?.toLowerCase().includes(q) ||
      m.department?.toLowerCase().includes(q) ||
      (m.skills || []).some((s: any) =>
        (s.skillName || s).toLowerCase().includes(q)
      )
    );
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Editorial Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-borderWarm">
        <div>
          <div className="editorial-eyebrow mb-1.5">[ ORGANIZATION ROSTER ]</div>
          <h1 className="editorial-headline text-2xl md:text-3xl font-black text-ink">
            Team Directory & Workload
          </h1>
          <p className="text-xs text-ink/65 max-w-2xl font-sans mt-1">
            Enterprise member profiles, skill matrices, active bandwidth, and functional team units.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-ink/40 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search member, title, skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-warm text-xs pl-8 pr-3 py-1.5 rounded-full w-48 sm:w-64"
            />
          </div>
          <span className="badge-pill bg-lime/30 text-ink text-xs font-bold">
            {filteredMembers.length} {filteredMembers.length === 1 ? 'Member' : 'Members'}
          </span>
        </div>
      </div>

      {/* TEAM DIRECTORY (6 Real Members) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-black text-ink uppercase tracking-wider flex items-center space-x-2">
            <Briefcase className="w-4 h-4 text-olive" />
            <span>Team Members Directory</span>
          </div>
          <span className="editorial-eyebrow text-[10px]">
            Real enterprise identities • Zero placeholders
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className="card-cream p-5 space-y-4 hover:border-olive transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3.5">
                    <img
                      src={
                        member.avatarUrl ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                      }
                      alt=""
                      className="w-12 h-12 rounded-full object-cover shrink-0 border-2 border-borderWarm"
                    />
                    <div>
                      <div className="font-bold text-ink text-sm">{member.fullName}</div>
                      <div className="text-olive font-semibold text-xs tracking-tight">
                        {member.jobTitle || 'Engineer'}
                      </div>
                      <div className="text-[11px] text-ink/60">{member.department || 'Engineering'}</div>
                    </div>
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => openEditModal(member)}
                      className="p-1.5 text-ink/50 hover:text-olive rounded-full hover:bg-canvas transition-colors"
                      title="Edit Member"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Skills Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(member.skills || []).length > 0 ? (
                    member.skills.map((s: any, idx: number) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2.5 py-0.5 rounded-full font-mono bg-canvas text-ink border border-borderWarm font-medium"
                      >
                        {s.skillName || s}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-ink/50 italic">No skills listed</span>
                  )}
                </div>
              </div>

              {/* Footer info & View Profile */}
              <div className="pt-3 border-t border-borderWarm flex items-center justify-between text-[11px] text-ink/60 font-mono">
                <span className="px-2 py-0.5 bg-canvas border border-borderWarm rounded-full text-ink font-semibold">
                  {member.role}
                </span>
                <button
                  onClick={() => setDrawerMember(member)}
                  className="text-olive hover:text-ink font-bold flex items-center space-x-1 font-sans transition-colors"
                >
                  <span>View Profile</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Teams Overview Cards */}
      <div className="space-y-2 pt-2">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
          <Layers className="w-3.5 h-3.5 text-teal-400" />
          <span>Functional Teams</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {teams.map((team) => (
            <div key={team.id} className="ent-panel p-3.5 space-y-2 bg-slate-900/60">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <div>
                  <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">{team.name}</h2>
                  <p className="text-[10px] text-slate-500">{team.description}</p>
                </div>
                <span className="text-[10px] font-mono font-bold text-blue-500 bg-blue-500/10 px-1.5 py-0.2 rounded">
                  Capacity: {team.capacityHours} h/wk
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">
                  Members ({team.members?.length || 0})
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {team.members?.map((m) => (
                    <div
                      key={m.user.id}
                      className="flex items-center space-x-2 p-1.5 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800"
                    >
                      <img
                        src={m.user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                      />
                      <div className="truncate min-w-0">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {m.user.fullName}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono">
                          {m.user.jobTitle || m.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Individual Workload Matrix Table */}
      <div className="ent-panel overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
          Member Workload Allocation
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="ent-table-header">
              <th className="p-2.5">Member</th>
              <th className="p-2.5">Job Title & Role</th>
              <th className="p-2.5">Active Tasks</th>
              <th className="p-2.5">Overdue</th>
              <th className="p-2.5">Blocked</th>
              <th className="p-2.5">Capacity Utilization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {workload.map((item) => {
              const isOverloaded = item.workloadPercentage >= 90;

              return (
                <tr key={item.userId} className="ent-table-row text-slate-800 dark:text-slate-200">
                  <td className="p-2.5 font-semibold">
                    <div className="flex items-center space-x-2">
                      <img
                        src={
                          item.avatarUrl ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                        }
                        alt=""
                        className="w-6 h-6 rounded-full object-cover shrink-0"
                      />
                      <span>{item.fullName}</span>
                    </div>
                  </td>
                  <td className="p-2.5 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                    {item.role}
                  </td>
                  <td className="p-2.5 font-mono font-bold text-blue-500 whitespace-nowrap">
                    {item.activeCount}
                  </td>
                  <td className="p-2.5 font-mono font-bold text-rose-500 whitespace-nowrap">
                    {item.overdueCount}
                  </td>
                  <td className="p-2.5 font-mono font-bold text-amber-500 whitespace-nowrap">
                    {item.blockedCount}
                  </td>
                  <td className="p-2.5 w-56 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded overflow-hidden">
                        <div
                          className={`h-full transition-all ${isOverloaded ? 'bg-rose-500' : 'bg-blue-600'}`}
                          style={{ width: `${item.workloadPercentage}%` }}
                        />
                      </div>
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          isOverloaded ? 'text-rose-500' : 'text-slate-400'
                        }`}
                      >
                        {item.workloadPercentage}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MEMBER EDIT MODAL */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
              <h3 className="text-sm font-bold text-slate-100">Edit Team Member</h3>
              <button onClick={() => setEditingMember(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-lg text-rose-300">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                  placeholder="e.g. AI/ML Developer · Agentic AI Developer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Platform Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                  >
                    <option value="TEAM_MEMBER">TEAM_MEMBER</option>
                    <option value="PROJECT_MANAGER">PROJECT_MANAGER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="OWNER">OWNER</option>
                    <option value="VIEWER">VIEWER</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Skills (comma separated)
                </label>
                <input
                  type="text"
                  value={editSkillsText}
                  onChange={(e) => setEditSkillsText(e.target.value)}
                  placeholder="e.g. Python, Agentic AI, Cloud Engineering"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MEMBER PROFILE DRAWER */}
      {drawerMember && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col justify-between p-6 space-y-6 overflow-y-auto shadow-2xl">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Member Profile</span>
                </h3>
                <button onClick={() => setDrawerMember(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center space-x-3">
                <img
                  src={
                    drawerMember.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                  }
                  alt=""
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-500/40"
                />
                <div>
                  <h2 className="text-base font-bold text-slate-100">{drawerMember.fullName}</h2>
                  <p className="text-blue-400 font-medium text-xs">{drawerMember.jobTitle || 'Engineer'}</p>
                  <p className="text-slate-500 text-[11px]">{drawerMember.department || 'Engineering'}</p>
                </div>
              </div>

              {/* Role & Status */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 text-[10px] block">Role</span>
                  <span className="text-slate-200 font-bold">{drawerMember.role}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Status</span>
                  <span className="text-emerald-400 font-bold">{drawerMember.status}</span>
                </div>
              </div>

              {/* Skills */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Skills & Specializations
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(drawerMember.skills || []).map((s: any, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono text-[10px]"
                    >
                      {s.skillName || s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Current Project Allocations */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Active Project Allocations
                </span>
                {(drawerMember.resourceAllocations || []).length === 0 ? (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 text-slate-500 italic text-[11px]">
                    No project allocations currently assigned.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {drawerMember.resourceAllocations.map((a: any) => (
                      <div
                        key={a.id}
                        className="p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-[11px]"
                      >
                        <div>
                          <div className="font-bold text-slate-200">{a.project?.name || 'Project'}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {a.role} • {a.skill || 'General'}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-blue-400">{a.allocationPercentage}%</span>
                          <span className="text-slate-500 text-[10px] block">{a.allocatedHours}h</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assigned Work Items */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Assigned Active Work ({(drawerMember.assignedItems || []).length})
                </span>
                {(drawerMember.assignedItems || []).length === 0 ? (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 text-slate-500 italic text-[11px]">
                    No active tasks assigned.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {drawerMember.assignedItems.slice(0, 5).map((item: any) => (
                      <div
                        key={item.id}
                        className="p-2 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-[11px]"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-mono text-blue-400 text-[10px] mr-1.5 font-bold">
                            {item.humanId}
                          </span>
                          <span className="text-slate-300 truncate">{item.title}</span>
                        </div>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono text-[9px] shrink-0">
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              {canEdit && (
                <button
                  onClick={() => {
                    const m = drawerMember;
                    setDrawerMember(null);
                    openEditModal(m);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium flex items-center space-x-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Edit Profile</span>
                </button>
              )}
              <button
                onClick={() => setDrawerMember(null)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium ml-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

