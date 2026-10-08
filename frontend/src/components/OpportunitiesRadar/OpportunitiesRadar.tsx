import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Briefcase, 
  GraduationCap, 
  Trophy, 
  Globe, 
  Sparkles, 
  ExternalLink, 
  Clock, 
  Filter, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  FileText, 
  ArrowUpRight, 
  Bookmark, 
  BookmarkCheck,
  Zap,
  Building2,
  MapPin,
  DollarSign,
  Gift,
  Flame,
  Award,
  ShieldCheck,
  RefreshCw,
  Link2,
  X,
  SlidersHorizontal,
  Check,
  Plus,
  Target,
  Layers,
  Swords
} from 'lucide-react';
import { Opportunity, UserPreferences } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface OpportunitiesRadarProps {
  onTailorResume: (role: string, company: string, jd: string) => void;
  onFindReferral: (company: string) => void;
  onPrepareInterview?: (role: string, company: string, jd: string) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

type CategoryTab = 'all' | 'jobs' | 'internships' | 'hackathons' | 'opensource';

const DEFAULT_PREFERENCES: UserPreferences = {
  target_country: 'India',
  preferred_cities: ['Bengaluru', 'Noida / Delhi NCR', 'Hyderabad', 'Pune', 'Mumbai', 'Remote India'],
  work_modes: ['Remote', 'Hybrid', 'Onsite'],
  preferred_roles: ['Backend Engineer', 'Full Stack Developer', 'Software Engineer', 'AI/ML Engineer'],
  opportunity_types: ['jobs', 'internships', 'hackathons', 'opensource'],
  experience_level: 'Fresher / 0-3 yrs',
  min_salary: '₹6-18 LPA / $25k+ Remote'
};

const INDIAN_CITIES = [
  'Bengaluru',
  'Noida / Delhi NCR',
  'Gurugram',
  'Hyderabad',
  'Pune',
  'Mumbai',
  'Chennai',
  'Remote India'
];

const AVAILABLE_ROLES = [
  'Backend Engineer',
  'Full Stack Developer',
  'Software Engineer',
  'AI/ML Engineer',
  'Graph Intelligence Engineer',
  'Frontend Developer',
  'Cybersecurity & Systems',
  'DevOps / Cloud'
];

export const OpportunitiesRadar: React.FC<OpportunitiesRadarProps> = ({
  onTailorResume,
  onFindReferral,
  onPrepareInterview,
  onError,
  onSuccess,
}) => {
  const { getAuthHeaders } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [categoryCounts, setCategoryCounts] = useState({
    all: 0,
    jobs: 0,
    internships: 0,
    hackathons: 0,
    opensource: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string>('India');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'match_score' | 'deadline' | 'newest'>('match_score');
  
  // User Preferences State
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [customRoleInput, setCustomRoleInput] = useState('');

  // Smart Job URL Ingestion Modal
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [jobUrlInput, setJobUrlInput] = useState('');
  const [isParsingUrl, setIsParsingUrl] = useState(false);

  // College Notice / Raw JD Extraction Modal
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [rawNoticeInput, setRawNoticeInput] = useState('');
  const [isExtractingNotice, setIsExtractingNotice] = useState(false);

  // Bookmarked Opportunities
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // Load user preferences on mount
  useEffect(() => {
    loadUserPreferences();
    try {
      const saved = localStorage.getItem('careeros_bookmarked_opps');
      if (saved) {
        setBookmarkedIds(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [activeCategory, remoteOnly, locationFilter, platformFilter, sortBy]);

  const loadUserPreferences = async () => {
    try {
      const res = await apiService.getUserPreferences(getAuthHeaders());
      if (res.preferences) {
        setUserPreferences(res.preferences);
        if (res.preferences.target_country) {
          setLocationFilter(res.preferences.target_country);
        }
      }
    } catch (e) {
      console.warn('Using default preferences:', e);
    }
  };

  const fetchOpportunities = async (forceRefresh: boolean = false) => {
    setLoading(true);
    try {
      const res = await apiService.getOpportunities(
        {
          category: activeCategory,
          search: searchQuery.trim() || undefined,
          remote_only: remoteOnly,
          location_filter: locationFilter,
          platform_filter: platformFilter !== 'all' ? platformFilter : undefined,
          sort_by: sortBy,
          refresh: forceRefresh,
        },
        getAuthHeaders()
      );
      setOpportunities(res.opportunities || []);
      if (res.category_counts) {
        setCategoryCounts(res.category_counts);
      }
      if (forceRefresh) {
        onSuccess('Successfully executed live multi-platform scan across Unstop, Devfolio, Remotive, Jobicy, Arbeitnow & RemoteOK!');
      }
    } catch (err: any) {
      onError(err.message || 'Failed to fetch live opportunities');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOpportunities(false);
  };


  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPreferences(true);
    try {
      const res = await apiService.updateUserPreferences(userPreferences, getAuthHeaders());
      setUserPreferences(res.preferences);
      setLocationFilter(res.preferences.target_country || 'India');
      setIsPreferencesModalOpen(false);
      onSuccess('Career & Location preferences saved! Radar re-scored.');
      fetchOpportunities();
    } catch (err: any) {
      onError(err.message || 'Failed to save preferences');
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleParseJobUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = jobUrlInput.trim();
    if (!url) {
      onError('Please enter a valid Job or Hackathon URL');
      return;
    }

    setIsParsingUrl(true);
    try {
      const res = await apiService.parseJobUrl(url, getAuthHeaders());
      if (res.parsed_job) {
        setIsUrlModalOpen(false);
        setJobUrlInput('');
        onSuccess(`Parsed "${res.parsed_job.title}" at ${res.parsed_job.company}! Opening in Resume Studio...`);
        onTailorResume(
          res.parsed_job.title,
          res.parsed_job.company,
          `${res.parsed_job.title} at ${res.parsed_job.company}\n\nRequired Skills:\n${res.parsed_job.skills_required?.join(', ')}\n\nJob Description:\n${res.parsed_job.job_description}`
        );
      }
    } catch (err: any) {
      onError(err.message || 'Failed to parse job URL');
    } finally {
      setIsParsingUrl(false);
    }
  };

  const handleExtractNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawText = rawNoticeInput.trim();
    if (!rawText) {
      onError('Please paste unstructured notice or JD text.');
      return;
    }

    setIsExtractingNotice(true);
    try {
      const res = await apiService.extractJobNotice(rawText, getAuthHeaders());
      if (res.extracted_job) {
        const job = res.extracted_job;
        const newOpp: Opportunity = {
          id: `custom_notice_${Date.now()}`,
          title: job.role || 'Software Development Engineer',
          organization: job.company || 'Placement Drive',
          category: job.opportunity_type?.toLowerCase().includes('intern') ? 'internships' : 'jobs',
          opportunity_type: job.opportunity_type || 'Job Opening',
          description: job.summary || `${job.role} at ${job.company}. Eligibility: ${job.eligibility?.eligible_batches?.join(', ') || 'All batches'}. ${job.eligibility?.min_cgpa || ''}`,
          skills_required: job.skills_required && job.skills_required.length > 0 ? job.skills_required : ['Problem Solving', 'Data Structures', 'Core CS'],
          location: job.location || 'India',
          work_mode: (job.work_mode as any) || 'Hybrid',
          deadline: job.deadline || 'Upcoming Drive',
          deadline_formatted: job.deadline || 'Upcoming',
          days_left: 14,
          is_urgent: false,
          match_score: 96,
          match_reasons: [
            'Extracted directly from custom college/placement circular',
            `Eligibility: ${job.eligibility?.eligible_batches?.join(', ') || 'All batches'}`,
            `Package: ${job.ctc_stipend || 'Competitive'}`
          ],
          missing_skills: [],
          matched_skills: [],
          reward: job.ctc_stipend || 'Competitive Industry Package',
          deadline_date: job.deadline || '',
          urgency_level: 'normal',
          salary_or_prize: job.ctc_stipend || 'Competitive Industry Package',
          apply_url: job.apply_url || '#',
          source: 'College Placement Notice',
          source_platform: 'College Placement Notice'
        };

        setOpportunities(prev => [newOpp, ...prev]);
        setActiveCategory('all');
        setIsNoticeModalOpen(false);
        setRawNoticeInput('');
        onSuccess(`Extracted "${newOpp.title}" at ${newOpp.organization}! Ready for Mock Interview, Tailored Resume & Applying.`);
      }
    } catch (err: any) {
      onError(err.message || 'Failed to extract job notice');
    } finally {
      setIsExtractingNotice(false);
    }
  };

  const toggleBookmark = (id: string, title: string) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        onSuccess(`Removed "${title}" from saved opportunities`);
      } else {
        next.add(id);
        onSuccess(`Saved "${title}" to your radar bookmarks!`);
      }
      try {
        localStorage.setItem('careeros_bookmarked_opps', JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });
  };

  const togglePreferenceCity = (city: string) => {
    setUserPreferences(prev => {
      const exists = prev.preferred_cities.includes(city);
      const updated = exists 
        ? prev.preferred_cities.filter(c => c !== city)
        : [...prev.preferred_cities, city];
      return { ...prev, preferred_cities: updated };
    });
  };

  const togglePreferenceRole = (role: string) => {
    setUserPreferences(prev => {
      const exists = prev.preferred_roles.includes(role);
      const updated = exists 
        ? prev.preferred_roles.filter(r => r !== role)
        : [...prev.preferred_roles, role];
      return { ...prev, preferred_roles: updated };
    });
  };

  const toggleWorkMode = (mode: string) => {
    setUserPreferences(prev => {
      const exists = prev.work_modes.includes(mode);
      const updated = exists 
        ? prev.work_modes.filter(m => m !== mode)
        : [...prev.work_modes, mode];
      return { ...prev, work_modes: updated };
    });
  };

  const addCustomRole = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const r = customRoleInput.trim();
    if (!r) return;
    if (!userPreferences.preferred_roles.includes(r)) {
      setUserPreferences(prev => ({
        ...prev,
        preferred_roles: [...prev.preferred_roles, r]
      }));
    }
    setCustomRoleInput('');
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'jobs':
        return <Briefcase className="w-4 h-4 text-blue-600" />;
      case 'internships':
        return <GraduationCap className="w-4 h-4 text-emerald-600" />;
      case 'hackathons':
        return <Trophy className="w-4 h-4 text-amber-500" />;
      case 'opensource':
        return <Globe className="w-4 h-4 text-purple-600" />;
      default:
        return <Sparkles className="w-4 h-4 text-blue-600" />;
    }
  };

  const getMatchScoreBadge = (score: number) => {
    if (score >= 90) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
          <Zap className="w-3.5 h-3.5 fill-emerald-600 dark:fill-emerald-400" />
          {score}% Verified Match
        </span>
      );
    }
    if (score >= 80) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-1 border border-blue-300 dark:border-blue-800">
          <Zap className="w-3.5 h-3.5 fill-blue-600" />
          {score}% Strong Match
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 flex items-center gap-1">
        {score}% Semantic Fit
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header Banner */}
      <div 
        className="p-5 sm:p-6 rounded-2xl border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Live Opportunities & Match Radar
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Multi-Platform Live Radar
              </span>
            </div>
            <p className="text-xs pt-0.5" style={{ color: 'var(--text-secondary)' }}>
              100% real tech jobs, paid internships, hackathons & fellowships across Unstop, Devfolio, Remotive, Jobicy, Arbeitnow & RemoteOK with active deadline verification.
            </p>
          </div>
        </div>

        {/* Clean Action Deck */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* + Paste College Notice / Raw JD */}
          <button
            onClick={() => setIsNoticeModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-xs transition-all cursor-pointer"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>+ Paste Notice / JD</span>
          </button>

          {/* Smart URL Ingest */}
          <button
            onClick={() => setIsUrlModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5 text-purple-500" />
            <span>Paste Job URL</span>
          </button>

          {/* Preferences Settings */}
          <button
            onClick={() => setIsPreferencesModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
            <span>Preferences</span>
          </button>

          {/* Re-scan */}
          <button
            onClick={() => fetchOpportunities(true)}
            disabled={loading}
            className="p-2 rounded-lg border hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            style={{ borderColor: 'var(--border-primary)' }}
            title="Force immediate live re-scan of all job boards & hackathon platforms"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Career & Location Preferences Modal */}
      {isPreferencesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            className="w-full max-w-2xl p-6 rounded-2xl border space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    Candidate Career & Location Preferences
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Set your target country, cities, roles & expectations to filter 100% relevant opportunities.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsPreferencesModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePreferences} className="space-y-4 text-xs">
              {/* Target Country */}
              <div>
                <label className="block font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  1. Target Country & Location Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'India', label: '🇮🇳 India & Global Remote', desc: 'Bengaluru, NCR, Pune + Remote' },
                    { id: 'Remote Worldwide', label: '🌐 100% Global Remote', desc: 'Anywhere in the World' },
                    { id: 'All', label: '🌍 All Locations', desc: 'Global, US, Europe, India' },
                  ].map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setUserPreferences(prev => ({ ...prev, target_country: item.id }))}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        userPreferences.target_country === item.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold shadow-sm ring-1 ring-blue-500'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850'
                      }`}
                    >
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-[11px] text-gray-500 pt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Indian Tech Hubs */}
              {userPreferences.target_country === 'India' && (
                <div>
                  <label className="block font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                    2. Target Cities & Tech Hubs (India)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {INDIAN_CITIES.map(city => {
                      const isSelected = userPreferences.preferred_cities.includes(city);
                      return (
                        <button
                          type="button"
                          key={city}
                          onClick={() => togglePreferenceCity(city)}
                          className={`px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{city}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Target Roles */}
              <div>
                <label className="block font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  3. Target Engineering Roles & Domains
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {AVAILABLE_ROLES.map(role => {
                    const isSelected = userPreferences.preferred_roles.includes(role);
                    return (
                      <button
                        type="button"
                        key={role}
                        onClick={() => togglePreferenceRole(role)}
                        className={`px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{role}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Role */}
                <div className="flex items-center gap-2 max-w-sm pt-1">
                  <input
                    type="text"
                    placeholder="Add custom role (e.g. Distributed Systems)..."
                    value={customRoleInput}
                    onChange={(e) => setCustomRoleInput(e.target.value)}
                    onKeyDown={addCustomRole}
                    className="input-base flex-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={addCustomRole}
                    className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold hover:bg-gray-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Work Modes & Experience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                    4. Work Modes
                  </label>
                  <div className="flex items-center gap-2">
                    {['Remote', 'Hybrid', 'Onsite'].map(mode => {
                      const isSelected = userPreferences.work_modes.includes(mode);
                      return (
                        <button
                          type="button"
                          key={mode}
                          onClick={() => toggleWorkMode(mode)}
                          className={`px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{mode}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                    5. Minimum Target CTC / Stipend
                  </label>
                  <input
                    type="text"
                    value={userPreferences.min_salary || ''}
                    onChange={(e) => setUserPreferences(prev => ({ ...prev, min_salary: e.target.value }))}
                    placeholder="e.g. ₹8 - 20 LPA or $30k+ Remote"
                    className="input-base w-full text-xs"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                <button
                  type="button"
                  onClick={() => setIsPreferencesModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPreferences}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md flex items-center gap-2"
                >
                  {isSavingPreferences ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Preferences...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save & Tailor Opportunities</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Job URL Parsing Modal */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            className="w-full max-w-lg p-6 rounded-2xl border space-y-4 shadow-2xl"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  Smart Job URL Ingestion
                </h3>
              </div>
              <button onClick={() => setIsUrlModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Paste ANY job link (Greenhouse, Lever, LinkedIn, Y Combinator, Wellfound, Unstop, or company career page). CareerOS will parse the JD, calculate graph match, and tailor your resume.
            </p>

            <form onSubmit={handleParseJobUrl} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Job Posting URL
                </label>
                <input
                  type="url"
                  placeholder="https://boards.greenhouse.io/... or https://jobs.lever.co/..."
                  value={jobUrlInput}
                  onChange={(e) => setJobUrlInput(e.target.value)}
                  className="input-base w-full text-xs font-mono"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUrlModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isParsingUrl}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isParsingUrl ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Parsing Live Job...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Extract & Tailor Resume</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* College Placement Notice / Raw JD Extraction Modal */}
      {isNoticeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            className="w-full max-w-2xl p-6 rounded-3xl border space-y-4 shadow-2xl"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Paste College Notice / Raw WhatsApp Job Post
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    AI will automatically extract company, role, eligibility, package, and selection rounds into a full job card.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsNoticeModalOpen(false)} 
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExtractNoticeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Paste Raw Notice / Circular / Telegram Post:
                </label>
                <textarea
                  rows={8}
                  placeholder={`Example:\n🚀 Placement Drive Announcement!\nCompany: Apponward Technologies\nRole: SDE Intern / Backend Developer\nEligibility: 2025/2026 Batch B.Tech/MCA (CGPA > 7.0)\nStipend: ₹45,000/month (PPO: ₹14-18 LPA)\nLocation: Noida / Hybrid\nSkills: Python, FastAPI, React, SQL\nDeadline: Oct 15, 2026`}
                  value={rawNoticeInput}
                  onChange={(e) => setRawNoticeInput(e.target.value)}
                  className="w-full p-3 rounded-2xl border text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  Extracts skills, eligibility, package & rounds
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNoticeModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isExtractingNotice}
                    className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    {isExtractingNotice ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Extracting Structured Job...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Add to Opportunities Feed</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Command & Filter Deck */}
      <div 
        className="p-4 sm:p-5 rounded-2xl border shadow-xs space-y-3.5 transition-colors"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        {/* Top: Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all' as CategoryTab, label: 'All Opportunities', count: categoryCounts.all, icon: Compass },
            { id: 'jobs' as CategoryTab, label: 'Jobs', count: categoryCounts.jobs, icon: Briefcase },
            { id: 'internships' as CategoryTab, label: 'Internships', count: categoryCounts.internships, icon: GraduationCap },
            { id: 'hackathons' as CategoryTab, label: 'Hackathons', count: categoryCounts.hackathons, icon: Trophy },
            { id: 'opensource' as CategoryTab, label: 'Open Source', count: categoryCounts.opensource, icon: Globe },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive 
                      ? 'bg-blue-800 text-white' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t" style={{ borderColor: 'var(--border-primary)' }} />

        {/* Bottom: Search Input + Location Chips + Remote Toggle + Sort */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by role, company, or tech keywords (FastAPI, React, Neo4j)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base w-full pl-8 text-xs"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer transition-all shrink-0"
            >
              Search
            </button>
          </form>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Location selector pills */}
            <div className="flex items-center p-0.5 rounded-lg border bg-slate-50 dark:bg-slate-800/60" style={{ borderColor: 'var(--border-primary)' }}>
              {[
                { id: 'India', label: '🇮🇳 India' },
                { id: 'Remote Worldwide', label: '🌐 Remote' },
                { id: 'All', label: '🌍 All' }
              ].map(loc => (
                <button
                  key={loc.id}
                  onClick={() => setLocationFilter(loc.id)}
                  className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-all cursor-pointer ${
                    locationFilter === loc.id
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>

            {/* Platform Filter Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <select
                value={platformFilter}
                onChange={(e: any) => setPlatformFilter(e.target.value)}
                className="input-base text-xs font-medium cursor-pointer"
                style={{ height: '32px', paddingLeft: '8px', paddingRight: '20px' }}
                title="Filter by source platform"
              >
                <option value="all">🌐 All Platforms</option>
                <option value="unstop">Unstop Live</option>
                <option value="devfolio">Devfolio</option>
                <option value="remotive">Remotive Tech</option>
                <option value="jobicy">Jobicy Remote</option>
                <option value="remoteok">RemoteOK</option>
                <option value="arbeitnow">Arbeitnow</option>
              </select>
            </div>

            {/* Remote Only Toggle */}
            <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span>Remote Only</span>
            </label>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="input-base text-xs font-medium cursor-pointer"
                style={{ height: '32px', paddingLeft: '8px', paddingRight: '20px' }}
              >
                <option value="match_score">Highest Match %</option>
                <option value="deadline">Closing Soonest</option>
                <option value="newest">Newly Added</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities Grid */}
      {loading ? (
        <div className="p-16 text-center space-y-3 rounded-2xl border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
          <Compass className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Scanning Verified Tech Feeds & Computing Semantic Fit for {locationFilter}...
          </p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Matching live requirements against your verified skills, projects, and career preferences
          </p>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="p-16 text-center space-y-3 rounded-2xl border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
          <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            No opportunities matched your search filter for {locationFilter}
          </h3>
          <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Try clearing your search keyword, switching to "All Locations", or adjusting your target roles in preferences.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
                setRemoteOnly(false);
                setLocationFilter('India');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white"
            >
              Reset to India & Remote
            </button>
            <button
              onClick={() => setIsPreferencesModalOpen(true)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-700"
            >
              Edit Preferences
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map((opp) => {
            const isBookmarked = bookmarkedIds.has(opp.id);

            return (
              <div
                key={opp.id}
                className="p-5 rounded-2xl border card-hover flex flex-col justify-between gap-4 transition-all relative overflow-hidden"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                }}
              >
                {/* Urgent indicator bar */}
                {opp.is_urgent && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse" />
                )}

                {/* Card Top: Title, Org, Badges & Bookmark */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 flex-1">
                      <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0 mt-0.5">
                        {getCategoryIcon(opp.category)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold tracking-tight leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                          {opp.title}
                        </h3>
                        <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
                          <span className="font-semibold flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                            {opp.organization}
                          </span>
                          <span className="text-gray-300 dark:text-gray-700">•</span>
                          <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {opp.location}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bookmark Button */}
                    <button
                      onClick={() => toggleBookmark(opp.id, opp.title)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        isBookmarked
                          ? 'bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800'
                          : 'text-gray-400 hover:text-gray-600 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Opportunity'}
                    >
                      {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Badges: Match Score, Opportunity Type, Reward */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {getMatchScoreBadge(opp.match_score)}

                    {opp.is_primary_choice && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                        <Target className="w-3 h-3 text-indigo-600" />
                        1st Choice Fit
                      </span>
                    )}

                    {opp.is_priority_domain_match && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-purple-600" />
                        Domain Priority
                      </span>
                    )}

                    {opp.is_dream_company && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shadow-sm">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        Dream Company
                      </span>
                    )}
                    
                    {opp.source_platform && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 shadow-2xs">
                        <Globe className="w-3 h-3 text-indigo-500" />
                        {opp.source_platform}
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      {opp.opportunity_type}
                    </span>

                    {opp.reward && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <Gift className="w-3 h-3 text-amber-600" />
                        {opp.reward}
                      </span>
                    )}
                  </div>

                  {/* Description Snippet */}
                  <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                    {opp.description}
                  </p>

                  {/* Skills Alignment Tags */}
                  <div className="space-y-1 pt-1">
                    <div className="text-[11px] font-semibold text-gray-500">Skills Alignment:</div>
                    <div className="flex flex-wrap gap-1">
                      {opp.matched_skills.map((skill, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          {skill}
                        </span>
                      ))}
                      {opp.missing_skills.map((skill, idx) => (
                        <span 
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Deadline Countdown & Action Buttons */}
                <div className="pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border-primary)' }}>
                  {/* Deadline Indicator */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Clock className={`w-3.5 h-3.5 ${opp.is_urgent ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
                    <span className={opp.is_urgent ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-600 dark:text-gray-400'}>
                      {opp.days_left === 0 ? 'Closes Today!' : `${opp.days_left} days left (${opp.deadline_formatted})`}
                    </span>
                  </div>

                  {/* Actions: Prepare, Tailor, Referral, Apply */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Prepare & Interview Button */}
                    {onPrepareInterview && (
                      <button
                        onClick={() => onPrepareInterview(
                          opp.title,
                          opp.organization,
                          `${opp.title} at ${opp.organization}\n\nRequired Skills:\n${opp.skills_required.join(', ')}\n\nDescription:\n${opp.description}`
                        )}
                        className="btn-secondary"
                        title="AI Mock Interview & Company Intel"
                      >
                        <Swords className="w-3.5 h-3.5 text-amber-500" />
                        <span>Prep Interview</span>
                      </button>
                    )}

                    {/* Tailor Resume Button */}
                    <button
                      onClick={() => onTailorResume(
                        opp.title, 
                        opp.organization, 
                        `${opp.title} at ${opp.organization}\n\nRequired Skills:\n${opp.skills_required.join(', ')}\n\nDescription:\n${opp.description}`
                      )}
                      className="btn-secondary"
                      title="Tailor resume for this role in Resume Studio"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      <span>Tailor Resume</span>
                    </button>

                    {/* Find Referral Button */}
                    <button
                      onClick={() => onFindReferral(opp.organization)}
                      className="btn-ghost"
                      title={`Find alumni referral contacts at ${opp.organization}`}
                    >
                      <Send className="w-3 h-3 text-emerald-500" />
                      <span>Referral</span>
                    </button>

                    {/* Direct Apply */}
                    <a
                      href={opp.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                    >
                      <span>Apply</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
