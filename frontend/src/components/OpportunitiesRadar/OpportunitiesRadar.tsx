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
  X
} from 'lucide-react';
import { Opportunity } from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface OpportunitiesRadarProps {
  onTailorResume: (role: string, company: string, jd: string) => void;
  onFindReferral: (company: string) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

type CategoryTab = 'all' | 'jobs' | 'internships' | 'hackathons' | 'opensource';

export const OpportunitiesRadar: React.FC<OpportunitiesRadarProps> = ({
  onTailorResume,
  onFindReferral,
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
  const [sortBy, setSortBy] = useState<'match_score' | 'deadline' | 'newest'>('match_score');
  
  // Smart Job URL Ingestion Modal
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [jobUrlInput, setJobUrlInput] = useState('');
  const [isParsingUrl, setIsParsingUrl] = useState(false);

  // Bookmarked Opportunities
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('careeros_bookmarked_opps');
      if (saved) {
        setBookmarkedIds(new Set(JSON.parse(saved)));
      }
    } catch (e) {
      console.warn(e);
    }
    fetchOpportunities();
  }, [activeCategory, remoteOnly, sortBy]);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const res = await apiService.getOpportunities(
        {
          category: activeCategory,
          search: searchQuery.trim() || undefined,
          remote_only: remoteOnly,
          sort_by: sortBy,
        },
        getAuthHeaders()
      );
      setOpportunities(res.opportunities || []);
      if (res.category_counts) {
        setCategoryCounts(res.category_counts);
      }
    } catch (err: any) {
      onError(err.message || 'Failed to fetch live opportunities');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOpportunities();
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
        className="p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Live Opportunities & Semantic Match Radar
              </h2>
              <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live APIs (Arbeitnow, Jobicy, Unstop)
              </span>
            </div>
            <p className="text-xs pt-1" style={{ color: 'var(--text-secondary)' }}>
              Real-time verified developer jobs, internships, Unstop hackathons & open source fellowships scored live against your verified skills
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Smart URL Ingest Button */}
          <button
            onClick={() => setIsUrlModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-all shadow-sm"
          >
            <Link2 className="w-3.5 h-3.5 text-purple-600" />
            <span>Paste Job URL</span>
          </button>

          <button
            onClick={fetchOpportunities}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Live Feeds</span>
          </button>
        </div>
      </div>

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

      {/* Category Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'all' as CategoryTab, label: 'All Opportunities', count: categoryCounts.all, icon: Compass },
          { id: 'jobs' as CategoryTab, label: 'Live Developer Jobs', count: categoryCounts.jobs, icon: Briefcase },
          { id: 'internships' as CategoryTab, label: 'Paid Internships', count: categoryCounts.internships, icon: GraduationCap },
          { id: 'hackathons' as CategoryTab, label: 'Hackathons & Challenges', count: categoryCounts.hackathons, icon: Trophy },
          { id: 'opensource' as CategoryTab, label: 'Open Source & Bounties', count: categoryCounts.opensource, icon: Globe },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
                isActive 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-102' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-800'
              }`}
              style={{
                backgroundColor: isActive ? undefined : 'var(--bg-primary)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-blue-800 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      <div 
        className="p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by role, company, or tech keywords (e.g. FastAPI, Neo4j, Python, React)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base w-full pl-9 text-xs"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {/* Remote Only Toggle */}
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>100% Remote / Virtual</span>
          </label>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 text-xs">
            <span style={{ color: 'var(--text-tertiary)' }}>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="input-base text-xs font-medium"
              style={{ height: '34px' }}
            >
              <option value="match_score">Highest Graph Match %</option>
              <option value="deadline">Closing Soonest (Deadlines)</option>
              <option value="newest">Newly Added</option>
            </select>
          </div>
        </div>
      </div>

      {/* Opportunities Grid */}
      {loading ? (
        <div className="p-16 text-center space-y-3 rounded-2xl border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
          <Compass className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Scanning Live APIs (Arbeitnow, Jobicy, Unstop) & Computing Semantic Fit...
          </p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Matching live requirements against your verified skills, projects, and defense prototypes
          </p>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="p-16 text-center space-y-3 rounded-2xl border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
          <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            No opportunities matched your search filter
          </h3>
          <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Try clearing the search query or selecting "All Opportunities" to see all live developer jobs, hackathons, and fellowships.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
              setRemoteOnly(false);
            }}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {opportunities.map((opp) => {
            const isBookmarked = bookmarkedIds.has(opp.id);

            return (
              <div
                key={opp.id}
                className="p-5 rounded-2xl border card-hover flex flex-col justify-between gap-4 transition-all"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                }}
              >
                {/* Card Top: Type, Org, Match Score, Bookmark */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                        {getCategoryIcon(opp.category)}
                      </span>
                      <span className="text-[11px] font-bold font-mono uppercase px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {opp.opportunity_type}
                      </span>
                      {opp.verified && (
                        <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                          <ShieldCheck className="w-3.5 h-3.5" /> Verified
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {getMatchScoreBadge(opp.match_score)}
                      <button
                        onClick={() => toggleBookmark(opp.id, opp.title)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title={isBookmarked ? 'Remove Bookmark' : 'Save Opportunity'}
                      >
                        {isBookmarked ? (
                          <BookmarkCheck className="w-4 h-4 text-amber-500 fill-amber-500" />
                        ) : (
                          <Bookmark className="w-4 h-4 text-gray-400 hover:text-amber-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Title & Organization */}
                  <div>
                    <h3 className="text-base font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                      {opp.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold pt-1" style={{ color: 'var(--text-secondary)' }}>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        {opp.organization}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-600" />
                        {opp.location}
                      </span>
                    </div>
                  </div>

                  {/* Reward / Salary / Stipend Tag */}
                  {opp.reward && (
                    <div className="p-2.5 rounded-xl border bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 flex items-center gap-2 text-xs">
                      <Gift className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">
                        {opp.reward}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {opp.description}
                  </p>

                  {/* Semantic Skills Tag Pill Matrix */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-gray-400">
                      Semantic Skills Alignment
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {opp.matched_skills.map((skill, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-0.5 border border-emerald-300 dark:border-emerald-800"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {skill}
                        </span>
                      ))}
                      {opp.missing_skills.map((skill, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Deadlines & Action Bridges */}
                <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                  {/* Deadline Indicator */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Clock className={`w-3.5 h-3.5 ${opp.is_urgent ? 'text-red-500 animate-pulse' : 'text-blue-600'}`} />
                      <span style={{ color: opp.is_urgent ? '#EF4444' : 'var(--text-secondary)' }}>
                        {opp.is_urgent ? `⏳ Urgent: ${opp.days_left} Days Left` : `📅 Apply by ${opp.deadline_formatted}`}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-gray-400">
                      Via {opp.source_platform}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <a
                      href={opp.apply_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center gap-1.5 transition-all text-center"
                    >
                      <span>Direct Apply</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => onTailorResume(
                        opp.title,
                        opp.organization,
                        `${opp.title} at ${opp.organization}\n\nRequirements:\n${opp.skills_required.join(', ')}\n\nDetails:\n${opp.description}`
                      )}
                      className="py-2 px-3 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 flex items-center gap-1 transition-all"
                      title="Auto-load this role and JD into Resume Studio"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      <span>Tailor Resume</span>
                    </button>

                    <button
                      onClick={() => onFindReferral(opp.organization)}
                      className="py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                      style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                      title="Find Alumni & Connections for Referral"
                    >
                      <Send className="w-3.5 h-3.5 text-blue-600" />
                    </button>
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
