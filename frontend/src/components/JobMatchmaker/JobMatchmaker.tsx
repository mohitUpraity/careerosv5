import React, { useState } from 'react';
import { 
  Sparkles, 
  Target, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Zap, 
  ShieldAlert, 
  Code, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { MatchAnalysisResponse } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface JobMatchmakerProps {
  onSelectTailorResume: (role: string, company: string, jd: string) => void;
  onNavigateToReferrals: (company: string) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

const PRESET_JOBS = [
  {
    id: 'apponward',
    company: 'Apponward Technologies',
    role: 'Senior Backend / Full Stack Engineer',
    badge: 'High Match',
    jd: `Looking for a strong Backend / Full Stack Engineer with experience in Python, FastAPI, React/Next.js, and Modern Databases.
Responsibilities:
- Build high-performance REST and GraphQL microservices with FastAPI.
- Architect real-time data pipelines and scalable graph/relational database schemas.
- Collaborate with frontend engineers to build responsive, interactive user interfaces.
Requirements:
- 1-3 years of experience in Python, FastAPI, PostgreSQL/Neo4j, and React.
- Strong fundamentals in data structures, algorithms, and system design.
- Hands-on experience with Docker, CI/CD, and asynchronous programming.`
  },
  {
    id: 'drdo_cyber',
    company: 'DRDO – ADRDE Agra',
    role: 'AI & Cybersecurity Research Engineer',
    badge: 'Govt / Defense',
    jd: `DRDO ADRDE is seeking an AI & Cybersecurity Research Engineer to design next-generation defense systems and intelligent packet inspection frameworks.
Responsibilities:
- Develop low-latency deep packet inspection (DPI) modules using Linux iptables and raw sockets.
- Implement anomaly detection models using PyTorch/TensorFlow for real-time network telemetry.
- Optimize high-throughput kernel-level packet capture and filtering algorithms.
Requirements:
- Proficiency in Python, Linux networking internals, iptables, and C/C++.
- Background in Intrusion Detection Systems (IDS), machine learning, and security analytics.`
  },
  {
    id: 'google_swe',
    company: 'Google',
    role: 'Software Engineer (Distributed Systems)',
    badge: 'Big Tech',
    jd: `Google is seeking a Software Engineer to work on large-scale distributed systems and graph computing infrastructure.
Responsibilities:
- Design fault-tolerant, highly available distributed services handling billions of queries.
- Build graph indexing and knowledge retrieval pipelines (GraphRAG) with low latency.
Requirements:
- Strong programming skills in Python, C++, or Go.
- Deep understanding of distributed storage, caching (Redis), and graph algorithms.`
  },
  {
    id: 'sharda_ml',
    company: 'Sharda / HCST Research Lab',
    role: 'Applied ML & Graph Neural Network Researcher',
    badge: 'Research Lab',
    jd: `Research laboratory seeking an Applied ML Engineer to work on Knowledge Graph embeddings and Graph Retrieval-Augmented Generation (GraphRAG).
Responsibilities:
- Implement GNN models for knowledge extraction and link prediction.
- Extract structured ontologies from unstructured text streams.`
  }
];

export const JobMatchmaker: React.FC<JobMatchmakerProps> = ({
  onSelectTailorResume,
  onNavigateToReferrals,
  onError,
  onSuccess,
}) => {
  const { getAuthHeaders, activeProfile } = useAuth();
  const [selectedPreset, setSelectedPreset] = useState<string>('apponward');
  const [company, setCompany] = useState<string>(PRESET_JOBS[0].company);
  const [role, setRole] = useState<string>(PRESET_JOBS[0].role);
  const [jobDescription, setJobDescription] = useState<string>(PRESET_JOBS[0].jd);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<MatchAnalysisResponse | null>(null);

  const handleSelectPreset = (presetId: string) => {
    const preset = PRESET_JOBS.find(p => p.id === presetId);
    if (preset) {
      setSelectedPreset(preset.id);
      setCompany(preset.company);
      setRole(preset.role);
      setJobDescription(preset.jd);
    }
  };

  const handleRunMatch = async () => {
    if (!jobDescription.trim()) {
      onError('Please provide a job description or select a preset');
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.analyzeMatch(
        {
          target_company: company,
          target_role: role,
          job_description: jobDescription,
        },
        getAuthHeaders()
      );
      setAnalysisResult(result);
      onSuccess(`Match score calculated: ${result.match_score}% via Groq Llama 3.3!`);

      // Trigger celebratory confetti for high scores!
      if (result.match_score >= 70) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#06b6d4', '#6366f1']
        });
      }
    } catch (err: any) {
      onError(err.message || 'Failed to analyze job match');
    } finally {
      setLoading(false);
    }
  };

  // Score circular calculation
  const score = analysisResult ? analysisResult.match_score : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Presets */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Zap className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-slate-100">Live AI Job Matchmaker</h2>
          </div>
          <p className="text-xs text-slate-400">
            Real-time GraphRAG skill topology matching powered by Groq Llama 3.3 70B
          </p>
        </div>

        {/* Preset Selector Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_JOBS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedPreset === preset.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {preset.company.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Input Panel & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Job Input Card */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
                placeholder="e.g. Google, Apponward"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Role / Title</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500/50"
                placeholder="e.g. Senior Backend Engineer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Job Description / Requirements
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={10}
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-emerald-500/50"
                placeholder="Paste the full job description here..."
              />
            </div>
          </div>

          <button
            onClick={handleRunMatch}
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
          >
            {loading ? (
              <>
                <Cpu className="w-4 h-4 animate-spin" />
                Analyzing Graph Topology with Groq Llama 3.3...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Run Sub-Second AI Match Analysis
              </>
            )}
          </button>
        </div>

        {/* Right: Analysis Dashboard */}
        <div className="lg:col-span-7 space-y-6">
          {analysisResult ? (
            <div className="space-y-6 animate-fade-in">
              {/* Score Bento Box */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
                <div className="space-y-2 text-center sm:text-left">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-semibold">
                    GraphRAG Compatibility
                  </span>
                  <h3 className="text-xl font-bold text-slate-100">{analysisResult.job_title}</h3>
                  <p className="text-xs text-slate-400">{analysisResult.company}</p>
                  <p className="text-xs text-slate-300 max-w-md mt-2 leading-relaxed">
                    {analysisResult.summary}
                  </p>
                </div>

                {/* Animated Circular SVG Match Gauge */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-36 h-36 transform -rotate-90">
                    <circle
                      cx="72"
                      cy="72"
                      r={radius}
                      stroke="rgba(30, 41, 59, 0.8)"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="72"
                      cy="72"
                      r={radius}
                      stroke={score >= 80 ? '#10b981' : score >= 60 ? '#06b6d4' : '#f59e0b'}
                      strokeWidth="10"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="score-circle"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black text-slate-100">{score}%</span>
                    <span className="text-[10px] uppercase font-mono text-emerald-400 font-bold">
                      {score >= 80 ? 'Strong Fit' : score >= 60 ? 'Competitive' : 'Gap Found'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Matched Skills & Code Evidence */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Code-Verified Matching Skills ({analysisResult.matched_skills.length})
                  </h4>
                  <span className="text-[10px] font-mono text-emerald-400">AST Code Evidence</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {analysisResult.matched_skills.map((skill, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/30 transition-all flex items-start gap-2.5"
                    >
                      <Code className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold text-slate-200 block truncate">
                          {skill.skill}
                        </span>
                        {skill.repo_name && (
                          <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1 mt-0.5">
                            repo: {skill.repo_name}
                          </span>
                        )}
                        {skill.code_evidence && (
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                            {skill.code_evidence}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Missing Skills Gap & Mitigation */}
              {analysisResult.missing_skills.length > 0 && (
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    Identified Skill Gaps & Mitigation Roadmap
                  </h4>

                  <div className="flex flex-wrap gap-2">
                    {analysisResult.missing_skills.map((gap, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium"
                      >
                        {gap}
                      </span>
                    ))}
                  </div>

                  {analysisResult.gap_recommendations && analysisResult.gap_recommendations.length > 0 && (
                    <ul className="space-y-1.5 pt-2 text-xs text-slate-300 border-t border-slate-800/60">
                      {analysisResult.gap_recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Coworker Benchmark Comparison */}
              {analysisResult.peer_comparison && (
                <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-400" />
                      Peer Benchmark Advantage vs Coworker Profile
                    </h4>
                    <span className="text-xs font-bold text-indigo-400">
                      Peer Score: {analysisResult.peer_comparison.coworker_score ?? 74}%
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {analysisResult.peer_comparison.advantage_summary ||
                      'Your project evidence in distributed systems and kernel-level telemetry gives you a competitive edge for this role.'}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={() => onSelectTailorResume(role, company, jobDescription)}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Tailor ATS Resume for {company}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onNavigateToReferrals(company)}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  Find Warm Referrals
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[380px] p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 border-dashed flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
                <Target className="w-8 h-8 text-emerald-400/80" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">No Active Job Analysis</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Select one of the preset jobs or paste your own job description to calculate code-verified GraphRAG fit and generate tailored outreach.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
