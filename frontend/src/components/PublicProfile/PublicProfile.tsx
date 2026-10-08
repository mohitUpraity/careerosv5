import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Award, BriefcaseBusiness, Check, Copy, ExternalLink, Github, GraduationCap, Link2, MapPin, ShieldCheck, Star } from 'lucide-react';
import { PublicProfileData } from '../../types';
import { apiService } from '../../services/api';
import './PublicProfile.css';

type ProfileTab = 'overview' | 'skills' | 'projects' | 'experience';

const asStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(item => typeof item === 'string' ? asStringList(item) : []);
  if (typeof value !== 'string' || !value.trim()) return [];
  const text = value.trim();
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) return asStringList(parsed);
    } catch { /* Treat malformed JSON as a regular delimited value. */ }
  }
  return text.split(/[,|;]/).map(item => item.trim()).filter(Boolean);
};

interface PublicProfileProps {
  username: string;
  onNavigateHome?: () => void;
}

export const PublicProfile: React.FC<PublicProfileProps> = ({ username, onNavigateHome }) => {
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiService.getPublicProfile(username)
      .then(res => { if (!cancelled) setData(res.profile); })
      .catch(err => { if (!cancelled) setError(err?.message || 'Profile not found'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username]);

  const projects = useMemo(() => (data?.projects || []).map(project => ({ ...project, tech_stack: asStringList(project.tech_stack) })), [data]);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* Clipboard access can be unavailable on non-secure local origins. */ }
  };

  if (loading) return <main className="public-profile"><div className="profile-loading"><span className="profile-avatar-skeleton" /><span className="profile-skeleton-line" /><span className="profile-skeleton-line short" /></div></main>;
  if (error || !data) return (
    <main className="public-profile"><section className="profile-empty"><span className="profile-empty-icon"><Activity size={22} /></span><h1>Profile unavailable</h1><p>@{username} may not exist or is currently private.</p><button className="profile-primary-button" onClick={() => onNavigateHome ? onNavigateHome() : window.location.assign('/')}>Go to CareerOS</button></section></main>
  );

  const tabs: Array<{ id: ProfileTab; label: string }> = [
    { id: 'overview', label: 'Overview' }, { id: 'skills', label: 'Skills' },
    { id: 'projects', label: 'Projects' }, { id: 'experience', label: 'Experience' },
  ];
  const badgeCount = data.verified_skills.length + (data.certifications?.length || 0) + (data.achievements?.length || 0);
  const externalLinks = [
    data.github_url && { label: 'GitHub', href: data.github_url, icon: Github },
    data.linkedin_url && { label: 'LinkedIn', href: data.linkedin_url, icon: ExternalLink },
    data.portfolio_url && { label: 'Portfolio', href: data.portfolio_url, icon: Link2 },
  ].filter((item): item is { label: string; href: string; icon: typeof Github } => Boolean(item));

  return (
    <main className="public-profile">
      <header className="profile-topbar"><a className="profile-brand" href="/" aria-label="CareerOS home"><span><Activity size={18} /></span>CareerOS</a><div className="profile-top-actions"><button className="profile-secondary-button" onClick={copyLink}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Share profile'}</button><button className="profile-primary-button" onClick={() => onNavigateHome ? onNavigateHome() : window.location.assign('/')}>CareerOS <ArrowUpRight size={15} /></button></div></header>

      <div className="profile-container">
        <section className="profile-hero">
          <div className="profile-identity">
            <div className="profile-avatar">{data.full_name?.trim()?.charAt(0)?.toUpperCase() || '?'}</div>
            <div className="profile-identity-copy"><div className="profile-name-row"><h1>{data.full_name}</h1>{data.verified_skills.length > 0 && <span className="profile-verified-pill"><ShieldCheck size={13} /> Verified</span>}</div><p className="profile-handle">@{data.username || username}</p><p className="profile-headline">{data.headline}</p><div className="profile-meta">{data.location && <span><MapPin size={14} />{data.location}</span>}{externalLinks.map(({ label, href, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer"><Icon size={14} />{label}</a>)}</div></div>
          </div>
          {data.bio && <p className="profile-bio">{data.bio}</p>}
        </section>

        <section className="profile-stats" aria-label="Profile statistics">
          <div><strong>{data.metrics.total_projects}</strong><span>Projects</span></div><div><strong>{data.metrics.verified_skills_count}</strong><span>Verified skills</span></div><div><strong>{data.interviews_count ?? data.interviews?.length ?? 0}</strong><span>Interviews</span></div><div><strong>{badgeCount}</strong><span>Badges</span></div>
        </section>

        <nav className="profile-tabs" aria-label="Profile sections">{tabs.map(tab => <button key={tab.id} aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => setActiveTab(tab.id)}>{tab.label}{tab.id === 'projects' && <span>{projects.length}</span>}</button>)}</nav>

        <div className="profile-content-grid">
          <section className="profile-main-column">
            {activeTab === 'overview' && <>
              <section className="profile-card"><div className="profile-section-title"><h2>About</h2></div><p className="profile-about-copy">{data.bio || data.headline || 'No introduction added yet.'}</p></section>
              <section className="profile-card"><div className="profile-section-title"><h2>Skills</h2><button className="profile-inline-link" onClick={() => setActiveTab('skills')}>View all <ArrowUpRight size={14} /></button></div><div className="profile-skill-summary"><div className="profile-skill-summary-group"><div><ShieldCheck size={14} /><strong>Verified</strong><span>{data.verified_skills.length}</span></div><div className="profile-chip-list">{data.verified_skills.slice(0, 5).map(skill => <span className="profile-chip verified" key={skill.name}>{skill.name}</span>)}{data.verified_skills.length > 5 && <span className="profile-chip">+{data.verified_skills.length - 5}</span>}{!data.verified_skills.length && <small>No verified skills yet</small>}</div></div><div className="profile-skill-summary-group"><div><span className="profile-claimed-dot" /><strong>Claimed</strong><span>{data.claimed_skills.length}</span></div><div className="profile-chip-list">{data.claimed_skills.slice(0, 5).map(skill => <span className="profile-chip" key={skill}>{skill}</span>)}{data.claimed_skills.length > 5 && <span className="profile-chip">+{data.claimed_skills.length - 5}</span>}{!data.claimed_skills.length && <small>No claimed skills</small>}</div></div></div></section>
              <section className="profile-card"><div className="profile-section-title"><h2>Recent projects</h2><button className="profile-inline-link" onClick={() => setActiveTab('projects')}>View all <ArrowUpRight size={14} /></button></div>{projects.length ? projects.slice(0, 3).map(project => <ProjectRow key={project.id || project.name} project={project} />) : <EmptyCopy text="No projects have been added yet." />}</section>
              <section className="profile-card"><div className="profile-section-title"><h2>Recent activity</h2><span className="profile-muted-label">CareerOS interviews</span></div>{data.interviews?.length ? data.interviews.slice(0, 3).map(interview => <div className="profile-activity-row" key={interview.id}><span className="profile-activity-icon"><Activity size={16} /></span><div><strong>{interview.role || 'Interview practice'}{interview.company ? ` · ${interview.company}` : ''}</strong><p>{interview.summary || interview.verdict || 'Completed interview session'}{interview.completed_at ? ` · ${new Date(interview.completed_at).toLocaleDateString()}` : ''}</p></div>{typeof interview.technical_score === 'number' && <span className="profile-score">{Math.round(interview.technical_score)}%</span>}</div>) : <EmptyCopy text="Completed interview sessions will appear here." />}</section>
            </>}
            {activeTab === 'skills' && <section className="profile-card"><div className="profile-section-title"><h2>Skills</h2><span className="profile-muted-label">{data.verified_skills.length} verified</span></div>{data.verified_skills.length > 0 && <><h3 className="profile-subheading">Verified</h3><div className="profile-skill-list">{data.verified_skills.map(skill => <div className="profile-skill-row" key={skill.name}><span className="profile-skill-icon"><ShieldCheck size={16} /></span><div className="profile-skill-info"><strong>{skill.name}</strong><span>{skill.category || skill.difficulty_tier || 'Assessment verified'}</span></div><span className="profile-skill-score">{skill.verification_score}/100</span></div>)}</div></>}{data.claimed_skills.length > 0 && <><h3 className="profile-subheading">Other skills</h3><div className="profile-chip-list">{data.claimed_skills.map(skill => <span className="profile-chip" key={skill}>{skill}</span>)}</div></>}{!data.verified_skills.length && !data.claimed_skills.length && <EmptyCopy text="No skills have been added yet." />}</section>}
            {activeTab === 'projects' && <section className="profile-card"><div className="profile-section-title"><h2>Projects</h2><span className="profile-muted-label">{projects.length} total</span></div>{projects.length ? projects.map(project => <ProjectRow key={project.id || project.name} project={project} />) : <EmptyCopy text="No projects have been added yet." />}</section>}
            {activeTab === 'experience' && <><section className="profile-card"><div className="profile-section-title"><h2>Experience</h2></div>{data.experience?.length ? data.experience.map((item, index) => <div className="profile-timeline-row" key={`${item.company}-${index}`}><span className="profile-timeline-dot" /><div><strong>{item.role || item.company}</strong><p>{item.company}{item.location ? ` · ${item.location}` : ''}</p><small>{item.start_date || ''}{item.end_date ? ` — ${item.end_date}` : item.is_current ? ' — Present' : ''}</small>{item.description && <p className="profile-timeline-description">{item.description}</p>}</div></div>) : <EmptyCopy text="No experience has been added yet." />}</section><section className="profile-card"><div className="profile-section-title"><h2>Education</h2></div>{data.education?.length ? data.education.map((item, index) => <div className="profile-education-row" key={`${item.university}-${index}`}><GraduationCap size={17} /><div><strong>{item.university}</strong><p>{[item.degree, item.field_of_study].filter(Boolean).join(' · ')}</p><small>{item.start_date || ''}{item.end_date ? ` — ${item.end_date}` : ''}</small></div></div>) : <EmptyCopy text="No education has been added yet." />}</section></>}
          </section>

          <aside className="profile-side-column">
            <section className="profile-card"><div className="profile-section-title"><h2>Badges</h2><Award size={17} /></div>{badgeCount ? <div className="profile-badge-list">{data.verified_skills.slice(0, 4).map(skill => <div className="profile-badge-row" key={`skill-${skill.name}`}><span className="profile-badge-icon"><ShieldCheck size={16} /></span><div><strong>{skill.name}</strong><small>Verified skill · {skill.difficulty_tier}</small></div></div>)}{(data.certifications || []).slice(0, 3).map(cert => <div className="profile-badge-row" key={`cert-${cert.name}`}><span className="profile-badge-icon gold"><Award size={16} /></span><div><strong>{cert.name}</strong><small>{cert.issuer || 'Certification'}</small></div></div>)}{(data.achievements || []).slice(0, 3).map(item => <div className="profile-badge-row" key={`achievement-${item.title}`}><span className="profile-badge-icon violet"><Star size={16} /></span><div><strong>{item.title}</strong><small>{item.organization || item.date || 'Achievement'}</small></div></div>)}</div> : <EmptyCopy text="Earned badges and credentials will show here." />}</section>
            <section className="profile-card"><div className="profile-section-title"><h2>Contribution stats</h2><Github size={17} /></div><div className="profile-contribution-stats"><div><strong>{data.metrics.total_projects}</strong><span>Projects</span></div><div><strong>{projects.reduce((sum, project) => sum + (project.stars || 0), 0)}</strong><span>Stars</span></div></div>{data.github_url && <a className="profile-wide-link" href={data.github_url} target="_blank" rel="noreferrer">Open GitHub profile <ArrowUpRight size={14} /></a>}</section>
            <section className="profile-card profile-privacy-note"><ShieldCheck size={16} /><p>Public profile. Contact details and private workspace preferences are not shown.</p></section>
          </aside>
        </div>
        <footer className="profile-footer">Powered by <strong>CareerOS</strong><a href="/" onClick={event => { event.preventDefault(); onNavigateHome ? onNavigateHome() : window.location.assign('/'); }}>Build your career profile <ArrowUpRight size={13} /></a></footer>
      </div>
    </main>
  );
};

function ProjectRow({ project }: { project: PublicProfileData['projects'][number] & { tech_stack: string[] } }) {
  return <article className="profile-project-row"><div className="profile-project-heading"><div><h3>{project.name}</h3>{project.repo_url && <a href={project.repo_url} target="_blank" rel="noreferrer" aria-label={`Open ${project.name} repository`}><ArrowUpRight size={14} /></a>}</div>{typeof project.stars === 'number' && project.stars > 0 && <span><Star size={13} />{project.stars}</span>}</div>{project.description && <p>{project.description}</p>}<div className="profile-project-meta">{project.primary_language && <span>{project.primary_language}</span>}{project.tech_stack.slice(0, 5).map(tech => <span className="profile-chip" key={tech}>{tech}</span>)}</div></article>;
}

function EmptyCopy({ text }: { text: string }) { return <p className="profile-empty-copy">{text}</p>; }
