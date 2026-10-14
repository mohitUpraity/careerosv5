import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BarChart3, Bell, Bot, BriefcaseBusiness, Building2, Check, CheckCircle2, Chrome, Code2, Download, FileText, GitBranch, Github, GraduationCap, Home, Layers, Link2, Linkedin, Loader2, LockKeyhole, Mail, MapPin, Menu, Network, Pencil, Search, Settings, ShieldCheck, Sparkles, Star, TrendingUp, Users, X, Youtube, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';
import { ExtensionDownloadModal } from './ExtensionDownloadModal';
import './LandingPage.css';
import './LandingPage.reference.css';
import './LandingPage.nav.css';

const GoogleMark = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.3 2.9-7.5Z"/><path fill="#34A853" d="M12 22c2.7 0 5-1 6.7-2.4l-3.3-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9l3.4-2.6Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.5l3.4 2.6A6 6 0 0 1 12 6Z"/></svg>;
const LogoMark = () => <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m14 10-6 11m10-11 6 11M10 24h12M12 14h8"/><circle cx="16" cy="7" r="3"/><circle cx="7" cy="24" r="2.5"/><circle cx="25" cy="24" r="2.5"/></svg>;
const GithubMark = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.03-.71.08-.7.08-.7 1.14.08 1.75 1.17 1.75 1.17 1.01 1.73 2.65 1.23 3.3.94.1-.73.39-1.23.71-1.51-2.5-.28-5.12-1.25-5.12-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.28-5.14 5.56.4.35.76 1.03.76 2.08v3.1c0 .3.21.65.78.54A11.2 11.2 0 0 0 12 .8Z"/></svg>;
const NetworkGlyph = () => <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="m15 7-10 17 2 1L17 8Zm2 1 9 17 2-1L19 7ZM6 24v2h20v-2Z"/><circle cx="17" cy="7" r="5"/><circle cx="6" cy="25" r="4.5"/><circle cx="27" cy="25" r="4.5"/></svg>;
const Brand = ({ small = false }: { small?: boolean }) => <span className={`lp-brand ${small ? 'lp-brand-small' : ''}`}><span className="lp-brand-icon"><LogoMark /></span>CareerOS</span>;
const Avatar = () => <span className="lp-avatar" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#111827"/><path d="M5 32q1-13 11-13t11 13" fill="#3b82f6"/><ellipse cx="16" cy="13" rx="6" ry="8" fill="#d79974"/><path d="M10 13V8q6-8 12 0v6l-3-6-8 2" fill="#211713"/></svg></span>;
const AmbientArt = () => <div className="lp-ambient-art" aria-hidden="true"><i className="lp-art-orb lp-art-one"/><i className="lp-art-orb lp-art-two"/><i className="lp-art-orb lp-art-three"/><i className="lp-art-orb lp-art-four"/><svg viewBox="0 0 1000 1400" preserveAspectRatio="none"><path d="M-180 150Q100 120 60 390T-100 760M1100 390Q830 340 1060 710M-160 960Q140 850 200 1200M850 1250Q1030 1060 1160 1270"/></svg></div>;

function CompanyMark({ name }: { name: string }) {
  if (name === 'Google') return <span className="lp-company-icon"><GoogleMark /></span>;
  if (name === 'Microsoft') return <span className="lp-microsoft" aria-hidden="true"><i/><i/><i/><i/></span>;
  if (name === 'Adobe') return <svg className="lp-company-symbol lp-adobe-symbol" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M0 2h8L0 22Zm16 0h8v20ZM12 9l5 13h-3l-1-3H8Z"/></svg>;
  if (name === 'Meta') return <svg className="lp-company-symbol lp-meta-symbol" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M3 17C0 8 6 1 11 6c4 4 7 13 11 13C34 19 27 0 21 5c-5 4-8 14-13 14-2 0-4-1-5-2Z"/></svg>;
  if (name === 'Spotify') return <svg className="lp-company-symbol lp-spotify-symbol" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="currentColor"/><g fill="none" stroke="white" strokeLinecap="round"><path d="M5 8q7-2 14 2" strokeWidth="2"/><path d="M6 12q6-2 12 2" strokeWidth="1.7"/><path d="M7 16q5-1 9 1" strokeWidth="1.5"/></g></svg>;
  return <span className={`lp-company-letter lp-company-${name.toLowerCase()}`} aria-hidden="true">{name === 'Amazon' ? 'a' : name === 'Meta' ? '∞' : name === 'Spotify' ? '≋' : name[0]}</span>;
}
function CareerGraph({ compact = false }: { compact?: boolean }) {
  return <div className={`lp-graph ${compact ? 'lp-graph-compact' : ''}`}>
    <div className="lp-graph-canvas"><div className="lp-graph-center">Your data</div></div>
    {!compact && <div className="lp-graph-caption">Connect a source to build your graph</div>}
  </div>;
}
function DashboardPreview() {
  return <div className="lp-dashboard" aria-label="CareerOS workspace preview">
    <div className="lp-dash-top"><Brand small/><span className="lp-search">Your career workspace</span></div>
    <div className="lp-dash-layout"><div className="lp-dash-content">
      <div className="lp-greeting"><div><p>Your workspace</p><h3>Bring your career data together</h3><small>Your information appears here after you connect a source.</small></div></div>
      <div className="lp-dash-panels"><div className="lp-mini-graph"><h4>Knowledge graph</h4><CareerGraph compact/></div><div className="lp-opportunities"><h4>Get started</h4><div className="lp-job"><GithubMark/><div><strong>Connect GitHub</strong><small>Import repositories and contributions</small></div></div><div className="lp-job"><FileText/><div><strong>Add your resume</strong><small>Build a profile from your own experience</small></div></div><div className="lp-job"><Linkedin/><div><strong>Import your network</strong><small>Discover connections from your data</small></div></div></div></div>
    </div></div>
  </div>;
}
function ResumePreview({ onStart }: { onStart: () => void }) {
  return <div className="lp-resume-wrap"><div className="lp-resume-window"><div className="lp-resume-toolbar"><Sparkles size={10}/><span>Resume Studio</span></div><div className="lp-resume-body"><h3>Your resume, your experience</h3><p>Add or import your resume to tailor it for a role.</p><div className="lp-resume-panel"><strong>Nothing added yet</strong><p>Your personal details and work history will appear here after you provide them.</p></div><button className="lp-button lp-primary" onClick={onStart}>Get started</button></div></div><div className="lp-ats-card"><strong>Resume tools</strong><span><CheckCircle2/> ATS-friendly formatting</span><span><CheckCircle2/> Role-specific tailoring</span><span><CheckCircle2/> You control the source data</span></div></div>;
}
const features = [
  { Icon: NetworkGlyph, title: 'Knowledge Graph', description: 'Connect your skills & work', color: 'violet', href: '#knowledge-graph' },
  { Icon: GithubMark, title: 'GitHub Intelligence', description: 'Turn activity into insights', color: 'navy', href: '#knowledge-graph' },
  { Icon: Users, title: 'Referral Opportunities', description: 'Find warm intros', color: 'pink', href: '#knowledge-graph' },
  { Icon: FileText, title: 'ATS Resume Studio', description: 'Create ATS-optimized resumes', color: 'green', href: '#resume-studio' },
];
export const LandingPage: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const { theme } = useTheme();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let previousScroll = Math.max(0, window.scrollY);
    const updateNavigation = () => {
      const currentScroll = Math.max(0, window.scrollY);
      const movement = currentScroll - previousScroll;
      if (currentScroll < 24 || menuOpen) {
        setNavHidden(false);
        previousScroll = currentScroll;
        return;
      }
      // Ignore tiny movements so trackpads do not flicker the navigation.
      if (Math.abs(movement) < 10) return;
      const hasKeyboardFocus = headerRef.current?.contains(document.activeElement);
      setNavHidden(movement > 0 && !hasKeyboardFocus);
      previousScroll = currentScroll;
    };
    updateNavigation();
    window.addEventListener('scroll', updateNavigation, { passive: true });
    return () => window.removeEventListener('scroll', updateNavigation);
  }, [menuOpen]);
  useEffect(() => {
    const scroll = () => setScrolled(window.scrollY > 40);
    scroll(); window.addEventListener('scroll', scroll, { passive: true });
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('lp-visible'); observer.unobserve(entry.target); } }), { threshold: .08 });
    root.current?.querySelectorAll('.lp-reveal').forEach(el => observer.observe(el));
    return () => { window.removeEventListener('scroll', scroll); observer.disconnect(); };
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (menuOpen) menuButtonRef.current?.focus();
        setMenuOpen(false);
        setIsExtensionModalOpen(false);
      }
    };
    const outside = (e: PointerEvent) => {
      if (menuOpen && !headerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const resize = () => { if (desktop.matches) setMenuOpen(false); };
    window.addEventListener('keydown', close);
    document.addEventListener('pointerdown', outside);
    desktop.addEventListener('change', resize);
    return () => {
      window.removeEventListener('keydown', close);
      document.removeEventListener('pointerdown', outside);
      desktop.removeEventListener('change', resize);
    };
  }, [menuOpen]);
  const handleLogin = async () => {
    if (isLoggingIn) return;
    setAuthError(null); setIsLoggingIn(true);
    try { await loginWithGoogle(); }
    catch (error: unknown) { const code = (error as { code?: string })?.code; if (code !== 'auth/popup-closed-by-user') setAuthError(code === 'auth/unauthorized-domain' ? 'Sign-in is not available on this domain yet. Please try again from the CareerOS website.' : 'We couldn’t complete your sign-in. Please allow pop-ups and try again.'); }
    finally { setIsLoggingIn(false); }
  };
  const LoginButton = ({ children = 'Sign in with Google', className = '' }: { children?: React.ReactNode; className?: string }) => <button className={`lp-button lp-primary ${className}`} onClick={handleLogin} disabled={isLoggingIn}>{isLoggingIn ? <Loader2 className="lp-spin"/> : <span className="lp-google"><GoogleMark/></span>}<span>{isLoggingIn ? 'Signing in…' : children}</span><ArrowRight className="lp-button-arrow"/></button>;
  const navLinks = [['Features', '#features'], ['How It Works', '#knowledge-graph'], ['Use Cases', '#resume-studio'], ['Pricing', '#get-started'], ['Get Started', '#get-started']];
  return <div ref={root} className={`lp ${theme === 'dark' ? 'lp-dark' : ''}`} id="top">
    <a className="lp-skip" href="#main-content">Skip to content</a>
    <header ref={headerRef} className={`lp-header ${scrolled ? 'lp-scrolled' : ''} ${navHidden ? 'lp-nav-hidden' : ''}`}><div className="lp-container lp-nav"><a className="lp-nav-brand" href="#top" aria-label="CareerOS home" onClick={() => setMenuOpen(false)}><Brand/></a><nav className="lp-desktop-nav" aria-label="Main navigation">{navLinks.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav><div className="lp-nav-actions"><ThemeToggle className="lp-theme-toggle"/><button className="lp-extension-nav" onClick={() => setIsExtensionModalOpen(true)}><span className="lp-google"><GoogleMark/></span><span>Get Extension</span><small>Beta</small></button><LoginButton className="lp-nav-login"/><button ref={menuButtonRef} type="button" className="lp-menu-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="lp-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button></div></div>{menuOpen && <nav id="lp-mobile-nav" className="lp-mobile-nav" aria-label="Mobile navigation">{navLinks.map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}<button onClick={() => { setMenuOpen(false); setIsExtensionModalOpen(true); }}>Get Chrome Extension <ArrowRight size={16}/></button><LoginButton/></nav>}</header>
    <main id="main-content"><AmbientArt/>
      <section className="lp-hero"><div className="lp-hero-glow" aria-hidden="true"/><div className="lp-container lp-hero-grid"><div className="lp-hero-copy"><span className="lp-eyebrow lp-hero-badge"><Sparkles size={15}/> AI Career Co-Pilot for Modern Engineers</span><h1>Turn Your Code<br/>Footprint Into a<br/><span className="lp-gradient">Career Edge</span></h1><p className="lp-hero-subtitle">Your skills. Your network. Real opportunities.</p><div className="lp-hero-buttons"><LoginButton/><button className="lp-button lp-secondary" onClick={() => setIsExtensionModalOpen(true)}><span className="lp-google"><GoogleMark/></span><span>Get Chrome Extension</span><small>Beta</small></button></div><div className="lp-trust"><span><Zap/> AI-Powered</span><span><LockKeyhole/> Private & Secure</span><span><Users/> Built for Engineers</span></div>{authError && <div className="lp-auth-error" role="alert">{authError}<button onClick={() => setAuthError(null)} aria-label="Dismiss sign-in error"><X size={16}/></button></div>}</div><div className="lp-hero-visual"><div className="lp-halo lp-halo-blue"/><div className="lp-halo lp-halo-purple"/><div className="lp-halo lp-halo-cyan"/><DashboardPreview/></div></div></section>

      <section className="lp-features lp-container lp-reveal" id="features"><div className="lp-section-heading"><h2>Everything You Need, <span className="lp-gradient">In One Place</span></h2></div><div className="lp-feature-grid">{features.map(({ Icon, title, description, color, href }) => <a className="lp-feature-card" href={href} key={title}><span className={`lp-feature-icon lp-${color}`}><Icon/></span><div><h3>{title}</h3><p>{description}</p></div><ArrowRight className="lp-feature-arrow"/></a>)}</div></section>
      <section className="lp-showcase lp-container lp-reveal" id="knowledge-graph"><CareerGraph/><div className="lp-showcase-copy"><span className="lp-eyebrow">BUILT ON YOUR REAL-WORLD DATA</span><h2>A Living Graph Of<br/>Your <span className="lp-gradient">Professional Identity</span></h2><ul className="lp-benefits"><li><span><Users/></span> Skills, projects & contributions</li><li><span><Link2/></span> Real people & company connections</li><li><span><BarChart3/></span> Hidden opportunities, visualized</li></ul><button className="lp-button lp-primary" onClick={handleLogin} disabled={isLoggingIn}>Explore Your Knowledge Graph <ArrowRight/></button></div></section>
      <section className="lp-resume-section lp-container lp-reveal" id="resume-studio"><div className="lp-showcase-copy"><span className="lp-eyebrow">AI-POWERED RESUME STUDIO</span><h2>One Resume.<br/><span className="lp-gradient">More Opportunities.</span></h2><ul className="lp-benefits lp-checklist">{['ATS-optimized in seconds', 'Highlight verified skills', 'Multiple templates'].map(text => <li key={text}><CheckCircle2/>{text}</li>)}</ul><button className="lp-button lp-primary" onClick={handleLogin} disabled={isLoggingIn}>Create Your Resume Now <ArrowRight/></button></div><ResumePreview onStart={handleLogin}/></section>
      <section className="lp-container lp-reveal lp-cta-section" id="get-started"><div className="lp-final-cta"><span className="lp-cta-icon"><TrendingUp/></span><h2>Your Next Opportunity<br/><span className="lp-gradient">Might Already Exist.</span></h2><div><LoginButton>Get Started with CareerOS</LoginButton><p>Free to use ・ No credit card required</p></div></div></section>
    </main>
    <footer className="lp-footer"><div className="lp-container"><div className="lp-footer-grid"><div className="lp-footer-brand"><a href="#top"><Brand/></a><p>GraphRAG Career Co-Pilot</p></div><div><h3>Product</h3><a href="#features">Features</a><a href="#resume-studio">Use Cases</a><a href="#get-started">Pricing</a></div><div><h3>Resources</h3><a href="https://github.com/mohitUpraity/careerosv5#readme" target="_blank" rel="noreferrer">Docs</a><a href="https://github.com/mohitUpraity/careerosv5/discussions" target="_blank" rel="noreferrer">Blog</a><a href="https://github.com/mohitUpraity/careerosv5/issues" target="_blank" rel="noreferrer">Support</a></div><div><h3>Company</h3><a href="https://github.com/mohitUpraity/careerosv5#readme" target="_blank" rel="noreferrer">About</a><a href="https://github.com/mohitUpraity/careerosv5#readme" target="_blank" rel="noreferrer">Privacy</a><a href="https://github.com/mohitUpraity/careerosv5/issues" target="_blank" rel="noreferrer">Contact</a></div><div><h3>Follow Us</h3><div className="lp-socials"><a href="https://github.com/mohitUpraity/careerosv5" target="_blank" rel="noreferrer" aria-label="CareerOS on GitHub"><GithubMark/></a><a href="https://www.linkedin.com/" target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin/></a><a href="https://x.com/" target="_blank" rel="noreferrer" aria-label="X"><span>𝕏</span></a><a href="https://www.youtube.com/" target="_blank" rel="noreferrer" aria-label="YouTube"><Youtube/></a></div></div></div><div className="lp-footer-bottom"><span>© {new Date().getFullYear()} CareerOS. All rights reserved.</span><div><a href="https://github.com/mohitUpraity/careerosv5#readme" target="_blank" rel="noreferrer">Terms</a><a href="https://github.com/mohitUpraity/careerosv5#readme" target="_blank" rel="noreferrer">Privacy</a><a href="https://github.com/mohitUpraity/careerosv5#readme" target="_blank" rel="noreferrer">Cookies</a></div></div></div></footer>
    <ExtensionDownloadModal isOpen={isExtensionModalOpen} onClose={() => setIsExtensionModalOpen(false)}/>
  </div>;
};
