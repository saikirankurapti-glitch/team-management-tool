import React, { useState, useEffect } from 'react';
import { BookOpen, Award, Users, CheckSquare, Sparkles, Search, FileText } from 'lucide-react';
import { fetchApi } from '../services/api';

export const KnowledgeHubPage: React.FC = () => {
  const [tab, setTab] = useState<'KNOWLEDGE' | 'DECISIONS' | 'MEETINGS' | 'UPDATES'>('KNOWLEDGE');
  const [pages, setPages] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState<any>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);

  const loadData = () => {
    Promise.all([
      fetchApi<any[]>('/v1/knowledge'),
      fetchApi<any[]>('/v1/decisions'),
      fetchApi<any[]>('/v1/meetings'),
      fetchApi<any[]>('/v1/updates'),
    ])
      .then(([pageData, decData, mtgData, upData]) => {
        setPages(pageData);
        setDecisions(decData);
        setMeetings(mtgData);
        setUpdates(upData);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      setIsAiSearching(true);
      const res = await fetchApi<any>('/v1/collaboration/ai-search', {
        method: 'POST',
        body: JSON.stringify({ prompt: searchQuery }),
      });
      setAiAnswer(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiSearching(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-xs font-mono text-slate-400">Loading Knowledge Hub...</div>;
  }

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full text-xs">
      {/* Header Standard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-blue-500" />
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Knowledge Hub & Decision Repository
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              Technical documentation, architecture decision records (ADR), meeting notes, and updates
            </p>
          </div>
        </div>
      </div>

      {/* AI Knowledge Search Bar */}
      <div className="ent-panel p-3 space-y-2">
        <form onSubmit={handleAiSearch} className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Ask Copilot: 'What are our database indexing conventions?' or 'Summarize API decisions'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ent-input pl-8 w-full"
            />
          </div>
          <button
            type="submit"
            disabled={isAiSearching}
            className="ent-btn-primary flex items-center space-x-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Search</span>
          </button>
        </form>

        {aiAnswer && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded space-y-1">
            <span className="font-bold text-blue-400 text-xs block">AI Response:</span>
            <p className="text-slate-200 leading-relaxed">{aiAnswer.answer}</p>
          </div>
        )}
      </div>

      {/* Sub Navigation Bar */}
      <div className="ent-toolbar flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium">
        <button
          onClick={() => setTab('KNOWLEDGE')}
          className={`px-3 py-1 rounded transition-colors flex items-center space-x-1 ${
            tab === 'KNOWLEDGE' ? 'bg-blue-600/15 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Wiki ({pages.length})</span>
        </button>

        <button
          onClick={() => setTab('DECISIONS')}
          className={`px-3 py-1 rounded transition-colors flex items-center space-x-1 ${
            tab === 'DECISIONS' ? 'bg-blue-600/15 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Decisions ({decisions.length})</span>
        </button>

        <button
          onClick={() => setTab('MEETINGS')}
          className={`px-3 py-1 rounded transition-colors flex items-center space-x-1 ${
            tab === 'MEETINGS' ? 'bg-blue-600/15 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Meetings ({meetings.length})</span>
        </button>

        <button
          onClick={() => setTab('UPDATES')}
          className={`px-3 py-1 rounded transition-colors flex items-center space-x-1 ${
            tab === 'UPDATES' ? 'bg-blue-600/15 text-blue-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Updates ({updates.length})</span>
        </button>
      </div>

      {/* Content Panes */}
      {tab === 'KNOWLEDGE' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {pages.map((p) => (
            <div key={p.id} className="ent-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">{p.title}</span>
                <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-400">
                  v{p.version}
                </span>
              </div>
              <p className="text-slate-500 text-[11px] line-clamp-3 leading-relaxed">{p.content}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'DECISIONS' && (
        <div className="space-y-2">
          {decisions.map((d) => (
            <div key={d.id} className="p-3 ent-card space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">{d.title}</span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${d.status === 'ACCEPTED' ? 'badge-green' : 'badge-amber'}`}>
                  {d.status}
                </span>
              </div>
              <p className="text-slate-300 font-medium">{d.decision}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'MEETINGS' && (
        <div className="space-y-2">
          {meetings.map((m) => (
            <div key={m.id} className="p-3 ent-card space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">{m.title}</span>
                <span className="font-mono text-[10px] text-slate-500">{new Date(m.heldAt).toLocaleDateString()}</span>
              </div>
              <p className="text-slate-400 text-[11px]">{m.notes}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'UPDATES' && (
        <div className="space-y-2">
          {updates.map((u) => (
            <div key={u.id} className="p-3 ent-card space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200">{u.title}</span>
                <span className="badge-green text-[9px] font-mono font-bold px-1.5 py-0.2 rounded">
                  {u.healthStatus}
                </span>
              </div>
              <p className="text-slate-300 text-[11px]">{u.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
