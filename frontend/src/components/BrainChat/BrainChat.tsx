import { DialogFrame } from '../DialogFrame';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Copy, 
  Check, 
  Network, 
  Code2, 
  Briefcase, 
  Target, 
  Compass, 
  ChevronRight,
  Layers,
  Database,
  Lightbulb,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Plus,
  PanelRight,
  X,
  FileText,
  TrendingUp
} from 'lucide-react';
import { apiService, ProfileAnalysis } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './BrainChat.css';

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
  contextMode?: ContextMode;
}

type ContextMode = 'general' | 'code' | 'benchmark' | 'opportunities';
const CHAT_CONTEXTS = [
  { id: 'general', label: 'My profile', detail: 'Skills, experience & goals', icon: User, welcome: 'Discover your strengths, plan your next step, or turn your experience into a stronger application.', prompts: [
    { label: 'Discover my strengths', detail: 'See the skills I can prove', icon: Sparkles, query: 'What are my strongest skills and projects, based on my profile evidence?' },
    { label: 'Plan my next move', detail: 'Find a useful step forward', icon: Compass, query: 'Based on my experience and career goals, what should I focus on next?' },
    { label: 'Find matching roles', detail: 'Explore where I could fit', icon: Briefcase, query: 'Which opportunities match my skills and experience best?' },
    { label: 'Write an introduction', detail: 'Start a thoughtful conversation', icon: Send, query: 'Help me draft a warm referral introduction grounded in my actual project experience.' },
  ] },
  { id: 'code', label: 'My projects', detail: 'Code & repository evidence', icon: Code2, welcome: 'Explore what your projects demonstrate and make your technical experience easier to explain.', prompts: [
    { label: 'Explore my best work', detail: 'Find strong project evidence', icon: Code2, query: 'Which of my projects best demonstrate my technical strengths, and why?' },
    { label: 'Explain my decisions', detail: 'Prepare a clear project story', icon: Layers, query: 'Help me explain the architecture and technical decisions in my projects.' },
    { label: 'Strengthen a project', detail: 'Choose a meaningful improvement', icon: TrendingUp, query: 'What improvements to my projects would create stronger evidence of my skills?' },
    { label: 'Write a resume bullet', detail: 'Show my work with clarity', icon: FileText, query: 'Draft resume bullets from my project evidence without inventing impact metrics.' },
  ] },
  { id: 'benchmark', label: 'My benchmark', detail: 'Peer comparison & skill gaps', icon: Target, welcome: 'Understand how your experience compares and choose a practical skill to develop next.', prompts: [
    { label: 'Compare my experience', detail: 'Understand the differences', icon: Target, query: 'How does my experience compare with my benchmark peer?' },
    { label: 'Find my unique strengths', detail: 'See what sets me apart', icon: Sparkles, query: 'Which capabilities differentiate me from my benchmark peer?' },
    { label: 'Prioritise a skill gap', detail: 'Focus on what matters next', icon: TrendingUp, query: 'Which gaps in my benchmark comparison should I focus on first, and why?' },
    { label: 'Create a learning plan', detail: 'Turn a gap into a project', icon: Layers, query: 'Create a focused two-week project plan to close my most important benchmark skill gap.' },
  ] },
  { id: 'opportunities', label: 'Opportunities', detail: 'Relevant roles & challenges', icon: Briefcase, welcome: 'Explore opportunities through your own experience and prepare for the roles that interest you.', prompts: [
    { label: 'Find relevant roles', detail: 'Match my skills to opportunities', icon: Briefcase, query: 'Which current opportunities best match my skills, experience, and career preferences?' },
    { label: 'Understand my fit', detail: 'See strengths and gaps', icon: Target, query: 'Explain my fit for the most relevant available role, including my strengths and skill gaps.' },
    { label: 'Prepare an application', detail: 'Choose useful next steps', icon: FileText, query: 'How should I prepare my application for a role that matches my profile?' },
    { label: 'Find a warm introduction', detail: 'Use my network with context', icon: Send, query: 'How can I use my existing network to find a relevant introduction for opportunities that fit me?' },
  ] },
] as const;

interface BrainChatProps {
  analysis?: ProfileAnalysis | null;
  onNavigateToTab?: (tab: string) => void;
  onNavigateToGraphQuery?: (query: string) => void;
  onTailorResume?: (role: string, company: string, jd: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export const BrainChat: React.FC<BrainChatProps> = ({
  analysis,
  onNavigateToTab,
  onNavigateToGraphQuery,
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
    content: 'Welcome to CareerOS Brain. Explore your strengths, plan your next move, or prepare an application with guidance grounded in your career context.',
    suggestedFollowups: CHAT_CONTEXTS[0].prompts.map(prompt => prompt.query),
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
  const [contextMode, setContextMode] = useState<ContextMode>(() => {
    try {
      const saved = localStorage.getItem(`careeros_brain_context_mode_${userId}`);
      if (saved && ['general', 'code', 'benchmark', 'opportunities'].includes(saved)) {
        return saved as ContextMode;
      }
    } catch (e) {}
    return 'general';
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const focus = CHAT_CONTEXTS.find(context => context.id === contextMode)!;
  const FocusIcon = focus.icon;
  const hasConversation = messages.some(message => !message.id.startsWith('welcome-'));
  const loadedUser = useRef(userId);

  const historyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync messages to localStorage whenever they change
  useEffect(() => {
    if (loadedUser.current !== userId) return;
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
    if (loadedUser.current !== userId) return;
    try {
      localStorage.setItem(contextModeKey, contextMode);
    } catch (e) {}
  }, [contextMode, contextModeKey]);

  // Reload chat when user ID changes (e.g. login/logout)
  useEffect(() => {
    loadedUser.current = userId;
    try {
      const savedMode = localStorage.getItem(contextModeKey);
      setContextMode(CHAT_CONTEXTS.some(context => context.id === savedMode) ? savedMode as ContextMode : 'general');
    } catch { setContextMode('general'); }
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
    const feed = historyRef.current;
    if (feed) feed.scrollTo({ top: hasConversation ? feed.scrollHeight : 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = Math.min(Math.max(field.scrollHeight, 44), 140) + 'px';
  }, [input]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      contextMode
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
      if (typeof res.reply !== 'string' || !res.reply.trim()) throw new Error('No answer was returned. Please try again.');

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        citations: res.citations || [],
        graphNodes: res.graph_nodes_referenced || [],
        graphLens: res.graph_lens || null,
        suggestedFollowups: res.suggested_followups || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        contextMode
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      onError(err.message || 'Brain Chat query failed');
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `I couldn’t complete that answer. ${err.message || 'Check your connection and try again.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleCopyText = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch { onError('Could not copy the response. Select the text and copy it manually.'); return; }
    setCopiedId(id);
    onSuccess('Response copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    if (loading) return;
    setMessages([getDefaultWelcomeMessage()]);
    setInput('');
    setCopiedId(null);
    setShowResetDialog(false);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {}
    onSuccess('Chat session cleared');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // Render markdown-like elements simply and cleanly
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="brain-message-content space-y-2 text-xs sm:text-sm leading-relaxed">
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

  const navigateFromContext = (tab: string) => {
    setShowContextDrawer(false);
    onNavigateToTab?.(tab);
  };

  const contextContent = <>
    <section className="brain-context-card brain-focus-card"><div className="brain-rail-eyebrow"><FocusIcon size={14} />IN THIS CONVERSATION</div><h2>{focus.label}</h2><p>{focus.detail}. This focus guides your next answer.</p><div className="brain-profile-summary"><span className="dashboard-avatar">{(activeProfile.name || 'U').charAt(0).toUpperCase()}</span><div><strong>{activeProfile.name}</strong><span>{activeProfile.role}</span></div></div></section>
    <section className="brain-context-card"><div className="brain-rail-section-heading"><Network size={16} /><h2>Your career evidence</h2></div><div className="brain-evidence-metrics"><div><strong>{analysis?.top_skills?.length ?? '—'}</strong><span>Skills</span></div><div><strong>{analysis?.repos_count ?? '—'}</strong><span>Repositories</span></div></div>{analysis?.top_skills?.length ? <div className="brain-evidence-skills">{analysis.top_skills.slice(0,4).map((skill,index)=><span key={index}>{skill}</span>)}{analysis.top_skills.length > 4 && <span>+{analysis.top_skills.length - 4}</span>}</div> : <p>Add your experience and projects to make the guidance more personal.</p>}<button className="brain-rail-link" onClick={() => navigateFromContext(analysis?.top_skills?.length ? 'graph' : 'profile')}>{analysis?.top_skills?.length ? 'Explore your graph' : 'Build your profile'}<ArrowRight size={15} /></button></section>
    <section className="brain-context-card brain-next-step-card"><span className="brain-rail-eyebrow">KEEP THE MOMENTUM</span><h2>Put your next step to work.</h2><div className="brain-quick-links">{[{tab:'resume',label:'Resume Studio',icon:FileText},{tab:'growth',label:'Career Growth',icon:TrendingUp},{tab:'opportunities',label:'Opportunities Radar',icon:Briefcase}].map(({tab,label,icon:Icon})=><button key={tab} onClick={() => navigateFromContext(tab)}><Icon size={15} /><span>{label}</span><ChevronRight size={14} /></button>)}</div></section>
  </>;

  return (
    <div className="dashboard-view ws-page dashboard-view--brain brain-workspace">
      {/* Top Header & Context Controls */}
      <header className="brain-workspace-header">
        <div className="brain-header-identity"><span className="brain-header-mark"><Sparkles size={23} strokeWidth={1.6} /></span><div><span className="brain-header-eyebrow">BRAIN CHAT AI</span><h1>Think through your next move.</h1><p>Personal guidance, grounded in your career.</p></div></div>
        <div className="brain-header-actions"><button className="dashboard-button brain-context-toggle" onClick={() => setShowContextDrawer(true)} aria-label="View conversation context"><PanelRight size={16} /><span>Context</span></button><button className="dashboard-button brain-new-chat" onClick={() => hasConversation ? setShowResetDialog(true) : handleClearChat()} disabled={loading} aria-label="Start a new conversation"><Plus size={16} /><span>New chat</span></button></div>
      </header>

      <div className="brain-context-bar"><div className="brain-context-intro"><strong>Choose a focus</strong><span>Guides your next answer</span></div><div className="dashboard-context-selector" role="group" aria-label="Answer context">
        {CHAT_CONTEXTS.map(({id,label,detail,icon:Icon}) => <button key={id} title={detail} aria-pressed={contextMode === id} onClick={() => setContextMode(id)}><span className="brain-focus-icon"><Icon size={17} /></span><span><strong>{label}</strong><span>{detail}</span></span>{contextMode === id && <Check size={13} className="brain-focus-check" />}</button>)}
      </div></div>
      <div className="dashboard-chat-workspace">
      <section className="dashboard-chat-conversation" aria-label="Career conversation">
      <div className="brain-conversation-heading"><span><span className="brain-assistant-symbol"><Sparkles size={15} /></span><strong>CareerOS Brain</strong><span className="brain-assistant-label">Career co-pilot</span></span><span className="brain-context-status"><FocusIcon size={14} />{focus.label}</span></div>
      {/* Main Chat Feed */}
      <div 
        ref={historyRef} role="log" aria-label="Conversation messages" aria-live="polite" aria-relevant="additions"
        className="dashboard-chat-history"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        {messages.filter(msg => !msg.id.startsWith("welcome-") || !hasConversation).map((msg) => (
          <div 
            key={msg.id} 
            className={`brain-message brain-message--${msg.role} ${msg.id.startsWith('welcome-') ? 'brain-message--welcome' : ''} flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in duration-150`}
          >
            {/* Avatar */}
            <div 
              className={`brain-message-avatar w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Message Bubble Container */}
            <div className={`brain-message-body max-w-3xl space-y-2.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className="brain-message-author">{msg.role === 'assistant' ? 'CareerOS Brain' : 'You'}</div>
              <div 
                className={`brain-message-bubble p-4 rounded-2xl border ${
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
                {msg.id.startsWith('welcome-') ? <div className="brain-welcome"><span className="brain-welcome-mark" aria-hidden="true"><Sparkles size={27} strokeWidth={1.5} /></span><span className="brain-welcome-eyebrow">A LITTLE DIRECTION GOES A LONG WAY</span><h2>What’s your next move, {activeProfile?.name?.split(' ')[0] || 'there'}?</h2><p>{focus.welcome}</p><div className="brain-starter-grid">{focus.prompts.map(({label,detail,query,icon:Icon}) => <button key={label} onClick={() => handleSendMessage(query)} disabled={loading}><span className="brain-starter-icon"><Icon size={17} strokeWidth={1.7} /></span><span><strong>{label}</strong><small>{detail}</small></span><ArrowUpRight size={15} /></button>)}</div><span className="brain-welcome-note"><Network size={12} />Choose a starting point, or ask your own question below.</span></div> : renderMessageContent(msg.content)}

                {/* Bottom Timestamp & Copy Button */}
                <div className="brain-message-meta flex items-center justify-between gap-4 pt-2 mt-2 border-t opacity-70 text-[10px]" style={{ borderColor: 'var(--border-primary)' }}>
                  <span>{msg.timestamp}{msg.contextMode && <span className="brain-message-focus"> · {CHAT_CONTEXTS.find(context => context.id === msg.contextMode)?.label}</span>}</span>
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
                          {msg.graphLens?.title || 'Explore the evidence'}
                        </span>
                        {msg.graphNodes && msg.graphNodes.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                            {msg.graphNodes.length} Nodes Referenced
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                        {msg.graphLens?.explanation || 'Explore the career evidence referenced in this answer.'}
                      </p>
                    </div>
                  </div>

                  {onNavigateToGraphQuery && (
                    <button
                      onClick={() => onNavigateToGraphQuery(msg.graphLens?.query || msg.graphLens?.title || '')}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/80 hover:bg-purple-200 dark:hover:bg-purple-900 border border-purple-300 dark:border-purple-700 flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Explore in graph</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Citations Pill Bar (For Assistant Messages) */}
              {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pl-1">
                  <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
                    <Database className="w-3 h-3 text-purple-500" /> Supporting evidence:
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
              {msg.role === 'assistant' && !msg.id.startsWith('welcome-') && msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                <div className="brain-suggestions space-y-1.5 pt-1 pl-1">
                  <div className="brain-suggestions-label text-[11px] font-semibold flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" /> {msg.id.startsWith('welcome-') ? 'A few ways to get started' : 'Continue exploring'}
                  </div>
                  <div className="brain-suggestions-grid flex flex-wrap gap-1.5">
                    {msg.suggestedFollowups.map((suggestion, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleSendMessage(suggestion)}
                        disabled={loading}
                        className="text-left px-3 py-1.5 rounded-xl text-xs font-medium border bg-white dark:bg-gray-800/80 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-300 dark:hover:border-purple-700 transition-all flex items-center gap-1.5 group shadow-xs disabled:opacity-50"
                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                      >
                        <span>{msg.id.startsWith('welcome-') ? ['Discover my strongest skills', 'Compare my career readiness', 'Find matching opportunities', 'Draft a referral message'][sIdx] || suggestion : suggestion}</span>
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
          <div role="status" className="flex items-start gap-3 animate-in fade-in duration-150">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div 
              className="p-4 rounded-2xl rounded-tl-none border space-y-2 shadow-sm max-w-md"
              style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                <span>Reviewing your context…</span>
              </div>
              <div className="flex gap-1.5 pt-1">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Chat Input Bar */}
      <div 
        className="dashboard-chat-composer p-3 rounded-2xl border shadow-md"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="brain-composer-input flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={{general:"Ask a career question…", code:"Ask about projects…", benchmark:"Ask about your fit…", opportunities:"Ask about a role…"}[contextMode]}
            aria-label="Message CareerOS Brain"
            className="input-base flex-1 text-xs sm:text-sm resize-none leading-relaxed"
            style={{ minHeight: '44px' }}
            disabled={loading}
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!input.trim() || loading}
            aria-label={loading ? 'Preparing response' : 'Send message'}
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

        <div className="brain-composer-footer flex items-center justify-between pt-2 px-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          <span><Network size={12} /> Grounded in your selected context</span>
          <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span>
        </div>
      </div>
      </section>
      <aside className="dashboard-context-rail" aria-label="Your career context">{contextContent}</aside>
      </div>
      {showResetDialog && <DialogFrame label="Start a new conversation" onClose={() => setShowResetDialog(false)}><div className="brain-dialog-panel"><span className="brain-dialog-icon"><Plus size={23} /></span><h2>Start a new conversation?</h2><p>This will clear the current chat. Your career profile and selected focus will stay available.</p><div className="brain-dialog-actions"><button className="dashboard-button" onClick={() => setShowResetDialog(false)}>Keep chatting</button><button className="dashboard-button dashboard-button-primary" onClick={handleClearChat}>Start new chat</button></div></div></DialogFrame>}
      {showContextDrawer && <DialogFrame label="Your conversation context" onClose={() => setShowContextDrawer(false)}><div className="brain-context-dialog"><div className="brain-context-dialog-heading"><div><span className="brain-header-eyebrow">BEHIND YOUR ANSWERS</span><h2>Your conversation context</h2></div><button className="dashboard-icon-button" onClick={() => setShowContextDrawer(false)} aria-label="Close conversation context"><X size={18} /></button></div>{contextContent}</div></DialogFrame>}
    </div>
  );
};


