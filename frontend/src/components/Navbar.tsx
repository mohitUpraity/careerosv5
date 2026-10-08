import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Trash2, LogOut, ChevronDown, ShieldCheck, UserCheck, Github, Download, FileText, Linkedin, Menu, RefreshCw, Plus, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { WorkspaceSearch } from './WorkspaceSearch';
import { ActiveTab, workspacePages } from './workspaceNavigation';
import './Navbar.css';

interface NavbarProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  onOpenResetModal: () => void;
  onOpenSyncGitHub: () => void;
  onOpenSyncResume: () => void;
  onOpenSyncLinkedIn: () => void;
  onOpenExtensionModal: () => void;
  onRefreshData: () => void;
  loading: boolean;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export const Navbar: React.FC<NavbarProps> = (props) => {
  const { user, activeProfile, logout, switchProfile } = useAuth();
  const [openMenu, setOpenMenu] = useState<'account' | 'sync' | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const syncRef = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const syncTrigger = useRef<HTMLButtonElement>(null);
  const currentPage = workspacePages.find(page => page.id === props.activeTab)!;
  const PageIcon = currentPage.icon;
  const profileName = activeProfile.name || user?.displayName || 'Your workspace';
  const profileImage = activeProfile.type === 'coworker' ? activeProfile.avatar : user?.photoURL;
  const initials = profileName.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase();
  useEffect(() => {
    if (!openMenu) return;
    const root = openMenu === 'account' ? accountRef.current : syncRef.current;
    const trigger = openMenu === 'account' ? accountTrigger.current : syncTrigger.current;
    const closeOutside = (event: PointerEvent) => { if (!root?.contains(event.target as Node)) setOpenMenu(null); };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpenMenu(null); trigger?.focus(); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && root?.contains(document.activeElement)) {
        const items = Array.from(root?.querySelectorAll<HTMLButtonElement>('.dashboard-account-panel button:not(:disabled)') || []);
        if (!items.length) return;
        event.preventDefault();
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : index < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[nextIndex].focus();
      }
    };
    const closeOnFocusLeave = (event: FocusEvent) => { if (!root?.contains(event.target as Node)) setOpenMenu(null); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', handleKey);
    document.addEventListener('focusin', closeOnFocusLeave);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', handleKey); document.removeEventListener('focusin', closeOnFocusLeave); };
  }, [openMenu]);
  const runAction = (action: () => void) => { setOpenMenu(null); action(); };
  const openWithKeyboard = (event: React.KeyboardEvent, menu: 'account' | 'sync') => {
    if (openMenu || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    setOpenMenu(menu);
    const last = event.key === 'ArrowUp';
    requestAnimationFrame(() => {
      const root = menu === 'account' ? accountRef.current : syncRef.current;
      const trigger = menu === 'account' ? accountTrigger.current : syncTrigger.current;
      const items = root?.querySelectorAll<HTMLButtonElement>('.dashboard-account-panel button:not(:disabled)');
      if (items?.length && document.activeElement === trigger) items[last ? items.length - 1 : 0].focus();
    });
  };

  return <header className="dashboard-topbar dashboard-header-v2 no-print">
    <div className="dashboard-brand-group">
      <button className="dashboard-icon-button dashboard-menu-toggle" onClick={props.onToggleSidebar} aria-label={props.sidebarOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={props.sidebarOpen} aria-controls="dashboard-navigation"><Menu size={20} /></button>
      <button className="dashboard-brand-home" onClick={() => props.onNavigate('overview')} aria-label="CareerOS overview"><span className="dashboard-brand-mark"><Sparkles size={22} strokeWidth={1.7} /></span><span className="dashboard-brand-copy"><strong>CareerOS<span className="dashboard-brand-dot">.</span></strong><span>Your career workspace</span></span></button>
    </div>
    <nav className="dashboard-header-location" aria-label="Current workspace"><span className="dashboard-header-page-icon"><PageIcon size={18} strokeWidth={1.7} /></span><div><span>{currentPage.group}</span><strong aria-current="page">{currentPage.label}</strong></div>{props.loading && <span className="dashboard-header-updating" role="status"><RefreshCw size={12} className="animate-spin" />Updating</span>}</nav>
    <div className="dashboard-topbar-actions" aria-label="Workspace actions">
      <WorkspaceSearch onNavigate={props.onNavigate} />
      <ThemeToggle className="dashboard-theme-toggle" />
      <div className="dashboard-account dashboard-sync-menu" ref={syncRef}>
        <button ref={syncTrigger} className="dashboard-button dashboard-button-primary" aria-label="Sync data" aria-expanded={openMenu === 'sync'} aria-controls="dashboard-sync-panel" onKeyDown={event => openWithKeyboard(event, 'sync')} onClick={() => setOpenMenu(openMenu === 'sync' ? null : 'sync')}><Plus size={17} /><span>Sync data</span><ChevronDown size={14} /></button>
        {openMenu === 'sync' && <div id="dashboard-sync-panel" className="dashboard-account-panel dashboard-sync-panel"><div className="dashboard-menu-heading"><strong>Bring your career together</strong><span>Add evidence to your workspace.</span></div>{[
          { icon: Github, title: 'Connect GitHub', text: 'Projects and technical skills', action: props.onOpenSyncGitHub },
          { icon: FileText, title: 'Upload resume', text: 'Experience and qualifications', action: props.onOpenSyncResume },
          { icon: Linkedin, title: 'Import LinkedIn', text: 'Connections and opportunities', action: props.onOpenSyncLinkedIn },
        ].map(({ icon: Icon, title, text, action }) => <button key={title} onClick={() => runAction(action)}><span className="dashboard-menu-icon"><Icon size={18} /></span><span><strong>{title}</strong><small>{text}</small></span><ChevronRight size={14} /></button>)}<div className="dashboard-account-divider" /><button onClick={() => runAction(props.onOpenExtensionModal)}><Download size={16} />Get browser extension<span className="dashboard-menu-badge">Beta</span></button></div>}
      </div>
      <div className="dashboard-account" ref={accountRef}>
        <button ref={accountTrigger} className="dashboard-account-trigger" aria-label={`Account menu for ${profileName}`} aria-expanded={openMenu === 'account'} aria-controls="dashboard-account-panel" onKeyDown={event => openWithKeyboard(event, 'account')} onClick={() => setOpenMenu(openMenu === 'account' ? null : 'account')}>
          <span className="dashboard-account-avatar"><span>{initials}</span>{profileImage && <img src={profileImage} alt="" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} />}</span><span className="dashboard-account-summary"><strong title={profileName}>{profileName}</strong><small>{activeProfile.type === 'coworker' ? 'Benchmark profile' : 'Personal workspace'}</small></span><ChevronDown size={14} />
        </button>
        {openMenu === 'account' && <div className="dashboard-account-panel" id="dashboard-account-panel"><div className="dashboard-account-details"><strong>{user?.displayName || activeProfile.name}</strong><span>{user?.email}</span></div><button onClick={() => runAction(() => props.onNavigate('profile'))}><UserCheck size={16} />Profile & preferences</button><div className="dashboard-account-modes"><span>Profile mode</span><button onClick={() => runAction(() => switchProfile('candidate'))} aria-pressed={activeProfile.type === 'candidate'}><UserCheck size={16} />Candidate</button><button onClick={() => runAction(() => switchProfile('coworker'))} aria-pressed={activeProfile.type === 'coworker'}><ShieldCheck size={16} />Benchmark</button></div><div className="dashboard-account-divider" /><button disabled={props.loading} onClick={() => runAction(props.onRefreshData)}><RefreshCw size={16} className={props.loading ? 'animate-spin' : ''} />Refresh profile data</button><button className="dashboard-danger" onClick={() => runAction(props.onOpenResetModal)}><Trash2 size={16} />Start fresh</button><button onClick={() => runAction(() => { void logout(); })}><LogOut size={16} />Sign out</button></div>}
      </div>
    </div>
  </header>;
};
