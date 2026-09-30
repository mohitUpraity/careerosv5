import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  GitBranch, 
  Share2, 
  FileText, 
  Network, 
  CheckCircle2, 
  ShieldCheck, 
  Database, 
  Cpu, 
  Layers, 
  Code2, 
  Zap,
  Globe2,
  Lock,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

export const LandingPage: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      await loginWithGoogle();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50/70 text-slate-900'
    }`}>
      {/* Top Navbar */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md transition-colors ${
        isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200/80'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Share2 className="w-5 h-5 transform -rotate-45" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black tracking-tight text-lg">CareerOS</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/90 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  v5.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                GraphRAG Career Co-Pilot & Referral Network
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-xs hover:shadow-md transition-all disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Sign In with Google</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-6 shadow-xs bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Autonomous GraphRAG Career Co-Pilot</span>
            <span className="w-1 h-1 rounded-full bg-blue-400"></span>
            <span className="text-[11px] font-normal opacity-80">Neo4j AuraDB &bull; Groq Llama 3.3 &bull; Gemini Flash</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-[1.15]">
            Turn Your Code Footprint Into an{' '}
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Unfair Career Advantage
            </span>
          </h1>

          {/* Subheading */}
          <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
            Synthesize your GitHub repositories, AST-verified skills, and LinkedIn network into an interactive knowledge graph. Discover hidden alumni referral paths and generate tailored ATS resumes in seconds.
          </p>

          {/* Primary CTA Button */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3.5 text-sm font-semibold rounded-2xl text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to CareerOS...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Sign In to Access Your Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Privacy & Multi-Tenant Guarantee */}
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Multi-Tenant Isolated Neo4j Graph
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-blue-500" />
              Private & Encrypted Workspaces
            </span>
          </div>
        </div>
      </section>

      {/* Feature Pillars Grid */}
      <section className="py-12 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Full-Stack Intelligence For Modern Engineers
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Four core pillars designed to maximize technical credibility and uncover backdoor referrals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className={`p-6 rounded-2xl border transition-all hover:shadow-md ${
            isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 flex items-center justify-center mb-4">
              <Network className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base mb-1.5">Knowledge Graph</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              Neo4j Bloom-style graph topology mapping repositories, languages, verified skills, and referral edges.
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <span>Interactive Canvas Visualization</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 2 */}
          <div className={`p-6 rounded-2xl border transition-all hover:shadow-md ${
            isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}>
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400 flex items-center justify-center mb-4">
              <GitBranch className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base mb-1.5">GitHub AST Ingestion</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              Exhaustive pagination crawl for all public repositories with parallel AST tech stack and skill synthesis.
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
              <span>Incremental & Full Library Sync</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 3 */}
          <div className={`p-6 rounded-2xl border transition-all hover:shadow-md ${
            isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}>
            <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400 flex items-center justify-center mb-4">
              <Share2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base mb-1.5">Referral Bridges</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              Multi-hop graph traversal to discover college alumni and 1st/2nd-degree contacts at your dream companies.
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-pink-600 dark:text-pink-400 flex items-center gap-1">
              <span>Automated Outreach Pitches</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>

          {/* Card 4 */}
          <div className={`p-6 rounded-2xl border transition-all hover:shadow-md ${
            isDark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base mb-1.5">ATS Resume Studio</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              Tailor ATS-optimized resumes with verifiable code proof points, rendered in pixel-perfect LaTeX and PDF.
            </p>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span>Live PDF & LaTeX Generation</span>
              <ChevronRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`mt-20 border-t py-8 text-center text-xs text-slate-500 dark:text-slate-400 ${
        isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
      }`}>
        <p>&copy; {new Date().getFullYear()} CareerOS v5. Multi-Tenant GraphRAG Platform for Software Engineers.</p>
      </footer>
    </div>
  );
};
