import { WorkspacePageHeader, WorkspaceMetrics, WorkspaceSectionHeading, WorkspaceEmptyState, WorkspaceSteps } from '../WorkspaceUI';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, FileText,
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
  Cpu,
  Swords,
  Brain
} from 'lucide-react';

import { MatchAnalysisResponse } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { NoteGPTModal } from '../CareerGrowth/NoteGPTModal';

interface JobMatchmakerProps {
  onSelectTailorResume: (role: string, company: string, jd: string) => void;
  onNavigateToReferrals: (company: string) => void;
  onPrepareInterview?: (role: string, company: string, jd: string) => void;
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
  onPrepareInterview,
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
  const [notegptModalSkill, setNotegptModalSkill] = useState<string | null>(null);
  const matchRequest = useRef(0);

  useEffect(() => {
    matchRequest.current += 1;
    setAnalysisResult(null);
    setLoading(false);
  }, [company, role, jobDescription]);

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

    const request = ++matchRequest.current;
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
      if (request !== matchRequest.current) return;
      setAnalysisResult(result);
      onSuccess(`Match score calculated: ${result.match_score}%`);

      
    } catch (err: any) {
      if (request === matchRequest.current) onError(err.message || 'Failed to analyze job match');
    } finally {
      if (request === matchRequest.current) setLoading(false);
    }
  };

  // Score circular calculation
  const score = analysisResult ? analysisResult.match_score : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="dashboard-view ws-page dashboard-view--matcher space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Presets */}
      <WorkspacePageHeader
        page="matcher"
        eyebrow="SEE YOUR FIT"
        title="Understand the role. See where you stand."
        description="Compare a job description with your experience, then turn the insights into a stronger application."
        actions={
          <div className="ws-heading-controls">
            {PRESET_JOBS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset.id)}
                className="dashboard-button"
                style={{
                  backgroundColor: selectedPreset === preset.id ? 'var(--brand-50)' : 'transparent',
                  color: selectedPreset === preset.id ? 'var(--brand-600)' : 'var(--text-secondary)',
                  border: `1px solid ${selectedPreset === preset.id ? 'var(--brand-100)' : 'var(--border-primary)'}`,
                  fontWeight: selectedPreset === preset.id ? 600 : 500,
                }}
              >
                {preset.company.split(' ')[0]}
              </button>
            ))}
          </div>
        }
      />
      <WorkspaceSteps steps={["Add the role", "Understand your fit", "Prepare your application"]} active={analysisResult ? 2 : loading ? 1 : 0} />

      {/* Main Grid: Input Panel & Results */}
      <div className="ws-match-grid">
        {/* Left: Job Input Card */}
        <div className="ws-match-input ws-surface space-y-5">
          <WorkspaceSectionHeading number="01" title="Tell us about the role" description="Use a sample role above, or paste the job description you want to explore." />
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Target Company</label>
              <input aria-label="Target Company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="input-base w-full text-sm"
                placeholder="e.g. Google, Apponward"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Target Role / Title</label>
              <input aria-label="Target Role / Title"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="input-base w-full text-sm"
                placeholder="e.g. Senior Backend Engineer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                Job Description / Requirements
              </label>
              <textarea aria-label="Job Description / Requirements"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={10}
                className="ws-job-description w-full px-3 py-2.5 text-sm leading-relaxed rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                placeholder="Paste the full job description here..."
              />
            </div>
          </div>

          <button
            onClick={handleRunMatch}
            disabled={loading || !company.trim() || !role.trim() || !jobDescription.trim()}
            className="ws-primary-action w-full py-3 px-4 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all"
            style={{ backgroundColor: 'var(--brand-600)' }}
          >
            {loading ? (
              <>
                <Cpu className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Analyse my fit
              </>
            )}
          </button>
        </div>

        {/* Right: Analysis Dashboard */}
        <div className="ws-match-results space-y-6">
          {analysisResult ? (
            <div className="space-y-6 animate-fade-in">
              {/* Score Card */}
              <div
                className="p-6 rounded-xl card flex flex-col sm:flex-row items-center justify-between gap-6"
              >
                <div className="space-y-2 text-center sm:text-left">
                  <span className="badge-brand text-[10px] font-mono uppercase tracking-widest font-semibold">
                    Compatibility Score
                  </span>
                  <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{analysisResult.job_title}</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{analysisResult.company}</p>
                  <p className="text-xs max-w-md mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {analysisResult.summary}
                  </p>
                </div>

                {/* Circular SVG Match Gauge */}
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-36 h-36 transform -rotate-90">
                    <circle cx="72" cy="72" r={radius} stroke="var(--bg-tertiary)" strokeWidth="10" fill="transparent" />
                    <circle
                      cx="72"
                      cy="72"
                      r={radius}
                      stroke={score >= 80 ? 'var(--score-high)' : score >= 60 ? 'var(--score-mid)' : 'var(--score-low)'}
                      strokeWidth="10"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="score-circle"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{score}%</span>
                    <span className="text-[10px] uppercase font-mono font-bold" style={{
                      color: score >= 80 ? 'var(--score-high)' : score >= 60 ? 'var(--score-mid)' : 'var(--score-low)'
                    }}>
                      {score >= 80 ? 'Strong Fit' : score >= 60 ? 'Competitive' : 'Gap Found'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Matched Skills */}
              <div className="p-5 rounded-xl card space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--success-600)' }} />
                    Matching Skills ({analysisResult.matched_skills.length})
                  </h4>
                  <span className="badge-success text-[10px] font-mono">Verified</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {analysisResult.matched_skills.map((skill, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg card-hover flex items-start gap-2.5"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                    >
                      <Code className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--success-600)' }} />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold block truncate" style={{ color: 'var(--text-primary)' }}>
                          {skill.skill}
                        </span>
                        {skill.repo_name && (
                          <span className="text-[10px] font-mono flex items-center gap-1 mt-0.5" style={{ color: 'var(--brand-600)' }}>
                            repo: {skill.repo_name}
                          </span>
                        )}
                        {skill.code_evidence && (
                          <p className="text-[10px] mt-1 line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>
                            {skill.code_evidence}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Missing Skills Gap */}
              {analysisResult.missing_skills.length > 0 && (
                <div className="p-5 rounded-xl card space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--warning-600)' }}>
                    <AlertCircle className="w-4 h-4" />
                    Skill Gaps ({analysisResult.missing_skills.length})
                  </h4>

                  <div className="flex flex-wrap gap-2">
                    {analysisResult.missing_skills.map((gap, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setNotegptModalSkill(gap)}
                        className="badge-warning text-xs font-semibold px-2.5 py-1.5 rounded-xl hover:scale-102 hover:shadow-sm active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer border border-amber-300 dark:border-amber-800"
                        title={`Click to open NoteGPT Mind Map, Roadmap & Verified Certs for ${gap}`}
                      >
                        <Brain className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>{gap}</span>
                        <span className="text-[9px] bg-purple-500/20 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 rounded font-bold">
                          NoteGPT
                        </span>
                      </button>
                    ))}
                  </div>

                  {analysisResult.gap_recommendations && analysisResult.gap_recommendations.length > 0 && (
                    <ul className="space-y-1.5 pt-2 text-xs" style={{ borderTop: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
                      {analysisResult.gap_recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--warning-600)' }} />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Peer Benchmark */}
              {analysisResult.peer_comparison && (
                <div
                  className="p-5 rounded-xl space-y-3"
                  style={{ backgroundColor: 'var(--info-50)', border: '1px solid var(--brand-100)' }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--brand-600)' }}>
                      <TrendingUp className="w-4 h-4" />
                      Peer Benchmark Comparison
                    </h4>
                    <span className="text-xs font-bold" style={{ color: 'var(--brand-600)' }}>
                      Peer: {analysisResult.peer_comparison.coworker_score ?? 74}%
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {analysisResult.peer_comparison.advantage_summary ||
                      'Your project evidence gives you a competitive edge for this role.'}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                {onPrepareInterview && (
                  <button
                    onClick={() => onPrepareInterview(role, company, jobDescription)}
                    className="btn-secondary w-full sm:flex-1 py-2.5"
                  >
                    <Swords className="w-4 h-4 text-amber-500" />
                    <span>Prep Interview</span>
                  </button>
                )}

                <button
                  onClick={() => onSelectTailorResume(role, company, jobDescription)}
                  className="btn-primary w-full sm:flex-1 py-2.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Tailor Resume</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onNavigateToReferrals(company)}
                  className="btn-secondary w-full sm:w-auto py-2.5 px-4"
                >
                  <span>Find Referrals</span>
                </button>
              </div>
            </div>
          ) : (
            <WorkspaceEmptyState icon={Target} title="See the story behind your match" description="Your analysis will show the strengths you can prove, the skills to develop, and a focused plan for your application."><div className="ws-preview-checks"><span><CheckCircle2 size={16} />Skills backed by your work</span><span><Target size={16} />Specific gaps to bridge</span><span><FileText size={16} />Resume and interview next steps</span></div></WorkspaceEmptyState>
          )}
        </div>
      </div>

      {/* NoteGPT Skill Gap Modal */}
      {notegptModalSkill && (
        <NoteGPTModal
          isOpen={!!notegptModalSkill}
          onClose={() => setNotegptModalSkill(null)}
          skillName={notegptModalSkill}
          onSuccessToast={onSuccess}
          onErrorToast={onError}
        />
      )}
    </div>
  );
};
