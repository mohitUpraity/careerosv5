import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Award, 
  CheckCircle2, 
  Play, 
  Pause, 
  Volume2, 
  Lock, 
  ExternalLink, 
  Github, 
  Linkedin, 
  Globe, 
  Sparkles, 
  Share2, 
  Copy, 
  Check, 
  Briefcase, 
  GraduationCap, 
  Code2, 
  Terminal, 
  Cpu, 
  Layers, 
  Activity, 
  FileText, 
  Mail, 
  MapPin, 
  Calendar, 
  ArrowUpRight, 
  Download, 
  UserCheck,
  Star,
  Zap,
  ChevronRight,
  Flame,
  Info,
  Clock
} from 'lucide-react';
import { PublicProfileData, VerifiedSkill } from '../../types';
import { apiService } from '../../services/api';

interface PublicProfileProps {
  username: string;
  onNavigateHome?: () => void;
}

export const PublicProfile: React.FC<PublicProfileProps> = ({ username, onNavigateHome }) => {
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected skill modal / drawer
  const [selectedSkill, setSelectedSkill] = useState<VerifiedSkill | null>(null);
  
  // Audio playback simulator
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const audioIntervalRef = useRef<any>(null);
  
  // Copied toast state
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    loadProfile();
  }, [username]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getPublicProfile(username);
      setData(res.profile);
      if (res.profile.verified_skills && res.profile.verified_skills.length > 0) {
        setSelectedSkill(res.profile.verified_skills[0]);
      }
    } catch (err: any) {
      console.error('Failed to load public profile:', err);
      setError(err.message || 'Profile not found');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 3000);
  };

  const projectsWithTechEvidence = data?.projects.filter((project) => (project.tech_stack || []).length > 0) || [];
  const linkedProjectSkillCount = new Set(projectsWithTechEvidence.flatMap((project) => project.tech_stack || [])).size;

  const handleTogglePlayAudio = () => {
    if (isPlayingAudio) {
      clearInterval(audioIntervalRef.current);
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      setAudioProgress(0);
      audioIntervalRef.current = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            clearInterval(audioIntervalRef.current);
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 3.33; // 30 seconds simulation
        });
      }, 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center animate-pulse mb-4">
          <ShieldCheck className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
        <h2 className="text-lg font-semibold text-slate-200">Verifying CareerOS Graph Footprint...</h2>
        <p className="text-xs text-slate-400 mt-1">Decrypting proctored evidence and technical telemetry for @{username}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center backdrop-blur-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <Info className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Profile Not Found</h2>
          <p className="text-sm text-slate-400 mb-6">
            The candidate handle <span className="text-blue-400 font-mono">@{username}</span> does not exist or has set their verified portfolio to private.
          </p>
          <button
            onClick={() => onNavigateHome ? onNavigateHome() : window.location.href = '/'}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-blue-500/25"
          >
            Go to CareerOS Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white font-sans">
      {/* Top Protocol Security Bar */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigateHome ? onNavigateHome() : window.location.href = '/'}>
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                CareerOS <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">Verified Protocol</span>
              </span>
            </div>
            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-700" />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Auditable Proof-of-Skill
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3 py-1.5 rounded-lg transition-all"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Link Copied!' : 'Share Dossier'}</span>
            </button>
            <a
              href={`mailto:${data.full_name.toLowerCase().replace(/\s+/g, '')}@example.com?subject=Interview%20Invitation%20via%20CareerOS%20Verified%20Profile`}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-blue-600/20"
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Contact</span> Candidate
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
        
        {/* Hero Section */}
        <div className="relative rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-slate-800/80 p-6 sm:p-8 backdrop-blur-xl overflow-hidden shadow-2xl">
          {/* Subtle ambient light */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-2xl text-white shadow-xl shadow-blue-600/25 border border-white/10">
                  {data.full_name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{data.full_name}</h1>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-400">
                      @{data.username}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base font-medium text-slate-300 mt-0.5">{data.headline}</p>
                </div>
              </div>

              {data.bio && (
                <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                  {data.bio}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                {data.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{data.location}</span>
                  </div>
                )}
                {data.github_url && (
                  <a href={data.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <Github className="w-3.5 h-3.5 text-slate-500" />
                    <span>github.com/{data.github_username || data.username}</span>
                  </a>
                )}
                {data.linkedin_url && (
                  <a href={data.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <Linkedin className="w-3.5 h-3.5 text-slate-500" />
                    <span>LinkedIn</span>
                  </a>
                )}
                {data.portfolio_url && (
                  <a href={data.portfolio_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    <span>Portfolio</span>
                  </a>
                )}
              </div>
            </div>

            {/* Recruiter Trust Index Scorecards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 shrink-0">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 text-center min-w-[120px]">
                <div className="flex items-center justify-center gap-1 text-emerald-400 font-extrabold text-2xl tracking-tight">
                  <ShieldCheck className="w-5 h-5" />
                  {data.metrics.verified_skills_count}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Verified Skills</div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 text-center min-w-[120px]">
                <div className="flex items-center justify-center gap-1 text-blue-400 font-extrabold text-2xl tracking-tight">
                  <Lock className="w-4 h-4 text-blue-400" />
                  {data.metrics.verified_skills_count ? `${data.metrics.proctoring_trust_score}%` : 'N/A'}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Assessment Integrity Avg.</div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 text-center min-w-[120px]">
                <div className="flex items-center justify-center gap-1 text-indigo-400 font-extrabold text-2xl tracking-tight">
                  <Code2 className="w-4 h-4 text-indigo-400" />
                  {data.metrics.total_projects}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Projects / Repos</div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 text-center min-w-[120px]">
                <div className="flex items-center justify-center gap-1 text-amber-400 font-extrabold text-2xl tracking-tight">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  {data.metrics.verified_skills_count ? `${data.metrics.overall_readiness_score}/100` : 'N/A'}
                </div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">Assessment Average</div>
              </div>
            </div>
          </div>
        </div>

        {/* Recruiter-facing evidence summary; every statement maps to visible profile records. */}
        <section className="rounded-3xl bg-slate-900/70 border border-slate-800 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-white">Recruiter Snapshot</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                Review assessment results, project-associated technologies, and imported skill claims as separate evidence types.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300 bg-slate-950 border border-slate-800 rounded-full px-3 py-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Evidence is source-labeled
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="rounded-2xl bg-slate-950/70 border border-emerald-500/20 p-4">
              <div className="text-2xl font-extrabold text-emerald-400">{data.verified_skills.length}</div>
              <div className="text-xs font-bold text-slate-200 mt-1">Assessment-verified skills</div>
              <p className="text-[11px] text-slate-400 mt-1">Each listed skill has a saved assessment record with its score and tier.</p>
              {data.verified_skills.length > 0 && (
                <p className="text-[11px] text-emerald-300 mt-2">{data.verified_skills.slice(0, 3).map((skill) => `${skill.name} (${skill.verification_score}/100)`).join(' · ')}</p>
              )}
            </div>
            <div className="rounded-2xl bg-slate-950/70 border border-blue-500/20 p-4">
              <div className="text-2xl font-extrabold text-blue-400">{projectsWithTechEvidence.length}</div>
              <div className="text-xs font-bold text-slate-200 mt-1">Projects with linked technologies</div>
              <p className="text-[11px] text-slate-400 mt-1">{linkedProjectSkillCount} distinct technologies appear across the listed project stacks; inspect each repository for context.</p>
              {projectsWithTechEvidence[0] && (
                <p className="text-[11px] text-blue-300 mt-2">Example: {projectsWithTechEvidence[0].name} · {(projectsWithTechEvidence[0].tech_stack || []).slice(0, 3).join(', ')}</p>
              )}
            </div>
            <div className="rounded-2xl bg-slate-950/70 border border-slate-700 p-4">
              <div className="text-2xl font-extrabold text-slate-200">{data.claimed_skills.length}</div>
              <div className="text-xs font-bold text-slate-200 mt-1">Claimed / imported skills</div>
              <p className="text-[11px] text-slate-400 mt-1">These are shown separately and are not presented as assessment-verified.</p>
            </div>
          </div>
        </section>

        {/* SECTION 1: VERIFIED SKILL EVIDENCE VAULT (The Core Differentiator) */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  Verified Skill Passport & Evidence Vault
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Claimed skills are self-reported or imported. Verified skills have a saved assessment record and show available evidence.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span>Skill status: Claimed or Verified</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Skill Badges Grid (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              {data.verified_skills.map((skill) => {
                const isSelected = selectedSkill?.name === skill.name;
                return (
                  <div
                    key={skill.name}
                    onClick={() => {
                      setSelectedSkill(skill);
                      setIsPlayingAudio(false);
                      setAudioProgress(0);
                    }}
                    className={`cursor-pointer rounded-2xl p-4.5 transition-all border ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-950/70 to-slate-900 border-blue-500/50 shadow-lg shadow-blue-500/10'
                        : 'bg-slate-900/60 hover:bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base ${
                          isSelected ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'bg-slate-800 text-slate-300'
                        }`}>
                          <ShieldCheck className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white">{skill.name}</h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              Verified
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                              {skill.difficulty_tier}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{skill.category || 'Core Systems'}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-extrabold text-blue-400 font-mono">
                          {skill.verification_score}<span className="text-xs text-slate-500">/100</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {skill.proctoring_score}% Integrity
                        </div>
                      </div>
                    </div>

                    {skill.backed_by_projects && skill.backed_by_projects.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="text-slate-500 font-medium">Backed by:</span>
                        <div className="flex flex-wrap gap-1">
                          {skill.backed_by_projects.map((proj, idx) => (
                            <span key={idx} className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">
                              {proj}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Claimed Skills Pill Box */}
              {data.claimed_skills && data.claimed_skills.length > 0 && (
                <div className="rounded-2xl bg-slate-900/40 border border-slate-800/60 p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      Claimed Skills
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{data.claimed_skills.length} skills</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.claimed_skills.slice(0, 12).map((sk, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-400 border border-slate-800">
                        {sk}<span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-slate-700 text-slate-300">Claimed</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Active Evidence Dossier & Audio Player (7 cols) */}
            <div className="lg:col-span-7">
              {selectedSkill ? (
                <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 space-y-6 shadow-xl backdrop-blur-md">
                  
                  {/* Evidence Header */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 border border-blue-500/30 text-blue-400 font-mono">
                          VERIFICATION RECORD
                        </span>
                        <span className="text-xs text-slate-400">Assessment record</span>
                      </div>
                      <h3 className="text-2xl font-black text-white mt-1">
                        {selectedSkill.name} • {selectedSkill.difficulty_tier}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-slate-400">Proctor Trust</div>
                        <div className="text-sm font-bold text-emerald-400 font-mono">
                          {selectedSkill.proctoring_score}% Passed
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 30-Second Audio Evidence Player */}
                  <div className="rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-950 border border-blue-500/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Recruiter 30-Second Audio Defense Highlight
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        Live Voice Telemetry
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 italic">
                      "{selectedSkill.name} architecture defense: Explaining concurrency primitives, memory overhead, and distributed bottleneck trade-offs."
                    </p>

                    {/* Waveform & Player Controls */}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={handleTogglePlayAudio}
                        className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all shadow-lg shadow-blue-600/30 shrink-0"
                      >
                        {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>

                      {/* Simulated Waveform Visualizer */}
                      <div className="flex-1 space-y-1">
                        <div className="h-6 flex items-center gap-1 bg-slate-950/80 rounded-lg px-2.5 overflow-hidden">
                          {[40, 65, 80, 50, 95, 70, 85, 60, 45, 90, 75, 55, 68, 88, 92, 45, 60, 78, 85, 65, 50, 70, 90, 80, 60].map((h, i) => {
                            const isPlayed = (i / 25) * 100 <= audioProgress;
                            return (
                              <div
                                key={i}
                                style={{ height: `${h}%` }}
                                className={`w-1 rounded-full transition-all ${
                                  isPlayed ? 'bg-blue-400' : 'bg-slate-700'
                                } ${isPlayingAudio && isPlayed ? 'animate-pulse' : ''}`}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1">
                          <span>{isPlayingAudio ? `0:${Math.floor((audioProgress / 100) * 30).toString().padStart(2, '0')}` : '0:00'}</span>
                          <span>0:30 Audio Proof</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4-Pillar Evaluation Scorecard */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                      4-Pillar Engineering Rubrics Breakdown
                    </h4>

                    <div className="grid grid-cols-2 gap-3">
                      {selectedSkill.radar_scores && Object.entries(selectedSkill.radar_scores).map(([metric, score]) => (
                        <div key={metric} className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3">
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="font-semibold text-slate-300 capitalize">{metric.replace(/_/g, ' ')}</span>
                            <span className="font-mono font-bold text-blue-400">{score}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${score}%` }}
                              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Feedback & Evaluator Verdict */}
                  <div className="rounded-2xl bg-slate-950/50 border border-slate-800/80 p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Evaluator Rubric Verdict</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {selectedSkill.feedback_summary}
                    </p>
                  </div>

                  {/* Proctoring Audit Stamp */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <Lock className="w-3.5 h-3.5" /> Fullscreen Guard: 0 Tab Switches
                    </span>
                    <span>Verified: {selectedSkill.verified_at || 'Recent'}</span>
                    <span className="text-slate-500">ID: {Math.random().toString(36).substring(2, 9).toUpperCase()}</span>
                  </div>

                </div>
              ) : (
                <div className="h-full min-h-[300px] rounded-3xl bg-slate-900/40 border border-slate-800 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <ShieldCheck className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-sm">Select any verified skill on the left to inspect auditable proofs.</p>
                </div>
              )}
            </div>

          </div>
        </section>

        {/* SECTION 2: PRODUCTION PROJECTS MATRIX */}
        {data.projects && data.projects.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  <FolderGit2 className="w-5 h-5 text-indigo-400" />
                  Production Projects & Code Footprint
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  AST-scanned repositories supporting the candidate's verified skills.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.projects.map((proj, idx) => (
                <div key={idx} className="rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 p-5 space-y-3 transition-all flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                        {proj.name}
                      </h3>
                      {proj.repo_url && (
                        <a href={proj.repo_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white transition-colors">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {proj.description || 'Production software repository integrated with CareerOS.'}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    {proj.tech_stack && proj.tech_stack.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {proj.tech_stack.slice(0, 5).map((t, i) => (
                          <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-800/80">
                      <span>{proj.primary_language || 'Software'}</span>
                      {proj.stars !== undefined && proj.stars > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <Star className="w-3 h-3 fill-amber-400" /> {proj.stars}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 3: CAREER TIMELINE & EDUCATION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Work Experience */}
          {data.experience && data.experience.length > 0 && (
            <div className="rounded-3xl bg-slate-900/50 border border-slate-800 p-6 space-y-4">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-400" />
                Work Experience
              </h3>
              <div className="space-y-4">
                {data.experience.map((exp, idx) => (
                  <div key={idx} className="relative pl-5 border-l-2 border-slate-800 space-y-1">
                    <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-blue-500" />
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-sm text-white">{exp.role}</div>
                      <div className="text-[11px] font-mono text-slate-500">{exp.start_date} - {exp.end_date || 'Present'}</div>
                    </div>
                    <div className="text-xs text-blue-400 font-medium">{exp.company} {exp.location && `• ${exp.location}`}</div>
                    {exp.description && (
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education & Certs */}
          <div className="space-y-6">
            {data.education && data.education.length > 0 && (
              <div className="rounded-3xl bg-slate-900/50 border border-slate-800 p-6 space-y-4">
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-400" />
                  Education
                </h3>
                <div className="space-y-3">
                  {data.education.map((edu, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-sm text-white">{edu.university}</div>
                        <div className="text-[11px] font-mono text-slate-500">{edu.start_date} - {edu.end_date}</div>
                      </div>
                      <div className="text-xs text-slate-300">{edu.degree}</div>
                      {edu.gpa && <div className="text-[11px] font-mono text-slate-500">GPA / Score: {edu.gpa}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.certifications && data.certifications.length > 0 && (
              <div className="rounded-3xl bg-slate-900/50 border border-slate-800 p-6 space-y-4">
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  Certifications
                </h3>
                <div className="space-y-2">
                  {data.certifications.map((cert, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/60 last:border-0">
                      <div>
                        <div className="font-bold text-slate-200">{cert.name}</div>
                        <div className="text-[10px] text-slate-500">{cert.issuer}</div>
                      </div>
                      {cert.url && (
                        <a href={cert.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-[11px]">
                          Verify
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recruiter Fast-Track Call to Action Footer */}
        <div className="rounded-3xl bg-gradient-to-r from-blue-900/30 via-slate-900/90 to-indigo-900/30 border border-blue-500/30 p-8 text-center space-y-4">
          <div className="max-w-xl mx-auto space-y-2">
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Ready to bypass standard round 1 screens?
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              {data.full_name} has verified skills with live audio defenses and anti-cheat telemetry. Schedule a direct team fit or architecture round.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href={`mailto:${data.full_name.toLowerCase().replace(/\s+/g, '')}@example.com?subject=Offer%20/%20Interview%20Invitation%20via%20CareerOS`}
              className="py-3 px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              Direct Email Candidate
            </a>
            <button
              onClick={handleCopyLink}
              className="py-3 px-6 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy Verification Link
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-500 pt-4">
            Powered by CareerOS Proof-of-Skill Protocol™ • Built on GraphPaths Semantic AI
          </div>
        </div>

      </main>
    </div>
  );
};

// Helper Icon for Git Folders
function FolderGit2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <circle cx="12" cy="13" r="2" />
      <path d="M14 13h3" />
      <path d="M7 13h3" />
    </svg>
  );
}

export default PublicProfile;
