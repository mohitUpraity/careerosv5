import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  Sparkles, 
  Github, 
  Cpu, 
  Briefcase, 
  Code2, 
  FolderGit2,
  Award,
  UploadCloud,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TailoredResumeResponse } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SyncResumeModal } from '../SyncResumeModal';

interface ResumeStudioProps {
  initialRole?: string;
  initialCompany?: string;
  initialJd?: string;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export const ResumeStudio: React.FC<ResumeStudioProps> = ({
  initialRole = '',
  initialCompany = '',
  initialJd = '',
  onError,
  onSuccess,
}) => {
  const { user, getAuthHeaders, activeProfile } = useAuth();
  const [role, setRole] = useState(initialRole || 'Full Stack / Backend Engineer');
  const [company, setCompany] = useState(initialCompany || 'Target Organization');
  const [jd, setJd] = useState(
    initialJd ||
      `Looking for a strong Software Engineer with experience in building scalable backend services, modern APIs, frontend architectures, and data pipelines.`
  );

  const [loading, setLoading] = useState(false);
  const [resumeData, setResumeData] = useState<TailoredResumeResponse | null>(null);
  const [hasMasterResume, setHasMasterResume] = useState<boolean>(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);

  useEffect(() => {
    // Check if master resume exists
    apiService.getMasterResume(getAuthHeaders())
      .then((res) => {
        setHasMasterResume(res.has_master_resume);
      })
      .catch(() => {});
  }, []);

  const handleTailorResume = async () => {
    if (!jd.trim()) {
      onError('Please enter a target Job Description');
      return;
    }

    setLoading(true);
    try {
      const data = await apiService.tailorResume(
        {
          target_role: role.trim() || 'Software Engineer',
          target_company: company.trim() || 'Target Company',
          job_description: jd.trim(),
        },
        getAuthHeaders()
      );
      setResumeData(data);
      onSuccess(`Resume tailored successfully — ATS Readiness: ${data.ats_score}%`);
      if (data.ats_score >= 85) {
        confetti({
          particleCount: 45,
          spread: 50,
          origin: { y: 0.6 },
          colors: ['#2563EB', '#10B981', '#6366F1']
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

  const candidateDisplayName = resumeData?.candidate_name 
    || resumeData?.tailored_blueprint?.contact?.full_name 
    || user?.displayName 
    || activeProfile.name 
    || 'Software Engineer';

  const contactEmail = resumeData?.tailored_blueprint?.contact?.email || user?.email || '';
  const contactGithub = resumeData?.tailored_blueprint?.contact?.github_url || '';
  const contactLinkedin = resumeData?.tailored_blueprint?.contact?.linkedin_url || '';
  const contactPhone = resumeData?.tailored_blueprint?.contact?.phone || '';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Controls Bar (Hidden in Print) */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl card border" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-primary)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <FileText className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>ATS Resume Studio</h2>
            {hasMasterResume && (
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Master Resume Synced
              </span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            AI-powered ATS-optimized resume builder tailored from your verified code topology
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsResumeModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
            }}
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-600" />
            <span>{hasMasterResume ? 'Update Master Resume' : 'Upload Master Resume'}</span>
          </button>

          <button
            onClick={handleTailorResume}
            disabled={loading}
            className="px-4 py-2 text-white rounded-xl text-xs font-semibold flex items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-md transition-all disabled:opacity-50"
          >
            {loading ? <Cpu className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Tailor Resume</span>
          </button>

          {resumeData && (
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Target Parameters Form (Hidden in Print) */}
      <div
        className="no-print p-5 rounded-2xl border space-y-3.5"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Target Role Title</label>
            <input
              type="text"
              placeholder="e.g. Senior Frontend / Full Stack Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="input-base w-full text-xs"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Target Company Name</label>
            <input
              type="text"
              placeholder="e.g. Google, Stripe, Microsoft"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="input-base w-full text-xs"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Job Description (JD) / Requirements
          </label>
          <textarea
            rows={3}
            placeholder="Paste target job description to optimize STAR bullets and keyword density..."
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            className="input-base w-full text-xs font-mono leading-relaxed"
          />
        </div>
      </div>

      {/* Resume Document Viewer */}
      <div className="w-full max-w-4xl mx-auto">
        {loading && !resumeData ? (
          <div
            className="p-16 text-center space-y-3 rounded-2xl border"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          >
            <Cpu className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Synthesizing ATS-Optimized Resume...
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Aligning STAR bullets and code evidence with {company || 'target role'}
            </p>
          </div>
        ) : resumeData ? (
          <div
            className="resume-paper p-8 sm:p-12 rounded-2xl shadow-xl space-y-6"
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          >
            {/* Resume Header */}
            <div className="pb-5 space-y-1.5" style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {candidateDisplayName}
                </h1>
                <div className="no-print flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-mono bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Award className="w-3.5 h-3.5" />
                  ATS Match: {resumeData.ats_score}%
                </div>
              </div>

              <p className="text-xs font-semibold font-mono text-blue-600 dark:text-blue-400">
                {role || 'Software Engineer'} {company ? `| Tailored for ${company}` : ''}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs pt-1" style={{ color: 'var(--text-secondary)' }}>
                {contactEmail && <span>{contactEmail}</span>}
                {contactPhone && <span>• {contactPhone}</span>}
                {contactGithub && (
                  <>
                    <span>•</span>
                    <a
                      href={contactGithub.startsWith('http') ? contactGithub : `https://${contactGithub}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-blue-600"
                    >
                      {contactGithub}
                    </a>
                  </>
                )}
                {contactLinkedin && (
                  <>
                    <span>•</span>
                    <a
                      href={contactLinkedin.startsWith('http') ? contactLinkedin : `https://${contactLinkedin}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-blue-600"
                    >
                      {contactLinkedin}
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Executive Summary */}
            {resumeData.summary && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  Professional Summary
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {resumeData.summary}
                </p>
              </div>
            )}

            {/* Technical Projects */}
            {resumeData.highlighted_projects && resumeData.highlighted_projects.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                  <FolderGit2 className="w-4 h-4 text-blue-600" />
                  Technical Projects & Code Evidence
                </h3>

                <div className="space-y-4">
                  {resumeData.highlighted_projects.map((proj, idx) => (
                    <div key={idx} className="space-y-1.5 pl-3.5 border-l-2 border-blue-600">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                          {proj.title}
                          {proj.repo_url && (
                            <a
                              href={proj.repo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="no-print inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
                            >
                              <Github className="w-3 h-3" />
                              Repository ↗
                            </a>
                          )}
                        </h4>
                      </div>

                      {proj.description && (
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{proj.description}</p>
                      )}

                      {proj.tech_stack && proj.tech_stack.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {proj.tech_stack.map((tech, tIdx) => (
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
                      )}

                      {proj.bullets && proj.bullets.length > 0 && (
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
            )}

            {/* Experience Bullets */}
            {resumeData.experience_bullets && resumeData.experience_bullets.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  Experience & Technical Contributions
                </h3>

                <ul className="space-y-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {resumeData.experience_bullets.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 bg-blue-600" />
                      <div className="flex-1">
                        <span>{item.bullet}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Skills */}
            {resumeData.highlighted_skills && resumeData.highlighted_skills.length > 0 && (
              <div className="space-y-2 pt-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                  <Code2 className="w-4 h-4 text-amber-600" />
                  Verified Core Skills
                </h3>

                <div className="flex flex-wrap gap-2">
                  {resumeData.highlighted_skills.map((skill, idx) => (
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
            )}
          </div>
        ) : (
          /* Empty Initial State Card */
          <div 
            className="p-12 text-center rounded-2xl border space-y-4"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm">
              <FileText className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Ready to Generate Your Tailored Resume
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Upload your Master Resume PDF or click Tailor Resume to synthesize an ATS-ready document from your synced code topology.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsResumeModalOpen(true)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              >
                <UploadCloud className="w-4 h-4" />
                Upload Master Resume (PDF)
              </button>

              <button
                onClick={handleTailorResume}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Tailor Resume Now
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sync Resume Modal */}
      <SyncResumeModal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        onUploadSuccess={(bp) => {
          setHasMasterResume(true);
          handleTailorResume();
        }}
        onSuccessToast={onSuccess}
        onErrorToast={onError}
      />
    </div>
  );
};
