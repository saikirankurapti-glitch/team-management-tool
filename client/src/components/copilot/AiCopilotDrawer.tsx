import React, { useState, useEffect } from 'react';
import { Send, X, Check, Sparkles, Shield, Database } from 'lucide-react';
import { fetchApi } from '../../services/api';

interface Message {
  sender: 'user' | 'copilot';
  text: string;
  proposal?: any;
  sources?: any[];
}

export const AiCopilotDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'copilot',
      text: "👋 Hi! I'm your permission-aware AI Copilot. Ask me about project health, team capacity, overdue work, GitHub repositories, or ask me to draft a work item.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && !conversationId) {
      fetchApi<any[]>('/copilot/conversations')
        .then((convs) => {
          if (convs.length > 0) {
            setConversationId(convs[0].id);
            fetchApi<any[]>(`/copilot/conversations/${convs[0].id}`).then((msgs) => {
              if (msgs.length > 0) {
                setMessages(
                  msgs.map((m) => ({
                    sender: m.sender as 'user' | 'copilot',
                    text: m.content,
                    proposal: m.proposal ? JSON.parse(m.proposal) : undefined,
                    sources: m.sources ? JSON.parse(m.sources) : undefined,
                  }))
                );
              }
            });
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendPrompt = async (textToSend?: string) => {
    const text = textToSend || prompt;
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { sender: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setPrompt('');
    setIsLoading(true);

    try {
      const res = await fetchApi<any>('/copilot/ask', {
        method: 'POST',
        body: JSON.stringify({ prompt: text, contextPage: window.location.pathname, conversationId }),
      });

      if (res.conversationId) setConversationId(res.conversationId);

      const copilotMsg: Message = {
        sender: 'copilot',
        text: res.response,
        proposal: res.proposal,
        sources: res.sources,
      };

      setMessages((prev) => [...prev, copilotMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { sender: 'copilot', text: err.message || 'Sorry, I encountered an error querying workspace data.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmProposal = async (proposal: any) => {
    try {
      const res = await fetchApi<any>('/copilot/confirm', {
        method: 'POST',
        body: JSON.stringify({ proposal }),
      });

      setMessages((prev) => [
        ...prev,
        { sender: 'copilot', text: `✅ Confirmed & Executed: ${res.message}` },
      ]);
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-surface border-l border-borderWarm shadow-2xl z-50 flex flex-col text-xs font-sans">
      {/* Editorial Header */}
      <div className="p-4 border-b border-borderWarm flex items-center justify-between bg-canvas">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-lime/30 rounded-xl text-olive border border-borderWarm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="editorial-eyebrow text-[9px] mb-0.5">[ INTELLIGENCE ]</div>
            <h3 className="font-black text-sm text-ink tracking-tight">AI Copilot</h3>
            <span className="text-[10px] text-olive font-bold flex items-center mt-0.5">
              <Shield className="w-3 h-3 mr-1" /> RBAC & Data Grounded
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-ink/60 hover:text-ink hover:bg-surface rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Suggested Quick Prompts Pills */}
      <div className="p-3 border-b border-borderWarm bg-surface flex space-x-2 overflow-x-auto">
        <button
          onClick={() => handleSendPrompt('Which projects are at risk?')}
          className="px-3 py-1 bg-canvas hover:bg-lime/20 border border-borderWarm text-ink rounded-full text-[10px] font-bold whitespace-nowrap transition-colors"
        >
          🚨 Project Health
        </button>
        <button
          onClick={() => handleSendPrompt('Who is overloaded?')}
          className="px-3 py-1 bg-canvas hover:bg-lime/20 border border-borderWarm text-ink rounded-full text-[10px] font-bold whitespace-nowrap transition-colors"
        >
          ⚡ Team Capacity
        </button>
        <button
          onClick={() => handleSendPrompt('List connected GitHub repos')}
          className="px-3 py-1 bg-canvas hover:bg-lime/20 border border-borderWarm text-ink rounded-full text-[10px] font-bold whitespace-nowrap transition-colors"
        >
          🐙 GitHub Repos
        </button>
        <button
          onClick={() => handleSendPrompt('Create bug for API rate limit')}
          className="px-3 py-1 bg-canvas hover:bg-lime/20 border border-borderWarm text-ink rounded-full text-[10px] font-bold whitespace-nowrap transition-colors"
        >
          ➕ Draft Bug
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-canvas/40">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] rounded-2xl p-3.5 space-y-2 shadow-sm ${
                m.sender === 'user'
                  ? 'bg-olive text-white font-medium'
                  : 'bg-surface border border-borderWarm text-ink'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>

              {/* Source citations */}
              {m.sources && Array.isArray(m.sources) && m.sources.length > 0 && (
                <div className="pt-2 border-t border-borderWarm text-[10px] text-ink/70 font-mono space-y-1">
                  <div className="font-bold text-ink flex items-center">
                    <Database className="w-3 h-3 mr-1 text-olive" /> Grounded Database Sources ({m.sources.length}):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {m.sources.slice(0, 3).map((s: any, sIdx: number) => (
                      <span key={sIdx} className="px-2 py-0.5 bg-canvas border border-borderWarm rounded-full text-[9px] font-semibold text-ink">
                        {s.humanId || s.key || s.fullName || s.name || 'Record'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Proposal Confirmation Card */}
              {m.proposal && (
                <div className="p-3 bg-lime/20 border border-borderWarm rounded-xl space-y-2 mt-2">
                  <div className="font-black text-ink text-[11px] uppercase tracking-wider">Action Proposal Preview</div>
                  <div className="text-[10px] text-ink/80 font-mono bg-surface p-2.5 rounded-lg border border-borderWarm">
                    {m.proposal.draft?.title ? `Title: ${m.proposal.draft.title}` : `Target: ${m.proposal.draft?.humanId} → ${m.proposal.draft?.targetStatus}`}
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={() => handleConfirmProposal(m.proposal)}
                      className="btn-pill-primary py-1.5 px-3 text-[11px] flex items-center space-x-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm & Execute</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="text-ink/60 text-[11px] italic flex items-center space-x-2 p-2">
            <span className="w-2 h-2 rounded-full bg-olive animate-ping"></span>
            <span>Querying telemetry and verifying RBAC permissions...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendPrompt();
        }}
        className="p-3 border-t border-borderWarm bg-surface flex items-center space-x-2"
      >
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask AI Copilot anything..."
          className="input-warm flex-1 py-2 px-3 text-xs"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="p-2.5 bg-olive hover:bg-olive/90 text-white rounded-full font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

