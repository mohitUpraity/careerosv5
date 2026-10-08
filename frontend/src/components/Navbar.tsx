import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  GitFork, 
  Users, 
  GraduationCap, 
  Share2, 
  Trash2, 
  LogIn, 
  LogOut, 
  ChevronDown, 
  ShieldCheck,
  UserCheck,
  Github,
  Download,
  FileText,
  Linkedin,
  RefreshCw,
  Plus,
  ExternalLink,
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProfileAnalysis } from '../services/api';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  analysis: ProfileAnalysis | null;
  onOpenResetModal: () => void;
  onOpenSyncGitHub: () => void;
  onOpenSyncResume?: () => void;
  onOpenSyncLinkedIn?: () => void;
  onOpenExtensionModal?: () => void;
  onRefreshData: () => void;
  loading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  analysis,
  onOpenResetModal,
  onOpenSyncGitHub,
  onOpenSyncResume,
  onOpenSyncLinkedIn,
  onOpenExtensionModal,
  onRefreshData,
  loading,
}) => {
  const { user, isLoggedIn, activeProfile, loginWithGoogle, logout, switchProfile } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSyncMenu, setShowSyncMenu] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const syncMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (syncMenuRef.current && !syncMenuRef.current.contains(event.target as Node)) {
        setShowSyncMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 w-full px-4 lg:px-6 py-2.5 backdrop-blur-md transition-colors"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-primary)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Brand Identity & Mode Switcher */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shadow-blue-500/20 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  CareerOS
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  v5.0
                </span>
              </div>
              <p className="text-[11px] font-medium hidden sm:block leading-none mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                Career Co-Pilot & Referral Network
              </p>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden md:block" />

          {/* Sleek Profile Switcher Pill */}
          <div className="relative hidden md:flex items-center">
            <div
              className="flex items-center p-0.5 rounded-lg text-xs"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              <button
                onClick={() => switchProfile('candidate')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer"
                style={{
                  backgroundColor: activeProfile.type === 'candidate' ? 'var(--bg-primary)' : 'transparent',
                  color: activeProfile.type === 'candidate' ? 'var(--brand-600)' : 'var(--text-secondary)',
                  boxShadow: activeProfile.type === 'candidate' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  fontWeight: activeProfile.type === 'candidate' ? 600 : 500,
                }}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Candidate</span>
              </button>
              <button
                onClick={() => switchProfile('coworker')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer"
                style={{
                  backgroundColor: activeProfile.type === 'coworker' ? 'var(--bg-primary)' : 'transparent',
                  color: activeProfile.type === 'coworker' ? 'var(--brand-600)' : 'var(--text-secondary)',
                  boxShadow: activeProfile.type === 'coworker' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  fontWeight: activeProfile.type === 'coworker' ? 600 : 500,
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Benchmark</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center: Live Footprint Telemetry (Clean, Modern & Compact) */}
        <div
          className="hidden xl:flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <div className="flex items-center gap-1.5" title="AST Verified Repositories">
            <GitFork className="w-3.5 h-3.5 text-blue-500" />
            <span style={{ color: 'var(--text-secondary)' }}>Repos:</span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {analysis?.repos_count ?? 0}
            </span>
          </div>

          <div className="h-3 w-px" style={{ backgroundColor: 'var(--border-secondary)' }} />

          <div className="flex items-center gap-1.5" title="Warm Referral Connections">
            <Users className="w-3.5 h-3.5 text-emerald-500" />
            <span style={{ color: 'var(--text-secondary)' }}>Network:</span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {analysis?.connections_count ?? 0}
            </span>
          </div>

          <div className="h-3 w-px" style={{ backgroundColor: 'var(--border-secondary)' }} />

          <div className="flex items-center gap-1.5" title="Alumni & School Bridges">
            <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
            <span style={{ color: 'var(--text-secondary)' }}>Alumni:</span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {analysis?.alumni_count ?? 0}
            </span>
          </div>

          <div className="h-3 w-px" style={{ backgroundColor: 'var(--border-secondary)' }} />

          <div className="flex items-center gap-1.5" title="Knowledge Graph Entities">
            <Share2 className="w-3.5 h-3.5 text-purple-500" />
            <span style={{ color: 'var(--text-secondary)' }}>Nodes:</span>
            <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {analysis?.graph_nodes_count ?? 0}
            </span>
          </div>

          <button
            onClick={onRefreshData}
            disabled={loading}
            className="ml-1 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            title="Refresh profile and graph data"
          >
            <RefreshCw className={`w-3 h-3 text-slate-400 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>

        {/* Right Actions: Unified Sync Hub + Theme + Profile */}
        <div className="flex items-center gap-2">
          {/* Unified Sync Hub Dropdown */}
          <div className="relative" ref={syncMenuRef}>
            <button
              onClick={() => setShowSyncMenu(!showSyncMenu)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-xs transition-all cursor-pointer"
              title="Connect GitHub, Upload Resume, LinkedIn or Extension"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Sync Data</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {showSyncMenu && (
              <div
                className="absolute right-0 mt-2 w-72 p-2 rounded-xl shadow-xl z-50 animate-fade-in text-xs space-y-1"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                <div className="px-2 py-1.5 mb-1 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Data Sources & Bridges</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    Sync signals to enrich your Career Graph
                  </p>
                </div>

                {/* Sync GitHub */}
                <button
                  onClick={() => {
                    setShowSyncMenu(false);
                    onOpenSyncGitHub();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400">
                      <Github className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-semibold block" style={{ color: 'var(--text-primary)' }}>
                        Sync GitHub
                      </span>
                      <span className="text-[11px] block" style={{ color: 'var(--text-secondary)' }}>
                        AST repos, code & tech stack
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    Connect
                  </span>
                </button>

                {/* Sync Resume */}
                {onOpenSyncResume && (
                  <button
                    onClick={() => {
                      setShowSyncMenu(false);
                      onOpenSyncResume();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold block" style={{ color: 'var(--text-primary)' }}>
                          Sync Master Resume
                        </span>
                        <span className="text-[11px] block" style={{ color: 'var(--text-secondary)' }}>
                          PDF parser for roles & skills
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      Upload
                    </span>
                  </button>
                )}

                {/* Sync LinkedIn */}
                {onOpenSyncLinkedIn && (
                  <button
                    onClick={() => {
                      setShowSyncMenu(false);
                      onOpenSyncLinkedIn();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-sky-50 text-sky-600 dark:bg-sky-950/80 dark:text-sky-400">
                        <Linkedin className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold block" style={{ color: 'var(--text-primary)' }}>
                          Sync LinkedIn
                        </span>
                        <span className="text-[11px] block" style={{ color: 'var(--text-secondary)' }}>
                          Connections & alumni network
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
                      Bridge
                    </span>
                  </button>
                )}

                {/* Chrome Extension */}
                {onOpenExtensionModal && (
                  <button
                    onClick={() => {
                      setShowSyncMenu(false);
                      onOpenExtensionModal();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-semibold block" style={{ color: 'var(--text-primary)' }}>
                          Chrome Extension
                        </span>
                        <span className="text-[11px] block" style={{ color: 'var(--text-secondary)' }}>
                          1-click job & notice scraper
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                      Beta .zip
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          <ThemeToggle />

          {/* User Auth & Account Menu */}
          {isLoggedIn ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg text-xs transition-all hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                <img
                  src={user?.photoURL || activeProfile.avatar}
                  alt={user?.displayName || 'User Avatar'}
                  className="w-6 h-6 rounded-md object-cover border border-slate-200 dark:border-slate-700"
                />
                <span className="font-medium max-w-[100px] sm:max-w-[120px] truncate" style={{ color: 'var(--text-primary)' }}>
                  {user?.displayName || 'Account'}
                </span>
                <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
              </button>

              {showProfileMenu && (
                <div
                  className="absolute right-0 mt-2 w-60 p-2 rounded-xl shadow-xl z-50 animate-fade-in text-xs"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  <div className="p-2 mb-1 border-b" style={{ borderColor: 'var(--border-primary)' }}>
                    <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {user?.displayName}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
                      {user?.email}
                    </p>
                    <span className="badge-success inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-medium">
                      Signed In · {activeProfile.type === 'candidate' ? 'Candidate Mode' : 'Benchmark Mode'}
                    </span>
                  </div>

                  {/* Start Fresh Reset Option */}
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenResetModal();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 transition-colors font-medium cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Start Fresh (Reset DB)</span>
                  </button>

                  <div className="my-1 border-b" style={{ borderColor: 'var(--border-primary)' }} />

                  {/* Sign Out */}
                  <button
                    onClick={() => {
                      logout();
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium cursor-pointer"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold bg-blue-600 hover:bg-blue-700 shadow-xs transition-all cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Google Sign-In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
