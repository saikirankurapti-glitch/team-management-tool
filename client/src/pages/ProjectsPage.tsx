import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, ArrowRight, Plus } from 'lucide-react';
import { fetchApi } from '../services/api';
import { Project } from '../types';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchApi<Project[]>('/projects')
      .then((data) => setProjects(data))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <div className="p-8 text-xs font-mono text-ink-muted">Loading projects directory...</div>;
  }

  return (
    <div className="p-6 md:p-10 space-y-8 overflow-y-auto h-full text-xs bg-canvas select-none">
      {/* Editorial Header */}
      <div className="space-y-3 max-w-3xl">
        <div className="editorial-eyebrow">
          PROJECTS
        </div>

        <h1 className="text-3xl md:text-4xl font-black text-ink tracking-tight leading-tight">
          Everything your team <br />
          <span className="text-olive-dark">is building.</span>
        </h1>

        <p className="text-sm text-ink-muted leading-relaxed">
          Overview of active engineering tracks, progress velocity, and delivery health across repositories.
        </p>
      </div>

      {/* Dense Projects Table */}
      <div className="card-cream overflow-hidden">
        <table className="table-editorial">
          <thead>
            <tr>
              <th>Key</th>
              <th>Project Name</th>
              <th>Owner</th>
              <th>Health</th>
              <th>Progress</th>
              <th>Work Items</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((proj) => (
              <tr key={proj.id} className="transition-colors">
                <td className="font-mono font-bold text-olive-dark whitespace-nowrap">
                  {proj.key}
                </td>
                <td className="font-semibold text-ink">
                  <div>{proj.name}</div>
                  <div className="text-[11px] text-ink-muted font-normal line-clamp-1">{proj.description}</div>
                </td>
                <td className="font-medium whitespace-nowrap text-ink-secondary">
                  {proj.owner?.fullName || 'Engineering Lead'}
                </td>
                <td className="whitespace-nowrap">
                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      proj.health === 'HEALTHY' ? 'badge-green' : 'badge-amber'
                    }`}
                  >
                    {proj.health}
                  </span>
                </td>
                <td className="w-52">
                  <div className="flex items-center space-x-2">
                    <div className="w-full bg-borderWarm/60 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-olive-dark h-full transition-all"
                        style={{ width: `${proj.stats?.progress || 0}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-ink-muted whitespace-nowrap font-medium">
                      {proj.stats?.progress}%
                    </span>
                  </div>
                </td>
                <td className="font-mono text-ink-muted whitespace-nowrap">
                  {proj.stats?.completedItems} / {proj.stats?.totalItems} done
                </td>
                <td className="whitespace-nowrap">
                  <Link
                    to={`/projects/${proj.key}`}
                    className="btn-pill-secondary h-7 px-3 text-[11px] font-semibold inline-flex items-center space-x-1"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3 text-olive-dark" />
                  </Link>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-ink-muted italic">
                  No projects configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
