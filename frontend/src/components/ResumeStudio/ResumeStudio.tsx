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
      onSuccess(`Resume tailored — ATS score: ${data.ats_score}%`);
      if (data.ats_score >= 85) {
        confetti({
          particleCount: 50,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#2563EB', '#059669', '#D97706']
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
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl card">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg" style={{ backgroundColor: 'var(--brand-50)', color: 'var(--brand-600)' }}>
              <FileText className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Resume Studio</h2>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            AI-powered ATS-optimized resume builder with code evidence
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTailorResume}
            disabled={loading}
            className="px-4 py-2.5 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-all"
            style={{ backgroundColor: 'var(--brand-600)' }}
          >
            {loading ? <Cpu className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Re-Generate
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <Printer className="w-4 h-4" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Target Parameters (Hidden in Print) */}
      <div
        className="no-print p-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3 text-xs"
        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
      >
        <div>
          <label className="block font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Target Role</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="input-base w-full text-sm"
          />
        </div>
        <div>
          <label className="block font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Target Company</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="input-base w-full text-sm"
          />
        </div>
      </div>

      {/* Resume Document */}
      <div className="w-full max-w-4xl mx-auto">
        {loading && !resumeData ? (
          <div
            className="p-16 text-center space-y-3 rounded-xl"
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
          >
            <Cpu className="w-8 h-8 animate-spin mx-auto" style={{ color: 'var(--brand-600)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Generating tailored resume...
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Analyzing skills and matching keywords for {company}
            </p>
          </div>
        ) : resumeData ? (
          <div
            className="resume-paper p-8 sm:p-12 rounded-xl shadow-card space-y-6"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          >
            {/* Resume Header */}
            <div className="pb-5 space-y-1" style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {activeProfile.name}
                </h1>
                <div className="no-print badge-success flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono">
                  <Award className="w-3.5 h-3.5" />
                  ATS: {resumeData.ats_score}%
                </div>
              </div>

              <p className="text-xs font-semibold font-mono" style={{ color: 'var(--brand-600)' }}>
                {role} | Distributed Systems, APIs & GraphRAG
              </p>

              <div className="flex flex-wrap gap-4 text-xs pt-1" style={{ color: 'var(--text-secondary)' }}>
                <span>Email: mohitupraity@gmail.com</span>
                <span>•</span>
                <a
                  href="https://github.com/mohitUpraity"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                  style={{ color: 'var(--brand-600)' }}
                >
                  github.com/mohitUpraity
                </a>
                <span>•</span>
                <span>Bengaluru / Remote</span>
              </div>
            </div>

            {/* Executive Summary */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--text-secondary)' }}>
                Professional Summary
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{resumeData.summary}</p>
            </div>

            {/* Technical Projects */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <FolderGit2 className="w-4 h-4" style={{ color: 'var(--brand-600)' }} />
                Featured Projects
              </h3>

              <div className="space-y-4">
                {resumeData.highlighted_projects?.map((proj, idx) => (
                  <div key={idx} className="space-y-1.5 pl-3" style={{ borderLeft: `2px solid var(--brand-600)` }}>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        {proj.title}
                        {proj.repo_url && (
                          <a
                            href={proj.repo_url}
                            target="_blank"
                            rel="noreferrer"
                            className="no-print inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: 'var(--brand-50)',
                              color: 'var(--brand-600)',
                              border: '1px solid var(--brand-100)',
                            }}
                          >
                            <Github className="w-3 h-3" />
                            Code ↗
                          </a>
                        )}
                      </h4>
                    </div>

                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{proj.description}</p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {proj.tech_stack?.map((tech, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-2 py-0.5 rounded text-[10px] font-mono"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    {proj.bullets && (
                      <ul className="list-disc list-inside space-y-1 pt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
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

            {/* Experience Bullets */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Briefcase className="w-4 h-4" style={{ color: 'var(--success-600)' }} />
                Technical Contributions
              </h3>

              <ul className="space-y-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {resumeData.experience_bullets?.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: 'var(--brand-600)' }} />
                    <div className="flex-1">
                      <span>{item.bullet}</span>
                      {item.code_evidence_url && (
                        <a
                          href={item.code_evidence_url}
                          target="_blank"
                          rel="noreferrer"
                          className="no-print inline-flex items-center gap-1 ml-2 text-[10px] font-mono underline"
                          style={{ color: 'var(--brand-600)' }}
                        >
                          verified ↗
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Skills */}
            <div className="space-y-2 pt-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                <Code2 className="w-4 h-4" style={{ color: 'var(--warning-600)' }} />
                Skills
              </h3>

              <div className="flex flex-wrap gap-2">
                {resumeData.highlighted_skills?.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-primary)',
                    }}
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
