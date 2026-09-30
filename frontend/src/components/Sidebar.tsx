import React from 'react';
import { 
  Network, 
  Target, 
  Send, 
  FileText, 
  Activity, 
  Cpu, 
  Database, 
  Shield, 
  ExternalLink,
  Code2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'graph' | 'matcher' | 'referrals' | 'resume';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { activeProfile } = useAuth();

  const navItems = [
    {
      id: 'graph' as ActiveTab,
      label: 'Knowledge Graph',
      sublabel: 'Skills & Project Topology',
      icon: Network,
      color: 'emerald',
      badge: 'D3 Physics',
    },
    {
      id: 'matcher' as ActiveTab,
      label: 'AI Job Matchmaker',
      sublabel: 'Groq Llama 3.3 Scoring',
      icon: Target,
      color: 'cyan',
      badge: 'Sub-Sec AI',
    },
    {
      id: 'referrals' as ActiveTab,
      label: 'Referral Outreach Hub',
      sublabel: '797+ Verified Network',
      icon: Send,
      color: 'indigo',
      badge: '1-Click Note',
    },
    {
      id: 'resume' as ActiveTab,
      label: 'ATS Resume Studio',
      sublabel: 'Evidence-Backed Bullets',
      icon: FileText,
      color: 'amber',
      badge: 'ATS 95%+',
    },
  ];

  return (
    <aside className="w-full lg:w-72 shrink-0 flex flex-col justify-between p-4 bg-slate-950/60 border-r border-slate-800/80 min-h-[calc(100vh-61px)]">
      {/* Top Section: User Profile Card & Navigation */}
      <div className="space-y-4">
        {/* Active Profile Card */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all" />
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={activeProfile.avatar}
                alt={activeProfile.name}
                className="w-11 h-11 rounded-xl object-cover ring-2 ring-emerald-500/30 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-slate-100 truncate flex items-center gap-1.5">
                {activeProfile.name}
              </h4>
              <p className="text-[11px] text-slate-400 truncate">{activeProfile.role}</p>
              <a
                href={`https://github.com/${activeProfile.githubUser}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-mono mt-0.5"
              >
                <Code2 className="w-3 h-3" />
                @{activeProfile.githubUser}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all relative ${
                  isActive
                    ? 'bg-slate-900 text-white border border-slate-700/80 shadow-lg'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-emerald-500 rounded-r-full" />
                )}
                
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-900 text-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold">{item.label}</span>
                    <span className="block text-[10px] text-slate-400">{item.sublabel}</span>
                  </div>
                </div>

                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                  {item.badge}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: System Engine Status */}
      <div className="pt-4 border-t border-slate-800/80 space-y-2">
        <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/60 text-[11px] space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              LLM Engine
            </span>
            <span className="font-mono text-emerald-400 font-medium">Groq Llama 3.3 70B</span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              Graph DB
            </span>
            <span className="font-mono text-cyan-400 font-medium">Neo4j Aura Cloud</span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              Security
            </span>
            <span className="font-mono text-indigo-400 font-medium">Multi-Tenant Scoped</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
            Backend Online (:8000)
          </span>
          <span className="font-mono">v5.0-react</span>
        </div>
      </div>
    </aside>
  );
};
