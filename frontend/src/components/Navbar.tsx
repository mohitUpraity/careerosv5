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
  UserCheck,
  Github
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProfileAnalysis } from '../services/api';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  analysis: ProfileAnalysis | null;
  onOpenResetModal: () => void;
  onOpenSyncGitHub: () => void;
  onRefreshData: () => void;
  loading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  analysis,
  onOpenResetModal,
  onOpenSyncGitHub,
  onRefreshData,
  loading,
}) => {
  const { user, isLoggedIn, activeProfile, loginWithGoogle, logout, switchProfile } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header
      className="sticky top-0 z-30 w-full px-4 lg:px-6 py-3"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-primary)',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Brand and Profile Mode Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg"
              style={{ backgroundColor: 'var(--brand-600)' }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  CareerOS
                </span>
                <span
                  className="badge-brand text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                >
                  v5.0
                </span>
              </div>
              <p className="text-[11px] font-medium hidden sm:block" style={{ color: 'var(--text-secondary)' }}>
                Career Co-Pilot & Referral Network
              </p>
            </div>
          </div>

          {/* Profile Switcher Pill */}
          <div className="relative hidden md:flex items-center">
            <div
              className="flex items-center p-1 rounded-lg"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              <button
                onClick={() => switchProfile('candidate')}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all"
                style={{
                  backgroundColor: activeProfile.type === 'candidate' ? 'var(--brand-50)' : 'transparent',
                  color: activeProfile.type === 'candidate' ? 'var(--brand-600)' : 'var(--text-secondary)',
                  fontWeight: activeProfile.type === 'candidate' ? 600 : 500,
                }}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Candidate
              </button>
              <button
                onClick={() => switchProfile('coworker')}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all"
                style={{
                  backgroundColor: activeProfile.type === 'coworker' ? 'var(--brand-50)' : 'transparent',
                  color: activeProfile.type === 'coworker' ? 'var(--brand-600)' : 'var(--text-secondary)',
                  fontWeight: activeProfile.type === 'coworker' ? 600 : 500,
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Benchmark
              </button>
            </div>
          </div>
        </div>

        {/* Center/Right: Live Stats */}
        <div className="hidden xl:flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex items-center gap-1.5">
            <GitFork className="w-3.5 h-3.5" style={{ color: 'var(--brand-600)' }} />
            <span>Repos: <strong style={{ color: 'var(--text-primary)' }}>{analysis?.repos_count ?? 0}</strong></span>
          </div>
          <span style={{ color: 'var(--border-secondary)' }}>|</span>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" style={{ color: 'var(--brand-600)' }} />
            <span>Network: <strong style={{ color: 'var(--text-primary)' }}>{analysis?.connections_count ?? 0}</strong></span>
          </div>
          <span style={{ color: 'var(--border-secondary)' }}>|</span>
          <div className="flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5" style={{ color: 'var(--brand-600)' }} />
            <span>Alumni: <strong style={{ color: 'var(--text-primary)' }}>{analysis?.alumni_count ?? 0}</strong></span>
          </div>
          <span style={{ color: 'var(--border-secondary)' }}>|</span>
          <div className="flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5" style={{ color: 'var(--brand-600)' }} />
            <span>Nodes: <strong style={{ color: 'var(--text-primary)' }}>{analysis?.graph_nodes_count ?? 0}</strong></span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <ThemeToggle />

          <button
            onClick={onOpenSyncGitHub}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-all"
            title="Sync GitHub repositories and extract skills"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sync GitHub</span>
          </button>

          <button
            onClick={onOpenResetModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: 'var(--error-50)',
              color: 'var(--error-600)',
              border: '1px solid transparent',
            }}
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
                className="flex items-center gap-2 p-1.5 pr-3 rounded-lg text-xs transition-all"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                <img
                  src={user?.photoURL || activeProfile.avatar}
                  alt={user?.displayName || 'User Avatar'}
                  className="w-6 h-6 rounded object-cover"
                  style={{ border: '2px solid var(--border-primary)' }}
                />
                <span className="font-medium max-w-[120px] truncate" style={{ color: 'var(--text-primary)' }}>
                  {user?.displayName || 'Google User'}
                </span>
                <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
              </button>

              {showProfileMenu && (
                <div
                  className="absolute right-0 mt-2 w-56 p-2 rounded-xl shadow-dropdown z-50 animate-fade-in text-xs"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                  }}
                >
                  <div className="p-2 mb-1" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user?.displayName}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{user?.email}</p>
                    <span className="badge-success inline-block mt-1 text-[10px] px-2 py-0.5 rounded">
                      Signed In
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setShowProfileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium"
                    style={{ color: 'var(--error-600)' }}
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
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-white text-xs font-semibold transition-all"
              style={{ backgroundColor: 'var(--brand-600)' }}
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
