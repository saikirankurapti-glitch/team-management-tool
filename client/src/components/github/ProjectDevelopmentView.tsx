import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitPullRequest,
  GitCommit,
  FolderGit2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Check,
  AlertCircle,
  Search,
} from 'lucide-react';
import { fetchApi } from '../../services/api';

interface ProjectDevelopmentViewProps {
  projectId: string;
}

export const ProjectDevelopmentView: React.FC<ProjectDevelopmentViewProps> = ({ projectId }) => {
  const [data, setData] = useState<{
    project: any;
    repositories: any[];
    pullRequests: any[];
    branches: any[];
    recentCommits: any[];
  }>({
    project: null,
    repositories: [],
    pullRequests: [],
    branches: [],
    recentCommits: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'prs' | 'branches' | 'commits' | 'repos'>('prs');
  const [filterText, setFilterText] = useState('');

  const loadData = () => {
    setIsLoading(true);
    fetchApi<any>(`/github/projects/${projectId}/development`)
      .then((res) => {
        if (res) {
          setData({
            project: res.project,
            repositories: res.repositories || [],
            pullRequests: res.pullRequests || [],
            branches: res.branches || [],
            recentCommits: res.recentCommits || [],
          });
        }
      })
      .catch((err) => console.error('Failed to load project development view:', err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (projectId) loadData();
  }, [projectId]);

  const filteredPrs = (data.pullRequests || []).filter(
    (pr) =>
      pr.title?.toLowerCase().includes(filterText.toLowerCase()) ||
      pr.repository?.name?.toLowerCase().includes(filterText.toLowerCase()) ||
      pr.workItem?.humanId?.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredBranches = (data.branches || []).filter(
    (b) =>
      b.name?.toLowerCase().includes(filterText.toLowerCase()) ||
      b.repository?.name?.toLowerCase().includes(filterText.toLowerCase()) ||
      b.workItem?.humanId?.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredCommits = (data.recentCommits || []).filter(
    (c) =>
      c.message?.toLowerCase().includes(filterText.toLowerCase()) ||
      c.authorName?.toLowerCase().includes(filterText.toLowerCase()) ||
      c.workItem?.humanId?.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="space-y-4 text-xs">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveSubTab('repos')}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            activeSubTab === 'repos'
              ? 'bg-blue-600/10 border-blue-500/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Repositories</span>
            <FolderGit2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-slate-100">{data.repositories.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Connected Codebases</div>
        </div>

        <div
          onClick={() => setActiveSubTab('prs')}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            activeSubTab === 'prs'
              ? 'bg-emerald-600/10 border-emerald-500/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Pull Requests</span>
            <GitPullRequest className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-slate-100">{data.pullRequests.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {data.pullRequests.filter((p) => p.status === 'OPEN').length} Open
          </div>
        </div>

        <div
          onClick={() => setActiveSubTab('branches')}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            activeSubTab === 'branches'
              ? 'bg-sky-600/10 border-sky-500/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Branches</span>
            <GitBranch className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl font-bold text-slate-100">{data.branches.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Active work branches</div>
        </div>

        <div
          onClick={() => setActiveSubTab('commits')}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            activeSubTab === 'commits'
              ? 'bg-purple-600/10 border-purple-500/50'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider">Commits</span>
            <GitCommit className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-slate-100">{data.recentCommits.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Linked commits</div>
        </div>
      </div>

      {/* Action and Subtab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-slate-900/80 border border-slate-800 rounded-lg">
        <div className="flex items-center space-x-1">
          {[
            { id: 'prs', label: `Pull Requests (${data.pullRequests.length})`, icon: GitPullRequest },
            { id: 'branches', label: `Branches (${data.branches.length})`, icon: GitBranch },
            { id: 'commits', label: `Recent Commits (${data.recentCommits.length})`, icon: GitCommit },
            { id: 'repos', label: `Repositories (${data.repositories.length})`, icon: FolderGit2 },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                  activeSubTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Filter items..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44 sm:w-56"
            />
          </div>
          <button
            type="button"
            onClick={loadData}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Subtab Contents */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 min-h-[300px]">
        {/* Pull Requests */}
        {activeSubTab === 'prs' && (
          <div className="space-y-2">
            {filteredPrs.length === 0 ? (
              <div className="text-center py-10 text-slate-500 italic">
                No pull requests found. Create a branch & PR from any work item side drawer!
              </div>
            ) : (
              filteredPrs.map((pr) => {
                const isMerged = pr.status === 'MERGED';
                const isClosed = pr.status === 'CLOSED';

                return (
                  <div
                    key={pr.id}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
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
                        <span className="font-mono text-slate-400 font-semibold">#{pr.number}</span>
                        <span className="font-bold text-slate-100">{pr.title}</span>
                      </div>

                      <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                        {pr.workItem && (
                          <span className="font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                            {pr.workItem.humanId}
                          </span>
                        )}
                        <span>Repo: <span className="text-slate-300 font-medium">{pr.repository?.name || 'GitHub'}</span></span>
                        <span>Author: <span className="text-slate-300">{pr.authorGithub || 'user'}</span></span>
                        <span>Updated: {new Date(pr.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {pr.url && (
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center space-x-1.5 transition-colors"
                        >
                          <span>View on GitHub</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Branches */}
        {activeSubTab === 'branches' && (
          <div className="space-y-2">
            {filteredBranches.length === 0 ? (
              <div className="text-center py-10 text-slate-500 italic">No active branches found.</div>
            ) : (
              filteredBranches.map((b) => (
                <div
                  key={b.id}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <GitBranch className="w-3.5 h-3.5 text-blue-400" />
                      <span className="font-mono font-bold text-slate-100">{b.name}</span>
                      {b.isDefault && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                          default
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                      {b.workItem && (
                        <span className="font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                          {b.workItem.humanId}
                        </span>
                      )}
                      <span>Repo: {b.repository?.name}</span>
                      {b.lastCommitSha && (
                        <span className="font-mono text-purple-400">
                          sha: {b.lastCommitSha.slice(0, 7)}
                        </span>
                      )}
                    </div>
                  </div>

                  {b.url && (
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                      title="Open branch"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Commits */}
        {activeSubTab === 'commits' && (
          <div className="space-y-2">
            {filteredCommits.length === 0 ? (
              <div className="text-center py-10 text-slate-500 italic">
                No linked commits recorded yet. Commits with work item IDs (e.g. {data.project?.key || 'PROJ'}-12) will appear here automatically via webhooks.
              </div>
            ) : (
              filteredCommits.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        {c.sha?.slice(0, 7) || 'commit'}
                      </span>
                      <span className="font-medium text-slate-100 truncate">{c.message}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                      {c.workItem && (
                        <span className="font-mono text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                          {c.workItem.humanId}
                        </span>
                      )}
                      <span>Author: <span className="text-slate-300">{c.authorName || 'user'}</span></span>
                      <span>Repo: {c.repository?.name}</span>
                      <span>{new Date(c.committedAt || c.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
                      title="Open commit"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Repositories */}
        {activeSubTab === 'repos' && (
          <div className="space-y-2">
            {data.repositories.length === 0 ? (
              <div className="text-center py-10 text-slate-500 italic">No repositories configured.</div>
            ) : (
              data.repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <FolderGit2 className="w-4 h-4 text-blue-400" />
                      <span className="font-bold text-slate-100 text-sm">{repo.fullName || repo.name}</span>
                      {repo.isPrivate && (
                        <span className="text-[10px] bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded">
                          Private
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                      <span>Default branch: <span className="font-mono text-slate-300">{repo.defaultBranch || 'main'}</span></span>
                      <span>Branches: {repo._count?.branches || 0}</span>
                      <span>Pull Requests: {repo._count?.pullRequests || 0}</span>
                    </div>
                  </div>

                  {repo.htmlUrl && (
                    <a
                      href={repo.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center space-x-1.5 transition-colors"
                    >
                      <span>Open on GitHub</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
