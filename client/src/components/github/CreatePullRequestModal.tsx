import React, { useState, useEffect } from 'react';
import { X, GitPullRequest, GitMerge, ExternalLink, Loader2, AlertCircle, Check } from 'lucide-react';
import { fetchApi } from '../../services/api';
import { WorkItem } from '../../types';

interface CreatePullRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  workItem: WorkItem;
  defaultBranch?: string;
  defaultRepo?: string;
  onPullRequestCreated?: (link: any) => void;
}

export const CreatePullRequestModal: React.FC<CreatePullRequestModalProps> = ({
  isOpen,
  onClose,
  workItem,
  defaultBranch,
  defaultRepo,
  onPullRequestCreated,
}) => {
  const [repositories, setRepositories] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState(defaultRepo || '');
  const [branches, setBranches] = useState<string[]>([]);
  const [headBranch, setHeadBranch] = useState(defaultBranch || '');
  const [baseBranch, setBaseBranch] = useState('main');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isDraft, setIsDraft] = useState(false);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCreatedResult(null);
      setError(null);
      return;
    }

    setTitle(`[${workItem.humanId}] ${workItem.title}`);
    setBody(
      `## Description\nCloses ${workItem.humanId}\n\n### Summary of Changes\n- Implementation for ${workItem.title}\n\n### Work Item Details\n- **ID**: ${workItem.humanId}\n- **Type**: ${workItem.type}\n- **Priority**: ${workItem.priority}`
    );

    setIsLoadingRepos(true);
    setError(null);

    fetchApi<any[]>('/integrations/github/repos')
      .then((repos) => {
        if (repos && repos.length > 0) {
          setRepositories(repos);
          const initial = defaultRepo || repos[0].name || repos[0].fullName;
          setSelectedRepo(initial);
        } else {
          setRepositories([]);
          setError('No GitHub repositories found.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch repositories.');
      })
      .finally(() => setIsLoadingRepos(false));
  }, [isOpen, workItem.id, defaultRepo, defaultBranch]);

  useEffect(() => {
    if (!selectedRepo) return;
    setIsLoadingBranches(true);
    fetchApi<any[]>(`/integrations/github/branches?repository=${encodeURIComponent(selectedRepo)}`)
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const names = data.map((b) => (typeof b === 'string' ? b : b.name));
          setBranches(names);

          // Head branch
          if (defaultBranch && names.includes(defaultBranch)) {
            setHeadBranch(defaultBranch);
          } else {
            // Look for branch containing humanId
            const matching = names.find((n) => n.toLowerCase().includes(workItem.humanId.toLowerCase()));
            setHeadBranch(matching || names[0]);
          }

          // Base branch
          if (names.includes('main')) setBaseBranch('main');
          else if (names.includes('master')) setBaseBranch('master');
          else setBaseBranch(names[0]);
        }
      })
      .catch(() => {
        setBranches(['main', 'master', 'develop']);
      })
      .finally(() => setIsLoadingBranches(false));
  }, [selectedRepo, defaultBranch, workItem.humanId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepo || !headBranch || !baseBranch || !title.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (headBranch === baseBranch) {
      setError('Head branch and base branch cannot be the same.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetchApi<any>(`/github/work-items/${workItem.id}/pull-request`, {
        method: 'POST',
        body: JSON.stringify({
          repositoryName: selectedRepo,
          headBranch,
          baseBranch,
          title: title.trim(),
          body,
          draft: isDraft,
        }),
      });

      setCreatedResult(res);
      if (onPullRequestCreated) onPullRequestCreated(res);
    } catch (err: any) {
      setError(err.message || 'Failed to create Pull Request on GitHub.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <GitPullRequest className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Create GitHub Pull Request</h2>
              <p className="text-[11px] text-slate-400">
                Link PR to <span className="font-mono text-emerald-400 font-semibold">{workItem.humanId}</span>
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
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
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
                  <span className="font-bold">Pull Request Created Successfully!</span>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    PR #{createdResult.link?.prNumber || createdResult.prNumber} is now linked to this work item.
                  </div>
                </div>
              </div>

              {(createdResult.link?.url || createdResult.prUrl) && (
                <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div>
                    <span className="text-slate-200 font-semibold block">
                      {createdResult.link?.title || title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      #{createdResult.link?.prNumber || createdResult.prNumber} • {baseBranch} ← {headBranch}
                    </span>
                  </div>
                  <a
                    href={createdResult.link?.url || createdResult.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-xs transition-colors shrink-0"
                  >
                    <span>Open PR</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
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
                  Repository <span className="text-rose-400">*</span>
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
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

              {/* Branch Selection (Base <- Head) */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Base Branch (Target)
                  </label>
                  <select
                    value={baseBranch}
                    onChange={(e) => setBaseBranch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Head Branch (Source)
                  </label>
                  <select
                    value={headBranch}
                    onChange={(e) => setHeadBranch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                  >
                    {branches.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {/* Description Body */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Description / Markdown
                </label>
                <textarea
                  rows={5}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              {/* Draft toggle */}
              <label className="flex items-center space-x-2 text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isDraft}
                  onChange={(e) => setIsDraft(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-0"
                />
                <span className="text-[11px]">Create as draft pull request</span>
              </label>

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
                  disabled={isSubmitting || !selectedRepo || !headBranch || !title.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center space-x-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>Create Pull Request</span>
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
