import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  Sparkles, 
  Github, 
  Briefcase, 
  Code2, 
  FolderGit2,
  Award,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Edit3,
  Eye,
  GraduationCap,
  ExternalLink,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  Globe,
  Check,
  X,
  Type,
  Palette,
  Sliders,
  CheckCheck,
  Undo2,
  Wand2,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  ResumeBlueprint, 
  ExperienceEntry, 
  ProjectEntry, 
  EducationEntry, 
  SkillCategory 
} from '../../types';
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

// Suggestion interface for Google Docs-like track changes
interface AISuggestion {
  id: string; // e.g. "summary", "exp-0-1", "proj-1-0"
  type: 'summary' | 'exp_bullet' | 'proj_bullet' | 'skill_add';
  parentIndex?: number;
  bulletIndex?: number;
  originalText: string;
  suggestedText: string;
  status: 'pending' | 'accepted' | 'rejected';
  reason?: string;
}

interface TemplateStyle {
  fontFamily: 'Inter' | 'Merriweather' | 'Roboto' | 'JetBrains Mono';
  fontSize: 'compact' | 'standard' | 'spacious';
  spacing: 'compact' | 'normal' | 'relaxed';
  accentColor: string;
  headerAlign: 'center' | 'left';
  showBorders: boolean;
}

const DEFAULT_STARTER_BLUEPRINT: ResumeBlueprint = {
  contact: {
    full_name: 'Software Engineer',
    email: 'engineer@example.com',
    phone: '+1 (555) 019-2834',
    location: 'San Francisco, CA',
    github_url: 'https://github.com/username',
    linkedin_url: 'https://linkedin.com/in/username',
    portfolio_url: '',
  },
  summary: 'Passionate and results-driven Software Engineer with extensive experience architecting high-throughput distributed backends, graph data pipelines, and responsive frontend systems.',
  experience: [
    {
      company: 'Tech Corp',
      role: 'Software Engineer',
      location: 'San Francisco, CA',
      start_date: '2023',
      end_date: 'Present',
      is_current: true,
      bullets: [
        'Architected and deployed microservices handling 50k+ daily transactions with 99.9% uptime.',
        'Engineered optimized database queries and caching layers, cutting P95 latency by 42%.'
      ]
    }
  ],
  projects: [
    {
      name: 'CareerOS Intelligence Platform',
      tech_stack: 'React, TypeScript, FastAPI, Neo4j, Python',
      repo_url: 'https://github.com/user/careeros',
      live_url: '',
      bullets: [
        'Built automated graph ingestion pipeline extracting complex relationships across GitHub repositories and resumes.',
        'Implemented sub-second semantic matching engine for candidates and technical roles.'
      ]
    }
  ],
  skills: [
    {
      category: 'Languages',
      skills: ['Python', 'TypeScript', 'JavaScript', 'SQL', 'C++']
    },
    {
      category: 'Frameworks & Libraries',
      skills: ['FastAPI', 'React', 'Node.js', 'Next.js', 'TailwindCSS']
    },
    {
      category: 'Databases & Tools',
      skills: ['Neo4j', 'PostgreSQL', 'Redis', 'Docker', 'Git', 'AWS']
    }
  ],
  education: [
    {
      university: 'State University',
      degree: 'Bachelor of Technology',
      field_of_study: 'Computer Science & Engineering',
      start_date: '2020',
      end_date: '2024',
      gpa: '8.8 / 10'
    }
  ],
  achievements: [
    '1st Place Winner – National Hackathon 2024',
    'Demonstrated core cybersecurity prototypes for technical defense research teams'
  ]
};

const ACCENT_COLORS = [
  { name: 'Onyx ATS (Default)', value: '#111827', class: 'bg-gray-900' },
  { name: 'Navy Corporate', value: '#1E3A8A', class: 'bg-blue-900' },
  { name: 'Emerald Forest', value: '#065F46', class: 'bg-emerald-800' },
  { name: 'Royal Indigo', value: '#4338CA', class: 'bg-indigo-700' },
  { name: 'Slate Modern', value: '#334155', class: 'bg-slate-700' },
];

export const ResumeStudio: React.FC<ResumeStudioProps> = ({
  initialRole = '',
  initialCompany = '',
  initialJd = '',
  onError,
  onSuccess,
}) => {
  const { user, getAuthHeaders } = useAuth();
  
  // View & Mode States
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [isTailorOpen, setIsTailorOpen] = useState<boolean>(false);
  const [isStyleOpen, setIsStyleOpen] = useState<boolean>(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [atsScore, setAtsScore] = useState<number | null>(null);

  // Master & Active Blueprint State
  const [blueprint, setBlueprint] = useState<ResumeBlueprint>(DEFAULT_STARTER_BLUEPRINT);
  const [masterBlueprint, setMasterBlueprint] = useState<ResumeBlueprint | null>(null);
  const [hasMasterResume, setHasMasterResume] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Google Docs-style AI Diff Suggestions
  const [suggestions, setSuggestions] = useState<{ [id: string]: AISuggestion }>({});

  // Template Styling State (Font, Colors, Sizes, Spacing)
  const [templateStyle, setTemplateStyle] = useState<TemplateStyle>({
    fontFamily: 'Inter',
    fontSize: 'standard',
    spacing: 'normal',
    accentColor: '#111827',
    headerAlign: 'center',
    showBorders: true,
  });

  // AI Tailoring Parameters
  const [role, setRole] = useState(initialRole || 'Full Stack / Backend Engineer');
  const [company, setCompany] = useState(initialCompany || 'Target Organization');
  const [jd, setJd] = useState(
    initialJd ||
      `Looking for a strong Software Engineer with experience in building scalable backend services, modern APIs, graph databases, and high-performance frontend architectures.`
  );

  // Helper for adding new skill chips
  const [newSkillInput, setNewSkillInput] = useState<{ [categoryIdx: number]: string }>({});

  // Fetch Master Resume on Mount
  useEffect(() => {
    fetchMasterResume();
  }, []);

  const fetchMasterResume = async () => {
    setLoading(true);
    try {
      const res = await apiService.getMasterResume(getAuthHeaders());
      if (res.has_master_resume && res.blueprint) {
        setBlueprint(res.blueprint);
        setMasterBlueprint(res.blueprint);
        setHasMasterResume(true);
      } else {
        setHasMasterResume(false);
      }
    } catch (err) {
      console.warn('Could not load master resume:', err);
    } finally {
      setLoading(false);
    }
  };

  // Mark state dirty when edited
  const updateBlueprint = (newBp: ResumeBlueprint) => {
    setBlueprint(newBp);
    setIsDirty(true);
  };

  // Contact Field Updates
  const updateContact = (field: keyof typeof blueprint.contact, value: string) => {
    updateBlueprint({
      ...blueprint,
      contact: {
        ...blueprint.contact,
        [field]: value
      }
    });
  };

  // Save Blueprint to Database
  const handleSaveMaster = async () => {
    setIsSaving(true);
    try {
      const res = await apiService.updateMasterResume(blueprint, getAuthHeaders());
      setMasterBlueprint(res.blueprint);
      setHasMasterResume(true);
      setIsDirty(false);
      onSuccess('Master Resume saved and synchronized with database!');
    } catch (err: any) {
      onError(err.message || 'Failed to save master resume');
    } finally {
      setIsSaving(false);
    }
  };

  // Revert back to Master
  const handleResetToMaster = () => {
    if (masterBlueprint) {
      setBlueprint(masterBlueprint);
      setSuggestions({});
      setIsDirty(false);
      setAtsScore(null);
      onSuccess('Reverted back to your Master Resume Blueprint');
    }
  };

  // ================= AI Tailoring & Google Docs-style Diff Generator =================
  const handleTailorResume = async () => {
    if (!jd.trim()) {
      onError('Please paste a target Job Description to tailor the resume');
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

      const tailoredBp: ResumeBlueprint | undefined = data.tailored_blueprint;
      if (tailoredBp) {
        // Compute granular suggestions between current blueprint and tailored blueprint
        const newSuggestions: { [id: string]: AISuggestion } = {};

        // 1. Summary Diff
        if (tailoredBp.summary && tailoredBp.summary !== blueprint.summary) {
          newSuggestions['summary'] = {
            id: 'summary',
            type: 'summary',
            originalText: blueprint.summary || '',
            suggestedText: tailoredBp.summary,
            status: 'pending',
            reason: `Optimized summary for ${role} role and key requirements.`
          };
        }

        // 2. Experience Bullets Diff
        (tailoredBp.experience || []).forEach((tailoredExp, expIdx) => {
          const currentExp = blueprint.experience?.[expIdx];
          if (currentExp) {
            (tailoredExp.bullets || []).forEach((tBullet, bIdx) => {
              const origBullet = currentExp.bullets?.[bIdx];
              if (origBullet && origBullet !== tBullet) {
                const id = `exp-${expIdx}-${bIdx}`;
                newSuggestions[id] = {
                  id,
                  type: 'exp_bullet',
                  parentIndex: expIdx,
                  bulletIndex: bIdx,
                  originalText: origBullet,
                  suggestedText: tBullet,
                  status: 'pending',
                  reason: 'Rephrased with STAR format & target keywords.'
                };
              }
            });
          }
        });

        // 3. Project Bullets Diff
        (tailoredBp.projects || []).forEach((tailoredProj, projIdx) => {
          const currentProj = blueprint.projects?.[projIdx];
          if (currentProj) {
            (tailoredProj.bullets || []).forEach((tBullet, bIdx) => {
              const origBullet = currentProj.bullets?.[bIdx];
              if (origBullet && origBullet !== tBullet) {
                const id = `proj-${projIdx}-${bIdx}`;
                newSuggestions[id] = {
                  id,
                  type: 'proj_bullet',
                  parentIndex: projIdx,
                  bulletIndex: bIdx,
                  originalText: origBullet,
                  suggestedText: tBullet,
                  status: 'pending',
                  reason: 'Enhanced impact metrics & tech stack alignment.'
                };
              }
            });
          }
        });

        setSuggestions(newSuggestions);
        setAtsScore(data.ats_score || 94);
        setIsTailorOpen(false);
        setIsDirty(true);

        const count = Object.keys(newSuggestions).length;
        onSuccess(`Tailored for ${company || 'role'}! ${count} AI suggestions ready for your review (ATS Match: ${data.ats_score || 94}%).`);
        
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#2563EB', '#10B981', '#F59E0B']
        });
      }
    } catch (err: any) {
      onError(err.message || 'Failed to tailor resume');
    } finally {
      setLoading(false);
    }
  };

  // Accept a single AI suggestion
  const handleAcceptSuggestion = (id: string) => {
    const sug = suggestions[id];
    if (!sug) return;

    if (sug.type === 'summary') {
      updateBlueprint({ ...blueprint, summary: sug.suggestedText });
    } else if (sug.type === 'exp_bullet' && sug.parentIndex !== undefined && sug.bulletIndex !== undefined) {
      const expList = [...(blueprint.experience || [])];
      if (expList[sug.parentIndex]?.bullets) {
        expList[sug.parentIndex].bullets[sug.bulletIndex] = sug.suggestedText;
        updateBlueprint({ ...blueprint, experience: expList });
      }
    } else if (sug.type === 'proj_bullet' && sug.parentIndex !== undefined && sug.bulletIndex !== undefined) {
      const projList = [...(blueprint.projects || [])];
      if (projList[sug.parentIndex]?.bullets) {
        projList[sug.parentIndex].bullets[sug.bulletIndex] = sug.suggestedText;
        updateBlueprint({ ...blueprint, projects: projList });
      }
    }

    setSuggestions(prev => ({
      ...prev,
      [id]: { ...prev[id], status: 'accepted' }
    }));
  };

  // Reject a single AI suggestion (keep original)
  const handleRejectSuggestion = (id: string) => {
    setSuggestions(prev => ({
      ...prev,
      [id]: { ...prev[id], status: 'rejected' }
    }));
  };

  // Accept All Pending Suggestions
  const handleAcceptAllSuggestions = () => {
    let newBp = { ...blueprint };

    Object.values(suggestions).forEach(sug => {
      if (sug.status === 'pending') {
        if (sug.type === 'summary') {
          newBp.summary = sug.suggestedText;
        } else if (sug.type === 'exp_bullet' && sug.parentIndex !== undefined && sug.bulletIndex !== undefined) {
          const expList = [...(newBp.experience || [])];
          if (expList[sug.parentIndex]?.bullets) {
            expList[sug.parentIndex].bullets[sug.bulletIndex] = sug.suggestedText;
            newBp.experience = expList;
          }
        } else if (sug.type === 'proj_bullet' && sug.parentIndex !== undefined && sug.bulletIndex !== undefined) {
          const projList = [...(newBp.projects || [])];
          if (projList[sug.parentIndex]?.bullets) {
            projList[sug.parentIndex].bullets[sug.bulletIndex] = sug.suggestedText;
            newBp.projects = projList;
          }
        }
      }
    });

    const updatedSugs: { [id: string]: AISuggestion } = {};
    Object.keys(suggestions).forEach(k => {
      updatedSugs[k] = { ...suggestions[k], status: 'accepted' };
    });

    setBlueprint(newBp);
    setSuggestions(updatedSugs);
    setIsDirty(true);
    onSuccess('Accepted all AI suggestions!');
  };

  // Reject All Pending Suggestions
  const handleRejectAllSuggestions = () => {
    const updatedSugs: { [id: string]: AISuggestion } = {};
    Object.keys(suggestions).forEach(k => {
      updatedSugs[k] = { ...suggestions[k], status: 'rejected' };
    });
    setSuggestions(updatedSugs);
    onSuccess('Kept all original content and rejected AI suggestions.');
  };

  const pendingSuggestionsCount = Object.values(suggestions).filter(s => s.status === 'pending').length;

  // Print to PDF
  const handlePrint = () => {
    window.print();
  };

  // --- Experience Actions ---
  const addExperience = () => {
    const newEntry: ExperienceEntry = {
      company: 'New Company',
      role: 'Software Engineer',
      location: 'Location',
      start_date: '2023',
      end_date: 'Present',
      is_current: true,
      bullets: ['Led development of core features contributing to system performance and team velocity.']
    };
    updateBlueprint({
      ...blueprint,
      experience: [newEntry, ...(blueprint.experience || [])]
    });
  };

  const updateExperience = (idx: number, field: keyof ExperienceEntry, val: any) => {
    const updated = [...(blueprint.experience || [])];
    updated[idx] = { ...updated[idx], [field]: val };
    updateBlueprint({ ...blueprint, experience: updated });
  };

  const deleteExperience = (idx: number) => {
    const updated = (blueprint.experience || []).filter((_, i) => i !== idx);
    updateBlueprint({ ...blueprint, experience: updated });
  };

  const addExpBullet = (expIdx: number) => {
    const updated = [...(blueprint.experience || [])];
    updated[expIdx].bullets = [...(updated[expIdx].bullets || []), 'Engineered high-impact solution using modern engineering principles.'];
    updateBlueprint({ ...blueprint, experience: updated });
  };

  const updateExpBullet = (expIdx: number, bulletIdx: number, val: string) => {
    const updated = [...(blueprint.experience || [])];
    updated[expIdx].bullets[bulletIdx] = val;
    updateBlueprint({ ...blueprint, experience: updated });
  };

  const deleteExpBullet = (expIdx: number, bulletIdx: number) => {
    const updated = [...(blueprint.experience || [])];
    updated[expIdx].bullets = updated[expIdx].bullets.filter((_, i) => i !== bulletIdx);
    updateBlueprint({ ...blueprint, experience: updated });
  };

  // --- Project Actions ---
  const addProject = () => {
    const newProj: ProjectEntry = {
      name: 'New Project Name',
      tech_stack: 'Python, React, TypeScript',
      repo_url: '',
      live_url: '',
      bullets: ['Developed full-stack application featuring automated data sync and responsive design.']
    };
    updateBlueprint({
      ...blueprint,
      projects: [newProj, ...(blueprint.projects || [])]
    });
  };

  const updateProject = (idx: number, field: keyof ProjectEntry, val: any) => {
    const updated = [...(blueprint.projects || [])];
    updated[idx] = { ...updated[idx], [field]: val };
    updateBlueprint({ ...blueprint, projects: updated });
  };

  const deleteProject = (idx: number) => {
    const updated = (blueprint.projects || []).filter((_, i) => i !== idx);
    updateBlueprint({ ...blueprint, projects: updated });
  };

  const addProjBullet = (projIdx: number) => {
    const updated = [...(blueprint.projects || [])];
    updated[projIdx].bullets = [...(updated[projIdx].bullets || []), 'Implemented critical logic enhancing user throughput.'];
    updateBlueprint({ ...blueprint, projects: updated });
  };

  const updateProjBullet = (projIdx: number, bulletIdx: number, val: string) => {
    const updated = [...(blueprint.projects || [])];
    updated[projIdx].bullets[bulletIdx] = val;
    updateBlueprint({ ...blueprint, projects: updated });
  };

  const deleteProjBullet = (projIdx: number, bulletIdx: number) => {
    const updated = [...(blueprint.projects || [])];
    updated[projIdx].bullets = updated[projIdx].bullets.filter((_, i) => i !== bulletIdx);
    updateBlueprint({ ...blueprint, projects: updated });
  };

  // --- Skill Category Actions ---
  const addSkillCategory = () => {
    const newCat: SkillCategory = {
      category: 'Specialized Tools',
      skills: ['Git', 'Docker']
    };
    updateBlueprint({
      ...blueprint,
      skills: [...(blueprint.skills || []), newCat]
    });
  };

  const updateSkillCategoryName = (catIdx: number, name: string) => {
    const updated = [...(blueprint.skills || [])];
    updated[catIdx].category = name;
    updateBlueprint({ ...blueprint, skills: updated });
  };

  const deleteSkillCategory = (catIdx: number) => {
    const updated = (blueprint.skills || []).filter((_, i) => i !== catIdx);
    updateBlueprint({ ...blueprint, skills: updated });
  };

  const addSkillTag = (catIdx: number, tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const updated = [...(blueprint.skills || [])];
    if (!updated[catIdx].skills.includes(trimmed)) {
      updated[catIdx].skills = [...updated[catIdx].skills, trimmed];
      updateBlueprint({ ...blueprint, skills: updated });
    }
    setNewSkillInput({ ...newSkillInput, [catIdx]: '' });
  };

  const removeSkillTag = (catIdx: number, skillIdx: number) => {
    const updated = [...(blueprint.skills || [])];
    updated[catIdx].skills = updated[catIdx].skills.filter((_, i) => i !== skillIdx);
    updateBlueprint({ ...blueprint, skills: updated });
  };

  // --- Education Actions ---
  const addEducation = () => {
    const newEdu: EducationEntry = {
      university: 'University Name',
      degree: 'Bachelor of Science',
      field_of_study: 'Computer Science',
      start_date: '2020',
      end_date: '2024',
      gpa: ''
    };
    updateBlueprint({
      ...blueprint,
      education: [...(blueprint.education || []), newEdu]
    });
  };

  const updateEducation = (idx: number, field: keyof EducationEntry, val: string) => {
    const updated = [...(blueprint.education || [])];
    updated[idx] = { ...updated[idx], [field]: val };
    updateBlueprint({ ...blueprint, education: updated });
  };

  const deleteEducation = (idx: number) => {
    const updated = (blueprint.education || []).filter((_, i) => i !== idx);
    updateBlueprint({ ...blueprint, education: updated });
  };

  // --- Achievement Actions ---
  const addAchievement = () => {
    updateBlueprint({
      ...blueprint,
      achievements: [...(blueprint.achievements || []), 'Recognized for technical excellence / Hackathon award.']
    });
  };

  const updateAchievement = (idx: number, val: string) => {
    const updated = [...(blueprint.achievements || [])];
    updated[idx] = val;
    updateBlueprint({ ...blueprint, achievements: updated });
  };

  const deleteAchievement = (idx: number) => {
    const updated = (blueprint.achievements || []).filter((_, i) => i !== idx);
    updateBlueprint({ ...blueprint, achievements: updated });
  };

  // Styling helper classes based on templateStyle
  const getFontFamilyStyle = () => {
    switch (templateStyle.fontFamily) {
      case 'Merriweather':
        return { fontFamily: '"Merriweather", Georgia, serif' };
      case 'Roboto':
        return { fontFamily: '"Roboto", sans-serif' };
      case 'JetBrains Mono':
        return { fontFamily: '"JetBrains Mono", monospace' };
      default:
        return { fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' };
    }
  };

  const getFontSizeClass = () => {
    switch (templateStyle.fontSize) {
      case 'compact':
        return 'text-[11px] leading-snug';
      case 'spacious':
        return 'text-[13px] leading-relaxed';
      default:
        return 'text-xs leading-normal';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Controls Toolbar (Hidden in Print) */}
      <div 
        className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl border shadow-sm transition-all"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                Master ATS Resume Studio
              </h2>
              {hasMasterResume ? (
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Master Synced
                </span>
              ) : (
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1">
                  Default Template
                </span>
              )}
              {isDirty && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs pt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Google Docs-style Review Editor — Accept, Edit, or Reject JD optimizations live on your master template
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div 
            className="flex items-center p-1 rounded-xl border"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
          >
            <button
              onClick={() => setIsEditMode(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isEditMode
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:text-blue-600'
              }`}
              style={{ color: isEditMode ? '#ffffff' : 'var(--text-secondary)' }}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Interactive Editor</span>
            </button>
            <button
              onClick={() => setIsEditMode(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                !isEditMode
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:text-blue-600'
              }`}
              style={{ color: !isEditMode ? '#ffffff' : 'var(--text-secondary)' }}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Clean ATS Preview</span>
            </button>
          </div>

          {/* Template Style Dropdown Toggle */}
          <button
            onClick={() => setIsStyleOpen(!isStyleOpen)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
              isStyleOpen ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : ''
            }`}
            style={{
              backgroundColor: isStyleOpen ? undefined : 'var(--bg-tertiary)',
              color: isStyleOpen ? undefined : 'var(--text-primary)',
              borderColor: 'var(--border-primary)'
            }}
          >
            <Palette className="w-3.5 h-3.5 text-blue-600" />
            <span>Customize Template</span>
          </button>

          {/* AI Tailoring Drawer Button */}
          <button
            onClick={() => setIsTailorOpen(!isTailorOpen)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isTailorOpen 
                ? 'bg-purple-600 text-white shadow-md' 
                : 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Tailor for JD</span>
          </button>

          {/* Save Master Blueprint */}
          <button
            onClick={handleSaveMaster}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Blueprint'}</span>
          </button>

          {/* Revert Button if dirty or tailored */}
          {masterBlueprint && isDirty && (
            <button
              onClick={handleResetToMaster}
              className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-primary)'
              }}
              title="Revert to Original Master Resume"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Revert</span>
            </button>
          )}

          {/* Upload Resume Modal */}
          <button
            onClick={() => setIsResumeModalOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all"
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border-primary)'
            }}
          >
            <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
            <span>Upload PDF</span>
          </button>

          {/* Print / Export PDF */}
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all"
            style={{
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border-primary)'
            }}
          >
            <Printer className="w-4 h-4" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Template Customizer Toolbar (Hidden in Print) */}
      {isStyleOpen && (
        <div 
          className="no-print p-4 rounded-2xl border space-y-3 shadow-sm animate-in fade-in duration-200"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Template Appearance & Layout Controls
              </h3>
            </div>
            <button onClick={() => setIsStyleOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            {/* Font Family */}
            <div>
              <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Typography</label>
              <select
                value={templateStyle.fontFamily}
                onChange={(e: any) => setTemplateStyle({ ...templateStyle, fontFamily: e.target.value })}
                className="input-base w-full text-xs"
              >
                <option value="Inter">Inter (Modern Clean)</option>
                <option value="Merriweather">Merriweather (Executive Serif)</option>
                <option value="Roboto">Roboto (Technical Sans)</option>
                <option value="JetBrains Mono">JetBrains Mono (Developer)</option>
              </select>
            </div>

            {/* Font Size */}
            <div>
              <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Density / Text Size</label>
              <select
                value={templateStyle.fontSize}
                onChange={(e: any) => setTemplateStyle({ ...templateStyle, fontSize: e.target.value })}
                className="input-base w-full text-xs"
              >
                <option value="compact">Compact (Fit 1 Page)</option>
                <option value="standard">Standard (10.5 pt)</option>
                <option value="spacious">Spacious (11.5 pt)</option>
              </select>
            </div>

            {/* Header Alignment */}
            <div>
              <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Header Align</label>
              <select
                value={templateStyle.headerAlign}
                onChange={(e: any) => setTemplateStyle({ ...templateStyle, headerAlign: e.target.value })}
                className="input-base w-full text-xs"
              >
                <option value="center">Centered (Standard ATS)</option>
                <option value="left">Left Aligned (Modern Silicon Valley)</option>
              </select>
            </div>

            {/* Accent Color Palette */}
            <div>
              <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Accent Theme</label>
              <div className="flex items-center gap-2 pt-1">
                {ACCENT_COLORS.map((col, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTemplateStyle({ ...templateStyle, accentColor: col.value })}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      templateStyle.accentColor === col.value ? 'scale-110 border-blue-500 shadow-sm' : 'border-transparent'
                    } ${col.class}`}
                    title={col.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Tailoring Parameters Form (Hidden in Print) */}
      {isTailorOpen && (
        <div 
          className="no-print p-6 rounded-2xl border space-y-4 shadow-sm animate-in fade-in duration-200"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Target Job Description Optimizer
              </h3>
            </div>
            {atsScore !== null && (
              <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> ATS Match: {atsScore}%
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Target Role Title</label>
              <input
                type="text"
                placeholder="e.g. Senior Backend / Distributed Systems Engineer"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="input-base w-full text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Target Company Name</label>
              <input
                type="text"
                placeholder="e.g. Google, Stripe, Microsoft, DRDO"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="input-base w-full text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Target Job Description (JD) / Key Requirements
            </label>
            <textarea
              rows={3}
              placeholder="Paste the target job description to dynamically align STAR impact bullets, tech keywords, and executive summary..."
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              className="input-base w-full text-xs font-mono leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setIsTailorOpen(false)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleTailorResume}
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Synthesizing Tailored STAR Bullets...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Generate Tracked Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Google Docs-style Floating Review Bar for Pending Changes */}
      {pendingSuggestionsCount > 0 && (
        <div 
          className="no-print p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/40 dark:to-blue-950/40"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200">
                {pendingSuggestionsCount} Pending AI Suggestions for {company || 'Target Role'}
              </h4>
              <p className="text-[11px] text-purple-700 dark:text-purple-300">
                Review highlighted changes below. You can Accept, Reject, or Edit each item inline.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAcceptAllSuggestions}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-all"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Accept All ({pendingSuggestionsCount})</span>
            </button>
            <button
              onClick={handleRejectAllSuggestions}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              Reject All
            </button>
          </div>
        </div>
      )}

      {/* Main Resume Paper Canvas */}
      <div className="w-full max-w-4xl mx-auto">
        <div
          className={`resume-paper p-8 sm:p-12 rounded-2xl shadow-xl space-y-5 transition-all ${getFontSizeClass()}`}
          style={{
            ...getFontFamilyStyle(),
            backgroundColor: 'var(--bg-primary)',
            border: isEditMode ? '1px solid var(--border-primary)' : '1px solid var(--border-secondary)',
            color: 'var(--text-primary)',
          }}
        >
          {/* ================= HEADER / CONTACT ================= */}
          <div 
            className="pb-3 space-y-1.5 border-b-2" 
            style={{ 
              borderColor: templateStyle.accentColor,
              textAlign: templateStyle.headerAlign === 'center' ? 'center' : 'left'
            }}
          >
            {isEditMode ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: templateStyle.accentColor }}>
                    Candidate Name & Contact Details
                  </span>
                </div>
                <input
                  type="text"
                  value={blueprint.contact?.full_name || ''}
                  onChange={(e) => updateContact('full_name', e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full text-2xl font-black tracking-tight input-base"
                  style={{ height: '42px', ...getFontFamilyStyle() }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <input
                      type="email"
                      value={blueprint.contact?.email || ''}
                      onChange={(e) => updateContact('email', e.target.value)}
                      placeholder="Email"
                      className="input-base w-full text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <input
                      type="text"
                      value={blueprint.contact?.phone || ''}
                      onChange={(e) => updateContact('phone', e.target.value)}
                      placeholder="Phone"
                      className="input-base w-full text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <input
                      type="text"
                      value={blueprint.contact?.location || ''}
                      onChange={(e) => updateContact('location', e.target.value)}
                      placeholder="Location (e.g. City, Country)"
                      className="input-base w-full text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Github className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <input
                      type="text"
                      value={blueprint.contact?.github_url || ''}
                      onChange={(e) => updateContact('github_url', e.target.value)}
                      placeholder="GitHub URL"
                      className="input-base w-full text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Linkedin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    <input
                      type="text"
                      value={blueprint.contact?.linkedin_url || ''}
                      onChange={(e) => updateContact('linkedin_url', e.target.value)}
                      placeholder="LinkedIn URL"
                      className="input-base w-full text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <input
                      type="text"
                      value={blueprint.contact?.portfolio_url || ''}
                      onChange={(e) => updateContact('portfolio_url', e.target.value)}
                      placeholder="Portfolio / Website URL"
                      className="input-base w-full text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Clean Preview Header */
              <div className="space-y-1">
                <h1 
                  className="text-2xl sm:text-3xl font-bold tracking-tight uppercase"
                  style={{ color: templateStyle.accentColor }}
                >
                  {blueprint.contact?.full_name || 'Software Engineer'}
                </h1>
                
                <div 
                  className={`flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs pt-0.5 ${
                    templateStyle.headerAlign === 'center' ? 'justify-center' : 'justify-start'
                  }`}
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {blueprint.contact?.location && <span>{blueprint.contact.location}</span>}
                  {blueprint.contact?.phone && <span>• {blueprint.contact.phone}</span>}
                  {blueprint.contact?.email && (
                    <>
                      <span>•</span>
                      <a href={`mailto:${blueprint.contact.email}`} className="hover:underline text-blue-600 dark:text-blue-400">
                        {blueprint.contact.email}
                      </a>
                    </>
                  )}
                  {blueprint.contact?.github_url && (
                    <>
                      <span>•</span>
                      <a 
                        href={blueprint.contact.github_url.startsWith('http') ? blueprint.contact.github_url : `https://${blueprint.contact.github_url}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="hover:underline text-blue-600 dark:text-blue-400"
                      >
                        GitHub
                      </a>
                    </>
                  )}
                  {blueprint.contact?.linkedin_url && (
                    <>
                      <span>•</span>
                      <a 
                        href={blueprint.contact.linkedin_url.startsWith('http') ? blueprint.contact.linkedin_url : `https://${blueprint.contact.linkedin_url}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="hover:underline text-blue-600 dark:text-blue-400"
                      >
                        LinkedIn
                      </a>
                    </>
                  )}
                  {blueprint.contact?.portfolio_url && (
                    <>
                      <span>•</span>
                      <a 
                        href={blueprint.contact.portfolio_url.startsWith('http') ? blueprint.contact.portfolio_url : `https://${blueprint.contact.portfolio_url}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="hover:underline text-blue-600 dark:text-blue-400"
                      >
                        Portfolio
                      </a>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ================= PROFESSIONAL SUMMARY ================= */}
          <div className="space-y-1.5">
            <h3 
              className="text-xs font-bold uppercase tracking-wider font-mono border-b pb-0.5" 
              style={{ color: templateStyle.accentColor, borderColor: 'var(--border-primary)' }}
            >
              Professional Summary
            </h3>

            {/* Google Docs-style Diff Box if Summary has pending suggestion */}
            {suggestions['summary'] && suggestions['summary'].status === 'pending' ? (
              <div className="p-3 rounded-xl border space-y-2 bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between text-[11px] font-bold text-purple-800 dark:text-purple-300">
                  <span className="flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5" /> AI Tailored Summary Suggestion:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAcceptSuggestion('summary')}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm"
                    >
                      <Check className="w-3 h-3" /> Accept
                    </button>
                    <button
                      onClick={() => handleRejectSuggestion('summary')}
                      className="px-2.5 py-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-medium flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Keep Original
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="line-through opacity-60 text-red-600 dark:text-red-400">
                    {suggestions['summary'].originalText}
                  </div>
                  <div className="font-medium text-emerald-700 dark:text-emerald-300">
                    {suggestions['summary'].suggestedText}
                  </div>
                </div>
              </div>
            ) : isEditMode ? (
              <textarea
                rows={3}
                value={blueprint.summary || ''}
                onChange={(e) => updateBlueprint({ ...blueprint, summary: e.target.value })}
                placeholder="Write a compelling executive summary highlighting your core tech strengths and architectural contributions..."
                className="input-base w-full text-xs leading-relaxed"
                style={getFontFamilyStyle()}
              />
            ) : (
              <p className="text-xs leading-relaxed text-justify" style={{ color: 'var(--text-secondary)' }}>
                {blueprint.summary || 'Software engineering professional with deep technical expertise in systems design and modern cloud architectures.'}
              </p>
            )}
          </div>

          {/* ================= WORK EXPERIENCE ================= */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b pb-0.5" style={{ borderColor: 'var(--border-primary)' }}>
              <h3 
                className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5" 
                style={{ color: templateStyle.accentColor }}
              >
                <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                Work Experience
              </h3>
              {isEditMode && (
                <button
                  onClick={addExperience}
                  className="no-print text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Experience
                </button>
              )}
            </div>

            <div className="space-y-3.5">
              {(blueprint.experience || []).map((exp, expIdx) => (
                <div key={expIdx} className={`space-y-1.5 ${isEditMode ? 'p-3.5 rounded-xl border' : ''}`} style={{ borderColor: 'var(--border-primary)' }}>
                  {isEditMode ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase font-mono text-emerald-600">
                          Experience #{expIdx + 1}
                        </span>
                        <button
                          onClick={() => deleteExperience(expIdx)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove this experience"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>Company</label>
                          <input
                            type="text"
                            value={exp.company}
                            onChange={(e) => updateExperience(expIdx, 'company', e.target.value)}
                            placeholder="Company Name (e.g. SUREXA IT Solutions, DRDO ADRDE)"
                            className="input-base w-full text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>Role / Title</label>
                          <input
                            type="text"
                            value={exp.role}
                            onChange={(e) => updateExperience(expIdx, 'role', e.target.value)}
                            placeholder="Role Title (e.g. Full Stack Developer Intern)"
                            className="input-base w-full text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>Location</label>
                          <input
                            type="text"
                            value={exp.location || ''}
                            onChange={(e) => updateExperience(expIdx, 'location', e.target.value)}
                            placeholder="City / State"
                            className="input-base w-full text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>Start Date</label>
                          <input
                            type="text"
                            value={exp.start_date || ''}
                            onChange={(e) => updateExperience(expIdx, 'start_date', e.target.value)}
                            placeholder="e.g. May 2024"
                            className="input-base w-full text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>End Date</label>
                          <input
                            type="text"
                            value={exp.end_date || ''}
                            onChange={(e) => updateExperience(expIdx, 'end_date', e.target.value)}
                            placeholder="e.g. July 2024 or Present"
                            className="input-base w-full text-xs"
                          />
                        </div>
                      </div>

                      {/* Experience Bullets Editor with Suggestion Boxes */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            Impact & Responsibilities (STAR Bullets)
                          </label>
                          <button
                            onClick={() => addExpBullet(expIdx)}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" /> Add Bullet
                          </button>
                        </div>
                        {(exp.bullets || []).map((bullet, bIdx) => {
                          const sugId = `exp-${expIdx}-${bIdx}`;
                          const sug = suggestions[sugId];

                          return (
                            <div key={bIdx} className="space-y-1">
                              {sug && sug.status === 'pending' ? (
                                <div className="p-2.5 rounded-lg border bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-purple-700 dark:text-purple-300">
                                    <span className="flex items-center gap-1">
                                      <Wand2 className="w-3 h-3" /> AI Tailored Bullet Suggestion
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleAcceptSuggestion(sugId)}
                                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1"
                                      >
                                        <Check className="w-3 h-3" /> Accept
                                      </button>
                                      <button
                                        onClick={() => handleRejectSuggestion(sugId)}
                                        className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-medium"
                                      >
                                        <X className="w-3 h-3" /> Keep Original
                                      </button>
                                    </div>
                                  </div>
                                  <div className="line-through text-red-500 opacity-60">{sug.originalText}</div>
                                  <div className="font-medium text-emerald-700 dark:text-emerald-300">{sug.suggestedText}</div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-1.5">
                                  <textarea
                                    rows={2}
                                    value={bullet}
                                    onChange={(e) => updateExpBullet(expIdx, bIdx, e.target.value)}
                                    placeholder="Action + Context + Quantifiable Result..."
                                    className="input-base w-full text-xs leading-relaxed"
                                  />
                                  <button
                                    onClick={() => deleteExpBullet(expIdx, bIdx)}
                                    className="text-red-400 hover:text-red-600 p-1 mt-1"
                                    title="Delete bullet"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Clean ATS Preview Experience */
                    <div className="space-y-0.5">
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between">
                        <div className="flex items-baseline gap-2">
                          <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {exp.company}
                          </h4>
                          {exp.location && (
                            <span className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                              – {exp.location}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                          {exp.start_date} – {exp.end_date || 'Present'}
                        </div>
                      </div>

                      <div className="text-xs font-semibold italic" style={{ color: 'var(--text-primary)' }}>
                        {exp.role}
                      </div>

                      {exp.bullets && exp.bullets.length > 0 && (
                        <ul className="list-disc list-outside ml-4 space-y-0.5 text-xs pt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {exp.bullets.map((bullet, bIdx) => (
                            <li key={bIdx} className="leading-relaxed">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ================= TECHNICAL PROJECTS ================= */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b pb-0.5" style={{ borderColor: 'var(--border-primary)' }}>
              <h3 
                className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5" 
                style={{ color: templateStyle.accentColor }}
              >
                <FolderGit2 className="w-3.5 h-3.5 text-blue-600" />
                Technical Projects & Systems
              </h3>
              {isEditMode && (
                <button
                  onClick={addProject}
                  className="no-print text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Project
                </button>
              )}
            </div>

            <div className="space-y-3.5">
              {(blueprint.projects || []).map((proj, projIdx) => (
                <div key={projIdx} className={`space-y-1.5 ${isEditMode ? 'p-3.5 rounded-xl border' : ''}`} style={{ borderColor: 'var(--border-primary)' }}>
                  {isEditMode ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase font-mono text-blue-600">
                          Project #{projIdx + 1}
                        </span>
                        <button
                          onClick={() => deleteProject(projIdx)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove this project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>Project Name</label>
                          <input
                            type="text"
                            value={proj.name}
                            onChange={(e) => updateProject(projIdx, 'name', e.target.value)}
                            placeholder="e.g. NextGen Firewall (DRDO Project)"
                            className="input-base w-full text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>Tech Stack</label>
                          <input
                            type="text"
                            value={proj.tech_stack || ''}
                            onChange={(e) => updateProject(projIdx, 'tech_stack', e.target.value)}
                            placeholder="e.g. Python, Scapy, NetfilterQueue, ML"
                            className="input-base w-full text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>GitHub Repo URL</label>
                          <input
                            type="text"
                            value={proj.repo_url || ''}
                            onChange={(e) => updateProject(projIdx, 'repo_url', e.target.value)}
                            placeholder="https://github.com/..."
                            className="input-base w-full text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>Live Demo / Link</label>
                          <input
                            type="text"
                            value={proj.live_url || ''}
                            onChange={(e) => updateProject(projIdx, 'live_url', e.target.value)}
                            placeholder="https://..."
                            className="input-base w-full text-xs"
                          />
                        </div>
                      </div>

                      {/* Project Bullets with Suggestions */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                            Project Details & Quantifiable Impact
                          </label>
                          <button
                            onClick={() => addProjBullet(projIdx)}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" /> Add Bullet
                          </button>
                        </div>
                        {(proj.bullets || []).map((bullet, bIdx) => {
                          const sugId = `proj-${projIdx}-${bIdx}`;
                          const sug = suggestions[sugId];

                          return (
                            <div key={bIdx} className="space-y-1">
                              {sug && sug.status === 'pending' ? (
                                <div className="p-2.5 rounded-lg border bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between text-[10px] font-bold text-purple-700 dark:text-purple-300">
                                    <span className="flex items-center gap-1">
                                      <Wand2 className="w-3 h-3" /> AI Tailored Project Bullet
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleAcceptSuggestion(sugId)}
                                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1"
                                      >
                                        <Check className="w-3 h-3" /> Accept
                                      </button>
                                      <button
                                        onClick={() => handleRejectSuggestion(sugId)}
                                        className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-[10px] font-medium"
                                      >
                                        <X className="w-3 h-3" /> Keep Original
                                      </button>
                                    </div>
                                  </div>
                                  <div className="line-through text-red-500 opacity-60">{sug.originalText}</div>
                                  <div className="font-medium text-emerald-700 dark:text-emerald-300">{sug.suggestedText}</div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-1.5">
                                  <textarea
                                    rows={2}
                                    value={bullet}
                                    onChange={(e) => updateProjBullet(projIdx, bIdx, e.target.value)}
                                    placeholder="Key feature developed, algorithms implemented, or benchmarks achieved..."
                                    className="input-base w-full text-xs leading-relaxed"
                                  />
                                  <button
                                    onClick={() => deleteProjBullet(projIdx, bIdx)}
                                    className="text-red-400 hover:text-red-600 p-1 mt-1"
                                    title="Delete bullet"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Clean ATS Preview Project */
                    <div className="space-y-0.5">
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                            {proj.name}
                          </h4>
                          {proj.tech_stack && (
                            <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                              | {proj.tech_stack}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          {proj.repo_url && (
                            <a
                              href={proj.repo_url.startsWith('http') ? proj.repo_url : `https://${proj.repo_url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-0.5 font-mono"
                            >
                              Code ↗
                            </a>
                          )}
                          {proj.live_url && (
                            <a
                              href={proj.live_url.startsWith('http') ? proj.live_url : `https://${proj.live_url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:underline flex items-center gap-0.5 font-mono"
                            >
                              Demo ↗
                            </a>
                          )}
                        </div>
                      </div>

                      {proj.bullets && proj.bullets.length > 0 && (
                        <ul className="list-disc list-outside ml-4 space-y-0.5 text-xs pt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {proj.bullets.map((bullet, bIdx) => (
                            <li key={bIdx} className="leading-relaxed">
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ================= TECHNICAL SKILLS ================= */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b pb-0.5" style={{ borderColor: 'var(--border-primary)' }}>
              <h3 
                className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5" 
                style={{ color: templateStyle.accentColor }}
              >
                <Code2 className="w-3.5 h-3.5 text-amber-600" />
                Technical Skills & Tools
              </h3>
              {isEditMode && (
                <button
                  onClick={addSkillCategory}
                  className="no-print text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Category
                </button>
              )}
            </div>

            <div className="space-y-2">
              {(blueprint.skills || []).map((cat, catIdx) => (
                <div key={catIdx} className={isEditMode ? 'p-3 rounded-xl border space-y-2' : 'flex flex-col sm:flex-row sm:items-baseline gap-1 text-xs'} style={{ borderColor: 'var(--border-primary)' }}>
                  {isEditMode ? (
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <input
                          type="text"
                          value={cat.category}
                          onChange={(e) => updateSkillCategoryName(catIdx, e.target.value)}
                          placeholder="Category (e.g. Languages, Frameworks, Cloud)"
                          className="input-base text-xs font-bold w-1/2"
                        />
                        <button
                          onClick={() => deleteSkillCategory(catIdx)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Remove Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Skill Tags */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {cat.skills.map((skill, sIdx) => (
                          <span
                            key={sIdx}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium"
                            style={{
                              backgroundColor: 'var(--bg-tertiary)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-primary)',
                            }}
                          >
                            <span>{skill}</span>
                            <button
                              onClick={() => removeSkillTag(catIdx, sIdx)}
                              className="text-gray-400 hover:text-red-500 font-bold ml-1 text-xs"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="+ Add skill..."
                            value={newSkillInput[catIdx] || ''}
                            onChange={(e) => setNewSkillInput({ ...newSkillInput, [catIdx]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault();
                                addSkillTag(catIdx, newSkillInput[catIdx] || '');
                              }
                            }}
                            className="input-base text-xs"
                            style={{ width: '110px', height: '28px' }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Clean ATS Skills Line */
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 text-xs leading-relaxed">
                      <span className="font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>
                        {cat.category}:
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {cat.skills.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ================= EDUCATION ================= */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b pb-0.5" style={{ borderColor: 'var(--border-primary)' }}>
              <h3 
                className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5" 
                style={{ color: templateStyle.accentColor }}
              >
                <GraduationCap className="w-3.5 h-3.5 text-purple-600" />
                Education
              </h3>
              {isEditMode && (
                <button
                  onClick={addEducation}
                  className="no-print text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Education
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {(blueprint.education || []).map((edu, eduIdx) => (
                <div key={eduIdx} className={isEditMode ? 'p-3 rounded-xl border space-y-2' : 'space-y-0.5 text-xs'} style={{ borderColor: 'var(--border-primary)' }}>
                  {isEditMode ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase font-mono text-purple-600">
                          Education #{eduIdx + 1}
                        </span>
                        <button
                          onClick={() => deleteEducation(eduIdx)}
                          className="text-red-400 hover:text-red-600 p-1"
                          title="Remove Education"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>University / College</label>
                          <input
                            type="text"
                            value={edu.university}
                            onChange={(e) => updateEducation(eduIdx, 'university', e.target.value)}
                            placeholder="e.g. Graphic Era Hill University"
                            className="input-base w-full text-xs font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>Degree & Field</label>
                          <input
                            type="text"
                            value={edu.degree}
                            onChange={(e) => updateEducation(eduIdx, 'degree', e.target.value)}
                            placeholder="e.g. B.Tech in Computer Science & Engineering"
                            className="input-base w-full text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>Start Date</label>
                          <input
                            type="text"
                            value={edu.start_date || ''}
                            onChange={(e) => updateEducation(eduIdx, 'start_date', e.target.value)}
                            placeholder="e.g. 2021"
                            className="input-base w-full text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>End Date</label>
                          <input
                            type="text"
                            value={edu.end_date || ''}
                            onChange={(e) => updateEducation(eduIdx, 'end_date', e.target.value)}
                            placeholder="e.g. 2025"
                            className="input-base w-full text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-[11px] mb-0.5" style={{ color: 'var(--text-secondary)' }}>CGPA / Percentage</label>
                          <input
                            type="text"
                            value={edu.gpa || ''}
                            onChange={(e) => updateEducation(eduIdx, 'gpa', e.target.value)}
                            placeholder="e.g. 8.4 / 10"
                            className="input-base w-full text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Clean ATS Preview Education */
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between">
                        <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {edu.university}
                        </div>
                        <div className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                          {edu.start_date} – {edu.end_date}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span>{edu.degree} {edu.field_of_study ? `in ${edu.field_of_study}` : ''}</span>
                        {edu.gpa && <span>GPA: {edu.gpa}</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ================= ACHIEVEMENTS & HACKATHONS ================= */}
          {(blueprint.achievements && blueprint.achievements.length > 0 || isEditMode) && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b pb-0.5" style={{ borderColor: 'var(--border-primary)' }}>
                <h3 
                  className="text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5" 
                  style={{ color: templateStyle.accentColor }}
                >
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  Achievements & Hackathons
                </h3>
                {isEditMode && (
                  <button
                    onClick={addAchievement}
                    className="no-print text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Achievement
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {isEditMode ? (
                  (blueprint.achievements || []).map((ach, achIdx) => (
                    <div key={achIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={ach}
                        onChange={(e) => updateAchievement(achIdx, e.target.value)}
                        placeholder="e.g. 1st Place Winner – SIH 2024, DRDO ADRDE Demonstration"
                        className="input-base w-full text-xs"
                      />
                      <button
                        onClick={() => deleteAchievement(achIdx)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Delete achievement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <ul className="list-disc list-outside ml-4 space-y-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {(blueprint.achievements || []).map((ach, achIdx) => (
                      <li key={achIdx} className="leading-relaxed">
                        {ach}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sync Resume Modal */}
      <SyncResumeModal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        onUploadSuccess={(bp) => {
          if (bp) {
            setBlueprint(bp);
            setMasterBlueprint(bp);
            setHasMasterResume(true);
            setSuggestions({});
            setIsDirty(false);
          }
          setIsResumeModalOpen(false);
        }}
        onSuccessToast={onSuccess}
        onErrorToast={onError}
      />
    </div>
  );
};
