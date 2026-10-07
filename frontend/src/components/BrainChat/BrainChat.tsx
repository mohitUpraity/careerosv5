import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  RotateCcw, 
  Copy, 
  Check, 
  Network, 
  Code2, 
  Briefcase, 
  Target, 
  Compass, 
  ChevronRight,
  ExternalLink,
  Layers,
  Database,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Filter
} from 'lucide-react';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface Citation {
  type: string;
  label: string;
  detail: string;
}

interface GraphLens {
  query: string;
  title: string;
  explanation: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  graphNodes?: string[];
  graphLens?: GraphLens | null;
  suggestedFollowups?: string[];
  timestamp: string;
}

interface BrainChatProps {
  onNavigateToTab?: (tab: string) => void;
  onNavigateToGraphQuery?: (query: string) => void;
  onTailorResume?: (role: string, company: string, jd: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export const BrainChat: React.FC<BrainChatProps> = ({
  onNavigateToTab,
  onNavigateToGraphQuery,
  onTailorResume,
  onError,
  onSuccess
}) => {
  const { user, getAuthHeaders, activeProfile } = useAuth();
  
  const userId = (user as any)?.uid || (user as any)?.id || 'default';
  const storageKey = `careeros_brain_chat_history_${userId}`;
  const contextModeKey = `careeros_brain_context_mode_${userId}`;

  const getDefaultWelcomeMessage = (): ChatMessage => ({
    id: 'welcome-1',
    role: 'assistant',
    content: `👋 **Hi ${activeProfile?.name?.split(' ')[0] || (activeProfile as any)?.full_name?.split(' ')[0] || 'there'}! I'm CareerOS Brain.**\n\nI am your GraphRAG career copilot powered by your personal **Neo4j Knowledge Graph**, code-verified GitHub repositories, resume experience, and real-time opportunity index.\n\nAsk me anything about your skill topology, benchmark rankings, targeted job matches, or ask me to draft tailored messages citing your authentic projects.`,
    suggestedFollowups: [
      'What are my strongest code-verified skills and projects?',
      'How do I compare against Senior / DRDO engineer benchmarks?',
      'Which live opportunities match my tech stack best?',
      'Draft an alumni referral outreach message citing my hackathon project'
    ],
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`careeros_brain_chat_history_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read brain chat history from localStorage:', e);
    }
    return [getDefaultWelcomeMessage()];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextMode, setContextMode] = useState<'general' | 'code' | 'benchmark' | 'opportunities'>(() => {
    try {
      const saved = localStorage.getItem(`careeros_brain_context_mode_${userId}`);
      if (saved && ['general', 'code', 'benchmark', 'opportunities'].includes(saved)) {
        return saved as any;
      }
    } catch (e) {}
    return 'general';
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showGraphDrawer, setShowGraphDrawer] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync messages to localStorage whenever they change
  useEffect(() => {
    try {
      if (messages && messages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      }
    } catch (e) {
      console.warn('Could not save brain chat history to localStorage:', e);
    }
  }, [messages, storageKey]);

  // Sync contextMode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(contextModeKey, contextMode);
    } catch (e) {}
  }, [contextMode, contextModeKey]);

  // Reload chat when user ID changes (e.g. login/logout)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`careeros_brain_chat_history_${userId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch (e) {}
    setMessages([getDefaultWelcomeMessage()]);
  }, [userId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      // Build clean history array of previous turns (excluding errors and static welcome banners)
      const history = messages
        .filter(m => !m.id.startsWith('err-') && !m.id.startsWith('welcome-'))
        .map(m => ({ role: m.role, content: m.content }));
      
      const res = await apiService.chatWithBrain(
        query,
        history,
        contextMode,
        getAuthHeaders()
      );

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        citations: res.citations || [],
        graphNodes: res.graph_nodes_referenced || [],
        graphLens: res.graph_lens || null,
        suggestedFollowups: res.suggested_followups || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      onError(err.message || 'Brain Chat query failed');
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Sorry, I encountered an issue traversing your graph context: ${err.message || 'Please check your connection and try again.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onSuccess('Response copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    const welcomeMsg: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: `Chat session reset. What career or graph questions can I help you with today?`,
      suggestedFollowups: [
        'What are my strongest code-verified skills?',
        'Show matching opportunities for my stack',
        'Evaluate my readiness for Senior Backend roles'
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([welcomeMsg]);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {}
    onSuccess('Chat session cleared');
  };

  // Render markdown-like elements simply and cleanly
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-2 text-xs sm:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="text-sm font-bold pt-2 pb-1 text-purple-700 dark:text-purple-300">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.startsWith('## ')) {
            return (
              <h3 key={idx} className="text-base font-bold pt-2 pb-1 text-purple-800 dark:text-purple-200">
                {line.replace('## ', '')}
              </h3>
            );
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            const itemText = line.replace(/^[-*]\s+/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-purple-500 font-bold">•</span>
                <span>{renderFormattedText(itemText)}</span>
              </div>
            );
          }
          if (line.trim() === '') {
            return <div key={idx} className="h-1" />;
          }
          return <p key={idx}>{renderFormattedText(line)}</p>;
        })}
      </div>
    );
  };

  const renderFormattedText = (text: string) => {
    // Replace citations like [Skill: Python] or **bold**
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[.*?\])/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-purple-600 dark:text-purple-400 font-mono text-xs">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('[') && part.endsWith(']') && part.includes(':')) {
        return (
          <span 
            key={i} 
            className="inline-flex items-center gap-1 px-1.5 py-0.2 mx-0.5 rounded text-[11px] font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-mono"
          >
            {part.slice(1, -1)}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-90px)] flex flex-col space-y-3">
      {/* Top Header & Context Controls */}
      <div 
        className="p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                CareerOS Brain
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                <Network className="w-3 h-3" /> GraphRAG Engine
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Conversational intelligence grounded in your Neo4j Knowledge Graph, verified repositories, & live opportunities.
            </p>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
          {/* Focus Mode Selector */}
          <select
            value={contextMode}
            onChange={(e) => setContextMode(e.target.value as any)}
            className="input-base text-xs font-semibold"
            style={{ height: '32px' }}
          >
            <option value="general">🌐 Unified Graph Context</option>
            <option value="code">💻 Code & Projects Topology</option>
            <option value="benchmark">📊 Peer Benchmark & Gaps</option>
            <option value="opportunities">🎯 Job Matches & Radar</option>
          </select>

          <button
            onClick={handleClearChat}
            className="p-1.5 rounded-xl border hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-medium flex items-center gap-1"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
            title="Reset Chat"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Main Chat Feed */}
      <div 
        className="flex-1 overflow-y-auto p-4 sm:p-6 rounded-2xl border space-y-6 shadow-inner"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in duration-150`}
          >
            {/* Avatar */}
            <div 
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Message Bubble Container */}
            <div className={`max-w-3xl space-y-2.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div 
                className={`p-4 rounded-2xl border ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white border-blue-500 rounded-tr-none shadow-md'
                    : 'rounded-tl-none shadow-sm'
                }`}
                style={{
                  backgroundColor: msg.role === 'user' ? undefined : 'var(--bg-secondary)',
                  borderColor: msg.role === 'user' ? undefined : 'var(--border-primary)',
                  color: msg.role === 'user' ? '#ffffff' : 'var(--text-primary)'
                }}
              >
                {renderMessageContent(msg.content)}

                {/* Bottom Timestamp & Copy Button */}
                <div className="flex items-center justify-between gap-4 pt-2 mt-2 border-t opacity-70 text-[10px]" style={{ borderColor: 'var(--border-primary)' }}>
                  <span>{msg.timestamp}</span>
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopyText(msg.id, msg.content)}
                      className="hover:text-purple-600 flex items-center gap-1 transition-colors"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive Knowledge Graph Lens (NLP Graph Visualizer Bridge) */}
              {msg.role === 'assistant' && (msg.graphLens || (msg.graphNodes && msg.graphNodes.length > 0)) && (
                <div 
                  className="p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs bg-gradient-to-r from-purple-500/10 via-blue-500/5 to-transparent border-purple-200/80 dark:border-purple-800/80"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Network className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                          {msg.graphLens?.title || 'Knowledge Graph Subgraph Lens'}
                        </span>
                        {msg.graphNodes && msg.graphNodes.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                            {msg.graphNodes.length} Nodes Referenced
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                        {msg.graphLens?.explanation || 'View this clean, uncluttered subgraph directly in the interactive Graph Explorer.'}
                      </p>
                    </div>
                  </div>

                  {onNavigateToGraphQuery && (
                    <button
                      onClick={() => onNavigateToGraphQuery(msg.graphLens?.query || msg.graphLens?.title || '')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/80 hover:bg-purple-200 dark:hover:bg-purple-900 border border-purple-300 dark:border-purple-700 flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View in Graph Explorer</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Citations Pill Bar (For Assistant Messages) */}
              {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pl-1">
                  <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
                    <Database className="w-3 h-3 text-purple-500" /> Graph Citations:
                  </span>
                  {msg.citations.map((cite, cIdx) => (
                    <span
                      key={cIdx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-50/70 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 shadow-xs"
                      title={cite.detail}
                    >
                      <span className="font-bold">{cite.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Suggested Follow-up Prompt Chips */}
              {msg.role === 'assistant' && msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                <div className="space-y-1.5 pt-1 pl-1">
                  <div className="text-[11px] font-semibold flex items-center gap-1 text-purple-600 dark:text-purple-400">
                    <Lightbulb className="w-3 h-3" /> Suggested Follow-ups:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.suggestedFollowups.map((suggestion, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSendMessage(suggestion)}
                        disabled={loading}
                        className="text-left px-3 py-1.5 rounded-xl text-xs font-medium border bg-white dark:bg-gray-800/80 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-300 dark:hover:border-purple-700 transition-all flex items-center gap-1.5 group shadow-xs disabled:opacity-50"
                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                      >
                        <span>{suggestion}</span>
                        <ArrowRight className="w-3 h-3 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator Bubble */}
        {loading && (
          <div className="flex items-start gap-3 animate-in fade-in duration-150">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div 
              className="p-4 rounded-2xl rounded-tl-none border space-y-2 shadow-sm max-w-md"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                <span>Traversing Neo4j Graph & Synthesizing GraphRAG Response...</span>
              </div>
              <div className="flex gap-1.5 pt-1">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <div 
        className="p-3 rounded-2xl border shadow-md"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask CareerOS Brain about your graph, skills, benchmark gaps, or draft outreach messages... (Press Enter to send)"
            className="input-base flex-1 text-xs sm:text-sm resize-none leading-relaxed"
            style={{ minHeight: '52px' }}
            disabled={loading}
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || loading}
            className="h-[52px] px-5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 shrink-0"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Send</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 px-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          <span>💡 Tip: CareerOS Brain verifies skills against actual GitHub repos in Neo4j to prevent hallucination.</span>
          <span className="hidden sm:inline font-mono">Shift + Enter for new line</span>
        </div>
      </div>
    </div>
  );
};
