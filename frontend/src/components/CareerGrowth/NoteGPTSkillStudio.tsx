import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Network,
  Compass,
  Award,
  FileText,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Check,
  ChevronRight,
  ChevronDown,
  Layers,
  Search,
  Code2,
  Copy,
  Zap,
  Clock,
  ShieldCheck,
  BookOpen,
  HelpCircle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Star,
  CheckCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  NoteGPTSkillBridgeResponse,
  NoteGPTMindMapNode,
  NoteGPTRoadmapPhase,
  NoteGPTVerifiedCertification
} from '../../types';
import { apiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface NoteGPTSkillStudioProps {
  initialSkill?: string;
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
  onClose?: () => void;
}

export const NoteGPTSkillStudio: React.FC<NoteGPTSkillStudioProps> = ({
  initialSkill = 'Apache Kafka & Event Streaming',
  onSuccessToast,
  onErrorToast,
  onClose
}) => {
  const { getAuthHeaders, activeProfile } = useAuth();
  const [selectedSkill, setSelectedSkill] = useState<string>(initialSkill);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [data, setData] = useState<NoteGPTSkillBridgeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'mindmap' | 'roadmap' | 'certs' | 'notes' | 'flashcards'>('mindmap');

  // Mind map interactive state
  const [selectedNode, setSelectedNode] = useState<NoteGPTMindMapNode | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [mindMapView, setMindMapView] = useState<'canvas' | 'outline'>('canvas');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Roadmap interactive state
  const [completedMilestones, setCompletedMilestones] = useState<Record<string, boolean>>({});

  // Verified certs interactive state
  const [certFilter, setCertFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [verifyingCert, setVerifyingCert] = useState<NoteGPTVerifiedCertification | null>(null);
  const [credentialUrlInput, setCredentialUrlInput] = useState<string>('');
  const [submittingProof, setSubmittingProof] = useState<boolean>(false);

  // Flashcards state
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Available quick skill suggestions
  const suggestedSkills = [
    'Apache Kafka & Event Streaming',
    'Kubernetes & Cloud Infrastructure (K8s / Helm)',
    'Vector Databases & GraphRAG (Neo4j / Qdrant)',
    'Redis Caching & Distributed Locking',
    'Docker & Container Orchestration',
    'Rust Systems Programming & WASM',
    'System Design & Microservices Architecture',
    'PostgreSQL & Query Optimization',
    'AWS Solutions & Cloud Native'
  ];

  useEffect(() => {
    if (initialSkill) {
      setSelectedSkill(initialSkill);
      loadSkillBridge(initialSkill);
    }
  }, [initialSkill]);

  const loadSkillBridge = async (skillToLoad: string) => {
    setLoading(true);
    setSelectedNode(null);
    try {
      const res = await apiService.getNoteGPTSkillBridge(skillToLoad, 'Backend Engineer', getAuthHeaders());
      setData(res);
      if (res.mindmap) {
        setSelectedNode(res.mindmap);
      }
    } catch (err: any) {
      onErrorToast(err.message || `Failed to load NoteGPT bridge for ${skillToLoad}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSelectedSkill(searchQuery.trim());
    loadSkillBridge(searchQuery.trim());
  };

  const handleSelectSkill = (sk: string) => {
    setSelectedSkill(sk);
    loadSkillBridge(sk);
  };

  const toggleNodeCollapse = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const toggleMilestone = (key: string) => {
    setCompletedMilestones(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    onSuccessToast('Copied snippet to clipboard!');
  };

  const handleVerifyCertificateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingCert) return;

    setSubmittingProof(true);
    try {
      const res = await apiService.verifyCertificateProof(
        {
          skill_name: data?.skill || selectedSkill,
          certificate_title: verifyingCert.title,
          issuer: verifyingCert.issuer,
          credential_url: credentialUrlInput.trim() || verifyingCert.url
        },
        getAuthHeaders()
      );

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (ce) {
        // confetti fallback
      }

      onSuccessToast(res.message || '🎉 Verified certificate added to your CareerOS Profile Graph!');
      setVerifyingCert(null);
      setCredentialUrlInput('');
    } catch (err: any) {
      onErrorToast(err.message || 'Failed to submit verification proof');
    } finally {
      setSubmittingProof(false);
    }
  };

  // Calculate roadmap progress
  const totalMilestonesCount = (data?.roadmap.phases || []).reduce((acc, p) => acc + p.milestones.length, 0);
  const completedCount = Object.values(completedMilestones).filter(Boolean).length;
  const progressPercent = totalMilestonesCount > 0 ? Math.round((completedCount / totalMilestonesCount) * 100) : 0;

  // Filtered certifications
  const freeCerts = data?.verified_certifications.free_options || [];
  const paidCerts = data?.verified_certifications.paid_credentials || [];
  const displayedCerts = certFilter === 'all'
    ? [...freeCerts, ...paidCerts]
    : certFilter === 'free'
      ? freeCerts
      : paidCerts;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Studio Hero Header */}
      <div className="p-6 sm:p-8 rounded-3xl border shadow-xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white border-blue-500/30 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 bottom-0 w-64 h-64 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold backdrop-blur-sm">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span>NoteGPT Skill Gap Superpowers</span>
              <span className="px-1.5 py-0.2 text-[10px] bg-purple-400 text-slate-950 rounded font-black">AI</span>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-blue-200 transition-all self-start sm:self-auto"
              >
                ✕ Close Studio
              </button>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                {data?.skill || selectedSkill}
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/80 leading-relaxed">
                {data?.tagline || 'Master critical engineering gaps with NoteGPT interactive visual mind maps, structured learning roadmaps, and verified free/paid credential proofs.'}
              </p>
            </div>

            {/* Quick Stats / Action Pill */}
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 px-6 rounded-2xl border border-white/15 shrink-0">
              <div className="text-center">
                <span className="block text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                  {freeCerts.length + paidCerts.length}
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-200">
                  Verified Proofs
                </span>
              </div>
              <div className="h-10 w-[1px] bg-white/20" />
              <div className="text-center">
                <span className="block text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  {progressPercent}%
                </span>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-200">
                  Sprint Roadmap
                </span>
              </div>
            </div>
          </div>

          {/* Search & Skill Picker */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-blue-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search or enter any skill (e.g. Kafka, Docker, Rust)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white/10 border border-white/20 text-white placeholder-blue-200/60 focus:outline-none focus:ring-2 focus:ring-purple-400/50 backdrop-blur-sm"
              />
            </form>

            {/* Quick Preset Skill Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {suggestedSkills.slice(0, 4).map((sk) => (
                <button
                  key={sk}
                  onClick={() => handleSelectSkill(sk)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all border ${
                    selectedSkill.toLowerCase().includes(sk.split(' ')[0].toLowerCase())
                      ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                      : 'bg-white/5 text-blue-200 border-white/10 hover:bg-white/15'
                  }`}
                >
                  {sk.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/10 text-xs">
            <button
              onClick={() => setActiveTab('mindmap')}
              className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeTab === 'mindmap'
                  ? 'bg-purple-600 text-white shadow-lg scale-102'
                  : 'bg-white/10 text-blue-200 hover:bg-white/20'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-purple-300" />
              <span>Interactive Mind Map</span>
            </button>

            <button
              onClick={() => setActiveTab('roadmap')}
              className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeTab === 'roadmap'
                  ? 'bg-purple-600 text-white shadow-lg scale-102'
                  : 'bg-white/10 text-blue-200 hover:bg-white/20'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-blue-300" />
              <span>Phased Learning Roadmap ({completedCount}/{totalMilestonesCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('certs')}
              className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeTab === 'certs'
                  ? 'bg-purple-600 text-white shadow-lg scale-102'
                  : 'bg-white/10 text-blue-200 hover:bg-white/20'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              <span>Verified Courses & Cert Proofs ({freeCerts.length + paidCerts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeTab === 'notes'
                  ? 'bg-purple-600 text-white shadow-lg scale-102'
                  : 'bg-white/10 text-blue-200 hover:bg-white/20'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-300" />
              <span>AI Study Notes & Cheat Sheet</span>
            </button>

            <button
              onClick={() => setActiveTab('flashcards')}
              className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
                activeTab === 'flashcards'
                  ? 'bg-purple-600 text-white shadow-lg scale-102'
                  : 'bg-white/10 text-blue-200 hover:bg-white/20'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-rose-300" />
              <span>Mastery Quiz & Flashcards</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <div className="relative">
            <Brain className="w-10 h-10 text-purple-600 animate-pulse" />
            <Sparkles className="w-4 h-4 text-amber-400 absolute -top-1 -right-1 animate-spin" />
          </div>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            NoteGPT Engine generating deep mind map, roadmap & verified certificate catalog for {selectedSkill}...
          </p>
        </div>
      ) : !data ? (
        <div className="p-8 text-center rounded-3xl border border-dashed text-gray-500">
          No data returned for this skill. Try selecting another skill.
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* TAB 1: INTERACTIVE MIND MAP                              */}
          {/* ======================================================== */}
          {activeTab === 'mindmap' && (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 px-4 rounded-2xl border" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    Visual Mind Map
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold">
                    Click any node to inspect deep dive & code snippet
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* View switcher */}
                  <div className="flex rounded-xl p-0.5 border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                    <button
                      onClick={() => setMindMapView('canvas')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        mindMapView === 'canvas' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      Graph Canvas
                    </button>
                    <button
                      onClick={() => setMindMapView('outline')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        mindMapView === 'outline' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      Outline Tree
                    </button>
                  </div>

                  {mindMapView === 'canvas' && (
                    <div className="flex items-center gap-1 border-l pl-2" style={{ borderColor: 'var(--border-primary)' }}>
                      <button
                        onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.1))}
                        className="p-1.5 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-mono font-bold w-10 text-center" style={{ color: 'var(--text-secondary)' }}>
                        {Math.round(zoomLevel * 100)}%
                      </span>
                      <button
                        onClick={() => setZoomLevel(prev => Math.min(1.4, prev + 0.1))}
                        className="p-1.5 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setZoomLevel(1)}
                        className="p-1.5 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                        title="Reset Zoom"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const jsonStr = JSON.stringify(data.mindmap, null, 2);
                      const blob = new Blob([jsonStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${data.skill.toLowerCase().replace(/[^a-z0-9]/g, '_')}_mindmap.json`;
                      a.click();
                      onSuccessToast('Exported Mind Map JSON');
                    }}
                    className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-800"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                  </button>
                </div>
              </div>

              {/* Main Canvas + Inspector Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left: Mind Map Visualizer */}
                <div
                  className="lg:col-span-8 p-6 rounded-3xl border shadow-sm relative overflow-x-auto min-h-[500px]"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                >
                  {mindMapView === 'canvas' ? (
                    <div
                      ref={canvasRef}
                      style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top left', transition: 'transform 0.15s ease' }}
                      className="space-y-8 min-w-[650px] p-2"
                    >
                      {/* Root Central Node */}
                      <div className="flex justify-center">
                        <div
                          onClick={() => setSelectedNode(data.mindmap)}
                          className={`p-4 px-6 rounded-2xl border cursor-pointer transition-all shadow-md flex items-center gap-3 ${
                            selectedNode?.id === data.mindmap.id
                              ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-400'
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-400'
                          }`}
                        >
                          <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-sm">
                            <Brain className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                              Central Knowledge Core
                            </span>
                            <h3 className="text-base font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                              {data.mindmap.label}
                            </h3>
                          </div>
                        </div>
                      </div>

                      {/* Primary Branches Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative pt-4">
                        {(data.mindmap.children || []).map((branch, bIdx) => {
                          const isCollapsed = collapsedNodes[branch.id];
                          const isSelected = selectedNode?.id === branch.id;

                          return (
                            <div
                              key={branch.id}
                              className={`p-4 rounded-2xl border transition-all space-y-3 ${
                                isSelected
                                  ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/30 dark:bg-purple-950/20'
                                  : 'hover:border-purple-300'
                              }`}
                              style={{
                                backgroundColor: isSelected ? undefined : 'var(--bg-secondary)',
                                borderColor: isSelected ? undefined : 'var(--border-primary)'
                              }}
                            >
                              {/* Branch Header */}
                              <div
                                onClick={() => setSelectedNode(branch)}
                                className="flex items-center justify-between cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                                    0{bIdx + 1}
                                  </span>
                                  <div>
                                    <h4 className="text-xs font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                                      {branch.label}
                                    </h4>
                                    <span className="text-[10px] text-gray-500">{branch.category}</span>
                                  </div>
                                </div>

                                {branch.children && branch.children.length > 0 && (
                                  <button
                                    onClick={(e) => toggleNodeCollapse(branch.id, e)}
                                    className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all text-[11px] font-bold flex items-center gap-1"
                                    title={isCollapsed ? 'Expand sub-nodes' : 'Collapse sub-nodes'}
                                  >
                                    <span className="px-1.5 py-0.2 rounded-full bg-gray-200 dark:bg-gray-700 text-[10px]">
                                      {branch.children.length}
                                    </span>
                                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </div>

                              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {branch.summary}
                              </p>

                              {/* Sub-branches / Leaves */}
                              {!isCollapsed && branch.children && branch.children.length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                                  {branch.children.map((sub) => {
                                    const isSubSelected = selectedNode?.id === sub.id;
                                    return (
                                      <div
                                        key={sub.id}
                                        onClick={() => setSelectedNode(sub)}
                                        className={`p-2 px-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                                          isSubSelected
                                            ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-xs'
                                            : 'hover:bg-white dark:hover:bg-gray-800 border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                                        }`}
                                        style={{
                                          color: isSubSelected ? '#ffffff' : 'var(--text-primary)'
                                        }}
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <div className={`w-1.5 h-1.5 rounded-full ${isSubSelected ? 'bg-white' : 'bg-purple-500'}`} />
                                          <span className="truncate">{sub.label}</span>
                                        </div>
                                        <span className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-mono ${
                                          isSubSelected ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                        }`}>
                                          {sub.category}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Outline Tree View */
                    <div className="space-y-4 text-xs">
                      <div
                        onClick={() => setSelectedNode(data.mindmap)}
                        className={`p-3 rounded-xl border cursor-pointer font-bold flex items-center gap-2 ${
                          selectedNode?.id === data.mindmap.id ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400' : ''
                        }`}
                        style={{ borderColor: 'var(--border-primary)' }}
                      >
                        <Brain className="w-4 h-4 text-purple-600" />
                        <span>{data.mindmap.label} (Core Root)</span>
                      </div>

                      <div className="pl-4 space-y-3 border-l-2 border-purple-200 dark:border-purple-900">
                        {(data.mindmap.children || []).map((branch) => (
                          <div key={branch.id} className="space-y-2">
                            <div
                              onClick={() => setSelectedNode(branch)}
                              className={`p-2.5 rounded-xl border cursor-pointer font-semibold flex items-center justify-between ${
                                selectedNode?.id === branch.id ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-400' : ''
                              }`}
                              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                            >
                              <span>{branch.label}</span>
                              <span className="text-[10px] text-gray-400">{branch.category}</span>
                            </div>

                            {branch.children && (
                              <div className="pl-4 space-y-1 border-l border-gray-200 dark:border-gray-800">
                                {branch.children.map((sub) => (
                                  <div
                                    key={sub.id}
                                    onClick={() => setSelectedNode(sub)}
                                    className={`p-2 rounded-lg cursor-pointer text-[11px] transition-all ${
                                      selectedNode?.id === sub.id ? 'bg-purple-600 text-white font-bold' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'
                                    }`}
                                  >
                                    • {sub.label}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Node Deep Dive Inspector */}
                <div
                  className="lg:col-span-4 p-5 rounded-3xl border space-y-4 shadow-sm sticky top-6"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                >
                  <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-primary)' }}>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                        NoteGPT Node Inspector
                      </span>
                    </div>
                    {selectedNode && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-mono">
                        {selectedNode.category}
                      </span>
                    )}
                  </div>

                  {selectedNode ? (
                    <div className="space-y-4 text-xs">
                      <div>
                        <h4 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                          {selectedNode.label}
                        </h4>
                        <p className="text-xs pt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {selectedNode.summary}
                        </p>
                      </div>

                      {/* Deep Dive */}
                      {selectedNode.deep_dive && (
                        <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/40 space-y-1.5">
                          <span className="font-bold text-[10px] uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
                            Architectural Deep Dive:
                          </span>
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                            {selectedNode.deep_dive}
                          </p>
                        </div>
                      )}

                      {/* Code Snippet / CLI */}
                      {selectedNode.code_snippet && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[10px] uppercase tracking-wider text-gray-400 flex items-center gap-1">
                              <Code2 className="w-3.5 h-3.5" />
                              <span>Code / Command Snippet:</span>
                            </span>
                            <button
                              onClick={() => handleCopy(selectedNode.code_snippet!)}
                              className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                            >
                              {copiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800 leading-snug">
                            {selectedNode.code_snippet}
                          </pre>
                        </div>
                      )}

                      {/* Interview Tip / Gotcha */}
                      {selectedNode.interview_tip && (
                        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-1 text-xs">
                          <span className="font-bold text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Interview Tip & Pitfall:</span>
                          </span>
                          <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                            {selectedNode.interview_tip}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-xs text-gray-400">
                      Click any node in the mind map to view in-depth architecture, code snippets, and interview tips.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: PHASED LEARNING ROADMAP                           */}
          {/* ======================================================== */}
          {activeTab === 'roadmap' && (
            <div className="space-y-6">
              {/* Progress Summary Card */}
              <div
                className="p-5 sm:p-6 rounded-3xl border shadow-sm space-y-3"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      Sprint Execution Roadmap & Milestone Checkpoints
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Total estimated duration: <strong>{data.roadmap.total_duration}</strong>. Check off completed milestones to track your progress.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black px-3 py-1 rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300">
                      {completedCount} of {totalMilestonesCount} Done ({progressPercent}%)
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-600 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Phases Cards List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(data.roadmap.phases || []).map((phase) => {
                  return (
                    <div
                      key={phase.phase_number}
                      className="p-6 rounded-3xl border space-y-4 shadow-sm flex flex-col justify-between"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200">
                            {phase.duration}
                          </span>
                          <span className="text-xs font-mono font-bold text-gray-400">
                            Phase 0{phase.phase_number}
                          </span>
                        </div>

                        <h4 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                          {phase.title}
                        </h4>

                        {/* Milestones checklist */}
                        <div className="space-y-2 pt-1 text-xs">
                          <span className="font-bold text-[10px] uppercase tracking-wider text-gray-400 block">
                            Milestones:
                          </span>
                          {phase.milestones.map((m, mIdx) => {
                            const mKey = `${phase.phase_number}_${mIdx}`;
                            const isDone = !!completedMilestones[mKey];

                            return (
                              <div
                                key={mIdx}
                                onClick={() => toggleMilestone(mKey)}
                                className={`p-2.5 px-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                                  isDone
                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 text-emerald-900 dark:text-emerald-200 line-through'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700'
                                }`}
                                style={{
                                  backgroundColor: isDone ? undefined : 'var(--bg-secondary)',
                                  borderColor: isDone ? undefined : 'var(--border-primary)'
                                }}
                              >
                                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                                  isDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-gray-400'
                                }`}>
                                  {isDone && <Check className="w-3 h-3" />}
                                </div>
                                <span className="leading-snug">{m}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Hands-on Lab & Deliverable */}
                      <div className="pt-3 border-t space-y-2 text-xs" style={{ borderColor: 'var(--border-primary)' }}>
                        <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/40 space-y-1">
                          <span className="font-bold text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
                            🧪 Hands-On Lab:
                          </span>
                          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {phase.hands_on_lab}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                          <CheckCheck className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Deliverable: {phase.deliverable}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: VERIFIED COURSES & CERTIFICATIONS (PROOF ENGINE)  */}
          {/* ======================================================== */}
          {activeTab === 'certs' && (
            <div className="space-y-6">
              {/* Header and Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Verifiable Credentials & Recognized Courses Proofs
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Recruiters require verifiable proof of competency. Complete these free or paid certifications and link them to your CareerOS Profile Graph.
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex rounded-xl p-1 border text-xs" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
                  <button
                    onClick={() => setCertFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      certFilter === 'all' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-500'
                    }`}
                  >
                    All Proofs ({freeCerts.length + paidCerts.length})
                  </button>
                  <button
                    onClick={() => setCertFilter('free')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      certFilter === 'free' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-500'
                    }`}
                  >
                    🟢 100% Free ({freeCerts.length})
                  </button>
                  <button
                    onClick={() => setCertFilter('paid')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      certFilter === 'paid' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500'
                    }`}
                  >
                    💎 Gold-Standard ({paidCerts.length})
                  </button>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {displayedCerts.map((cert, idx) => {
                  const isFree = cert.cost.toLowerCase().includes('0') || cert.cost.toLowerCase().includes('free');

                  return (
                    <div
                      key={idx}
                      className="p-6 rounded-3xl border space-y-4 shadow-sm flex flex-col justify-between transition-all hover:border-purple-400"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                    >
                      <div className="space-y-3">
                        {/* Header Badges */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                              {cert.issuer}
                            </span>
                            <h4 className="text-base font-bold tracking-tight leading-snug" style={{ color: 'var(--text-primary)' }}>
                              {cert.title}
                            </h4>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 ${
                            isFree
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300'
                          }`}>
                            {cert.cost}
                          </span>
                        </div>

                        {/* Format & Duration Pills */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-2.5 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-1 font-semibold">
                            <Clock className="w-3 h-3 text-purple-500" />
                            <span>{cert.duration}</span>
                          </span>

                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center gap-1 font-semibold">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            <span>{cert.credibility_rating}</span>
                          </span>

                          {cert.is_verifiable_on_credly && (
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold">
                              ✓ Credly Badge
                            </span>
                          )}
                        </div>

                        {/* Proof Value Box */}
                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-1 text-xs">
                          <span className="font-bold text-[10px] uppercase tracking-wider text-purple-600 block">
                            Recruiter Proof Impact:
                          </span>
                          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                            {cert.proof_value}
                          </p>
                        </div>

                        {/* Skills Tested */}
                        {cert.skills_tested && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {cert.skills_tested.map((sk, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                              >
                                {sk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action CTAs */}
                      <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--border-primary)' }}>
                        <a
                          href={cert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          <span>Open Course Page</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          type="button"
                          onClick={() => setVerifyingCert(cert)}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-98 shadow-md flex items-center gap-1.5 transition-all"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Verify in CareerOS Graph</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: AI STUDY NOTES & CHEAT SHEET                      */}
          {/* ======================================================== */}
          {activeTab === 'notes' && (
            <div className="space-y-6">
              {/* Executive TLDR */}
              <div
                className="p-6 rounded-3xl border shadow-sm space-y-3"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Executive Summary & Architecture TL;DR</span>
                  </h3>
                  <button
                    onClick={() => {
                      const notesMarkdown = `# NoteGPT Study Notes: ${data.skill}\n\n## TL;DR\n${data.study_notes.tldr.map(t => `- ${t}`).join('\n')}\n\n## CLI Cheat Sheet\n${data.study_notes.cheat_sheet_commands.map(c => `### ${c.desc}\n\`\`\`bash\n${c.cmd}\n\`\`\``).join('\n\n')}\n\n## Senior vs Junior Mental Models\n${data.study_notes.senior_vs_junior.map(p => `**Junior:** ${p.junior}\n**Senior:** ${p.senior}\n`).join('\n')}`;
                      handleCopy(notesMarkdown);
                    }}
                    className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Full Markdown Notes</span>
                  </button>
                </div>

                <div className="space-y-2 text-xs pt-1">
                  {data.study_notes.tldr.map((t, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="leading-relaxed" style={{ color: 'var(--text-primary)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CLI Commands Cheat Sheet */}
              <div
                className="p-6 rounded-3xl border shadow-sm space-y-4"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
              >
                <h3 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Terminal CLI & Production Commands Cheat Sheet
                </h3>

                <div className="space-y-3">
                  {data.study_notes.cheat_sheet_commands.map((cmd, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl border space-y-2"
                      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                          {cmd.desc}
                        </span>
                        <button
                          onClick={() => handleCopy(cmd.cmd)}
                          className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold hover:underline flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </button>
                      </div>
                      <pre className="p-2.5 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800">
                        {cmd.cmd}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>

              {/* Junior vs Senior Mindsets */}
              <div
                className="p-6 rounded-3xl border shadow-sm space-y-4"
                style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
              >
                <h3 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Senior vs Junior Engineering Mental Models
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.study_notes.senior_vs_junior.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border space-y-3"
                      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
                    >
                      <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs">
                        <span className="font-bold text-[10px] uppercase text-red-600 block">
                          Junior Trap / Pitfall:
                        </span>
                        <p className="text-gray-700 dark:text-gray-300 pt-0.5 leading-snug">
                          {item.junior}
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs">
                        <span className="font-bold text-[10px] uppercase text-emerald-600 block">
                          Senior Engineering Mindset:
                        </span>
                        <p className="text-gray-700 dark:text-gray-300 pt-0.5 leading-snug">
                          {item.senior}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: MASTERY QUIZ & FLASHCARDS                         */}
          {/* ======================================================== */}
          {activeTab === 'flashcards' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Interactive Interview Mastery Flashcards
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Card {activeCardIndex + 1} of {data.flashcards.length}. Click card to flip and reveal technical answer.
                </p>
              </div>

              {/* 3D Flip Card */}
              {data.flashcards.length > 0 && (
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="min-h-[260px] p-8 rounded-3xl border shadow-lg cursor-pointer transition-all flex flex-col justify-between relative overflow-hidden"
                  style={{
                    backgroundColor: isFlipped ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                    borderColor: isFlipped ? 'var(--brand-500, #9333ea)' : 'var(--border-primary)'
                  }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                      {isFlipped ? 'Answer & Architectural Rationale' : 'Technical Interview Question'}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-400">
                      Click to {isFlipped ? 'view question' : 'reveal answer'}
                    </span>
                  </div>

                  <div className="py-6">
                    {isFlipped ? (
                      <p className="text-sm sm:text-base leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
                        {data.flashcards[activeCardIndex].answer}
                      </p>
                    ) : (
                      <h4 className="text-base sm:text-lg font-black tracking-tight leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {data.flashcards[activeCardIndex].question}
                      </h4>
                    )}
                  </div>

                  <div className="pt-4 border-t flex items-center justify-between text-xs text-gray-400" style={{ borderColor: 'var(--border-primary)' }}>
                    <span>NoteGPT Interview Deck</span>
                    <span className="font-mono">{activeCardIndex + 1} / {data.flashcards.length}</span>
                  </div>
                </div>
              )}

              {/* Card Controls */}
              <div className="flex items-center justify-between gap-3">
                <button
                  disabled={activeCardIndex === 0}
                  onClick={() => {
                    setActiveCardIndex(prev => Math.max(0, prev - 1));
                    setIsFlipped(false);
                  }}
                  className="px-4 py-2 rounded-xl border text-xs font-bold disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                >
                  ← Previous Card
                </button>

                <button
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-sm"
                >
                  {isFlipped ? 'Show Question' : 'Flip to Reveal'}
                </button>

                <button
                  disabled={activeCardIndex === data.flashcards.length - 1}
                  onClick={() => {
                    setActiveCardIndex(prev => Math.min(data.flashcards.length - 1, prev + 1));
                    setIsFlipped(false);
                  }}
                  className="px-4 py-2 rounded-xl border text-xs font-bold disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                >
                  Next Card →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* MODAL: VERIFY CERTIFICATE IN GRAPH                       */}
      {/* ======================================================== */}
      {verifyingCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-lg p-6 sm:p-7 rounded-3xl border shadow-2xl space-y-5 animate-in zoom-in-95"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          >
            <div className="flex items-start justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Verify Certificate in Graph
                  </h3>
                  <p className="text-xs text-gray-500">
                    Sync tangible proof into your CareerOS Knowledge Graph
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVerifyingCert(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Target info */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 space-y-1 text-xs">
              <span className="font-bold text-[10px] uppercase text-purple-600 block">
                Certificate to Verify:
              </span>
              <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                {verifyingCert.title}
              </p>
              <p className="text-gray-500 text-[11px]">
                Issuer: {verifyingCert.issuer} • Skill: {data?.skill || selectedSkill}
              </p>
            </div>

            {/* Verification Form */}
            <form onSubmit={handleVerifyCertificateSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold block" style={{ color: 'var(--text-primary)' }}>
                  Credential URL / Credly Badge Link / Certificate ID:
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://www.credly.com/badges/... or Certificate ID"
                  value={credentialUrlInput}
                  onChange={(e) => setCredentialUrlInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)'
                  }}
                />
                <span className="text-[10px] text-gray-400 block">
                  Paste your public Credly share URL, certificate verification page, or completion badge link.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300">
                ✓ Once verified, <strong>'{data?.skill || selectedSkill}'</strong> will immediately transition to <strong>'Mastered'</strong> in your Profile Graph, re-weighting all Opportunity Radar match scores!
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                <button
                  type="button"
                  onClick={() => setVerifyingCert(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submittingProof}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{submittingProof ? 'Verifying in Graph...' : 'Submit & Verify in Graph'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
