import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitPullRequest,
  GitCommit,
  Plus,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Check,
  AlertCircle,
  FileCode2,
} from 'lucide-react';
import { fetchApi } from '../../services/api';
import { WorkItem } from '../../types';
import { CreateBranchModal } from './CreateBranchModal';
import { CreatePullRequestModal } from './CreatePullRequestModal';

interface WorkItemDevelopmentSectionProps {
  workItem: WorkItem;
  onUpdated?: () => void;
}

export const WorkItemDevelopmentSection: React.FC<WorkItemDevelopmentSectionProps> = ({
  workItem,
  onUpdated,
}) => {
  const [devData, setDevData] = useState<{
    branches: any[];
    commits: any[];
    pullRequests: any[];
    repos: string[];
  }>({
    branches: [],
    commits: [],
    pullRequests: [],
    repos: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isPrModalOpen, setIsPrModalOpen] = useState(false);
  const [selectedBranchForPr, setSelectedBranchForPr] = useState<string | undefined>(undefined);
  const [selectedRepoForPr, setSelectedRepoForPr] = useState<string | undefined>(undefined);

  const loadDevelopmentData = () => {
    setIsLoading(true);
    fetchApi<any>(`/github/work-items/${workItem.id}/development`)
      .then((data) => {
        if (data) {
          setDevData({
            branches: data.branches || [],
            commits: data.commits || [],
            pullRequests: data.pullRequests || [],
            repos: data.repos || [],
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load work item development summary:', err);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadDevelopmentData();
  }, [workItem.id]);

  const handleOpenPrForBranch = (branchName: string, repositoryName: string) => {
    setSelectedBranchForPr(branchName);
    setSelectedRepoForPr(repositoryName);
    setIsPrModalOpen(true);
  };

  const totalItems = devData.branches.length + devData.pullRequests.length + devData.commits.length;

  return (
    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Development ({totalItems})</span>
          </span>
          <button
            type="button"
            onClick={loadDevelopmentData}
            className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
            title="Refresh GitHub Data"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setIsBranchModalOpen(true)}
            className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Create Branch</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedBranchForPr(undefined);
              setSelectedRepoForPr(undefined);
              setIsPrModalOpen(true);
            }}
            className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Create PR</span>
          </button>
        </div>
      </div>

      {totalItems === 0 && !isLoading && (
        <div className="py-2 text-center text-[11px] text-slate-500 italic">
          No branches, pull requests, or commits linked yet.
        </div>
      )}

      {/* Linked Branches */}
      {devData.branches.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
            <GitBranch className="w-3 h-3 text-blue-400" />
            <span>Branches ({devData.branches.length})</span>
          </div>
          <div className="space-y-1">
            {devData.branches.map((b) => (
              <div
                key={b.id}
                className="p-2 bg-slate-900/80 border border-slate-800 rounded flex items-center justify-between text-xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center space-x-1.5 font-mono text-slate-200">
                    <span className="font-semibold truncate text-blue-400">{b.branchName}</span>
                    <span className="text-[10px] text-slate-500 font-sans">({b.repositoryName})</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Linked {new Date(b.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenPrForBranch(b.branchName, b.repositoryName)}
                    className="px-2 py-0.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-medium transition-colors"
                    title="Open PR for this branch"
                  >
                    Open PR
                  </button>
                  {b.url && (
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-white"
                      title="View branch on GitHub"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked Pull Requests */}
      {devData.pullRequests.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
            <GitPullRequest className="w-3 h-3 text-emerald-400" />
            <span>Pull Requests ({devData.pullRequests.length})</span>
          </div>
          <div className="space-y-1.5">
            {devData.pullRequests.map((pr) => {
              const isMerged = pr.status === 'MERGED';
              const isClosed = pr.status === 'CLOSED';
              const isOpen = pr.status === 'OPEN' || !pr.status;

              return (
                <div
                  key={pr.id}
                  className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                          isMerged
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : isClosed
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {isMerged ? 'MERGED' : isClosed ? 'CLOSED' : 'OPEN'}
                      </span>
                      <span className="font-mono text-slate-400 text-xs">#{pr.prNumber}</span>
                      <span className="font-medium text-slate-200 truncate">{pr.title || 'Pull Request'}</span>
                    </div>

                    {pr.url && (
                      <a
                        href={pr.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-slate-400 hover:text-white shrink-0 ml-1"
                        title="View PR on GitHub"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {/* Reviews & CI Checks */}
                  <div className="flex items-center space-x-3 text-[10px] text-slate-400 pt-0.5">
                    {/* Review State */}
                    {pr.reviewState && (
                      <div className="flex items-center space-x-1">
                        {pr.reviewState === 'APPROVED' && (
                          <span className="text-emerald-400 flex items-center space-x-0.5 font-semibold">
                            <Check className="w-3 h-3" />
                            <span>Approved</span>
                          </span>
                        )}
                        {pr.reviewState === 'CHANGES_REQUESTED' && (
                          <span className="text-rose-400 flex items-center space-x-0.5 font-semibold">
                            <AlertCircle className="w-3 h-3" />
                            <span>Changes Requested</span>
                          </span>
                        )}
                        {pr.reviewState === 'PENDING' && (
                          <span className="text-amber-400 flex items-center space-x-0.5">
                            <Clock className="w-3 h-3" />
                            <span>Review Pending</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* CI Status */}
                    {pr.ciStatus && (
                      <div className="flex items-center space-x-1">
                        {pr.ciStatus === 'SUCCESS' && (
                          <span className="text-emerald-400 flex items-center space-x-0.5">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>CI Passing</span>
                          </span>
                        )}
                        {pr.ciStatus === 'FAILURE' && (
                          <span className="text-rose-400 flex items-center space-x-0.5">
                            <XCircle className="w-3 h-3" />
                            <span>CI Failed</span>
                          </span>
                        )}
                        {pr.ciStatus === 'RUNNING' && (
                          <span className="text-amber-400 flex items-center space-x-0.5">
                            <Clock className="w-3 h-3 animate-spin" />
                            <span>CI Running</span>
                          </span>
                        )}
                      </div>
                    )}

                    <span className="text-slate-500 font-mono">
                      {pr.repositoryName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Linked Commits */}
      {devData.commits.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
            <GitCommit className="w-3 h-3 text-purple-400" />
            <span>Commits ({devData.commits.length})</span>
          </div>
          <div className="space-y-1">
            {devData.commits.map((c) => (
              <div
                key={c.id}
                className="p-2 bg-slate-900/60 border border-slate-800 rounded flex items-center justify-between text-xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[10px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                      {c.commitSha?.slice(0, 7) || 'commit'}
                    </span>
                    <span className="text-slate-200 truncate">{c.title || 'Commit'}</span>
                  </div>
                  {c.authorName && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      by {c.authorName} • {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-slate-400 hover:text-white shrink-0"
                    title="View commit on GitHub"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateBranchModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        workItem={workItem}
        onBranchCreated={() => {
          loadDevelopmentData();
          if (onUpdated) onUpdated();
        }}
      />

      <CreatePullRequestModal
        isOpen={isPrModalOpen}
        onClose={() => setIsPrModalOpen(false)}
        workItem={workItem}
        defaultBranch={selectedBranchForPr}
        defaultRepo={selectedRepoForPr}
        onPullRequestCreated={() => {
          loadDevelopmentData();
          if (onUpdated) onUpdated();
        }}
      />
    </div>
  );
};
