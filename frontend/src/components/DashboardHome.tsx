import React from 'react';
import { ArrowRight, ArrowUpRight, Check, Compass, FileText, GitBranch, Github, Layers, Linkedin, Network, Plus, Sparkles, Swords, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProfileAnalysis } from '../services/api';
import { GraphData } from '../types';
import { ActiveTab } from './workspaceNavigation';

interface DashboardHomeProps {
  analysis: ProfileAnalysis | null;
  graphData: GraphData | null;
  loading: boolean;
  onNavigate: (tab: ActiveTab) => void;
  onSyncGitHub: () => void;
  onSyncResume: () => void;
  onSyncLinkedIn: () => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({ analysis, graphData, loading, onNavigate, onSyncGitHub, onSyncResume, onSyncLinkedIn }) => {
  const { activeProfile } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = activeProfile.name.split(' ')[0] || 'there';
  const skills = [...new Set(analysis?.top_skills || [])].slice(0, 8);
  const hasEvidence = !!graphData?.nodes.length;
  const projectCount = analysis?.repos_count || 0;
  const contactsCount = analysis?.connections_count || 0;
  const stats = [
    { label: 'Repositories', value: projectCount, description: 'Project evidence in your profile', icon: GitBranch, tone: 'blue', tab: 'graph' as ActiveTab },
    { label: 'Connected skills', value: graphData?.nodes.filter(node => node.type?.toLowerCase() === 'skill').length || 0, description: 'Skills mapped to your work', icon: Layers, tone: 'violet', tab: 'graph' as ActiveTab },
    { label: 'Your network', value: contactsCount, description: 'People who can open doors', icon: Users, tone: 'teal', tab: 'referrals' as ActiveTab },
    { label: 'Graph connections', value: graphData?.links.length || 0, description: 'Relationships across your career', icon: Network, tone: 'amber', tab: 'graph' as ActiveTab },
  ];
  const steps = [
    { title: 'Connect your project evidence', text: 'Bring your repositories and technical skills together.', complete: projectCount > 0, action: onSyncGitHub, icon: Github },
    { title: 'Shape your career profile', text: 'Add your experience and choose the roles you want.', complete: false, action: () => onNavigate('profile'), icon: FileText },
    { title: 'Discover your next opportunity', text: 'Explore roles and challenges matched to your profile.', complete: false, action: () => onNavigate('opportunities'), icon: Compass },
  ];

  return <div className="dashboard-view dashboard-view--overview">
    <div className="dashboard-home-heading"><div><span className="dashboard-eyebrow">YOUR CAREER WORKSPACE</span><h1>{greeting}, {firstName}<span className="dashboard-greeting-dot">.</span></h1><p>A clearer picture of your strengths. A more focused next step.</p></div><button className="dashboard-button dashboard-button-primary" onClick={() => onNavigate('opportunities')}>Explore opportunities <ArrowUpRight size={16} /></button></div>

    <div className="dashboard-metric-grid" aria-busy={loading}>{stats.map(({ label, value, description, icon: Icon, tone, tab }) => <button key={label} className="dashboard-metric-card" onClick={() => onNavigate(tab)}><div className="dashboard-metric-top"><span className={`dashboard-soft-icon is-${tone}`}><Icon size={20} /></span><ArrowUpRight size={16} /></div><span className="dashboard-metric-value">{loading ? <span className="dashboard-skeleton" /> : value.toLocaleString()}</span><strong>{label}</strong><span className="dashboard-metric-description">{description}</span></button>)}</div>

    <div className="dashboard-overview-grid">
      <section className="dashboard-home-panel dashboard-next-step"><div className="dashboard-panel-heading"><span className="dashboard-eyebrow">MAKE YOUR NEXT MOVE</span><span className="dashboard-subtle-pill"><Compass size={13} /> Opportunity discovery</span></div><div className="dashboard-next-step-body"><div><h2>Your experience has<br />somewhere to go.</h2><p>Find relevant roles, understand your fit, and turn your strongest work into your next application.</p><button className="dashboard-button dashboard-button-primary" onClick={() => onNavigate('opportunities')}>Find my next role <ArrowRight size={16} /></button></div><div className="dashboard-path-art" aria-hidden="true"><span className="dashboard-path-line" /><span className="dashboard-path-node path-one"><GitBranch size={21} /></span><span className="dashboard-path-node path-two"><Network size={25} /></span><span className="dashboard-path-node path-three"><Compass size={23} /></span><span className="dashboard-path-label">Evidence → Insight → Opportunity</span></div></div><div className="dashboard-next-step-footer"><span><Check size={15} /> Start with your real skills and projects</span><button onClick={() => onNavigate('matcher')}>Have a job description? <ArrowUpRight size={14} /></button></div></section>

      <section className="dashboard-home-panel dashboard-copilot-panel"><div className="dashboard-panel-heading"><span className="dashboard-soft-icon is-violet"><Sparkles size={20} /></span><span className="dashboard-subtle-pill">Your co-pilot</span></div><h2>A little clarity.<br />A better next step.</h2><p>Ask about your skills, career options, or how to prepare for a role.</p><button className="dashboard-copilot-prompt" onClick={() => onNavigate('brain')}><span>“Where should I focus next?”</span><ArrowUpRight size={17} /></button><button className="dashboard-text-link" onClick={() => onNavigate('brain')}>Open Brain Chat <ArrowRight size={15} /></button></section>

      <section className="dashboard-home-panel dashboard-evidence-panel"><div className="dashboard-panel-heading"><div><span className="dashboard-eyebrow">BUILT ON YOUR WORK</span><h2>Your skills, connected</h2></div><button className="dashboard-icon-button" onClick={() => onNavigate('graph')} aria-label="Explore your knowledge graph"><ArrowUpRight size={18} /></button></div><p>Your career graph brings together the skills, projects, and people behind your profile.</p><div className="dashboard-home-skills">{loading ? <><span className="dashboard-skeleton" /><span className="dashboard-skeleton" /><span className="dashboard-skeleton" /></> : skills.length ? skills.map(skill => <span key={skill}><span className="dashboard-skill-dot" />{skill}</span>) : <div className="dashboard-inline-empty"><Network size={25} /><span>{hasEvidence ? 'Explore your graph to see how your experience connects.' : 'Connect your profile to start building your career graph.'}</span></div>}</div><div className="dashboard-source-row"><span><Github size={16} /> GitHub</span><strong>{loading ? 'Loading…' : projectCount > 0 ? `${projectCount} repositories` : 'Ready to connect'}</strong><button onClick={onSyncGitHub}>{projectCount > 0 ? 'Sync' : 'Connect'} <Plus size={14} /></button></div><div className="dashboard-source-row"><span><FileText size={16} /> Resume</span><strong>Your experience blueprint</strong><button onClick={onSyncResume}>Upload <Plus size={14} /></button></div><div className="dashboard-source-row"><span><Linkedin size={16} /> LinkedIn</span><strong>{loading ? 'Loading…' : contactsCount > 0 ? `${contactsCount} contacts` : 'Grow your network'}</strong><button onClick={onSyncLinkedIn}>Import <Plus size={14} /></button></div><button className="dashboard-text-link" onClick={() => onNavigate('graph')}>Explore your knowledge graph <ArrowRight size={15} /></button></section>

      <section className="dashboard-home-panel dashboard-checklist-panel"><div className="dashboard-panel-heading"><div><span className="dashboard-eyebrow">A FOCUSED START</span><h2>Build your next chapter</h2></div><TrendingUp size={20} /></div><p>Three useful places to start. Take them at your own pace.</p><ol className="dashboard-home-checklist">{steps.map(({ title, text, complete, action, icon: Icon }, index) => <li key={title}><button onClick={action}><span className={`dashboard-step-number ${complete ? 'is-complete' : ''}`}>{complete ? <Check size={16} /> : `0${index + 1}`}</span><span><strong>{title}</strong><small>{text}</small></span><Icon size={18} /></button></li>)}</ol><div className="dashboard-checklist-note">Your progress starts with your own evidence.</div></section>
    </div>

    <section className="dashboard-tools-section"><div className="dashboard-tools-heading"><h2>Ready when you are</h2><p>Everything you need for a stronger application.</p></div><div className="dashboard-tool-grid">{[
      { title: 'A resume that fits the role', description: 'Tailor your experience and review every AI suggestion.', label: 'Open Resume Studio', tab: 'resume' as ActiveTab, icon: FileText, tone: 'blue' },
      { title: 'Practice before the real thing', description: 'Prepare with interviews, role insights, and feedback.', label: 'Enter Interview Arena', tab: 'interview' as ActiveTab, icon: Swords, tone: 'violet' },
      { title: 'Grow with a clear direction', description: 'Turn skill gaps into focused, hands-on learning sprints.', label: 'Explore Career Growth', tab: 'growth' as ActiveTab, icon: TrendingUp, tone: 'teal' },
    ].map(({ title, description, label, tab, icon: Icon, tone }) => <button className="dashboard-tool-card" key={tab} onClick={() => onNavigate(tab)}><span className={`dashboard-soft-icon is-${tone}`}><Icon size={20} /></span><h3>{title}</h3><p>{description}</p><span className="dashboard-text-link">{label} <ArrowRight size={15} /></span></button>)}</div></section>
  </div>;
};
