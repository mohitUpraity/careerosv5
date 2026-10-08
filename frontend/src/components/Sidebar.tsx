import React from 'react';
import { 
  Network, 
  Target, 
  Send, 
  FileText, 
  Activity, 
  Code2, 
  GitCompare, 
  Compass, 
  UserCog, 
  Sparkles, 
  TrendingUp, 
  Swords,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'graph' | 'opportunities' | 'growth' | 'interview' | 'matcher' | 'benchmark' | 'referrals' | 'resume' | 'profile' | 'brain';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

interface NavSection {
  title: string;
  items: {
    id: ActiveTab;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeColor?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { activeProfile } = useAuth();

  const navSections: NavSection[] = [
    {
      title: 'AI & Topology',
      items: [
        {
          id: 'brain',
          label: 'Brain Chat AI',
          sublabel: 'GraphRAG Copilot',
          icon: Sparkles,
          badge: 'AI',
          badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300'
        },
        {
          id: 'graph',
          label: 'Knowledge Graph',
          sublabel: 'Code & Skill Ontology',
          icon: Network,
          badge: 'Graph',
          badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300'
        },
      ]
    },
    {
      title: 'Opportunities & Fit',
      items: [
        {
          id: 'opportunities',
          label: 'Opportunities Radar',
          sublabel: 'Jobs, Hackathons, Bounties',
          icon: Compass,
          badge: 'Live',
          badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
        },
        {
          id: 'matcher',
          label: 'Job Matchmaker',
          sublabel: 'Semantic Fit Scoring',
          icon: Target,
        },
        {
          id: 'benchmark',
          label: 'Benchmark Lab',
          sublabel: 'Peer Gap Analysis',
          icon: GitCompare,
        },
      ]
    },
    {
      title: 'Prep & Execution',
      items: [
        {
          id: 'growth',
          label: 'Career Growth',
          sublabel: 'Skill Gaps & Sprints',
          icon: TrendingUp,
        },
        {
          id: 'interview',
          label: 'Interview Arena',
          sublabel: 'AI Simulation & Intel',
          icon: Swords,
          badge: 'Voice',
          badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
        },
        {
          id: 'referrals',
          label: 'Referral Hub',
          sublabel: 'Alumni & Warm Outreach',
          icon: Send,
        },
        {
          id: 'resume',
          label: 'Resume Studio',
          sublabel: 'ATS-Optimized Builder',
          icon: FileText,
        },
      ]
    },
    {
      title: 'Identity',
      items: [
        {
          id: 'profile',
          label: 'Profile & Targets',
          sublabel: 'Roles, Cities & Preferences',
          icon: UserCog,
        },
      ]
    }
  ];

  return (
    <aside
      className="w-full lg:w-64 shrink-0 flex flex-col justify-between p-3.5 min-h-[calc(100vh-53px)] transition-colors select-none"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-primary)',
      }}
    >
      <div className="space-y-4">
        {/* User Card — Spacious & Tactile */}
        <div
          onClick={() => setActiveTab('profile')}
          className="p-3 rounded-xl cursor-pointer transition-all duration-150 group"
          title="Click to view & edit Profile Preferences"
          style={{
            backgroundColor: activeTab === 'profile' ? 'var(--brand-50)' : 'var(--bg-secondary)',
            border: activeTab === 'profile' ? '1px solid var(--brand-500)' : '1px solid var(--border-primary)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              {activeProfile.avatar ? (
                <img
                  src={activeProfile.avatar}
                  alt={activeProfile.name}
                  className="w-10 h-10 rounded-lg object-cover"
                  style={{ border: '1.5px solid var(--border-primary)' }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm bg-blue-600 text-white shadow-xs"
                >
                  {(activeProfile.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                title="Profile active"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <h4 className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                  {activeProfile.name}
                </h4>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {activeProfile.role}
              </p>
              {activeProfile.githubUser ? (
                <div className="inline-flex items-center gap-1 text-[10px] font-mono mt-1 text-blue-600 dark:text-blue-400">
                  <Code2 className="w-3 h-3" />
                  <span>@{activeProfile.githubUser}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 text-[10px] font-mono mt-1 text-slate-400">
                  <Code2 className="w-3 h-3" />
                  <span>No GitHub</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Categorized Navigation */}
        <nav className="space-y-4">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className="w-full flex items-center justify-between p-2 rounded-lg text-left transition-all duration-150 cursor-pointer group relative"
                      style={{
                        backgroundColor: isActive ? 'var(--brand-50)' : 'transparent',
                        color: isActive ? 'var(--brand-600)' : 'var(--text-secondary)',
                      }}
                    >
                      {isActive && (
                        <span
                          className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full"
                          style={{ backgroundColor: 'var(--brand-600)' }}
                        />
                      )}

                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="p-1.5 rounded-md transition-colors"
                          style={{
                            backgroundColor: isActive ? 'var(--brand-100)' : 'var(--bg-tertiary)',
                            color: isActive ? 'var(--brand-600)' : 'var(--text-secondary)',
                          }}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span
                            className="block text-xs font-semibold truncate leading-tight"
                            style={{
                              color: isActive ? 'var(--brand-600)' : 'var(--text-primary)',
                            }}
                          >
                            {item.label}
                          </span>
                          <span className="block text-[10px] truncate leading-tight mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {item.sublabel}
                          </span>
                        </div>
                      </div>

                      {item.badge && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ml-1.5 ${item.badgeColor || 'bg-slate-100 text-slate-600'}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Footer: Minimalist Operational Status */}
      <div className="pt-3 border-t mt-4" style={{ borderColor: 'var(--border-primary)' }}>
        <div
          className="px-2.5 py-2 rounded-lg text-[11px] flex items-center justify-between group cursor-default"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
          }}
          title="Engine: Groq Llama 3.3 · Knowledge Base: Neo4j Aura GraphDB · FastAST Sandbox"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              Core Engine Live
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            v5.0
          </span>
        </div>
      </div>
    </aside>
  );
};
