import React, { useEffect, useRef } from 'react';
import { ExternalLink, Sparkles, ArrowUpRight, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ActiveTab, workspaceGroups } from './workspaceNavigation';
export type { ActiveTab } from './workspaceNavigation';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  open: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, open, onClose }) => {
  const { activeProfile } = useAuth();
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (sidebarRef.current) sidebarRef.current.scrollTop = 0;
    const focusFrame = requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const targets = sidebarRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
        if (!targets?.length) return;
        const first = targets[0], last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) onClose();
    };
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', onResize);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  const navigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (open) onClose();
  };

  return (
    <>
      {open && <button className="dashboard-sidebar-backdrop" aria-label="Close navigation" onClick={onClose} tabIndex={-1} />}
      <aside
        ref={sidebarRef}
        id="dashboard-navigation"
        className={`dashboard-sidebar no-print ${open ? 'is-open' : ''}`}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Workspace navigation"
      >
        <div className="dashboard-sidebar-mobile-title">
          <strong>Your workspace</strong>
          <button className="dashboard-icon-button" onClick={onClose} aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>
        <div className="dashboard-profile-card">
          <button onClick={() => navigate('profile')} className="dashboard-profile-card-button" title="Edit profile and preferences">
            <span className="dashboard-profile-avatar">
              {activeProfile.avatar ? (
                <img src={activeProfile.avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                activeProfile.name.charAt(0).toUpperCase()
              )}
            </span>
            <span className="dashboard-profile-card-copy">
              <strong>{activeProfile.name}</strong>
              <span>{activeProfile.role}</span>
            </span>
          </button>
          {activeProfile.githubUser ? (
            <a
              className="dashboard-github-status"
              href={`https://github.com/${activeProfile.githubUser}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="dashboard-status-dot" />
              GitHub synced
              <ExternalLink size={12} />
            </a>
          ) : (
            <span className="dashboard-github-status">GitHub not synced</span>
          )}
        </div>
        <nav className="dashboard-sidebar-nav">
          {workspaceGroups.map((group) => (
            <div className="dashboard-nav-group" key={group.label}>
              <span className="dashboard-nav-group-label">{group.label}</span>
              {group.items.map(({ id, label, description, icon: Icon }) => (
                <button
                  key={id}
                  className={`dashboard-nav-item ${activeTab === id ? 'is-active' : ''}`}
                  title={description}
                  aria-current={activeTab === id ? 'page' : undefined}
                  onClick={() => navigate(id)}
                >
                  <span className="dashboard-nav-icon">
                    <Icon size={19} />
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="dashboard-sidebar-tip">
          <span className="dashboard-soft-icon is-violet">
            <Sparkles size={19} />
          </span>
          <strong>A clearer next step</strong>
          <p>Your co-pilot can help connect your skills with your next career move.</p>
          <button onClick={() => navigate('brain')}>
            Ask Brain Chat <ArrowUpRight size={15} />
          </button>
        </div>
        <span className="dashboard-sidebar-footer">
          CareerOS <span>Your career, connected.</span>
        </span>
      </aside>
    </>
  );
};
