import { WorkspacePageHeader, WorkspaceMetrics, WorkspaceSectionHeading, WorkspaceEmptyState } from '../WorkspaceUI';
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Rocket, 
  Target, 
  Zap, 
  BarChart3, 
  RefreshCw, 
  CheckCircle2, 
  Code2, 
  BookOpen, 
  BadgeCheck, 
  Flame, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  Layers,
  ArrowUpRight,
  Clock,
  Compass,
  Check,
  Building2,
  FolderGit2,
  Brain
} from 'lucide-react';
import { 
  UserProfileDetails, 
  MarketIntelligenceResponse, 
  HighRoiUnlockSkill, 
  MarketDemandSkill 
} from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { NoteGPTSkillStudio } from './NoteGPTSkillStudio';
import { SalaryOutlook } from './SalaryOutlook';

interface CareerGrowthHubProps {
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const CareerGrowthHub: React.FC<CareerGrowthHubProps> = ({
  onSuccessToast,
  onErrorToast,
  onNavigateToTab
}) => {
  const { getAuthHeaders } = useAuth();
  const [profile, setProfile] = useState<UserProfileDetails | null>(null);
  const [marketIntel, setMarketIntel] = useState<MarketIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [learningActionLoading, setLearningActionLoading] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'unlocks' | 'sprints' | 'demands' | 'boom' | 'notegpt' | 'salary'>('unlocks');
  const [noteGPTSkill, setNoteGPTSkill] = useState<string>('Apache Kafka & Event Streaming');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const openNoteGPTStudio = (skillName: string) => {
    setNoteGPTSkill(skillName);
    setActiveSubTab('notegpt');
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profileRes, intelRes] = await Promise.all([
        apiService.getProfileDetails(getAuthHeaders()).catch(() => ({ profile: null })),
        apiService.getMarketIntelligence(getAuthHeaders()).catch(() => null)
      ]);
      if (profileRes.profile) setProfile(profileRes.profile);
      if (intelRes) setMarketIntel(intelRes);
    } catch (err: any) {
      console.warn('Error loading Career Growth data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const intelRes = await apiService.getMarketIntelligence(getAuthHeaders());
      setMarketIntel(intelRes);
      onSuccessToast('Market Demand Graph rescanned with live job requirement feeds!');
    } catch (err: any) {
      onErrorToast('Failed to refresh market intelligence');
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleLearningAction = async (skillName: string, action: 'start_learning' | 'mark_mastered' | 'remove') => {
    setLearningActionLoading(skillName);
    try {
      const res = await apiService.toggleLearningAction(skillName, action, getAuthHeaders());
      if (action === 'mark_mastered') {
        onSuccessToast(res.message || `🎉 Verified '${skillName}' in your Profile Graph! Radar match scores recalculated.`);
      } else if (action === 'start_learning') {
        onSuccessToast(res.message || `Added '${skillName}' to your active 2-Week Learning Sprint!`);
      } else if (action === 'remove') {
        onSuccessToast(`Removed '${skillName}' from active sprint.`);
      }

      // Reload fresh data from backend
      const [profileRes, intelRes] = await Promise.all([
        apiService.getProfileDetails(getAuthHeaders()),
        apiService.getMarketIntelligence(getAuthHeaders())
      ]);
      if (profileRes.profile) setProfile(profileRes.profile);
      if (intelRes) setMarketIntel(intelRes);
    } catch (err: any) {
      onErrorToast(err.message || 'Action failed');
    } finally {
      setLearningActionLoading(null);
    }
  };

  const inProgressSkills = profile?.preferences?.in_progress_skills || [];
  const userSkills = profile?.skills || [];
  const targetRole = profile?.preferences?.primary_role || 'your target role';
  const targetDomain = profile?.preferences?.priority_domain || 'your preferred domain';

  const unlocksList = marketIntel?.market_summary?.high_roi_unlocks || [];
  const activeSprintsList = unlocksList.filter(item => 
    inProgressSkills.some(s => s.toLowerCase().includes(item.skill.split(' ')[0].toLowerCase()))
  );

  const categories = ['all', ...Array.from(new Set(unlocksList.map(u => u.category)))];
  const filteredUnlocks = categoryFilter === 'all' 
    ? unlocksList 
    : unlocksList.filter(u => u.category === categoryFilter);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Finding the most useful skills for your next role…
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-view ws-page dashboard-view--growth space-y-6 pb-20 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Hero Banner */}
      <WorkspacePageHeader page="growth" eyebrow="GROW WITH INTENTION" title="Build the skills for your next chapter." description="Turn market demand into practical projects and manageable learning sprints, shaped around your career goals." actions={<button className="dashboard-button dashboard-button-primary" onClick={handleRefresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Rescanning…' : 'Rescan market'}</button>} />
      <WorkspaceMetrics items={[{label:"Market readiness",value:marketIntel?.user_readiness_score != null ? marketIntel.user_readiness_score + "%" : "—",detail:marketIntel ? "Based on your latest market analysis" : "Run an analysis to see your readiness",icon:BarChart3},{label:"Skill opportunities",value:unlocksList.length,detail:"Capabilities with a project to build",icon:Zap,tone:"amber"},{label:"Active sprints",value:activeSprintsList.length,detail:"Skills you are currently developing",icon:Clock,tone:"violet"},{label:"Roles analysed",value:marketIntel?.analyzed_jobs_count ?? "—",detail:"Job requirements behind your insights",icon:Building2,tone:"teal"}]} />
      <div className="ws-context-strip"><span>Target role <strong>{targetRole}</strong></span><span>Domain <strong>{targetDomain}</strong></span>{profile?.preferences.career_goals?.target_milestone && <span>Goal <strong>{profile.preferences.career_goals.target_milestone}</strong></span>}</div>
        <div className="ws-tabbar">
          <button aria-pressed={activeSubTab === 'salary'} onClick={() => setActiveSubTab('salary')} className="">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
            <span>CTC outlook</span>
          </button>
          <button
            aria-pressed={activeSubTab === 'unlocks'} onClick={() => setActiveSubTab('unlocks')}
            className=""
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Skill opportunities ({unlocksList.length})</span>
          </button>

          <button
            aria-pressed={activeSubTab === 'sprints'} onClick={() => setActiveSubTab('sprints')}
            className=""
          >
            <Clock className="w-3.5 h-3.5 text-purple-300" />
            <span>My learning sprints ({activeSprintsList.length})</span>
          </button>

          <button
            aria-pressed={activeSubTab === 'demands'} onClick={() => setActiveSubTab('demands')}
            className=""
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
            <span>Market demand</span>
          </button>

          <button
            aria-pressed={activeSubTab === 'boom'} onClick={() => setActiveSubTab('boom')}
            className=""
          >
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Emerging skills</span>
          </button>

          <button
            onClick={() => setActiveSubTab('notegpt')}
            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
              activeSubTab === 'notegpt'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg scale-102 ring-2 ring-purple-400/50'
                : 'bg-purple-950/60 text-purple-200 hover:bg-purple-900/60 border border-purple-500/40'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
            <span>NoteGPT Skill Studio (Mindmaps & Proofs)</span>
            <span className="px-1.5 py-0.2 text-[9px] bg-purple-400 text-slate-950 rounded font-black">NEW</span>
          </button>
        </div>

      {activeSubTab === 'salary' && <SalaryOutlook profile={profile} marketIntel={marketIntel} />}

      {!marketIntel && <section className="dashboard-data-empty" role="status"><span className="dashboard-soft-icon is-blue"><TrendingUp size={21} /></span><div><h2>Your growth plan starts with market insight</h2><p>Rescan the market to find skill gaps and learning sprints for your career goals.</p></div><button className="dashboard-button" onClick={handleRefresh} disabled={refreshing}><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Rescanning…' : 'Rescan market'}</button></section>}

      {/* VIEW 1: High-ROI Skill Unlockers */}
      {activeSubTab === 'unlocks' && (
        <div className="space-y-6">
          {/* Controls Bar & Categories */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Projects that move you forward
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Choose a focused project to practise a skill and create evidence for your next application.
              </p>
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all border ${
                    categoryFilter === cat
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  style={{
                    backgroundColor: categoryFilter === cat ? undefined : 'var(--bg-primary)',
                    color: categoryFilter === cat ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Cards List */}
          <div className="grid grid-cols-1 gap-6">
            {filteredUnlocks.map((item, idx) => {
              const isInProgress = inProgressSkills.some(
                s => s.toLowerCase().includes(item.skill.split(' ')[0].toLowerCase())
              );
              const isMastered = userSkills.some(
                s => s.toLowerCase().includes(item.skill.split(' ')[0].toLowerCase())
              );
              const isActionLoading = learningActionLoading === item.skill;

              return (
                <div
                  key={idx}
                  className={`p-6 rounded-3xl border space-y-5 transition-all shadow-sm ${
                    isInProgress 
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/10' 
                      : ''
                  }`}
                  style={{ 
                    backgroundColor: isInProgress ? undefined : 'var(--bg-primary)', 
                    borderColor: isInProgress ? undefined : 'var(--border-primary)' 
                  }}
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border-primary)' }}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                          {item.skill}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {item.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.priority === 'Critical' 
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {item.priority} Impact
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        In high demand across top engineering and infrastructure teams.
                      </p>
                    </div>

                    {/* Impact Metrics */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="p-2 px-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs shadow-xs">
                        <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                          Market Unlock
                        </span>
                        <span className="font-black text-emerald-800 dark:text-emerald-200">
                          +{item.unlocked_jobs_count} High-Match Jobs
                        </span>
                      </div>

                      <div className="p-2 px-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs shadow-xs">
                        <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                          Avg CTC Impact
                        </span>
                        <span className="font-black text-blue-800 dark:text-blue-200">
                          {item.avg_ctc_impact}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Blueprint & Sprint Dual Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Project Blueprint */}
                    <div 
                      className="p-4 sm:p-5 rounded-2xl border space-y-3"
                      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                    >
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                        <Code2 className="w-4 h-4" />
                        <span>A project to build</span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {item.recommended_project.title}
                      </h4>

                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {item.recommended_project.description}
                      </p>

                      {/* Tech Stack Chips */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {item.recommended_project.tech_stack.map((tech, tIdx) => (
                          <span
                            key={tIdx}
                            className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>

                      {/* Deliverables */}
                      <div className="space-y-1.5 pt-2.5 border-t text-xs" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                        <span className="font-bold block text-[10px] uppercase tracking-wider text-gray-400">
                          Verification Deliverables (For GitHub / Resume):
                        </span>
                        {item.recommended_project.deliverables.map((del, dIdx) => (
                          <div key={dIdx} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{del}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 2-Week Sprint Guide & Action Box */}
                    <div 
                      className="p-4 sm:p-5 rounded-2xl border space-y-3 flex flex-col justify-between"
                      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                            <BookOpen className="w-4 h-4" />
                            <span>{item.learning_sprint.duration} Sprint</span>
                          </span>
                          <span className="text-[10px] font-semibold text-gray-400">
                            Target: ~5 hours/week
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-1 shadow-xs">
                            <span className="font-bold text-[10px] uppercase tracking-wider text-purple-600 block">
                              Week 1: Core Concepts & Architecture
                            </span>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {item.learning_sprint.week1_focus}
                            </p>
                          </div>

                          <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-1 shadow-xs">
                            <span className="font-bold text-[10px] uppercase tracking-wider text-blue-600 block">
                              Week 2: Implementation & Stress Testing
                            </span>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              {item.learning_sprint.week2_focus}
                            </p>
                          </div>
                        </div>

                        {/* Core Concepts */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {item.learning_sprint.key_concepts.map((concept, cIdx) => (
                            <span
                              key={cIdx}
                              className="px-2.5 py-0.5 rounded-lg text-[10px] font-medium bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                            >
                              {concept}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Action CTAs */}
                      <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--border-primary)' }}>
                        <button
                          type="button"
                          onClick={() => openNoteGPTStudio(item.skill)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-300 dark:border-purple-800 transition-all flex items-center gap-1.5 shadow-xs"
                          title="Open NoteGPT Mind Map, Roadmap, and Verified Course Proofs"
                        >
                          <Brain className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>NoteGPT Mindmap & Proofs</span>
                        </button>

                        <div className="flex items-center gap-2">
                        {isInProgress ? (
                          <>
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleToggleLearningAction(item.skill, 'remove')}
                              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-red-500 transition-all"
                            >
                              Cancel Sprint
                            </button>
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleToggleLearningAction(item.skill, 'mark_mastered')}
                              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-md flex items-center gap-1.5 transition-all"
                            >
                              {isActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              <span>I Built This Project — Verify in Graph</span>
                            </button>
                          </>
                        ) : isMastered ? (
                          <span className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                            <BadgeCheck className="w-4 h-4 text-emerald-600" />
                            <span>Verified in Your Graph & Radar</span>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleToggleLearningAction(item.skill, 'mark_mastered')}
                              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 border border-emerald-300 transition-all"
                            >
                              Already Know This
                            </button>
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleToggleLearningAction(item.skill, 'start_learning')}
                              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 shadow-md flex items-center gap-1.5 transition-all"
                            >
                              {isActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                              <span>Start 2-Week Learning Sprint</span>
                            </button>
                          </>
                        )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: Active Learning Sprints */}
      {activeSubTab === 'sprints' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Active Learning & Project Sprints ({activeSprintsList.length})
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Skills and systems you are actively implementing. Mark them as built to recalculate your Opportunity Radar match scores!
              </p>
            </div>
          </div>

          {activeSprintsList.length === 0 ? (
            <div 
              className="p-12 text-center rounded-3xl border border-dashed space-y-3"
              style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
            >
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 w-fit mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                No Active Sprints Right Now
              </h3>
              <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Browse the <strong>High-ROI Skill Unlockers</strong> tab and click "Start 2-Week Learning Sprint" on any technology you want to build.
              </p>
              <button
                onClick={() => setActiveSubTab('unlocks')}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm"
              >
                Browse High-ROI Skills
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {activeSprintsList.map((item, idx) => (
                <div
                  key={idx}
                  className="p-6 rounded-3xl border space-y-4 shadow-sm relative overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {item.category}
                      </span>
                      <h3 className="text-base font-bold pt-1" style={{ color: 'var(--text-primary)' }}>
                        {item.skill}
                      </h3>
                      <p className="text-xs text-gray-500 pt-0.5">
                        +{item.unlocked_jobs_count} High-Match Jobs • {item.avg_ctc_impact}
                      </p>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1 animate-pulse">
                      <Zap className="w-3 h-3" />
                      In Sprint
                    </span>
                  </div>

                  {/* Project Summary */}
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                    <span className="font-bold block" style={{ color: 'var(--text-primary)' }}>
                      {item.recommended_project.title}
                    </span>
                    <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {item.recommended_project.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 flex items-center justify-between gap-2 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleLearningAction(item.skill, 'remove')}
                        className="text-xs font-semibold text-gray-400 hover:text-red-500"
                      >
                        Cancel Sprint
                      </button>
                      <button
                        onClick={() => openNoteGPTStudio(item.skill)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 border border-purple-300 dark:border-purple-800 flex items-center gap-1.5 transition-all shadow-xs"
                      >
                        <Brain className="w-3.5 h-3.5 text-purple-600" />
                        <span>Roadmap & Certs</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleToggleLearningAction(item.skill, 'mark_mastered')}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Built & Verify in Graph</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: Live Skill Demand Meter */}
      {activeSubTab === 'demands' && (
        <div 
          className="p-6 rounded-3xl border space-y-6 shadow-sm"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Live Skill Frequency Distribution Across Active Jobs
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Extracted from active job requirements matching <strong>{targetRole}</strong> in India & Remote Worldwide.
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-400">
              {marketIntel?.market_summary?.top_demanded_skills?.length || 0} Key Skills Tracked
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(marketIntel?.market_summary?.top_demanded_skills || []).map((sk, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border flex flex-col justify-between gap-3 text-xs transition-all hover:border-blue-400"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold truncate text-sm" style={{ color: 'var(--text-primary)' }}>
                    {sk.skill}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    sk.status === 'mastered'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : sk.status === 'in_progress'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {sk.status === 'mastered' ? '✓ Mastered' : (sk.status === 'in_progress' ? '⚡ In Sprint' : 'Missing')}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                    <span>Market Demand:</span>
                    <span className="font-bold font-mono text-gray-800 dark:text-gray-200">{sk.demand_percentage}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        sk.status === 'mastered' ? 'bg-emerald-500' : (sk.status === 'in_progress' ? 'bg-blue-500' : 'bg-amber-500')
                      }`}
                      style={{ width: `${sk.demand_percentage}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] pt-1 text-gray-400 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                  <span>Found in {sk.job_count} active postings</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {sk.trend === 'explosive' ? '🔥 Explosive' : '📈 Trending'}
                    </span>
                    <button
                      onClick={() => openNoteGPTStudio(sk.skill)}
                      className="text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                      title="Bridge this skill gap with NoteGPT"
                    >
                      <Brain className="w-3 h-3" />
                      <span>NoteGPT</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: 2025/2026 Tech Boom Radar */}
      {activeSubTab === 'boom' && (
        <div 
          className="p-6 rounded-3xl border space-y-6 shadow-sm"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              2025 / 2026 Emerging Technology Boom Radar
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              High-growth technical paradigms experiencing rapid hiring spikes across leading engineering teams worldwide.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {(marketIntel?.market_summary?.emerging_boom_technologies || []).map((boom, idx) => (
              <div
                key={idx}
                className="p-6 rounded-3xl border space-y-3.5 bg-gradient-to-br from-gray-50 to-indigo-50/30 dark:from-gray-900/40 dark:to-indigo-950/20 shadow-sm"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-2xl bg-orange-100 dark:bg-orange-950 text-orange-600 shadow-xs">
                      <Flame className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {boom.name}
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200 border border-orange-300 dark:border-orange-800 shadow-xs">
                    {boom.growth}
                  </span>
                </div>

                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {boom.reason}
                </p>

                <div className="pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border-primary)' }}>
                  <button
                    onClick={() => openNoteGPTStudio(boom.name)}
                    className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>Open NoteGPT Blueprint</span>
                  </button>
                  <span className="text-gray-400 font-medium">
                    Top 5% Salary Tier
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 5: NoteGPT Skill Studio */}
      {activeSubTab === 'notegpt' && (
        <NoteGPTSkillStudio
          initialSkill={noteGPTSkill}
          onSuccessToast={onSuccessToast}
          onErrorToast={onErrorToast}
        />
      )}
    </div>
  );
};
