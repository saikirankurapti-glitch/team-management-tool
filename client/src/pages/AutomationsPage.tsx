import React, { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Clock,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { canAccessAdmin, canAccessManagement } from '../utils/rbac';

export const AutomationsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = canAccessAdmin(user?.role);
  const isManager = canAccessManagement(user?.role);
  const canManage = isAdmin || isManager;

  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rules' | 'history' | 'metrics'>('rules');

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');
  const [trigger, setTrigger] = useState('GITHUB_PR_OPENED');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [throttleMinutes, setThrottleMinutes] = useState<number>(0);

  // Structured Condition Builder State
  const [conditionField, setConditionField] = useState('status');
  const [conditionOp, setConditionOp] = useState('EQUALS');
  const [conditionVal, setConditionVal] = useState('');

  // Structured Action Builder State
  const [actionType, setActionType] = useState('CHANGE_WORK_ITEM_STATUS');
  const [actionTargetStatus, setActionTargetStatus] = useState('CODE_REVIEW');
  const [actionMessage, setActionMessage] = useState('');

  // Dry-Run / Test Rule State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Loading & Action feedback
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadData = () => {
    setIsLoading(true);
    Promise.all([
      fetchApi<any[]>('/automations'),
      fetchApi<any[]>('/automations/logs'),
      fetchApi<any>('/automations/metrics').catch(() => null),
      fetchApi<any[]>('/projects').catch(() => []),
    ])
      .then(([rulesData, logsData, metricsData, projectsData]) => {
        setRules(rulesData || []);
        setLogs(logsData || []);
        setMetrics(metricsData || null);
        setProjects(projectsData || []);
      })
      .catch((err) => console.error('[Automations] Load error:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleRule = async (id: string, currentStatus: boolean) => {
    try {
      await fetchApi(`/automations/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !currentStatus }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete automation rule "${name}"?`)) return;
    try {
      await fetchApi(`/automations/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete rule');
    }
  };

  const handleDryRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const conditions = conditionVal.trim()
        ? {
            logicalOperator: 'AND',
            rules: [{ field: conditionField, operator: conditionOp, value: conditionVal.trim() }],
          }
        : {};

      const actions = [
        {
          type: actionType,
          targetStatus: actionType === 'CHANGE_WORK_ITEM_STATUS' ? actionTargetStatus : undefined,
          message: actionMessage || undefined,
        },
      ];

      const res = await fetchApi('/automations/test', {
        method: 'POST',
        body: JSON.stringify({
          trigger,
          projectId: selectedProjectId || undefined,
          conditions,
          actions,
        }),
      });
      setTestResult(res);
    } catch (err: any) {
      alert(err.message || 'Dry-run test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    try {
      const conditions = conditionVal.trim()
        ? {
            logicalOperator: 'AND',
            rules: [{ field: conditionField, operator: conditionOp, value: conditionVal.trim() }],
          }
        : {};

      const actions = [
        {
          type: actionType,
          targetStatus: actionType === 'CHANGE_WORK_ITEM_STATUS' ? actionTargetStatus : undefined,
          message: actionMessage || undefined,
        },
      ];

      const payload = {
        name: ruleName.trim(),
        description: ruleDesc.trim() || undefined,
        trigger,
        projectId: selectedProjectId || undefined,
        throttleMinutes: Number(throttleMinutes) || 0,
        conditions,
        actions,
      };

      if (editingRuleId) {
        await fetchApi(`/automations/${editingRuleId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await fetchApi('/automations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsModalOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save automation rule');
    }
  };

  const handleRetryLog = async (logId: string) => {
    try {
      setActionFeedback(`Retrying execution...`);
      await fetchApi(`/automations/logs/${logId}/retry`, { method: 'POST' });
      setActionFeedback(`Retry executed successfully.`);
      setTimeout(() => setActionFeedback(null), 3000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to retry automation execution');
      setActionFeedback(null);
    }
  };

  const resetForm = () => {
    setEditingRuleId(null);
    setRuleName('');
    setRuleDesc('');
    setTrigger('GITHUB_PR_OPENED');
    setSelectedProjectId('');
    setThrottleMinutes(0);
    setConditionField('status');
    setConditionOp('EQUALS');
    setConditionVal('');
    setActionType('CHANGE_WORK_ITEM_STATUS');
    setActionTargetStatus('CODE_REVIEW');
    setActionMessage('');
    setTestResult(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs font-mono text-ink-muted">
        <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
        Loading Workflow Automation Engine...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full text-xs bg-canvas text-ink-primary">
      {/* Header Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border-warm pb-4 gap-2">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-olive-soft flex items-center justify-center text-olive-dark shadow-sm">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-ink-primary">Workflow Automation Engine</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-olive-soft text-olive-dark font-bold uppercase tracking-wider">
                Phase 53 Enterprise
              </span>
            </div>
            <p className="text-ink-muted text-xs">
              Event-driven rule evaluation connecting Work Items, GitHub, Sprints, Capacity, and Notifications
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {actionFeedback && (
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded border border-emerald-300">
              {actionFeedback}
            </span>
          )}
          {canManage ? (
            <button
              onClick={openCreateModal}
              className="btn-pill-primary btn-pill-sm flex items-center space-x-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Rule</span>
            </button>
          ) : (
            <span className="text-[11px] font-mono text-ink-muted italic border border-border-warm px-2.5 py-1 rounded-full">
              Read-Only (Team Member)
            </span>
          )}
        </div>
      </div>

      {/* Metrics Banner */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card-cream p-3 rounded-xl border border-border-warm">
            <span className="text-[10px] text-ink-muted font-mono uppercase block">Active Rules</span>
            <span className="text-lg font-bold text-ink-primary font-mono">{metrics.activeRules} / {metrics.totalRules}</span>
          </div>
          <div className="card-cream p-3 rounded-xl border border-border-warm">
            <span className="text-[10px] text-ink-muted font-mono uppercase block">Total Executions</span>
            <span className="text-lg font-bold text-ink-primary font-mono">{metrics.totalExecutions}</span>
          </div>
          <div className="card-cream p-3 rounded-xl border border-border-warm">
            <span className="text-[10px] text-ink-muted font-mono uppercase block">Success Rate</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">{metrics.successRatePercentage}%</span>
          </div>
          <div className="card-cream p-3 rounded-xl border border-border-warm">
            <span className="text-[10px] text-ink-muted font-mono uppercase block">Avg Duration</span>
            <span className="text-lg font-bold text-olive-dark font-mono">{metrics.avgDurationMs}ms</span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex space-x-1 border-b border-border-warm pb-1">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-3 py-1.5 font-bold text-xs rounded-t-lg transition-colors ${
            activeTab === 'rules'
              ? 'bg-olive text-white shadow-xs'
              : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-secondary'
          }`}
        >
          Automation Rules ({rules.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1.5 font-bold text-xs rounded-t-lg transition-colors ${
            activeTab === 'history'
              ? 'bg-olive text-white shadow-xs'
              : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-secondary'
          }`}
        >
          Execution History ({logs.length})
        </button>
      </div>

      {/* TAB 1: AUTOMATION RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => {
              let parsedConditions: any = {};
              let parsedActions: any[] = [];
              try {
                parsedConditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
                parsedActions = typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions;
              } catch (e) {}

              return (
                <div key={rule.id} className="card-cream p-4 space-y-3 rounded-xl border border-border-warm shadow-xs">
                  <div className="flex items-center justify-between border-b border-border-warm pb-2">
                    <div>
                      <div className="font-bold text-ink-primary text-sm flex items-center space-x-2">
                        <span>{rule.name}</span>
                        {rule.project && (
                          <span className="px-2 py-0.5 text-[9px] font-mono bg-canvas-secondary border border-border-warm rounded text-ink-secondary">
                            {rule.project.key}
                          </span>
                        )}
                      </div>
                      {rule.description && (
                        <p className="text-[11px] text-ink-muted line-clamp-1">{rule.description}</p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {canManage && (
                        <>
                          <button
                            onClick={() => handleToggleRule(rule.id, rule.isEnabled)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center space-x-1 transition-colors ${
                              rule.isEnabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {rule.isEnabled ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                            <span>{rule.isEnabled ? 'Active' : 'Paused'}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id, rule.name)}
                            className="text-ink-muted hover:text-red-500 p-1 transition-colors"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* WHEN - IF - THEN Builder Preview Box */}
                  <div className="p-3 bg-canvas-secondary rounded-xl border border-border-warm font-mono text-[11px] text-ink-secondary space-y-1.5">
                    <div>
                      <span className="text-olive-dark font-bold">WHEN:</span>{' '}
                      <span className="text-ink-primary font-semibold">{rule.trigger}</span>
                    </div>

                    {parsedConditions?.rules && parsedConditions.rules.length > 0 && (
                      <div>
                        <span className="text-amber-600 dark:text-amber-400 font-bold">IF:</span>{' '}
                        {parsedConditions.rules.map((r: any, idx: number) => (
                          <span key={idx} className="bg-canvas px-1.5 py-0.5 rounded border border-border-warm mr-1 text-[10px]">
                            {r.field} {r.operator} "{r.value}"
                          </span>
                        ))}
                      </div>
                    )}

                    <div>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">THEN:</span>{' '}
                      {parsedActions.map((act: any, idx: number) => (
                        <span key={idx} className="bg-canvas px-1.5 py-0.5 rounded border border-border-warm mr-1 text-[10px]">
                          {act.type === 'CHANGE_WORK_ITEM_STATUS'
                            ? `Move to ${act.targetStatus}`
                            : act.type}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between font-mono text-[10px] text-ink-muted pt-1">
                    <span>Executions: {rule.executionCount || 0}</span>
                    <span>Created by {rule.createdBy?.fullName || 'Sai Kiran (Admin)'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {rules.length === 0 && (
            <div className="card-cream p-12 text-center rounded-xl border border-border-warm text-ink-muted space-y-2">
              <Zap className="w-8 h-8 text-olive/50 mx-auto" />
              <div className="text-sm font-bold text-ink-primary">No Automation Rules Configured</div>
              <p className="text-xs max-w-sm mx-auto">
                Connect GitHub events, work item state transitions, and notifications with structured rules.
              </p>
              {canManage && (
                <button onClick={openCreateModal} className="btn-pill-primary btn-pill-sm inline-flex items-center space-x-1 mt-2">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create First Automation</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXECUTION HISTORY */}
      {activeTab === 'history' && (
        <div className="panel-cream overflow-hidden rounded-xl border border-border-warm">
          <div className="p-3.5 border-b border-border-warm font-bold text-xs uppercase tracking-wider text-ink-primary bg-canvas-secondary flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5 text-olive" />
              <span>Execution Audit History</span>
            </div>
            <button
              onClick={loadData}
              className="text-[11px] font-mono text-ink-muted hover:text-ink-primary flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-border-warm bg-canvas-secondary/50 text-[10px] text-ink-muted uppercase">
                  <th className="p-3">Time</th>
                  <th className="p-3">Rule</th>
                  <th className="p-3">Trigger</th>
                  <th className="p-3">Result</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Actions Executed</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-warm">
                {logs.map((log) => {
                  let executedActions: string[] = [];
                  try {
                    executedActions = typeof log.actionsExecuted === 'string' ? JSON.parse(log.actionsExecuted) : log.actionsExecuted;
                  } catch (e) {}

                  return (
                    <tr key={log.id} className="hover:bg-canvas-secondary/40 transition-colors">
                      <td className="p-3 text-[11px] whitespace-nowrap text-ink-muted">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="p-3 font-semibold text-ink-primary">
                        {log.automationRule?.name || 'Deleted Rule'}
                      </td>
                      <td className="p-3 text-[11px] text-ink-secondary">
                        {log.triggerEvent}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                              : log.status === 'THROTTLED'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                          }`}
                        >
                          {log.status === 'SUCCESS' ? (
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          ) : log.status === 'THROTTLED' ? (
                            <AlertTriangle className="w-2.5 h-2.5" />
                          ) : (
                            <XCircle className="w-2.5 h-2.5" />
                          )}
                          <span>{log.status}</span>
                        </span>
                      </td>
                      <td className="p-3 text-ink-muted">{log.durationMs}ms</td>
                      <td className="p-3 text-[11px] max-w-xs truncate text-ink-secondary">
                        {log.error ? (
                          <span className="text-red-500">{log.error}</span>
                        ) : executedActions.length > 0 ? (
                          executedActions.join(', ')
                        ) : (
                          <span className="italic text-ink-muted">Conditions matched</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {canManage && log.status === 'FAILED' && (
                          <button
                            onClick={() => handleRetryLog(log.id)}
                            className="btn-pill-secondary btn-pill-sm inline-flex items-center space-x-1 text-[10px]"
                            title="Retry execution"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Retry</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {logs.length === 0 && (
              <div className="p-8 text-center text-ink-muted italic font-mono">
                No automation executions yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ENTERPRISE TECHNICAL RULE BUILDER */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="panel-cream w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden text-xs space-y-4 p-6 border border-border-warm">
            <div className="flex items-center justify-between border-b border-border-warm pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-olive" />
                <h3 className="text-base font-bold text-ink-primary">
                  {editingRuleId ? 'Edit Automation Rule' : 'Enterprise Automation Rule Builder'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-ink-muted hover:text-ink-primary text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-4">
              {/* Rule Basics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-ink-secondary">Rule Name</label>
                  <input
                    type="text"
                    required
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g. Move to Done on PR Merged"
                    className="input-warm w-full text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-ink-secondary">Scope (Project Scoped or Org-wide)</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="input-warm w-full text-xs"
                  >
                    <option value="">Organization-wide (All Projects)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        Project: [{p.key}] {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* WHEN (Trigger) */}
              <div className="p-3 bg-canvas-secondary rounded-xl border border-border-warm space-y-2">
                <div className="flex items-center space-x-1.5 text-olive-dark font-bold text-xs uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5" />
                  <span>WHEN (Trigger Event)</span>
                </div>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  className="input-warm w-full text-xs font-mono"
                >
                  <optgroup label="GitHub Integration">
                    <option value="GITHUB_PR_OPENED">GitHub Pull Request Opened</option>
                    <option value="GITHUB_PR_MERGED">GitHub Pull Request Merged</option>
                    <option value="GITHUB_COMMIT_PUSHED">GitHub Commit Pushed</option>
                  </optgroup>
                  <optgroup label="Work Item Lifecycle">
                    <option value="WORK_ITEM_STATUS_CHANGED">Work Item Status Changed</option>
                    <option value="WORK_ITEM_BLOCKED">Work Item Blocked</option>
                    <option value="WORK_ITEM_COMPLETED">Work Item Completed</option>
                    <option value="WORK_ITEM_ASSIGNEE_CHANGED">Work Item Assignee Changed</option>
                  </optgroup>
                  <optgroup label="Sprints & Capacity">
                    <option value="SPRINT_STARTED">Sprint Started</option>
                    <option value="SPRINT_COMPLETED">Sprint Completed</option>
                    <option value="CAPACITY_OVER_ALLOCATED">Resource Capacity Over-allocated (&gt;100%)</option>
                  </optgroup>
                </select>
              </div>

              {/* IF (Conditions) */}
              <div className="p-3 bg-canvas-secondary rounded-xl border border-border-warm space-y-2">
                <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <span>IF (Structured Condition)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <select
                    value={conditionField}
                    onChange={(e) => setConditionField(e.target.value)}
                    className="input-warm w-full text-xs"
                  >
                    <option value="status">status</option>
                    <option value="priority">priority</option>
                    <option value="type">type</option>
                    <option value="dueDateDays">dueDateDays</option>
                    <option value="allocationPercentage">allocationPercentage</option>
                  </select>

                  <select
                    value={conditionOp}
                    onChange={(e) => setConditionOp(e.target.value)}
                    className="input-warm w-full text-xs"
                  >
                    <option value="EQUALS">equals</option>
                    <option value="NOT_EQUALS">not equals</option>
                    <option value="CONTAINS">contains</option>
                    <option value="GREATER_THAN">&gt; (greater)</option>
                    <option value="LESS_THAN">&lt; (less)</option>
                  </select>

                  <input
                    type="text"
                    value={conditionVal}
                    onChange={(e) => setConditionVal(e.target.value)}
                    placeholder="e.g. BLOCKED or 100"
                    className="input-warm w-full text-xs"
                  />
                </div>
                <div className="text-[10px] text-ink-muted">Leave value blank to match all items without condition filtering.</div>
              </div>

              {/* THEN (Actions) */}
              <div className="p-3 bg-canvas-secondary rounded-xl border border-border-warm space-y-2">
                <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <span>THEN (Action to Execute)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="input-warm w-full text-xs font-mono"
                  >
                    <option value="CHANGE_WORK_ITEM_STATUS">Move Work Item Status</option>
                    <option value="NOTIFY_ASSIGNEE">Notify Assignee</option>
                    <option value="NOTIFY_MANAGERS">Notify Managers</option>
                    <option value="SEND_PROJECT_CHAT">Post to Project Channel</option>
                    <option value="ADD_WORK_ITEM_COMMENT">Add Work Item Comment</option>
                  </select>

                  {actionType === 'CHANGE_WORK_ITEM_STATUS' && (
                    <select
                      value={actionTargetStatus}
                      onChange={(e) => setActionTargetStatus(e.target.value)}
                      className="input-warm w-full text-xs font-mono"
                    >
                      <option value="CODE_REVIEW">CODE_REVIEW</option>
                      <option value="TESTING">TESTING</option>
                      <option value="DONE">DONE</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="BLOCKED">BLOCKED</option>
                    </select>
                  )}
                </div>

                <input
                  type="text"
                  value={actionMessage}
                  onChange={(e) => setActionMessage(e.target.value)}
                  placeholder="Custom notification / comment message (optional)"
                  className="input-warm w-full text-xs"
                />
              </div>

              {/* Throttle protection */}
              <div className="flex items-center justify-between text-[11px] text-ink-secondary">
                <span>Spam throttle (cooldown minutes):</span>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={throttleMinutes}
                  onChange={(e) => setThrottleMinutes(Number(e.target.value))}
                  className="input-warm w-20 text-xs font-mono"
                />
              </div>

              {/* Dry-Run Result Preview */}
              {testResult && (
                <div className="p-3 bg-canvas-secondary rounded-xl border border-border-warm font-mono text-[11px] space-y-1">
                  <div className="font-bold text-olive-dark">🧪 Dry-Run Simulation:</div>
                  <div>Would match: <span className="font-bold text-ink-primary">{testResult.matchedConditionsCount} items</span></div>
                  <div>Planned actions: <span className="text-emerald-600 font-semibold">{testResult.wouldExecute.join('; ')}</span></div>
                </div>
              )}

              {/* Dialog Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border-warm">
                <button
                  type="button"
                  onClick={handleDryRunTest}
                  disabled={isTesting}
                  className="btn-pill-secondary btn-pill-sm inline-flex items-center space-x-1 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{isTesting ? 'Testing...' : 'Test Rule (Dry-Run)'}</span>
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-pill-secondary btn-pill-sm"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-pill-primary btn-pill-sm">
                    {editingRuleId ? 'Save Changes' : 'Enable Automation'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

