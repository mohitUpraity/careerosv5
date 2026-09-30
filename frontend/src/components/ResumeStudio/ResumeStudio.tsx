import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  Sparkles, 
  CheckCircle2, 
  Github, 
  ExternalLink, 
  Cpu, 
  Briefcase, 
  Code2, 
  FolderGit2,
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TailoredResumeResponse } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface ResumeStudioProps {
  initialRole?: string;
  initialCompany?: string;
  initialJd?: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export const ResumeStudio: React.FC<ResumeStudioProps> = ({
  initialRole = 'Senior Backend / Full Stack Engineer',
  initialCompany = 'Apponward Technologies',
  initialJd = '',
  onError,
  onSuccess,
}) => {
  const { getAuthHeaders, activeProfile } = useAuth();
  const [role, setRole] = useState(initialRole);
  const [company, setCompany] = useState(initialCompany);
  const [jd, setJd] = useState(
    initialJd ||
      `Looking for a strong Backend / Full Stack Engineer with experience in Python, FastAPI, React/Next.js, and Modern Databases.`
  );

  const [loading, setLoading] = useState(false);
  const [resumeData, setResumeData] = useState<TailoredResumeResponse | null>(null);

  useEffect(() => {
    // Automatically synthesize initial resume preview
    handleTailorResume();
  }, []);

  const handleTailorResume = async () => {
    setLoading(true);
    try {
      const data = await apiService.tailorResume(
        {
          target_role: role,
          target_company: company,
          job_description: jd,
        },
        getAuthHeaders()
      );
      setResumeData(data);
      onSuccess(`Tailored ATS Resume synthesized with ${data.ats_score}% ATS score!`);
      if (data.ats_score >= 85) {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#10b981', '#6366f1']
        });
      }
    } catch (err: any) {
      onError(err.message || 'Failed to tailor resume');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Controls Bar (Hidden in Print) */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-slate-100">Layout-Preserving ATS Resume Studio</h2>
          </div>
          <p className="text-xs text-slate-400">
            Groq Llama 3.3 dynamic STAR bullet synthesis backed by live GitHub AST code evidence
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTailorResume}
            disabled={loading}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-600/20 flex items-center gap-2 transition-all"
          >
            {loading ? <Cpu className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Re-Synthesize ATS Bullets
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border border-slate-700"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Target Parameters Drawer (Hidden in Print) */}
      <div className="no-print p-4 rounded-2xl bg-slate-900/70 border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block font-medium text-slate-400 mb-1">Target Role</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
          />
        </div>
        <div>
          <label className="block font-medium text-slate-400 mb-1">Target Company</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-950/70 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Resume Document Paper Container */}
      <div className="w-full max-w-4xl mx-auto">
        {loading && !resumeData ? (
          <div className="p-16 text-center space-y-3 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <Cpu className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-200">
              Synthesizing Evidence-Backed STAR Bullets with Groq Llama 3.3...
            </p>
            <p className="text-xs text-slate-500">
              Querying GitHub AST nodes and matching keywords for {company}...
            </p>
          </div>
        ) : resumeData ? (
          <div className="resume-paper p-8 sm:p-12 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl space-y-6 text-slate-200">
            {/* Resume Header */}
            <div className="border-b border-slate-700 pb-5 space-y-1">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white tracking-tight">{activeProfile.name}</h1>
                <div className="no-print flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
                  <Award className="w-3.5 h-3.5" />
                  ATS Match: {resumeData.ats_score}%
                </div>
              </div>

              <p className="text-xs font-semibold text-emerald-400 font-mono">
                {role} | Specialization: Distributed Systems, Fast APIs & GraphRAG
              </p>

              <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-1">
                <span>Email: mohitupraity@gmail.com</span>
                <span>•</span>
                <a
                  href="https://github.com/mohitUpraity"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-emerald-400 underline"
                >
                  github.com/mohitUpraity
                </a>
                <span>•</span>
                <span>Bengaluru / Remote</span>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Professional Summary
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">{resumeData.summary}</p>
            </div>

            {/* Evidence-Backed Technical Projects */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-indigo-400" />
                Featured AST Projects & Code Evidence
              </h3>

              <div className="space-y-4">
                {resumeData.highlighted_projects?.map((proj, idx) => (
                  <div key={idx} className="space-y-1.5 border-l-2 border-indigo-500/40 pl-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        {proj.title}
                        {proj.repo_url && (
                          <a
                            href={proj.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="no-print inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20"
                          >
                            <Github className="w-3 h-3" />
                            [Code Evidence ↗]
                          </a>
                        )}
                      </h4>
                    </div>

                    <p className="text-xs text-slate-400">{proj.description}</p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {proj.tech_stack?.map((tech, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-slate-300"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    {proj.bullets && (
                      <ul className="list-disc list-inside space-y-1 pt-1 text-xs text-slate-300">
                        {proj.bullets.map((b, bIdx) => (
                          <li key={bIdx} className="leading-relaxed">
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tailored Experience Bullets */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                STAR-Synthesized Technical Contributions
              </h3>

              <ul className="space-y-2.5 text-xs text-slate-300">
                {resumeData.experience_bullets?.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                    <div className="flex-1">
                      <span>{item.bullet}</span>
                      {item.code_evidence_url && (
                        <a
                          href={item.code_evidence_url}
                          target="_blank"
                          rel="noreferrer"
                          className="no-print inline-flex items-center gap-1 ml-2 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline"
                        >
                          verified code ↗
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Core Skills Matrix */}
            <div className="space-y-2 border-t border-slate-800 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                <Code2 className="w-4 h-4 text-amber-400" />
                Target Alignment Skills
              </h3>

              <div className="flex flex-wrap gap-2">
                {resumeData.highlighted_skills?.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
