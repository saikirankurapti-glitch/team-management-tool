import React, { useState, useEffect } from 'react';
import { Layers, ArrowRight, CheckCircle2 } from 'lucide-react';
import { fetchApi } from '../services/api';

export const TemplatesPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [category, setCategory] = useState('ALL');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadTemplates = () => {
    fetchApi<any>('/v1/templates')
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleInstantiate = async () => {
    if (!selectedTemplate || !projectName) return;
    try {
      setIsCreating(true);
      await fetchApi('/v1/templates/instantiate', {
        method: 'POST',
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          projectName,
        }),
      });
      setSuccessMsg(`Project "${projectName}" created successfully!`);
      setSelectedTemplate(null);
      setProjectName('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-xs font-mono text-slate-400">Loading Templates...</div>;
  }

  const allTemplates = [
    ...(data?.builtinTemplates || []),
    ...(data?.customTemplates || []),
  ];

  const filtered = category === 'ALL' ? allTemplates : allTemplates.filter((t) => t.category === category);

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full text-xs">
      {/* Header Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-blue-500" />
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Project & Workflow Templates
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Pre-built project blueprints with pre-configured workflows and WIP limits
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-2.5 badge-green rounded flex items-center font-mono text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {successMsg}
        </div>
      )}

      {/* Category Toolbar */}
      <div className="ent-toolbar flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium">
        {['ALL', 'SOFTWARE', 'PRODUCT', 'OPERATIONS', 'MARKETING'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 rounded transition-colors ${
              category === cat ? 'bg-blue-600/15 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {filtered.map((tmpl: any) => (
          <div key={tmpl.id} className="ent-panel p-3.5 space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">{tmpl.name}</span>
                <span className="badge-blue text-[9px] font-mono px-1.5 py-0.2 rounded">
                  {tmpl.category}
                </span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">{tmpl.description}</p>
            </div>

            <button
              onClick={() => {
                setSelectedTemplate(tmpl);
                setProjectName(`${tmpl.name} Project`);
              }}
              className="ent-btn-primary w-full flex items-center justify-center space-x-1"
            >
              <span>Use Blueprint</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded shadow-2xl p-4 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-100">Create Project from "{selectedTemplate.name}"</h3>
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="ent-input w-full"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setSelectedTemplate(null)} className="ent-btn-secondary">
                Cancel
              </button>
              <button onClick={handleInstantiate} disabled={isCreating} className="ent-btn-primary">
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
