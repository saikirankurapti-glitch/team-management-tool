import React, { useState, useEffect } from 'react';
import { Search, X, Folder, CheckSquare, MessageSquare, User as UserIcon, Zap, FileText } from 'lucide-react';
import { fetchApi } from '../../services/api';

interface SearchResult {
  projects: any[];
  workItems: any[];
  messages: any[];
  users: any[];
}

export const GlobalSearchModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'items' | 'projects' | 'messages' | 'people'>('all');
  const [results, setResults] = useState<SearchResult>({
    projects: [],
    workItems: [],
    messages: [],
    users: [],
  });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults({ projects: [], workItems: [], messages: [], users: [] });
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      fetchApi<SearchResult>(`/search?q=${encodeURIComponent(query)}`)
        .then((data) => setResults(data))
        .catch((err) => console.error(err))
        .finally(() => setIsSearching(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-start justify-center pt-16 px-4 font-sans">
      <div className="bg-surface border border-borderWarm rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Header */}
        <div className="p-4 border-b border-borderWarm flex items-center space-x-3 bg-canvas">
          <Search className="w-4 h-4 text-olive shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search work items, projects, messages..."
            className="w-full bg-transparent text-ink placeholder-ink/40 text-xs font-medium focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-ink/40 hover:text-ink">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="text-[10px] font-mono bg-surface text-ink/60 border border-borderWarm px-2 py-0.5 rounded-full">
            ESC
          </button>
        </div>

        {/* Categories Bar */}
        <div className="flex border-b border-borderWarm px-4 py-2 bg-canvas/40 gap-1.5 overflow-x-auto text-[11px] font-bold text-ink/70">
          {[
            { id: 'all', label: 'All Results' },
            { id: 'items', label: `Work Items (${results.workItems.length})` },
            { id: 'projects', label: `Projects (${results.projects.length})` },
            { id: 'messages', label: `Messages (${results.messages.length})` },
            { id: 'people', label: `People (${results.users.length})` },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-1 rounded-full transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-olive text-white shadow-xs'
                  : 'hover:text-ink hover:bg-surface'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {isSearching && <div className="text-center py-6 text-ink/50 font-mono text-xs">Searching enterprise workspace...</div>}

          {!isSearching && query.length >= 2 && (
            <>
              {/* Work Items */}
              {(activeCategory === 'all' || activeCategory === 'items') && results.workItems.length > 0 && (
                <div className="space-y-2">
                  <div className="editorial-eyebrow text-[9px] flex items-center space-x-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-olive" />
                    <span>Work Items</span>
                  </div>
                  <div className="space-y-1">
                    {results.workItems.map((item) => (
                      <a
                        key={item.id}
                        href={`/boards?item=${item.humanId}`}
                        onClick={onClose}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-canvas border border-transparent hover:border-borderWarm transition-all"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="font-mono font-bold text-xs text-olive bg-olive/10 px-2 py-0.5 rounded-full">
                            {item.humanId}
                          </span>
                          <span className="text-ink font-medium truncate">{item.title}</span>
                        </div>
                        <span className="text-[10px] text-ink/50 uppercase font-mono">{item.type}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects */}
              {(activeCategory === 'all' || activeCategory === 'projects') && results.projects.length > 0 && (
                <div className="space-y-2">
                  <div className="editorial-eyebrow text-[9px] flex items-center space-x-1.5">
                    <Folder className="w-3.5 h-3.5 text-olive" />
                    <span>Projects</span>
                  </div>
                  <div className="space-y-1">
                    {results.projects.map((proj) => (
                      <a
                        key={proj.id}
                        href={`/projects/${proj.key}`}
                        onClick={onClose}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-canvas border border-transparent hover:border-borderWarm transition-all"
                      >
                        <span className="text-ink font-medium">{proj.name}</span>
                        <span className="font-mono text-[10px] text-ink/70 bg-surface border border-borderWarm px-2 py-0.5 rounded-full">
                          {proj.key}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {(activeCategory === 'all' || activeCategory === 'messages') && results.messages.length > 0 && (
                <div className="space-y-2">
                  <div className="editorial-eyebrow text-[9px] flex items-center space-x-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-olive" />
                    <span>Chat Messages</span>
                  </div>
                  <div className="space-y-1.5">
                    {results.messages.map((msg) => (
                      <div key={msg.id} className="p-3 rounded-xl bg-canvas border border-borderWarm space-y-1">
                        <div className="text-[11px] font-bold text-ink">{msg.sender?.fullName}</div>
                        <div className="text-ink/80 leading-relaxed line-clamp-2">{msg.content}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Users */}
              {(activeCategory === 'all' || activeCategory === 'people') && results.users.length > 0 && (
                <div className="space-y-2">
                  <div className="editorial-eyebrow text-[9px] flex items-center space-x-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-olive" />
                    <span>Team Members</span>
                  </div>
                  <div className="space-y-1">
                    {results.users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-canvas transition-colors">
                        <div className="flex items-center space-x-2.5">
                          <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover border border-borderWarm" />
                          <span className="text-ink font-bold">{u.fullName}</span>
                        </div>
                        <span className="text-[10px] text-ink/60 font-mono">{u.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {query.length < 2 && (
            <div className="text-center py-10 text-ink/50 text-xs">
              Type at least 2 characters to search across projects, work items, chat, and users...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
