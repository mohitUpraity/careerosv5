import React from 'react';
import { ArrowRight, Check, LucideIcon } from 'lucide-react';
import { ActiveTab, workspacePages } from './workspaceNavigation';

export const WorkspacePageHeader: React.FC<{
  page: ActiveTab;
  eyebrow?: string;
  title?: string;
  description: string;
  actions?: React.ReactNode;
}> = ({ page, eyebrow, title, description, actions }) => {
  const entry = workspacePages.find(item => item.id === page)!;
  const Icon = entry.icon;
  return <header className="ws-page-heading no-print">
    <div className="ws-page-heading-copy"><span className="ws-eyebrow"><Icon size={14} />{eyebrow || entry.group}</span><h1>{title || entry.label}</h1><p>{description}</p></div>
    {actions && <div className="ws-page-actions">{actions}</div>}
  </header>;
};

export interface WorkspaceMetric {
  label: string;
  value: React.ReactNode;
  detail: string;
  icon: LucideIcon;
  tone?: 'blue' | 'violet' | 'teal' | 'amber';
}

export const WorkspaceMetrics: React.FC<{ items: WorkspaceMetric[]; loading?: boolean }> = ({ items, loading = false }) =>
  <div className="ws-metrics" aria-busy={loading}>{items.map(({ label, value, detail, icon: Icon, tone = 'blue' }) => <div className="ws-metric" key={label}><div><span className={`dashboard-soft-icon is-${tone}`}><Icon size={18} /></span><span>{label}</span></div><strong>{loading ? <span className="dashboard-skeleton" /> : value}</strong><small>{detail}</small></div>)}</div>;

export const WorkspaceSectionHeading: React.FC<{ title: string; description?: string; number?: string; actions?: React.ReactNode }> = ({ title, description, number, actions }) =>
  <div className="ws-section-heading"><div>{number && <span className="ws-section-number">{number}</span>}<div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>{actions}</div>;

export const WorkspaceEmptyState: React.FC<{ icon: LucideIcon; title: string; description: string; children?: React.ReactNode; compact?: boolean }> = ({ icon: Icon, title, description, children, compact = false }) =>
  <section className={`ws-empty-state ${compact ? 'is-compact' : ''}`}><div className="ws-empty-visual" aria-hidden="true"><span /><span /><div><Icon size={30} strokeWidth={1.5} /></div></div><span className="ws-eyebrow">A CLEAR PLACE TO START</span><h2>{title}</h2><p>{description}</p>{children && <div className="ws-empty-actions">{children}</div>}</section>;

export const WorkspaceSteps: React.FC<{ steps: string[]; active?: number }> = ({ steps, active = 0 }) =>
  <ol className="ws-workflow" aria-label="Workflow progress">{steps.map((step, index) => <li key={step} className={index === active ? 'is-current' : index < active ? 'is-done' : ''} aria-current={index === active ? 'step' : undefined}><span>{index < active ? <Check size={14} /> : String(index + 1).padStart(2, '0')}</span><strong>{step}</strong>{index < steps.length - 1 && <ArrowRight size={14} />}</li>)}</ol>;
