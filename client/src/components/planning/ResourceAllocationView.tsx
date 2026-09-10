import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Clock,
  X,
  RefreshCw,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { User, ResourceAllocation } from '../../types';

interface ResourceAllocationViewProps {
  projectId: string;
}

export const ResourceAllocationView: React.FC<ResourceAllocationViewProps> = ({ projectId }) => {
  const { user: currentUser } = useAuth();
  const [allocations, setAllocations] = useState<ResourceAllocation[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState('Senior Engineer');
  const [skill, setSkill] = useState('Backend');
  const [allocationPercentage, setAllocationPercentage] = useState(50);
  const [allocatedHours, setAllocatedHours] = useState(80);
  const [costRate, setCostRate] = useState<number>(1000);
  const [billingRate, setBillingRate] = useState<number>(2500);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSeeCost =
    currentUser?.role === 'OWNER' ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'PROJECT_MANAGER';

  const loadData = () => {
    setIsLoading(true);
    Promise.all([
      fetchApi<ResourceAllocation[]>(`/projects/${projectId}/resources`),
      fetchApi<User[]>('/organization/members'),
    ])
      .then(([allocs, mems]) => {
        setAllocations(allocs);
        setMembers(mems);
        if (mems.length > 0 && !selectedUserId) {
          setSelectedUserId(mems[0].id);
        }
      })
      .catch((err) => console.error('Failed to load resource allocations:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (projectId) loadData();
  }, [projectId]);

  const handlePercentageChange = (val: number) => {
    setAllocationPercentage(val);
    // Standard 160h month
    setAllocatedHours(Math.round((val / 100) * 160));
  };

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !startDate || !endDate) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await fetchApi(`/projects/${projectId}/resources/allocate`, {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedUserId,
          role,
          skill,
          allocationPercentage: Number(allocationPercentage),
          allocatedHours: Number(allocatedHours),
          costRate: canSeeCost ? Number(costRate) : undefined,
          billingRate: Number(billingRate),
          startDate,
          endDate,
        }),
      });

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to allocate resource');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAllocation = async (id: string) => {
    if (!confirm('Are you sure you want to remove this resource allocation?')) return;
    try {
      await fetchApi(`/resource-allocations/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove allocation');
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const totalAllocatedHours = allocations.reduce((sum, a) => sum + (a.allocatedHours || 0), 0);
  const totalCost = allocations.reduce((sum, a) => sum + (a.allocatedHours || 0) * (a.costRate || 0), 0);

  // Group allocations by distinct User
  const groupedByUser = React.useMemo(() => {
    const map = new Map<string, { user: User; allocations: ResourceAllocation[]; totalPercentage: number; totalHours: number }>();

    for (const alloc of allocations) {
      if (!alloc.userId || !alloc.user) continue;
      if (!map.has(alloc.userId)) {
        map.set(alloc.userId, {
          user: alloc.user,
          allocations: [],
          totalPercentage: 0,
          totalHours: 0,
        });
      }
      const group = map.get(alloc.userId)!;
      group.allocations.push(alloc);
      group.totalPercentage += alloc.allocationPercentage || 0;
      group.totalHours += alloc.allocatedHours || 0;
    }

    return Array.from(map.values());
  }, [allocations]);

  const uniqueAllocatedUsersCount = groupedByUser.length;

  const filteredGroups = groupedByUser.filter((g) => {
    const q = searchQuery.toLowerCase();
    const matchesName = g.user.fullName.toLowerCase().includes(q) || g.user.email.toLowerCase().includes(q);
    const matchesRole = g.allocations.some((a) => (a.role || '').toLowerCase().includes(q));
    const matchesSkill = g.allocations.some((a) => (a.skill || '').toLowerCase().includes(q));
    return matchesName || matchesRole || matchesSkill;
  });

  return (
    <div className="space-y-4 text-xs">
      {/* Overview Metric Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Allocated Resources
          </div>
          <div className="text-xl font-bold text-slate-100">{uniqueAllocatedUsersCount}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Unique team members</div>
        </div>

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Total Allocated Hours
          </div>
          <div className="text-xl font-bold text-blue-400">{totalAllocatedHours}h</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Effort committed</div>
        </div>

        {canSeeCost && (
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
              Estimated Internal Cost
            </div>
            <div className="text-xl font-bold text-amber-400 font-mono">
              ₹{totalCost.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Hours × Cost Rate</div>
          </div>
        )}

        <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Over-Allocation Alerts
          </div>
          <div className="text-xl font-bold text-slate-100">
            {groupedByUser.filter((g) => g.totalPercentage > 100).length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Capacity conflicts (&gt;100%)</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-slate-200">Price & Resource Allocation</h3>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              {uniqueAllocatedUsersCount} {uniqueAllocatedUsersCount === 1 ? 'member' : 'members'}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search resource, role, skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
            />
            {canSeeCost && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors flex items-center space-x-1.5 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Allocate Resource</span>
              </button>
            )}
            <button
              onClick={loadData}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg shrink-0"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                <th className="p-3">Team Member</th>
                <th className="p-3">Role & Skill</th>
                <th className="p-3 text-right">Total Allocation</th>
                <th className="p-3 text-right">Total Hours</th>
                {canSeeCost && <th className="p-3 text-right">Cost Rate</th>}
                {canSeeCost && <th className="p-3 text-right">Billing Rate</th>}
                <th className="p-3">Allocations Breakdown</th>
                {canSeeCost && <th className="p-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={canSeeCost ? 8 : 5} className="p-8 text-center text-slate-500">
                    Loading allocations...
                  </td>
                </tr>
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={canSeeCost ? 8 : 5} className="p-8 text-center text-slate-500 italic">
                    {searchQuery
                      ? 'No resources match your search filter.'
                      : 'No resource allocations yet. Allocate an existing team member to this project.'}
                  </td>
                </tr>
              ) : (
                filteredGroups.map((group) => {
                  const isOver = group.totalPercentage > 100;

                  return (
                    <tr key={group.user.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 align-top">
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={group.user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover shrink-0"
                          />
                          <div>
                            <div className="font-semibold text-slate-200">{group.user.fullName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {group.user.jobTitle || group.user.role}
                            </div>
                            <div className="text-[10px] text-slate-500">{group.user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3 align-top">
                        <div className="space-y-1">
                          {group.allocations.map((a) => (
                            <div key={a.id} className="flex items-center space-x-1.5">
                              <span className="font-medium text-slate-300">{a.role || 'Engineer'}</span>
                              {a.skill && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  {a.skill}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="p-3 align-top text-right font-mono">
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                            isOver
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-200'
                          }`}
                        >
                          {group.totalPercentage}%
                        </span>
                        {isOver && (
                          <div className="text-[9px] text-rose-400 font-bold tracking-tight mt-0.5">
                            OVER-ALLOCATED
                          </div>
                        )}
                      </td>

                      <td className="p-3 align-top text-right font-mono font-bold text-blue-400">
                        {group.totalHours}h
                      </td>

                      {canSeeCost && (
                        <td className="p-3 align-top text-right font-mono text-amber-400">
                          {group.allocations[0]?.costRate ? `₹${group.allocations[0].costRate}/h` : '—'}
                        </td>
                      )}

                      {canSeeCost && (
                        <td className="p-3 align-top text-right font-mono text-emerald-400 font-semibold">
                          {group.allocations[0]?.billingRate ? `₹${group.allocations[0].billingRate}/h` : '—'}
                        </td>
                      )}

                      <td className="p-3 align-top">
                        <div className="space-y-1.5">
                          {group.allocations.map((a) => (
                            <div
                              key={a.id}
                              className="p-1.5 bg-slate-900/80 rounded border border-slate-800 flex items-center justify-between gap-2"
                            >
                              <div>
                                <span className="font-bold text-slate-200 font-mono">{a.allocationPercentage}%</span>
                                <span className="text-slate-400 ml-1">({a.allocatedHours}h)</span>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {new Date(a.startDate).toLocaleDateString()} – {new Date(a.endDate).toLocaleDateString()}
                                </div>
                              </div>
                              {canSeeCost && (
                                <button
                                  onClick={() => handleDeleteAllocation(a.id)}
                                  className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                                  title="Remove this allocation"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>

                      {canSeeCost && (
                        <td className="p-3 align-top text-center">
                          <button
                            onClick={() => {
                              setSelectedUserId(group.user.id);
                              setIsModalOpen(true);
                            }}
                            className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-blue-400 rounded transition-colors whitespace-nowrap"
                          >
                            + Add Allocation
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocate Resource Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
              <h3 className="text-sm font-bold text-slate-100">Allocate Team Member</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAllocation} className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-lg text-rose-300">
                  {error}
                </div>
              )}

              {/* User Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Team Member <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                  required
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.role}) - {m.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Role and Skill */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Project Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Lead Architect, QA"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Primary Skill
                  </label>
                  <input
                    type="text"
                    value={skill}
                    onChange={(e) => setSkill(e.target.value)}
                    placeholder="e.g. React, Databricks, SQL"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
                    required
                  />
                </div>
              </div>

              {/* Allocation % and Hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Allocation Percentage (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="150"
                    value={allocationPercentage}
                    onChange={(e) => handlePercentageChange(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Allocated Hours (Month)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={allocatedHours}
                    onChange={(e) => setAllocatedHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 gap-3">
                {canSeeCost && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Internal Cost Rate (₹/h)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={costRate}
                      onChange={(e) => setCostRate(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Billing Rate (₹/h)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={billingRate}
                    onChange={(e) => setBillingRate(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                  {isSubmitting ? 'Allocating...' : 'Allocate Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
