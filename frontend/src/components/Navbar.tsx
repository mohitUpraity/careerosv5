import React, { useState } from 'react';
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
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProfileAnalysis } from '../services/api';

interface NavbarProps {
  analysis: ProfileAnalysis | null;
  onOpenResetModal: () => void;
  onRefreshData: () => void;
  loading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  analysis,
  onOpenResetModal,
  onRefreshData,
  loading,
}) => {
  const { user, isLoggedIn, activeProfile, loginWithGoogle, logout, switchProfile } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Brand and Profile Mode Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-white" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white">CareerOS</span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  v5.0 GraphRAG
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Autonomous Career Co-Pilot & Referral Network
              </p>
            </div>
          </div>

          {/* Profile Switcher Pill */}
          <div className="relative hidden md:flex items-center">
            <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                onClick={() => switchProfile('candidate')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeProfile.type === 'candidate'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Active Candidate
              </button>
              <button
                onClick={() => switchProfile('coworker')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeProfile.type === 'coworker'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Coworker Benchmark
              </button>
            </div>
          </div>
        </div>

        {/* Center/Right: Live Stats Pills */}
        <div className="hidden xl:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <GitFork className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Repos:</span>
            <span className="font-semibold text-slate-200">{analysis?.repos_count ?? 3}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Network:</span>
            <span className="font-semibold text-slate-200">{analysis?.connections_count ?? '797+'}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Alumni:</span>
            <span className="font-semibold text-slate-200">{analysis?.alumni_count ?? '12'}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Graph Nodes:</span>
            <span className="font-semibold text-slate-200">{analysis?.graph_nodes_count ?? '42+'}</span>
          </div>
        </div>

        {/* Right Actions: Fresh Reset & Auth */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenResetModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition-all"
            title="Reset database and start fresh"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Start Fresh</span>
          </button>

          {/* User Auth Section */}
          {isLoggedIn ? (
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all text-xs"
              >
                <img
                  src={user?.photoURL || activeProfile.avatar}
                  alt={user?.displayName || 'User Avatar'}
                  className="w-6 h-6 rounded-lg object-cover ring-1 ring-emerald-500/40"
                />
                <span className="font-medium text-slate-200 max-w-[120px] truncate">
                  {user?.displayName || 'Google User'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 p-2 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl z-50 animate-fade-in text-xs">
                  <div className="p-2 border-b border-slate-800 mb-1">
                    <p className="font-semibold text-slate-200 truncate">{user?.displayName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Firebase Google Auth Active
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={loginWithGoogle}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              Google Sign-In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
