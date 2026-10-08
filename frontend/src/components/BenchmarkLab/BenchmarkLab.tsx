import { WorkspacePageHeader, WorkspaceMetrics, WorkspaceSectionHeading, WorkspaceEmptyState, WorkspaceSteps } from '../WorkspaceUI';
import { DialogFrame } from '../DialogFrame';
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  GitBranch, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  RefreshCw, 
  ArrowRight, 
  Zap, 
  Target, 
  Award, 
  Layers, 
  ChevronRight,
  ExternalLink,
  Code2,
  Trash2,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { apiService } from '../../services/api';
import { BenchmarkPeer, BenchmarkComparisonResult } from '../../types';

interface BenchmarkLabProps {
  onSelectTailorResume?: (role: string, company: string, jd: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export const BenchmarkLab: React.FC<BenchmarkLabProps> = ({
  onSelectTailorResume,
  onError,
  onSuccess,
}) => {
  const { getAuthHeaders, activeProfile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [peers, setPeers] = useState<BenchmarkPeer[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string>('');
  const [comparison, setComparison] = useState<BenchmarkComparisonResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [comparing, setComparing] = useState<boolean>(false);

  // Add Peer Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newPeerGithub, setNewPeerGithub] = useState<string>('');
  const [newPeerName, setNewPeerName] = useState<string>('');
  const [newPeerRole, setNewPeerRole] = useState<string>('');
  const [newPeerCompany, setNewPeerCompany] = useState<string>('');
  const [newPeerSkills, setNewPeerSkills] = useState<string>('');
  const [addingPeer, setAddingPeer] = useState<boolean>(false);

  const loadPeers = async () => {
    try {
      const res = await apiService.getBenchmarkPeers(getAuthHeaders());
      const peerList: BenchmarkPeer[] = res.peers || [];
      setPeers(peerList);
      if (peerList.length > 0 && !selectedPeerId) {
        setSelectedPeerId(peerList[0].id);
      }
    } catch (err: any) {
      console.error(err);
      onError(err.message || 'Failed to load benchmark peers');
    }
  };

  const runComparison = async (peerId?: string) => {
    setComparing(true);
    try {
      const res = await apiService.getBenchmarkComparison(peerId || selectedPeerId, getAuthHeaders());
      setComparison(res);
    } catch (err: any) {
      console.error(err);
      onError(err.message || 'Comparison failed');
    } finally {
      setComparing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeers();
  }, [activeProfile.id]);

  useEffect(() => {
    if (selectedPeerId || peers.length > 0) {
      runComparison(selectedPeerId);
    } else {
      setLoading(false);
    }
  }, [selectedPeerId]);

  const handleAddPeer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeerGithub && !newPeerName) {
      onError('Please enter either a GitHub username or a display name');
      return;
    }
    setAddingPeer(true);
    try {
      const skillsArray = newPeerSkills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await apiService.addBenchmarkPeer(
        {
          github_username: newPeerGithub.trim() || undefined,
          name: newPeerName.trim() || undefined,
          role: newPeerRole.trim() || undefined,
          company: newPeerCompany.trim() || undefined,
          custom_skills: skillsArray,
        },
        getAuthHeaders()
      );

      onSuccess(`Benchmark peer ${res.peer?.name || ''} successfully added & indexed!`);
      setIsAddModalOpen(false);
      setNewPeerGithub('');
      setNewPeerName('');
      setNewPeerRole('');
      setNewPeerCompany('');
      setNewPeerSkills('');
      
      await loadPeers();
      if (res.peer?.id) {
        setSelectedPeerId(res.peer.id);
      }
    } catch (err: any) {
      console.error(err);
      onError(err.message || 'Failed to ingest benchmark peer');
    } finally {
      setAddingPeer(false);
    }
  };

  const handleDeletePeer = async (peerId: string) => {
    try {
      await apiService.deleteBenchmarkPeer(peerId, getAuthHeaders());
      onSuccess('Benchmark peer removed');
      const updated = peers.filter((p) => p.id !== peerId);
      setPeers(updated);
      if (selectedPeerId === peerId && updated.length > 0) {
        setSelectedPeerId(updated[0].id);
      }
    } catch (err: any) {
      console.error(err);
      onError(err.message || 'Failed to remove peer');
    }
  };

  return (
    <div className="dashboard-view ws-page dashboard-view--benchmark space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Top Header & Peer Selector */}
      <WorkspacePageHeader page="benchmark" eyebrow="LEARN FROM THE NEXT LEVEL" title="A clearer view of what comes next." description="Compare your strengths with a target peer and turn the gaps into a practical growth plan." actions={<div className="ws-heading-controls">
          <select
            aria-label="Benchmark peer" disabled={!peers.length} value={selectedPeerId}
            onChange={(e) => setSelectedPeerId(e.target.value)}
            className="input-base text-xs font-semibold py-2 px-3 rounded-xl max-w-xs cursor-pointer"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            {!peers.length && <option value="">Add your first benchmark peer</option>}
            {peers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role} @ {p.company})
              </option>
            ))}
          </select>

          <button
            onClick={() => runComparison(selectedPeerId)}
            disabled={comparing || !selectedPeerId}
            className="dashboard-button "
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border-primary)',
            }}
            title="Re-run Gap Matrix"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${comparing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="dashboard-button dashboard-button-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add a peer</span>
          </button>
        </div>} />

      {/* Main Analysis Body */}
      {loading || comparing ? (
        <div className="p-16 text-center space-y-4 rounded-2xl border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Comparing your experience and strengths…
          </h4>
          <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Comparing AST-verified skills, repository complexity, and architecture depth against benchmark profile.
          </p>
        </div>
      ) : comparison ? (
        <div className="space-y-6">
          {/* Side-by-Side HUD Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Candidate Card */}
            <div
              className="p-5 rounded-2xl border relative overflow-hidden transition-all shadow-xs"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-primary)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    {(comparison.candidate.name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                      Your profile
                    </span>
                    <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {comparison.candidate.name}
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Readiness Score
                  </span>
                  <p className="text-xl font-black text-blue-600">
                    {comparison.ai_analysis.candidate_score}%
                  </p>
                </div>
              </div>

              {/* Candidate Metrics */}
              <div className="grid grid-cols-3 gap-2.5 pt-3 border-t text-center" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--text-tertiary)' }}>Repos</span>
                  <strong className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {comparison.candidate.repos_count}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--text-tertiary)' }}>Verified Skills</span>
                  <strong className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {comparison.candidate.skills.length}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--text-tertiary)' }}>Network Reach</span>
                  <strong className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {comparison.candidate.connections_count}
                  </strong>
                </div>
              </div>
            </div>

            {/* Benchmark Peer Card */}
            <div
              className="p-5 rounded-2xl border relative overflow-hidden transition-all shadow-xs"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-primary)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {comparison.peer.avatar_url ? (
                    <img
                      src={comparison.peer.avatar_url}
                      alt={comparison.peer.name}
                      className="w-10 h-10 rounded-xl object-cover border"
                      style={{ borderColor: 'var(--border-primary)' }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center text-sm">
                      {comparison.peer.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                      Your benchmark peer
                    </span>
                    <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {comparison.peer.name}
                    </h3>
                    <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                      {comparison.peer.role} @ {comparison.peer.company}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Peer Benchmark
                  </span>
                  <p className="text-xl font-black text-purple-600">
                    {comparison.ai_analysis.peer_score}%
                  </p>
                </div>
              </div>

              {/* Peer Metrics */}
              <div className="grid grid-cols-3 gap-2.5 pt-3 border-t text-center" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--text-tertiary)' }}>Benchmark Repos</span>
                  <strong className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {comparison.peer.repos_count}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--text-tertiary)' }}>Peer Skills</span>
                  <strong className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    {comparison.peer.skills.length}
                  </strong>
                </div>
                <div className="p-2.5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <span className="text-[10px] block" style={{ color: 'var(--text-tertiary)' }}>Overlap Ratio</span>
                  <strong className="text-sm font-bold text-emerald-600">
                    {comparison.skill_matrix.overlap_percentage}%
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* AI Gap Summary Banner */}
          <div
            className="p-5 rounded-2xl border"
            style={{
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#F8FAFC',
              borderColor: 'var(--border-primary)',
            }}
          >
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-500">
                  Your comparison insights
                </h4>
                <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
                  "{comparison.ai_analysis.hiring_manager_verdict}"
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {comparison.ai_analysis.experience_gap_summary}
                </p>
              </div>
            </div>
          </div>

          {/* Interactive 3-Way Skill Matrix */}
          <div
            className="p-6 rounded-2xl border space-y-6"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-primary)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  Your skills, side by side
                </h3>
              </div>
              <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>
                {comparison.skill_matrix.shared_skills.length} Shared / {comparison.skill_matrix.missing_peer_skills.length} Gaps
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* 1. Shared Strengths */}
              <div className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Shared Strengths
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">
                    {comparison.skill_matrix.shared_skills.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {comparison.skill_matrix.shared_skills.length > 0 ? (
                    comparison.skill_matrix.shared_skills.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                      No direct skill overlaps detected yet.
                    </p>
                  )}
                </div>
              </div>

              {/* 2. Your Unique Advantages */}
              <div className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-blue-600">
                    <Zap className="w-3.5 h-3.5" /> Your Unique Edge
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-bold">
                    {comparison.skill_matrix.candidate_unique_skills.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {comparison.skill_matrix.candidate_unique_skills.length > 0 ? (
                    comparison.skill_matrix.candidate_unique_skills.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                      Sync additional GitHub repos to showcase edge skills.
                    </p>
                  )}
                </div>
              </div>

              {/* 3. Skill Gaps to Bridge */}
              <div className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-amber-600">
                    <AlertCircle className="w-3.5 h-3.5" /> Missing Skills (Gap)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold">
                    {comparison.skill_matrix.missing_peer_skills.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {comparison.skill_matrix.missing_peer_skills.length > 0 ? (
                    comparison.skill_matrix.missing_peer_skills.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                      Zero missing skills — you match this peer 100%!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actionable Strategic Roadmap */}
          <div
            className="p-6 rounded-2xl border space-y-6"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-primary)',
            }}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                A practical plan to close the gaps
              </h3>
            </div>

            {/* Critical Skills Deep Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {comparison.ai_analysis.critical_skill_gaps.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border space-y-2.5 transition-all"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                      {item.skill}
                    </h4>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.priority === 'High'
                          ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      }`}
                    >
                      {item.priority} Priority
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <strong>Why it matters:</strong> {item.impact}
                  </p>
                  <div className="p-2.5 rounded-lg border text-xs" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
                    <span className="font-semibold text-blue-600 block mb-0.5">Recommended Project:</span>
                    <p style={{ color: 'var(--text-primary)' }}>{item.action_item}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Phased Roadmap Timeline */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Milestone Execution Timeline
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {comparison.ai_analysis.strategic_roadmap.map((phase, pIdx) => (
                  <div
                    key={pIdx}
                    className="p-4 rounded-xl border space-y-3"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-primary)',
                    }}
                  >
                    <h5 className="text-xs font-bold text-blue-600 flex items-center gap-1.5">
                      <ChevronRight className="w-3.5 h-3.5" />
                      {phase.phase}
                    </h5>
                    <ul className="space-y-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                      {phase.milestones.map((m, mIdx) => (
                        <li key={mIdx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Direct Action Bridge */}
            {onSelectTailorResume && (
              <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: 'var(--border-primary)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Ready to apply for {comparison.peer.role} roles with tailored proof of work?
                </p>
                <button
                  onClick={() => onSelectTailorResume(comparison.peer.role, comparison.peer.company, '')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Tailor Resume for this Role
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <WorkspaceEmptyState icon={Target} title="Choose a person you can learn from" description="Add a target peer to compare shared skills, discover your own advantages, and find the next capabilities to develop."><button className="dashboard-button dashboard-button-primary" onClick={() => setIsAddModalOpen(true)}><Plus size={16} />Add your first peer</button></WorkspaceEmptyState>
      )}

      {/* Add Peer Modal */}
      {isAddModalOpen && (
        <DialogFrame label="Add a benchmark peer" onClose={() => setIsAddModalOpen(false)} busy={addingPeer}>
          <div
            className="w-full max-w-lg p-6 rounded-2xl border shadow-xl space-y-5"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-primary)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                    Add Benchmark Target Peer
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Scan a real GitHub profile or define a target senior role.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddPeer} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  GitHub Username (Auto-scans repositories & skills):
                </label>
                <div className="relative">
                  <input aria-label="e.g. torvalds or target-peer-username"
                    type="text"
                    value={newPeerGithub}
                    onChange={(e) => setNewPeerGithub(e.target.value)}
                    placeholder="e.g. torvalds or target-peer-username"
                    className="input-base w-full pl-8"
                  />
                  <Code2 className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Display Name:
                  </label>
                  <input aria-label="Display Name:"
                    type="text"
                    value={newPeerName}
                    onChange={(e) => setNewPeerName(e.target.value)}
                    placeholder="e.g. Alex (Staff ML)"
                    className="input-base w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Target Role / Title:
                  </label>
                  <input aria-label="Target Role / Title:"
                    type="text"
                    value={newPeerRole}
                    onChange={(e) => setNewPeerRole(e.target.value)}
                    placeholder="e.g. Staff Systems Engineer"
                    className="input-base w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Target Company:
                  </label>
                  <input aria-label="Target Company:"
                    type="text"
                    value={newPeerCompany}
                    onChange={(e) => setNewPeerCompany(e.target.value)}
                    placeholder="e.g. OpenAI / Google"
                    className="input-base w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Custom Skills (comma-separated):
                  </label>
                  <input aria-label="Custom Skills (comma-separated):"
                    type="text"
                    value={newPeerSkills}
                    onChange={(e) => setNewPeerSkills(e.target.value)}
                    placeholder="e.g. Rust, CUDA, Kubernetes"
                    className="input-base w-full"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                <button disabled={addingPeer}
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingPeer}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
                >
                  {addingPeer ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Scanning & Indexing…
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Save & Ingest Peer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </DialogFrame>
      )}
    </div>
  );
};

