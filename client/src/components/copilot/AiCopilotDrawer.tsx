import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, X, Sparkles, Shield, Database, RefreshCw, Plus, ChevronDown } from 'lucide-react';
import { fetchApi } from '../../services/api';

interface Message {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  status?: string;       // Tool status currently executing
  sources?: any;
  isStreaming?: boolean;
}

const QUICK_PROMPTS = [
  { label: '📊 Management Summary', prompt: 'Give me a management summary.' },
  { label: '⚡ Team Workload', prompt: 'Who has the highest workload?' },
  { label: '🚨 Project Health', prompt: 'Which projects need attention?' },
  { label: '🏃 Sprint Status', prompt: 'How is the current sprint progressing?' },
  { label: '🐛 Open Bugs', prompt: 'How many bugs are currently open?' },
  { label: '🚧 Blocked Work', prompt: 'What work is currently blocked?' },
];

/**
 * Render a markdown string to JSX — handles bold, tables, and code blocks.
 */
const renderMarkdown = (text: string): JSX.Element => {
  if (!text) return <></>;

  const lines = text.split('\n');
  const elements: JSX.Element[] = [];
  let tableRows: string[][] = [];
  let inTable = false;
  let isHeaderDone = false;
  let keyCounter = 0;
  const k = () => `md-${keyCounter++}`;

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const [headerRow, , ...dataRows] = tableRows;
    const headers = headerRow;
    elements.push(
      <div key={k()} className="overflow-x-auto my-2 rounded-lg border border-borderWarm">
        <table className="w-full text-[10px]">
          <thead className="bg-surface/80">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-2.5 py-1.5 text-left font-bold text-ink border-b border-borderWarm">
                  {h.trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-canvas' : 'bg-surface/40'}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2.5 py-1.5 text-ink/90 border-b border-borderWarm/50">
                    {renderInlineMarkdown(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
    isHeaderDone = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect table rows
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.trim().slice(1, -1).split('|');
      // Skip separator row
      if (cells.every(c => /^[\s:-]+$/.test(c))) {
        isHeaderDone = true;
        continue;
      }
      inTable = true;
      tableRows.push(cells);
      continue;
    }

    if (inTable) flushTable();

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h3 key={k()} className="font-bold text-[11px] text-ink mt-2 mb-0.5">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={k()} className="font-black text-[12px] text-ink mt-3 mb-1 uppercase tracking-wide">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={k()} className="font-black text-[13px] text-ink mt-3 mb-1">{line.slice(2)}</h1>);
    } else if (line.startsWith('---')) {
      elements.push(<hr key={k()} className="border-borderWarm my-2" />);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={k()} className="flex items-start space-x-1.5 my-0.5 ml-1">
          <span className="text-olive mt-0.5">•</span>
          <span>{renderInlineMarkdown(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={k()} className="h-1.5" />);
    } else {
      elements.push(<p key={k()} className="leading-relaxed my-0.5">{renderInlineMarkdown(line)}</p>);
    }
  }

  if (inTable) flushTable();

  return <>{elements}</>;
};

/** Render inline markdown: **bold**, *italic*, `code` */
const renderInlineMarkdown = (text: string): JSX.Element => {
  if (!text) return <></>;
  const parts: (string | JSX.Element)[] = [];
  let remaining = text;
  let key = 0;

  const patterns = [
    { regex: /\*\*(.+?)\*\*/g, render: (m: string) => <strong key={key++} className="font-bold text-ink">{m}</strong> },
    { regex: /\*(.+?)\*/g, render: (m: string) => <em key={key++} className="italic">{m}</em> },
    { regex: /`(.+?)`/g, render: (m: string) => <code key={key++} className="bg-surface px-1 py-0.5 rounded text-olive font-mono text-[9px]">{m}</code> },
  ];

  // Simple sequential replacement
  let result: (string | JSX.Element)[] = [text];
  for (const { regex, render } of patterns) {
    const newResult: (string | JSX.Element)[] = [];
    for (const part of result) {
      if (typeof part !== 'string') { newResult.push(part); continue; }
      const segments = part.split(regex);
      segments.forEach((seg, i) => {
        if (i % 2 === 0) newResult.push(seg);
        else newResult.push(render(seg));
      });
    }
    result = newResult;
  }

  return <>{result}</>;
};

export const AiCopilotDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'copilot',
      text: "👋 Hi! I'm your **TMP Management Intelligence Copilot**.\n\nAsk me about your team's workload, project health, sprint progress, blocked work, or anything about your TMP data.\n\nI only use real data — I'll tell you when something isn't available.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load most recent conversation on open
  useEffect(() => {
    if (isOpen && !conversationId) {
      fetchApi<any[]>('/copilot/conversations')
        .then(convs => {
          if (convs && convs.length > 0) {
            const latest = convs[0];
            setConversationId(latest.id);
            fetchApi<any[]>(`/copilot/conversations/${latest.id}`).then(msgs => {
              if (msgs && msgs.length > 0) {
                setMessages(
                  msgs.map(m => ({
                    id: m.id,
                    sender: m.sender as 'user' | 'copilot',
                    text: m.content,
                    sources: m.sources ? JSON.parse(m.sources) : undefined,
                  }))
                );
              }
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startNewChat = () => {
    abortControllerRef.current?.abort();
    setConversationId(undefined);
    setMessages([{
      id: 'welcome-new',
      sender: 'copilot',
      text: "👋 New conversation started. What would you like to know about your team or projects?",
    }]);
    setPrompt('');
    setToolStatus(null);
    setIsLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSendPrompt = async (textToSend?: string) => {
    const text = (textToSend || prompt).trim();
    if (!text || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const copilotMsgId = `copilot-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: userMsgId, sender: 'user', text },
      { id: copilotMsgId, sender: 'copilot', text: '', isStreaming: true },
    ]);
    setPrompt('');
    setIsLoading(true);
    setToolStatus(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/copilot/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          prompt: text,
          contextPage: window.location.pathname,
          conversationId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Server error ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No readable stream available.');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'text') {
              setMessages(prev => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last && last.id === copilotMsgId) {
                  return [...msgs.slice(0, -1), { ...last, text: last.text + event.content }];
                }
                return msgs;
              });
            } else if (event.type === 'status') {
              setToolStatus(event.content);
            } else if (event.type === 'sources') {
              setMessages(prev => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last && last.id === copilotMsgId) {
                  return [...msgs.slice(0, -1), { ...last, sources: event.content }];
                }
                return msgs;
              });
            } else if (event.type === 'done') {
              if (event.conversationId && !conversationId) {
                setConversationId(event.conversationId);
              }
              setToolStatus(null);
            } else if (event.type === 'error') {
              setMessages(prev => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last && last.id === copilotMsgId) {
                  return [...msgs.slice(0, -1), {
                    ...last,
                    text: `❌ **Error:** ${event.message}`,
                    isStreaming: false,
                  }];
                }
                return msgs;
              });
              setToolStatus(null);
            }
          } catch (_) { /* ignore parse errors */ }
        }
      }

      // Mark streaming as done
      setMessages(prev => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last && last.id === copilotMsgId) {
          return [...msgs.slice(0, -1), { ...last, isStreaming: false }];
        }
        return msgs;
      });

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setMessages(prev => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (last && last.id === copilotMsgId) {
          return [...msgs.slice(0, -1), {
            ...last,
            text: `❌ **Connection error:** ${err.message || 'Failed to reach the server.'}`,
            isStreaming: false,
          }];
        }
        return msgs;
      });
      setToolStatus(null);
    } finally {
      setIsLoading(false);
      setToolStatus(null);
    }
  };

  const handleRetry = () => {
    // Find last user message and resend
    const lastUser = [...messages].reverse().find(m => m.sender === 'user');
    if (lastUser) {
      // Remove last copilot message (the failed one)
      setMessages(prev => {
        const msgs = [...prev];
        if (msgs[msgs.length - 1]?.sender === 'copilot') msgs.pop();
        return msgs;
      });
      handleSendPrompt(lastUser.text);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-surface border-l border-borderWarm shadow-2xl z-50 flex flex-col font-sans">

      {/* Header */}
      <div className="px-4 py-3 border-b border-borderWarm flex items-center justify-between bg-canvas flex-shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-lime/20 rounded-xl text-olive border border-lime/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-widest text-ink/40 font-bold mb-0.5">[ INTELLIGENCE ]</div>
            <h3 className="font-black text-[13px] text-ink tracking-tight leading-none">AI Copilot</h3>
            <div className="text-[10px] text-olive font-semibold flex items-center mt-0.5 space-x-1">
              <Shield className="w-2.5 h-2.5" />
              <span>RBAC · Data Grounded · Read-Only</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={startNewChat}
            title="New conversation"
            className="p-1.5 text-ink/50 hover:text-olive hover:bg-lime/10 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-ink/50 hover:text-ink hover:bg-surface rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="px-3 py-2 border-b border-borderWarm bg-surface/60 flex space-x-1.5 overflow-x-auto flex-shrink-0 scrollbar-hide">
        {QUICK_PROMPTS.map(qp => (
          <button
            key={qp.prompt}
            onClick={() => handleSendPrompt(qp.prompt)}
            disabled={isLoading}
            className="px-2.5 py-1 bg-canvas hover:bg-lime/15 border border-borderWarm text-ink rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors disabled:opacity-40 flex-shrink-0"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Tool Status Banner */}
      {toolStatus && (
        <div className="px-4 py-2 border-b border-borderWarm bg-lime/10 flex items-center space-x-2 flex-shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-olive animate-ping flex-shrink-0" />
          <span className="text-[10px] text-olive font-semibold">{toolStatus}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-canvas/30">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed shadow-sm ${
                m.sender === 'user'
                  ? 'bg-olive text-white font-medium'
                  : 'bg-surface border border-borderWarm text-ink'
              }`}
            >
              {m.sender === 'user' ? (
                <span className="whitespace-pre-wrap">{m.text}</span>
              ) : (
                <>
                  {m.text ? renderMarkdown(m.text) : (
                    m.isStreaming && (
                      <div className="flex items-center space-x-1.5 py-1">
                        <span className="w-1.5 h-1.5 bg-olive/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-olive/60 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
                        <span className="w-1.5 h-1.5 bg-olive/60 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
                      </div>
                    )
                  )}

                  {/* Source badge */}
                  {m.sources && !m.isStreaming && (
                    <div className="mt-2 pt-2 border-t border-borderWarm/60 flex items-center space-x-1">
                      <Database className="w-2.5 h-2.5 text-olive/60 flex-shrink-0" />
                      <span className="text-[9px] text-ink/40 font-mono">
                        {typeof m.sources === 'object' && m.sources.source
                          ? m.sources.source
                          : 'TMP Database'}
                      </span>
                    </div>
                  )}

                  {/* Streaming cursor */}
                  {m.isStreaming && m.text && (
                    <span className="inline-block w-0.5 h-3 bg-olive animate-pulse ml-0.5 align-middle" />
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {/* Retry button if last copilot message has error */}
        {!isLoading && messages[messages.length - 1]?.sender === 'copilot' &&
          messages[messages.length - 1]?.text?.startsWith('❌') && (
          <div className="flex justify-center">
            <button
              onClick={handleRetry}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-surface border border-borderWarm rounded-full text-[10px] font-semibold text-ink/70 hover:text-ink hover:bg-canvas transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      <div className="absolute bottom-16 right-4">
        <button
          onClick={scrollToBottom}
          className="p-1.5 bg-surface border border-borderWarm rounded-full text-ink/40 hover:text-ink shadow-sm transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); handleSendPrompt(); }}
        className="px-3 py-3 border-t border-borderWarm bg-surface flex items-center space-x-2 flex-shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={isLoading ? 'Copilot is thinking...' : 'Ask about projects, team, sprints...'}
          disabled={isLoading}
          className="input-warm flex-1 py-2 px-3 text-[11px] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isLoading || !prompt.trim()}
          className="p-2.5 bg-olive hover:bg-olive/90 text-white rounded-full shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
