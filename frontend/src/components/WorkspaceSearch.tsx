import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';
import { ActiveTab, workspacePages } from './workspaceNavigation';
import { DialogFrame } from './DialogFrame';

export const WorkspaceSearch: React.FC<{ onNavigate: (tab: ActiveTab) => void }> = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const shortcutLabel = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
  const results = workspacePages.filter(page => `${page.label} ${page.description} ${page.group}`.toLowerCase().includes(query.toLowerCase().trim()));
  const select = (tab: ActiveTab) => { setOpen(false); onNavigate(tab); };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('[aria-modal="true"]')) {
        event.preventDefault(); setQuery(''); setSelectedIndex(0); setOpen(true);
      }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => { document.getElementById(`workspace-search-result-${selectedIndex}`)?.scrollIntoView({ block: 'nearest' }); }, [selectedIndex]);

  return <>
    <button className="dashboard-search-trigger" onClick={() => { setQuery(''); setSelectedIndex(0); setOpen(true); }} aria-label="Search workspace. Control or Command K"><Search size={17} /><span>Search workspace</span><kbd>{shortcutLabel}</kbd></button>
    {open && <DialogFrame label="Find a workspace" onClose={() => setOpen(false)} className="dashboard-command-overlay">
      <div className="dashboard-command-panel">
        <div className="dashboard-command-input"><Search size={20} /><input ref={inputRef} value={query} aria-label="Search workspace pages" placeholder="Where would you like to go?" onChange={event => { setQuery(event.target.value); setSelectedIndex(0); }} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSelectedIndex(index => results.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : 0); }
          if (event.key === 'Enter' && results[selectedIndex]) { event.preventDefault(); select(results[selectedIndex].id); }
        }} aria-controls="workspace-search-results" /><button className="dashboard-icon-button" aria-label="Close search" onClick={() => setOpen(false)}><X size={18} /></button></div>
        <p className="dashboard-command-label">{query ? `${results.length} matching workspaces` : 'Jump to a workspace'}</p>
        <span className="sr-only" role="status">{results.length ? `${results[selectedIndex]?.label || ''}, ${selectedIndex + 1} of ${results.length}` : 'No matching workspace found'}</span>
        <div id="workspace-search-results" className="dashboard-command-results" aria-label="Workspace results">
          {results.map(({ id, label, description, icon: Icon }, index) => <button key={id} id={`workspace-search-result-${index}`} className={`dashboard-command-result ${index === selectedIndex ? 'is-selected' : ''}`} onClick={() => select(id)} onFocus={() => setSelectedIndex(index)}><span className="dashboard-command-icon"><Icon size={19} /></span><span><strong>{label}</strong><small>{description}</small></span><ArrowUpRight size={16} /></button>)}
          {!results.length && <div className="dashboard-command-empty"><Search size={24} /><strong>No workspace found</strong><p>Try “resume”, “interview”, or “skills”.</p></div>}
        </div>
        <div className="dashboard-command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate <kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>
      </div>
    </DialogFrame>}
  </>;
};
