import React, { useState, useEffect } from 'react';
import { X, GitBranch, GitFork, Copy, Check, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { fetchApi } from '../../services/api';
import { WorkItem } from '../../types';

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  workItem: WorkItem;
  onBranchCreated?: (link: any) => void;
}

export const CreateBranchModal: React.FC<CreateBranchModalProps> = ({
  isOpen,
  onClose,
  workItem,
  onBranchCreated,
}) => {
  const [repositories, setRepositories] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [baseBranch, setBaseBranch] = useState('main');
  const [branchName, setBranchName] = useState('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  // Derive initial suggested branch name
  const computeDefaultBranchName = () => {
    let prefix = 'feat';
    if (workItem.type === 'BUG') prefix = 'fix';
    else if (workItem.type === 'TASK') prefix = 'task';
    else if (workItem.type === 'FEATURE') prefix = 'feat';
    else if (workItem.type === 'USER_STORY') prefix = 'story';
    else if (workItem.type === 'EPIC') prefix = 'epic';

    const slug = workItem.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

    return `${prefix}/${workItem.humanId}-${slug}`;
  };

  useEffect(() => {
    if (!isOpen) {
      setCreatedResult(null);
      setError(null);
      return;
    }

    setBranchName(computeDefaultBranchName());
    setIsLoadingRepos(true);
    setError(null);

    // Fetch repositories
    fetchApi<any[]>('/integrations/github/repos')
      .then((repos) => {
        if (repos && repos.length > 0) {
          setRepositories(repos);
          setSelectedRepo(repos[0].name || repos[0].fullName || '');
        } else {
          setRepositories([]);
          setError('No GitHub repositories found. Please connect GitHub or check repository permissions.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch repositories. Please check GitHub connection.');
      })
      .finally(() => setIsLoadingRepos(false));
  }, [isOpen, workItem.id]);

  useEffect(() => {
    if (!selectedRepo) return;
    setIsLoadingBranches(true);
    fetchApi<any[]>(`/integrations/github/branches?repository=${encodeURIComponent(selectedRepo)}`)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.map((b) => (typeof b === 'string' ? b : b.name));
          setBranches(names);
          if (names.includes('main')) setBaseBranch('main');
          else if (names.includes('master')) setBaseBranch('master');
          else setBaseBranch(names[0]);
        } else {
          setBranches(['main', 'master']);
          setBaseBranch('main');
        }
      })
      .catch(() => {
        setBranches(['main', 'master', 'develop']);
      })
      .finally(() => setIsLoadingBranches(false));
  }, [selectedRepo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo || !branchName.trim()) {
      setError('Please select a repository and enter a branch name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetchApi<any>(`/github/work-items/${workItem.id}/branch`, {
        method: 'POST',
        body: JSON.stringify({
          repositoryName: selectedRepo,
          branchName: branchName.trim(),
          baseBranch,
        }),
      });

      setCreatedResult(res);
      if (onBranchCreated) onBranchCreated(res);
    } catch (err: any) {
      setError(err.message || 'Failed to create branch on GitHub.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const checkoutCommand = `git fetch origin && git checkout -b ${branchName} origin/${baseBranch}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Create GitHub Branch</h2>
              <p className="text-[11px] text-slate-400">
                Link branch to <span className="font-mono text-blue-400 font-semibold">{workItem.humanId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/50 rounded-lg flex items-start space-x-2 text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs">{error}</div>
            </div>
          )}

          {createdResult ? (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg text-emerald-300 flex items-center space-x-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold">Branch successfully created & linked!</span>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Branch <span className="font-mono text-emerald-400">{createdResult.link?.branchName || branchName}</span> is ready on GitHub.
                  </div>
                </div>
              </div>

              {createdResult.link?.url && (
                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <span className="text-slate-400 text-[11px]">View on GitHub</span>
                  <a
                    href={createdResult.link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 font-medium"
                  >
                    <span>Open Branch</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Run Locally in Terminal
                </label>
                <div className="relative group">
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-mono text-[11px] overflow-x-auto select-all">
                    {`git fetch origin\ngit checkout ${createdResult.link?.branchName || branchName}`}
                  </pre>
                  <button
                    onClick={() => copyCommand(`git fetch origin && git checkout ${createdResult.link?.branchName || branchName}`)}
                    className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors"
                    title="Copy Command"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Repository Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Target Repository <span className="text-rose-400">*</span>
                </label>
                {isLoadingRepos ? (
                  <div className="flex items-center space-x-2 text-slate-400 p-2 bg-slate-950 rounded border border-slate-800">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading repositories...</span>
                  </div>
                ) : (
                  <select
                    value={selectedRepo}
                    onChange={(e) => setSelectedRepo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    required
                  >
                    {repositories.map((repo) => (
                      <option key={repo.id || repo.name} value={repo.name || repo.fullName}>
                        {repo.name || repo.fullName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Base Branch & Branch Name */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Base Branch
                  </label>
                  {isLoadingBranches ? (
                    <div className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-500">...</div>
                  ) : (
                    <select
                      value={baseBranch}
                      onChange={(e) => setBaseBranch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                    >
                      {branches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    New Branch Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="feat/PROJ-12-task-slug"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Command Preview */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>CLI Preview</span>
                  <GitFork className="w-3 h-3 text-slate-500" />
                </div>
                <code className="text-slate-400 font-mono text-[10px] block truncate">
                  {checkoutCommand}
                </code>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedRepo || !branchName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>Create Branch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
